import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/server/db';
import { contacts, emailCampaignCredits, emailCampaignRecipients } from '@/src/server/db/schema';
import { verifyUnsubscribeToken } from '@/src/server/emails/campaigns';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  return NextResponse.redirect(new URL(`/email/unsubscribe?token=${encodeURIComponent(token)}`, request.url));
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.formData().catch(() => null);
  const token = url.searchParams.get('token') ?? String(body?.get('token') ?? '');
  const recipientId = verifyUnsubscribeToken(token);
  if (!recipientId) return NextResponse.json({ error: 'This unsubscribe link is invalid or expired.' }, { status: 400 });
  const db = getDatabase();
  const [recipient] = await db.select().from(emailCampaignRecipients).where(eq(emailCampaignRecipients.id, recipientId)).limit(1);
  if (!recipient) return NextResponse.json({ error: 'This unsubscribe link is invalid or expired.' }, { status: 400 });
  if (recipient.contactId) await db.update(contacts).set({ unsubscribedAt: new Date(), updatedAt: new Date() }).where(and(eq(contacts.id, recipient.contactId), eq(contacts.creatorId, recipient.creatorId), isNull(contacts.unsubscribedAt)));
  const [queued] = await db.update(emailCampaignRecipients).set({ status: 'unsubscribed', error: 'Recipient unsubscribed.', updatedAt: new Date() })
    .where(and(eq(emailCampaignRecipients.id, recipient.id), eq(emailCampaignRecipients.status, 'queued'))).returning({ id: emailCampaignRecipients.id });
  if (queued) await db.update(emailCampaignCredits).set({ available: sql`${emailCampaignCredits.available} + 1`, reserved: sql`greatest(0, ${emailCampaignCredits.reserved} - 1)`, updatedAt: new Date() }).where(eq(emailCampaignCredits.creatorId, recipient.creatorId));
  return NextResponse.json({ unsubscribed: true });
}
