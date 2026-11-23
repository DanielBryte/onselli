export function validateQuizConfig(quiz) {
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length < 1 || quiz.questions.length > 50) return 'Add between 1 and 50 quiz questions.';
  if (!Number.isInteger(quiz.passingScore) || quiz.passingScore < 1 || quiz.passingScore > 100) return 'The passing score must be between 1 and 100.';
  if (quiz.maxAttempts !== null && (!Number.isInteger(quiz.maxAttempts) || quiz.maxAttempts < 1 || quiz.maxAttempts > 10)) return 'Attempts must be unlimited or between 1 and 10.';
  const questionIds = new Set();
  for (const question of quiz.questions) {
    if (!question || typeof question.id !== 'string' || !question.id || questionIds.has(question.id)) return 'Each question needs a unique ID.';
    questionIds.add(question.id);
    if (typeof question.prompt !== 'string' || question.prompt.trim().length < 2 || question.prompt.length > 400) return 'Each question needs 2 to 400 characters.';
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) return 'Each question needs 2 to 6 answer options.';
    const optionIds = new Set();
    for (const option of question.options) {
      if (!option || typeof option.id !== 'string' || !option.id || optionIds.has(option.id)) return 'Each answer option needs a unique ID.';
      optionIds.add(option.id);
      if (typeof option.text !== 'string' || !option.text.trim() || option.text.length > 160) return 'Answer options must contain 1 to 160 characters.';
    }
    if (!optionIds.has(question.correctOptionId)) return 'Choose a correct answer for each question.';
  }
  return null;
}

export function snapshotQuiz(quiz) {
  return {
    version: quiz.version,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    revealCorrectAnswers: quiz.revealCorrectAnswers,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt.trim(),
      options: question.options.map((option) => ({ id: option.id, text: option.text.trim() })),
      correctOptionId: question.correctOptionId,
    })),
  };
}

function quizConfigFingerprint(quiz) {
  return JSON.stringify({
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    revealCorrectAnswers: quiz.revealCorrectAnswers,
    questions: quiz.questions.map((question) => ({ id: question.id, prompt: question.prompt.trim(), correctOptionId: question.correctOptionId, options: question.options.map((option) => ({ id: option.id, text: option.text.trim() })) })),
  });
}

export function nextQuizVersion(existing, next) {
  if (!existing) return 1;
  return existing.version + (quizConfigFingerprint(existing) === quizConfigFingerprint(next) ? 0 : 1);
}

export function quizForLearner(snapshot, { submitted = false } = {}) {
  return {
    version: snapshot.version,
    passingScore: snapshot.passingScore,
    maxAttempts: snapshot.maxAttempts,
    revealCorrectAnswers: snapshot.revealCorrectAnswers,
    questions: snapshot.questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options.map(({ id, text }) => ({ id, text })),
      ...(submitted && snapshot.revealCorrectAnswers ? { correctOptionId: question.correctOptionId } : {}),
    })),
  };
}

export function gradeQuiz(snapshot, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return { error: 'Answer every question before submitting.' };
  const ids = new Set(snapshot.questions.map((question) => question.id));
  if (Object.keys(answers).length !== ids.size || Object.keys(answers).some((id) => !ids.has(id))) return { error: 'Answer every question before submitting.' };
  let correct = 0;
  for (const question of snapshot.questions) {
    const selected = answers[question.id];
    if (typeof selected !== 'string' || !question.options.some((option) => option.id === selected)) return { error: 'Choose one answer for every question.' };
    if (selected === question.correctOptionId) correct += 1;
  }
  const score = Math.round((correct / snapshot.questions.length) * 100);
  return { score, passed: score >= snapshot.passingScore, correctCount: correct, totalCount: snapshot.questions.length };
}

export function canAccessCourseQuiz({ userId, guestBuyerId, product, section, lesson, quiz, entitlement, order }) {
  const principalMatches = userId ? entitlement?.userId === userId && order?.buyerUserId === userId
    : Boolean(guestBuyerId && entitlement?.guestBuyerId === guestBuyerId && order?.guestBuyerId === guestBuyerId);
  return Boolean((userId || guestBuyerId) && product?.type === 'course' && product.status === 'published'
    && section?.productId === product.id && section.creatorId === product.creatorId && section.status === 'published'
    && lesson?.sectionId === section.id && lesson.creatorId === product.creatorId && lesson.type === 'quiz'
    && lesson.status === 'published' && !lesson.deletedAt
    && quiz?.lessonId === lesson.id && quiz.creatorId === product.creatorId
    && principalMatches && entitlement.productId === product.id && entitlement.creatorId === product.creatorId
    && entitlement.status === 'active' && entitlement.orderId === order?.id
    && order.status === 'paid');
}

export function canAccessQuizAttempt({ userId, guestBuyerId, attempt, quiz, product, section, lesson, entitlement, order }) {
  const attemptMatches = userId ? attempt?.userId === userId : Boolean(guestBuyerId && attempt?.guestBuyerId === guestBuyerId);
  return Boolean(attemptMatches && attempt.quizId === quiz?.id && attempt.creatorId === product?.creatorId
    && canAccessCourseQuiz({ userId, guestBuyerId, product, section, lesson, quiz, entitlement, order }));
}

export function attemptsRemaining({ maxAttempts, attemptsUsed, passed }) {
  if (passed) return 0;
  return maxAttempts === null ? null : Math.max(0, maxAttempts - attemptsUsed);
}
