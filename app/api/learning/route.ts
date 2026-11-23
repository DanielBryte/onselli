import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { courseSections, creators, entitlements, lessonProgress, lessons, orders, productFiles, products } from '@/src/server/db/schema';
import { getDeliverableProductFiles } from '@/lib/storage/product-file-rules.mjs';
import { getAuthorizedExternalDownload } from '@/lib/storage/external-download.mjs';
import { summarizeCourseProgress } from '@/lib/courses/learner-progress.mjs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 }); const db = getDatabase();
    const entitlementOwner = principal.userId ? eq(entitlements.userId, principal.userId) : eq(entitlements.guestBuyerId, principal.guestBuyerId!);
    const orderOwner = principal.userId ? eq(orders.buyerUserId, principal.userId) : eq(orders.guestBuyerId, principal.guestBuyerId!);
    const rights = await db.select({ entitlement: entitlements, product: products, creator: creators, order: orders })
      .from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).innerJoin(creators, eq(entitlements.creatorId, creators.id)).innerJoin(orders, eq(entitlements.orderId, orders.id))
      .where(and(entitlementOwner, eq(entitlements.status, 'active'), inArray(products.type, ['course', 'download']), eq(orders.status, 'paid'), orderOwner)).orderBy(asc(entitlements.grantedAt));
    const productIds = rights.map(({ product }) => product.id);
    if (!productIds.length) return NextResponse.json({ items: [] });
    const fileRows = await db.select().from(productFiles).where(and(inArray(productFiles.productId, productIds), eq(productFiles.status, 'ready'))).orderBy(asc(productFiles.position), asc(productFiles.createdAt));
    const lessonRows = await db.select({ lesson: lessons, productId: courseSections.productId }).from(lessons)
      .innerJoin(courseSections, and(eq(lessons.sectionId, courseSections.id), eq(lessons.creatorId, courseSections.creatorId)))
      .innerJoin(products, and(eq(products.id, courseSections.productId), eq(products.creatorId, courseSections.creatorId)))
      .where(and(inArray(courseSections.productId, productIds), eq(products.type, 'course'), eq(courseSections.status, 'published'), eq(lessons.status, 'published'), isNull(lessons.deletedAt))).orderBy(asc(lessons.position));
    const allLessonIds = lessonRows.map(({ lesson }) => lesson.id);
    const progressRows = allLessonIds.length ? await db.select().from(lessonProgress).where(and(principal.userId ? eq(lessonProgress.userId, principal.userId) : eq(lessonProgress.guestBuyerId, principal.guestBuyerId!), inArray(lessonProgress.lessonId, allLessonIds))) : [];
    const items = rights.map(({ entitlement, product, creator, order }) => {
      const description = product.description && typeof product.description === 'object' && 'text' in product.description ? String(product.description.text ?? '') : '';
      const productLessons = lessonRows.filter((row) => row.productId === product.id).map(({ lesson }) => ({ id: lesson.id, title: lesson.title, content: lesson.content, type: lesson.type, durationSeconds: lesson.durationSeconds }));
      const courseProgress = product.type === 'course' ? summarizeCourseProgress(productLessons, progressRows.filter((row) => productLessons.some((lesson) => lesson.id === row.lessonId))) : null;
      const deliverableFiles = getDeliverableProductFiles(fileRows, { creatorId: creator.id, productId: product.id });
      const externalUrl = getAuthorizedExternalDownload({ product, entitlement, order, userId: principal.userId ?? '', guestBuyerId: principal.guestBuyerId ?? '' });
      const isExternalDownload = product.type === 'download' && product.downloadDeliveryMode === 'external_link';
      return { id: product.id, title: product.title, kind: product.type, content_body: productLessons.map((lesson) => lesson.content && typeof lesson.content === 'object' && 'text' in lesson.content ? String(lesson.content.text ?? '') : '').filter(Boolean).join('\n\n'), lessons: productLessons, courseProgress, files: isExternalDownload ? [] : deliverableFiles.map((file) => ({ id: file.id, file_name: file.name, size_bytes: file.sizeBytes.toString() })), deliveryMode: product.type === 'download' ? product.downloadDeliveryMode : null, externalUrl, creator: { display_name: creator.displayName, slug: creator.slug }, order: { id: order.id, amount: order.totalMinor.toString(), currency: order.currency }, entitlementId: entitlement.id, description };
    });
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('Learning library failed', error); return NextResponse.json({ error: 'Could not load your library.' }, { status: 503 }); }
}
