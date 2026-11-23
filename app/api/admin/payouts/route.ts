import { and, asc, eq, lt, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireAdmin } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, ledgerEntries, payouts } from '@/src/server/db/schema';
import { decimalToMinor, getBachsPayout, getBachsPayoutByReference } from '@/lib/payments/bachs-payouts';

export const runtime = 'nodejs';
export async function GET() {
  try {
    await requireAdmin('approve_payouts'); const cutoff = new Date(Date.now() - 15 * 60 * 1000); const db = getDatabase(); const [rows, accountRows] = await Promise.all([db.select({ payout: payouts, creator: creators }).from(payouts).innerJoin(creators, eq(payouts.creatorId, creators.id)).where(or(eq(payouts.status, 'requested'), and(eq(payouts.status, 'processing'), lt(payouts.updatedAt, cutoff)))).orderBy(asc(payouts.updatedAt)), db.select({ id: creators.bachsAccountId, name: creators.displayName, slug: creators.slug }).from(creators).where(sql`${creators.bachsAccountId} IS NOT NULL`)]);
    return NextResponse.json({ accounts: accountRows.filter((item): item is { id: string; name: string; slug: string } => Boolean(item.id)), payouts: rows.map(({ payout, creator }) => ({ id: payout.id, creator_id: payout.creatorId, bachs_account_id: creator.bachsAccountId, amount_minor: payout.amountMinor.toString(), currency: payout.currency, source_amount_minor: payout.sourceAmountMinor.toString(), source_currency: payout.sourceCurrency, fee_minor: payout.feeMinor.toString(), provider_payout_id: payout.providerPayoutId, provider_ref: payout.providerRef, status: payout.status, requested_at: payout.requestedAt.toISOString(), updated_at: payout.updatedAt.toISOString(), failure_reason: payout.failureReason, bank_snapshot: payout.bankSnapshot, creators: { display_name: creator.displayName, slug: creator.slug } })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 }); console.error('Admin payout queue failed', error); return NextResponse.json({ error: 'Could not load the finance queue.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin('approve_payouts'); const body = await request.json().catch(() => null);
    if (body?.approve === true) return NextResponse.json({ error: 'Creator payouts are submitted from the creator wallet. This legacy queue cannot initiate a payout from the platform account.' }, { status: 409 });
    if (body?.action === 'reconcile') {
      const id = typeof body.id === 'string' ? body.id : '';
      if (!id) return NextResponse.json({ error: 'Choose a payout to reconcile.' }, { status: 400 });
      const db = getDatabase();
      const [row] = await db.select({ payout: payouts, bachsAccountId: creators.bachsAccountId }).from(payouts).innerJoin(creators, eq(payouts.creatorId, creators.id)).where(eq(payouts.id, id)).limit(1);
      if (!row || row.payout.status !== 'processing' || !row.payout.providerRef || !row.bachsAccountId) return NextResponse.json({ error: 'This payout cannot be reconciled automatically; review the provider reference and account.' }, { status: 409 });
      const remote = row.payout.providerPayoutId
        ? await getBachsPayout(row.payout.providerPayoutId, row.bachsAccountId)
        : await getBachsPayoutByReference(row.payout.providerRef, row.bachsAccountId);
      if (!remote) return NextResponse.json({ id, status: 'processing', message: 'Bachs has not returned this reference yet. Funds remain reserved; check again or contact Bachs before retrying.' }, { status: 202 });
      if ((row.payout.providerPayoutId && remote.id !== row.payout.providerPayoutId) || remote.reference !== row.payout.providerRef) return NextResponse.json({ error: 'Bachs payout identity did not match the local request.' }, { status: 409 });
      const total = decimalToMinor(remote.total_debited, row.payout.sourceCurrency);
      const fee = decimalToMinor(remote.fee, row.payout.sourceCurrency);
      const delivered = decimalToMinor(remote.amount, row.payout.currency);
      if (total !== row.payout.sourceAmountMinor + row.payout.feeMinor || fee !== row.payout.feeMinor || delivered !== row.payout.amountMinor || remote.source_currency !== row.payout.sourceCurrency || remote.currency !== row.payout.currency) return NextResponse.json({ error: 'Bachs amounts do not match the reserved payout. The funds remain reserved for finance review.' }, { status: 409 });
      const complete = ['paid','completed','succeeded'].includes(remote.status.toLowerCase());
      const failed = ['failed','rejected','cancelled','canceled'].includes(remote.status.toLowerCase());
      if (!complete && !failed) return NextResponse.json({ id, status: remote.status, message: 'Bachs still reports this payout as processing.' }, { status: 202 });
      await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(payouts).where(eq(payouts.id, id)).for('update');
        if (!locked || locked.status !== 'processing') return;
        const key = `payout:${id}:provider:${complete ? 'paid' : 'failed'}`;
        await tx.insert(ledgerEntries).values([
          { creatorId: locked.creatorId, type: complete ? 'payout_paid' : 'payout_failed', bucket: 'reserved', amountMinor: -total, currency: locked.sourceCurrency, refType: 'payout', refId: id, idempotencyKey: `${key}:reserved`, createdBy: session.user.id },
          ...(failed ? [{ creatorId: locked.creatorId, type: 'payout_reversal', bucket: 'available' as const, amountMinor: total, currency: locked.sourceCurrency, refType: 'payout', refId: id, idempotencyKey: `${key}:available`, createdBy: session.user.id }] : []),
        ]).onConflictDoNothing();
        await tx.update(payouts).set({ providerPayoutId: remote.id, status: complete ? 'paid' : 'failed', paidAt: complete ? new Date() : null, failureReason: failed ? remote.failure_reason ?? 'The payout failed.' : null, updatedAt: new Date() }).where(eq(payouts.id, id));
        await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.reconcile', entityType: 'payout', entityId: id, after: { status: complete ? 'paid' : 'failed', providerPayoutId: remote.id } });
      });
      return NextResponse.json({ id, status: complete ? 'paid' : 'failed' });
    }
    const id = typeof body?.id === 'string' ? body.id : ''; const approve = body?.approve === true; const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0,500) : '';
    if (!id || (!approve && reason.length < 8)) return NextResponse.json({ error: 'Provide a payout request and a clear rejection reason.' }, { status: 400 });
    const db = getDatabase();
    await db.transaction(async (tx) => {
      const [payout] = await tx.select().from(payouts).where(eq(payouts.id, id)).for('update');
      if (!payout || payout.status !== 'requested') throw new Error('This payout request is no longer awaiting review.');
      const nextStatus = approve ? 'approved' : 'rejected';
      await tx.update(payouts).set({ status: nextStatus, decidedBy: session.user.id, decidedAt: new Date(), decisionReason: approve ? null : reason, updatedAt: new Date() }).where(eq(payouts.id, id));
      if (!approve) {
        const key = `payout:${id}:rejected`;
        const reservedMinor = payout.sourceAmountMinor + payout.feeMinor;
        await tx.insert(ledgerEntries).values([
          { creatorId: payout.creatorId, type: 'payout_reversal', bucket: 'reserved', amountMinor: -reservedMinor, currency: payout.sourceCurrency, refType: 'payout', refId: id, idempotencyKey: `${key}:reserved`, createdBy: session.user.id },
          { creatorId: payout.creatorId, type: 'payout_reversal', bucket: 'available', amountMinor: reservedMinor, currency: payout.sourceCurrency, refType: 'payout', refId: id, idempotencyKey: `${key}:available`, createdBy: session.user.id },
        ]);
      }
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: approve ? 'payout.approve' : 'payout.reject', entityType: 'payout', entityId: id, after: { status: nextStatus, reason: reason || undefined } });
    });
    return NextResponse.json({ id, status: approve ? 'approved' : 'rejected' });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 }); if (error instanceof Error && error.message.includes('no longer')) return NextResponse.json({ error: error.message }, { status: 409 }); console.error('Payout decision failed', error); return NextResponse.json({ error: 'Decision could not be saved.' }, { status: 503 }); }
}
