import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBachsRefund, BachsApiError } from '@/lib/payments/bachs';
import { configuredPayoutFeeMinor, getBachsAccountBalances, getBachsPayment } from '@/lib/payments/bachs-payouts';
import { getCreatorRiskPolicy } from '@/src/server/payments/creator-risk-policy';
import { currencyDecimalToMinor } from '@/lib/money.mjs';
import { AuthorizationError, requireAdmin } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, disputes, orders, payments, refunds, users, webhookEvents } from '@/src/server/db/schema';

export const runtime = 'nodejs';

const refundRequest = z.object({ action: z.literal('create_refund'), orderId: z.string().uuid().optional(), refundId: z.string().uuid().optional(), reason: z.string().trim().min(8).max(500) }).strict().refine((value) => Boolean(value.orderId) !== Boolean(value.refundId));
const rejectRefundRequest = z.object({ action: z.literal('reject_refund'), refundId: z.string().uuid(), reason: z.string().trim().min(8).max(500) }).strict();
const reconcileRequest = z.object({ action: z.literal('reconcile_balance'), note: z.string().trim().min(8).max(500) }).strict();

function errorMessage(error: unknown) {
  if (error instanceof BachsApiError) return { status: error.status, code: error.code ?? 'BACHS_ERROR' };
  return { status: 0, code: 'NETWORK_ERROR' };
}

async function platformBalances() {
  const expectedAccountId = process.env.BACHS_PLATFORM_ACCOUNT_ID;
  if (!expectedAccountId) throw new Error('Bachs platform account is not configured.');
  const snapshot = await getBachsAccountBalances();
  if (snapshot.account_id !== expectedAccountId) throw new Error('Bachs balance response did not match the configured platform account.');
  return snapshot;
}

