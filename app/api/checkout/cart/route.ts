import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { analyticsEvents, bundleProductItems, courseSections, creators, entitlements, guestBuyers, lessons, orderBundleContents, orderItems, orders, productFiles, products, settings, users } from '@/src/server/db/schema';
import { createBachsCheckout, getBachsPaymentMethods } from '@/lib/payments/bachs';
import { currencyMinorToDecimal, isSafeMinorAmount, roundBasisPoints } from '@/lib/money.mjs';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { bundleEntitlementProductIds, snapshotBundleContents, validateBundleComposition } from '@/lib/bundles/rules.mjs';
import { validateExternalDownloadUrl } from '@/lib/storage/external-download.mjs';
import { createGuestPurchaseAccess } from '@/src/server/purchases/guest-access';
import { checkPublicRateLimit } from '@/src/server/security/rate-limit';
import { normalizeBuyerEmail } from '@/lib/purchases/guest-access.mjs';

export const runtime = 'nodejs';

async function snapshotBundle(db: ReturnType<typeof getDatabase>, bundle: typeof products.$inferSelect, creatorId: string) {
  const linked = await db.select({ productId: bundleProductItems.includedProductId }).from(bundleProductItems).where(eq(bundleProductItems.bundleProductId, bundle.id)).orderBy(bundleProductItems.position);
  const ids = linked.map((item) => item.productId);
  const candidates = ids.length ? await db.select().from(products).where(inArray(products.id, ids)).for('update') : [];
  const files = ids.length ? await db.select({ productId: productFiles.productId }).from(productFiles).where(and(inArray(productFiles.productId, ids), eq(productFiles.creatorId, creatorId), eq(productFiles.status, 'ready'))) : [];
  const downloads = new Set(files.map((file) => file.productId));
  for (const item of candidates) if (item.type === 'download' && item.downloadDeliveryMode === 'external_link' && validateExternalDownloadUrl(item.downloadExternalUrl)) downloads.add(item.id);
  const courseRows = ids.length ? await db.select({ productId: courseSections.productId }).from(courseSections).innerJoin(lessons, eq(lessons.sectionId, courseSections.id)).where(and(inArray(courseSections.productId, ids), eq(courseSections.creatorId, creatorId), eq(courseSections.status, 'published'), eq(lessons.creatorId, creatorId), eq(lessons.status, 'published'), isNull(lessons.deletedAt))) : [];
  const courses = new Set(courseRows.map((item) => item.productId));
  const error = validateBundleComposition({ bundleProductId: bundle.id, creatorId, currency: bundle.currency, selectedIds: ids, products: candidates.map((item) => ({ ...item, creatorId: item.creatorId, deliveryReady: downloads.has(item.id), courseReady: courses.has(item.id) })) });
  return error ? { error, contents: [] } : { error: null, contents: snapshotBundleContents(ids.map((id) => candidates.find((item) => item.id === id)!)) };
}

