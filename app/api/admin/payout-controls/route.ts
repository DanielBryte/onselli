import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthorizationError, requireAdmin } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, settings } from '@/src/server/db/schema';
import { normalizePayoutControls, payoutControlsSettingKey, payoutRouteControlKey } from '@/src/server/payments/payout-controls';

export const runtime = 'nodejs';
const updateSchema = z.object({ scope: z.enum(['global','account','route']), key: z.string().max(160).default(''), paused: z.boolean(), reason: z.string().trim().min(8).max(500).optional(), sourceCurrency: z.string().regex(/^[A-Z]{3}$/).optional(), destinationCurrency: z.string().regex(/^[A-Z0-9_]{3,16}$/).optional(), method: z.enum(['bank_transfer','mobile_money','crypto']).optional() }).strict();

export async function GET() {
  try { await requireAdmin('approve_payouts'); const [row] = await getDatabase().select({ value: settings.value }).from(settings).where(eq(settings.key, payoutControlsSettingKey)).limit(1); return NextResponse.json({ controls: normalizePayoutControls(row?.value) }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 }); console.error('Payout controls lookup failed'); return NextResponse.json({ error: 'Could not load payout controls.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin('approve_payouts');
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Provide a valid payout pause action and a clear reason.' }, { status: 400 });
    const input = parsed.data;
    if (input.paused && !input.reason) return NextResponse.json({ error: 'A reason is required when pausing payouts.' }, { status: 400 });
    let key = input.key;
    if (input.scope === 'global') key = 'global';
    if (input.scope === 'account' && !/^[A-Za-z0-9_-]{4,128}$/.test(key)) return NextResponse.json({ error: 'Provide a valid connected account ID.' }, { status: 400 });
    if (input.scope === 'route') {
      if (!input.sourceCurrency || !input.destinationCurrency || !input.method) return NextResponse.json({ error: 'Choose a source currency, destination currency, and method.' }, { status: 400 });
      key = payoutRouteControlKey({ sourceCurrency: input.sourceCurrency, destinationCurrency: input.destinationCurrency, method: input.method });
    }
    const db = getDatabase();
    if (input.scope === 'account') {
      const [known] = await db.select({ id: creators.id }).from(creators).where(eq(creators.bachsAccountId, key)).limit(1);
      if (!known) return NextResponse.json({ error: 'That connected Bachs account is not present in Onselli.' }, { status: 404 });
    }
    await db.transaction(async (tx) => {
      const [row] = await tx.select({ value: settings.value }).from(settings).where(eq(settings.key, payoutControlsSettingKey)).for('update');
      const controls = normalizePayoutControls(row?.value);
      const pause = input.paused ? { reason: input.reason!, pausedAt: new Date().toISOString(), pausedBy: session.user.id } : null;
      if (input.scope === 'global') controls.global = pause;
      else if (input.scope === 'account') { if (pause) controls.accounts[key] = pause; else delete controls.accounts[key]; }
      else if (pause) controls.routes[key] = pause; else delete controls.routes[key];
      if (row) await tx.update(settings).set({ value: controls, updatedBy: session.user.id, updatedAt: new Date() }).where(eq(settings.key, payoutControlsSettingKey));
      else await tx.insert(settings).values({ key: payoutControlsSettingKey, value: controls, updatedBy: session.user.id });
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: input.paused ? 'payout.pause' : 'payout.unpause', entityType: 'payout_controls', after: { scope: input.scope, key, paused: input.paused, reason: input.paused ? input.reason : null } });
    });
    return NextResponse.json({ scope: input.scope, key, paused: input.paused });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 }); console.error('Payout control update failed'); return NextResponse.json({ error: 'Payout controls could not be updated.' }, { status: 503 }); }
}
