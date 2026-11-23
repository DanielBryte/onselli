import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { analyticsEvents, auditLogs, bundleProductItems, courseSections, creators, entitlements as accessGrants, guestBuyers, lessons, orderBundleContents, orderItems, orders, productFiles, products, settings, users } from '@/src/server/db/schema';
import { createBachsCheckout, getBachsPaymentMethods } from '@/lib/payments/bachs';
import { currencyMinorToDecimal, isSafeMinorAmount, roundBasisPoints } from '@/lib/money.mjs';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { bundleEntitlementProductIds, snapshotBundleContents, validateBundleComposition } from '@/lib/bundles/rules.mjs';
import { validateExternalDownloadUrl } from '@/lib/storage/external-download.mjs';
import { createGuestPurchaseAccess } from '@/src/server/purchases/guest-access';
import { checkPublicRateLimit } from '@/src/server/security/rate-limit';
import { normalizeBuyerEmail } from '@/lib/purchases/guest-access.mjs';

export const runtime = 'nodejs';

async function getBundleContents(db: ReturnType<typeof getDatabase>, bundle: typeof products.$inferSelect, creatorId: string) {
  const itemRows = await db.select({ productId: bundleProductItems.includedProductId }).from(bundleProductItems).where(eq(bundleProductItems.bundleProductId, bundle.id)).orderBy(bundleProductItems.position);
  const ids = itemRows.map((item) => item.productId);
  const candidates = ids.length ? await db.select().from(products).where(inArray(products.id, ids)).for('update') : [];
  const readyFiles = ids.length ? await db.select({ productId: productFiles.productId }).from(productFiles).where(and(inArray(productFiles.productId, ids), eq(productFiles.creatorId, creatorId), eq(productFiles.status, 'ready'))) : [];
  const readyDownloads = new Set(readyFiles.map((file) => file.productId));
  for (const item of candidates) if (item.type === 'download' && item.downloadDeliveryMode === 'external_link' && validateExternalDownloadUrl(item.downloadExternalUrl)) readyDownloads.add(item.id);
  const readyCourseRows = ids.length ? await db.select({ productId: courseSections.productId }).from(courseSections).innerJoin(lessons, eq(lessons.sectionId, courseSections.id)).where(and(inArray(courseSections.productId, ids), eq(courseSections.creatorId, creatorId), eq(courseSections.status, 'published'), eq(lessons.creatorId, creatorId), eq(lessons.status, 'published'), isNull(lessons.deletedAt))) : [];
  const readyCourses = new Set(readyCourseRows.map((item) => item.productId));
  const checked = candidates.map((item) => ({ ...item, creatorId: item.creatorId, deliveryReady: readyDownloads.has(item.id), courseReady: readyCourses.has(item.id) }));
  const error = validateBundleComposition({ bundleProductId: bundle.id, creatorId, currency: bundle.currency, selectedIds: ids, products: checked });
  return { error, contents: error ? [] : snapshotBundleContents(ids.map((id) => checked.find((item) => item.id === id)!)) };
}

