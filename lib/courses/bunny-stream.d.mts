export const BUNNY_VIDEO_MAX_BYTES: number;
export const BUNNY_VIDEO_TYPES: Set<string>;
export function validateHostedVideoUpload(input: { name: unknown; contentType: unknown; sizeBytes: unknown }): string | null;
export function signBunnyTusUpload(input: { libraryId: string; apiKey: string; videoId: string; expires: number }): { libraryId: string; videoId: string; expires: number; signature: string };
export function signBunnyEmbed(input: { libraryId: string; tokenKey: string; videoId: string; nowSeconds?: number; ttlSeconds?: number }): { url: string; expires: number };
export function mapBunnyVideoStatus(status: number): 'uploading' | 'processing' | 'ready' | 'failed' | null;
export function nextBunnyVideoStatus(current: 'uploading' | 'processing' | 'ready' | 'failed' | null, incoming: number): 'uploading' | 'processing' | 'ready' | 'failed' | null;
export function canManageHostedVideo(input: { product: any; lesson: any; creatorId: string; productId: string; lessonId: string }): boolean;
export function canAccessHostedVideo(input: { product: any; lesson: any; entitlement: any; order: any; userId?: string | null; guestBuyerId?: string | null }): boolean;
