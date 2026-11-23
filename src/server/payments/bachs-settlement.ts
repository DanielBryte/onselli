import { and, eq, lte, sum } from 'drizzle-orm';
import { getBachsPayment, getBachsTransfer } from '@/lib/payments/bachs-payouts';
import { currencyDecimalToMinor } from '@/lib/money.mjs';
import { getDatabase } from '@/src/server/db';
import { creators, ledgerEntries, orders } from '@/src/server/db/schema';
import { getCreatorRiskPolicy } from './creator-risk-policy';
import { creatorSettlementAllocation } from '@/lib/payments/settlement-allocation.mjs';

/** Reconcile a destination-charge transfer before making the creator's funds available. */
export async function reconcileBachsSale(orderId: string) {
  const db = getDatabase();
  const [row] = await db.select({ order: orders, bachsAccountId: creators.bachsAccountId }).from(orders).innerJoin(creators, eq(orders.creatorId, creators.id)).where(eq(orders.id, orderId)).limit(1);
  const order = row?.order;
  if (!order || !row.bachsAccountId || !order.providerTransferId || !order.providerChargeId || order.status !== 'paid') return false;

  const [transfer, payment] = await Promise.all([getBachsTransfer(order.providerTransferId), getBachsPayment(order.providerChargeId)]);
  const expectedCreatorNet = order.totalMinor - order.platformFeeMinor;
  if (expectedCreatorNet < 0n || expectedCreatorNet !== order.netToCreatorMinor || transfer.id !== order.providerTransferId || transfer.kind !== 'payout' || transfer.destination !== row.bachsAccountId || transfer.source_charge_id !== order.providerChargeId || transfer.currency !== order.currency || currencyDecimalToMinor(transfer.amount, order.currency) !== order.totalMinor) throw new Error('Bachs transfer does not match the destination-charge gross, platform fee, currency, or recipient.');
  const paidCurrency = order.paidCurrency ?? order.checkoutCurrency ?? order.currency;
  const paidAmount = order.paidAmountMinor ?? order.checkoutAmountMinor ?? order.totalMinor;
  if (payment.id !== order.providerChargeId || payment.currency !== paidCurrency || currencyDecimalToMinor(payment.amount, paidCurrency) !== paidAmount || !['succeeded','paid'].includes(payment.status.toLowerCase())) throw new Error('Bachs payment does not match the sale.');
  if (!['paid','completed','succeeded'].includes(transfer.status.toLowerCase())) return false;
  const fee = payment.fees?.amount ? currencyDecimalToMinor(payment.fees.amount, paidCurrency) : null;
  if (fee === null || payment.fees?.currency?.toUpperCase() !== paidCurrency || payment.fee_paid_by !== 'merchant') throw new Error('Bachs settlement fee is not final or is not charged to the sale.');
  // Bachs destination charges settle the creator's share as gross minus platform_fee.
  // Processing cost is charged to the platform's share; it is not a creator-ledger debit.
  const riskPolicy = getCreatorRiskPolicy();
  const { earned, reserve, available: releasable } = creatorSettlementAllocation(order.totalMinor, order.platformFeeMinor, riskPolicy?.reserveBps ?? null);

  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!locked || locked.providerTransferId !== transfer.id || locked.providerChargeId !== payment.id || locked.status !== 'paid' || locked.providerSettledAt) return;
    const pending = locked.netToCreatorMinor;
    await tx.insert(ledgerEntries).values([
      { creatorId: locked.creatorId, type: 'sale_settlement', bucket: 'pending', amountMinor: -pending, currency: locked.currency, refType: 'order', refId: locked.id, idempotencyKey: `sale:${locked.id}:pending-close` },
      ...(releasable > 0n ? [{ creatorId: locked.creatorId, type: 'sale_settled', bucket: 'available' as const, amountMinor: releasable, currency: locked.currency, refType: 'order', refId: locked.id, idempotencyKey: `sale:${locked.id}:available` }] : []),
      ...(reserve > 0n ? [{ creatorId: locked.creatorId, type: 'refund_reserve', bucket: 'held' as const, amountMinor: reserve, currency: locked.currency, refType: 'order', refId: locked.id, idempotencyKey: `sale:${locked.id}:reserve:${riskPolicy?.version ?? 'policy-required'}` }] : []),
    ]).onConflictDoNothing();
    await tx.update(orders).set({ processorFeeMinor: fee, processorFeeCurrency: paidCurrency, netToCreatorMinor: earned, providerSettledAt: new Date(), providerChargeId: payment.id, providerTransferId: transfer.id, updatedAt: new Date() }).where(eq(orders.id, locked.id));
  });
  return true;
}

export async function releaseMatureCreatorReserves(creatorId: string) {
  const policy = getCreatorRiskPolicy();
  if (!policy) return 0;
  const db = getDatabase();
  const cutoff = new Date(Date.now() - policy.holdDays * 86_400_000);
  const mature = await db.select({ id: orders.id, currency: orders.currency }).from(orders).where(and(eq(orders.creatorId, creatorId), eq(orders.status, 'paid'), lte(orders.providerSettledAt, cutoff))).limit(100);
  let released = 0;
  for (const order of mature) {
    await db.transaction(async (tx) => {
      const [locked] = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.id, order.id), eq(orders.creatorId, creatorId))).for('update');
      if (!locked) return;
      const [held] = await tx.select({ amount: sum(ledgerEntries.amountMinor) }).from(ledgerEntries).where(and(eq(ledgerEntries.creatorId, creatorId), eq(ledgerEntries.refType, 'order'), eq(ledgerEntries.refId, order.id), eq(ledgerEntries.bucket, 'held')));
      const amount = BigInt(String(held?.amount ?? 0));
      if (amount <= 0n) return;
      await tx.insert(ledgerEntries).values([
        { creatorId, type: 'refund_reserve_release', bucket: 'held', amountMinor: -amount, currency: order.currency, refType: 'order', refId: order.id, idempotencyKey: `sale:${order.id}:reserve-release:${policy.version}` },
        { creatorId, type: 'refund_reserve_release', bucket: 'available', amountMinor: amount, currency: order.currency, refType: 'order', refId: order.id, idempotencyKey: `sale:${order.id}:reserve-available:${policy.version}` },
      ]).onConflictDoNothing();
      released += 1;
    });
  }
  return released;
}
