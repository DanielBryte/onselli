import { and, asc, eq, gte, sql, sum } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { ledgerEntries } from '@/src/server/db/schema';

export const runtime = 'nodejs';

type Range = '7' | '30' | '90' | 'all';
type Currency = string;

export async function GET(request: Request) {
  try {
    const { creator } = await requireCreator();
    const params = new URL(request.url).searchParams;
    const range = (params.get('range') ?? '30') as Range;
    const currency = (params.get('currency') ?? 'NGN').toUpperCase() as Currency;
    if (!['7', '30', '90', 'all'].includes(range)) return NextResponse.json({ error: 'Choose a valid date range.' }, { status: 400 });
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: 'Choose a valid balance currency.' }, { status: 400 });

    const unit = range === 'all' ? 'month' : 'day';
    const since = range === 'all' ? null : new Date(Date.now() - Number(range) * 86_400_000);
    // Bucket explicitly in UTC so daily totals do not shift with the database session timezone.
    const periodExpr = unit === 'month'
      ? sql<string>`to_char(date_trunc('month', ${ledgerEntries.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-01')`
      : sql<string>`to_char(date_trunc('day', ${ledgerEntries.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`;
    const db = getDatabase();
    const rows = await db.select({ period: periodExpr, amountMinor: sum(ledgerEntries.amountMinor) })
      .from(ledgerEntries)
      .where(and(
        eq(ledgerEntries.creatorId, creator.id),
        eq(ledgerEntries.currency, currency),
        eq(ledgerEntries.bucket, 'available'),
        ...(since ? [gte(ledgerEntries.createdAt, since)] : []),
      ))
      .groupBy(periodExpr)
      .orderBy(asc(periodExpr));

    const totals = new Map(rows.map(row => [row.period, String(row.amountMinor ?? 0)]));
    const points: { period: string; amountMinor: string }[] = [];
    if (rows.length) {
      const now = new Date();
      const cursor = unit === 'month'
        ? new Date(`${rows[0]!.period}T00:00:00.000Z`)
        : new Date(Date.UTC(since!.getUTCFullYear(), since!.getUTCMonth(), since!.getUTCDate()));
      const end = unit === 'month'
        ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      while (cursor <= end) {
        const period = unit === 'month' ? cursor.toISOString().slice(0, 7) + '-01' : cursor.toISOString().slice(0, 10);
        points.push({ period, amountMinor: totals.get(period) ?? '0' });
        if (unit === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        else cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    return NextResponse.json({ currency, range, unit, points }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Creator wallet trend load failed', error);
    return NextResponse.json({ error: 'Wallet activity is temporarily unavailable.' }, { status: 503 });
  }
}
