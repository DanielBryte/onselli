import { and, count, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/server/db';
import { analyticsEvents, auditLogs, billingTransactions, contacts, creators, disputes, entitlements, ledgerEntries, orderBundleContents, orderItems, orders, payments, payouts, products, refunds, userSubscriptions, users, webhookEvents } from '@/src/server/db/schema';
import { bachsCreatorAccountState, getBachsCheckout, refreshBachsAccount, type BachsCheckoutSession } from '@/lib/payments/bachs';
import { decimalToMinor, getBachsPayout } from '@/lib/payments/bachs-payouts';
import { currencyDecimalToMinor } from '@/lib/money.mjs';
import { verifyBachsWebhook } from '@/lib/payments/webhook';
import { createBachsWebhookAuditPayload, createVerifiedPaymentAuditSnapshot } from '@/lib/payments/webhook-audit.mjs';
import { reconcileBachsSale } from '@/src/server/payments/bachs-settlement';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { createGuestPurchaseAccess } from '@/src/server/purchases/guest-access';
import { bundleEntitlementProductIds } from '@/lib/bundles/rules.mjs';

export const runtime = 'nodejs';
type BachsEvent = { id?: string; type?: string; created_at?: string; account?: string; organization_id?: string; data?: {
  id?: string; checkout_id?: string; status?: string; amount?: string; currency?: string; charge_id?: string; payout_id?: string; reference?: string; fee?: string; total_debited?: string; source_currency?: string; failure_reason?: string;
  transfer_id?: string; source?: string; destination?: string; kind?: string; source_charge_id?: string;
  refund_id?: string; dispute_id?: string; requested_amount?: string; refunded_amount?: string | null; refund_fee_amount?: string; fee_bearer?: string; reason?: string | null; charge_amount?: string | null; charge_currency?: string | null; is_response_editable?: boolean; response_deadline_at?: string | null; updated_at?: string | null;
  charge?: { id?: string; status?: string }; customer?: { customer_id?: string; email?: string };
  customer_id?: string; subscription_id?: string; current_period_end?: string; period_end?: string; cancel_at_period_end?: boolean;
  metadata?: Record<string, unknown>; capability?: string; product_id?: string; product?: { id?: string }; items?: { product_id?: string }[];
  subscription?: { subscription_id?: string } | null;
} };
function minor(value?: string, currency = 'NGN') { if (!value) return null; try { const amount = currencyDecimalToMinor(value, currency); return amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null; } catch { return null; } }
function validDate(value?: string) { if (!value) return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed; }
function usdCents(value?: string) { if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null; const [whole, fraction = ''] = value.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0')); }
function subscriptionProduct(productId?: string) {
  if (!productId) return null;
  const products = [
    { planId: 'pro' as const, billingInterval: 'month' as const, id: process.env.BACHS_PLAN_PRO_USD_PRODUCT_ID },
    { planId: 'studio' as const, billingInterval: 'month' as const, id: process.env.BACHS_PLAN_STUDIO_USD_PRODUCT_ID },
    { planId: 'pro' as const, billingInterval: 'year' as const, id: process.env.BACHS_PLAN_PRO_USD_YEARLY_PRODUCT_ID },
    { planId: 'studio' as const, billingInterval: 'year' as const, id: process.env.BACHS_PLAN_STUDIO_USD_YEARLY_PRODUCT_ID },
  ];
  return products.find((product) => Boolean(product.id) && product.id === productId) ?? null;
}

async function processConnectedAccountEvent(event: BachsEvent) {
  const accountId = event.account ?? event.organization_id;
  if (!accountId) return false;
  const db = getDatabase();
  const [creator] = await db.select({ id: creators.id }).from(creators).where(eq(creators.bachsAccountId, accountId)).limit(1);
  if (!creator) return false;
  const provider = await refreshBachsAccount(accountId);
  if (provider.account.id !== accountId) throw new Error('Connected-account webhook returned a different account.');
  const state = bachsCreatorAccountState(provider.account);
  await db.update(creators).set({
    bachsAccountStatus: state.status,
    bachsTransfersStatus: state.transfersStatus,
    bachsPayoutsStatus: state.payoutsStatus,
    bachsInternationalPayouts: state.internationalPayouts,
    bachsRequirements: state.requirements,
    kycStatus: state.status === 'approved' ? 'approved' : state.status === 'pending_review' ? 'pending' : state.status === 'needs_action' || state.status === 'rejected' ? 'rejected' : 'not_started',
    ...(state.onboarded ? { bachsOnboardedAt: new Date() } : {}),
    updatedAt: new Date(),
  }).where(eq(creators.id, creator.id));
  return true;
}

async function processCreatorTransferEvent(event: BachsEvent) {
  const data = event.data ?? {};
  const transferId = data.transfer_id;
  const chargeId = data.source_charge_id;
  if (!transferId || !chargeId || data.kind !== 'payout') return false;
  const db = getDatabase();
  const [row] = await db.select({ order: orders, bachsAccountId: creators.bachsAccountId }).from(orders).innerJoin(creators, eq(orders.creatorId, creators.id)).where(eq(orders.providerChargeId, chargeId)).limit(1);
  if (!row || !row.bachsAccountId) throw new Error('Settlement transfer arrived before its sale or recipient account was recorded.');
  const platformAccountId = process.env.BACHS_PLATFORM_ACCOUNT_ID;
  const expectedCreatorNet = row.order.totalMinor - row.order.platformFeeMinor;
  if (expectedCreatorNet < 0n || expectedCreatorNet !== row.order.netToCreatorMinor || data.destination !== row.bachsAccountId || (event.account && event.account !== row.bachsAccountId) || (platformAccountId && data.source !== platformAccountId) || data.currency?.toUpperCase() !== row.order.currency || minor(data.amount, row.order.currency) !== Number(row.order.totalMinor)) throw new Error('Settlement transfer did not match the destination-charge gross, platform fee, currency, or recipient.');
  await db.update(orders).set({ providerTransferId: transferId, updatedAt: new Date() }).where(eq(orders.id, row.order.id));
  await reconcileBachsSale(row.order.id);
  return true;
}

async function processRefundEvent(event: BachsEvent) {
  const data = event.data ?? {};
  const providerRefundId = data.refund_id;
  const chargeId = data.charge_id;
  const reference = data.reference;
  if (!providerRefundId || !chargeId || !reference || !data.requested_amount || !['refund.created','refund.paid','refund.failed'].includes(event.type ?? '')) throw new Error('Refund event is missing a valid identity, amount, or status.');
  const db = getDatabase();
  const localRefundId = reference.startsWith('onselli-refund-') ? reference.slice('onselli-refund-'.length) : '';
  const refundMatches = [eq(refunds.providerRef, providerRefundId), ...( /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(localRefundId) ? [eq(refunds.id, localRefundId)] : [])];
  const [row] = await db.select({ refund: refunds, order: orders }).from(refunds).innerJoin(orders, eq(refunds.orderId, orders.id)).innerJoin(payments, eq(payments.orderId, orders.id)).where(and(eq(payments.chargeId, chargeId), or(...refundMatches))).limit(1);
  if (!row) throw new Error('Refund event did not match an Onselli refund and charge.');
  const paidCurrency = row.order.paidCurrency ?? row.order.checkoutCurrency ?? row.order.currency;
  const requestedAmount = minor(data.requested_amount, paidCurrency);
  if (requestedAmount === null) throw new Error('Refund amount is invalid for its currency.');
  const paidAmount = Number(row.order.paidAmountMinor ?? row.order.checkoutAmountMinor ?? row.order.totalMinor);
  if (paidAmount !== requestedAmount || paidCurrency !== (data.currency ?? paidCurrency)) throw new Error('Refund amount or currency does not match its order.');
  if (event.type === 'refund.paid' && data.refunded_amount !== null && minor(data.refunded_amount ?? undefined, paidCurrency) !== requestedAmount) throw new Error('Completed refund amount does not match the requested amount.');
  const configuredPlatform = process.env.BACHS_PLATFORM_ACCOUNT_ID;
  const eventOwner = event.organization_id ?? event.account;
  if (configuredPlatform && eventOwner && eventOwner !== configuredPlatform) throw new Error('Refund event did not originate from Onselli platform account.');
  const nextStatus = event.type === 'refund.paid' ? 'paid' : event.type === 'refund.failed' ? 'failed' : 'processing';
  await db.transaction(async (tx) => {
    await tx.update(refunds).set({ providerRef: providerRefundId, status: nextStatus, decisionMessage: nextStatus === 'failed' ? 'Bachs could not deliver the refund. The order remains paid.' : null, updatedAt: new Date() }).where(eq(refunds.id, row.refund.id));
    let revokedEntitlements = 0;
    if (nextStatus === 'paid') {
      await tx.update(orders).set({ status: 'refunded', updatedAt: new Date() }).where(eq(orders.id, row.order.id));
      const revoked = await tx.update(entitlements).set({ status: 'revoked', revokedAt: new Date() }).where(and(eq(entitlements.orderId, row.order.id), eq(entitlements.status, 'active'))).returning({ id: entitlements.id });
      revokedEntitlements = revoked.length;
    }
    await tx.insert(auditLogs).values({ action: 'refund.provider_update', entityType: 'refund', entityId: row.refund.id, after: { eventId: event.id, providerRefundId, status: nextStatus, amountMinor: requestedAmount, revokedEntitlements } });
  });
  return true;
}

async function processDisputeEvent(event: BachsEvent) {
  const data = event.data ?? {};
  const disputeId = data.dispute_id;
  const chargeId = data.charge_id;
  const currency = data.currency?.toUpperCase();
  const status = data.status;
  if (!disputeId || !chargeId || !data.amount || !currency || !status) throw new Error('Dispute event is missing required identity or amount fields.');
  const db = getDatabase();
  const [row] = await db.select({ order: orders }).from(orders).innerJoin(payments, eq(payments.orderId, orders.id)).where(eq(payments.chargeId, chargeId)).limit(1);
  if (!row) throw new Error('Dispute event did not match a sale.');
  const paidCurrency = row.order.paidCurrency ?? row.order.checkoutCurrency ?? row.order.currency;
  const disputeAmount = minor(data.amount, paidCurrency);
  const chargeAmount = minor(data.charge_amount ?? undefined, paidCurrency);
  if (disputeAmount === null) throw new Error('Dispute amount is invalid for its currency.');
  const platformAccountId = process.env.BACHS_PLATFORM_ACCOUNT_ID;
  const eventOwner = event.account ?? event.organization_id;
  const paidAmount = Number(row.order.paidAmountMinor ?? row.order.checkoutAmountMinor ?? row.order.totalMinor);
  if (!platformAccountId || !eventOwner || eventOwner !== platformAccountId || currency !== paidCurrency || disputeAmount > paidAmount || (chargeAmount !== null && chargeAmount !== paidAmount) || (data.charge_currency && data.charge_currency.toUpperCase() !== paidCurrency)) throw new Error('Dispute event did not match the platform-owned sale, amount, or currency.');
  const deadline = validDate(data.response_deadline_at ?? undefined);
  const disputeAmountMinor = BigInt(disputeAmount);
  const editable = data.is_response_editable === true;
  const [saved] = await db.insert(disputes).values({ creatorId: row.order.creatorId, orderId: row.order.id, providerRef: disputeId, status, amountMinor: disputeAmountMinor, reason: data.reason ?? null, isResponseEditable: editable, dueAt: deadline }).onConflictDoUpdate({ target: [disputes.creatorId, disputes.providerRef], set: { status, amountMinor: disputeAmountMinor, reason: data.reason ?? null, isResponseEditable: editable, dueAt: deadline, updatedAt: new Date() } }).returning({ id: disputes.id });
  if (saved) await db.insert(auditLogs).values({ action: 'dispute.provider_update', entityType: 'dispute', entityId: saved.id, after: { eventId: event.id, providerDisputeId: disputeId, status, amountMinor: disputeAmountMinor.toString(), currency } });
  if (['needs_response','under_review'].includes(status)) await db.update(orders).set({ status: 'needs_review', updatedAt: new Date() }).where(eq(orders.id, row.order.id));
  if (status === 'won') {
    await db.transaction(async (tx) => {
      const [restoredOrder] = await tx.update(orders).set({ status: 'paid', updatedAt: new Date() }).where(and(eq(orders.id, row.order.id), eq(orders.status, 'needs_review'))).returning({ id: orders.id, creatorId: orders.creatorId, buyerUserId: orders.buyerUserId, guestBuyerId: orders.guestBuyerId });
      if (!restoredOrder?.buyerUserId && !restoredOrder?.guestBuyerId) return;
      const items = await tx.select({ id: orderItems.id, productId: orderItems.productId, type: products.type }).from(orderItems).leftJoin(products, eq(orderItems.productId, products.id)).where(eq(orderItems.orderId, row.order.id));
      let restoredEntitlements = 0;
      for (const item of items) {
        const ids = item.type === 'bundle' ? bundleEntitlementProductIds(await tx.select({ productIdSnapshot: orderBundleContents.productIdSnapshot, productTypeSnapshot: orderBundleContents.productTypeSnapshot }).from(orderBundleContents).where(eq(orderBundleContents.orderItemId, item.id))) : item.productId && (item.type === 'course' || item.type === 'download') ? [item.productId] : [];
        for (const productId of ids) {
          const [grant] = await tx.insert(entitlements).values({ creatorId: restoredOrder.creatorId, userId: restoredOrder.buyerUserId, guestBuyerId: restoredOrder.guestBuyerId, productId, orderId: restoredOrder.id, status: 'active' }).onConflictDoNothing().returning({ id: entitlements.id });
          if (grant) restoredEntitlements++;
        }
      }
      await tx.insert(auditLogs).values({ action: 'dispute.entitlements_restored', entityType: 'order', entityId: restoredOrder.id, after: { eventId: event.id, providerDisputeId: disputeId, reason: 'dispute_won', restoredEntitlements } });
    });
  }
  if (status === 'lost') {
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ status: 'needs_review', updatedAt: new Date() }).where(eq(orders.id, row.order.id));
      const revoked = await tx.update(entitlements).set({ status: 'revoked', revokedAt: new Date() }).where(and(eq(entitlements.orderId, row.order.id), eq(entitlements.status, 'active'))).returning({ id: entitlements.id });
      await tx.insert(auditLogs).values({ action: 'dispute.entitlements_revoked', entityType: 'order', entityId: row.order.id, after: { eventId: event.id, providerDisputeId: disputeId, reason: 'dispute_lost', revokedEntitlements: revoked.length } });
    });
  }
  return true;
}

