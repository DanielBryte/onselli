import { and, eq, isNull } from 'drizzle-orm';
import { getDatabase } from '@/src/server/db';
import { courseQuizzes, courseSections, entitlements, lessons, orders, products } from '@/src/server/db/schema';
import { canAccessCourseQuiz } from '@/lib/courses/quizzes.mjs';

export async function getEntitledQuiz(productId: string, lessonId: string, principal: { userId: string | null; guestBuyerId: string | null }) {
  const entitlementOwner = principal.userId ? eq(entitlements.userId, principal.userId) : eq(entitlements.guestBuyerId, principal.guestBuyerId!);
  const orderOwner = principal.userId ? eq(orders.buyerUserId, principal.userId) : eq(orders.guestBuyerId, principal.guestBuyerId!);
  const [access] = await getDatabase().select({ quiz: courseQuizzes, lesson: lessons, section: courseSections, product: products, entitlement: entitlements, order: orders })
    .from(courseQuizzes)
    .innerJoin(lessons, and(eq(courseQuizzes.lessonId, lessons.id), eq(courseQuizzes.creatorId, lessons.creatorId)))
    .innerJoin(courseSections, and(eq(lessons.sectionId, courseSections.id), eq(courseSections.creatorId, lessons.creatorId)))
    .innerJoin(products, and(eq(courseSections.productId, products.id), eq(products.creatorId, lessons.creatorId)))
    .innerJoin(entitlements, and(eq(entitlements.productId, products.id), eq(entitlements.creatorId, products.creatorId), entitlementOwner))
    .innerJoin(orders, and(eq(entitlements.orderId, orders.id), orderOwner))
    .where(and(eq(products.id, productId), eq(lessons.id, lessonId), eq(products.type, 'course'), eq(products.status, 'published'), eq(courseSections.status, 'published'), eq(lessons.type, 'quiz'), eq(lessons.status, 'published'), isNull(lessons.deletedAt), eq(entitlements.status, 'active'), eq(orders.status, 'paid')))
    .limit(1);
  return access && canAccessCourseQuiz({ ...access, userId: principal.userId ?? undefined, guestBuyerId: principal.guestBuyerId ?? undefined }) ? access : null;
}
