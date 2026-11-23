import { and, eq, lt } from 'drizzle-orm';
import { getDatabase } from '../db';
import { creators, ledgerEntries, orders } from '../db/schema';

export async function releaseMaturedEarnings(now = new Date(), holdDays = 3) {
  const db = getDatabase();
  const cutoff = new Date(now.getTime() - holdDays * 86_400_000);
  const pendingSales = await db.select({ creatorId: ledgerEntries.creatorId, orderId: ledgerEntries.refId, amountMinor: ledgerEntries.amountMinor, currency: ledgerEntries.currency })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.type, 'sale'), eq(ledgerEntries.bucket, 'pending'), lt(ledgerEntries.createdAt, cutoff)));

  let released = 0;
  for (const sale of pendingSales) {
    if (sale.amountMinor <= 0n) continue;
    const releaseKey = `release:${sale.orderId}`;
    await db.transaction(async (tx) => {
      await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, sale.creatorId)).for('update');
      const [alreadyReleased] = await tx.select({ id: ledgerEntries.id }).from(ledgerEntries).where(eq(ledgerEntries.idempotencyKey, `${releaseKey}:available`)).limit(1);
      if (alreadyReleased) return;
      await tx.insert(ledgerEntries).values([
        { creatorId: sale.creatorId, type: 'hold_release', bucket: 'pending', amountMinor: -sale.amountMinor, currency: sale.currency, refType: 'order', refId: sale.orderId, idempotencyKey: `${releaseKey}:pending` },
        { creatorId: sale.creatorId, type: 'hold_release', bucket: 'available', amountMinor: sale.amountMinor, currency: sale.currency, refType: 'order', refId: sale.orderId, idempotencyKey: `${releaseKey}:available` },
      ]).onConflictDoNothing();
      released += 1;
    });
  }
  return { released, checkedAt: now.toISOString() };
}

export async function expirePendingOrders(now = new Date()) {
  const db = getDatabase();
  const expired = await db.update(orders).set({ status: 'expired', updatedAt: now }).where(and(eq(orders.status, 'pending'), lt(orders.expiresAt, now))).returning({ id: orders.id });
  return { expired: expired.length, checkedAt: now.toISOString() };
}
