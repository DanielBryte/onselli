import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { lessonProgress, quizAttempts } from '@/src/server/db/schema';
import { canAccessQuizAttempt, gradeQuiz, quizForLearner } from '@/lib/courses/quizzes.mjs';
import { getEntitledQuiz } from '../../_access';

export const runtime = 'nodejs';
type Params = { params: Promise<{ productId: string; lessonId: string; attemptId: string }> };
const submission = z.object({ answers: z.record(z.string(), z.string().min(1).max(80)) }).strict();

async function loadAttempt(productId: string, lessonId: string, attemptId: string, principal: { userId: string | null; guestBuyerId: string | null }) {
  const access = await getEntitledQuiz(productId, lessonId, principal);
  if (!access) return null;
  const owner = principal.userId ? eq(quizAttempts.userId, principal.userId) : eq(quizAttempts.guestBuyerId, principal.guestBuyerId!);
  const [attempt] = await getDatabase().select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.quizId, access.quiz.id), owner, eq(quizAttempts.creatorId, access.product.creatorId))).limit(1);
  if (!attempt || !canAccessQuizAttempt({ ...access, userId: principal.userId ?? undefined, guestBuyerId: principal.guestBuyerId ?? undefined, attempt })) return null;
  return { access, attempt };
}

function attemptPayload(attempt: typeof quizAttempts.$inferSelect) {
  const snapshot = attempt.quizSnapshot as any;
  return { id: attempt.id, status: attempt.status, quiz: quizForLearner(snapshot, { submitted: attempt.status === 'submitted' }), answers: attempt.answers, ...(attempt.status === 'submitted' ? { score: attempt.score, passed: attempt.passed, ...(snapshot.revealCorrectAnswers ? { correctCount: Object.entries(attempt.answers as Record<string, string>).filter(([questionId, answerId]) => snapshot.questions.some((question: any) => question.id === questionId && question.correctOptionId === answerId)).length, totalCount: snapshot.questions.length } : {}), submittedAt: attempt.submittedAt } : {}) };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 }); const { productId, lessonId, attemptId } = await params;
    const loaded = await loadAttempt(productId, lessonId, attemptId, principal);
    if (!loaded) return NextResponse.json({ error: 'Quiz attempt not found.' }, { status: 404 });
    return NextResponse.json({ attempt: attemptPayload(loaded.attempt) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Quiz attempt could not be loaded', error); return NextResponse.json({ error: 'This attempt could not be loaded.' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 }); const { productId, lessonId, attemptId } = await params;
    const parsed = submission.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Submit one answer for every question.' }, { status: 400 });
    const loaded = await loadAttempt(productId, lessonId, attemptId, principal);
    if (!loaded) return NextResponse.json({ error: 'Quiz attempt not found.' }, { status: 404 });
    const attempt = loaded.attempt;
    if (attempt.status === 'submitted') return NextResponse.json({ attempt: attemptPayload(attempt) }, { headers: { 'Cache-Control': 'private, no-store' } });
    const snapshot = attempt.quizSnapshot as any;
    const graded = gradeQuiz(snapshot, parsed.data.answers);
    if (graded.error) return NextResponse.json({ error: graded.error }, { status: 400 });
    const db = getDatabase();
    const result = await db.transaction(async (tx) => {
      const owner = principal.userId ? eq(quizAttempts.userId, principal.userId) : eq(quizAttempts.guestBuyerId, principal.guestBuyerId!);
      const [locked] = await tx.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), owner)).for('update');
      if (!locked) throw new Error('Attempt not found.');
      if (locked.status === 'submitted') return locked;
      const [saved] = await tx.update(quizAttempts).set({ answers: parsed.data.answers, score: graded.score, passed: graded.passed, status: 'submitted', submittedAt: new Date(), updatedAt: new Date() }).where(and(eq(quizAttempts.id, attemptId), owner, eq(quizAttempts.status, 'in_progress'))).returning();
      if (!saved) throw new Error('Attempt could not be submitted.');
      if (graded.passed) await tx.insert(lessonProgress).values({ userId: principal.userId, guestBuyerId: principal.guestBuyerId, creatorId: loaded.access.product.creatorId, lessonId: loaded.access.lesson.id, completedAt: new Date(), lastPositionSeconds: 0 }).onConflictDoUpdate({ target: [principal.userId ? lessonProgress.userId : lessonProgress.guestBuyerId, lessonProgress.lessonId], targetWhere: principal.userId ? isNotNull(lessonProgress.userId) : isNotNull(lessonProgress.guestBuyerId), set: { completedAt: sql`coalesce(${lessonProgress.completedAt}, now())`, updatedAt: new Date() } });
      return saved;
    });
    return NextResponse.json({ attempt: attemptPayload(result) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Quiz attempt submission failed', error); return NextResponse.json({ error: 'Your quiz could not be submitted. Please try again.' }, { status: 503 });
  }
}
