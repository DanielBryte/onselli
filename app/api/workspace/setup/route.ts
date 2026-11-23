import { NextResponse } from 'next/server';
import { and, asc, count, eq } from 'drizzle-orm';
import { auth } from '@/src/server/auth';
import { getDatabase } from '@/src/server/db';
import { getDatabaseErrorInfo } from '@/src/server/db/error-info';
import { auditLogs, creators, sitePages, sites, users } from '@/src/server/db/schema';
import { creatorProfileInput } from '@/src/server/catalog/validation';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { PLAN_CATALOG } from '@/src/server/billing/plans';
import { validateCreatorLogoKey } from '@/src/server/workspaces/logo';

export const runtime = 'nodejs';

const reservedSlugs = new Set(['admin', 'api', 'dashboard', 'login', 'signup', 'checkout', 'library', 'learn', 'legal', 'blog', 'book', 'p', 'f', 'settings', 'support']);

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ error: 'Your session has expired. Sign in again to continue.' }, { status: 401 });
  const appUser = session.user as typeof session.user & { emailVerified?: boolean; onboardingCompletedAt?: Date | null; role?: string };
  if (!appUser.emailVerified) return NextResponse.json({ error: 'Verify your email before creating a workspace.' }, { status: 403 });
  if (!appUser.onboardingCompletedAt || (appUser.role !== 'creator' && appUser.role !== 'admin')) return NextResponse.json({ error: 'Complete creator onboarding before creating a workspace.' }, { status: 403 });
  try {
    const [creator] = await getDatabase().select({ id: creators.id }).from(creators).where(and(eq(creators.userId, session.user.id), eq(creators.status, 'active'))).limit(1);
    const [workspaceCount] = await getDatabase().select({ total: count() }).from(creators).where(eq(creators.userId, session.user.id));
    const total = workspaceCount?.total ?? 0;
    const entitlements = await getAccountEntitlements(session.user.id);
    const isNewWorkspace = new URL(request.url).searchParams.get('newWorkspace') === '1';
    return NextResponse.json({ exists: Boolean(creator) && !isNewWorkspace, workspaceCount: total, maxWorkspaces: PLAN_CATALOG[entitlements.planId].maxWorkspaces, billingEnabled: entitlements.billingEnabled });
  } catch (error) {
    console.error('Creator setup lookup failed', error);
    return NextResponse.json({ error: 'Creator setup is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ error: 'Your session has expired. Sign in again to continue.' }, { status: 401 });
  const appUser = session.user as typeof session.user & { emailVerified?: boolean; onboardingCompletedAt?: Date | null; role?: string };
  if (!appUser.emailVerified) return NextResponse.json({ error: 'Verify your email before creating a workspace.' }, { status: 403 });
  if (!appUser.onboardingCompletedAt || (appUser.role !== 'creator' && appUser.role !== 'admin')) return NextResponse.json({ error: 'Complete creator onboarding before creating a workspace.' }, { status: 403 });
  const body = await request.json().catch(() => null) as ({ displayName?: unknown; slug?: unknown; headline?: unknown; bio?: unknown; whatsappE164?: unknown; timezone?: unknown; avatarKey?: unknown; newWorkspace?: boolean } | null);
  const parsed = creatorProfileInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your profile details.' }, { status: 400 });
  if (appUser.role !== 'creator' && appUser.role !== 'admin') return NextResponse.json({ error: 'Choose a creator or business role during onboarding first.' }, { status: 403 });
  if (reservedSlugs.has(parsed.data.slug)) return NextResponse.json({ error: 'That page address is reserved.', field: 'slug' }, { status: 400 });

  try {
    const db = getDatabase();
    const avatarKey = await validateCreatorLogoKey(session.user.id, body?.avatarKey);
    const [existing] = await db.select({ id: creators.id }).from(creators).where(eq(creators.userId, session.user.id)).limit(1);
    if (existing && !body?.newWorkspace) return NextResponse.json({ created: false });
    const creator = await db.transaction(async (tx) => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, session.user.id)).for('update');
      const [workspaceCount] = await tx.select({ total: count() }).from(creators).where(eq(creators.userId, session.user.id));
      const total = workspaceCount?.total ?? 0;
      const entitlements = await getAccountEntitlements(session.user.id);
      const maxWorkspaces = PLAN_CATALOG[entitlements.planId].maxWorkspaces;
      if (total >= maxWorkspaces) throw Object.assign(new Error('Your plan has reached its workspace limit. Upgrade to create another workspace.'), { code: 'WORKSPACE_LIMIT' });
      const [defaultWorkspace] = await tx.select({ countryCode: creators.countryCode }).from(creators).where(eq(creators.userId, session.user.id)).orderBy(asc(creators.createdAt)).limit(1);
      const [created] = await tx.insert(creators).values({
        userId: session.user.id, displayName: parsed.data.displayName, slug: parsed.data.slug,
        headline: parsed.data.headline || null, bio: parsed.data.bio || null,
        whatsappE164: parsed.data.whatsappE164 || null, timezone: parsed.data.timezone,
        countryCode: defaultWorkspace?.countryCode ?? null, avatarKey,
      }).returning({ id: creators.id });
      if (!created) throw new Error('Could not create the creator workspace.');
      const [site] = await tx.insert(sites).values({
        creatorId: created.id, status: 'draft', seo: { title: parsed.data.displayName, description: parsed.data.headline ?? '' },
      }).returning({ id: sites.id });
      if (site) await tx.insert(sitePages).values({
        creatorId: created.id, siteId: site.id, slug: 'home', title: 'Home', isHome: true,
        draftContent: { version: 1, sections: [] }, publishedContent: { version: 1, sections: [] },
      });
      await tx.insert(auditLogs).values({
        actorUserId: session.user.id, action: 'creator.workspace.create', entityType: 'creator',
        entityId: created.id, after: { displayName: parsed.data.displayName, slug: parsed.data.slug },
      });
      return created;
    });
    const response = NextResponse.json({ created: true, creatorId: creator.id });
    response.cookies.set('onselli_creator_id', creator.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch (error) {
    const databaseError = getDatabaseErrorInfo(error);
    const code = databaseError.code;
    if (code === 'WORKSPACE_LIMIT') return NextResponse.json({ error: error instanceof Error ? error.message : 'Upgrade to create another workspace.', code }, { status: 402 });
    const duplicateCreatorSlug = code === '23505' && (databaseError.constraint === 'creators_slug_unique' || (databaseError.table === 'creators' && databaseError.column === 'slug'));
    if (duplicateCreatorSlug) return NextResponse.json({ error: 'That page address is already taken. Choose another to continue.', field: 'slug' }, { status: 409 });
    console.error('Creator profile creation failed', error);
    return NextResponse.json({ error: 'We couldn’t save your creator page. Please try again.' }, { status: 503 });
  }
}
