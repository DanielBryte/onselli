import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessLessonResource,
  isSupportedCourseVideoUrl,
  ownsLessonResource,
  positionCurriculum,
  validateCoursePublishReadiness,
} from '../lib/courses/curriculum-rules.mjs';
import {
  BUNNY_VIDEO_MAX_BYTES,
  canAccessHostedVideo,
  canManageHostedVideo,
  mapBunnyVideoStatus,
  nextBunnyVideoStatus,
  signBunnyEmbed,
  signBunnyTusUpload,
  validateHostedVideoUpload,
} from '../lib/courses/bunny-stream.mjs';
import { canUpdateLessonProgress, summarizeCourseProgress, validateResumePosition } from '../lib/courses/learner-progress.mjs';

test('curriculum order is persisted as stable zero-based module and lesson positions', () => {
  const result = positionCurriculum([
    { id: 'module-b', title: 'Second', lessons: [{ id: 'lesson-b2' }, { id: 'lesson-b1' }] },
    { id: 'module-a', title: 'First', lessons: [{ id: 'lesson-a1' }] },
  ]);
  assert.deepEqual(result.map((section) => [section.id, section.position]), [['module-b', 0], ['module-a', 1]]);
  assert.deepEqual(result[0].lessons.map((lesson) => [lesson.id, lesson.position]), [['lesson-b2', 0], ['lesson-b1', 1]]);
});

test('course publish readiness requires usable published lessons and published previews', () => {
  assert.match(validateCoursePublishReadiness([]), /at least one lesson/i);
  assert.match(validateCoursePublishReadiness([{ title: 'Draft preview', status: 'draft', isFreePreview: true }]), /preview lessons must be published/i);
  assert.match(validateCoursePublishReadiness([{ title: 'Text', type: 'text', status: 'published', text: '  ' }]), /add content/i);
  assert.match(validateCoursePublishReadiness([{ title: 'Video', type: 'video', status: 'published', videoUrl: 'https://youtube.com/watch?v=bad' }]), /valid youtube or vimeo/i);
  assert.equal(validateCoursePublishReadiness([{ title: 'Intro', type: 'text', status: 'published', text: 'Welcome', isFreePreview: true }]), null);
  assert.equal(isSupportedCourseVideoUrl('https://youtu.be/dQw4w9WgXcQ'), true);
});

test('lesson resources are scoped to their creator and lesson', () => {
  const resource = { id: 'resource-1', creatorId: 'creator-1', lessonId: 'lesson-1', status: 'ready' };
  assert.equal(ownsLessonResource(resource, { creatorId: 'creator-1', lessonId: 'lesson-1' }), true);
  assert.equal(ownsLessonResource(resource, { creatorId: 'creator-2', lessonId: 'lesson-1' }), false);
  assert.equal(ownsLessonResource(resource, { creatorId: 'creator-1', lessonId: 'lesson-2' }), false);
});

test('resource download requires a published lesson and matching paid active course entitlement', () => {
  const access = {
    resource: { creatorId: 'creator-1', lessonId: 'lesson-1', status: 'ready' },
    lesson: { id: 'lesson-1', status: 'published', deletedAt: null },
    product: { id: 'course-1', creatorId: 'creator-1', type: 'course', status: 'published' },
    entitlement: { userId: 'buyer-1', productId: 'course-1', creatorId: 'creator-1', orderId: 'order-1', status: 'active' },
    order: { id: 'order-1', buyerUserId: 'buyer-1', status: 'paid' },
    userId: 'buyer-1',
  };
  assert.equal(canAccessLessonResource(access), true);
  assert.equal(canAccessLessonResource({ ...access, order: { ...access.order, status: 'pending' } }), false);
  assert.equal(canAccessLessonResource({ ...access, entitlement: { ...access.entitlement, status: 'revoked' } }), false);
  assert.equal(canAccessLessonResource({ ...access, lesson: { ...access.lesson, status: 'draft' } }), false);
  assert.equal(canAccessLessonResource({ ...access, userId: 'buyer-2' }), false);
});

