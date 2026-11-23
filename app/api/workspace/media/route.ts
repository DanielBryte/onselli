import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { mediaAssets, mediaFolders, productFiles } from '@/src/server/db/schema';
import { DIGITAL_FILE_MAX_BYTES, DIGITAL_FILE_TYPES, getR2Client, getR2Config } from '@/lib/storage/r2';

export const runtime = 'nodejs';
const PREVIEWABLE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

async function ensureUploadsFolder(creatorId: string) {
  const db = getDatabase();
  const [folder] = await db.select().from(mediaFolders).where(and(eq(mediaFolders.creatorId, creatorId), eq(mediaFolders.isDefault, true))).limit(1);
  if (folder) return folder;
  const [created] = await db.insert(mediaFolders).values({ creatorId, name: 'Uploads', isDefault: true }).onConflictDoNothing().returning();
  if (created) return created;
  const [raced] = await db.select().from(mediaFolders).where(and(eq(mediaFolders.creatorId, creatorId), eq(mediaFolders.isDefault, true))).limit(1);
  if (!raced) throw new Error('Could not initialize the Uploads folder.');
  return raced;
}

export async function GET() {
  try {
    const { creator } = await requireCreator();
    const db = getDatabase();
    const uploads = await ensureUploadsFolder(creator.id);
    const folders = await db.select({ id: mediaFolders.id, name: mediaFolders.name, isDefault: mediaFolders.isDefault }).from(mediaFolders)
      .where(eq(mediaFolders.creatorId, creator.id)).orderBy(asc(mediaFolders.createdAt));
    const rows = await db.select({ id: mediaAssets.id, folderId: mediaAssets.folderId, name: mediaAssets.name, contentType: mediaAssets.contentType, sizeBytes: mediaAssets.sizeBytes, createdAt: mediaAssets.createdAt, r2Key: mediaAssets.r2Key })
      .from(mediaAssets).where(and(eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready'))).orderBy(asc(mediaAssets.createdAt));
    const assets = await Promise.all(rows.map(async (asset) => ({
      id: asset.id, folderId: asset.folderId ?? uploads.id, name: asset.name, contentType: asset.contentType,
      sizeBytes: asset.sizeBytes.toString(), createdAt: asset.createdAt,
      previewUrl: PREVIEWABLE_IMAGE_TYPES.has(asset.contentType) ? `/api/workspace/media/${encodeURIComponent(asset.id)}/preview` : null,
    })));
    const counts = await db.select({ folderId: mediaAssets.folderId, total: count() }).from(mediaAssets)
      .where(and(eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready'))).groupBy(mediaAssets.folderId);
    const countByFolder = new Map(counts.map((row) => [row.folderId ?? uploads.id, row.total]));
    return NextResponse.json({ folders: folders.map((folder) => ({ ...folder, count: countByFolder.get(folder.id) ?? 0 })), assets }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media library lookup failed', error);
    return NextResponse.json({ error: 'Could not load media files.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const { creator } = await requireCreator();
    const body = await request.json().catch(() => null);
    if (!body || typeof body.fileName !== 'string' || !Number.isSafeInteger(body.sizeBytes)) return NextResponse.json({ error: 'Choose a valid file.' }, { status: 400 });
    const extension = body.fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
    const contentType = DIGITAL_FILE_TYPES[extension];
    const name = body.fileName.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 180) ?? '';
    if (!name || !contentType) return NextResponse.json({ error: 'This file type is not supported.' }, { status: 400 });
    if (body.sizeBytes < 1 || body.sizeBytes > DIGITAL_FILE_MAX_BYTES) return NextResponse.json({ error: 'Files must be between 1 byte and 100 MB.' }, { status: 400 });
    const uploads = await ensureUploadsFolder(creator.id);
    const db = getDatabase();
    const folderId = typeof body.folderId === 'string' ? body.folderId : uploads.id;
    const [folder] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(and(eq(mediaFolders.id, folderId), eq(mediaFolders.creatorId, creator.id))).limit(1);
    if (!folder) return NextResponse.json({ error: 'The selected folder is unavailable.' }, { status: 404 });
    const key = `${creator.id}/media/${randomUUID()}${extension}`;
    const [asset] = await db.insert(mediaAssets).values({ creatorId: creator.id, folderId, r2Key: key, name, contentType, sizeBytes: BigInt(body.sizeBytes), status: 'pending' }).returning({ id: mediaAssets.id });
    if (!asset) throw new Error('Could not create the media record.');
    try {
      const { bucket } = getR2Config();
      const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 600 });
      return NextResponse.json({ assetId: asset.id, uploadUrl, contentType, expiresInSeconds: 600 });
    } catch (error) {
      await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
      throw error;
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media upload preparation failed', error);
    return NextResponse.json({ error: 'Could not prepare a secure upload.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { creator } = await requireCreator();
    const body = await request.json().catch(() => null);
    const db = getDatabase();
    if (body?.action === 'create_folder') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 80) return NextResponse.json({ error: 'Folder names must be 1–80 characters.' }, { status: 400 });
      const folders = await db.select({ name: mediaFolders.name }).from(mediaFolders).where(eq(mediaFolders.creatorId, creator.id));
      if (folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: 'A folder with that name already exists.' }, { status: 409 });
      const [folder] = await db.insert(mediaFolders).values({ creatorId: creator.id, name }).returning({ id: mediaFolders.id, name: mediaFolders.name });
      return NextResponse.json({ folder });
    }
    if (body?.action === 'rename_folder') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (typeof body.folderId !== 'string' || !name || name.length > 80) return NextResponse.json({ error: 'Enter a valid folder name.' }, { status: 400 });
      const [folder] = await db.select().from(mediaFolders).where(and(eq(mediaFolders.id, body.folderId), eq(mediaFolders.creatorId, creator.id))).limit(1);
      if (!folder) return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });
      const siblings = await db.select({ id: mediaFolders.id, name: mediaFolders.name }).from(mediaFolders).where(eq(mediaFolders.creatorId, creator.id));
      if (siblings.some((item) => item.id !== folder.id && item.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: 'A folder with that name already exists.' }, { status: 409 });
      const [updated] = await db.update(mediaFolders).set({ name }).where(eq(mediaFolders.id, folder.id)).returning({ id: mediaFolders.id, name: mediaFolders.name });
      return NextResponse.json({ folder: updated });
    }
    if (body?.action === 'delete_folder') {
      if (typeof body.folderId !== 'string') return NextResponse.json({ error: 'Folder identity is missing.' }, { status: 400 });
      const [folder] = await db.select().from(mediaFolders).where(and(eq(mediaFolders.id, body.folderId), eq(mediaFolders.creatorId, creator.id))).limit(1);
      if (!folder) return NextResponse.json({ error: 'Folder not found.' }, { status: 404 });
      if (folder.isDefault) return NextResponse.json({ error: 'The Uploads folder is permanent and cannot be deleted.' }, { status: 409 });
      const [uploads] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(and(eq(mediaFolders.creatorId, creator.id), eq(mediaFolders.isDefault, true))).limit(1);
      if (!uploads) return NextResponse.json({ error: 'The default Uploads folder is unavailable.' }, { status: 503 });
      await db.transaction(async (tx) => {
        await tx.update(mediaAssets).set({ folderId: uploads.id, updatedAt: new Date() }).where(and(eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.folderId, folder.id)));
        await tx.delete(mediaFolders).where(and(eq(mediaFolders.id, folder.id), eq(mediaFolders.creatorId, creator.id)));
      });
      return NextResponse.json({ deleted: true, movedTo: uploads.id });
    }
    if (body?.action === 'move') {
      if (!Array.isArray(body.assetIds) || !body.assetIds.length || body.assetIds.some((id: unknown) => typeof id !== 'string') || typeof body.folderId !== 'string') return NextResponse.json({ error: 'Choose files and a destination folder.' }, { status: 400 });
      const [folder] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(and(eq(mediaFolders.id, body.folderId), eq(mediaFolders.creatorId, creator.id))).limit(1);
      if (!folder) return NextResponse.json({ error: 'Destination folder not found.' }, { status: 404 });
      const ids = [...new Set(body.assetIds as string[])];
      const owned = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(inArray(mediaAssets.id, ids), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready')));
      if (owned.length !== ids.length) return NextResponse.json({ error: 'One or more files are no longer available.' }, { status: 404 });
      await db.update(mediaAssets).set({ folderId: folder.id, updatedAt: new Date() }).where(and(inArray(mediaAssets.id, ids), eq(mediaAssets.creatorId, creator.id)));
      return NextResponse.json({ moved: ids.length });
    }
    return NextResponse.json({ error: 'Unsupported media action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media library update failed', error);
    return NextResponse.json({ error: 'Could not update the media library.' }, { status: 503 });
  }
}
