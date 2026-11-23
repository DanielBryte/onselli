import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { getDatabase } from '@/src/server/db';
import { auditLogs, bundleProductItems, courseQuizzes, courseSections, creators, entitlements, lessonAttachments, lessons, orderItems, productFiles, products } from '@/src/server/db/schema';
import { productInput } from '@/src/server/catalog/validation';
import { normalizeProductDescription, productDescriptionContent, serializeProductDescription } from '@/lib/product-description.mjs';
import { validateExternalDownloadUrl } from '@/lib/storage/external-download.mjs';
import { validateCoursePublishReadiness } from '@/lib/courses/curriculum-rules.mjs';
import { validateQuizConfig } from '@/lib/courses/quizzes.mjs';
import { validateBundleComposition } from '@/lib/bundles/rules.mjs';
import { getCreatorLogoUrl } from '@/src/server/workspaces/logo';
import { getR2Client, getR2Config } from '@/lib/storage/r2';
import { bunnyRequest, bunnyStreamConfig } from '@/src/server/courses/bunny-stream';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const db = getDatabase();
    const cleanup = await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products)
        .where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).for('update').limit(1);
      if (!product) throw Object.assign(new Error('Offer not found.'), { code: 'PRODUCT_NOT_FOUND' });
      if (product.status !== 'draft') throw Object.assign(new Error('Only draft offers can be deleted. Archive a published offer first.'), { code: 'PRODUCT_NOT_DRAFT' });

      const [sale] = await tx.select({ id: orderItems.id }).from(orderItems)
        .where(and(eq(orderItems.creatorId, creator.id), eq(orderItems.productId, product.id))).limit(1);
      const [grant] = await tx.select({ id: entitlements.id }).from(entitlements)
        .where(and(eq(entitlements.creatorId, creator.id), eq(entitlements.productId, product.id))).limit(1);
      if (sale || grant) throw Object.assign(new Error('This draft has purchase history or buyer access, so it cannot be deleted.'), { code: 'PRODUCT_HAS_HISTORY' });

      const [publishedBundle] = await tx.select({ title: products.title }).from(bundleProductItems)
        .innerJoin(products, eq(bundleProductItems.bundleProductId, products.id))
        .where(and(eq(bundleProductItems.includedProductId, product.id), eq(products.creatorId, creator.id), eq(products.status, 'published'))).limit(1);
      if (publishedBundle) throw Object.assign(new Error(`Remove this product from the published bundle “${publishedBundle.title}” before deleting it.`), { code: 'PRODUCT_IN_PUBLISHED_BUNDLE' });

      const sections = await tx.select({ id: courseSections.id }).from(courseSections)
        .where(and(eq(courseSections.productId, product.id), eq(courseSections.creatorId, creator.id)));
      const sectionIds = sections.map((section) => section.id);
      const courseLessons = sectionIds.length ? await tx.select({ id: lessons.id, bunnyVideoId: lessons.bunnyVideoId })
        .from(lessons).where(and(inArray(lessons.sectionId, sectionIds), eq(lessons.creatorId, creator.id))) : [];
      const lessonIds = courseLessons.map((lesson) => lesson.id);
      const resources = lessonIds.length ? await tx.select({ r2Key: lessonAttachments.r2Key }).from(lessonAttachments)
        .where(and(inArray(lessonAttachments.lessonId, lessonIds), eq(lessonAttachments.creatorId, creator.id))) : [];
      const files = await tx.select({ r2Key: productFiles.r2Key, assetId: productFiles.assetId }).from(productFiles)
        .where(and(eq(productFiles.productId, product.id), eq(productFiles.creatorId, creator.id)));

      await tx.delete(products).where(and(eq(products.id, product.id), eq(products.creatorId, creator.id)));
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'product.delete', entityType: 'product', entityId: product.id, before: { title: product.title, type: product.type, status: product.status }, after: { deleted: true } });
      return {
        r2Keys: [...new Set([product.coverKey, ...files.filter((file) => !file.assetId).map((file) => file.r2Key), ...resources.map((resource) => resource.r2Key)].filter((key): key is string => Boolean(key)))],
        bunnyVideoIds: [...new Set(courseLessons.map((lesson) => lesson.bunnyVideoId).filter((id): id is string => Boolean(id)))],
      };
    });

    const cleanupResults = await Promise.allSettled([
      ...(cleanup.r2Keys.length ? [Promise.all(cleanup.r2Keys.map(async (key) => {
        const { bucket } = getR2Config();
        await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      }))] : []),
      ...(cleanup.bunnyVideoIds.length ? [Promise.all(cleanup.bunnyVideoIds.map(async (videoId) => {
        const { libraryId } = bunnyStreamConfig();
        const response = await bunnyRequest(`/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) throw new Error(`Bunny Stream cleanup failed (${response.status}).`);
      }))] : []),
    ]);
    const cleanupPending = cleanupResults.some((result) => result.status === 'rejected');
    if (cleanupPending) console.error('Deleted draft left hosted media for provider cleanup', { productId, cleanupFailures: cleanupResults.filter((result) => result.status === 'rejected').length });
    return NextResponse.json({ deleted: true, cleanupPending });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'PRODUCT_NOT_FOUND') return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
    if (['PRODUCT_NOT_DRAFT', 'PRODUCT_HAS_HISTORY', 'PRODUCT_IN_PUBLISHED_BUNDLE'].includes(code)) return NextResponse.json({ error: error instanceof Error ? error.message : 'This offer cannot be deleted.' }, { status: 409 });
    console.error('Draft product deletion failed', error);
    return NextResponse.json({ error: 'The draft could not be deleted. Try again.' }, { status: 503 });
  }
}

async function hasReadyDownloadDelivery(product: typeof products.$inferSelect, creatorId: string) {
  if (product.downloadDeliveryMode === 'external_link') return validateExternalDownloadUrl(product.downloadExternalUrl) !== null;
  const [file] = await getDatabase().select({ id: productFiles.id }).from(productFiles).where(and(
    eq(productFiles.productId, product.id), eq(productFiles.creatorId, creatorId), eq(productFiles.status, 'ready'),
  )).limit(1);
  return Boolean(file);
}

async function coursePublishError(productId: string, creatorId: string) {
  const db = getDatabase();
  const rows = await db.select({ lesson: lessons, moduleStatus: courseSections.status }).from(lessons).innerJoin(courseSections, eq(lessons.sectionId, courseSections.id)).where(and(
    eq(courseSections.productId, productId), eq(courseSections.creatorId, creatorId), eq(lessons.creatorId, creatorId), isNull(lessons.deletedAt),
  )).orderBy(asc(lessons.position));
  const visibleRows = rows.filter(({ moduleStatus }) => moduleStatus === 'published');
  const quizRows = visibleRows.filter(({ lesson }) => lesson.type === 'quiz');
  const quizzes = quizRows.length ? await db.select().from(courseQuizzes).where(and(inArray(courseQuizzes.lessonId, quizRows.map(({ lesson }) => lesson.id)), eq(courseQuizzes.creatorId, creatorId))) : [];
  for (const quiz of quizzes) {
    const error = validateQuizConfig({ questions: quiz.questions as any, passingScore: quiz.passingScore, maxAttempts: quiz.maxAttempts, revealCorrectAnswers: quiz.revealCorrectAnswers, version: quiz.version });
    if (error) return error;
  }
  return validateCoursePublishReadiness(visibleRows.map(({ lesson }) => ({
    title: lesson.title, type: lesson.type, status: lesson.status, isFreePreview: lesson.isFreePreview,
    text: lesson.content && typeof lesson.content === 'object' && 'text' in lesson.content ? String(lesson.content.text ?? '') : '',
    videoUrl: lesson.content && typeof lesson.content === 'object' && 'videoUrl' in lesson.content ? String(lesson.content.videoUrl ?? '') : '',
    videoSource: lesson.bunnyVideoId || (lesson.content && typeof lesson.content === 'object' && 'videoSource' in lesson.content && lesson.content.videoSource === 'hosted') ? 'hosted' : 'external',
    bunnyVideoId: lesson.bunnyVideoId, videoStatus: lesson.videoStatus,
    quiz: quizzes.find((quiz) => quiz.lessonId === lesson.id),
  })));
}

async function bundlePublishError(bundle: typeof products.$inferSelect, creatorId: string) {
  const db = getDatabase();
  const items = await db.select({ productId: bundleProductItems.includedProductId }).from(bundleProductItems).where(eq(bundleProductItems.bundleProductId, bundle.id)).orderBy(asc(bundleProductItems.position));
  const ids = items.map((item) => item.productId);
  const candidates = ids.length ? await db.select().from(products).where(inArray(products.id, ids)) : [];
  const readyFiles = ids.length ? await db.select({ productId: productFiles.productId }).from(productFiles).where(and(inArray(productFiles.productId, ids), eq(productFiles.creatorId, creatorId), eq(productFiles.status, 'ready'))) : [];
  const downloads = candidates.filter((product) => product.type === 'download' && product.downloadDeliveryMode === 'external_link' && validateExternalDownloadUrl(product.downloadExternalUrl)).map((product) => product.id);
  const courseRows = ids.length ? await db.select({ productId: courseSections.productId }).from(courseSections).innerJoin(lessons, eq(lessons.sectionId, courseSections.id)).where(and(inArray(courseSections.productId, ids), eq(courseSections.creatorId, creatorId), eq(courseSections.status, 'published'), eq(lessons.creatorId, creatorId), eq(lessons.status, 'published'), isNull(lessons.deletedAt))) : [];
  const readyDownloads = new Set([...readyFiles.map((file) => file.productId), ...downloads]);
  const readyCourses = new Set(courseRows.map((row) => row.productId));
  const checked = candidates.map((product) => ({ ...product, creatorId: product.creatorId, deliveryReady: readyDownloads.has(product.id), courseReady: readyCourses.has(product.id) }));
  return validateBundleComposition({ bundleProductId: bundle.id, creatorId, currency: bundle.currency, selectedIds: ids, products: checked });
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { productId } = await params;
    const db = getDatabase();
    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).limit(1);
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const [lesson] = product.type === 'course' ? await db.select({ content: lessons.content }).from(lessons).innerJoin(courseSections, eq(lessons.sectionId, courseSections.id)).where(eq(courseSections.productId, productId)).orderBy(lessons.position).limit(1) : [];
    const description = normalizeProductDescription(product.description);
    const lessonText = lesson?.content && typeof lesson.content === 'object' && 'text' in lesson.content ? String(lesson.content.text ?? '') : '';
    return NextResponse.json({ product: { ...product, creatorSlug: creator.slug, coverUrl: getCreatorLogoUrl(product.coverKey), description, descriptionContent: productDescriptionContent(product.description), priceMinor: product.priceMinor.toString(), minAmountMinor: product.minAmountMinor?.toString() ?? null, initialLesson: lessonText } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Product could not be loaded for editing', error);
    return NextResponse.json({ error: 'Product could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const parsed = productInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your product details.' }, { status: 400 });
    const input = parsed.data;
    const db = getDatabase();
    const [current] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).limit(1);
    if (!current) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    if (input.type !== current.type) return NextResponse.json({ error: 'A product’s format cannot be changed after it is created.' }, { status: 422 });
    if (input.status === 'published' && current.status !== 'published' && input.type !== 'payment_link' && !input.contentAttested) {
      return NextResponse.json({ error: 'Confirm you have the right to sell this content before publishing.' }, { status: 400 });
    }
    const deliveryMode = current.type === 'download' ? (input.deliveryMode ?? current.downloadDeliveryMode) : current.downloadDeliveryMode;
    const externalUrlInput = input.externalUrl === undefined ? current.downloadExternalUrl : input.externalUrl;
    const externalUrl = current.type === 'download'
      ? deliveryMode === 'external_link' && externalUrlInput
        ? validateExternalDownloadUrl(externalUrlInput)
        : null
      : current.downloadExternalUrl;
    if (current.type === 'download' && deliveryMode === 'external_link' && externalUrlInput && !externalUrl) {
      return NextResponse.json({ error: 'Enter a valid HTTPS link without a username or password.' }, { status: 400 });
    }
    if (current.type === 'download' && input.status === 'published' && deliveryMode === 'external_link' && !externalUrl) {
      return NextResponse.json({ error: 'Enter a valid HTTPS delivery link before publishing.' }, { status: 400 });
    }
    if (current.type === 'download' && input.status === 'published' && deliveryMode === 'uploaded_files' && !input.thankYou?.message.trim()) {
      return NextResponse.json({ error: 'Add a confirmation message buyers will see after purchase.' }, { status: 400 });
    }
    if (current.type !== 'bundle' && (input.status !== 'published' || input.currency !== current.currency)) {
      const [publishedBundle] = await db.select({ id: products.id, title: products.title }).from(bundleProductItems).innerJoin(products, eq(bundleProductItems.bundleProductId, products.id)).where(and(eq(bundleProductItems.includedProductId, productId), eq(products.status, 'published'))).limit(1);
      if (publishedBundle) return NextResponse.json({ error: `Unpublish “${publishedBundle.title}” and remove this product before changing its visibility or currency.` }, { status: 409 });
    }
    const targetSlug = input.slug ?? current.slug;
    const [slugOwner] = await db.select({ id: products.id }).from(products).where(and(eq(products.creatorId, creator.id), eq(products.slug, targetSlug))).limit(1);
    if (slugOwner && slugOwner.id !== productId) return NextResponse.json({ error: 'You already have a product with that address.' }, { status: 409 });
    if (input.status === 'published' && current.type === 'download') {
      const deliveryReady = deliveryMode === 'external_link'
        ? Boolean(externalUrl)
        : await hasReadyDownloadDelivery({ ...current, downloadDeliveryMode: 'uploaded_files' }, creator.id);
      if (!deliveryReady) return NextResponse.json({ error: 'Add at least one ready private file or enter a valid HTTPS delivery link before publishing.' }, { status: 409 });
    }
    if (input.status === 'published' && current.type === 'course') {
      const error = await coursePublishError(productId, creator.id);
      if (error) return NextResponse.json({ error }, { status: 409 });
    }
    if (input.status === 'published' && current.type === 'bundle') {
      const error = await bundlePublishError({ ...current, currency: input.currency }, creator.id);
      if (error) return NextResponse.json({ error }, { status: 409 });
    }
    const entitlements = input.status === 'published' && current.status !== 'published' ? await getAccountEntitlements(session.user.id) : null;
    const updated = await db.transaction(async (tx) => {
      if (input.status === 'published' && current.status !== 'published' && entitlements?.maxPublishedOffers !== null && entitlements?.maxPublishedOffers !== undefined) {
        await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creator.id)).for('update');
        const [publishedCount] = await tx.select({ total: count() }).from(products).where(and(eq(products.creatorId, creator.id), eq(products.status, 'published')));
        if ((publishedCount?.total ?? 0) >= entitlements.maxPublishedOffers) throw Object.assign(new Error('PLAN_LIMIT'), { code: 'PLAN_LIMIT' });
      }
      const [row] = await tx.update(products).set({
        title: input.title, slug: targetSlug, description: serializeProductDescription(input.description),
        priceMinor: input.priceMinor, currency: input.currency, currencyOptions: input.currencyOptions, amountType: current.type === 'payment_link' ? input.amountType : 'fixed',
        minAmountMinor: current.type === 'payment_link' && input.amountType === 'customer_chooses' ? input.minAmountMinor ?? 10_000n : null,
        maxSales: input.maxSales ?? null, refundWindowDays: input.refundWindowDays, status: input.status,
        thankYou: input.thankYou ?? current.thankYou,
        ...(current.type === 'download' ? { downloadDeliveryMode: deliveryMode, downloadExternalUrl: externalUrl } : {}),
        updatedAt: new Date(),
      }).where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).returning();
      if (!row) throw new Error('Product could not be updated.');
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'product.update', entityType: 'product', entityId: productId, before: { title: current.title, slug: current.slug, status: current.status }, after: { title: input.title, slug: targetSlug, status: input.status } });
      return row;
    });
    return NextResponse.json({ product: { ...updated, creatorSlug: creator.slug, description: normalizeProductDescription(updated.description), priceMinor: updated.priceMinor.toString(), minAmountMinor: updated.minAmountMinor?.toString() ?? null } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (typeof error === 'object' && error && 'code' in error && error.code === 'PLAN_LIMIT') return NextResponse.json({ error: 'Your plan limit has been reached.', code: 'PLAN_LIMIT' }, { status: 402 });
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'You already have a product with that address.' }, { status: 409 });
    console.error('Product update failed', error);
    return NextResponse.json({ error: 'Product changes could not be saved.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const body = await request.json().catch(() => null);
    const status = body?.status;
    if (status !== 'draft' && status !== 'published' && status !== 'archived') {
      return NextResponse.json({ error: 'Choose a valid offer status.' }, { status: 400 });
    }

    const db = getDatabase();
    const [product] = await db.select().from(products)
      .where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).limit(1);
    if (!product) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
    if (status === 'published' && product.status !== 'published' && product.type !== 'payment_link' && body?.contentAttested !== true) {
      return NextResponse.json({ error: 'Confirm you have the right to sell this content before publishing.' }, { status: 400 });
    }
    if (product.type !== 'bundle' && status !== 'published') {
      const [publishedBundle] = await db.select({ id: products.id, title: products.title }).from(bundleProductItems).innerJoin(products, eq(bundleProductItems.bundleProductId, products.id)).where(and(eq(bundleProductItems.includedProductId, productId), eq(products.status, 'published'))).limit(1);
      if (publishedBundle) return NextResponse.json({ error: `Unpublish “${publishedBundle.title}” and remove this product before changing its visibility.` }, { status: 409 });
    }

    const entitlements = status === 'published' && product.status !== 'published'
      ? await getAccountEntitlements(session.user.id)
      : null;
    if (status === 'published' && product.type === 'download') {
      const thankYou = product.thankYou as { message?: unknown } | null;
      if (product.downloadDeliveryMode === 'uploaded_files' && (typeof thankYou?.message !== 'string' || !thankYou.message.trim())) return NextResponse.json({ error: 'Add a confirmation message buyers will see after purchase.' }, { status: 409 });
      if (!await hasReadyDownloadDelivery(product, creator.id)) return NextResponse.json({ error: 'Add a ready private file or save a valid HTTPS delivery link before publishing.' }, { status: 409 });
    }
    if (status === 'published' && product.type === 'course') {
      const error = await coursePublishError(productId, creator.id);
      if (error) return NextResponse.json({ error }, { status: 409 });
    }
    if (status === 'published' && product.type === 'bundle') {
      const error = await bundlePublishError(product, creator.id);
      if (error) return NextResponse.json({ error }, { status: 409 });
    }

    const updated = await db.transaction(async (tx) => {
      if (status === 'published' && product.status !== 'published' && entitlements?.maxPublishedOffers !== null && entitlements?.maxPublishedOffers !== undefined) {
        // Serializes publish attempts within this workspace, so parallel requests cannot overrun the free limit.
        await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creator.id)).for('update');
        const [publishedCount] = await tx.select({ total: count() }).from(products)
          .where(and(eq(products.creatorId, creator.id), eq(products.status, 'published')));
        const total = publishedCount?.total ?? 0;
        if (total >= entitlements.maxPublishedOffers) throw Object.assign(new Error('PLAN_LIMIT'), { code: 'PLAN_LIMIT' });
      }
      const [row] = await tx.update(products).set({ status, updatedAt: new Date() })
        .where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).returning();
      if (!row) throw new Error('Offer not found.');
      await tx.insert(auditLogs).values({
        actorUserId: session.user.id, action: 'product.status', entityType: 'product', entityId: productId,
        before: { status: product.status }, after: { status },
      });
      return row;
    });
    return NextResponse.json({ product: updated });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (typeof error === 'object' && error && 'code' in error && error.code === 'PLAN_LIMIT') {
      return NextResponse.json({ error: 'Your Free plan includes 5 published offers. Upgrade to publish more.', code: 'PLAN_LIMIT', feature: 'unlimited_products' }, { status: 402 });
    }
    console.error('Product status update failed', error);
    return NextResponse.json({ error: 'Offer status could not be updated.' }, { status: 503 });
  }
}