test('hosted video upload requires a supported MIME type and bounded positive size', () => {
  assert.equal(validateHostedVideoUpload({ name: 'lesson.mp4', contentType: 'video/mp4', sizeBytes: 1024 }), null);
  assert.match(validateHostedVideoUpload({ name: 'lesson.exe', contentType: 'application/octet-stream', sizeBytes: 10 }), /video/i);
  assert.match(validateHostedVideoUpload({ name: 'lesson.mp4', contentType: 'video/mp4', sizeBytes: 0 }), /between/i);
  assert.match(validateHostedVideoUpload({ name: 'lesson.mp4', contentType: 'video/mp4', sizeBytes: BUNNY_VIDEO_MAX_BYTES + 1 }), /5 GB/i);
});

test('upload authorization is signed for an owned video lesson and refuses another workspace', () => {
  const input = {
    product: { id: 'course-1', creatorId: 'creator-1', type: 'course' },
    lesson: { id: 'lesson-1', creatorId: 'creator-1', type: 'video', deletedAt: null },
    creatorId: 'creator-1', productId: 'course-1', lessonId: 'lesson-1',
  };
  assert.equal(canManageHostedVideo(input), true);
  assert.equal(canManageHostedVideo({ ...input, creatorId: 'creator-2' }), false);
  assert.equal(canManageHostedVideo({ ...input, lesson: { ...input.lesson, type: 'text' } }), false);
  assert.equal(canManageHostedVideo({ ...input, product: { ...input.product, type: 'download' } }), false);
  const credentials = signBunnyTusUpload({ libraryId: '42', apiKey: 'server-key', videoId: 'video-guid', expires: 123456 });
  assert.match(credentials.signature, /^[a-f0-9]{64}$/);
  assert.equal(credentials.libraryId, '42');
});

test('Bunny processing statuses progress safely and publishing waits for a ready hosted video', () => {
  assert.equal(mapBunnyVideoStatus(0), 'processing');
  assert.equal(mapBunnyVideoStatus(1), 'processing');
  assert.equal(mapBunnyVideoStatus(2), 'processing');
  assert.equal(mapBunnyVideoStatus(3), 'ready');
  assert.equal(mapBunnyVideoStatus(4), 'ready');
  assert.equal(mapBunnyVideoStatus(5), 'failed');
  assert.equal(mapBunnyVideoStatus(7), 'uploading');
  assert.equal(nextBunnyVideoStatus('ready', 1), 'ready');
  assert.equal(nextBunnyVideoStatus('processing', 5), 'failed');
  assert.match(validateCoursePublishReadiness([{ title: 'Lesson', type: 'video', videoSource: 'hosted', status: 'published', bunnyVideoId: 'v1', videoStatus: 'processing' }]), /finish processing/i);
  assert.equal(validateCoursePublishReadiness([{ title: 'Lesson', type: 'video', videoSource: 'hosted', status: 'published', bunnyVideoId: 'v1', videoStatus: 'ready' }]), null);
});

test('hosted playback requires published lesson, active entitlement, and paid order', () => {
  const access = {
    product: { id: 'course-1', creatorId: 'creator-1', type: 'course', status: 'published' },
    lesson: { id: 'lesson-1', type: 'video', status: 'published', deletedAt: null, bunnyVideoId: 'video-1', videoStatus: 'ready' },
    entitlement: { userId: 'buyer-1', productId: 'course-1', creatorId: 'creator-1', orderId: 'order-1', status: 'active' },
    order: { id: 'order-1', buyerUserId: 'buyer-1', status: 'paid' }, userId: 'buyer-1',
  };
  assert.equal(canAccessHostedVideo(access), true);
  assert.equal(canAccessHostedVideo({ ...access, userId: 'buyer-2' }), false);
  assert.equal(canAccessHostedVideo({ ...access, order: { ...access.order, status: 'pending' } }), false);
  assert.equal(canAccessHostedVideo({ ...access, entitlement: { ...access.entitlement, status: 'revoked' } }), false);
  assert.equal(canAccessHostedVideo({ ...access, lesson: { ...access.lesson, videoStatus: 'processing' } }), false);
  assert.equal(canAccessHostedVideo({ ...access, lesson: { ...access.lesson, status: 'draft' } }), false);
});

