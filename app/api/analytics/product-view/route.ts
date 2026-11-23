import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/server/db';
import { analyticsEvents, products } from '@/src/server/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.productId !== 'string' || body.productId.length > 80) return NextResponse.json({ ok: false }, { status: 400 });
    const [product] = await getDatabase().select({ creatorId: products.creatorId }).from(products).where(eq(products.id, body.productId)).limit(1);
    if (!product) return NextResponse.json({ ok: false }, { status: 404 });
    let referrerHost: string | null = null;
    try {
      const referer = request.headers.get('referer');
      if (referer) {
        const parsed = new URL(referer);
        if (parsed.origin !== new URL(request.url).origin) referrerHost = parsed.hostname.slice(0, 253).toLowerCase();
      }
    } catch { /* Invalid referrers are left unattributed. */ }
    await getDatabase().insert(analyticsEvents).values({ creatorId: product.creatorId, type: 'page_view', pageType: 'product', refId: body.productId, referrerHost });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
