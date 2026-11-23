import { and, eq, inArray, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bachsRequest, type BachsAccount } from '@/lib/payments/bachs';
import { AuthorizationError, requireAdmin } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, payouts } from '@/src/server/db/schema';

export const runtime = 'nodejs';
const schema = z.object({ accountId: z.string().trim().min(3).max(120) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ creatorId: string }> }) {
  try {
    const session = await requireAdmin('manage_settings');
    const { creatorId } = await params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Provide a valid Bachs account ID.' }, { status: 400 });
    const account = await bachsRequest<BachsAccount>(`/v1/accounts/${encodeURIComponent(parsed.data.accountId)}`);
    const requirements = account.requirements ?? {};
    const hasDue = Boolean(requirements.currently_due?.length || requirements.past_due?.length || requirements.errors?.length);
    if (account.id !== parsed.data.accountId || account.is_active !== true || account.capabilities?.payouts?.status !== 'active' || hasDue) {
      return NextResponse.json({ error: 'This Bachs account is not active and ready for payouts.' }, { status: 409 });
    }
    const db = getDatabase();
    const [creator] = await db.select({ id: creators.id, bachsAccountId: creators.bachsAccountId }).from(creators).where(eq(creators.id, creatorId)).limit(1);
    if (!creator) return NextResponse.json({ error: 'Creator workspace not found.' }, { status: 404 });
    const [alreadyLinked] = await db.select({ id: creators.id }).from(creators).where(and(eq(creators.bachsAccountId, account.id), ne(creators.id, creatorId))).limit(1);
    if (alreadyLinked) return NextResponse.json({ error: 'This Bachs account is already linked to another workspace.' }, { status: 409 });
    const [activePayout] = await db.select({ id: payouts.id }).from(payouts).where(and(eq(payouts.creatorId, creatorId), inArray(payouts.status, ['requested','approved','processing']))).limit(1);
    if (activePayout && creator.bachsAccountId !== account.id) return NextResponse.json({ error: 'Wait for active payouts to finish before changing the linked account.' }, { status: 409 });
    await db.update(creators).set({ bachsAccountId: account.id, updatedAt: new Date() }).where(eq(creators.id, creatorId));
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.bachs_account.link', entityType: 'creator', entityId: creatorId, before: { bachsAccountId: creator.bachsAccountId }, after: { bachsAccountId: account.id } });
    return NextResponse.json({ creatorId, payoutAccountConnected: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Bachs payout account link failed', { errorType: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ error: 'Could not link the payout account.' }, { status: 503 });
  }
}
