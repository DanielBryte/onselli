import { and, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { contacts, emailCampaignCredits, emailCampaigns } from '@/src/server/db/schema';
import { hasAccountFeature } from '@/src/server/billing/entitlements';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { creator } = await requireCreator();
    if (!await hasAccountFeature(creator.userId, 'email_campaigns')) return NextResponse.json({ error: 'Email campaigns are part of Pro. View plans to unlock them.', code: 'UPGRADE_REQUIRED', feature: 'email_campaigns' }, { status: 402 });
    const db = getDatabase();
    await db.insert(emailCampaignCredits).values({ creatorId: creator.id }).onConflictDoNothing();
    const [campaigns, [credits], [audience]] = await Promise.all([
      db.select().from(emailCampaigns).where(eq(emailCampaigns.creatorId, creator.id)).orderBy(desc(emailCampaigns.createdAt)).limit(50),
      db.select().from(emailCampaignCredits).where(eq(emailCampaignCredits.creatorId, creator.id)).limit(1),
      db.select({ total: count() }).from(contacts).where(and(eq(contacts.creatorId, creator.id), isNotNull(contacts.email), isNotNull(contacts.marketingConsentAt), isNull(contacts.unsubscribedAt), isNull(contacts.emailSuppressedAt), isNull(contacts.deletedAt))),
    ]);
    return NextResponse.json({ campaigns, credits: credits?.available ?? 0, eligibleContacts: audience?.total ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Campaign list failed', error); return NextResponse.json({ error: 'Campaigns could not be loaded.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const { creator } = await requireCreator();
    if (!await hasAccountFeature(creator.userId, 'email_campaigns')) return NextResponse.json({ error: 'Email campaigns are part of Pro. View plans to unlock them.', code: 'UPGRADE_REQUIRED', feature: 'email_campaigns' }, { status: 402 });
    const body = await request.json().catch(() => null) as { name?: unknown; subject?: unknown; previewText?: unknown; html?: unknown } | null;
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const previewText = typeof body?.previewText === 'string' ? body.previewText.trim() : '';
    const html = typeof body?.html === 'string' ? body.html.trim() : '';
    if (name.length < 1 || name.length > 120 || subject.length < 1 || subject.length > 180 || html.length < 1 || html.length > 500_000 || previewText.length > 240) {
      return NextResponse.json({ error: 'Enter a campaign name, subject, and email content. Keep the content under 500 KB.' }, { status: 400 });
    }
    const [campaign] = await getDatabase().insert(emailCampaigns).values({ creatorId: creator.id, name, subject, previewText: previewText || null, html }).returning();
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Campaign create failed', error); return NextResponse.json({ error: 'Campaign could not be saved.' }, { status: 503 });
  }
}
