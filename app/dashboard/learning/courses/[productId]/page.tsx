import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { courseSections, creators, entitlements, lessonAttachments, lessonProgress, lessons, orders, products } from '@/src/server/db/schema';
import { summarizeCourseProgress } from '@/lib/courses/learner-progress.mjs';
import CoursePlayer from './CoursePlayer';

function textContent(content: unknown) {
  return content && typeof content === 'object' && 'text' in content && typeof content.text === 'string' ? content.text : '';
}

function safeEmbedUrl(content: unknown, type: string) {
  if (type !== 'video' || !content || typeof content !== 'object' || !('videoUrl' in content) || typeof content.videoUrl !== 'string') return '';
  try {
    const url = new URL(content.videoUrl);
    if (url.protocol !== 'https:') return '';
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      const parts = url.pathname.split('/');
      const id = url.searchParams.get('v') ?? (['embed', 'shorts', 'live'].includes(parts[1] ?? '') ? parts[2] : '');
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const id = url.pathname.split('/').filter(Boolean).at(-1);
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : '';
    }
  } catch { return ''; }
  return '';
}

export default async function BuyerCoursePage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const principal = await getBuyerPrincipal();
  if (!principal) redirect('/purchase/access');
  const entitlementOwner = principal.userId ? eq(entitlements.userId, principal.userId) : eq(entitlements.guestBuyerId, principal.guestBuyerId!);
  const orderOwner = principal.userId ? eq(orders.buyerUserId, principal.userId) : eq(orders.guestBuyerId, principal.guestBuyerId!);
  const db = getDatabase();
  const [course] = await db.select({ product: products, creator: creators })
    .from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).innerJoin(creators, eq(products.creatorId, creators.id)).innerJoin(orders, eq(entitlements.orderId, orders.id))
    .where(and(entitlementOwner, eq(entitlements.productId, productId), eq(entitlements.status, 'active'), eq(orders.status, 'paid'), orderOwner, eq(products.type, 'course'), eq(products.status, 'published'))).limit(1);
  if (!course) notFound();
  const sections = await db.select().from(courseSections).where(and(eq(courseSections.productId, productId), eq(courseSections.creatorId, course.creator.id), eq(courseSections.status, 'published'))).orderBy(asc(courseSections.position));
  const sectionIds = sections.map((section) => section.id);
  const lessonRows = sectionIds.length ? await db.select().from(lessons).where(and(inArray(lessons.sectionId, sectionIds), eq(lessons.creatorId, course.creator.id), eq(lessons.status, 'published'), isNull(lessons.deletedAt))).orderBy(asc(lessons.position)) : [];
  const lessonIds = lessonRows.map((lesson) => lesson.id);
  const resourceRows = lessonIds.length ? await db.select({ id: lessonAttachments.id, lessonId: lessonAttachments.lessonId, name: lessonAttachments.name, sizeBytes: lessonAttachments.sizeBytes })
    .from(lessonAttachments).where(and(inArray(lessonAttachments.lessonId, lessonIds), eq(lessonAttachments.creatorId, course.creator.id), eq(lessonAttachments.status, 'ready'))).orderBy(asc(lessonAttachments.position), asc(lessonAttachments.createdAt)) : [];
  const progress = lessonIds.length ? await db.select().from(lessonProgress).where(and(principal.userId ? eq(lessonProgress.userId, principal.userId) : eq(lessonProgress.guestBuyerId, principal.guestBuyerId!), inArray(lessonProgress.lessonId, lessonIds))) : [];
  const completed = new Set(progress.filter((row) => row.completedAt).map((row) => row.lessonId));
  const progressByLesson = new Map(progress.map((row) => [row.lessonId, row]));
  const courseProgress = summarizeCourseProgress(lessonRows.map((lesson) => ({ id: lesson.id })), progress);
  const curriculum = sections.map((section) => ({ id: section.id, title: section.title, lessons: lessonRows.filter((lesson) => lesson.sectionId === section.id).map((lesson) => ({
    id: lesson.id, title: lesson.title, type: lesson.type === 'video' ? 'video' as const : lesson.type === 'quiz' ? 'quiz' as const : 'text' as const,
    text: textContent(lesson.content), embedUrl: lesson.bunnyVideoId ? '' : safeEmbedUrl(lesson.content, lesson.type),
    videoSource: lesson.bunnyVideoId || (lesson.content && typeof lesson.content === 'object' && 'videoSource' in lesson.content && lesson.content.videoSource === 'hosted') ? 'hosted' as const : 'external' as const,
    videoStatus: lesson.videoStatus, isFreePreview: lesson.isFreePreview,
    resumePositionSeconds: completed.has(lesson.id) ? 0 : progressByLesson.get(lesson.id)?.lastPositionSeconds ?? 0,
    resources: resourceRows.filter((resource) => resource.lessonId === lesson.id).map((resource) => ({ id: resource.id, name: resource.name, sizeBytes: resource.sizeBytes.toString() })),
    completed: completed.has(lesson.id),
  })) })).filter((section) => section.lessons.length > 0);
  return <main className="course-player-page"><header className="course-player-page__top"><a href="/dashboard/learning" className="course-player-page__back">← <span>Your library</span></a><a href="/" className="course-player-page__brand">Onselli</a></header><div className="course-player-page__body"><CoursePlayer productId={productId} title={course.product.title} creatorName={course.creator.displayName} sections={curriculum} resumeLessonId={courseProgress.resumeLessonId ?? ''}/></div></main>;
}
