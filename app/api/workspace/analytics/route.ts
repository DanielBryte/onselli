import { and, desc, eq, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { analyticsEvents, orderItems, orders, products as productTable } from '@/src/server/db/schema';
import { hasAccountFeature } from '@/src/server/billing/entitlements';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const { creator } = await requireCreator(); const params = new URL(request.url).searchParams;
    const requestedDays = Math.min(90, Math.max(7, Number(params.get('days')) || 30));
    if (requestedDays > 30 && !await hasAccountFeature(creator.userId, 'analytics_90d')) return NextResponse.json({ error: '90-day analytics are available on Pro. View plans to unlock them.', code: 'UPGRADE_REQUIRED', feature: 'analytics_90d' }, { status: 402 });
    const days = requestedDays; const selectedCurrency = params.get('currency')?.toUpperCase() || null;
    const since = new Date(Date.now() - days * 86_400_000); const db = getDatabase();
    const [sales, currencyRows] = await Promise.all([
      db.select({ order: orders, item: orderItems, product: productTable }).from(orders).leftJoin(orderItems, eq(orders.id, orderItems.orderId)).leftJoin(productTable, eq(orderItems.productId, productTable.id)).where(and(eq(orders.creatorId, creator.id), gte(orders.createdAt, since))).orderBy(desc(orders.createdAt)),
      db.selectDistinct({ currency: orders.currency }).from(orders).where(eq(orders.creatorId, creator.id)),
    ]);
    const events = await db.select().from(analyticsEvents).where(and(eq(analyticsEvents.creatorId, creator.id), gte(analyticsEvents.occurredAt, since)));
    const currencyMap = new Map<string, { gross_revenue: number; refunds: number; net_revenue: number; paid_orders: number; buyers: Set<string> }>();
    const productMap = new Map<string, { product_id: string; title: string; currency: string; net_revenue: number; refunds: number; paidOrderIds: Set<string>; buyers: Set<string> }>();
    const dailyMap = new Map<string, { day: string; currency: string; net_revenue: number; paid_orders: number }>();
    const countedOrderIds = new Set<string>();
    for (const row of sales) {
      const order = row.order; const currency = order.currency; const isPaid = order.status === 'paid' || order.status === 'refunded';
      if (!isPaid || (selectedCurrency && currency !== selectedCurrency)) continue;
      const buyer = order.buyerUserId ?? order.guestBuyerId ?? order.contactId ?? order.buyerEmail?.trim().toLowerCase() ?? order.id;
      const gross = Number(order.totalMinor);
      const refund = order.status === 'refunded' ? gross : 0;
      if (!countedOrderIds.has(order.id)) {
        countedOrderIds.add(order.id);
        const net = gross - refund;
        const totals = currencyMap.get(currency) ?? { gross_revenue: 0, refunds: 0, net_revenue: 0, paid_orders: 0, buyers: new Set<string>() };
        totals.gross_revenue += gross / 100; totals.refunds += refund / 100; totals.net_revenue += net / 100; if (order.status === 'paid') totals.paid_orders += 1; totals.buyers.add(buyer); currencyMap.set(currency, totals);
        const day = order.createdAt.toISOString().slice(0, 10); const dailyKey = `${day}:${currency}`; const daily = dailyMap.get(dailyKey) ?? { day, currency, net_revenue: 0, paid_orders: 0 }; daily.net_revenue += net / 100; if (order.status === 'paid') daily.paid_orders += 1; dailyMap.set(dailyKey, daily);
      }
      if (row.product && row.item) {
        const productCurrencyKey = `${row.product.id}:${currency}`;
        const item = productMap.get(productCurrencyKey) ?? { product_id: row.product.id, title: row.item.titleSnapshot || row.product.title, currency, net_revenue: 0, refunds: 0, paidOrderIds: new Set<string>(), buyers: new Set<string>() };
        const lineGross = Number(row.item.unitPriceMinor) * row.item.quantity;
        const subtotal = Number(order.subtotalMinor);
        const lineNet = subtotal > 0 ? lineGross / subtotal * gross : lineGross;
        const lineRefund = order.status === 'refunded' ? lineNet : 0;
        item.net_revenue += (lineNet - lineRefund) / 100; item.refunds += lineRefund / 100;
        if (order.status === 'paid') item.paidOrderIds.add(order.id);
        item.buyers.add(buyer); productMap.set(productCurrencyKey, item);
      }
    }
    const currency_totals = [...currencyMap].map(([currency, item]) => ({ currency, ...item, buyers: item.buyers.size }));
    const productSummaries = [...productMap.values()].map(({ buyers, paidOrderIds, ...item }) => ({ ...item, buyers: buyers.size, paid_orders: paidOrderIds.size }));
    const productPageEvents = events.filter((event) => event.pageType === 'product');
    const trafficMap = new Map<string, number>();
    for (const event of productPageEvents) if (event.type === 'page_view') { const source = event.referrerHost?.trim().toLowerCase() || 'Unattributed'; trafficMap.set(source, (trafficMap.get(source) ?? 0) + 1); }
    const allPaidOrderIds = new Set(sales.filter(({ order }) => order.status === 'paid').map(({ order }) => order.id));
    const funnel = { product_views: productPageEvents.filter(event => event.type === 'page_view').length, checkout_starts: productPageEvents.filter(event => event.type === 'checkout_start').length, paid_orders: allPaidOrderIds.size };
    const total_traffic_views = [...trafficMap.values()].reduce((total, views) => total + views, 0);
    const traffic_sources = [...trafficMap].map(([source, views]) => ({ source, views })).sort((a, b) => b.views - a.views).slice(0, 5);
    const available_currencies = currencyRows.map(row => row.currency).sort();
    return NextResponse.json({ days, currency_totals, available_currencies, daily: [...dailyMap.values()].sort((a,b) => a.day.localeCompare(b.day)), products: productSummaries, funnel, traffic_sources, total_traffic_views }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 }); console.error('Creator analytics failed', error); return NextResponse.json({ error: 'Analytics are temporarily unavailable.' }, { status: 503 }); }
}
