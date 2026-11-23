import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireAdmin } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, emailCampaignCredits } from '@/src/server/db/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireAdmin('manage_settings');
    const body = await request.json().catch(() => null) as { creatorId?: unknown; credits?: unknown; reason?: unknown } | null;
    const creatorId = typeof body?.creatorId === 'string' ? body.creatorId : '';
    const credits = Number(body?.credits);
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 300) : '';
    if (!creatorId || !Number.isSafeInteger(credits) || credits < 1 || credits > 1_000_000 || reason.length < 8) return NextResponse.json({ error: 'Provide a creator, between 1 and 1,000,000 credits, and a reason.' }, { status: 400 });
    const db = getDatabase();
    await db.transaction(async (tx) => {
      const [creator] = await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creatorId)).limit(1);
      if (!creator) throw new Error('Creator not found.');
      await tx.insert(emailCampaignCredits).values({ creatorId }).onConflictDoNothing();
      const [before] = await tx.select().from(emailCampaignCredits).where(eq(emailCampaignCredits.creatorId, creatorId)).for('update');
      if (!before) throw new Error('Campaign credit wallet not found.');
      const [after] = await tx.update(emailCampaignCredits).set({ available: sql`${emailCampaignCredits.available} + ${credits}`, updatedAt: new Date() }).where(eq(emailCampaignCredits.creatorId, creatorId)).returning();
      if (!after) throw new Error('Campaign credits could not be granted.');
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'email_campaign_credits.grant', entityType: 'creator', entityId: creatorId, before: { available: before.available, reserved: before.reserved }, after: { available: after.available, reserved: after.reserved, granted: credits, reason } });
    });
    return NextResponse.json({ granted: credits });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof Error && error.message === 'Creator not found.') return NextResponse.json({ error: error.message }, { status: 404 });
    console.error('Campaign credit grant failed', error); return NextResponse.json({ error: 'Campaign credits could not be added.' }, { status: 503 });
  }
}
