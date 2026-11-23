import { randomUUID } from 'node:crypto';
import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, courseSections, lessonAttachments, lessons, products } from '@/src/server/db/schema';
import { DIGITAL_FILE_MAX_BYTES, DIGITAL_FILE_TYPES, getR2Client, getR2Config } from '@/lib/storage/r2';

export const runtime = 'nodejs';
const MAX_LESSON_RESOURCES = 20;

async function ownedLesson(productId: string, lessonId: string, creatorId: string) {
  const [row] = await getDatabase().select({ lesson: lessons }).from(lessons)
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .innerJoin(products, eq(courseSections.productId, products.id))
    .where(and(eq(products.id, productId), eq(products.creatorId, creatorId), eq(products.type, 'course'), eq(courseSections.creatorId, creatorId), eq(lessons.id, lessonId), eq(lessons.creatorId, creatorId)))
    .limit(1);
  return row?.lesson;
}

export async function POST(request: Request, { params }: { params: Promise<{ productId: string; lessonId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId, lessonId } = await params;
    if (!await ownedLesson(productId, lessonId, creator.id)) return NextResponse.json({ error: 'Course lesson not found.' }, { status: 404 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || body.name.length > 255 || !Number.isSafeInteger(body.sizeBytes)) return NextResponse.json({ error: 'Choose a valid resource file.' }, { status: 400 });
    const extension = body.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
    const contentType = DIGITAL_FILE_TYPES[extension];
    const name = body.name.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 180) ?? '';
    if (!name || !contentType) return NextResponse.json({ error: 'Use a supported document, archive, audio, or image file.' }, { status: 400 });
    if (body.sizeBytes < 1 || body.sizeBytes > DIGITAL_FILE_MAX_BYTES) return NextResponse.json({ error: 'Resources must be between 1 byte and 100 MB.' }, { status: 400 });

    const db = getDatabase();
    const result = await db.transaction(async (tx) => {
      const [lesson] = await tx.select({ id: lessons.id }).from(lessons).innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
        .where(and(eq(lessons.id, lessonId), eq(lessons.creatorId, creator.id), eq(courseSections.productId, productId), eq(courseSections.creatorId, creator.id))).for('update').limit(1);
      if (!lesson) return { error: 'Course lesson not found.', status: 404 as const };
      const [total] = await tx.select({ total: count() }).from(lessonAttachments).where(and(eq(lessonAttachments.lessonId, lessonId), eq(lessonAttachments.creatorId, creator.id)));
      if ((total?.total ?? 0) >= MAX_LESSON_RESOURCES) return { error: `A lesson can have up to ${MAX_LESSON_RESOURCES} resources.`, status: 409 as const };
      const key = `${creator.id}/${productId}/lessons/${lessonId}/${randomUUID()}${extension}`;
      const [resource] = await tx.insert(lessonAttachments).values({ creatorId: creator.id, lessonId, r2Key: key, name, contentType, sizeBytes: BigInt(body.sizeBytes), status: 'pending', position: total?.total ?? 0 }).returning({ id: lessonAttachments.id, r2Key: lessonAttachments.r2Key });
      if (!resource) throw new Error('Resource upload could not be prepared.');
      return resource;
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    try {
      const { bucket } = getR2Config();
      const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: bucket, Key: result.r2Key, ContentType: contentType }), { expiresIn: 600 });
      await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'course.lesson_resource.upload_started', entityType: 'lesson_attachment', entityId: result.id, after: { productId, lessonId, name, sizeBytes: body.sizeBytes } });
      return NextResponse.json({ resourceId: result.id, uploadUrl, contentType, expiresInSeconds: 600 });
    } catch {
      await db.delete(lessonAttachments).where(and(eq(lessonAttachments.id, result.id), eq(lessonAttachments.creatorId, creator.id), eq(lessonAttachments.lessonId, lessonId)));
      return NextResponse.json({ error: 'Could not prepare a secure upload. Check storage configuration and try again.' }, { status: 503 });
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Course lesson resource upload preparation failed', error);
    return NextResponse.json({ error: 'Could not prepare this resource upload.' }, { status: 503 });
  }
}
