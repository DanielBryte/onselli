import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getBuyerPrincipal } from '@/src/server/purchases/guest-access';
import { getDatabase } from '@/src/server/db';
import { courseSections, entitlements, lessons, orders, products } from '@/src/server/db/schema';
import { canAccessHostedVideo, signBunnyEmbed } from '@/lib/courses/bunny-stream.mjs';
import { bunnyStreamConfig } from '@/src/server/courses/bunny-stream';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; lessonId: string }> }) {
  try {
    const principal = await getBuyerPrincipal(); if (!principal) return NextResponse.json({ error: 'Verify your purchase email or sign in to continue.' }, { status: 401 });
    const entitlementOwner = principal.userId ? eq(entitlements.userId, principal.userId) : eq(entitlements.guestBuyerId, principal.guestBuyerId!);
    const orderOwner = principal.userId ? eq(orders.buyerUserId, principal.userId) : eq(orders.guestBuyerId, principal.guestBuyerId!);
    const { productId, lessonId } = await params;
    const db = getDatabase();
    const [row] = await db.select({ product: products, lesson: lessons, entitlement: entitlements, order: orders })
      .from(lessons).innerJoin(courseSections, eq(lessons.sectionId, courseSections.id))
      .innerJoin(products, eq(courseSections.productId, products.id))
      .innerJoin(entitlements, and(eq(entitlements.productId, products.id), eq(entitlements.creatorId, products.creatorId)))
      .innerJoin(orders, eq(entitlements.orderId, orders.id))
      .where(and(eq(products.id, productId), eq(lessons.id, lessonId), eq(courseSections.status, 'published'), isNull(lessons.deletedAt), entitlementOwner, eq(entitlements.status, 'active'), eq(orders.status, 'paid'), orderOwner))
      .limit(1);
    if (!row || !canAccessHostedVideo({ ...row, userId: principal.userId ?? '', guestBuyerId: principal.guestBuyerId ?? '' })) {
      return NextResponse.json({ error: 'This lesson video is unavailable for this account.' }, { status: 404 });
    }
    const config = bunnyStreamConfig();
    const signed = signBunnyEmbed({ libraryId: config.libraryId, tokenKey: config.tokenKey, videoId: row.lesson.bunnyVideoId!, ttlSeconds: 3600 });
    return NextResponse.json({ playbackUrl: signed.url, expiresAt: signed.expires }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Hosted course video playback authorization failed', error);
    return NextResponse.json({ error: 'This video is unavailable right now.' }, { status: 503 });
  }
}
