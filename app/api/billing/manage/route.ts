import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireBuyer } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { userSubscriptions } from '@/src/server/db/schema';
import { bachsRequest } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await requireBuyer();
    if (!process.env.BACHS_API_KEY) return NextResponse.json({ error: 'Subscription management is not configured.' }, { status: 503 });
    const [subscription] = await getDatabase().select({ customerId: userSubscriptions.providerCustomerCode })
      .from(userSubscriptions).where(eq(userSubscriptions.userId, session.user.id)).limit(1);
    if (!subscription?.customerId) return NextResponse.json({ error: 'Your subscription is still syncing. Try again in a moment.' }, { status: 409 });
    const result = await bachsRequest<{ url?: string }>(`/v1/customers/${encodeURIComponent(subscription.customerId)}/portal-sessions`, { method: 'POST' });
    const manageUrl = result.url;
    if (typeof manageUrl !== 'string' || !manageUrl.startsWith('https://portal.bachs.io/')) return NextResponse.json({ error: 'Bachs could not open subscription management. Please contact support.' }, { status: 502 });
    return NextResponse.json({ manageUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Subscription management link failed', error);
    return NextResponse.json({ error: 'Your subscription settings could not be opened.' }, { status: 503 });
  }
}
