import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { getR2Client, getR2Config } from '@/lib/storage/r2';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to download this purchase.' }, { status: 401 });
  const { fileId } = await params;
  const admin = getAdminSupabase();
  const { data: file } = await admin.from('creator_product_files').select('id,product_id,object_key,file_name,content_type,status').eq('id', fileId).eq('status', 'READY').maybeSingle();
  if (!file) return NextResponse.json({ error: 'This file is unavailable.' }, { status: 404 });
  const { data: entitlement } = await admin.from('creator_entitlements').select('id').eq('buyer_user_id', user.id).eq('product_id', file.product_id).is('revoked_at', null).limit(1).maybeSingle();
  if (!entitlement) return NextResponse.json({ error: 'A completed purchase is required to download this file.' }, { status: 403 });

  try {
    const { bucket } = getR2Config();
    const safeName = file.file_name.replace(/[\r\n"\\]/g, '_');
    const url = await getSignedUrl(getR2Client(), new GetObjectCommand({
      Bucket: bucket,
      Key: file.object_key,
      ResponseContentType: 'application/octet-stream',
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    }), { expiresIn: 180 });
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Download service is temporarily unavailable.' }, { status: 503 });
  }
}
