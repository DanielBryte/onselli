import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { orderItems, orders, refunds, users } from '@/src/server/db/schema';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { creator } = await requireCreator();
    const db = getDatabase();
    const requestedOffset = Number(new URL(request.url).searchParams.get('offset') ?? '0');
    const offset = Number.isSafeInteger(requestedOffset) && requestedOffset > 0 ? Math.min(requestedOffset, 100_000) : 0;
    const pageSize = 50;
    const chartSince = new Date(Date.now() - 30 * 86_400_000);
    const [rows, refundRows, totals, revenueRows, dailyRows, refundedRows, pendingRows] = await Promise.all([
      db.select({ order: orders, item: orderItems, buyer: users })
        .from(orders).leftJoin(orderItems, eq(orders.id, orderItems.orderId)).leftJoin(users, eq(orders.buyerUserId, users.id))
        .where(eq(orders.creatorId, creator.id)).orderBy(desc(orders.createdAt)).limit(pageSize).offset(offset),
      db.select({ orderId: refunds.orderId, status: refunds.status, createdAt: refunds.createdAt }).from(refunds)
        .where(eq(refunds.creatorId, creator.id)).orderBy(desc(refunds.createdAt)),
      db.select({
        sales: sql<number>`count(*) filter (where ${orders.status} = 'paid')::int`,
        pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')::int`,
      }).from(orders).where(eq(orders.creatorId, creator.id)),
      db.select({ currency: orders.currency, revenueMinor: sql<string>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.status} = 'paid'), 0)::text`, creatorNetMinor: sql<string>`coalesce(sum(${orders.netToCreatorMinor}) filter (where ${orders.status} = 'paid'),0)::text` })
        .from(orders).where(eq(orders.creatorId, creator.id)).groupBy(orders.currency),
      db.select({ day: sql<string>`to_char(date_trunc('day', ${orders.paidAt}), 'YYYY-MM-DD')`, currency: orders.currency, amountMinor: sql<string>`coalesce(sum(${orders.totalMinor}),0)::text` })
        .from(orders).where(and(eq(orders.creatorId, creator.id), eq(orders.status, 'paid'), gte(orders.paidAt, chartSince))).groupBy(sql`date_trunc('day', ${orders.paidAt})`, orders.currency).orderBy(sql`date_trunc('day', ${orders.paidAt})`),
      db.select({ currency: orders.currency, count: sql<number>`count(*)::int`, amountMinor: sql<string>`coalesce(sum(${orders.totalMinor}),0)::text` }).from(orders)
        .where(and(eq(orders.creatorId, creator.id), eq(orders.status, 'refunded'))).groupBy(orders.currency),
      db.select({ currency: orders.currency, amountMinor: sql<string>`coalesce(sum(${orders.totalMinor}),0)::text` }).from(orders)
        .where(and(eq(orders.creatorId, creator.id), eq(orders.status, 'pending'))).groupBy(orders.currency),
    ]);
    const refundStatus = new Map<string, string>();
    for (const refund of refundRows) if (!refundStatus.has(refund.orderId)) refundStatus.set(refund.orderId, refund.status);
    return NextResponse.json({
      orders: rows.map(({ order, item, buyer }) => ({
        id: order.id, number: order.number, buyer_email: buyer?.email ?? '', buyer_name: buyer?.name ?? '', status: order.status.toUpperCase(),
        refund_status: refundStatus.get(order.id) ?? null, amount_minor: order.totalMinor.toString(), paid_amount_minor: order.paidAmountMinor?.toString() ?? null, paid_currency: order.paidCurrency ?? order.currency, platform_fee_minor: order.platformFeeMinor.toString(),
        currency: order.currency, created_at: order.createdAt.toISOString(), paid_at: order.paidAt?.toISOString() ?? null,
        title: item?.titleSnapshot ?? 'Creator product', buyer_user_id: order.buyerUserId,
      })),
      summary: { sales: totals[0]?.sales ?? 0, revenueByCurrency: revenueRows.map((row) => ({ currency: row.currency, amountMinor: String(row.revenueMinor), creatorNetMinor: String(row.creatorNetMinor) })), pending: totals[0]?.pending ?? 0, pendingByCurrency: pendingRows.map(row => ({ currency: row.currency, amountMinor: String(row.amountMinor) })), refunded: refundedRows.reduce((sum, row) => sum + row.count, 0), refundedByCurrency: refundedRows.map(row => ({ currency: row.currency, amountMinor: String(row.amountMinor), count: row.count })), daily: dailyRows.map(row => ({ day: row.day, currency: row.currency, amountMinor: String(row.amountMinor) })) },
      hasMore: rows.length === pageSize,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Creator orders load failed', error);
    return NextResponse.json({ error: 'Sales could not be loaded.' }, { status: 503 });
  }
}
