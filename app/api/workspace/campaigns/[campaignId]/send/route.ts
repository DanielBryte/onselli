import { and, count, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { contacts, emailCampaignCredits, emailCampaignRecipients, emailCampaigns } from '@/src/server/db/schema';
import { triggerWorkflow } from '@/src/server/jobs/client';
import { campaignTransportReady } from '@/src/server/emails/campaigns';
import { getAccountEntitlements, hasAccountFeature } from '@/src/server/billing/entitlements';

export const runtime = 'nodejs';
const MAX_CAMPAIGN_SIZE = 5000;

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const { creator } = await requireCreator();
    if (!await hasAccountFeature(creator.userId, 'email_campaigns')) return NextResponse.json({ error: 'Email campaigns are part of Pro. View plans to unlock them.', code: 'UPGRADE_REQUIRED', feature: 'email_campaigns' }, { status: 402 });
    const entitlements = await getAccountEntitlements(creator.userId);
    const recipientLimit = Math.min(MAX_CAMPAIGN_SIZE, entitlements.maxRecipientsPerSend);
    const { campaignId } = await context.params;
    const body = await request.json().catch(() => ({})) as { scheduledAt?: unknown };
    const scheduledAt = typeof body.scheduledAt === 'string' && body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (scheduledAt && (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 60_000 || scheduledAt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Choose a send time at least one minute from now and within the next year.' }, { status: 400 });
    }
    if (!campaignTransportReady()) {
      return NextResponse.json({ error: 'Campaign delivery is not configured yet. Drafts are saved; contact Onselli to enable sending.' }, { status: 503 });
    }
    const db = getDatabase();
    const [campaign] = await db.select().from(emailCampaigns).where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.creatorId, creator.id))).limit(1);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    if (campaign.status !== 'draft') return NextResponse.json({ error: 'Only a draft campaign can be queued.' }, { status: 409 });

    const result = await db.transaction(async (tx) => {
      await tx.insert(emailCampaignCredits).values({ creatorId: creator.id }).onConflictDoNothing();
      const audience = await tx.select({ contactId: contacts.id, email: sql<string>`lower(trim(${contacts.email}))` })
        .from(contacts).where(and(eq(contacts.creatorId, creator.id), isNotNull(contacts.email), isNotNull(contacts.marketingConsentAt), isNull(contacts.unsubscribedAt), isNull(contacts.emailSuppressedAt), isNull(contacts.deletedAt)))
        .orderBy(contacts.createdAt).limit(recipientLimit + 1);
      if (!audience.length) throw new Error('NO_CONSENTED_CONTACTS');
      if (audience.length > recipientLimit) throw new Error('CAMPAIGN_TOO_LARGE');
      const [wallet] = await tx.update(emailCampaignCredits).set({ available: sql`${emailCampaignCredits.available} - ${audience.length}`, reserved: sql`${emailCampaignCredits.reserved} + ${audience.length}`, updatedAt: new Date() })
        .where(and(eq(emailCampaignCredits.creatorId, creator.id), gte(emailCampaignCredits.available, audience.length))).returning({ available: emailCampaignCredits.available });
      if (!wallet) throw new Error('INSUFFICIENT_CREDITS');
      await tx.insert(emailCampaignRecipients).values(audience.map((contact) => ({ campaignId, creatorId: creator.id, contactId: contact.contactId, email: contact.email })));
      const [updated] = await tx.update(emailCampaigns).set({ status: scheduledAt ? 'scheduled' : 'queued', scheduledAt, queuedCount: audience.length, updatedAt: new Date() })
        .where(and(eq(emailCampaigns.id, campaignId), eq(emailCampaigns.creatorId, creator.id), eq(emailCampaigns.status, 'draft'))).returning({ id: emailCampaigns.id });
      if (!updated) throw new Error('CAMPAIGN_NOT_DRAFT');
      return { count: audience.length, remainingCredits: wallet.available };
    });
    await triggerWorkflow('/api/workflows/campaign-dispatch', { campaignId, creatorId: creator.id }, {
      ...(scheduledAt ? { delay: `${Math.ceil((scheduledAt.getTime() - Date.now()) / 1000)}s` as `${bigint}s` } : {}),
      workflowRunId: `campaign-${campaignId}-${Date.now()}`,
      flowControl: { key: `campaign-${campaignId}`, parallelism: 1 },
    });
    return NextResponse.json({ queued: result.count, remainingCredits: result.remainingCredits, scheduledAt: scheduledAt?.toISOString() ?? null });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof Error && error.message === 'NO_CONSENTED_CONTACTS') return NextResponse.json({ error: 'There are no contacts with recorded marketing consent.' }, { status: 400 });
    if (error instanceof Error && error.message === 'CAMPAIGN_TOO_LARGE') return NextResponse.json({ error: `Your plan allows up to ${MAX_CAMPAIGN_SIZE.toLocaleString()} recipients per send.` }, { status: 400 });
    if (error instanceof Error && error.message === 'INSUFFICIENT_CREDITS') return NextResponse.json({ error: 'Not enough prepaid email credits. Sending is paused until credits are added.' }, { status: 402 });
    if (error instanceof Error && error.message === 'CAMPAIGN_NOT_DRAFT') return NextResponse.json({ error: 'Campaign has already been queued.' }, { status: 409 });
    console.error('Campaign queue failed', error); return NextResponse.json({ error: 'Campaign could not be queued.' }, { status: 503 });
  }
}
