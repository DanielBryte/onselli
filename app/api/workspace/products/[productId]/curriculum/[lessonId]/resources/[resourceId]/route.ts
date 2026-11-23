import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, courseSections, lessonAttachments, lessons } from '@/src/server/db/schema';
import { getR2Client, getR2Config } from '@/lib/storage/r2';

export const runtime = 'nodejs';

export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string; lessonId: string; resourceId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId, lessonId, resourceId } = await params;
    const db = getDatabase();
    const [row] = await db.select({ resource: lessonAttachments }).from(lessonAttachments)
      .innerJoin(lessons, eq(lessonAttachments.lessonId, lessons.id)).innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
      .where(and(eq(lessonAttachments.id, resourceId), eq(lessonAttachments.creatorId, creator.id), eq(lessonAttachments.lessonId, lessonId), eq(lessons.creatorId, creator.id), eq(courseSections.productId, productId), eq(courseSections.creatorId, creator.id))).limit(1);
    if (!row) return NextResponse.json({ error: 'Lesson resource not found.' }, { status: 404 });
    try { const { bucket } = getR2Config(); await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: row.resource.r2Key })); }
    catch { return NextResponse.json({ error: 'The private file could not be removed. Try again.' }, { status: 503 }); }
    await db.delete(lessonAttachments).where(and(eq(lessonAttachments.id, resourceId), eq(lessonAttachments.creatorId, creator.id), eq(lessonAttachments.lessonId, lessonId)));
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'course.lesson_resource.removed', entityType: 'lesson_attachment', entityId: resourceId, after: { productId, lessonId, name: row.resource.name } });
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Course lesson resource removal failed', error);
    return NextResponse.json({ error: 'Could not remove this lesson resource.' }, { status: 503 });
  }
}
