import { NextResponse } from 'next/server';
import { DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { DIGITAL_FILE_MAX_BYTES, getR2Client, getR2Config } from '@/lib/storage/r2';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to finish this upload.' }, { status: 401 });
  const { productId } = await params;
  const admin = getAdminSupabase();
  const { data: product } = await admin.from('creator_products').select('id,creator_id,kind').eq('id', productId).maybeSingle();
  if (!product || product.kind !== 'DOWNLOAD') return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });
  const { data: creator } = await admin.from('creators').select('id').eq('id', product.creator_id).eq('user_id', user.id).maybeSingle();
  if (!creator) return NextResponse.json({ error: 'Download offer not found.' }, { status: 404 });

  const body = await request.json().catch(() => null) as { fileId?: unknown } | null;
  if (!body || typeof body.fileId !== 'string') return NextResponse.json({ error: 'Upload identity is missing.' }, { status: 400 });
  const { data: file } = await admin.from('creator_product_files').select('id,object_key,content_type,size_bytes,status').eq('id', body.fileId).eq('product_id', productId).maybeSingle();
  if (!file) return NextResponse.json({ error: 'Pending upload not found.' }, { status: 404 });
  if (file.status === 'READY') return NextResponse.json({ ready: true });

  const { bucket } = getR2Config();
  const client = getR2Client();
  let object;
  try {
    object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: file.object_key }));
  } catch {
    return NextResponse.json({ error: 'The file has not finished uploading. Try again.' }, { status: 409 });
  }
  if (!object.ContentLength || object.ContentLength !== Number(file.size_bytes) || object.ContentLength > DIGITAL_FILE_MAX_BYTES || object.ContentType !== file.content_type) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: file.object_key })).catch(() => undefined);
    await admin.from('creator_product_files').delete().eq('id', file.id);
    return NextResponse.json({ error: 'The uploaded file did not match its declared type or size. Start the upload again.' }, { status: 400 });
  }
  const { error } = await admin.from('creator_product_files').update({ status: 'READY' }).eq('id', file.id).eq('status', 'PENDING');
  if (error) return NextResponse.json({ error: 'Could not finish registering the uploaded file.' }, { status: 500 });
  return NextResponse.json({ ready: true });
}