async function processPayoutEvent(event: BachsEvent) {
  const data = event.data ?? {};
  const providerPayoutId = data.payout_id ?? data.id;
  if (!providerPayoutId) throw new Error('Payout event does not include a payout ID.');
  const db = getDatabase();
  const [local] = await db.select({ payout: payouts, bachsAccountId: creators.bachsAccountId }).from(payouts).innerJoin(creators, eq(payouts.creatorId, creators.id)).where(or(eq(payouts.providerPayoutId, providerPayoutId), ...(data.reference ? [eq(payouts.providerRef, data.reference)] : []))).limit(1);
  if (!local || (local.payout.providerPayoutId && local.payout.providerPayoutId !== providerPayoutId) || !local.bachsAccountId) return false;
  if (event.account && event.account !== local.bachsAccountId) throw new Error('Payout webhook account did not match the creator account.');
  const remote = await getBachsPayout(providerPayoutId, local.bachsAccountId);
  if (remote.id !== providerPayoutId || remote.reference !== local.payout.providerRef) throw new Error('Payout identity did not match the reserved payout.');
  const total = decimalToMinor(remote.total_debited, local.payout.sourceCurrency);
  const fee = decimalToMinor(remote.fee, local.payout.sourceCurrency);
  if (total !== local.payout.sourceAmountMinor + local.payout.feeMinor || fee !== local.payout.feeMinor || remote.source_currency !== local.payout.sourceCurrency || remote.currency !== local.payout.currency || decimalToMinor(remote.amount, local.payout.currency) !== local.payout.amountMinor) throw new Error('Payout amounts did not match the reserved payout.');
  const complete = ['paid','completed','succeeded'].includes(remote.status.toLowerCase());
  const failed = ['failed','rejected','cancelled','canceled'].includes(remote.status.toLowerCase());
  if (!complete && !failed) return false;
  await db.transaction(async (tx) => {
    const [payout] = await tx.select().from(payouts).where(eq(payouts.id, local.payout.id)).for('update');
    if (!payout || ['paid','failed'].includes(payout.status)) return;
    if (!['processing','requested','approved'].includes(payout.status)) throw new Error('Payout is not in a reconcilable state.');
    const key = `payout:${payout.id}:provider:${complete ? 'paid' : 'failed'}`;
    await tx.insert(ledgerEntries).values([
      { creatorId: payout.creatorId, type: complete ? 'payout_paid' : 'payout_failed', bucket: 'reserved', amountMinor: -total, currency: payout.sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `${key}:reserved` },
      ...(failed ? [{ creatorId: payout.creatorId, type: 'payout_reversal', bucket: 'available' as const, amountMinor: total, currency: payout.sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `${key}:available` }] : []),
    ]).onConflictDoNothing();
    await tx.update(payouts).set({ providerPayoutId, status: complete ? 'paid' : 'failed', paidAt: complete ? new Date() : null, failureReason: failed ? (remote.failure_reason ?? data.failure_reason ?? 'The payout failed.') : null, updatedAt: new Date() }).where(eq(payouts.id, payout.id));
    await tx.insert(auditLogs).values({ action: 'payout.webhook_update', entityType: 'payout', entityId: payout.id, after: { status: complete ? 'paid' : 'failed', providerPayoutId, providerStatus: remote.status, eventId: event.id } });
  });
  return true;
}

