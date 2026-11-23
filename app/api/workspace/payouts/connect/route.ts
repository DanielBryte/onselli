import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, users } from '@/src/server/db/schema';
import { bachsCreatorAccountState, createBachsAccountLink, createBachsRecipientAccount, refreshBachsAccount, requestBachsInternationalPayouts } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

async function ensureAccount(creatorId: string, userId: string, email: string, displayName: string, country: string) {
  const db = getDatabase();
  const [local] = await db.select({ bachsAccountId: creators.bachsAccountId }).from(creators).where(eq(creators.id, creatorId)).limit(1);
  if (local?.bachsAccountId) {
    const updated = await requestBachsInternationalPayouts(local.bachsAccountId);
    if (updated.id !== local.bachsAccountId) throw new Error('Bachs returned a different connected account.');
    const state = bachsCreatorAccountState(updated);
    await db.update(creators).set({ bachsAccountStatus: state.status, bachsTransfersStatus: state.transfersStatus, bachsPayoutsStatus: state.payoutsStatus, bachsInternationalPayouts: state.internationalPayouts, bachsRequirements: state.requirements, updatedAt: new Date() }).where(eq(creators.id, creatorId));
    return local.bachsAccountId;
  }
  const account = await createBachsRecipientAccount({ email, displayName, country, idempotencyKey: `onselli-recipient-${creatorId}` });
  if (!account.id) throw new Error('Bachs did not return an account ID.');
  const state = bachsCreatorAccountState(account);
  await db.update(creators).set({
    bachsAccountId: account.id,
    bachsAccountStatus: state.status,
    bachsTransfersStatus: state.transfersStatus,
    bachsPayoutsStatus: state.payoutsStatus,
    bachsInternationalPayouts: state.internationalPayouts,
    bachsRequirements: state.requirements,
    kycStatus: state.status === 'approved' ? 'approved' : 'not_started',
    updatedAt: new Date(),
  }).where(eq(creators.id, creatorId));
  await db.insert(auditLogs).values({ actorUserId: userId, action: 'payout.bachs_account.create', entityType: 'creator', entityId: creatorId, after: { bachsAccountId: account.id, accountStatus: state.status, payoutsStatus: state.payoutsStatus } });
  return account.id;
}

async function saveProviderState(creatorId: string, accountId: string) {
  const account = await refreshBachsAccount(accountId);
  if (account.account.id !== accountId) throw new Error('Bachs returned a different connected account.');
  const state = bachsCreatorAccountState(account.account);
  const db = getDatabase();
  await db.update(creators).set({
    bachsAccountStatus: state.status,
    bachsTransfersStatus: state.transfersStatus,
    bachsPayoutsStatus: state.payoutsStatus,
    bachsInternationalPayouts: state.internationalPayouts,
    bachsRequirements: state.requirements,
    kycStatus: state.status === 'approved' ? 'approved' : state.status === 'pending_review' ? 'pending' : state.status === 'needs_action' ? 'required' : state.status === 'rejected' ? 'rejected' : 'not_started',
    bachsOnboardedAt: state.onboarded ? new Date() : undefined,
    updatedAt: new Date(),
  }).where(eq(creators.id, creatorId));
  return state;
}

export async function GET() {
  try {
    const { creator } = await requireCreator();
    const db = getDatabase();
    const [row] = await db.select({ bachsAccountId: creators.bachsAccountId, accountStatus: creators.bachsAccountStatus, transfersStatus: creators.bachsTransfersStatus, payoutsStatus: creators.bachsPayoutsStatus, internationalPayouts: creators.bachsInternationalPayouts, requirements: creators.bachsRequirements }).from(creators).where(eq(creators.id, creator.id)).limit(1);
    if (!row?.bachsAccountId) return NextResponse.json({ accountId: null, status: row?.accountStatus ?? 'not_created', transfersStatus: 'unknown', payoutsStatus: 'unknown', internationalPayouts: false, requirements: {} }, { headers: { 'Cache-Control': 'private, no-store' } });
    const state = await saveProviderState(creator.id, row.bachsAccountId);
    return NextResponse.json({ accountId: row.bachsAccountId, ...state }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Bachs account status refresh failed', { errorType: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ error: 'Verification status is temporarily unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, creator } = await requireCreator();
    const db = getDatabase();
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.user.id)).limit(1);
    if (!user?.email) return NextResponse.json({ error: 'Add an email address to your account before setting up payouts.' }, { status: 409 });
    const accountId = await ensureAccount(creator.id, session.user.id, user.email, creator.displayName, creator.countryCode ?? 'NG');
    const origin = new URL(request.url).origin;
    const url = new URL('/workspace/earnings?connect=return', origin).toString();
    const refreshUrl = new URL('/api/workspace/payouts/connect/refresh', origin).toString();
    const link = await createBachsAccountLink(accountId, { returnUrl: url, refreshUrl });
    if (!link.url || !link.url.startsWith('https://')) throw new Error('Bachs did not return a secure onboarding link.');
    return NextResponse.json({ url: link.url, expiresAt: link.expires_at }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
    console.error('Bachs onboarding link failed', { providerCode: code || 'UNKNOWN' });
    return NextResponse.json({ error: 'Could not open identity verification. Please try again shortly.' }, { status: 503 });
  }
}
