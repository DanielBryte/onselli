import { and, eq, inArray, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getEnv } from '@/src/server/config/env';
import { getDatabase } from '@/src/server/db';
import { contacts, emailCampaigns, emailCampaignRecipients } from '@/src/server/db/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = getEnv().SES_WEBHOOK_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const event = await request.json().catch(() => null) as {
    detail?: { eventType?: string; mail?: { tags?: Record<string, string[]> }; bounce?: { bounceType?: string } };
    eventType?: string; recipientId?: string; mail?: { tags?: Record<string, string[]> }; bounce?: { bounceType?: string };
  } | null;
  const detail: NonNullable<typeof event>['detail'] | null = event?.detail ?? event;
  const recipientId = event?.recipientId ?? detail?.mail?.tags?.recipient_id?.[0];
  const type = (detail?.eventType ?? '').toLowerCase();
  if (!recipientId || !['delivery', 'bounce', 'complaint'].includes(type)) return NextResponse.json({ accepted: true, ignored: true });
  const db = getDatabase();
  const [recipient] = await db.select().from(emailCampaignRecipients).where(eq(emailCampaignRecipients.id, recipientId)).limit(1);
  if (!recipient || !['sent', 'delivered'].includes(recipient.status)) return NextResponse.json({ accepted: true, ignored: true });
  if (type === 'delivery') {
    const [updated] = await db.update(emailCampaignRecipients).set({ status: 'delivered', updatedAt: new Date() })
      .where(and(eq(emailCampaignRecipients.id, recipient.id), eq(emailCampaignRecipients.status, 'sent'))).returning({ id: emailCampaignRecipients.id });
    if (updated) await db.update(emailCampaigns).set({ deliveredCount: sql`${emailCampaigns.deliveredCount} + 1`, updatedAt: new Date() }).where(eq(emailCampaigns.id, recipient.campaignId));
  } else {
    const status = type === 'complaint' ? 'complained' : 'bounced';
    const [updated] = await db.update(emailCampaignRecipients).set({ status, error: type === 'complaint' ? 'Recipient reported this message as spam.' : 'Amazon SES reported a bounce.', updatedAt: new Date() })
      .where(and(eq(emailCampaignRecipients.id, recipient.id), inArray(emailCampaignRecipients.status, ['sent', 'delivered']))).returning({ id: emailCampaignRecipients.id });
    if (updated) {
      if ((type === 'complaint' || detail?.bounce?.bounceType?.toLowerCase() === 'permanent') && recipient.contactId) {
        await db.update(contacts).set({ unsubscribedAt: new Date(), updatedAt: new Date() }).where(and(eq(contacts.id, recipient.contactId), eq(contacts.creatorId, recipient.creatorId), sql`${contacts.unsubscribedAt} IS NULL`));
      }
      await db.update(emailCampaigns).set(type === 'complaint' ? { complainedCount: sql`${emailCampaigns.complainedCount} + 1`, updatedAt: new Date() } : { bouncedCount: sql`${emailCampaigns.bouncedCount} + 1`, updatedAt: new Date() }).where(eq(emailCampaigns.id, recipient.campaignId));
    }
  }
  return NextResponse.json({ accepted: true });
}