export async function POST(request: Request) {
  let createdOrderId: string | null = null;
  try {
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkPublicRateLimit(`checkout:${address}`);
    if (!rate.success) return NextResponse.json({ error: 'Too many checkout attempts. Wait a moment and try again.' }, { status: 429 });
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) return NextResponse.json({ error: 'Your cart must contain between 1 and 20 items.' }, { status: 400 });
    const items = body.items.map((item: unknown) => {
      const value = item as { productId?: unknown; quantity?: unknown };
      return { productId: typeof value?.productId === 'string' ? value.productId : '', quantity: Number(value?.quantity) };
    });
    if (items.some((item: { productId: string; quantity: number }) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) || new Set(items.map((item: { productId: string }) => item.productId)).size !== items.length) return NextResponse.json({ error: 'One or more cart items are invalid.' }, { status: 400 });
    const checkoutKey = typeof body.checkoutKey === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.checkoutKey) ? body.checkoutKey : null;
    if (!checkoutKey) return NextResponse.json({ error: 'Refresh your cart and try again.' }, { status: 400 });
    const session = await getCurrentSession();
    const suppliedEmail = normalizeBuyerEmail(body.email);
    const buyerEmail = suppliedEmail ?? session?.user.email.toLowerCase() ?? null;
    if (!buyerEmail) return NextResponse.json({ error: 'Enter a valid email address for your receipt and purchase access.' }, { status: 400 });
    const buyerName = (typeof body.name === 'string' ? body.name : session?.user.name ?? '').trim().slice(0, 120);
    if (buyerName.length < 1) return NextResponse.json({ error: 'Enter your full name to continue.' }, { status: 400 });
    const db = getDatabase();
    const ids = items.map((item: { productId: string }) => item.productId);
    const productRows = await db.select({ product: products, creator: creators, creatorEmail: users.email }).from(products).innerJoin(creators, eq(products.creatorId, creators.id)).innerJoin(users, eq(creators.userId, users.id)).where(and(inArray(products.id, ids), eq(products.status, 'published'), eq(creators.status, 'active')));
    if (productRows.length !== ids.length) return NextResponse.json({ error: 'An item in your cart is no longer available. Review your cart and try again.' }, { status: 409 });
    const creator = productRows[0]!.creator;
    if (buyerEmail.trim().toLowerCase() === productRows[0]!.creatorEmail.trim().toLowerCase()) return NextResponse.json({ error: 'Please use a different email to test payments.' }, { status: 400 });
    const currency = productRows[0]!.product.currency;
    if (productRows.some(({ creator: owner, product }) => owner.id !== creator.id || product.currency !== currency)) return NextResponse.json({ error: 'Checkout requires products from one creator and in one currency.' }, { status: 400 });
    if (!['NGN', 'USD'].includes(currency) || productRows.some(({ product }) => !['course', 'download', 'bundle', 'payment_link'].includes(product.type) || product.amountType !== 'fixed' || (product.currencyOptions as unknown[] | null)?.length)) return NextResponse.json({ error: 'Your cart contains an item that cannot be purchased in a combined checkout.' }, { status: 400 });
    const cart = productRows.map(({ product }) => ({ product, quantity: items.find((item: { productId: string }) => item.productId === product.id)!.quantity }));
    const orderTotal = cart.reduce((sum, item) => sum + item.product.priceMinor * BigInt(item.quantity), 0n);
    if (!isSafeMinorAmount(orderTotal) || orderTotal <= 0n) return NextResponse.json({ error: 'Your cart total must be greater than zero.' }, { status: 400 });
    const [existingOrder] = await db.select().from(orders).where(eq(orders.checkoutKey, checkoutKey)).limit(1);
    if (existingOrder) {
      const sameBuyer = session?.user ? existingOrder.buyerUserId === session.user.id : existingOrder.guestBuyerId !== null && existingOrder.buyerEmail?.toLowerCase() === buyerEmail;
      const savedItems = await db.select({ productId: orderItems.productId, quantity: orderItems.quantity, unitPriceMinor: orderItems.unitPriceMinor }).from(orderItems).where(eq(orderItems.orderId, existingOrder.id));
      const expected = cart.map(({ product, quantity }) => `${product.id}:${quantity}:${product.priceMinor}`).sort();
      const saved = savedItems.map((item) => `${item.productId}:${item.quantity}:${item.unitPriceMinor}`).sort();
      if (!sameBuyer || existingOrder.creatorId !== creator.id || existingOrder.currency !== currency || expected.length !== saved.length || expected.some((entry, index) => entry !== saved[index])) return NextResponse.json({ error: 'This checkout request has already been used for a different cart.' }, { status: 409 });
      if (existingOrder.status === 'paid') return NextResponse.json({ checkoutUrl: `${new URL(request.url).origin}/checkout/complete?order=${existingOrder.id}` });
      if (existingOrder.status !== 'pending' || (existingOrder.expiresAt && existingOrder.expiresAt <= new Date())) return NextResponse.json({ error: 'This cart checkout expired. Start again from your cart.' }, { status: 409 });
      if (!creator.bachsAccountId) return NextResponse.json({ error: 'This creator’s payout account is still being prepared. Please try again shortly.' }, { status: 409 });
      const methods = await getBachsPaymentMethods(currency, { includeAdaptiveCurrencies: currency === 'USD' });
      const resumed = await createBachsCheckout({ orderId: existingOrder.id, title: cart.length === 1 ? cart[0]!.product.title : `${cart.length} items from ${creator.displayName}`, amount: currencyMinorToDecimal(existingOrder.totalMinor, currency), currency, email: buyerEmail, name: existingOrder.buyerName ?? buyerName, destinationAccountId: creator.bachsAccountId, platformFee: currencyMinorToDecimal(existingOrder.platformFeeMinor, currency), paymentMethodTypes: methods.methods, successUrl: `${new URL(request.url).origin}/checkout/complete?order=${existingOrder.id}`, cancelUrl: `${new URL(request.url).origin}/c/${creator.slug}` });
      await db.update(orders).set({ providerRef: resumed.checkoutId, updatedAt: new Date() }).where(eq(orders.id, existingOrder.id));
      return NextResponse.json({ checkoutUrl: resumed.checkoutUrl });
    }
    const settingsRows = await db.select().from(settings).where(sql`key IN ('platform_fee_bps','min_price_minor')`);
    const config = Object.fromEntries(settingsRows.map((entry) => [entry.key, Number(entry.value)]));
    const configuredFloor = Number(config.min_price_minor);
    const floor = currency === 'NGN' ? (Number.isSafeInteger(configuredFloor) ? configuredFloor : 10_000) : 50;
    if (cart.some(({ product }) => product.priceMinor > 0n && product.priceMinor < BigInt(floor))) return NextResponse.json({ error: `Each item must be at least ${currency === 'NGN' ? `₦${(floor / 100).toLocaleString('en-NG')}` : `$${(floor / 100).toFixed(2)}`} to be sold in a cart.` }, { status: 400 });
    const bundles = new Map<string, Awaited<ReturnType<typeof snapshotBundle>>>();
    for (const { product } of cart) if (product.type === 'bundle') {
      const result = await snapshotBundle(db, product, creator.id);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
      bundles.set(product.id, result);
    }
    const entitlements = await getAccountEntitlements(creator.userId);
    const feeBps = (entitlements.billingEnabled ? entitlements.platformFeeBps : null) ?? config.platform_fee_bps ?? Number(process.env.ONSELLI_PLATFORM_FEE_BPS ?? 500);
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503 });
    const platformFee = BigInt(roundBasisPoints(Number(orderTotal), feeBps));
    const net = orderTotal - platformFee;
    if (net < 0n || !creator.bachsAccountId) return NextResponse.json({ error: 'This creator’s payout account is still being prepared. Please try again shortly.' }, { status: 409 });
    const number = randomInt(0, 1_000_000_000).toString().padStart(9, '0');
    const order = await db.transaction(async (tx) => {
      const lockedProducts = await tx.select().from(products).where(and(inArray(products.id, ids), eq(products.creatorId, creator.id), eq(products.status, 'published'))).for('update');
      if (lockedProducts.length !== cart.length || lockedProducts.some((locked) => { const original = cart.find((line) => line.product.id === locked.id)!.product; return locked.priceMinor !== original.priceMinor || locked.currency !== original.currency || locked.amountType !== 'fixed'; })) throw Object.assign(new Error('An item changed while you were checking out. Refresh your cart.'), { code: 'CART_CHANGED' });
      for (const { product, quantity } of cart) if (product.maxSales !== null) {
        const [sales] = await tx.select({ total: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(eq(orderItems.productId, product.id), sql`(${orders.status} = 'paid' or (${orders.status} = 'pending' and ${orders.expiresAt} > now()))`));
        if ((sales?.total ?? 0) + quantity > product.maxSales) throw Object.assign(new Error(`${product.title} does not have enough remaining availability.`), { code: 'CART_SOLD_OUT' });
      }
      let guestBuyerId: string | undefined;
      if (!session?.user) {
        const [inserted] = await tx.insert(guestBuyers).values({ email: buyerEmail }).onConflictDoNothing().returning({ id: guestBuyers.id });
        const [guest] = inserted ? [inserted] : await tx.select({ id: guestBuyers.id }).from(guestBuyers).where(sql`lower(${guestBuyers.email}) = ${buyerEmail}`).limit(1);
        guestBuyerId = guest?.id;
        if (!guestBuyerId) throw new Error('Could not prepare purchase access.');
      }
      const now = new Date();
      const [created] = await tx.insert(orders).values({ number, checkoutKey, buyerUserId: session?.user.id ?? null, guestBuyerId: guestBuyerId ?? null, buyerEmail, buyerName, creatorId: creator.id, status: 'pending', provider: 'bachs', currency, expiresAt: new Date(Date.now() + 30 * 60_000), subtotalMinor: orderTotal, totalMinor: orderTotal, platformFeeMinor: platformFee, processorFeeMinor: 0n, netToCreatorMinor: net, updatedAt: now }).returning();
      if (!created) throw new Error('Could not create your order.');
      for (const { product, quantity } of cart) {
        const [orderItem] = await tx.insert(orderItems).values({ creatorId: creator.id, orderId: created.id, productId: product.id, titleSnapshot: product.title, unitPriceMinor: product.priceMinor, quantity }).returning({ id: orderItems.id });
        const bundle = bundles.get(product.id);
        if (bundle?.contents.length) await tx.insert(orderBundleContents).values(bundle.contents.map((item) => ({ orderItemId: orderItem!.id, ...item, priceMinorSnapshot: BigInt(item.priceMinorSnapshot) })));
      }
      return created;
    });
    createdOrderId = order.id;
    await db.insert(analyticsEvents).values({ creatorId: creator.id, type: 'checkout_start', pageType: 'product', refId: order.id });
    const paymentMethods = await getBachsPaymentMethods(currency, { includeAdaptiveCurrencies: currency === 'USD' });
    const checkout = await createBachsCheckout({ orderId: order.id, title: cart.length === 1 ? cart[0]!.product.title : `${cart.length} items from ${creator.displayName}`, amount: currencyMinorToDecimal(orderTotal, currency), currency, email: buyerEmail, name: buyerName, destinationAccountId: creator.bachsAccountId, platformFee: currencyMinorToDecimal(platformFee, currency), paymentMethodTypes: paymentMethods.methods, successUrl: `${new URL(request.url).origin}/checkout/complete?order=${order.id}`, cancelUrl: `${new URL(request.url).origin}/c/${creator.slug}` });
    await db.update(orders).set({ providerRef: checkout.checkoutId, updatedAt: new Date() }).where(eq(orders.id, order.id));
    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'CART_CHANGED' || code === 'CART_SOLD_OUT') return NextResponse.json({ error: error instanceof Error ? error.message : 'Your cart changed. Review it and try again.' }, { status: 409 });
    if (createdOrderId) await getDatabase().update(orders).set({ status: 'failed', updatedAt: new Date() }).where(and(eq(orders.id, createdOrderId), eq(orders.status, 'pending'))).catch(() => undefined);
    console.error('Cart checkout could not be started', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout is temporarily unavailable.' }, { status: 503 });
  }
}
