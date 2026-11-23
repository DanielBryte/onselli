import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { auth } from '@/src/server/auth';
import { getDatabase } from '@/src/server/db';
import { getDatabaseErrorInfo } from '@/src/server/db/error-info';
import { auditLogs, creators, sitePages, sites, users } from '@/src/server/db/schema';
import { creatorProfileInput } from '@/src/server/catalog/validation';
import { isCreatorCountryCode } from '@/src/shared/countries';
import { validateCreatorLogoKey } from '@/src/server/workspaces/logo';
import { bachsCreatorAccountState, createBachsRecipientAccount } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

const roles = new Set(['creator', 'entrepreneur', 'coach', 'small_business', 'educator', 'service_provider']);
const referralSources = new Set(['google', 'friend', 'linkedin', 'instagram', 'x', 'youtube', 'whatsapp', 'newsletter', 'event', 'other']);

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  const appUser = session.user as typeof session.user & { emailVerified?: boolean; adminRole?: string | null };
  if (!appUser.emailVerified) return NextResponse.json({ error: 'Verify your email before choosing a workspace.' }, { status: 403 });
  if (appUser.adminRole) return NextResponse.json({ error: 'Administrator accounts use the admin workspace.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  const role = typeof body?.role === 'string' ? body.role : '';
  if (!roles.has(role)) return NextResponse.json({ error: 'Choose the option that best describes you.' }, { status: 400 });
  const referralSource = typeof body?.referralSource === 'string' ? body.referralSource : '';
  if (referralSource && !referralSources.has(referralSource)) return NextResponse.json({ error: 'Choose a valid referral source.' }, { status: 400 });
  const referralSourceDetail = typeof body?.referralSourceDetail === 'string' ? body.referralSourceDetail.trim() : '';
  if (referralSourceDetail.length > 160) return NextResponse.json({ error: 'Keep your answer to 160 characters or fewer.' }, { status: 400 });
  if (referralSource === 'other' && !referralSourceDetail) return NextResponse.json({ error: 'Tell us where you heard about Onselli.' }, { status: 400 });
  if (referralSource !== 'other' && referralSourceDetail) return NextResponse.json({ error: 'Choose Other to provide a referral detail.' }, { status: 400 });
  const countryCode = typeof body?.countryCode === 'string' ? body.countryCode.toUpperCase() : '';
  if (!isCreatorCountryCode(countryCode)) return NextResponse.json({ error: 'Choose the country where your creator business is based.', field: 'countryCode' }, { status: 400 });
  const profile = creatorProfileInput.safeParse({ displayName: body?.displayName, slug: body?.slug });
  if (!profile.success) {
    const issue = profile.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? 'Check your workspace details.', field: issue?.path[0] }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const avatarKey = await validateCreatorLogoKey(session.user.id, body?.avatarKey);
    const creatorId = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: creators.id }).from(creators).where(eq(creators.userId, session.user.id)).limit(1);
      let workspaceId = existing?.id;
      if (!existing) {
        const [creator] = await tx.insert(creators).values({
          userId: session.user.id,
          displayName: profile.data.displayName,
          slug: profile.data.slug,
          countryCode,
          timezone: 'Africa/Lagos',
          avatarKey,
        }).returning({ id: creators.id });
        if (!creator) throw new Error('Could not create the creator workspace.');
        workspaceId = creator.id;
        const [site] = await tx.insert(sites).values({
          creatorId: creator.id,
          status: 'draft',
          seo: { title: profile.data.displayName, description: '' },
        }).returning({ id: sites.id });
        if (!site) throw new Error('Could not initialize the creator storefront.');
        await tx.insert(sitePages).values({
          creatorId: creator.id,
          siteId: site.id,
          slug: 'home',
          title: 'Home',
          isHome: true,
          draftContent: { version: 1, sections: [] },
          publishedContent: { version: 1, sections: [] },
        });
        await tx.insert(auditLogs).values({
          actorUserId: session.user.id,
          action: 'creator.workspace.create',
          entityType: 'creator',
          entityId: creator.id,
          after: { displayName: profile.data.displayName, slug: profile.data.slug, countryCode, onboardingPersona: role },
        });
      } else {
        await tx.update(creators).set({ countryCode, avatarKey, updatedAt: new Date() }).where(eq(creators.id, existing.id));
      }
      await tx.update(users).set({
        persona: role,
        referralSource: referralSource || null,
        referralSourceDetail: referralSource === 'other' ? referralSourceDetail : null,
        role: 'creator',
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(users.id, session.user.id));
      if (!workspaceId) throw new Error('Could not identify the creator workspace.');
      return workspaceId;
    });
    const [workspace] = await db.select({ bachsAccountId: creators.bachsAccountId }).from(creators).where(eq(creators.id, creatorId)).limit(1);
    if (!workspace?.bachsAccountId) {
      const bachsAccount = await createBachsRecipientAccount({ email: session.user.email, displayName: profile.data.displayName, country: countryCode, idempotencyKey: `onselli-recipient-${creatorId}` });
      if (!bachsAccount.id) throw new Error('Bachs did not return a recipient account ID.');
      const state = bachsCreatorAccountState(bachsAccount);
      await db.update(creators).set({ bachsAccountId: bachsAccount.id, bachsAccountStatus: state.status, bachsTransfersStatus: state.transfersStatus, bachsPayoutsStatus: state.payoutsStatus, bachsRequirements: state.requirements, kycStatus: state.status === 'approved' ? 'approved' : 'not_started', updatedAt: new Date() }).where(eq(creators.id, creatorId));
    }
    return NextResponse.json({ next: '/dashboard' });
  } catch (error) {
    const databaseError = getDatabaseErrorInfo(error);
    const duplicateCreatorSlug = databaseError.code === '23505' && (databaseError.constraint === 'creators_slug_unique' || (databaseError.table === 'creators' && databaseError.column === 'slug'));
    if (duplicateCreatorSlug) return NextResponse.json({ error: 'This address is already in use. Try a different one.', field: 'slug' }, { status: 409 });
    console.error('Onboarding unavailable', error);
    return NextResponse.json({ error: 'Onboarding is temporarily unavailable.' }, { status: 503 });
  }
}
