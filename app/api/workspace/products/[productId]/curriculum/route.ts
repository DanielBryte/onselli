import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, getR2Config } from '@/lib/storage/r2';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, courseQuizzes, courseSections, lessonAttachments, lessonProgress, lessons, products } from '@/src/server/db/schema';
import { positionCurriculum, validateCoursePublishReadiness } from '@/lib/courses/curriculum-rules.mjs';
import { nextQuizVersion, validateQuizConfig } from '@/lib/courses/quizzes.mjs';

export const runtime = 'nodejs';

const lessonInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  type: z.enum(['text', 'video', 'quiz']),
  text: z.string().max(100_000).default(''),
  videoUrl: z.string().trim().max(500).optional().default(''),
  videoSource: z.enum(['external', 'hosted']).default('external'),
  status: z.enum(['draft', 'published']).default('draft'),
  isFreePreview: z.boolean().default(false),
  quiz: z.object({
    questions: z.array(z.object({ id: z.string().min(1).max(80), prompt: z.string().max(400), options: z.array(z.object({ id: z.string().min(1).max(80), text: z.string().max(160) })).max(6), correctOptionId: z.string().min(1).max(80) }).strict()).max(50),
    passingScore: z.number().int().min(1).max(100), maxAttempts: z.number().int().min(1).max(10).nullable(), revealCorrectAnswers: z.boolean(),
  }).strict().optional(),
});
const curriculumInput = z.object({
  sections: z.array(z.object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(160),
    status: z.enum(['draft', 'published']).default('published'),
    lessons: z.array(lessonInput).max(100),
  })).max(50),
}).strict();

function contentText(value: unknown) {
  return value && typeof value === 'object' && 'text' in value && typeof value.text === 'string' ? value.text : '';
}

function contentVideoUrl(value: unknown) {
  return value && typeof value === 'object' && 'videoUrl' in value && typeof value.videoUrl === 'string' ? value.videoUrl : '';
}

function validateVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname.toLowerCase());
  } catch { return false; }
}

