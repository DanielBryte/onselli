import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { creators, orderBundleContents, orderItems, orders, products } from '@/src/server/db/schema';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const db = getDatabase();
    const principal = await getBuyerPrincipal();
    let [order] = principal?.userId
      ? await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.buyerUserId, principal.userId))).limit(1)
      : principal?.guestBuyerId
        ? await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.guestBuyerId, principal.guestBuyerId))).limit(1)
        : [];
    const owned = Boolean(order);
    if (!order) [order] = await db.select().from(orders).where(and(eq(orders.id, id), isNotNull(orders.guestBuyerId))).limit(1);
    if (!order) return NextResponse.json({ error: 'Purchase not found.' }, { status: 404 });
    const [creator] = await db.select({ slug: creators.slug }).from(creators).where(eq(creators.id, order.creatorId)).limit(1);
    const items = await db.select({ id: orderItems.id, productId: orderItems.productId, title: orderItems.titleSnapshot, quantity: orderItems.quantity, type: products.type, deliveryMode: products.downloadDeliveryMode, thankYou: products.thankYou }).from(orderItems).leftJoin(products, eq(orderItems.productId, products.id)).where(eq(orderItems.orderId, order.id));
    const item = items[0];
    const canRead = owned && (principal?.userId ? order.buyerUserId === principal.userId : principal?.guestBuyerId ? order.guestBuyerId === principal.guestBuyerId : false);
    const includedProducts = canRead && order.status === 'paid' ? await db.select({ title: orderBundleContents.titleSnapshot, type: orderBundleContents.productTypeSnapshot }).from(orderBundleContents).innerJoin(orderItems, eq(orderBundleContents.orderItemId, orderItems.id)).where(and(eq(orderItems.orderId, order.id), inArray(orderItems.id, items.filter((entry) => entry.type === 'bundle').map((entry) => entry.id)))).orderBy(orderBundleContents.position) : [];
    const thankYou = item?.type === 'download' && item.thankYou && typeof item.thankYou === 'object' && 'message' in item.thankYou && typeof item.thankYou.message === 'string' ? item.thankYou.message.trim().slice(0, 500) : '';
    const productTypes = items.flatMap((entry) => entry.type ? [entry.type] : []);
    return NextResponse.json({ order: { id: order.id, status: order.status, ...(canRead ? { amount: order.totalMinor.toString(), currency: order.currency, paidAmount: order.paidAmountMinor?.toString() ?? null, paidCurrency: order.paidCurrency ?? order.currency, itemTitle: items.length > 1 ? `${items.length} items` : item?.title ?? 'Creator offer', itemTitles: items.map((entry) => entry.quantity > 1 ? `${entry.title} × ${entry.quantity}` : entry.title), purchasedProductIds: items.flatMap((entry) => entry.productId ? [entry.productId] : []), creatorSlug: creator?.slug ?? null, productType: items.length > 1 ? 'cart' : item?.type ?? null, productTypes, creatorConfirmation: thankYou || null, includedProducts } : {}), guestAccessPending: !canRead && order.status === 'paid' } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('Order lookup failed', error); return NextResponse.json({ error: 'Purchase status could not be loaded.' }, { status: 503 }); }
}
