import { and, count, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireCreator, AuthorizationError } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, courseSections, creators, orderItems, orders, products } from '@/src/server/db/schema';
import { productInput } from '@/src/server/catalog/validation';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { serializeProductDescription } from '@/lib/product-description.mjs';
import { getCreatorLogoUrl } from '@/src/server/workspaces/logo';
import { generateProductSlug } from '@/lib/product-slug';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const suppliedRequestId = request.headers.get('x-request-id') ?? '';
  const requestId = /^[a-zA-Z0-9_-]{1,64}$/.test(suppliedRequestId) ? suppliedRequestId : crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const { creator } = await requireCreator();
    const db = getDatabase();
    const productRows = await db.select({
      id: products.id, type: products.type, title: products.title, slug: products.slug,
      priceMinor: products.priceMinor, currency: products.currency, status: products.status,
      updatedAt: products.updatedAt, coverKey: products.coverKey,
    }).from(products).where(eq(products.creatorId, creator.id)).orderBy(desc(products.updatedAt));
    const salesRows = productRows.length ? await db.select({
        productId: orderItems.productId,
        salesCount: sql<number>`count(*)::int`,
        revenueMinor: sql<string>`coalesce(sum(${orderItems.unitPriceMinor} * ${orderItems.quantity}), 0)::text`,
      }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(eq(orderItems.creatorId, creator.id), eq(orders.status, 'paid'))).groupBy(orderItems.productId) : [];
    const salesByProduct = new Map(salesRows.map((row) => [row.productId, row]));
    const result = productRows.map((product) => {
      const sales = salesByProduct.get(product.id);
      return {
        ...product,
        coverUrl: getCreatorLogoUrl(product.coverKey),
        salesCount: sales?.salesCount ?? 0,
        revenueMinor: sales?.revenueMinor ?? '0',
        priceMinor: product.priceMinor.toString(),
      };
    });
    const revenueByCurrency = result.reduce<Record<string, bigint>>((totals, row) => {
      totals[row.currency] = (totals[row.currency] ?? 0n) + BigInt(row.revenueMinor);
      return totals;
    }, {});
    return NextResponse.json({ products: result, workspaceSlug: creator.slug, summary: {
      total: result.length,
      published: result.filter((row) => row.status === 'published').length,
      drafts: result.filter((row) => row.status === 'draft').length,
      archived: result.filter((row) => row.status === 'archived').length,
      revenueByCurrency: Object.entries(revenueByCurrency).map(([currency, amountMinor]) => ({ currency, amountMinor: amountMinor.toString() })),
      salesCount: result.reduce((sum, row) => sum + row.salesCount, 0),
    } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Creator product list failed', { requestId, durationMs: Date.now() - startedAt, error });
    return NextResponse.json({ error: 'We couldn’t load your products right now. Please try again.', requestId }, { status: 503, headers: { 'x-request-id': requestId, 'Cache-Control': 'private, no-store' } });
  }
}

export async function POST(request: Request) {
  try {
    const { session, creator } = await requireCreator();
    const parsed = productInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your offer details.' }, { status: 400 });
    const input = parsed.data;
    if (input.status === 'published' && input.type !== 'payment_link' && !input.contentAttested) {
      return NextResponse.json({ error: 'Confirm you have the right to sell this content before publishing.' }, { status: 400 });
    }
    const entitlements = await getAccountEntitlements(session.user.id);
    if (entitlements.maxPublishedOffers !== null && input.status === 'published') {
      const [publishedCount] = await getDatabase().select({ total: count() }).from(products).where(and(eq(products.creatorId, creator.id), eq(products.status, 'published')));
      const total = publishedCount?.total ?? 0;
      if (total >= entitlements.maxPublishedOffers) return NextResponse.json({ error: `Your Free plan includes ${entitlements.maxPublishedOffers} published offers. Upgrade to publish more.`, code: 'PLAN_LIMIT', feature: 'unlimited_products' }, { status: 402 });
    }
    if (input.type === 'payment_link' && input.amountType === 'customer_chooses' && (input.minAmountMinor ?? 0n) < 10_000n) {
      return NextResponse.json({ error: 'The minimum amount for a payment link is ₦100.' }, { status: 400 });
    }
    if (input.type === 'download' && input.status === 'published') return NextResponse.json({ error: 'Upload at least one file before publishing a download.' }, { status: 400 });
    if (input.type === 'course' && input.status === 'published') return NextResponse.json({ error: 'Build and publish at least one lesson in the course editor before publishing the course.' }, { status: 400 });
    const db = getDatabase();
    const finalSlug = input.slug || generateProductSlug();
    const [existing] = await db.select({ id: products.id }).from(products).where(and(eq(products.creatorId, creator.id), eq(products.slug, finalSlug))).limit(1);
    if (existing) return NextResponse.json({ error: 'You already have an offer with that address.' }, { status: 409 });
    const product = await db.transaction(async (tx) => {
      if (input.status === 'published' && input.type !== 'download' && entitlements.maxPublishedOffers !== null) {
        // Publish attempts lock the workspace row so parallel requests respect the same plan limit.
        await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creator.id)).for('update');
        const [publishedCount] = await tx.select({ total: count() }).from(products)
          .where(and(eq(products.creatorId, creator.id), eq(products.status, 'published')));
        const total = publishedCount?.total ?? 0;
        if (total >= entitlements.maxPublishedOffers) throw Object.assign(new Error('PLAN_LIMIT'), { code: 'PLAN_LIMIT' });
      }
      const [created] = await tx.insert(products).values({
        creatorId: creator.id, type: input.type, title: input.title, slug: finalSlug,
        description: serializeProductDescription(input.description), priceMinor: input.priceMinor, currency: input.currency,
        currencyOptions: input.currencyOptions,
        amountType: input.type === 'payment_link' ? input.amountType : 'fixed',
        minAmountMinor: input.type === 'payment_link' && input.amountType === 'customer_chooses' ? input.minAmountMinor ?? 10_000n : null,
        maxSales: input.maxSales ?? null, refundWindowDays: input.refundWindowDays,
        thankYou: input.thankYou ?? { message: '' },
        status: ['download', 'course', 'bundle'].includes(input.type) ? 'draft' : input.status,
      }).returning({ id: products.id, slug: products.slug, type: products.type });
      if (!created) throw new Error('Could not save this offer.');
      if (created.type === 'course') {
        await tx.insert(courseSections).values({ creatorId: creator.id, productId: created.id, title: 'Module 1', position: 0 });
      }
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'product.create', entityType: 'product', entityId: created.id, after: { title: input.title, type: input.type, status: input.status } });
      return created;
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'PLAN_LIMIT') return NextResponse.json({ error: 'Your Free plan includes 5 published offers. Upgrade to publish more.', code: 'PLAN_LIMIT', feature: 'unlimited_products' }, { status: 402 });
    if (code === '23505') return NextResponse.json({ error: 'You already have an offer with that address.' }, { status: 409 });
    console.error('Creator product creation failed', error);
    return NextResponse.json({ error: 'Your offer could not be saved. Try again.' }, { status: 503 });
  }
}
