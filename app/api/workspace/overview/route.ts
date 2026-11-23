import { and, count, desc, eq, gte, lt, sql, sum } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireCreator, AuthorizationError } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { analyticsEvents, ledgerEntries, orderItems, orders, payoutDestinations, products } from '@/src/server/db/schema';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { creator, session } = await requireCreator();
    const db = getDatabase();
    const requestedDays = Number(new URL(request.url).searchParams.get('days')) || 30;
    const days = [1, 7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const params = new URL(request.url).searchParams;
    const requestedCurrency = (params.get('currency') ?? 'NGN').toUpperCase();
    if (requestedCurrency !== 'NGN' && requestedCurrency !== 'USD') return NextResponse.json({ error: 'Choose NGN or USD.' }, { status: 400 });
    const currency = requestedCurrency;
    const now = new Date();
    const currentSince = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));
    const previousSince = new Date(currentSince.getTime() - days * 86_400_000);
    const dayBucket = sql`date_trunc('day', ${orders.createdAt} AT TIME ZONE 'UTC')`;
    const [offers, totals, dailyRows, ledgerRows, payoutMethods, topProductRows, events] = await Promise.all([
      db.select({ id: products.id, title: products.title, type: products.type, status: products.status, priceMinor: products.priceMinor, createdAt: products.createdAt }).from(products).where(eq(products.creatorId, creator.id)).orderBy(desc(products.createdAt)).limit(6),
      db.select({
        allTimeOrders: count(),
        currentOrders: sql<number>`count(*) filter (where ${orders.createdAt} >= ${currentSince} and ${orders.createdAt} < ${now})`,
        previousOrders: sql<number>`count(*) filter (where ${orders.createdAt} >= ${previousSince} and ${orders.createdAt} < ${currentSince})`,
        currentPaidOrders: sql<number>`count(*) filter (where ${orders.status} = 'paid' and ${orders.createdAt} >= ${currentSince} and ${orders.createdAt} < ${now})`,
        currentSalesMinor: sql<string>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.status} = 'paid' and ${orders.createdAt} >= ${currentSince} and ${orders.createdAt} < ${now}), 0)`,
        previousSalesMinor: sql<string>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.status} = 'paid' and ${orders.createdAt} >= ${previousSince} and ${orders.createdAt} < ${currentSince}), 0)`,
      }).from(orders).where(and(eq(orders.creatorId, creator.id), eq(orders.currency, currency))),
      db.select({ day: sql<string>`to_char(${dayBucket}, 'YYYY-MM-DD')`, orderCount: count(), revenueMinor: sql<string>`coalesce(sum(${orders.totalMinor}) filter (where ${orders.status} = 'paid'), 0)` }).from(orders).where(and(eq(orders.creatorId, creator.id), eq(orders.currency, currency), gte(orders.createdAt, currentSince), lt(orders.createdAt, now))).groupBy(dayBucket).orderBy(dayBucket),
      db.select({ bucket: ledgerEntries.bucket, amount: sum(ledgerEntries.amountMinor) }).from(ledgerEntries).where(and(eq(ledgerEntries.creatorId, creator.id), eq(ledgerEntries.currency, currency))).groupBy(ledgerEntries.bucket),
      db.select({ id: payoutDestinations.id }).from(payoutDestinations).where(and(eq(payoutDestinations.creatorId, creator.id), eq(payoutDestinations.currency, currency), eq(payoutDestinations.isDefault, true), eq(payoutDestinations.isUsable, true))).limit(1),
      db.select({ productId: orderItems.productId, title: orderItems.titleSnapshot, type: products.type, status: products.status, currency: orders.currency, units: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`, orders: sql<string>`count(distinct ${orders.id})`, revenueMinor: sql<string>`coalesce(sum(round(case when ${orders.subtotalMinor} > 0 then (${orderItems.unitPriceMinor} * ${orderItems.quantity})::numeric * ${orders.totalMinor} / ${orders.subtotalMinor} else (${orderItems.unitPriceMinor} * ${orderItems.quantity})::numeric end)), 0)` }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).leftJoin(products, eq(orderItems.productId, products.id)).where(and(eq(orderItems.creatorId, creator.id), eq(orders.currency, currency), eq(orders.status, 'paid'), gte(orders.createdAt, currentSince), lt(orders.createdAt, now))).groupBy(orderItems.productId, orderItems.titleSnapshot, products.type, products.status, orders.currency).orderBy(desc(sql`count(distinct ${orders.id})`), desc(sql`sum(${orderItems.quantity})`)).limit(5),
      db.select({ type: analyticsEvents.type, pageType: analyticsEvents.pageType, refId: analyticsEvents.refId, referrerHost: analyticsEvents.referrerHost }).from(analyticsEvents).where(and(eq(analyticsEvents.creatorId, creator.id), gte(analyticsEvents.occurredAt, currentSince), lt(analyticsEvents.occurredAt, now))),
    ]);

    const totalsRow = totals[0];
    const balances = { pending: 0, available: 0, reserved: 0, held: 0 };
    for (const row of ledgerRows) balances[row.bucket] = Number(row.amount ?? 0);
    const productViewEvents = events.filter((event) => event.pageType === 'product' && event.type === 'page_view');
    const productViews = new Map<string, number>();
    const traffic = new Map<string, number>();
    for (const event of productViewEvents) {
      if (event.refId) productViews.set(event.refId, (productViews.get(event.refId) ?? 0) + 1);
      const source = event.referrerHost?.trim().toLowerCase() || 'Direct / unattributed';
      traffic.set(source, (traffic.get(source) ?? 0) + 1);
    }
    const totalOrders = Number(totalsRow?.currentOrders ?? 0);
    const salesMinor = Number(totalsRow?.currentSalesMinor ?? 0);

    return NextResponse.json({
      creator: { id: creator.id, name: creator.displayName, slug: creator.slug, headline: creator.headline, userName: session.user.name ?? '' },
      currency,
      hasActivity: offers.length > 0 || Number(totalsRow?.allTimeOrders ?? 0) > 0 || productViewEvents.length > 0 || Object.values(balances).some((amount) => amount !== 0),
      offers: offers.map((offer) => ({ ...offer, priceMinor: offer.priceMinor.toString(), createdAt: offer.createdAt.toISOString() })),
      daily: dailyRows.map((row) => ({ ...row, orderCount: Number(row.orderCount), revenueMinor: String(row.revenueMinor) })),
      topProducts: topProductRows.map((row) => ({ ...row, units: Number(row.units), orders: Number(row.orders), views: row.productId ? productViews.get(row.productId) ?? 0 : 0, revenueMinor: String(row.revenueMinor) })),
      traffic: {
        productViews: productViewEvents.length,
        checkoutStarts: events.filter((event) => event.pageType === 'product' && event.type === 'checkout_start').length,
        sources: [...traffic].map(([source, views]) => ({ source, views })).sort((a, b) => b.views - a.views).slice(0, 5),
      },
      metrics: {
        days,
        allTimeOrders: Number(totalsRow?.allTimeOrders ?? 0),
        totalOrders,
        previousOrders: Number(totalsRow?.previousOrders ?? 0),
        salesMinor: String(totalsRow?.currentSalesMinor ?? 0),
        previousSalesMinor: String(totalsRow?.previousSalesMinor ?? 0),
        averageOrderValueMinor: String(totalsRow?.currentPaidOrders ? Math.round(salesMinor / Number(totalsRow.currentPaidOrders)) : 0),
        availableToWithdrawMinor: String(balances.available),
        pendingPayoutMinor: String(balances.reserved),
        payoutMethodReady: payoutMethods.length > 0,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: error.message.startsWith('Sign in') ? 401 : 403 });
    console.error('Creator overview failed', { requestId, error });
    return NextResponse.json({ error: 'Your workspace could not load. Please try again.', requestId }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
