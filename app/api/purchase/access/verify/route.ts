import { NextResponse } from 'next/server';
import { checkPublicRateLimit } from '@/src/server/security/rate-limit';
import { verifyGuestPurchaseToken } from '@/src/server/purchases/guest-access';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const limit = await checkPublicRateLimit(`guest-verify:${address}`);
    if (!limit.success) return NextResponse.json({ error: 'Too many attempts. Wait a moment and try again.' }, { status: 429 });
    const body = await request.json().catch(() => null);
    const token = typeof body?.token === 'string' ? body.token : '';
    const result = await verifyGuestPurchaseToken(token);
    if (!result) return NextResponse.json({ error: 'This access link is invalid, expired, or already used. Request a fresh email link.' }, { status: 400 });
    return NextResponse.json({ verified: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { console.error('Guest purchase verification failed', error); return NextResponse.json({ error: 'Could not verify this link. Try again shortly.' }, { status: 503 }); }
}
