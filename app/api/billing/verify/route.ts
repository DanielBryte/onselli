import { NextResponse } from 'next/server';
import { AuthorizationError, requireBuyer } from '@/src/server/auth/permissions';
import { and, eq } from 'drizzle-orm';
import { getDatabase } from '@/src/server/db';
import { billingTransactions } from '@/src/server/db/schema';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await requireBuyer();
    const reference = new URL(request.url).searchParams.get('reference') ?? '';
    if (!reference || reference.length > 100) return NextResponse.json({ error: 'A valid payment reference is required.' }, { status: 400 });
    const [transaction] = await getDatabase().select().from(billingTransactions).where(and(eq(billingTransactions.reference, reference), eq(billingTransactions.userId, session.user.id))).limit(1);
    if (!transaction) return NextResponse.json({ error: 'This billing transaction could not be found.' }, { status: 404 });
    if (transaction.status === 'failed') return NextResponse.json({ error: 'The subscription payment was not completed.' }, { status: 409 });
    // Bachs subscription webhooks are authoritative. Redirects never grant paid access.
    if (transaction.status !== 'complete') return NextResponse.json({ pending: true }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ verified: true, planId: transaction.planId, currency: transaction.currency }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Payment could not be verified.' }, { status: 400 });
  }
}
