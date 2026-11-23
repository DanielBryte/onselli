const VIDEO_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

export function isSupportedCourseVideoUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !VIDEO_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) return false;
    if (url.hostname.toLowerCase().includes('youtu')) {
      const id = url.hostname === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).at(-1);
      return Boolean(id && /^[\w-]{6,20}$/.test(id));
    }
    const id = url.pathname.split('/').filter(Boolean).at(-1);
    return Boolean(id && /^\d{5,15}$/.test(id));
  } catch { return false; }
}

export function validateCoursePublishReadiness(lessons) {
  const all = Array.isArray(lessons) ? lessons : [];
  if (all.some((lesson) => lesson.isFreePreview && lesson.status !== 'published')) return 'Preview lessons must be published before they can be shown to buyers.';
  const published = all.filter((lesson) => lesson.status === 'published');
  if (!published.length) return 'Publish at least one lesson before publishing this course.';
  for (const lesson of published) {
    if (lesson.type === 'text' && !(typeof lesson.text === 'string' && lesson.text.trim())) return `Add content to “${lesson.title || 'Untitled lesson'}” before publishing it.`;
    if (lesson.type === 'video' && lesson.videoSource === 'hosted' && lesson.isFreePreview) return `Hosted videos in “${lesson.title || 'Untitled lesson'}” are available to enrolled buyers only. Choose an external link for a public preview.`;
    if (lesson.type === 'video' && lesson.videoSource === 'hosted' && !(lesson.bunnyVideoId && lesson.videoStatus === 'ready')) return `Wait for the hosted video in “${lesson.title || 'Untitled lesson'}” to finish processing before publishing it.`;
    if (lesson.type === 'video' && (lesson.videoSource ?? 'external') === 'external' && !isSupportedCourseVideoUrl(lesson.videoUrl)) return `Add a valid YouTube or Vimeo link to “${lesson.title || 'Untitled lesson'}” before publishing it.`;
    if (lesson.type === 'quiz' && (!lesson.quiz || !Array.isArray(lesson.quiz.questions) || !lesson.quiz.questions.length)) return `Add at least one question to “${lesson.title || 'Untitled lesson'}” before publishing it.`;
    if (lesson.type === 'quiz' && lesson.isFreePreview) return `Quiz lessons in “${lesson.title || 'Untitled lesson'}” are available to enrolled buyers only.`;
    if (lesson.type !== 'text' && lesson.type !== 'video' && lesson.type !== 'quiz') return 'Choose a supported lesson format.';
  }
  return null;
}

export function positionCurriculum(sections) {
  return (Array.isArray(sections) ? sections : []).map((section, sectionPosition) => ({
    ...section,
    position: sectionPosition,
    lessons: (Array.isArray(section.lessons) ? section.lessons : []).map((lesson, lessonPosition) => ({ ...lesson, position: lessonPosition })),
  }));
}

export function ownsLessonResource(resource, { creatorId, lessonId }) {
  return Boolean(resource && resource.creatorId === creatorId && resource.lessonId === lessonId);
}

/** @param {{ resource: any, lesson: any, product: any, entitlement: any, order: any, userId?: string | null, guestBuyerId?: string | null }} input */
export function canAccessLessonResource({ resource, lesson, product, entitlement, order, userId = null, guestBuyerId = null }) {
  const principalMatches = userId ? entitlement?.userId === userId && order?.buyerUserId === userId
    : Boolean(guestBuyerId && entitlement?.guestBuyerId === guestBuyerId && order?.guestBuyerId === guestBuyerId);
  return Boolean(resource && resource.status === 'ready' && lesson && lesson.status === 'published' && !lesson.deletedAt
    && product && product.type === 'course' && product.status === 'published'
    && entitlement && entitlement.status === 'active' && principalMatches
    && entitlement.productId === product.id && entitlement.creatorId === product.creatorId
    && order && order.id === entitlement.orderId && order.status === 'paid'
    && resource.creatorId === product.creatorId && resource.lessonId === lesson.id);
}
