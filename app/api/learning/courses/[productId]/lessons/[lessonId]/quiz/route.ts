import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { courseQuizzes, quizAttempts } from '@/src/server/db/schema';
import { attemptsRemaining, quizForLearner, snapshotQuiz } from '@/lib/courses/quizzes.mjs';
import { getEntitledQuiz } from './_access';

export const runtime = 'nodejs';
type Params = { params: Promise<{ productId: string; lessonId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 }); const { productId, lessonId } = await params;
    const owner = principal.userId ? eq(quizAttempts.userId, principal.userId) : eq(quizAttempts.guestBuyerId, principal.guestBuyerId!);
    const access = await getEntitledQuiz(productId, lessonId, principal);
    if (!access) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    const db = getDatabase(); const quiz = access.quiz;
    const attempts = await db.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, quiz.id), owner)).orderBy(desc(quizAttempts.startedAt));
    const current = attempts.filter((attempt) => attempt.quizVersion === quiz.version);
    const open = attempts.find((attempt) => attempt.status === 'in_progress');
    const lastSubmitted = current.find((attempt) => attempt.status === 'submitted');
    const attemptsUsed = current.filter((attempt) => attempt.status === 'submitted').length;
    return NextResponse.json({ quiz: quizForLearner(snapshotQuiz({ version: quiz.version, questions: quiz.questions as any, passingScore: quiz.passingScore, maxAttempts: quiz.maxAttempts, revealCorrectAnswers: quiz.revealCorrectAnswers })), attempt: open ? { id: open.id, status: 'in_progress', quiz: quizForLearner(open.quizSnapshot as any), answers: open.answers } : lastSubmitted ? { id: lastSubmitted.id, status: 'submitted', quiz: quizForLearner(lastSubmitted.quizSnapshot as any, { submitted: true }), answers: lastSubmitted.answers, score: lastSubmitted.score, passed: lastSubmitted.passed, submittedAt: lastSubmitted.submittedAt } : null, attemptsUsed, attemptsRemaining: attemptsRemaining({ maxAttempts: quiz.maxAttempts, attemptsUsed, passed: Boolean(lastSubmitted?.passed) }), passed: Boolean(lastSubmitted?.passed) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Course quiz could not be loaded', error); return NextResponse.json({ error: 'This quiz could not be loaded.' }, { status: 503 });
  }
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 }); const { productId, lessonId } = await params;
    const owner = principal.userId ? eq(quizAttempts.userId, principal.userId) : eq(quizAttempts.guestBuyerId, principal.guestBuyerId!);
    const access = await getEntitledQuiz(productId, lessonId, principal);
    if (!access) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    const db = getDatabase(); const quiz = access.quiz;
    const result = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(courseQuizzes).where(eq(courseQuizzes.id, quiz.id)).for('update');
      if (!locked) throw new Error('Quiz not found.');
      const attempts = await tx.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, locked.id), owner)).orderBy(desc(quizAttempts.startedAt));
      const current = attempts.filter((attempt) => attempt.quizVersion === locked.version);
      const open = attempts.find((attempt) => attempt.status === 'in_progress');
      const lastSubmitted = current.find((attempt) => attempt.status === 'submitted');
      if (open) return open;
      if (lastSubmitted?.passed) throw Object.assign(new Error('You passed this quiz.'), { code: 'QUIZ_PASSED' });
      const used = current.filter((attempt) => attempt.status === 'submitted').length;
      if (locked.maxAttempts !== null && used >= locked.maxAttempts) throw Object.assign(new Error('You have used all attempts for this quiz version.'), { code: 'QUIZ_ATTEMPTS_EXHAUSTED' });
      const [created] = await tx.insert(quizAttempts).values({ quizId: locked.id, creatorId: locked.creatorId, userId: principal.userId, guestBuyerId: principal.guestBuyerId, quizVersion: locked.version, quizSnapshot: snapshotQuiz({ version: locked.version, questions: locked.questions as any, passingScore: locked.passingScore, maxAttempts: locked.maxAttempts, revealCorrectAnswers: locked.revealCorrectAnswers }) }).returning();
      if (!created) throw new Error('An attempt could not be created.');
      return created;
    });
    return NextResponse.json({ attempt: { id: result.id, status: result.status, quiz: quizForLearner(result.quizSnapshot as any), answers: result.answers } }, { status: 200, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'QUIZ_PASSED' || code === 'QUIZ_ATTEMPTS_EXHAUSTED') return NextResponse.json({ error: (error as Error).message }, { status: 409 });
    console.error('Course quiz attempt could not be started', error); return NextResponse.json({ error: 'An attempt could not be started.' }, { status: 503 });
  }
}
