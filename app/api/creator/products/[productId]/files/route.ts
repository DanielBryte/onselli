import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { DIGITAL_FILE_MAX_BYTES, DIGITAL_FILE_TYPES, getR2Client, getR2Config } from '@/lib/storage/r2';

export const runtime = 'nodejs';

async function isProductOwner(productId: string, userId: string) {
  const admin = getAdminSupabase();
  const { data: product } = await admin.from('creator_products').select('id,creator_id,kind').eq('id', productId).maybeSingle();
  if (!product || product.kind !== 'DOWNLOAD') return null;
  const { data: creator } = await admin.from('creators').select('id').eq('id', product.creator_id).eq('user_id', userId).maybeSingle();
  return creator ? { admin, product, creator } : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to manage this download.' }, { status: 401 });
  const { productId } = await params;
  const owned = await isProductOwner(productId, user.id);
  if (!owned) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });
  const { data: file, error } = await owned.admin.from('creator_product_files').select('id,file_name,size_bytes,status').eq('product_id', productId).maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not load the download file.' }, { status: 500 });
  return NextResponse.json({ file: file ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to upload a product file.' }, { status: 401 });
  const { productId } = await params;
  const owned = await isProductOwner(productId, user.id);
  if (!owned) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });

  const body = await request.json().catch(() => null) as { fileName?: unknown; sizeBytes?: unknown } | null;
  if (!body || typeof body.fileName !== 'string' || typeof body.sizeBytes !== 'number' || !Number.isInteger(body.sizeBytes)) {
    return NextResponse.json({ error: 'Choose a valid file.' }, { status: 400 });
  }
  const extension = body.fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? '';
  const contentType = DIGITAL_FILE_TYPES[extension];
  const fileName = body.fileName.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 180) ?? '';
  if (!fileName || !contentType) return NextResponse.json({ error: 'Use a PDF, ZIP, EPUB, Office document, MP3, M4A, PNG, JPG, or WEBP file.' }, { status: 400 });
  if (body.sizeBytes < 1 || body.sizeBytes > DIGITAL_FILE_MAX_BYTES) return NextResponse.json({ error: 'Files must be 100 MB or smaller.' }, { status: 400 });

  const id = randomUUID();
  const objectKey = `${owned.creator.id}/${productId}/${id}${extension}`;
  const { error: insertError } = await owned.admin.from('creator_product_files').insert({
    id,
    product_id: productId,
    object_key: objectKey,
    file_name: fileName,
    content_type: contentType,
    size_bytes: body.sizeBytes,
    status: 'PENDING',
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.code === '23505' ? 'A file is already attached. Contact support if you need to replace it.' : 'Could not prepare the file upload.' }, { status: insertError.code === '23505' ? 409 : 500 });
  }

  try {
    const { bucket } = getR2Config();
    const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }), { expiresIn: 600 });
    return NextResponse.json({ fileId: id, uploadUrl, contentType });
  } catch {
    await owned.admin.from('creator_product_files').delete().eq('id', id);
    return NextResponse.json({ error: 'Could not prepare a secure upload. Check the R2 server configuration.' }, { status: 503 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to cancel this upload.' }, { status: 401 });
  const { productId } = await params;
  const owned = await isProductOwner(productId, user.id);
  if (!owned) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });
  const body = await request.json().catch(() => null) as { fileId?: unknown } | null;
  if (!body || typeof body.fileId !== 'string') return NextResponse.json({ error: 'Upload identity is missing.' }, { status: 400 });
  const { data: file } = await owned.admin.from('creator_product_files').select('id,object_key,status').eq('id', body.fileId).eq('product_id', productId).maybeSingle();
  if (!file) return NextResponse.json({ cancelled: true });
  if (file.status === 'READY') return NextResponse.json({ error: 'A completed product file cannot be cancelled here.' }, { status: 409 });
  try {
    const { bucket } = getR2Config();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await getR2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: file.object_key }));
  } catch {
    // Remove the pending record even when the object never reached the bucket.
  }
  const { error } = await owned.admin.from('creator_product_files').delete().eq('id', file.id).eq('status', 'PENDING');
  if (error) return NextResponse.json({ error: 'Could not cancel this upload.' }, { status: 500 });
  return NextResponse.json({ cancelled: true });
}
