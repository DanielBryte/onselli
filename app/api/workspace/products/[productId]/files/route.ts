import { randomUUID } from 'node:crypto';
import { and, asc, count, eq, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, mediaAssets, mediaFolders, productFiles, products } from '@/src/server/db/schema';
import { DIGITAL_FILE_MAX_BYTES, DIGITAL_FILE_TYPES, getR2Client, getR2Config } from '@/lib/storage/r2';
import { validateExternalDownloadUrl } from '@/lib/storage/external-download.mjs';

export const runtime = 'nodejs';
const MAX_PRODUCT_FILES = 20;
const STALE_UPLOAD_AGE_MS = 30 * 60 * 1000;

async function ownedProduct(productId: string, creatorId: string) {
  const [product] = await getDatabase().select().from(products)
    .where(and(eq(products.id, productId), eq(products.creatorId, creatorId), eq(products.type, 'download'))).limit(1);
  return product;
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { productId } = await params;
    const product = await ownedProduct(productId, creator.id);
    if (!product) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });
    const db = getDatabase();
    const files = await db.select({
      id: productFiles.id, asset_id: productFiles.assetId, file_name: productFiles.name, size_bytes: productFiles.sizeBytes,
      status: productFiles.status, position: productFiles.position, created_at: productFiles.createdAt,
    }).from(productFiles).where(and(eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id)))
      .orderBy(asc(productFiles.position), asc(productFiles.createdAt));
    const staleBefore = Date.now() - STALE_UPLOAD_AGE_MS;
    const staleFiles = files.filter((file) => file.status === 'pending' && new Date(file.created_at).getTime() < staleBefore);
    const staleIds = new Set<string>();
    for (const staleFile of staleFiles) {
      try {
        const removed = await db.transaction(async (tx) => {
          const [pending] = await tx.select({ id: productFiles.id, assetId: productFiles.assetId, r2Key: productFiles.r2Key }).from(productFiles)
            .where(and(eq(productFiles.id, staleFile.id), eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id), eq(productFiles.status, 'pending')))
            .for('update').limit(1);
          if (!pending) return false;
          const { bucket } = getR2Config();
          await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: pending.r2Key }));
          await tx.delete(productFiles).where(and(eq(productFiles.id, pending.id), eq(productFiles.creatorId, creator.id), eq(productFiles.status, 'pending')));
          if (pending.assetId) await tx.delete(mediaAssets).where(and(eq(mediaAssets.id, pending.assetId), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'pending')));
          return true;
        });
        if (removed) staleIds.add(staleFile.id);
      } catch (cleanupError) {
        console.warn('Expired product upload could not be cleaned up', staleFile.id, cleanupError);
      }
    }
    return NextResponse.json({
      product: { id: product.id, title: product.title, status: product.status, kind: product.type.toUpperCase() },
      files: files.filter((file) => !staleIds.has(file.id)).map((file) => ({ ...file, size_bytes: file.size_bytes.toString(), status: file.status.toUpperCase() })),
      delivery: { mode: product.downloadDeliveryMode, externalUrl: product.downloadExternalUrl },
      maxFiles: MAX_PRODUCT_FILES, maxFileBytes: DIGITAL_FILE_MAX_BYTES,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Product file lookup failed', error);
    return NextResponse.json({ error: 'Could not load the download files.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const product = await ownedProduct(productId, creator.id);
    if (!product) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });
    const body = await request.json().catch(() => null);
    if (body?.deliveryMode !== 'uploaded_files' && body?.deliveryMode !== 'external_link') {
      return NextResponse.json({ error: 'Choose private files or an external link.' }, { status: 400 });
    }

    let externalUrl: string | null = null;
    if (body.deliveryMode === 'external_link') {
      externalUrl = validateExternalDownloadUrl(body.externalUrl);
      if (!externalUrl) return NextResponse.json({ error: 'Enter a valid HTTPS link without a username or password.' }, { status: 400 });
    }

    const db = getDatabase();
    const [readyFile] = body.deliveryMode === 'uploaded_files' ? await db.select({ id: productFiles.id }).from(productFiles).where(and(
      eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id), eq(productFiles.status, 'ready'),
    )).limit(1) : [];
    const status = product.status === 'published' && body.deliveryMode === 'uploaded_files' && !readyFile ? 'draft' : product.status;
    const [updated] = await db.update(products).set({
      downloadDeliveryMode: body.deliveryMode, downloadExternalUrl: externalUrl, status, updatedAt: new Date(),
    }).where(and(eq(products.id, productId), eq(products.creatorId, creator.id), eq(products.type, 'download'))).returning({ id: products.id });
    if (!updated) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });
    await db.insert(auditLogs).values({
      actorUserId: session.user.id, action: 'product.download_delivery.updated', entityType: 'product', entityId: productId,
      before: { mode: product.downloadDeliveryMode }, after: { mode: body.deliveryMode },
    });
    return NextResponse.json({ delivery: { mode: body.deliveryMode, externalUrl }, productStatus: status });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Download delivery settings update failed', error);
    return NextResponse.json({ error: 'Download delivery settings could not be saved.' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    const product = await ownedProduct(productId, creator.id);
    if (!product) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });

    const body = await request.json().catch(() => null);
    if (typeof body?.assetId === 'string') {
      const db = getDatabase();
      const [asset] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, body.assetId), eq(mediaAssets.creatorId, creator.id), eq(mediaAssets.status, 'ready'))).limit(1);
      if (!asset) return NextResponse.json({ error: 'The selected library file is no longer available.' }, { status: 404 });
      const [result] = await db.transaction(async (tx) => {
        const [lockedProduct] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.creatorId, creator.id), eq(products.type, 'download'))).for('update').limit(1);
        if (!lockedProduct) return [{ error: 'Download offer not found.', status: 404 as const }];
        const [attached] = await tx.select({ id: productFiles.id }).from(productFiles).where(and(eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id), eq(productFiles.assetId, asset.id))).limit(1);
        if (attached) return [{ fileId: attached.id, reused: true, alreadyAttached: true }];
        const [existing] = await tx.select({ total: count() }).from(productFiles).where(and(eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id)));
        if ((existing?.total ?? 0) >= MAX_PRODUCT_FILES) return [{ error: `A download can contain up to ${MAX_PRODUCT_FILES} files.`, status: 409 as const }];
        const [position] = await tx.select({ total: count() }).from(productFiles).where(and(eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id)));
        const [file] = await tx.insert(productFiles).values({ creatorId: creator.id, productId, assetId: asset.id, r2Key: asset.r2Key, name: asset.name, contentType: asset.contentType, sizeBytes: asset.sizeBytes, status: 'ready', position: position?.total ?? 0 }).returning({ id: productFiles.id });
        if (!file) return [{ error: 'Could not attach the selected library file.', status: 503 as const }];
        return [{ fileId: file.id, reused: true }];
      });
      if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json(result);
    }
    if (!body || typeof body.fileName !== 'string' || body.fileName.length > 255 || !Number.isSafeInteger(body.sizeBytes)) {
      return NextResponse.json({ error: 'Choose a valid file.' }, { status: 400 });
    }
    const extension = body.fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
    const contentType = DIGITAL_FILE_TYPES[extension];
    const name = body.fileName.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 180) ?? '';
    if (!name || !contentType) return NextResponse.json({ error: 'Use a supported document, archive, audio, or image file.' }, { status: 400 });
    if (body.sizeBytes < 1 || body.sizeBytes > DIGITAL_FILE_MAX_BYTES) return NextResponse.json({ error: 'Files must be between 1 byte and 100 MB.' }, { status: 400 });
    if (body.replaceFileId !== undefined && typeof body.replaceFileId !== 'string') return NextResponse.json({ error: 'Choose a valid file to replace.' }, { status: 400 });

    const db = getDatabase();
    const [uploadsFolder] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(and(eq(mediaFolders.creatorId, creator.id), eq(mediaFolders.isDefault, true))).limit(1);
    let [defaultFolder] = uploadsFolder ? [uploadsFolder] : await db.insert(mediaFolders).values({ creatorId: creator.id, name: 'Uploads', isDefault: true }).onConflictDoNothing().returning({ id: mediaFolders.id });
    if (!defaultFolder) [defaultFolder] = await db.select({ id: mediaFolders.id }).from(mediaFolders).where(and(eq(mediaFolders.creatorId, creator.id), eq(mediaFolders.isDefault, true))).limit(1);
    if (!defaultFolder) throw new Error('Could not initialize the Uploads folder.');
    const file = await db.transaction(async (tx) => {
      // Locking the owned product serializes upload slots and prevents concurrent requests exceeding the cap.
      const [lockedProduct] = await tx.select({ id: products.id }).from(products)
        .where(and(eq(products.id, productId), eq(products.creatorId, creator.id), eq(products.type, 'download'))).for('update').limit(1);
      if (!lockedProduct) return { error: 'Download offer not found.', status: 404 as const };
      let replacement: { id: string; position: number } | undefined;
      if (body.replaceFileId) {
        [replacement] = await tx.select({ id: productFiles.id, position: productFiles.position }).from(productFiles).where(and(
          eq(productFiles.id, body.replaceFileId), eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id), eq(productFiles.status, 'ready'),
        )).limit(1);
        if (!replacement) return { error: 'The file selected for replacement is no longer available.', status: 409 as const };
      }
      const [existing] = await tx.select({ total: count() }).from(productFiles)
        .where(and(eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id), ...(body.replaceFileId ? [ne(productFiles.id, body.replaceFileId)] : [])));
      if ((existing?.total ?? 0) >= MAX_PRODUCT_FILES) return { error: `A download can contain up to ${MAX_PRODUCT_FILES} files.`, status: 409 as const };
      const [position] = await tx.select({ total: count() }).from(productFiles)
        .where(and(eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id)));
      const key = `${creator.id}/${productId}/${randomUUID()}${extension}`;
      const [asset] = await tx.insert(mediaAssets).values({ creatorId: creator.id, folderId: defaultFolder.id, r2Key: key, name, contentType, sizeBytes: BigInt(body.sizeBytes), status: 'pending' }).returning({ id: mediaAssets.id });
      if (!asset) throw new Error('Could not register the media asset.');
      const [row] = await tx.insert(productFiles).values({
        creatorId: creator.id, productId, assetId: asset.id, r2Key: key, name, contentType, sizeBytes: BigInt(body.sizeBytes),
        status: 'pending', position: replacement?.position ?? position?.total ?? 0,
      }).returning({ id: productFiles.id, assetId: productFiles.assetId, r2Key: productFiles.r2Key });
      if (!row) throw new Error('Could not prepare file upload.');
      return row;
    });
    if ('error' in file) return NextResponse.json({ error: file.error }, { status: file.status });

    try {
      const { bucket } = getR2Config();
      const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: bucket, Key: file.r2Key, ContentType: contentType }), { expiresIn: 600 });
      await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'product_file.upload_started', entityType: 'product_file', entityId: file.id, after: { productId, name, sizeBytes: body.sizeBytes } });
      return NextResponse.json({ fileId: file.id, uploadUrl, contentType, expiresInSeconds: 600 });
    } catch {
      await db.delete(productFiles).where(and(eq(productFiles.id, file.id), eq(productFiles.creatorId, creator.id), eq(productFiles.productId, productId)));
      if (file.assetId) await db.delete(mediaAssets).where(and(eq(mediaAssets.id, file.assetId), eq(mediaAssets.creatorId, creator.id)));
      return NextResponse.json({ error: 'Could not prepare a secure upload. Check R2 configuration and try again.' }, { status: 503 });
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Product file upload preparation failed', error);
    return NextResponse.json({ error: 'Could not prepare the file upload.' }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { productId } = await params;
    if (!await ownedProduct(productId, creator.id)) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });
    const body = await request.json().catch(() => null);
    if (typeof body?.fileId !== 'string') return NextResponse.json({ error: 'File identity is missing.' }, { status: 400 });
    const db = getDatabase();
    const [file] = await db.select().from(productFiles).where(and(
      eq(productFiles.id, body.fileId), eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id),
    )).limit(1);
    if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 });
    if (file.status === 'ready' && !file.assetId) {
      try {
        const { bucket } = getR2Config();
        await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: file.r2Key }));
      } catch {
        return NextResponse.json({ error: 'The file could not be removed from private storage. Try again.' }, { status: 503 });
      }
    }
    if (file.status === 'pending') {
      try {
        const { bucket } = getR2Config();
        await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: file.r2Key }));
      } catch { return NextResponse.json({ error: 'The incomplete upload could not be cleared from storage. Try again.' }, { status: 503 }); }
    }
    await db.transaction(async (tx) => {
      if (file.status === 'ready') {
        const [readyFiles] = await tx.select({ total: count() }).from(productFiles).where(and(
          eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id), eq(productFiles.status, 'ready'),
        ));
        if ((readyFiles?.total ?? 0) <= 1) await tx.update(products).set({ status: 'draft', updatedAt: new Date() })
          .where(and(eq(products.id, productId), eq(products.creatorId, creator.id), eq(products.status, 'published'), eq(products.downloadDeliveryMode, 'uploaded_files')));
      }
      await tx.delete(productFiles).where(and(eq(productFiles.id, file.id), eq(productFiles.productId, productId), eq(productFiles.creatorId, creator.id)));
      if (file.status === 'pending' && file.assetId) await tx.delete(mediaAssets).where(and(eq(mediaAssets.id, file.assetId), eq(mediaAssets.creatorId, creator.id)));
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'product_file.removed', entityType: 'product_file', entityId: file.id, after: { productId, name: file.name } });
    });
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Product file removal failed', error);
    return NextResponse.json({ error: 'Could not remove this file.' }, { status: 503 });
  }
}
