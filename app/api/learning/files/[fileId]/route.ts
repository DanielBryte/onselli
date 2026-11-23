import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { entitlements, orders, productFiles } from '@/src/server/db/schema';
import { getR2Client, getR2Config } from '@/lib/storage/r2';
import { canDownloadProductFile } from '@/lib/storage/product-file-rules.mjs';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 }); const { fileId } = await params; const db = getDatabase();
    const entitlementOwner = principal.userId ? eq(entitlements.userId, principal.userId) : eq(entitlements.guestBuyerId, principal.guestBuyerId!);
    const orderOwner = principal.userId ? eq(orders.buyerUserId, principal.userId) : eq(orders.guestBuyerId, principal.guestBuyerId!);
    const [file] = await db.select().from(productFiles).where(eq(productFiles.id, fileId)).limit(1);
    if (!file || file.status !== 'ready') return NextResponse.json({ error: 'This file is unavailable.' }, { status: 404 });
    const [access] = await db.select({ entitlement: entitlements, order: orders }).from(entitlements)
      .innerJoin(orders, eq(entitlements.orderId, orders.id))
      .where(and(
        entitlementOwner, eq(entitlements.productId, file.productId),
        eq(entitlements.creatorId, file.creatorId), eq(entitlements.status, 'active'),
        eq(orders.status, 'paid'), orderOwner,
      )).limit(1);
    if (!canDownloadProductFile({ file, entitlement: access?.entitlement, order: access?.order, userId: principal.userId ?? '', guestBuyerId: principal.guestBuyerId ?? '' })) {
      return NextResponse.json({ error: 'A completed purchase with active access is required to download this file.' }, { status: 403 });
    }
    const { bucket } = getR2Config(); const safeName = file.name.replace(/[\r\n"\\]/g, '_');
    const url = await getSignedUrl(getR2Client(), new GetObjectCommand({ Bucket: bucket, Key: file.r2Key, ResponseContentType: 'application/octet-stream', ResponseContentDisposition: `attachment; filename="${safeName}"` }), { expiresIn: 180 });
    return NextResponse.json({ url }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { console.error('Secure download failed', error); return NextResponse.json({ error: 'Download service is temporarily unavailable.' }, { status: 503 }); }
}