function embedUrl(value: string) {
  if (!value) return '';
  const url = new URL(value);
  if (url.hostname.endsWith('youtu.be')) return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`;
  if (url.hostname.endsWith('youtube.com')) {
    const parts = url.pathname.split('/');
    const id = url.searchParams.get('v') ?? (['embed', 'shorts', 'live'].includes(parts[1] ?? '') ? parts[2] : '');
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
  }
  const id = url.pathname.split('/').filter(Boolean).at(-1);
  return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : '';
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { productId } = await params;
    const db = getDatabase();
    const [product] = await db.select({ id: products.id, type: products.type }).from(products)
      .where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).limit(1);
    if (!product || product.type !== 'course') return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    const sections = await db.select().from(courseSections)
      .where(and(eq(courseSections.productId, productId), eq(courseSections.creatorId, creator.id)))
      .orderBy(asc(courseSections.position));
    const sectionIds = sections.map((section) => section.id);
    const rows = sectionIds.length ? await db.select().from(lessons)
      .where(and(inArray(lessons.sectionId, sectionIds), eq(lessons.creatorId, creator.id), isNull(lessons.deletedAt)))
      .orderBy(asc(lessons.position)) : [];
    const lessonIds = rows.map((lesson) => lesson.id);
    const quizzes = lessonIds.length ? await db.select().from(courseQuizzes).where(and(inArray(courseQuizzes.lessonId, lessonIds), eq(courseQuizzes.creatorId, creator.id))) : [];
    const resources = lessonIds.length ? await db.select({ id: lessonAttachments.id, lessonId: lessonAttachments.lessonId, name: lessonAttachments.name, sizeBytes: lessonAttachments.sizeBytes, status: lessonAttachments.status, position: lessonAttachments.position })
      .from(lessonAttachments).where(and(inArray(lessonAttachments.lessonId, lessonIds), eq(lessonAttachments.creatorId, creator.id))).orderBy(asc(lessonAttachments.position), asc(lessonAttachments.createdAt)) : [];
    return NextResponse.json({ sections: sections.map((section) => ({
      id: section.id, title: section.title, status: section.status === 'draft' ? 'draft' : 'published',
      lessons: rows.filter((lesson) => lesson.sectionId === section.id).map((lesson) => ({
        id: lesson.id, title: lesson.title, type: lesson.type === 'video' || lesson.type === 'quiz' ? lesson.type : 'text',
        text: contentText(lesson.content), videoUrl: contentVideoUrl(lesson.content), embedUrl: lesson.type === 'video' && contentVideoUrl(lesson.content) && validateVideoUrl(contentVideoUrl(lesson.content)) ? embedUrl(contentVideoUrl(lesson.content)) : '',
        videoSource: lesson.bunnyVideoId || (lesson.content && typeof lesson.content === 'object' && 'videoSource' in lesson.content && lesson.content.videoSource === 'hosted') ? 'hosted' : 'external', videoStatus: lesson.videoStatus, bunnyVideoId: lesson.bunnyVideoId,
        status: lesson.status === 'published' ? 'published' : 'draft', isFreePreview: lesson.isFreePreview,
        quiz: quizzes.find((quiz) => quiz.lessonId === lesson.id) ? (() => { const quiz = quizzes.find((item) => item.lessonId === lesson.id)!; return { version: quiz.version, questions: quiz.questions, passingScore: quiz.passingScore, maxAttempts: quiz.maxAttempts, revealCorrectAnswers: quiz.revealCorrectAnswers }; })() : undefined,
        resources: resources.filter((resource) => resource.lessonId === lesson.id).map((resource) => ({ id: resource.id, name: resource.name, sizeBytes: resource.sizeBytes.toString(), status: resource.status, position: resource.position })),
      })),
    })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Course curriculum load failed', error);
    return NextResponse.json({ error: 'The course curriculum could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const parsed = curriculumInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the curriculum details.' }, { status: 400 });
    const sections = parsed.data.sections;
    const submittedLessons = sections.flatMap((section) => section.lessons);
    if (submittedLessons.length > 100) return NextResponse.json({ error: 'A course can have up to 100 lessons.' }, { status: 400 });
    const sectionIds = sections.flatMap((section) => section.id ? [section.id] : []);
    const lessonIds = submittedLessons.flatMap((lesson) => lesson.id ? [lesson.id] : []);
    if (new Set(sectionIds).size !== sectionIds.length || new Set(lessonIds).size !== lessonIds.length) return NextResponse.json({ error: 'The curriculum contains duplicate items. Refresh and try again.' }, { status: 400 });
    for (const lesson of submittedLessons) {
      if (lesson.type === 'quiz' && (!lesson.quiz || validateQuizConfig(lesson.quiz))) return NextResponse.json({ error: lesson.quiz ? validateQuizConfig(lesson.quiz) : 'Add quiz questions before saving this lesson.' }, { status: 400 });
      if (lesson.type !== 'quiz' && lesson.quiz) return NextResponse.json({ error: 'Quiz settings can only be saved on a quiz lesson.' }, { status: 400 });
      if (lesson.type === 'quiz' && lesson.isFreePreview) return NextResponse.json({ error: 'Quiz lessons are available to enrolled buyers only.' }, { status: 400 });
      if (lesson.type === 'video' && lesson.videoSource === 'hosted' && lesson.isFreePreview) return NextResponse.json({ error: 'Hosted videos are available to enrolled buyers only. Choose an external video link for a public preview.' }, { status: 400 });
      if (lesson.type === 'video' && lesson.videoSource === 'external' && lesson.videoUrl && !validateVideoUrl(lesson.videoUrl)) return NextResponse.json({ error: 'Use a public YouTube or Vimeo video link for video lessons.' }, { status: 400 });
      if (lesson.status === 'published' && lesson.type === 'video' && lesson.videoSource === 'external' && !embedUrl(lesson.videoUrl)) return NextResponse.json({ error: 'This video link is not in a supported YouTube or Vimeo format.' }, { status: 400 });
    }
    const db = getDatabase();
    const removedResourceKeys: string[] = [];
    const result = await db.transaction(async (tx) => {
      const [product] = await tx.select({ id: products.id, status: products.status, type: products.type }).from(products)
        .where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).for('update');
      if (!product || product.type !== 'course') throw Object.assign(new Error('Course not found.'), { code: 'COURSE_NOT_FOUND' });
      const existingSections = await tx.select().from(courseSections)
        .where(and(eq(courseSections.productId, productId), eq(courseSections.creatorId, creator.id)));
      const existingSectionIds = existingSections.map((section) => section.id);
      const existingLessons = existingSectionIds.length ? await tx.select().from(lessons)
        .where(and(inArray(lessons.sectionId, existingSectionIds), eq(lessons.creatorId, creator.id), isNull(lessons.deletedAt))) : [];
      const existingQuizzes = existingLessons.length ? await tx.select().from(courseQuizzes).where(and(inArray(courseQuizzes.lessonId, existingLessons.map((lesson) => lesson.id)), eq(courseQuizzes.creatorId, creator.id))) : [];
      if (sectionIds.some((id) => !existingSectionIds.includes(id)) || lessonIds.some((id) => !existingLessons.some((lesson) => lesson.id === id))) {
        throw Object.assign(new Error('This curriculum changed elsewhere. Refresh and try again.'), { code: 'CURRICULUM_CONFLICT' });
      }
      if (submittedLessons.some((lesson) => lesson.id && existingLessons.some((stored) => stored.id === lesson.id && stored.bunnyVideoId && lesson.videoSource !== 'hosted'))) {
        throw Object.assign(new Error('Remove the hosted video before switching this lesson to an external link.'), { code: 'HOSTED_VIDEO_MUST_BE_REMOVED' });
      }
      const visibleLessons = sections.filter((section) => section.status === 'published').flatMap((section) => section.lessons);
      if (product.status === 'published' && !visibleLessons.some((lesson) => lesson.status === 'published')) {
        throw Object.assign(new Error('A published course must keep at least one published lesson.'), { code: 'PUBLISHED_COURSE_EMPTY' });
      }
      if (product.status === 'published') {
        const readinessError = validateCoursePublishReadiness(visibleLessons.map((lesson) => {
          const stored = lesson.id ? existingLessons.find((item) => item.id === lesson.id) : undefined;
          const quiz = lesson.id ? existingQuizzes.find((item) => item.lessonId === lesson.id) : undefined;
          return { ...lesson, quiz: lesson.type === 'quiz' ? lesson.quiz ?? (quiz ? { questions: quiz.questions, passingScore: quiz.passingScore } : undefined) : undefined, bunnyVideoId: stored?.bunnyVideoId, videoStatus: stored?.videoStatus };
        }));
        if (readinessError) throw Object.assign(new Error(readinessError), { code: 'COURSE_PUBLISH_NOT_READY' });
      }
      const savedSections: { id: string; title: string; status: 'draft' | 'published'; lessons: { id: string; title: string; type: 'text' | 'video' | 'quiz'; text: string; videoUrl: string; videoSource: 'external' | 'hosted'; bunnyVideoId: string | null; videoStatus: string | null; status: 'draft' | 'published'; isFreePreview: boolean; quiz?: unknown }[] }[] = [];
      for (const section of positionCurriculum(sections)) {
        const sectionPosition = section.position;
        let sectionId = section.id;
        if (sectionId) await tx.update(courseSections).set({ title: section.title, status: section.status, position: sectionPosition, updatedAt: new Date() }).where(and(eq(courseSections.id, sectionId), eq(courseSections.productId, productId), eq(courseSections.creatorId, creator.id)));
        else {
          const [created] = await tx.insert(courseSections).values({ creatorId: creator.id, productId, title: section.title, status: section.status, position: sectionPosition }).returning({ id: courseSections.id });
          if (!created) throw new Error('A module could not be created.');
          sectionId = created.id;
        }
        const savedLessons = [] as typeof savedSections[number]['lessons'];
        for (const lesson of section.lessons) {
          const lessonPosition = lesson.position;
          const content = { schemaVersion: 1, text: lesson.type === 'text' ? lesson.text.trim() : '', ...(lesson.type === 'video' ? { videoSource: lesson.videoSource, ...(lesson.videoSource === 'external' ? { videoUrl: lesson.videoUrl } : {}) } : {}) };
          const values = { creatorId: creator.id, sectionId, type: lesson.type, title: lesson.title, content, status: lesson.status, isFreePreview: lesson.isFreePreview, position: lessonPosition, deletedAt: null, updatedAt: new Date() };
          let lessonId = lesson.id;
          if (lessonId) await tx.update(lessons).set(values).where(and(eq(lessons.id, lessonId), eq(lessons.creatorId, creator.id)));
          else {
            const [created] = await tx.insert(lessons).values(values).returning({ id: lessons.id });
            if (!created) throw new Error('A lesson could not be created.');
            lessonId = created.id;
          }
          const storedVideo = existingLessons.find((item) => item.id === lessonId);
          let savedQuiz: unknown;
          if (lesson.type === 'quiz' && lesson.quiz) {
            const existing = existingQuizzes.find((item) => item.lessonId === lessonId);
            const [quiz] = existing
              ? await tx.update(courseQuizzes).set({ questions: lesson.quiz.questions, passingScore: lesson.quiz.passingScore, maxAttempts: lesson.quiz.maxAttempts, revealCorrectAnswers: lesson.quiz.revealCorrectAnswers, version: nextQuizVersion({ version: existing.version, questions: existing.questions as any, passingScore: existing.passingScore, maxAttempts: existing.maxAttempts, revealCorrectAnswers: existing.revealCorrectAnswers }, lesson.quiz), updatedAt: new Date() }).where(eq(courseQuizzes.id, existing.id)).returning()
              : await tx.insert(courseQuizzes).values({ lessonId, creatorId: creator.id, version: 1, questions: lesson.quiz.questions, passingScore: lesson.quiz.passingScore, maxAttempts: lesson.quiz.maxAttempts, revealCorrectAnswers: lesson.quiz.revealCorrectAnswers }).returning();
            if (quiz) savedQuiz = { version: quiz.version, questions: quiz.questions, passingScore: quiz.passingScore, maxAttempts: quiz.maxAttempts, revealCorrectAnswers: quiz.revealCorrectAnswers };
          }
          savedLessons.push({ id: lessonId, title: lesson.title, type: lesson.type, text: content.text, videoUrl: lesson.type === 'video' ? lesson.videoUrl : '', videoSource: lesson.videoSource, bunnyVideoId: storedVideo?.bunnyVideoId ?? null, videoStatus: storedVideo?.videoStatus ?? null, status: lesson.status, isFreePreview: lesson.isFreePreview, ...(savedQuiz ? { quiz: savedQuiz } : {}) });
        }
        savedSections.push({ id: sectionId, title: section.title, status: section.status, lessons: savedLessons });
      }
      const keptLessonIds = new Set(lessonIds);
      const removedLessons = existingLessons.filter((lesson) => !keptLessonIds.has(lesson.id));
      const removedLessonIds = removedLessons.map((lesson) => lesson.id);
      if (removedLessonIds.length) {
        await tx.delete(lessonProgress).where(inArray(lessonProgress.lessonId, removedLessonIds));
        const resources = await tx.select({ r2Key: lessonAttachments.r2Key }).from(lessonAttachments).where(and(inArray(lessonAttachments.lessonId, removedLessonIds), eq(lessonAttachments.creatorId, creator.id)));
        removedResourceKeys.push(...resources.map((resource) => resource.r2Key));
        await tx.delete(lessonAttachments).where(inArray(lessonAttachments.lessonId, removedLessonIds));
        await tx.delete(lessons).where(and(inArray(lessons.id, removedLessonIds), eq(lessons.creatorId, creator.id)));
      }
      const keptSectionIds = new Set(savedSections.map((section) => section.id));
      const removedSectionIds = existingSectionIds.filter((id) => !keptSectionIds.has(id));
      if (removedSectionIds.length) await tx.delete(courseSections).where(and(inArray(courseSections.id, removedSectionIds), eq(courseSections.productId, productId), eq(courseSections.creatorId, creator.id)));
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'course.curriculum.update', entityType: 'product', entityId: productId, after: { sectionCount: savedSections.length, lessonCount: submittedLessons.length } });
      return savedSections;
    });
    if (removedResourceKeys.length) {
      try {
        const { bucket } = getR2Config(); const client = getR2Client();
        await Promise.all(removedResourceKeys.map((Key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
      } catch (error) { console.error('Removed course lessons left private resources for storage cleanup', error); }
    }
    return NextResponse.json({ sections: result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'COURSE_NOT_FOUND') return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    if (code === 'CURRICULUM_CONFLICT') return NextResponse.json({ error: error instanceof Error ? error.message : 'This curriculum changed. Refresh and try again.' }, { status: 409 });
    if (code === 'PUBLISHED_COURSE_EMPTY') return NextResponse.json({ error: error instanceof Error ? error.message : 'A published course must keep one published lesson.' }, { status: 409 });
    if (code === 'HOSTED_VIDEO_MUST_BE_REMOVED') return NextResponse.json({ error: error instanceof Error ? error.message : 'Remove the hosted video first.' }, { status: 409 });
    if (code === 'COURSE_PUBLISH_NOT_READY') return NextResponse.json({ error: error instanceof Error ? error.message : 'Review the published lessons before saving.' }, { status: 409 });
    console.error('Course curriculum save failed', error);
    return NextResponse.json({ error: 'The course curriculum could not be saved.' }, { status: 503 });
  }
}