test('signed Bunny embed URL contains expiring token without exposing the signing key', () => {
  const signed = signBunnyEmbed({ libraryId: '42', tokenKey: 'private-key', videoId: 'video-guid', nowSeconds: 1000, ttlSeconds: 600 });
  const parsed = new URL(signed.url);
  assert.equal(parsed.origin, 'https://player.mediadelivery.net');
  assert.equal(parsed.searchParams.get('expires'), '1600');
  assert.match(parsed.searchParams.get('token'), /^[a-f0-9]{64}$/);
  assert.equal(signed.url.includes('private-key'), false);
});

test('progress updates require the buyer entitlement, paid order, and the same entitled course', () => {
  const access = {
    userId: 'buyer-1',
    entitlement: { userId: 'buyer-1', productId: 'course-1', creatorId: 'creator-1', orderId: 'order-1', status: 'active' },
    order: { id: 'order-1', buyerUserId: 'buyer-1', status: 'paid' },
    product: { id: 'course-1', creatorId: 'creator-1', type: 'course', status: 'published' },
    section: { id: 'section-1', productId: 'course-1', creatorId: 'creator-1', status: 'published' },
    lesson: { creatorId: 'creator-1', sectionId: 'section-1', status: 'published', deletedAt: null },
  };
  assert.equal(canUpdateLessonProgress(access), true);
  assert.equal(canUpdateLessonProgress({ ...access, userId: 'buyer-2' }), false);
  assert.equal(canUpdateLessonProgress({ ...access, product: { ...access.product, id: 'course-2' } }), false);
  assert.equal(canUpdateLessonProgress({ ...access, entitlement: { ...access.entitlement, productId: 'course-2' } }), false);
  assert.equal(canUpdateLessonProgress({ ...access, order: { ...access.order, status: 'pending' } }), false);
  assert.equal(canUpdateLessonProgress({ ...access, section: { ...access.section, creatorId: 'creator-2' } }), false);
  assert.equal(canUpdateLessonProgress({ ...access, lesson: { ...access.lesson, deletedAt: new Date() } }), false);
});

test('resume positions accept bounded integer seconds and reject invalid or out-of-duration values', () => {
  assert.equal(validateResumePosition(0, 180), true);
  assert.equal(validateResumePosition(180, 180), true);
  assert.equal(validateResumePosition(182, 180), true);
  assert.equal(validateResumePosition(183, 180), false);
  assert.equal(validateResumePosition(1.5, 180), false);
  assert.equal(validateResumePosition(-1, 180), false);
  assert.equal(validateResumePosition(86_401), false);
});

test('course progress summary is scoped to the supplied course lessons and resumes the latest unfinished lesson', () => {
  const lessons = [{ id: 'lesson-1' }, { id: 'lesson-2' }, { id: 'lesson-3' }];
  const rows = [
    { lessonId: 'lesson-1', completedAt: new Date('2026-01-01'), lastPositionSeconds: 80, updatedAt: new Date('2026-01-01') },
    { lessonId: 'lesson-2', completedAt: null, lastPositionSeconds: 42, updatedAt: new Date('2026-02-01') },
    { lessonId: 'other-course-lesson', completedAt: new Date(), lastPositionSeconds: 100, updatedAt: new Date('2026-03-01') },
  ];
  assert.deepEqual(summarizeCourseProgress(lessons, rows), { totalLessons: 3, completedLessons: 1, percent: 33, resumeLessonId: 'lesson-2', resumePositionSeconds: 42 });
});
