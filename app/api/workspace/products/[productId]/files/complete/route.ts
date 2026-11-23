import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, mediaAssets, productFiles, products } from '@/src/server/db/schema';
import { DIGITAL_FILE_MAX_BYTES, getR2Client, getR2Config } from '@/lib/storage/r2';
import { ownsProductFile, validateProductFileCompletion } from '@/lib/storage/product-file-rules.mjs';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const db = getDatabase();
    const [product] = await db.select({ id: products.id }).from(products).where(and(
      eq(products.id, productId), eq(products.creatorId, creator.id), eq(products.type, 'download'),
    )).limit(1);
    if (!product) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (typeof body?.fileId !== 'string') return NextResponse.json({ error: 'Upload identity is missing.' }, { status: 400 });
    const [file] = await db.select().from(productFiles).where(and(
      eq(productFiles.id, body.fileId), eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id),
    )).limit(1);
    if (!file) return NextResponse.json({ error: 'Pending upload not found.' }, { status: 404 });

    let replacedFile: typeof file | undefined;
    if (body.replaceFileId !== undefined) {
      if (typeof body.replaceFileId !== 'string' || body.replaceFileId === file.id) return NextResponse.json({ error: 'Choose a valid file to replace.' }, { status: 400 });
      [replacedFile] = await db.select().from(productFiles).where(and(
        eq(productFiles.id, body.replaceFileId), eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id),
      )).limit(1);
      if (!replacedFile && file.status === 'ready') return NextResponse.json({ ready: true, replacementAlreadyCompleted: true });
      if (!replacedFile || replacedFile.status !== 'ready' || !ownsProductFile(replacedFile, { creatorId: creator.id, productId })) {
        return NextResponse.json({ error: 'The file selected for replacement is no longer available.' }, { status: 409 });
      }
    }

    const { bucket } = getR2Config();
    const client = getR2Client();
    if (file.status !== 'ready') {
      let object;
      try {
        object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: file.r2Key }));
      } catch {
        return NextResponse.json({ error: 'The file has not finished uploading. You can retry verification.' }, { status: 409 });
      }
      const validationError = validateProductFileCompletion(file, {
        contentLength: object.ContentLength ?? 0,
        contentType: object.ContentType ?? '',
        signatureBytes: await client.send(new GetObjectCommand({ Bucket: bucket, Key: file.r2Key, Range: 'bytes=0-31' }))
          .then(async (response) => response.Body?.transformToByteArray() ?? new Uint8Array()),
      }, DIGITAL_FILE_MAX_BYTES);
      if (validationError) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.r2Key })).catch(() => undefined);
        await db.delete(productFiles).where(and(eq(productFiles.id, file.id), eq(productFiles.creatorId, creator.id), eq(productFiles.productId, productId)));
        if (file.assetId) await db.delete(mediaAssets).where(and(eq(mediaAssets.id, file.assetId), eq(mediaAssets.creatorId, creator.id)));
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      await db.transaction(async (tx) => {
        await tx.update(productFiles).set({ status: 'ready' }).where(and(
          eq(productFiles.id, file.id), eq(productFiles.creatorId, creator.id), eq(productFiles.productId, productId), eq(productFiles.status, 'pending'),
        ));
        if (file.assetId) await tx.update(mediaAssets).set({ status: 'ready', updatedAt: new Date() }).where(and(eq(mediaAssets.id, file.assetId), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'pending')));
        await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'product_file.upload_completed', entityType: 'product_file', entityId: file.id, after: { productId, name: file.name } });
      });
    }

    if (replacedFile) {
      try {
        if (!replacedFile.assetId) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: replacedFile.r2Key }));
        await db.delete(productFiles).where(and(eq(productFiles.id, replacedFile.id), eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id)));
        await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'product_file.replaced', entityType: 'product_file', entityId: file.id, after: { productId, replacedFileId: replacedFile.id } });
      } catch {
        // New file is ready; old file remains listed so the creator can remove it later.
        return NextResponse.json({ ready: true, replacementCleanupPending: true, error: 'The new file is ready, but the old file could not be removed. Remove it from the file list when storage is available.' });
      }
    }
    return NextResponse.json({ ready: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('File upload completion failed', error);
    return NextResponse.json({ error: 'Could not finish registering the file.' }, { status: 503 });
  }
}
