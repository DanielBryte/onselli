import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptsRemaining, canAccessCourseQuiz, canAccessQuizAttempt, gradeQuiz, nextQuizVersion, quizForLearner, snapshotQuiz, validateQuizConfig } from '../lib/courses/quizzes.mjs';
import { validateCoursePublishReadiness } from '../lib/courses/curriculum-rules.mjs';

const config = { version: 1, passingScore: 70, maxAttempts: 2, revealCorrectAnswers: false, questions: [
  { id: 'q1', prompt: 'First?', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'b' },
  { id: 'q2', prompt: 'Second?', options: [{ id: 'c', text: 'C' }, { id: 'd', text: 'D' }], correctOptionId: 'd' },
] };

test('quiz authoring validates question and answer structure and publish readiness', () => {
  assert.equal(validateQuizConfig(config), null);
  assert.match(validateQuizConfig({ ...config, questions: [] }), /between 1 and 50/);
  assert.match(validateQuizConfig({ ...config, questions: [{ ...config.questions[0], correctOptionId: 'missing' }] }), /correct answer/);
  assert.equal(validateCoursePublishReadiness([{ title: 'Quiz', type: 'quiz', status: 'published', quiz: config, isFreePreview: false }]), null);
  assert.match(validateCoursePublishReadiness([{ title: 'Quiz', type: 'quiz', status: 'published', isFreePreview: false }]), /at least one question/);
  assert.match(validateCoursePublishReadiness([{ title: 'Quiz', type: 'quiz', status: 'published', quiz: config, isFreePreview: true }]), /enrolled buyers/);
});

test('grading requires one valid answer per question and uses the saved passing threshold', () => {
  assert.deepEqual(gradeQuiz(config, { q1: 'b', q2: 'd' }), { score: 100, passed: true, correctCount: 2, totalCount: 2 });
  assert.deepEqual(gradeQuiz(config, { q1: 'a', q2: 'd' }), { score: 50, passed: false, correctCount: 1, totalCount: 2 });
  assert.match(gradeQuiz(config, { q1: 'b' }).error, /answer every question/i);
  assert.match(gradeQuiz(config, { q1: 'bad', q2: 'd' }).error, /choose one answer/i);
});

test('learner projection hides answer keys until submitted and respects reveal setting', () => {
  const snapshot = snapshotQuiz(config);
  assert.equal('correctOptionId' in quizForLearner(snapshot).questions[0], false);
  assert.equal('correctOptionId' in quizForLearner(snapshot, { submitted: true }).questions[0], false);
  assert.equal(quizForLearner({ ...snapshot, revealCorrectAnswers: true }, { submitted: true }).questions[0].correctOptionId, 'b');
});

test('quiz and attempt access is tied to the buyer paid entitlement and owning course', () => {
  const access = { userId: 'buyer', product: { id: 'course', creatorId: 'creator', type: 'course', status: 'published' }, section: { id: 'section', productId: 'course', creatorId: 'creator', status: 'published' }, lesson: { id: 'lesson', sectionId: 'section', creatorId: 'creator', type: 'quiz', status: 'published', deletedAt: null }, quiz: { id: 'quiz', lessonId: 'lesson', creatorId: 'creator' }, entitlement: { userId: 'buyer', productId: 'course', creatorId: 'creator', orderId: 'order', status: 'active' }, order: { id: 'order', buyerUserId: 'buyer', status: 'paid' } };
  assert.equal(canAccessCourseQuiz(access), true);
  assert.equal(canAccessCourseQuiz({ ...access, userId: 'intruder' }), false);
  assert.equal(canAccessCourseQuiz({ ...access, order: { ...access.order, status: 'pending' } }), false);
  assert.equal(canAccessQuizAttempt({ ...access, attempt: { userId: 'buyer', quizId: 'quiz', creatorId: 'creator' } }), true);
  assert.equal(canAccessQuizAttempt({ ...access, attempt: { userId: 'intruder', quizId: 'quiz', creatorId: 'creator' } }), false);
});

test('attempt retry counts and versioned snapshots keep prior grading immutable', () => {
  const priorAttemptSnapshot = snapshotQuiz(config);
  const edited = { ...config, version: 2, passingScore: 100, questions: [{ ...config.questions[0], correctOptionId: 'a' }] };
  assert.equal(priorAttemptSnapshot.version, 1);
  assert.equal(gradeQuiz(priorAttemptSnapshot, { q1: 'b', q2: 'd' }).passed, true);
  assert.equal(gradeQuiz(edited, { q1: 'b' }).passed, false);
  assert.equal(attemptsRemaining({ maxAttempts: 2, attemptsUsed: 1, passed: false }), 1);
  assert.equal(attemptsRemaining({ maxAttempts: null, attemptsUsed: 11, passed: false }), null);
  assert.equal(attemptsRemaining({ maxAttempts: 2, attemptsUsed: 1, passed: true }), 0);
  assert.equal(nextQuizVersion(null, config), 1);
  assert.equal(nextQuizVersion(config, config), 1);
  assert.equal(nextQuizVersion(config, edited), 2);
});