export async function GET() {
  try {
    await requireAdmin('process_refunds');
    const db = getDatabase();
    const staleSettlementCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const [refundRows, disputeRows, candidateRows, refundRefs, webhookFailures, staleSales] = await Promise.all([
      db.select({ refund: refunds, order: orders, payment: payments, creator: creators, requester: users }).from(refunds).innerJoin(orders, eq(refunds.orderId, orders.id)).innerJoin(payments, eq(payments.orderId, orders.id)).innerJoin(creators, eq(refunds.creatorId, creators.id)).innerJoin(users, eq(refunds.requestedBy, users.id)).orderBy(desc(refunds.updatedAt)).limit(100),
      db.select({ dispute: disputes, order: orders, creator: creators }).from(disputes).innerJoin(orders, eq(disputes.orderId, orders.id)).innerJoin(creators, eq(disputes.creatorId, creators.id)).orderBy(sql`${disputes.dueAt} ASC NULLS LAST`).limit(100),
      db.select({ order: orders, payment: payments, creator: creators }).from(orders).innerJoin(payments, eq(payments.orderId, orders.id)).innerJoin(creators, eq(creators.id, orders.creatorId)).where(eq(orders.status, 'paid')).orderBy(asc(payments.createdAt)).limit(200),
      db.select({ orderId: refunds.orderId, status: refunds.status }).from(refunds),
      db.select({ id: webhookEvents.id, provider: webhookEvents.provider, eventId: webhookEvents.eventId, type: webhookEvents.type, status: webhookEvents.status, attempts: webhookEvents.attempts, error: webhookEvents.error, createdAt: webhookEvents.createdAt }).from(webhookEvents).where(inArray(webhookEvents.status, ['failed','received'])).orderBy(asc(webhookEvents.createdAt)).limit(100),
      db.select({ id: orders.id, number: orders.number, currency: orders.currency, updatedAt: orders.updatedAt }).from(orders).where(and(eq(orders.status, 'paid'), isNotNull(orders.providerTransferId), isNull(orders.providerSettledAt), lt(orders.updatedAt, staleSettlementCutoff))).orderBy(asc(orders.updatedAt)).limit(100),
    ]);
    const blockedOrderIds = new Set(refundRefs.filter((item) => ['requested', 'verifying', 'processing', 'paid'].includes(item.status)).map((item) => item.orderId));
    let balance: { accountId: string; balances: Array<{ currency: string; available: string; pending: string }>; fetchedAt: string } | null = null;
    let balanceError: string | null = null;
    try {
      const provider = await platformBalances();
      balance = { accountId: provider.account_id, balances: provider.balances.map((item) => ({ currency: item.currency, available: item.available_balance, pending: item.pending_balance })), fetchedAt: new Date().toISOString() };
    } catch {
      balanceError = 'Bachs platform balances are unavailable. Check provider access and retry.';
    }
    const sameCurrencyFees = ['NGN:bank_transfer:NGN','USD:bank_transfer:USD'].map((route) => { const [source, method, destination] = route.split(':'); return { route, configured: Boolean(source && method && destination && configuredPayoutFeeMinor(source, method, destination) !== null) }; });
    return NextResponse.json({
      balance,
      balanceError,
      refundCandidates: Array.from(new Map(candidateRows.filter(({ order, payment }) => Boolean(payment.chargeId) && ['succeeded','accepted','underpaid'].includes(payment.status.toLowerCase()) && !blockedOrderIds.has(order.id)).map(({ order, payment, creator }) => [order.id, { orderId: order.id, orderNumber: order.number, amountMinor: payment.amountMinor.toString(), currency: payment.currency, paidAt: order.paidAt?.toISOString() ?? null, chargeId: payment.chargeId, creator: { name: creator.displayName, slug: creator.slug } }])).values()),
      refunds: refundRows.map(({ refund, order, payment, creator, requester }) => ({ id: refund.id, orderId: order.id, orderNumber: order.number, amountMinor: payment.amountMinor.toString(), currency: payment.currency, reason: refund.reason, status: refund.status, decisionMessage: refund.decisionMessage, providerRef: refund.providerRef, updatedAt: refund.updatedAt.toISOString(), creator: { name: creator.displayName, slug: creator.slug }, requesterName: requester.name })),
      disputes: disputeRows.map(({ dispute, order, creator }) => ({ id: dispute.id, providerRef: dispute.providerRef, orderId: order.id, orderNumber: order.number, amountMinor: dispute.amountMinor.toString(), currency: order.currency, status: dispute.status, reason: dispute.reason, editable: dispute.isResponseEditable, dueAt: dispute.dueAt?.toISOString() ?? null, updatedAt: dispute.updatedAt.toISOString(), creator: { name: creator.displayName, slug: creator.slug } })),
      webhookFailures: webhookFailures.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
      staleSales: staleSales.map((order) => ({ ...order, updatedAt: order.updatedAt.toISOString() })),
      launchGates: {
        platformAccount: Boolean(process.env.BACHS_PLATFORM_ACCOUNT_ID),
        providerApiKey: Boolean(process.env.BACHS_API_KEY),
        webhookSecret: Boolean(process.env.BACHS_WEBHOOK_SECRET),
        approvedRiskPolicy: Boolean(getCreatorRiskPolicy()),
        sameCurrencyFees,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Admin finance workspace failed');
    return NextResponse.json({ error: 'Could not load the finance workspace.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin('process_refunds');
    const body = await request.json().catch(() => null);
    const rejectInput = rejectRefundRequest.safeParse(body);
    if (rejectInput.success) {
      const db = getDatabase();
      const [rejected] = await db.update(refunds).set({ status: 'rejected', decisionMessage: rejectInput.data.reason, decidedBy: session.user.id, updatedAt: new Date() }).where(and(eq(refunds.id, rejectInput.data.refundId), eq(refunds.status, 'requested'))).returning({ id: refunds.id });
      if (!rejected) return NextResponse.json({ error: 'Only a pending refund request can be declined.' }, { status: 409 });
      await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'refund.admin_rejected', entityType: 'refund', entityId: rejected.id, after: { status: 'rejected' } });
      return NextResponse.json({ id: rejected.id, status: 'rejected' });
    }
    const refundInput = refundRequest.safeParse(body);
    if (refundInput.success) {
      if (!process.env.BACHS_PLATFORM_ACCOUNT_ID) return NextResponse.json({ error: 'Bachs platform account is not configured. Refund actions are unavailable.' }, { status: 503 });
      const db = getDatabase();
      const { orderId, refundId, reason } = refundInput.data;
      const localRefund = await db.transaction(async (tx) => {
        const [request] = refundId ? await tx.select().from(refunds).where(eq(refunds.id, refundId)).for('update') : [];
        if (refundId && (!request || request.status !== 'requested')) throw new Error('Only a pending refund request can be approved.');
        const targetOrderId = request?.orderId ?? orderId!;
        const [order] = await tx.select().from(orders).where(eq(orders.id, targetOrderId)).for('update');
        if (!order || order.status !== 'paid') throw new Error('Only a paid order can be refunded.');
        const [payment] = await tx.select().from(payments).where(and(eq(payments.orderId, targetOrderId), eq(payments.status, 'succeeded'))).orderBy(desc(payments.createdAt)).limit(1);
        if (!payment?.chargeId) throw new Error('Bachs has not confirmed a refundable payment for this order.');
        const [activeRefund] = await tx.select({ id: refunds.id, status: refunds.status }).from(refunds).where(and(eq(refunds.orderId, targetOrderId), inArray(refunds.status, ['requested','verifying','processing','paid']), ...(request ? [ne(refunds.id, request.id)] : []))).limit(1);
        if (activeRefund) throw new Error('This order already has a refund in progress or completed.');
        if (request) await tx.update(refunds).set({ status: 'verifying', decidedBy: session.user.id, updatedAt: new Date() }).where(eq(refunds.id, request.id));
        const [created] = request ? [request] : await tx.insert(refunds).values({ creatorId: order.creatorId, orderId: targetOrderId, requestedBy: session.user.id, reason, status: 'verifying', decidedBy: session.user.id }).returning({ id: refunds.id });
        if (!created) throw new Error('Could not create the refund record.');
        return { id: created.id, chargeId: payment.chargeId, amountMinor: payment.amountMinor.toString(), currency: payment.currency, requestedOrderId: targetOrderId };
      });

      let payment;
      try {
        payment = await getBachsPayment(localRefund.chargeId);
      } catch (error) {
        const failure = errorMessage(error);
        await db.update(refunds).set({ status: refundId ? 'requested' : 'failed', decisionMessage: 'The charge could not be verified; no refund was sent.', decidedBy: session.user.id, updatedAt: new Date() }).where(eq(refunds.id, localRefund.id));
        console.error('Bachs charge verification failed before refund', { refundId: localRefund.id, providerCode: failure.code });
        return NextResponse.json({ error: 'Could not verify the charge with Bachs. No refund was sent; refresh and retry.' }, { status: 503 });
      }
      if (payment.id !== localRefund.chargeId || !payment.is_refundable || !['succeeded','accepted','underpaid'].includes(payment.status.toLowerCase()) || payment.currency.toUpperCase() !== localRefund.currency || currencyDecimalToMinor(payment.amount, localRefund.currency) !== BigInt(localRefund.amountMinor)) {
        await db.update(refunds).set({ status: refundId ? 'requested' : 'failed', decisionMessage: 'Bachs reports this charge is not refundable or does not match the paid order.', decidedBy: session.user.id, updatedAt: new Date() }).where(eq(refunds.id, localRefund.id));
        return NextResponse.json({ error: 'Bachs reports this charge is not currently refundable or its details do not match the order.' }, { status: 409 });
      }
      try {
        const reference = `onselli-refund-${localRefund.id}`;
        const provider = await createBachsRefund({ chargeId: localRefund.chargeId, reference, reason });
        const [updated] = await db.update(refunds).set({ providerRef: provider.refund_id, status: 'processing', updatedAt: new Date() }).where(and(eq(refunds.id, localRefund.id), eq(refunds.status, 'verifying'))).returning({ status: refunds.status });
        const [current] = updated ? [updated] : await db.select({ status: refunds.status }).from(refunds).where(eq(refunds.id, localRefund.id)).limit(1);
        const finalStatus = current?.status ?? 'processing';
        await db.insert(auditLogs).values({ actorUserId: session.user.id, action: refundId ? 'refund.admin_approved' : 'refund.admin_requested', entityType: 'refund', entityId: localRefund.id, after: { status: finalStatus, providerRef: provider.refund_id, amountMinor: localRefund.amountMinor, currency: localRefund.currency } });
        return NextResponse.json({ id: localRefund.id, status: finalStatus, message: finalStatus === 'paid' ? 'Bachs has already confirmed the refund.' : 'Bachs accepted the refund. Its webhook will confirm the outcome.' }, { status: 202 });
      } catch (error) {
        const providerError = errorMessage(error);
        const definite = providerError.status >= 400 && providerError.status < 500 && ![408,409,425,429].includes(providerError.status);
        if (definite) {
          await db.update(refunds).set({ status: 'failed', decisionMessage: `Bachs rejected the refund (${providerError.code}).`, decidedBy: session.user.id, updatedAt: new Date() }).where(eq(refunds.id, localRefund.id));
          await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'refund.provider_rejected', entityType: 'refund', entityId: localRefund.id, after: { status: 'failed', providerCode: providerError.code } });
          return NextResponse.json({ error: 'Bachs rejected the refund. Review the payment before trying again.' }, { status: 409 });
        }
        console.error('Bachs refund result uncertain', { refundId: localRefund.id, providerCode: providerError.code });
        return NextResponse.json({ id: localRefund.id, status: 'requested', message: 'The provider result is uncertain. Do not create another refund; wait for the webhook or reconcile the refund in Bachs.' }, { status: 202 });
      }
    }

    const reconcileInput = reconcileRequest.safeParse(body);
    if (reconcileInput.success) {
      const snapshot = await platformBalances();
      const checkedAt = new Date();
      await getDatabase().insert(auditLogs).values({ actorUserId: session.user.id, action: 'bachs.platform_balance.reconcile', entityType: 'bachs_balance', after: { accountId: snapshot.account_id, balances: snapshot.balances, note: reconcileInput.data.note, checkedAt: checkedAt.toISOString() } });
      return NextResponse.json({ accountId: snapshot.account_id, balances: snapshot.balances, checkedAt: checkedAt.toISOString() });
    }
    return NextResponse.json({ error: 'Choose a valid finance action and provide its required details.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && /paid order|already has a refund|not confirmed|Could not create|pending refund request/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Admin finance action failed', errorMessage(error));
    return NextResponse.json({ error: 'Finance action could not be completed.' }, { status: 503 });
  }
}
