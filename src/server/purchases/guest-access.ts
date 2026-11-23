import { and, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDatabase } from '@/src/server/db';
import { guestAccessSessions, guestBuyers, guestPurchaseTokens, orderBundleContents, orderItems, orders, products } from '@/src/server/db/schema';
import { getCurrentSession } from '@/src/server/auth/permissions';
import { currencyMinorToDecimal } from '@/lib/money.mjs';
import { createGuestToken, hashGuestToken, isGuestTokenUsable } from '@/lib/purchases/guest-access.mjs';

export const GUEST_ACCESS_COOKIE = 'onselli_guest_access';

export async function getBuyerPrincipal() {
  const session = await getCurrentSession();
  if (session?.user) return { userId: session.user.id, guestBuyerId: null as string | null, email: session.user.email };
  const raw = (await cookies()).get(GUEST_ACCESS_COOKIE)?.value;
  if (!raw || raw.length > 128) return null;
  const [row] = await getDatabase().select({ guestBuyerId: guestAccessSessions.guestBuyerId, email: guestBuyers.email })
    .from(guestAccessSessions).innerJoin(guestBuyers, eq(guestAccessSessions.guestBuyerId, guestBuyers.id))
    .where(and(eq(guestAccessSessions.tokenHash, hashGuestToken(raw)), isNull(guestAccessSessions.revokedAt), gt(guestAccessSessions.expiresAt, new Date()), isNotNull(guestBuyers.emailVerifiedAt))).limit(1);
  return row ? { userId: null as string | null, guestBuyerId: row.guestBuyerId, email: row.email } : null;
}

export async function createGuestPurchaseAccess(orderId: string, rotate = false) {
  const db = getDatabase();
  const issued = await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
    if (!order || order.status !== 'paid' || !order.guestBuyerId || !order.buyerEmail) return null;
    const [existing] = await tx.select({ id: guestPurchaseTokens.id }).from(guestPurchaseTokens).where(and(eq(guestPurchaseTokens.orderId, order.id), isNull(guestPurchaseTokens.usedAt), gt(guestPurchaseTokens.expiresAt, new Date()))).limit(1);
    if (existing && !rotate) return null;
    if (rotate) await tx.delete(guestPurchaseTokens).where(eq(guestPurchaseTokens.orderId, order.id));
    const token = createGuestToken();
    await tx.insert(guestPurchaseTokens).values({ guestBuyerId: order.guestBuyerId, orderId: order.id, tokenHash: hashGuestToken(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
    const items = await tx.select({ id: orderItems.id, title: orderItems.titleSnapshot, type: products.type }).from(orderItems).leftJoin(products, eq(orderItems.productId, products.id)).where(eq(orderItems.orderId, order.id));
    const bundles = items.filter((item) => item.type === 'bundle');
    const included = bundles.length ? await tx.select({ title: orderBundleContents.titleSnapshot }).from(orderBundleContents).innerJoin(orderItems, eq(orderBundleContents.orderItemId, orderItems.id)).where(inArray(orderItems.id, bundles.map((item) => item.id))) : [];
    const access = items.some((item) => item.type === 'course' || item.type === 'download' || item.type === 'bundle');
    return { token, orderNumber: order.number, email: order.buyerEmail, title: items.length === 1 ? items[0]!.title : 'Your Onselli purchase', includedTitles: [...items.filter((item) => item.type !== 'payment_link').map((item) => item.title), ...included.map((entry) => entry.title)], amount: (order.paidAmountMinor ?? order.totalMinor).toString(), currency: order.paidCurrency ?? order.currency, access };
  });
  if (!issued) return false;
  const { sendPurchaseReceiptEmail } = await import('@/src/server/emails/send');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  await sendPurchaseReceiptEmail({ to: issued.email, orderNumber: issued.orderNumber, title: issued.title, includedTitles: issued.includedTitles, amount: currencyMinorToDecimal(BigInt(issued.amount), issued.currency), currency: issued.currency, ...(issued.access ? { accessUrl: `${appUrl}/purchase/access#token=${issued.token}` } : {}) });
  return true;
}

export async function verifyGuestPurchaseToken(raw: string) {
  if (raw.length < 40 || raw.length > 128) return null;
  const db = getDatabase();
  const result = await db.transaction(async (tx) => {
    const [token] = await tx.select().from(guestPurchaseTokens).where(and(eq(guestPurchaseTokens.tokenHash, hashGuestToken(raw)), isNull(guestPurchaseTokens.usedAt), gt(guestPurchaseTokens.expiresAt, new Date()))).for('update');
    if (!token || !isGuestTokenUsable(token)) return null;
    const [order] = await tx.select({ status: orders.status }).from(orders).where(and(eq(orders.id, token.orderId), eq(orders.guestBuyerId, token.guestBuyerId))).limit(1);
    if (order?.status !== 'paid') return null;
    const [guest] = await tx.select({ id: guestBuyers.id }).from(guestBuyers).where(eq(guestBuyers.id, token.guestBuyerId)).for('update');
    if (!guest) return null;
    const now = new Date();
    await tx.update(guestPurchaseTokens).set({ usedAt: now }).where(eq(guestPurchaseTokens.id, token.id));
    await tx.update(guestBuyers).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(guestBuyers.id, guest.id));
    const sessionToken = createGuestToken();
    await tx.insert(guestAccessSessions).values({ guestBuyerId: guest.id, tokenHash: hashGuestToken(sessionToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000) });
    return { sessionToken, guestBuyerId: guest.id };
  });
  if (result) (await cookies()).set(GUEST_ACCESS_COOKIE, result.sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(Date.now() + 30 * 24 * 60 * 60_000) });
  return result;
}
