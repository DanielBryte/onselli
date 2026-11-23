import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { courseSections, entitlements, lessonProgress, lessons, orders, products } from '@/src/server/db/schema';
import { canUpdateLessonProgress, validateResumePosition } from '@/lib/courses/learner-progress.mjs';

export const runtime = 'nodejs';
const updateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('completion'), lessonId: z.string().uuid(), completed: z.boolean() }).strict(),
  z.object({ action: z.literal('position'), lessonId: z.string().uuid(), positionSeconds: z.number().int().min(0).max(86_400) }).strict(),
]);

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 });
    const entitlementOwner = principal.userId ? eq(entitlements.userId, principal.userId) : eq(entitlements.guestBuyerId, principal.guestBuyerId!);
    const orderOwner = principal.userId ? eq(orders.buyerUserId, principal.userId) : eq(orders.guestBuyerId, principal.guestBuyerId!);
    const { productId } = await params;
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Choose a valid lesson progress update.' }, { status: 400 });
    const body = parsed.data;
    const db = getDatabase();
    const [access] = await db.select({ entitlement: entitlements, order: orders, product: products, section: courseSections, lesson: lessons })
      .from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).innerJoin(orders, eq(entitlements.orderId, orders.id))
      .innerJoin(courseSections, and(eq(courseSections.productId, products.id), eq(courseSections.creatorId, products.creatorId)))
      .innerJoin(lessons, and(eq(lessons.sectionId, courseSections.id), eq(lessons.creatorId, products.creatorId)))
      .where(and(entitlementOwner, eq(entitlements.productId, productId), eq(entitlements.creatorId, products.creatorId), eq(entitlements.status, 'active'), eq(orders.status, 'paid'), orderOwner, eq(products.type, 'course'), eq(products.status, 'published'), eq(courseSections.status, 'published'), eq(lessons.id, body.lessonId), eq(lessons.status, 'published'), isNull(lessons.deletedAt))).limit(1);
    if (!access || !canUpdateLessonProgress({ userId: principal.userId ?? '', guestBuyerId: principal.guestBuyerId ?? '', ...access })) return NextResponse.json({ error: 'This lesson is not available in your learning library.' }, { status: 404 });
    if (body.action === 'completion' && access.lesson.type === 'quiz') return NextResponse.json({ error: 'Complete the quiz to update progress for this lesson.' }, { status: 400 });
    if (body.action === 'position' && (access.lesson.type !== 'video' || !access.lesson.bunnyVideoId || access.lesson.videoStatus !== 'ready')) return NextResponse.json({ error: 'Resume tracking is only available for ready hosted course videos.' }, { status: 400 });
    if (body.action === 'position' && !validateResumePosition(body.positionSeconds, access.lesson.durationSeconds)) return NextResponse.json({ error: 'The playback position is outside this lesson.' }, { status: 400 });
    const now = new Date();
    const [saved] = await db.insert(lessonProgress).values({
      userId: principal.userId, guestBuyerId: principal.guestBuyerId, creatorId: access.lesson.creatorId, lessonId: access.lesson.id,
      completedAt: body.action === 'completion' && body.completed ? now : null,
      lastPositionSeconds: body.action === 'position' ? body.positionSeconds : 0,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [principal.userId ? lessonProgress.userId : lessonProgress.guestBuyerId, lessonProgress.lessonId], targetWhere: principal.userId ? isNotNull(lessonProgress.userId) : isNotNull(lessonProgress.guestBuyerId),
      set: body.action === 'completion'
        ? { completedAt: body.completed ? sql`coalesce(${lessonProgress.completedAt}, ${now})` : null, updatedAt: now }
        : { lastPositionSeconds: body.positionSeconds, updatedAt: now },
    }).returning({ completedAt: lessonProgress.completedAt, lastPositionSeconds: lessonProgress.lastPositionSeconds });
    return NextResponse.json({ lessonId: access.lesson.id, completed: Boolean(saved?.completedAt), positionSeconds: saved?.lastPositionSeconds ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Course progress update failed', error);
    return NextResponse.json({ error: 'Lesson progress could not be saved.' }, { status: 503 });
  }
}
