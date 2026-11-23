import { and, count, desc, eq, gte, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { contacts, orderItems, orders } from '@/src/server/db/schema';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const { creator } = await requireCreator(); const params = new URL(request.url).searchParams; const query = params.get('q')?.trim().slice(0,100) ?? '';
    const offset = Math.max(0, Math.min(100_000, Number(params.get('offset')) || 0)); const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 25));
    const segment = params.get('segment') ?? 'all';
    const filters = [eq(contacts.creatorId, creator.id), isNull(contacts.deletedAt)];
    if (segment === 'customer') filters.push(eq(contacts.stage, 'customer'));
    else if (segment === 'lead') filters.push(eq(contacts.stage, 'lead'));
    else if (segment === 'subscriber') filters.push(and(isNotNull(contacts.marketingConsentAt), isNull(contacts.unsubscribedAt), isNull(contacts.emailSuppressedAt))!);
    if (query) filters.push(or(ilike(contacts.email, `%${query}%`), ilike(contacts.name, `%${query}%`), ilike(contacts.phoneE164, `%${query}%`))!);
    const db = getDatabase(); const since = new Date(Date.now() - 77 * 86_400_000);
    const [rows, totalRows, aggregateRows, sourceRows, growthRows] = await Promise.all([
      db.select({ contact: contacts, lastPurchaseAt: sql<Date | null>`(select max(${orders.paidAt}) from ${orders} where ${orders.contactId} = ${contacts.id} and ${orders.status} = 'paid')`, lastProductTitle: sql<string | null>`(select ${orderItems.titleSnapshot} from ${orders} inner join ${orderItems} on ${orderItems.orderId} = ${orders.id} where ${orders.contactId} = ${contacts.id} and ${orders.status} = 'paid' order by ${orders.paidAt} desc limit 1)` }).from(contacts).where(and(...filters)).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset),
      db.select({ total: count() }).from(contacts).where(and(...filters)),
      db.select({ total: count(), customers: sql<number>`count(*) filter (where ${contacts.stage} = 'customer')::int`, leads: sql<number>`count(*) filter (where ${contacts.stage} = 'lead')::int`, subscribers: sql<number>`count(*) filter (where ${contacts.marketingConsentAt} is not null and ${contacts.unsubscribedAt} is null and ${contacts.emailSuppressedAt} is null)::int`, payingNgn: sql<number>`count(*) filter (where ${contacts.totalSpentMinor} > 0)::int`, payingUsd: sql<number>`count(*) filter (where ${contacts.totalSpentUsdMinor} > 0)::int`, spendNgn: sql<string>`coalesce(sum(${contacts.totalSpentMinor}), 0)::text`, spendUsd: sql<string>`coalesce(sum(${contacts.totalSpentUsdMinor}), 0)::text` }).from(contacts).where(and(eq(contacts.creatorId, creator.id), isNull(contacts.deletedAt))),
      db.select({ source: contacts.source, total: count() }).from(contacts).where(and(eq(contacts.creatorId, creator.id), isNull(contacts.deletedAt))).groupBy(contacts.source).orderBy(desc(count())),
      db.select({ week: sql<string>`to_char(date_trunc('week', ${contacts.createdAt}), 'YYYY-MM-DD')`, total: count() }).from(contacts).where(and(eq(contacts.creatorId, creator.id), isNull(contacts.deletedAt), gte(contacts.createdAt, since))).groupBy(sql`date_trunc('week', ${contacts.createdAt})`).orderBy(sql`date_trunc('week', ${contacts.createdAt})`),
    ]);
    const items = rows.map(({ contact: row, lastPurchaseAt, lastProductTitle }) => ({ buyer_user_id: row.id, buyer_email: row.email ?? '', buyer_name: row.name ?? '', phone: row.phoneE164 ?? '', purchase_count: row.ordersCount, spend_by_currency: { NGN: Number(row.totalSpentMinor) / 100, USD: Number(row.totalSpentUsdMinor) / 100 }, first_purchase_at: row.createdAt.toISOString(), last_purchase_at: (lastPurchaseAt ?? row.lastActivityAt ?? row.createdAt).toISOString(), last_product_title: lastProductTitle ?? 'Lead', last_order_status: row.stage, is_subscriber: Boolean(row.marketingConsentAt && !row.unsubscribedAt && !row.emailSuppressedAt) }));
    const aggregate = aggregateRows[0];
    return NextResponse.json({ contacts: items, total: Number(totalRows[0]?.total ?? 0), offset, limit, summary: { total: Number(aggregate?.total ?? 0), customers: Number(aggregate?.customers ?? 0), leads: Number(aggregate?.leads ?? 0), subscribers: Number(aggregate?.subscribers ?? 0), averageSpendNgn: Number(aggregate?.payingNgn ?? 0) ? Number(aggregate?.spendNgn ?? 0) / 100 / Number(aggregate?.payingNgn) : 0, averageSpendUsd: Number(aggregate?.payingUsd ?? 0) ? Number(aggregate?.spendUsd ?? 0) / 100 / Number(aggregate?.payingUsd) : 0 }, sources: sourceRows.map(row => ({ source: row.source || 'Unknown', count: Number(row.total) })), weeklyGrowth: growthRows.map(row => ({ week: row.week, count: Number(row.total) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 }); console.error('Contacts list failed', error); return NextResponse.json({ error: 'Contacts could not be loaded.' }, { status: 503 }); }
}
