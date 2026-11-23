import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { courseSections, entitlements, lessonAttachments, lessons, orders, products } from '@/src/server/db/schema';
import { getR2Client, getR2Config } from '@/lib/storage/r2';
import { canAccessLessonResource } from '@/lib/courses/curriculum-rules.mjs';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; resourceId: string }> }) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 });
    const entitlementOwner = principal.userId ? eq(entitlements.userId, principal.userId) : eq(entitlements.guestBuyerId, principal.guestBuyerId!);
    const orderOwner = principal.userId ? eq(orders.buyerUserId, principal.userId) : eq(orders.guestBuyerId, principal.guestBuyerId!);
    const { productId, resourceId } = await params;
    const db = getDatabase();
    const [access] = await db.select({ resource: lessonAttachments, lesson: lessons, product: products, entitlement: entitlements, order: orders })
      .from(lessonAttachments).innerJoin(lessons, eq(lessonAttachments.lessonId, lessons.id))
      .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id)).innerJoin(products, eq(courseSections.productId, products.id))
      .innerJoin(entitlements, and(eq(entitlements.productId, products.id), eq(entitlements.creatorId, products.creatorId)))
      .innerJoin(orders, eq(entitlements.orderId, orders.id))
      .where(and(eq(products.id, productId), eq(products.type, 'course'), eq(products.status, 'published'), eq(courseSections.creatorId, products.creatorId), eq(lessons.creatorId, products.creatorId), eq(lessonAttachments.creatorId, products.creatorId), eq(courseSections.status, 'published'), eq(lessonAttachments.id, resourceId), eq(lessonAttachments.status, 'ready'), eq(lessons.status, 'published'), entitlementOwner, eq(entitlements.status, 'active'), eq(orders.status, 'paid'), orderOwner)).limit(1);
    if (!access || !canAccessLessonResource({ ...access, userId: principal.userId ?? undefined, guestBuyerId: principal.guestBuyerId ?? undefined })) return NextResponse.json({ error: 'A completed purchase with active course access is required.' }, { status: 403 });
    const { bucket } = getR2Config();
    const safeName = access.resource.name.replace(/[\r\n"\\]/g, '_');
    const url = await getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: bucket, Key: access.resource.r2Key, ResponseContentType: 'application/octet-stream', ResponseContentDisposition: `attachment; filename="${safeName}"` }), { expiresIn: 180 });
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Course lesson resource access failed', error);
    return NextResponse.json({ error: 'This resource is temporarily unavailable.' }, { status: 503 });
  }
}
