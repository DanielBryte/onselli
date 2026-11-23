export const MAX_RESUME_SECONDS = 24 * 60 * 60;

export function validateResumePosition(positionSeconds, durationSeconds = null) {
  if (!Number.isSafeInteger(positionSeconds) || positionSeconds < 0 || positionSeconds > MAX_RESUME_SECONDS) return false;
  if (Number.isSafeInteger(durationSeconds) && durationSeconds >= 0 && positionSeconds > durationSeconds + 2) return false;
  return true;
}

/** @param {{ userId?: string | null, guestBuyerId?: string | null, entitlement: any, order: any, product: any, section: any, lesson: any }} input */
export function canUpdateLessonProgress({ userId = null, guestBuyerId = null, entitlement, order, product, section, lesson }) {
  const principalMatches = userId ? entitlement?.userId === userId && order?.buyerUserId === userId
    : Boolean(guestBuyerId && entitlement?.guestBuyerId === guestBuyerId && order?.guestBuyerId === guestBuyerId);
  return Boolean((userId || guestBuyerId) && entitlement && principalMatches && entitlement.productId === product?.id
    && entitlement.creatorId === product.creatorId && entitlement.status === 'active' && entitlement.orderId === order?.id
    && order.status === 'paid' && product.type === 'course' && product.status === 'published'
    && section?.productId === product.id && section?.creatorId === product.creatorId && section?.status === 'published'
    && lesson?.creatorId === product.creatorId && lesson?.sectionId === section?.id && lesson?.status === 'published' && !lesson?.deletedAt);
}

export function summarizeCourseProgress(lessons, progressRows) {
  const completed = new Set(progressRows.filter((row) => row.completedAt).map((row) => row.lessonId));
  const totalLessons = lessons.length;
  const completedLessons = lessons.reduce((count, lesson) => count + Number(completed.has(lesson.id)), 0);
  const recent = [...progressRows].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .find((row) => lessons.some((lesson) => lesson.id === row.lessonId && !completed.has(row.lessonId) && row.lastPositionSeconds > 0));
  const nextLesson = lessons.find((lesson) => !completed.has(lesson.id));
  return {
    totalLessons,
    completedLessons,
    percent: totalLessons ? Math.round(completedLessons / totalLessons * 100) : 0,
    resumeLessonId: recent?.lessonId ?? nextLesson?.id ?? lessons[0]?.id ?? null,
    resumePositionSeconds: recent?.lastPositionSeconds ?? 0,
  };
}
