import { and, count, eq } from 'drizzle-orm';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { mediaAssets, productFiles } from '@/src/server/db/schema';
import { DIGITAL_FILE_MAX_BYTES, getR2Client, getR2Config } from '@/lib/storage/r2';
import { validateProductFileCompletion } from '@/lib/storage/product-file-rules.mjs';

export const runtime = 'nodejs';
type Context = { params: Promise<{ assetId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const { creator } = await requireCreator();
    const { assetId } = await params;
    const [asset] = await getDatabase().select().from(mediaAssets).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready'))).limit(1);
    if (!asset) return NextResponse.json({ error: 'Media file not found.' }, { status: 404 });
    const { bucket } = getR2Config();
    const url = await getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: bucket, Key: asset.r2Key, ResponseContentDisposition: `attachment; filename="${asset.name.replace(/["\\\r\n]/g, '_')}"` }), { expiresIn: 60 });
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media download link failed', error);
    return NextResponse.json({ error: 'Could not prepare the private download.' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const { creator } = await requireCreator();
    const { assetId } = await params;
    const [asset] = await getDatabase().select().from(mediaAssets).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.creatorId, creator.id))).limit(1);
    if (!asset) return NextResponse.json({ error: 'Pending media upload not found.' }, { status: 404 });
    if (asset.status === 'ready') return NextResponse.json({ ready: true });
    const { bucket } = getR2Config();
    const client = getR2Client();
    let object;
    try { object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: asset.r2Key })); }
    catch { return NextResponse.json({ error: 'The file has not finished uploading. Retry verification.' }, { status: 409 }); }
    const signatureBytes = await client.send(new GetObjectCommand({ Bucket: bucket, Key: asset.r2Key, Range: 'bytes=0-31' })).then(async (response) => response.Body?.transformToByteArray() ?? new Uint8Array());
    const validationError = validateProductFileCompletion({ name: asset.name, contentType: asset.contentType, sizeBytes: asset.sizeBytes }, { contentLength: object.ContentLength ?? 0, contentType: object.ContentType ?? '', signatureBytes }, DIGITAL_FILE_MAX_BYTES);
    if (validationError) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.r2Key })).catch(() => undefined);
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    await getDatabase().update(mediaAssets).set({ status: 'ready', updatedAt: new Date() }).where(and(eq(mediaAssets.id, asset.id), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'pending')));
    return NextResponse.json({ ready: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media upload completion failed', error);
    return NextResponse.json({ error: 'Could not verify the uploaded media.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const { creator } = await requireCreator();
    const { assetId } = await params;
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 180 || /[\\/\0]/.test(name)) return NextResponse.json({ error: 'Enter a valid file name up to 180 characters.' }, { status: 400 });
    const db = getDatabase();
    const [existing] = await db.select({ name: mediaAssets.name, contentType: mediaAssets.contentType }).from(mediaAssets).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready'))).limit(1);
    if (!existing) return NextResponse.json({ error: 'Media file not found.' }, { status: 404 });
    const previousExtension = existing.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? '';
    const nextExtension = name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() ?? '';
    if (previousExtension !== nextExtension) return NextResponse.json({ error: 'Keep the original file extension so the file type stays accurate.' }, { status: 400 });
    const [updated] = await db.update(mediaAssets).set({ name, updatedAt: new Date() }).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready'))).returning({ id: mediaAssets.id, name: mediaAssets.name });
    if (!updated) return NextResponse.json({ error: 'Media file not found.' }, { status: 404 });
    await getDatabase().update(productFiles).set({ name }).where(and(eq(productFiles.assetId, assetId), eq(productFiles.creatorId, creator.id)));
    return NextResponse.json({ asset: updated });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media rename failed', error);
    return NextResponse.json({ error: 'Could not rename this file.' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { creator } = await requireCreator();
    const { assetId } = await params;
    const db = getDatabase();
    const [asset] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.creatorId, creator.id))).limit(1);
    if (!asset) return NextResponse.json({ error: 'Media file not found.' }, { status: 404 });
    const [attachments] = await db.select({ total: count() }).from(productFiles).where(and(eq(productFiles.assetId, asset.id), eq(productFiles.status, 'ready')));
    if ((attachments?.total ?? 0) > 0) return NextResponse.json({ error: 'This file is attached to a download product. Remove it from that product before deleting it from your library.' }, { status: 409 });
    try { const { bucket } = getR2Config(); await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.r2Key })); }
    catch { return NextResponse.json({ error: 'The private file could not be deleted. Try again.' }, { status: 503 }); }
    await db.delete(mediaAssets).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.creatorId, creator.id)));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media deletion failed', error);
    return NextResponse.json({ error: 'Could not delete this file.' }, { status: 503 });
  }
}
