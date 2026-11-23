import { and, eq } from 'drizzle-orm';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { mediaAssets } from '@/src/server/db/schema';
import { getR2Client, getR2Config } from '@/lib/storage/r2';

export const runtime = 'nodejs';
const PREVIEWABLE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { assetId } = await params;
    const [asset] = await getDatabase().select({ r2Key: mediaAssets.r2Key, contentType: mediaAssets.contentType }).from(mediaAssets)
      .where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready'))).limit(1);
    if (!asset || !PREVIEWABLE_IMAGE_TYPES.has(asset.contentType)) return NextResponse.json({ error: 'Image preview not found.' }, { status: 404 });
    const { bucket } = getR2Config();
    const object = await getR2Client().send(new GetObjectCommand({ Bucket: bucket, Key: asset.r2Key }));
    if (!object.Body) return NextResponse.json({ error: 'Image preview is unavailable.' }, { status: 404 });
    const headers = new Headers({
      'Content-Type': asset.contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (typeof object.ContentLength === 'number') headers.set('Content-Length', String(object.ContentLength));
    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Media image preview failed', error);
    return NextResponse.json({ error: 'Could not load the image preview.' }, { status: 503 });
  }
}