async function processSubscriptionEvent(event: BachsEvent, eventId: string) {
  const data = event.data ?? {}; const db = getDatabase(); const now = new Date();
  const subscriptionId = data.id?.startsWith('sub_') ? data.id : data.subscription_id ?? data.subscription?.subscription_id;
  const metadataUserId = typeof data.metadata?.onselli_user_id === 'string' ? data.metadata.onselli_user_id : null;
  const metadataPlanId = data.metadata?.onselli_plan_id;
  const billingReference = typeof data.metadata?.onselli_billing_reference === 'string' ? data.metadata.onselli_billing_reference : null;
  const customerId = data.customer?.customer_id ?? data.customer_id;
  const currentPeriodEnd = validDate(data.current_period_end ?? data.period_end);
  const eventTime = validDate(event.created_at);

  if (event.type === 'customer.subscription.created') {
    const productId = data.product_id ?? data.product?.id ?? data.items?.[0]?.product_id;
    const product = subscriptionProduct(productId);
    const planId = product?.planId ?? (metadataPlanId === 'pro' || metadataPlanId === 'studio' ? metadataPlanId : null);
    if (!product || !planId || !metadataUserId || !subscriptionId || !customerId || (data.currency && data.currency.toUpperCase() !== 'USD')) {
      throw new Error('Bachs subscription event did not match a configured user, plan, and product.');
    }
    const amount = usdCents(data.amount);
    if (amount !== null && amount !== Number((await db.select({ amountMinor: billingTransactions.amountMinor }).from(billingTransactions).where(and(eq(billingTransactions.reference, billingReference ?? ''), eq(billingTransactions.userId, metadataUserId))).limit(1))[0]?.amountMinor)) {
      throw new Error('Bachs subscription amount did not match the pending billing transaction.');
    }
    const [transaction] = billingReference ? await db.select().from(billingTransactions).where(and(eq(billingTransactions.reference, billingReference), eq(billingTransactions.userId, metadataUserId))).limit(1) : [];
    if (!transaction || transaction.planId !== planId || transaction.billingInterval !== product.billingInterval || transaction.currency !== 'USD') throw new Error('The matching Onselli billing transaction is missing or its billing interval does not match.');
    if (transaction.providerTransactionId && data.checkout_id && transaction.providerTransactionId !== data.checkout_id) throw new Error('Bachs checkout does not match the billing transaction.');
    await db.transaction(async (tx) => {
      await tx.update(billingTransactions).set({ status: 'complete', updatedAt: now }).where(eq(billingTransactions.id, transaction.id));
      const initialStatus = ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'canceled'].includes(data.status ?? '') ? data.status! : null;
      if (!initialStatus) throw new Error('Bachs subscription event included an unknown subscription status.');
      await tx.insert(userSubscriptions).values({ userId: transaction.userId, planId, billingInterval: product.billingInterval, status: initialStatus, currency: 'USD', provider: 'bachs', providerCustomerCode: customerId, providerSubscriptionCode: subscriptionId, currentPeriodEnd, cancelAtPeriodEnd: data.cancel_at_period_end ?? false, ...(eventTime ? { updatedAt: eventTime } : {}) })
        .onConflictDoUpdate({ target: userSubscriptions.userId, set: { planId, billingInterval: product.billingInterval, status: initialStatus, currency: 'USD', provider: 'bachs', providerCustomerCode: customerId, providerSubscriptionCode: subscriptionId, currentPeriodEnd, cancelAtPeriodEnd: data.cancel_at_period_end ?? false, updatedAt: eventTime ?? now } });
    });
    return true;
  }

  if (!subscriptionId) return false;
  const [existing] = await db.select({ userId: userSubscriptions.userId }).from(userSubscriptions).where(eq(userSubscriptions.providerSubscriptionCode, subscriptionId)).limit(1);
  if (!existing) return false;
  if (event.type === 'customer.subscription.updated' || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed' || event.type === 'customer.subscription.deleted') {
    const status = event.type === 'invoice.paid' ? 'active' : event.type === 'invoice.payment_failed' ? 'past_due' : event.type === 'customer.subscription.deleted' ? 'canceled' : ['active', 'trialing', 'past_due', 'unpaid', 'canceled', 'paused'].includes(data.status ?? '') ? data.status! : null;
    if (!status) throw new Error('Bachs subscription event included an unknown subscription status.');
    const product = subscriptionProduct(data.product_id ?? data.product?.id ?? data.items?.[0]?.product_id);
    const updates = { status, ...(product ? { planId: product.planId, billingInterval: product.billingInterval } : {}), ...(currentPeriodEnd ? { currentPeriodEnd } : {}), ...(typeof data.cancel_at_period_end === 'boolean' ? { cancelAtPeriodEnd: data.cancel_at_period_end } : {}), ...(customerId ? { providerCustomerCode: customerId } : {}), updatedAt: now };
    // Bachs can deliver out of order. Do not let an older event roll back newer subscription state.
    await db.update(userSubscriptions).set({ ...updates, updatedAt: eventTime ?? now }).where(and(eq(userSubscriptions.userId, existing.userId), ...(eventTime ? [sql`${userSubscriptions.updatedAt} <= ${eventTime}`] : [])));
    if (event.type === 'invoice.paid' && billingReference) await db.update(billingTransactions).set({ status: 'complete', updatedAt: now }).where(eq(billingTransactions.reference, billingReference));
  }
  return true;
}

