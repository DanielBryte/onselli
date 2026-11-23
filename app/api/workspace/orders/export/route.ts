import { and, desc, eq, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { contacts, orders, users } from '@/src/server/db/schema';
import { currencyMinorToDecimal } from '@/lib/money.mjs';

export const runtime = 'nodejs';

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  try {
    const { creator } = await requireCreator();
    const requestedRange = new URL(request.url).searchParams.get('days') ?? '30';
    const requestedDays = Number(requestedRange);
    const days = requestedRange === 'all' ? null : [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const since = days === null ? null : new Date(Date.now() - days * 86_400_000);
    const rows = await getDatabase().select({
      number: orders.number,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      paidAmountMinor: orders.paidAmountMinor,
      paidCurrency: orders.paidCurrency,
      platformFeeMinor: orders.platformFeeMinor,
      createdAt: orders.createdAt,
      buyerName: users.name,
      buyerEmail: users.email,
      contactName: contacts.name,
      contactEmail: contacts.email,
    }).from(orders)
      .leftJoin(users, eq(orders.buyerUserId, users.id))
      .leftJoin(contacts, eq(orders.contactId, contacts.id))
      .where(days === null ? eq(orders.creatorId, creator.id) : and(eq(orders.creatorId, creator.id), gte(orders.createdAt, since!)))
      .orderBy(desc(orders.createdAt));

    const header = ['Order ID', 'Customer', 'Email', 'Date', 'Status', 'Buyer paid', 'Buyer currency', 'Creator price', 'Creator currency', 'Platform fee'];
    const lines = rows.map((row) => [
      row.number,
      row.buyerName || row.contactName || 'Guest customer',
      row.buyerEmail || row.contactEmail || '',
      row.createdAt.toISOString(),
      row.status,
      row.paidAmountMinor === null ? '' : currencyMinorToDecimal(row.paidAmountMinor, row.paidCurrency ?? row.currency),
      row.paidCurrency ?? row.currency,
      currencyMinorToDecimal(row.totalMinor, row.currency),
      row.currency,
      currencyMinorToDecimal(row.platformFeeMinor, row.currency),
    ]);
    const csv = [header, ...lines].map((line) => line.map(csvCell).join(',')).join('\r\n');
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="onselli-orders-${days === null ? 'all-time' : `${days}-days`}.csv"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Creator order export failed', error);
    return NextResponse.json({ error: 'Orders could not be exported.' }, { status: 503 });
  }
}