export async function POST(request: Request) {
  try {
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkPublicRateLimit(`checkout:${address}`);
    if (!rate.success) return NextResponse.json({ error: 'Too many checkout attempts. Wait a moment and try again.' }, { status: 429 });
    const session = await getCurrentSession();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.productId !== 'string') return NextResponse.json({ error: 'Choose a valid offer.' }, { status: 400 });
    const suppliedEmail = normalizeBuyerEmail(body.email);
    const buyerEmail = suppliedEmail ?? session?.user.email.toLowerCase() ?? null;
    if (!buyerEmail) return NextResponse.json({ error: 'Enter a valid email address for your receipt and purchase access.' }, { status: 400 });
    const buyerName = (typeof body.name === 'string' ? body.name : session?.user.name ?? '').trim().slice(0, 120);
    if (buyerName.length < 1) return NextResponse.json({ error: 'Enter your full name to continue.' }, { status: 400 });
    const checkoutKey = typeof body.checkoutKey === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.checkoutKey) ? body.checkoutKey : null;
    if (!checkoutKey) return NextResponse.json({ error: 'Refresh checkout and try again.' }, { status: 400 });
    const db = getDatabase();
    const [row] = await db.select({ product: products, creator: creators, creatorEmail: users.email }).from(products).innerJoin(creators, eq(products.creatorId, creators.id)).innerJoin(users, eq(creators.userId, users.id)).where(and(eq(products.id, body.productId), eq(products.status, 'published'), eq(creators.status, 'active'))).limit(1);
    if (!row) return NextResponse.json({ error: 'This offer is unavailable.' }, { status: 404 });
    if (buyerEmail.trim().toLowerCase() === row.creatorEmail.trim().toLowerCase()) return NextResponse.json({ error: 'Please use a different email to test payments.' }, { status: 400 });
    const [existingCheckout] = await db.select().from(orders).where(eq(orders.checkoutKey, checkoutKey)).limit(1);
    if (existingCheckout) {
      const [existingItem] = await db.select({ productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, existingCheckout.id)).limit(1);
      const sameBuyer = session?.user ? existingCheckout.buyerUserId === session.user.id : existingCheckout.guestBuyerId !== null && existingCheckout.buyerEmail?.toLowerCase() === buyerEmail;
      if (!sameBuyer || existingItem?.productId !== row.product.id) return NextResponse.json({ error: 'This checkout request has already been used.' }, { status: 409 });
      if (row.product.amountType === 'customer_chooses' && typeof body.amountMinor === 'string' && body.amountMinor !== existingCheckout.totalMinor.toString()) {
        return NextResponse.json({ error: 'Checkout amount changed. Refresh the page to continue.' }, { status: 409 });
      }
      if (existingCheckout.status === 'paid') return NextResponse.json({ checkoutUrl: `${new URL(request.url).origin}/checkout/complete?order=${existingCheckout.id}` });
      if (existingCheckout.status !== 'pending' || (existingCheckout.expiresAt && existingCheckout.expiresAt <= new Date()) || !row.creator.bachsAccountId) return NextResponse.json({ error: 'This checkout expired. Start again from the offer.' }, { status: 409 });
      try {
        const availableMethods = await getBachsPaymentMethods(existingCheckout.currency, { includeAdaptiveCurrencies: existingCheckout.currency === 'USD' });
      const checkout = await createBachsCheckout({ orderId: existingCheckout.id, title: existingItem.productId ? row.product.title : 'Creator offer', amount: currencyMinorToDecimal(existingCheckout.totalMinor, existingCheckout.currency), currency: existingCheckout.currency, email: buyerEmail, name: existingCheckout.buyerName ?? buyerName, destinationAccountId: row.creator.bachsAccountId, platformFee: currencyMinorToDecimal(existingCheckout.platformFeeMinor, existingCheckout.currency), paymentMethodTypes: availableMethods.methods, successUrl: `${new URL(request.url).origin}/checkout/complete?order=${existingCheckout.id}`, cancelUrl: `${new URL(request.url).origin}/c/${row.creator.slug}/${row.product.slug}?checkout=cancelled` });
        await db.update(orders).set({ providerRef: checkout.checkoutId, updatedAt: new Date() }).where(eq(orders.id, existingCheckout.id));
        return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
      } catch (error) { console.error('Existing checkout session could not be resumed', error); return NextResponse.json({ error: 'Checkout is temporarily unavailable. Please try again.' }, { status: 503 }); }
    }
    const destinationAccountId = row.creator.bachsAccountId;
    if (!['NGN', 'USD'].includes(row.product.currency) || (row.product.amountType !== 'fixed' && (row.product.type !== 'payment_link' || row.product.amountType !== 'customer_chooses'))) return NextResponse.json({ error: 'This offer cannot be checked out yet.' }, { status: 400 });
    const savedOptions = Array.isArray(row.product.currencyOptions) ? row.product.currencyOptions as Array<{ currency?: string; amountMinor?: string }> : [];
    if (savedOptions.length) return NextResponse.json({ error: 'This offer has saved local prices that need to be updated before checkout.' }, { status: 409 });
    const billingCurrency = row.product.currency;
    if (row.product.type === 'bundle') {
      const validation = await getBundleContents(db, row.product, row.creator.id);
      if (validation.error) return NextResponse.json({ error: validation.error }, { status: 409 });
    }
    if (typeof body.billingCurrency === 'string' && body.billingCurrency.toUpperCase() !== row.product.currency) return NextResponse.json({ error: 'Bachs selects the available buyer currency at secure checkout.' }, { status: 400 });
    let subtotal = row.product.priceMinor;
    if (row.product.amountType === 'customer_chooses') {
      if (typeof body.amountMinor !== 'string' || !/^\d{1,15}$/.test(body.amountMinor)) return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
      try { subtotal = BigInt(body.amountMinor); } catch { return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 }); }
    }
    if (!isSafeMinorAmount(subtotal)) return NextResponse.json({ error: 'Enter a valid amount.' }, { status: 400 });
    const checkoutAmount = subtotal;
    if (checkoutAmount < 0n) return NextResponse.json({ error: 'This currency price is invalid. Contact the seller.' }, { status: 409 });
    const isFree = subtotal === 0n;
    if (isFree && row.product.type === 'payment_link') return NextResponse.json({ error: 'Payment links need a positive amount.' }, { status: 400 });
    if (isFree && (row.product.type === 'course' || row.product.type === 'download')) {
      const [existingGrant] = session?.user ? await db.select({ id: accessGrants.id }).from(accessGrants).where(and(eq(accessGrants.creatorId, row.creator.id), eq(accessGrants.productId, row.product.id), eq(accessGrants.userId, session.user.id), eq(accessGrants.status, 'active'))).limit(1) : [];
      if (existingGrant) return NextResponse.json({ checkoutUrl: `${new URL(request.url).origin}/dashboard/learning` });
    }
    if (!isFree && !destinationAccountId) return NextResponse.json({ error: 'This creator’s payout account is still being prepared. Please try again shortly.' }, { status: 409 });
    const allSettings = await db.select().from(settings).where(sql`key IN ('platform_fee_bps','min_price_minor')`);
    const config = Object.fromEntries(allSettings.map((entry) => [entry.key, Number(entry.value)]));
    const entitlements = await getAccountEntitlements(row.creator.userId);
    const defaultCurrencyFloor = row.product.currency === 'NGN' ? 10_000 : 50;
    const configuredMinimum = row.product.currency === 'NGN' ? config.min_price_minor : undefined;
    const minimum = Number.isSafeInteger(configuredMinimum) && configuredMinimum !== undefined ? configuredMinimum : defaultCurrencyFloor;
    const productMinimum = row.product.amountType === 'customer_chooses' ? row.product.minAmountMinor ?? 0n : 0n;
    const checkoutMinimum = BigInt(Math.max(minimum, Number(productMinimum)));
    if (!isFree && subtotal < checkoutMinimum) {
      const formattedMin = row.product.currency === 'NGN'
        ? `₦${(Number(checkoutMinimum) / 100).toLocaleString('en-NG')}`
        : `$${(Number(checkoutMinimum) / 100).toFixed(2)}`;
      return NextResponse.json({ error: `Enter at least ${formattedMin}.` }, { status: 400 });
    }
    const feeBps = isFree ? 0 : (entitlements.billingEnabled ? entitlements.platformFeeBps : null) ?? config.platform_fee_bps ?? Number(process.env.ONSELLI_PLATFORM_FEE_BPS ?? 500);
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) return NextResponse.json({ error: 'Checkout is temporarily unavailable.' }, { status: 503 });
    const platformFee = BigInt(roundBasisPoints(Number(subtotal), feeBps));
    // Bachs processing costs vary by rail and currency. Never book the old estimate as an actual fee;
    // the provider's settled payment fee is reconciled from the payment after transfer.created.
    const processorFee = 0n;
    const net = subtotal - platformFee;
    if (net < 0n) return NextResponse.json({ error: 'This offer price is too low for the configured fees.' }, { status: 400 });
    const number = randomInt(0, 1_000_000_000).toString().padStart(9, '0');
    const order = await db.transaction(async (tx) => {
      const [lockedProduct] = await tx.select().from(products).where(and(eq(products.id, row.product.id), eq(products.creatorId, row.creator.id), eq(products.status, 'published'))).for('update');
      if (!lockedProduct) throw Object.assign(new Error('This offer is no longer available.'), { code: 'PRODUCT_UNAVAILABLE' });
      if (lockedProduct.priceMinor !== row.product.priceMinor || lockedProduct.amountType !== row.product.amountType || lockedProduct.minAmountMinor !== row.product.minAmountMinor || lockedProduct.currency !== row.product.currency || JSON.stringify(lockedProduct.currencyOptions) !== JSON.stringify(row.product.currencyOptions)) throw Object.assign(new Error('This offer has changed. Refresh the page and try again.'), { code: 'PRODUCT_CHANGED' });
      if (lockedProduct.maxSales !== null) {
        const [sales] = await tx.select({ total: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(
          eq(orderItems.productId, lockedProduct.id),
          sql`(${orders.status} = 'paid' or (${orders.status} = 'pending' and ${orders.expiresAt} > now()))`,
        ));
        if ((sales?.total ?? 0) >= lockedProduct.maxSales) throw Object.assign(new Error('This offer has sold out.'), { code: 'PRODUCT_SOLD_OUT' });
      }
      let guestBuyerId: string | undefined;
      if (!session?.user) {
        const [createdGuest] = await tx.insert(guestBuyers).values({ email: buyerEmail }).onConflictDoNothing().returning({ id: guestBuyers.id });
        const [guestBuyer] = createdGuest ? [createdGuest] : await tx.select({ id: guestBuyers.id }).from(guestBuyers).where(sql`lower(${guestBuyers.email}) = ${buyerEmail}`).limit(1);
        guestBuyerId = guestBuyer?.id;
        if (!guestBuyerId) throw new Error('Could not prepare purchase access.');
      }
      const now = new Date();
      const [created] = await tx.insert(orders).values({ number, checkoutKey, buyerUserId: session?.user.id ?? null, guestBuyerId: guestBuyerId ?? null, buyerEmail, buyerName, creatorId: row.creator.id, status: isFree ? 'paid' : 'pending', provider: isFree ? 'onselli_free' : 'bachs', currency: row.product.currency, ...(isFree ? { paidCurrency: row.product.currency, paidAmountMinor: subtotal } : { ...(row.product.currency === 'NGN' ? { checkoutCurrency: 'NGN', checkoutAmountMinor: checkoutAmount } : {}), expiresAt: new Date(Date.now() + 30 * 60_000) }), subtotalMinor: subtotal, totalMinor: subtotal, platformFeeMinor: platformFee, processorFeeMinor: processorFee, netToCreatorMinor: net, ...(isFree ? { paidAt: now } : {}) }).returning();
      if (!created) throw new Error('Could not create your order.');
      const [orderItem] = await tx.insert(orderItems).values({ creatorId: row.creator.id, orderId: created.id, productId: row.product.id, titleSnapshot: row.product.title, unitPriceMinor: subtotal, quantity: 1 }).returning({ id: orderItems.id });
      if (lockedProduct.type === 'bundle') {
        const bundle = await getBundleContents(tx as unknown as ReturnType<typeof getDatabase>, lockedProduct, row.creator.id);
        if (bundle.error || !orderItem) throw Object.assign(new Error(bundle.error ?? 'Bundle contents could not be saved.'), { code: 'PRODUCT_CHANGED' });
        await tx.insert(orderBundleContents).values(bundle.contents.map((item) => ({ orderItemId: orderItem.id, ...item, priceMinorSnapshot: BigInt(item.priceMinorSnapshot) })));
        await tx.insert(auditLogs).values({ actorUserId: session?.user.id ?? null, action: 'bundle.purchase_snapshot', entityType: 'order', entityId: created.id, after: { bundleProductId: lockedProduct.id, orderItemId: orderItem.id, includedProducts: bundle.contents.map((item) => ({ productId: item.productIdSnapshot, type: item.productTypeSnapshot, title: item.titleSnapshot, currency: item.currencySnapshot, priceMinor: item.priceMinorSnapshot })) } });
        if (isFree) for (const productId of bundleEntitlementProductIds(bundle.contents)) await tx.insert(accessGrants).values({ creatorId: row.creator.id, userId: session?.user.id ?? null, guestBuyerId: guestBuyerId ?? null, productId, orderId: created.id, status: 'active' }).onConflictDoNothing();
      } else if (isFree && (row.product.type === 'course' || row.product.type === 'download')) await tx.insert(accessGrants).values({ creatorId: row.creator.id, userId: session?.user.id ?? null, guestBuyerId: guestBuyerId ?? null, productId: row.product.id, orderId: created.id, status: 'active' }).onConflictDoNothing();
      return created;
    });
    await db.insert(analyticsEvents).values({ creatorId: row.creator.id, type: isFree ? 'sale_confirmed' : 'checkout_start', pageType: isFree ? 'checkout' : 'product', refId: isFree ? order.id : row.product.id });
    if (isFree) {
      if (order.guestBuyerId) await createGuestPurchaseAccess(order.id).catch((error) => console.error('Free guest purchase email could not be sent', error));
      return NextResponse.json({ checkoutUrl: `${new URL(request.url).origin}/checkout/complete?order=${order.id}` });
    }
    try {
        if (!destinationAccountId) throw new Error('This creator’s payout account is still being prepared. Please try again shortly.');
      const origin = new URL(request.url).origin;
      const paymentMethods = await getBachsPaymentMethods(billingCurrency, { includeAdaptiveCurrencies: billingCurrency === 'USD' });
      const checkout = await createBachsCheckout({ orderId: order.id, title: row.product.title, amount: currencyMinorToDecimal(subtotal, row.product.currency), currency: row.product.currency, email: buyerEmail, name: buyerName, destinationAccountId, platformFee: currencyMinorToDecimal(platformFee, row.product.currency), paymentMethodTypes: paymentMethods.methods, successUrl: `${origin}/checkout/complete?order=${order.id}`, cancelUrl: `${origin}/c/${row.creator.slug}/${row.product.slug}?checkout=cancelled` });
      await db.update(orders).set({ providerRef: checkout.checkoutId, updatedAt: new Date() }).where(eq(orders.id, order.id));
      return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
    } catch (error) {
      await db.update(orders).set({ status: 'failed', updatedAt: new Date() }).where(and(eq(orders.id, order.id), eq(orders.status, 'pending')));
      throw error;
    }
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error) {
      const code = String(error.code);
      if (code === 'PRODUCT_SOLD_OUT') return NextResponse.json({ error: 'This offer has sold out.' }, { status: 409 });
      if (code === 'PRODUCT_CHANGED' || code === 'PRODUCT_UNAVAILABLE') return NextResponse.json({ error: error instanceof Error ? error.message : 'This offer is no longer available.' }, { status: 409 });
    }
    console.error('Checkout could not be started', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Checkout is temporarily unavailable.' }, { status: 503 });
  }
}