export async function POST(request: Request) {
  const rawBody = await request.text(); const secret = process.env.BACHS_WEBHOOK_SECRET;
  if (!secret || !verifyBachsWebhook(rawBody, request.headers.get('x-bachs-timestamp'), request.headers.get('x-bachs-signature-v2') ?? request.headers.get('x-bachs-signature'), secret)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  let event: BachsEvent;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (!event.id || !event.type) return NextResponse.json({ error: 'Missing event identity.' }, { status: 400 });
  const eventId = event.id;
  const db = getDatabase();
  try {
    const [existing] = await db.select().from(webhookEvents).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId))).limit(1);
    if (existing?.status === 'processed') return NextResponse.json({ received: true, duplicate: true });
    if (!existing) {
      const safePayload = createBachsWebhookAuditPayload(event);
      await db.insert(webhookEvents).values({ provider: 'bachs', eventId, type: event.type, payload: safePayload, status: 'received' }).onConflictDoNothing();
    }
    if (event.type === 'account.updated' || event.type === 'capability.updated') {
      const processed = await processConnectedAccountEvent(event);
      await db.update(webhookEvents).set({ status: processed ? 'processed' : 'ignored', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    if (event.type === 'transfer.created' || event.type === 'transfer.updated') {
      const processed = await processCreatorTransferEvent(event);
      await db.update(webhookEvents).set({ status: processed ? 'processed' : 'ignored', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    if (event.type === 'refund.created' || event.type === 'refund.paid' || event.type === 'refund.failed') {
      const processed = await processRefundEvent(event);
      await db.update(webhookEvents).set({ status: processed ? 'processed' : 'ignored', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    if (event.type === 'dispute.created' || event.type === 'dispute.updated') {
      const processed = await processDisputeEvent(event);
      await db.update(webhookEvents).set({ status: processed ? 'processed' : 'ignored', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    if (event.type === 'payout.paid' || event.type === 'payout.failed') {
      const processed = await processPayoutEvent(event);
      await db.update(webhookEvents).set({ status: processed ? 'processed' : 'ignored', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    if (event.type?.startsWith('customer.subscription.') || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const processed = await processSubscriptionEvent(event, eventId);
      await db.update(webhookEvents).set({ status: processed ? 'processed' : 'ignored', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    const checkoutId = event.data?.checkout_id ?? event.data?.id;
    if (!checkoutId || !['checkout.completed','collection.succeeded','collection.failed','collection.underpaid'].includes(event.type)) {
      await db.update(webhookEvents).set({ status: 'ignored', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    const [orderRow] = await db.select({ order: orders, bachsAccountId: creators.bachsAccountId, creatorUserId: creators.userId, buyer: { id: users.id, email: users.email, name: users.name } }).from(orders).innerJoin(creators, eq(orders.creatorId, creators.id)).leftJoin(users, eq(orders.buyerUserId, users.id)).where(and(eq(orders.provider, 'bachs'), eq(orders.providerRef, checkoutId))).limit(1);
    const order = orderRow?.order;
    if (!order || !orderRow.bachsAccountId) return NextResponse.json({ error: 'Order or connected seller account not found.' }, { status: 404 });
    const eventAccount = event.account ?? event.organization_id;
    if (process.env.BACHS_PLATFORM_ACCOUNT_ID && eventAccount && eventAccount !== process.env.BACHS_PLATFORM_ACCOUNT_ID) return NextResponse.json({ error: 'Payment account does not match the configured platform.' }, { status: 422 });
    let verified: BachsCheckoutSession;
    try { verified = await getBachsCheckout(checkoutId); } catch { await db.update(webhookEvents).set({ status: 'failed', attempts: existing ? existing.attempts + 1 : 1, error: 'Provider verification unavailable' }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId))); return NextResponse.json({ error: 'Could not verify the payment with Bachs.' }, { status: 502 }); }
    if (verified.checkout_id !== checkoutId || verified.reference !== order.id) return NextResponse.json({ error: 'Payment identity does not match order.' }, { status: 422 });
    if (event.type === 'collection.failed' || event.type === 'collection.underpaid') {
      if (['failed','canceled'].includes(verified.payment_status?.toLowerCase() ?? '') || ['expired','cancelled'].includes(verified.status.toLowerCase())) await db.update(orders).set({ status: 'failed', updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
      await db.update(webhookEvents).set({ status: 'processed', processedAt: new Date() }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
      return NextResponse.json({ received: true });
    }
    const currency = (verified.charge?.currency ?? verified.billing_currency ?? verified.currency).toUpperCase();
    const amount = minor(verified.charge?.amount ?? verified.amount, currency);
    const checkoutCurrency = order.checkoutCurrency;
    const checkoutAmount = order.checkoutAmountMinor === null ? null : Number(order.checkoutAmountMinor);
    const baseAmount = minor(verified.amount, order.currency);
    const chargeCurrencyMatches = (verified.billing_currency ? verified.billing_currency.toUpperCase() === currency : true) && (checkoutCurrency ? currency === checkoutCurrency : true);
    const chargeAmountMatches = amount !== null && amount > 0 && (checkoutAmount === null || amount === checkoutAmount);
    const valid = verified.status.toLowerCase() === 'completed' && ['paid','succeeded'].includes(verified.payment_status?.toLowerCase() ?? '') && verified.charge?.status?.toLowerCase() === 'succeeded' && baseAmount === Number(order.totalMinor) && verified.currency.toUpperCase() === order.currency && chargeAmountMatches && chargeCurrencyMatches && (event.data?.currency ? event.data.currency.toUpperCase() === currency : true) && minor(verified.platform_fee ?? undefined, order.currency) === Number(order.platformFeeMinor);
    if (!valid) return NextResponse.json({ error: 'Payment does not match order.' }, { status: 422 });
    const buyerEmail = orderRow.buyer?.email ?? order.buyerEmail;
    const contactLimit = buyerEmail ? (await getAccountEntitlements(orderRow.creatorUserId)).maxContacts : 0;
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for('update');
      if (!locked || locked.status === 'paid') return;
      if (locked.status !== 'pending') throw new Error('Order is no longer awaiting payment.');
      const now = new Date(); const chargeId = verified.charge?.payment_id ?? verified.charge?.id ?? event.data?.charge?.id ?? event.data?.charge_id ?? checkoutId;
      await tx.update(orders).set({ status: 'paid', paidCurrency: currency, paidAmountMinor: BigInt(amount), providerChargeId: chargeId, paidAt: now, updatedAt: now }).where(eq(orders.id, order.id));
      const paymentAudit = createVerifiedPaymentAuditSnapshot({ checkoutId, reference: verified.reference, status: verified.status, paymentStatus: verified.payment_status, amount: String(verified.charge?.amount ?? verified.amount), currency, platformFee: verified.platform_fee, charge: verified.charge });
      await tx.insert(payments).values({ creatorId: order.creatorId, orderId: order.id, providerRef: checkoutId, chargeId, status: 'succeeded', amountMinor: BigInt(amount), currency, raw: paymentAudit }).onConflictDoNothing();
      const items = await tx.select({ id: orderItems.id, productId: orderItems.productId, type: products.type }).from(orderItems).leftJoin(products, eq(orderItems.productId, products.id)).where(eq(orderItems.orderId, order.id));
      // A payment link records a payment; it does not grant course or download access.
      if (order.buyerUserId || order.guestBuyerId) for (const item of items) {
        if (item.productId && (item.type === 'course' || item.type === 'download')) {
          await tx.insert(entitlements).values({ creatorId: order.creatorId, userId: order.buyerUserId, guestBuyerId: order.guestBuyerId, productId: item.productId, orderId: order.id, status: 'active' }).onConflictDoNothing();
        }
        if (item.type === 'bundle') {
          const snapshots = await tx.select({ productIdSnapshot: orderBundleContents.productIdSnapshot, productTypeSnapshot: orderBundleContents.productTypeSnapshot }).from(orderBundleContents).where(eq(orderBundleContents.orderItemId, item.id));
          if (snapshots.length < 2) throw new Error('Bundle order is missing its immutable contents snapshot.');
          for (const productId of bundleEntitlementProductIds(snapshots)) await tx.insert(entitlements).values({ creatorId: order.creatorId, userId: order.buyerUserId, guestBuyerId: order.guestBuyerId, productId, orderId: order.id, status: 'active' }).onConflictDoNothing();
        }
      }
      await tx.insert(ledgerEntries).values({ creatorId: order.creatorId, type: 'sale', bucket: 'pending', amountMinor: order.netToCreatorMinor, currency: order.currency, refType: 'order', refId: order.id, idempotencyKey: `sale:${order.id}` }).onConflictDoNothing();
      await tx.insert(analyticsEvents).values({ creatorId: order.creatorId, type: 'sale_confirmed', pageType: 'checkout', refId: order.id });
      let contactId = order.contactId;
      if (!contactId && buyerEmail) {
        const [existingContact] = await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.creatorId, order.creatorId), ilike(contacts.email, buyerEmail), isNull(contacts.deletedAt))).limit(1);
        contactId = existingContact?.id ?? null;
        if (!contactId) {
          const [contactCount] = Number.isFinite(contactLimit) ? await tx.select({ total: count() }).from(contacts).where(and(eq(contacts.creatorId, order.creatorId), isNull(contacts.deletedAt))) : [{ total: 0 }];
          if (Number(contactCount?.total ?? 0) < contactLimit) {
            const [createdContact] = await tx.insert(contacts).values({ creatorId: order.creatorId, email: buyerEmail.toLowerCase(), name: order.buyerName ?? orderRow.buyer?.name ?? null, source: 'checkout', stage: 'customer', status: 'active', lastActivityAt: now }).onConflictDoNothing().returning({ id: contacts.id });
            contactId = createdContact?.id ?? null;
            if (!contactId) {
              const [racedContact] = await tx.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.creatorId, order.creatorId), ilike(contacts.email, buyerEmail), isNull(contacts.deletedAt))).limit(1);
              contactId = racedContact?.id ?? null;
            }
          }
        }
      }
      if (contactId) {
        await tx.update(contacts).set({ stage: 'customer', status: 'active', ...(order.currency === 'NGN' ? { totalSpentMinor: sql`${contacts.totalSpentMinor} + ${order.totalMinor}` } : { totalSpentUsdMinor: sql`${contacts.totalSpentUsdMinor} + ${order.totalMinor}` }), ordersCount: sql`${contacts.ordersCount} + 1`, lastActivityAt: now, updatedAt: now }).where(eq(contacts.id, contactId));
        if (!order.contactId) await tx.update(orders).set({ contactId }).where(eq(orders.id, order.id));
      }
      await tx.update(webhookEvents).set({ status: 'processed', processedAt: now }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId)));
    });
    if (order.guestBuyerId && order.status !== 'paid') await createGuestPurchaseAccess(order.id).catch((error) => console.error('Guest purchase receipt/access email could not be sent', error));
    return NextResponse.json({ received: true });
  } catch (error) { console.error('Bachs webhook processing failed', { eventId, errorType: error instanceof Error ? error.name : 'UnknownError' }); await db.update(webhookEvents).set({ status: 'failed', error: 'Processing failed; inspect sanitized event fields and provider state.' }).where(and(eq(webhookEvents.provider, 'bachs'), eq(webhookEvents.eventId, eventId))); return NextResponse.json({ error: 'Could not process payment event.' }, { status: 500 }); }
}
