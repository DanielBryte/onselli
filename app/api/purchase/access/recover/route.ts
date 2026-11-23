import { and, desc, eq, ilike, isNotNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/server/db';
import { orders } from '@/src/server/db/schema';
import { checkPublicRateLimit } from '@/src/server/security/rate-limit';
import { createGuestPurchaseAccess } from '@/src/server/purchases/guest-access';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const generic = { message: 'If a matching paid purchase is available, we’ll send a fresh access email.' };
  try {
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const limit = await checkPublicRateLimit(`guest-recover:${address}`);
    if (!limit.success) return NextResponse.json(generic, { status: 200 });
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254) {
      const [order] = await getDatabase().select({ id: orders.id }).from(orders).where(and(eq(orders.status, 'paid'), ilike(orders.buyerEmail, email), isNotNull(orders.guestBuyerId))).orderBy(desc(orders.paidAt)).limit(1);
      if (order) await createGuestPurchaseAccess(order.id, true).catch((error) => console.error('Guest recovery email could not be sent', error));
    }
    return NextResponse.json(generic, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('Guest purchase recovery failed', error); return NextResponse.json(generic, { headers: { 'Cache-Control': 'no-store' } }); }
}
