import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { creators } from '@/src/server/db/schema';
import { createBachsAccountLink } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { creator } = await requireCreator();
    const db = getDatabase();
    const [row] = await db.select({ accountId: creators.bachsAccountId }).from(creators).where(eq(creators.id, creator.id)).limit(1);
    if (!row?.accountId) return NextResponse.redirect(new URL('/workspace/earnings?connect=setup', request.url));
    const origin = new URL(request.url).origin;
    const link = await createBachsAccountLink(row.accountId, {
      returnUrl: new URL('/workspace/earnings?connect=return', origin).toString(),
      refreshUrl: new URL('/api/workspace/payouts/connect/refresh', origin).toString(),
    });
    return NextResponse.redirect(link.url);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.redirect(new URL('/login?next=%2Fworkspace%2Fearnings', request.url));
    console.error('Bachs onboarding refresh link failed');
    return NextResponse.redirect(new URL('/workspace/earnings?connect=error', request.url));
  }
}
