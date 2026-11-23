import { and, asc, desc, eq, gte, inArray, isNotNull, sql, sum } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, disputes, ledgerEntries, orderItems, orders, payoutDestinations, payouts, refunds } from '@/src/server/db/schema';
import { reconcileBachsSale, releaseMatureCreatorReserves } from '@/src/server/payments/bachs-settlement';
import { getCreatorRiskPolicy } from '@/src/server/payments/creator-risk-policy';
import { configuredPayoutFeeMinor } from '@/lib/payments/bachs-payouts';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { creator } = await requireCreator(); const db = getDatabase();
    const unsettled = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.creatorId, creator.id), eq(orders.status, 'paid'), isNotNull(orders.providerTransferId), sql`${orders.providerSettledAt} IS NULL`)).limit(20);
    await Promise.allSettled(unsettled.map((order) => reconcileBachsSale(order.id)));
    await releaseMatureCreatorReserves(creator.id);
    const params = new URL(request.url).searchParams;
    const range = params.get('range') ?? '30';
    const currency = (params.get('currency') ?? 'NGN').toUpperCase();
    if (!['7', '30', '90', 'all'].includes(range)) return NextResponse.json({ error: 'Choose a valid transaction date range.' }, { status: 400 });
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: 'Choose a valid balance currency.' }, { status: 400 });
    const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 86_400_000);
    const transactionConditions = [eq(ledgerEntries.creatorId, creator.id), eq(ledgerEntries.currency, currency), ...(since ? [gte(ledgerEntries.createdAt, since)] : [])];
    const [rows, requests, providerDestinationRows, entries, paidOut, refundRows, disputeRows] = await Promise.all([
      db.select({ bucket: ledgerEntries.bucket, amount: sum(ledgerEntries.amountMinor) }).from(ledgerEntries).where(and(eq(ledgerEntries.creatorId, creator.id), eq(ledgerEntries.currency, currency))).groupBy(ledgerEntries.bucket),
      db.select({ id: payouts.id, amount_minor: payouts.amountMinor, currency: payouts.currency, source_amount_minor: payouts.sourceAmountMinor, source_currency: payouts.sourceCurrency, fee_minor: payouts.feeMinor, status: payouts.status, requested_at: payouts.requestedAt, updated_at: payouts.updatedAt, provider_ref: payouts.providerRef, bank_snapshot: payouts.bankSnapshot, decision_reason: payouts.decisionReason, failure_reason: payouts.failureReason }).from(payouts).where(and(eq(payouts.creatorId, creator.id), eq(payouts.sourceCurrency, currency))).orderBy(desc(payouts.requestedAt)).limit(20),
      db.select().from(payoutDestinations).where(and(eq(payoutDestinations.creatorId, creator.id), eq(payoutDestinations.isUsable, true))).orderBy(desc(payoutDestinations.isDefault), desc(payoutDestinations.createdAt)),
      db.select({ id: ledgerEntries.id, type: ledgerEntries.type, bucket: ledgerEntries.bucket, amount: ledgerEntries.amountMinor, currency: ledgerEntries.currency, refType: ledgerEntries.refType, refId: ledgerEntries.refId, createdAt: ledgerEntries.createdAt, orderNumber: orders.number, orderGross: orders.totalMinor, buyerPaidAmount: orders.paidAmountMinor, buyerPaidCurrency: orders.paidCurrency, platformFee: orders.platformFeeMinor, processorFee: orders.processorFeeMinor, payoutStatus: payouts.status, payoutProviderRef: payouts.providerRef }).from(ledgerEntries).leftJoin(orders, and(eq(ledgerEntries.refType, 'order'), eq(orders.id, ledgerEntries.refId), eq(orders.creatorId, creator.id))).leftJoin(payouts, and(eq(ledgerEntries.refType, 'payout'), eq(payouts.id, ledgerEntries.refId), eq(payouts.creatorId, creator.id))).where(and(...transactionConditions)).orderBy(desc(ledgerEntries.createdAt)).limit(100),
      db.select({ amount: sum(payouts.sourceAmountMinor) }).from(payouts).where(and(eq(payouts.creatorId, creator.id), eq(payouts.status, 'paid'), eq(payouts.sourceCurrency, currency))),
      db.select({ id: refunds.id, status: refunds.status, createdAt: refunds.updatedAt, providerRef: refunds.providerRef, orderId: orders.id, orderNumber: orders.number, orderGross: orders.totalMinor }).from(refunds).innerJoin(orders, and(eq(refunds.orderId, orders.id), eq(orders.creatorId, creator.id))).where(and(eq(refunds.creatorId, creator.id), eq(orders.currency, currency), ...(since ? [gte(refunds.updatedAt, since)] : []))),
      db.select({ id: disputes.id, status: disputes.status, createdAt: disputes.updatedAt, providerRef: disputes.providerRef, orderId: orders.id, orderNumber: orders.number, amount: disputes.amountMinor }).from(disputes).innerJoin(orders, and(eq(disputes.orderId, orders.id), eq(orders.creatorId, creator.id))).where(and(eq(disputes.creatorId, creator.id), eq(orders.currency, currency), ...(since ? [gte(disputes.updatedAt, since)] : []))),
    ]);
    const balances = { pending: 0n, available: 0n, reserved: 0n, held: 0n };
    for (const row of rows) balances[row.bucket] = BigInt(String(row.amount ?? 0));
    const currencyRows = await db.selectDistinct({ currency: ledgerEntries.currency }).from(ledgerEntries).where(eq(ledgerEntries.creatorId, creator.id));
    const currencies = [...new Set(['NGN', ...currencyRows.map((row) => row.currency.toUpperCase())])].sort();
    const orderIds = entries.filter((entry) => entry.refType === 'order').map((entry) => entry.refId);
    const itemRows = orderIds.length ? await db.select({ orderId: orderItems.orderId, title: orderItems.titleSnapshot }).from(orderItems).where(and(eq(orderItems.creatorId, creator.id), inArray(orderItems.orderId, orderIds))) : [];
    const titles = new Map<string, string[]>();
    for (const item of itemRows) titles.set(item.orderId, [...(titles.get(item.orderId) ?? []), item.title]);
    const [salesCount] = await db.select({ total: sum(ledgerEntries.amountMinor) }).from(ledgerEntries).where(and(eq(ledgerEntries.creatorId, creator.id), eq(ledgerEntries.type, 'sale')));
    const payoutIds = requests.map((row) => row.id);
    const payoutAuditRows = payoutIds.length ? await db.select({ entityId: auditLogs.entityId, action: auditLogs.action, after: auditLogs.after, createdAt: auditLogs.createdAt }).from(auditLogs).where(and(eq(auditLogs.entityType, 'payout'), inArray(auditLogs.entityId, payoutIds))).orderBy(asc(auditLogs.createdAt)) : [];
    const payoutTimeline = new Map<string, { status: string; at: string; message: string }[]>();
    for (const row of payoutAuditRows) {
      if (!row.entityId) continue;
      const details = row.after && typeof row.after === 'object' ? row.after as Record<string, unknown> : {};
      const status = typeof details.status === 'string' ? details.status : null;
      if (!status) continue;
      const timeline = payoutTimeline.get(row.entityId) ?? [];
      timeline.push({ status, at: row.createdAt.toISOString(), message: row.action.replaceAll('.', ' ') });
      payoutTimeline.set(row.entityId, timeline);
    }
    const destinations = providerDestinationRows.map((row) => ({ id: row.id, name: row.name, type: row.type, currency: row.currency, countryCode: row.countryCode, method: row.method, maskedDetails: row.maskedDetails, verified: row.isUsable, isDefault: row.isDefault }));
    const destination = destinations.find((row) => row.currency === currency && row.isDefault) ?? destinations.find((row) => row.currency === currency) ?? null;
    const [connect] = await db.select({ accountStatus: creators.bachsAccountStatus, transfersStatus: creators.bachsTransfersStatus, payoutsStatus: creators.bachsPayoutsStatus, internationalPayouts: creators.bachsInternationalPayouts, requirements: creators.bachsRequirements }).from(creators).where(eq(creators.id, creator.id)).limit(1);
    const transactions = [
      ...entries.map((entry) => ({ id: entry.id, type: entry.type, bucket: entry.bucket, amountMinor: entry.amount.toString(), currency: entry.currency, refType: entry.refType, reference: entry.orderNumber ? `Order ${entry.orderNumber}` : entry.refType === 'payout' ? `Payout ${entry.refId.slice(0, 8)}` : `${entry.refType} ${entry.refId.slice(0, 8)}`, context: titles.get(entry.refId)?.join(', ') || (entry.refType === 'payout' ? 'Withdrawal' : 'Account adjustment'), createdAt: entry.createdAt.toISOString(), orderGrossMinor: entry.orderGross?.toString() ?? null, buyerPaidAmountMinor: entry.buyerPaidAmount?.toString() ?? null, buyerPaidCurrency: entry.buyerPaidCurrency, feesMinor: entry.platformFee?.toString() ?? null, payoutStatus: entry.payoutStatus, providerReference: entry.payoutProviderRef })),
      ...refundRows.map((row) => ({ id: `refund:${row.id}`, type: 'refund', bucket: 'informational', amountMinor: '0', currency, refType: 'refund', reference: `Refund · Order ${row.orderNumber}`, context: row.status === 'paid' ? 'Refund paid to buyer; handled by Onselli' : 'Buyer refund', createdAt: row.createdAt.toISOString(), orderGrossMinor: row.orderGross.toString(), feesMinor: null, payoutStatus: row.status === 'paid' ? 'refunded' : row.status, providerReference: row.providerRef })),
      ...disputeRows.map((row) => ({ id: `dispute:${row.id}`, type: 'dispute', bucket: 'informational', amountMinor: '0', currency, refType: 'dispute', reference: `Dispute · Order ${row.orderNumber}`, context: 'Reviewed by Onselli; creator balance unchanged', createdAt: row.createdAt.toISOString(), orderGrossMinor: row.amount.toString(), feesMinor: null, payoutStatus: row.status, providerReference: row.providerRef })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
    return NextResponse.json({ currency, currencies, range, balances: { pending: balances.pending.toString(), available: balances.available.toString(), reserved: balances.reserved.toString(), held: balances.held.toString() }, riskPolicyReady: Boolean(getCreatorRiskPolicy()), payoutFeeMinor: destination ? configuredPayoutFeeMinor(currency, destination.method, destination.currency)?.toString() ?? null : null, paidOutMinor: String(paidOut[0]?.amount ?? 0), kycStatus: creator.kycStatus, connect, hasEarnings: Boolean(salesCount?.total && BigInt(String(salesCount.total)) > 0n), destination, destinations, payouts: requests.map((row) => ({ ...row, amount_minor: String(row.amount_minor), source_amount_minor: String(row.source_amount_minor), fee_minor: String(row.fee_minor), timeline: payoutTimeline.get(row.id) ?? [] })), transactions }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 }); console.error('Creator earnings load failed', error); return NextResponse.json({ error: 'Earnings are temporarily unavailable.' }, { status: 503 }); }
}

export async function POST() {
  try {
    await requireCreator();
    return NextResponse.json({ error: 'Use the Bachs withdrawal flow from Wallet & Payouts.' }, { status: 410 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: 'Sign in to manage withdrawals.' }, { status: 401 });
  }
}
