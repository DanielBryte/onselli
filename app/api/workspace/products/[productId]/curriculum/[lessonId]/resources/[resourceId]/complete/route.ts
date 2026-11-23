import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, courseSections, lessonAttachments, lessons } from '@/src/server/db/schema';
import { DIGITAL_FILE_MAX_BYTES, getR2Client, getR2Config } from '@/lib/storage/r2';
import { validateProductFileCompletion } from '@/lib/storage/product-file-rules.mjs';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ productId: string; lessonId: string; resourceId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId, lessonId, resourceId } = await params;
    const db = getDatabase();
    const [resource] = await db.select({ resource: lessonAttachments }).from(lessonAttachments)
      .innerJoin(lessons, eq(lessonAttachments.lessonId, lessons.id)).innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
      .where(and(eq(lessonAttachments.id, resourceId), eq(lessonAttachments.creatorId, creator.id), eq(lessonAttachments.lessonId, lessonId), eq(lessons.creatorId, creator.id), eq(courseSections.productId, productId), eq(courseSections.creatorId, creator.id))).limit(1);
    if (!resource) return NextResponse.json({ error: 'Pending lesson resource not found.' }, { status: 404 });
    if (resource.resource.status === 'ready') return NextResponse.json({ ready: true });
    const { bucket } = getR2Config(); const client = getR2Client();
    let object;
    try { object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: resource.resource.r2Key })); }
    catch { return NextResponse.json({ error: 'The upload has not finished. Retry verification when it completes.' }, { status: 409 }); }
    const validationError = validateProductFileCompletion(resource.resource, {
      contentLength: object.ContentLength ?? 0, contentType: object.ContentType ?? '',
      signatureBytes: await client.send(new GetObjectCommand({ Bucket: bucket, Key: resource.resource.r2Key, Range: 'bytes=0-31' })).then(async (response) => response.Body?.transformToByteArray() ?? new Uint8Array()),
    }, DIGITAL_FILE_MAX_BYTES);
    if (validationError) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: resource.resource.r2Key })).catch(() => undefined);
      await db.delete(lessonAttachments).where(and(eq(lessonAttachments.id, resourceId), eq(lessonAttachments.creatorId, creator.id), eq(lessonAttachments.lessonId, lessonId)));
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    await db.update(lessonAttachments).set({ status: 'ready' }).where(and(eq(lessonAttachments.id, resourceId), eq(lessonAttachments.creatorId, creator.id), eq(lessonAttachments.lessonId, lessonId), eq(lessonAttachments.status, 'pending')));
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'course.lesson_resource.upload_completed', entityType: 'lesson_attachment', entityId: resourceId, after: { productId, lessonId, name: resource.resource.name } });
    return NextResponse.json({ ready: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Course lesson resource completion failed', error);
    return NextResponse.json({ error: 'Could not verify this lesson resource.' }, { status: 503 });
  }
}
