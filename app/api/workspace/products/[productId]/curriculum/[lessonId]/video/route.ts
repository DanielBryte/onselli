import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, courseSections, lessons, products } from '@/src/server/db/schema';
import { canManageHostedVideo, nextBunnyVideoStatus, signBunnyTusUpload, validateHostedVideoUpload } from '@/lib/courses/bunny-stream.mjs';
import { bunnyRequest, bunnyStreamConfig } from '@/src/server/courses/bunny-stream';

export const runtime = 'nodejs';
const paramsSchema = z.object({ productId: z.string().uuid(), lessonId: z.string().uuid() });
const uploadSchema = z.object({ name: z.string(), contentType: z.string(), sizeBytes: z.number() }).strict();

async function ownedLesson(productId: string, lessonId: string, creatorId: string) {
  const [row] = await getDatabase().select({ product: products, lesson: lessons }).from(lessons)
    .innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
    .innerJoin(products, eq(courseSections.productId, products.id))
    .where(and(eq(products.id, productId), eq(products.creatorId, creatorId), eq(courseSections.creatorId, creatorId), eq(lessons.id, lessonId), eq(lessons.creatorId, creatorId)))
    .limit(1);
  if (!row || !canManageHostedVideo({ ...row, creatorId, productId, lessonId })) return null;
  return row;
}

export async function POST(request: Request, { params }: { params: Promise<{ productId: string; lessonId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) return NextResponse.json({ error: 'Course lesson not found.' }, { status: 404 });
    const { productId, lessonId } = parsedParams.data;
    const owned = await ownedLesson(productId, lessonId, creator.id);
    if (!owned) return NextResponse.json({ error: 'Course lesson not found.' }, { status: 404 });
    if (owned.lesson.bunnyVideoId) return NextResponse.json({ error: 'Remove the current hosted video before replacing it.' }, { status: 409 });
    const body = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: 'Choose a valid video file.' }, { status: 400 });
    const invalid = validateHostedVideoUpload(body.data);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const { libraryId } = bunnyStreamConfig();
    const title = `${owned.lesson.title} · ${body.data.name.replace(/[\r\n]/g, ' ').slice(0, 180)}`;
    const create = await bunnyRequest(`/library/${encodeURIComponent(libraryId)}/videos`, { method: 'POST', body: JSON.stringify({ title }) });
    if (!create.ok) {
      console.error('Bunny Stream video creation failed', { status: create.status });
      return NextResponse.json({ error: 'Video upload could not be prepared. Try again shortly.' }, { status: 502 });
    }
    const payload = await create.json().catch(() => null) as { guid?: unknown } | null;
    if (typeof payload?.guid !== 'string' || !/^[a-f0-9-]{20,}$/i.test(payload.guid)) return NextResponse.json({ error: 'The video provider returned an invalid upload.' }, { status: 502 });
    const expires = Math.floor(Date.now() / 1000) + 60 * 60;
    const credentials = signBunnyTusUpload({ libraryId, apiKey: process.env.BUNNY_STREAM_API_KEY!.trim(), videoId: payload.guid, expires });
    try {
      const db = getDatabase();
      const [updated] = await db.update(lessons).set({ bunnyVideoId: payload.guid, videoStatus: 'uploading', updatedAt: new Date() })
        .where(and(eq(lessons.id, lessonId), eq(lessons.creatorId, creator.id), isNull(lessons.bunnyVideoId))).returning({ id: lessons.id });
      if (!updated) {
        await bunnyRequest(`/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(payload.guid)}`, { method: 'DELETE' }).catch(() => undefined);
        return NextResponse.json({ error: 'A video was just added to this lesson. Refresh and try again.' }, { status: 409 });
      }
      await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'course.lesson_video.upload_started', entityType: 'lesson', entityId: lessonId, after: { productId, provider: 'bunny_stream' } });
    } catch (error) {
      await bunnyRequest(`/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(payload.guid)}`, { method: 'DELETE' }).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ ...credentials, endpoint: 'https://video.bunnycdn.com/tusupload', maxBytes: 5 * 1024 * 1024 * 1024 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Hosted course video upload preparation failed', error);
    const message = error instanceof Error && error.message.startsWith('Bunny Stream is not configured') ? error.message : 'Video upload could not be prepared. Check provider configuration and try again.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; lessonId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) return NextResponse.json({ error: 'Course lesson not found.' }, { status: 404 });
    const { productId, lessonId } = parsed.data;
    const owned = await ownedLesson(productId, lessonId, creator.id);
    if (!owned) return NextResponse.json({ error: 'Course lesson not found.' }, { status: 404 });
    if (!owned.lesson.bunnyVideoId) return NextResponse.json({ error: 'No hosted video is attached to this lesson.' }, { status: 404 });
    const { libraryId } = bunnyStreamConfig();
    const response = await bunnyRequest(`/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(owned.lesson.bunnyVideoId)}`);
    if (!response.ok) return NextResponse.json({ error: 'Video status is temporarily unavailable.' }, { status: 502 });
    const payload = await response.json().catch(() => null) as { status?: unknown } | null;
    const status = typeof payload?.status === 'number' ? nextBunnyVideoStatus(owned.lesson.videoStatus as 'uploading' | 'processing' | 'ready' | 'failed' | null, payload.status) : null;
    if (!status) return NextResponse.json({ error: 'The video provider returned an unknown processing state.' }, { status: 502 });
    await getDatabase().update(lessons).set({ videoStatus: status, updatedAt: new Date() }).where(and(eq(lessons.id, lessonId), eq(lessons.creatorId, creator.id), eq(lessons.bunnyVideoId, owned.lesson.bunnyVideoId)));
    return NextResponse.json({ status }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Hosted course video status refresh failed', error);
    return NextResponse.json({ error: 'Video status could not be refreshed.' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ productId: string; lessonId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) return NextResponse.json({ error: 'Course lesson not found.' }, { status: 404 });
    const { productId, lessonId } = parsed.data;
    const owned = await ownedLesson(productId, lessonId, creator.id);
    if (!owned) return NextResponse.json({ error: 'Course lesson not found.' }, { status: 404 });
    if (owned.lesson.bunnyVideoId) {
      const { libraryId } = bunnyStreamConfig();
      const response = await bunnyRequest(`/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(owned.lesson.bunnyVideoId)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) return NextResponse.json({ error: 'The hosted video could not be removed. Try again.' }, { status: 502 });
    }
    await getDatabase().update(lessons).set({ bunnyVideoId: null, videoStatus: null, updatedAt: new Date() }).where(and(eq(lessons.id, lessonId), eq(lessons.creatorId, creator.id)));
    await getDatabase().insert(auditLogs).values({ actorUserId: session.user.id, action: 'course.lesson_video.removed', entityType: 'lesson', entityId: lessonId, after: { productId, provider: 'bunny_stream' } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Hosted course video removal failed', error);
    return NextResponse.json({ error: 'The hosted video could not be removed.' }, { status: 503 });
  }
}
