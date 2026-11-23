import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, bundleProductItems, courseSections, creators, lessons, productFiles, products } from '@/src/server/db/schema';
import { validateExternalDownloadUrl } from '@/lib/storage/external-download.mjs';
import { MAX_BUNDLE_PRODUCTS, validateBundleComposition } from '@/lib/bundles/rules.mjs';

export const runtime = 'nodejs';

async function readiness(ids: string[], creatorId: string) {
  const db = getDatabase();
  const downloads = await db.select({ productId: products.id, mode: products.downloadDeliveryMode, url: products.downloadExternalUrl })
    .from(products).where(and(inArray(products.id, ids), eq(products.type, 'download'), eq(products.creatorId, creatorId)));
  const readyFiles = await db.select({ productId: productFiles.productId }).from(productFiles)
    .where(and(inArray(productFiles.productId, ids), eq(productFiles.creatorId, creatorId), eq(productFiles.status, 'ready')));
  const readyDownloadIds = new Set(readyFiles.map((file) => file.productId));
  for (const product of downloads) if (product.mode === 'external_link' && validateExternalDownloadUrl(product.url)) readyDownloadIds.add(product.productId);
  const courseRows = await db.select({ productId: courseSections.productId }).from(courseSections)
    .innerJoin(lessons, eq(lessons.sectionId, courseSections.id))
    .where(and(inArray(courseSections.productId, ids), eq(courseSections.creatorId, creatorId), eq(courseSections.status, 'published'), eq(lessons.creatorId, creatorId), eq(lessons.status, 'published'), isNull(lessons.deletedAt)));
  const readyCourseIds = new Set(courseRows.map((row) => row.productId));
  return { readyDownloadIds, readyCourseIds };
}

async function compose(bundleId: string, creatorId: string, currency: string, ids: string[], rows: (typeof products.$inferSelect)[]) {
  const ready = await readiness(ids, creatorId);
  const candidates = rows.map((product) => ({ ...product, creatorId, priceMinor: product.priceMinor, deliveryReady: ready.readyDownloadIds.has(product.id), courseReady: ready.readyCourseIds.has(product.id) }));
  return validateBundleComposition({ bundleProductId: bundleId, creatorId, currency, selectedIds: ids, products: candidates });
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { productId } = await params;
    const db = getDatabase();
    const [bundle] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.creatorId, creator.id), eq(products.type, 'bundle'))).limit(1);
    if (!bundle) return NextResponse.json({ error: 'Bundle not found.' }, { status: 404 });
    const items = await db.select({ product: products, position: bundleProductItems.position }).from(bundleProductItems)
      .innerJoin(products, eq(bundleProductItems.includedProductId, products.id))
      .where(eq(bundleProductItems.bundleProductId, productId)).orderBy(asc(bundleProductItems.position));
    return NextResponse.json({ items: items.map(({ product, position }) => ({ id: product.id, title: product.title, type: product.type, status: product.status, currency: product.currency, priceMinor: product.priceMinor.toString(), position })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Bundle contents could not be loaded', error);
    return NextResponse.json({ error: 'Bundle contents could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.productIds) || body.productIds.length > MAX_BUNDLE_PRODUCTS || body.productIds.some((id: unknown) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) return NextResponse.json({ error: 'Choose between 2 and 20 eligible products.' }, { status: 400 });
    const ids = body.productIds as string[];
    const db = getDatabase();
    const result = await db.transaction(async (tx) => {
      const [bundle] = await tx.select().from(products).where(and(eq(products.id, productId), eq(products.creatorId, creator.id), eq(products.type, 'bundle'))).for('update');
      if (!bundle) return { error: 'Bundle not found.', status: 404 as const };
      const rows = ids.length ? await tx.select().from(products).where(inArray(products.id, ids)).for('update') : [];
      const problem = await compose(bundle.id, creator.id, bundle.currency, ids, rows);
      if (problem) return { error: problem, status: 400 as const };
      const oldItems = await tx.select({ includedProductId: bundleProductItems.includedProductId }).from(bundleProductItems).where(eq(bundleProductItems.bundleProductId, bundle.id));
      await tx.delete(bundleProductItems).where(eq(bundleProductItems.bundleProductId, bundle.id));
      await tx.insert(bundleProductItems).values(ids.map((includedProductId, position) => ({ bundleProductId: bundle.id, includedProductId, position })));
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'bundle.contents.update', entityType: 'product', entityId: bundle.id, before: { productIds: oldItems.map((item) => item.includedProductId) }, after: { productIds: ids } });
      return { ok: true as const };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Bundle contents could not be saved', error);
    return NextResponse.json({ error: 'Bundle contents could not be saved.' }, { status: 503 });
  }
}
