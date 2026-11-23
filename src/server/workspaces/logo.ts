import 'server-only';

import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client } from '@/lib/storage/r2';
import { getWorkspaceAvatarPresetFromKey } from '@/src/shared/workspace-avatar-presets';

export const CREATOR_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const PRODUCT_COVER_MAX_BYTES = 8 * 1024 * 1024;

const imageTypes = {
  'image/png': { extension: 'png', signature: (bytes: Uint8Array) => bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
  'image/jpeg': { extension: 'jpg', signature: (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  'image/webp': { extension: 'webp', signature: (bytes: Uint8Array) => bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' },
} as const;
const productCoverImageTypes = {
  ...imageTypes,
  'image/gif': { extension: 'gif', signature: (bytes: Uint8Array) => bytes.length >= 6 && (String.fromCharCode(...bytes.slice(0, 6)) === 'GIF87a' || String.fromCharCode(...bytes.slice(0, 6)) === 'GIF89a') },
} as const;

export type CreatorLogoContentType = keyof typeof imageTypes;

export function getCreatorLogoUrl(key: string | null | undefined) {
  const preset = getWorkspaceAvatarPresetFromKey(key);
  if (preset) return preset.src;
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (!key || !baseUrl) return null;
  return `${baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export function isCreatorLogoContentType(value: string): value is CreatorLogoContentType {
  return Object.hasOwn(imageTypes, value);
}

export async function storeCreatorLogo(userId: string, file: File) {
  if (!isCreatorLogoContentType(file.type)) throw new Error('Choose a PNG, JPG, or WebP image.');
  if (!file.size || file.size > CREATOR_LOGO_MAX_BYTES) throw new Error('Your logo must be smaller than 2 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageTypes[file.type].signature(bytes)) throw new Error('This file does not match its image type. Choose a PNG, JPG, or WebP image.');
  const bucket = process.env.R2_PUBLIC_BUCKET_NAME;
  if (!bucket || !process.env.R2_PUBLIC_BASE_URL) throw new Error('Logo storage needs a dedicated public R2 bucket and domain. Configure R2_PUBLIC_BUCKET_NAME and R2_PUBLIC_BASE_URL first.');

  const key = `creator-logos/${userId}/${crypto.randomUUID()}.${imageTypes[file.type].extension}`;
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentLength: bytes.length,
    ContentType: file.type,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: { owner: userId },
  }));
  return { key, url: getCreatorLogoUrl(key) };
}

export async function validateCreatorLogoKey(userId: string, key: unknown) {
  if (key === undefined || key === null || key === '') return null;
  if (typeof key === 'string' && getWorkspaceAvatarPresetFromKey(key)) return key;
  if (typeof key !== 'string' || !key.startsWith(`creator-logos/${userId}/`) || key.includes('..')) throw new Error('Choose a logo uploaded to this account.');
  const bucket = process.env.R2_PUBLIC_BUCKET_NAME;
  if (!bucket) throw new Error('Logo storage needs a dedicated public R2 bucket. Configure R2_PUBLIC_BUCKET_NAME first.');
  const object = await getR2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.ContentLength || object.ContentLength > CREATOR_LOGO_MAX_BYTES || !object.ContentType || !isCreatorLogoContentType(object.ContentType)) {
    throw new Error('The uploaded logo is invalid or has expired. Upload it again.');
  }
  return key;
}

export async function storeProductCover(creatorId: string, productId: string, file: File) {
  if (!Object.hasOwn(productCoverImageTypes, file.type)) throw new Error('Choose a PNG, JPG, WebP, or GIF image.');
  if (!file.size || file.size > PRODUCT_COVER_MAX_BYTES) throw new Error('Your cover must be smaller than 8 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageType = productCoverImageTypes[file.type as keyof typeof productCoverImageTypes];
  if (!imageType.signature(bytes)) throw new Error('This file does not match its image type. Choose another image.');
  const bucket = process.env.R2_PUBLIC_BUCKET_NAME;
  if (!bucket || !process.env.R2_PUBLIC_BASE_URL) throw new Error('Cover uploads need a dedicated public R2 bucket and domain. Configure R2_PUBLIC_BUCKET_NAME and R2_PUBLIC_BASE_URL first.');
  const key = `product-covers/${creatorId}/${productId}/${crypto.randomUUID()}.${imageType.extension}`;
  await getR2Client().send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: bytes, ContentLength: bytes.length, ContentType: file.type,
    CacheControl: 'public, max-age=31536000, immutable', Metadata: { owner: creatorId, productId },
  }));
  return { key, url: getCreatorLogoUrl(key) };
}
