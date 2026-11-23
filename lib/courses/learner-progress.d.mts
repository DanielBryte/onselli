export const MAX_RESUME_SECONDS: number;
export function validateResumePosition(positionSeconds: unknown, durationSeconds?: unknown): boolean;
export function canUpdateLessonProgress(input: {
  userId?: string | null;
  guestBuyerId?: string | null;
  entitlement: { userId: string | null; guestBuyerId?: string | null; productId: string; creatorId: string; orderId: string; status: string } | null;
  order: { id: string; buyerUserId: string | null; guestBuyerId?: string | null; status: string } | null;
  product: { id: string; creatorId: string; type: string; status: string } | null;
  section: { id: string; productId: string; creatorId: string; status: string } | null;
  lesson: { creatorId: string; sectionId: string; status: string; deletedAt: unknown } | null;
}): boolean;
export function summarizeCourseProgress(lessons: Array<{ id: string }>, progressRows: Array<{ lessonId: string; completedAt: Date | string | null; lastPositionSeconds: number; updatedAt: Date | string }>): {
  totalLessons: number; completedLessons: number; percent: number; resumeLessonId: string | null; resumePositionSeconds: number;
};
