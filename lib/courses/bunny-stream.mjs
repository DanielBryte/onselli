import { createHash } from 'node:crypto';

export const BUNNY_VIDEO_MAX_BYTES = 5 * 1024 * 1024 * 1024;
export const BUNNY_VIDEO_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
  'video/x-matroska', 'video/mpeg', 'video/ogg',
]);

export function validateHostedVideoUpload({ name, contentType, sizeBytes }) {
  if (typeof name !== 'string' || !name.trim() || name.length > 255) return 'Choose a valid video file.';
  if (!BUNNY_VIDEO_TYPES.has(contentType)) return 'Use an MP4, WebM, MOV, M4V, MKV, MPEG, or Ogg video.';
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > BUNNY_VIDEO_MAX_BYTES) return 'Video files must be between 1 byte and 5 GB.';
  return null;
}

export function signBunnyTusUpload({ libraryId, apiKey, videoId, expires }) {
  if (!libraryId || !apiKey || !videoId || !Number.isSafeInteger(expires)) throw new Error('Bunny upload signing is not configured.');
  const signature = createHash('sha256').update(`${libraryId}${apiKey}${expires}${videoId}`).digest('hex');
  return { libraryId, videoId, expires, signature };
}

export function signBunnyEmbed({ libraryId, tokenKey, videoId, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = 3600 }) {
  if (!libraryId || !tokenKey || !videoId || !Number.isSafeInteger(nowSeconds) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3600) {
    throw new Error('Bunny playback signing is not configured.');
  }
  const expires = nowSeconds + ttlSeconds;
  const token = createHash('sha256').update(`${tokenKey}${videoId}${expires}`).digest('hex');
  const query = new URLSearchParams({ token, expires: String(expires) });
  return { url: `https://player.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}?${query}`, expires };
}

export function mapBunnyVideoStatus(status) {
  if ([0, 1, 2].includes(status)) return 'processing';
  if ([3, 4].includes(status)) return 'ready';
  if ([5, 8].includes(status)) return 'failed';
  if ([6, 7].includes(status)) return 'uploading';
  return null;
}

export function nextBunnyVideoStatus(current, incoming) {
  const next = mapBunnyVideoStatus(incoming);
  if (!next) return current ?? null;
  if (current === 'ready' && next !== 'failed') return 'ready';
  if (current === 'failed' && next !== 'uploading') return 'failed';
  return next;
}

export function canManageHostedVideo({ product, lesson, creatorId, productId, lessonId }) {
  return Boolean(product && product.id === productId && product.creatorId === creatorId && product.type === 'course'
    && lesson && lesson.id === lessonId && lesson.creatorId === creatorId && lesson.type === 'video' && !lesson.deletedAt);
}

/** @param {{ product: any, lesson: any, entitlement: any, order: any, userId?: string | null, guestBuyerId?: string | null }} input */
export function canAccessHostedVideo({ product, lesson, entitlement, order, userId = null, guestBuyerId = null }) {
  const principalMatches = userId ? entitlement?.userId === userId && order?.buyerUserId === userId
    : Boolean(guestBuyerId && entitlement?.guestBuyerId === guestBuyerId && order?.guestBuyerId === guestBuyerId);
  return Boolean(product && product.type === 'course' && product.status === 'published'
    && lesson && lesson.type === 'video' && lesson.status === 'published' && !lesson.deletedAt
    && lesson.bunnyVideoId && lesson.videoStatus === 'ready'
    && entitlement && principalMatches && entitlement.productId === product.id
    && entitlement.creatorId === product.creatorId && entitlement.orderId === order?.id && entitlement.status === 'active'
    && order && order.status === 'paid');
}
