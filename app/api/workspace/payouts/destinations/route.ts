import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, payoutDestinations } from '@/src/server/db/schema';
import { createBachsPayoutDestination, getBachsBanks, getMobileMoneyProviders, getBachsPayoutDestination, parsePayoutDestination, resolveBachsBankAccount, sanitizeBachsDestination, type PayoutDestinationInput } from '@/lib/payments/bachs-payouts';

export const runtime = 'nodejs';
export async function GET() {
  try { const { creator } = await requireCreator(); const db = getDatabase(); const rows = await db.select().from(payoutDestinations).where(eq(payoutDestinations.creatorId, creator.id)).orderBy(desc(payoutDestinations.createdAt));
    if (creator.bachsAccountId && rows.length) await Promise.all(rows.map(async (row) => { try { const remote = await getBachsPayoutDestination(row.providerDestinationId, creator.bachsAccountId!); if (remote.id !== row.providerDestinationId || remote.currency !== row.currency || remote.type !== row.type) throw new Error('Provider destination identity mismatch.'); await db.update(payoutDestinations).set({ status: remote.status ?? row.status, statusReason: remote.status_reason ?? null, isUsable: remote.is_usable === true, updatedAt: new Date() }).where(and(eq(payoutDestinations.id, row.id), eq(payoutDestinations.creatorId, creator.id))); } catch { await db.update(payoutDestinations).set({ statusReason: 'Could not confirm destination usability with Bachs. Refresh before using this route.', isUsable: false, updatedAt: new Date() }).where(and(eq(payoutDestinations.id, row.id), eq(payoutDestinations.creatorId, creator.id))); } }));
    const fresh = await db.select().from(payoutDestinations).where(eq(payoutDestinations.creatorId, creator.id)).orderBy(desc(payoutDestinations.createdAt)); const destinations = fresh.map((row) => ({ id: row.id, providerDestinationId: row.providerDestinationId, name: row.name, type: row.type, currency: row.currency, countryCode: row.countryCode, method: row.method, status: row.status, statusReason: row.statusReason, isUsable: row.isUsable, isDefault: row.isDefault, maskedDetails: row.maskedDetails })); return NextResponse.json({ destinations }, { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 }); console.error('Payout method lookup failed', error); return NextResponse.json({ error: 'Could not load payout methods.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const { session, creator } = await requireCreator(); const body = await request.json().catch(() => null);
    if (body && typeof body === 'object' && 'type' in body) {
      const parsed = parsePayoutDestination(body);
      if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const input = parsed.data as PayoutDestinationInput;
      const bankInput = input as Extract<PayoutDestinationInput, { type: 'bank_account' }>;
      let providerInput = input;
      if (input.type === 'bank_account' && ['NGN','GHS','KES','TZS','UGX'].includes(bankInput.currency)) {
        const country = bankInput.country_code ?? '';
        const bankDirectory = await getBachsBanks(country);
        const selectedBank = bankDirectory.banks.find((bank) => bank.code === bankInput.bank_code);
        if (!selectedBank) return NextResponse.json({ error: 'Choose a bank returned by Bachs for this destination country.' }, { status: 422 });
        if (bankInput.currency === 'NGN') {
          const resolved = await resolveBachsBankAccount({ accountNumber: bankInput.account_number ?? '', bankCode: bankInput.bank_code ?? '', country });
          if (!resolved.resolved || !resolved.account_name || !resolved.account_number) return NextResponse.json({ error: resolved.message || 'We could not verify this bank account.' }, { status: 422 });
          if (resolved.account_name.trim().toLocaleLowerCase() !== bankInput.account_name.trim().toLocaleLowerCase()) return NextResponse.json({ error: 'The account holder name changed. Verify the details again.' }, { status: 409 });
          providerInput = { ...bankInput, bank_name: selectedBank.name, account_name: resolved.account_name, account_number: resolved.account_number };
        } else providerInput = { ...bankInput, bank_name: selectedBank.name };
      }
      if (input.type === 'mobile_money') {
        const providers = await getMobileMoneyProviders(input.country_code);
        if (!(providers.providers ?? []).some((provider) => provider.name === input.mobile_provider && (provider.country ?? input.country_code) === input.country_code)) return NextResponse.json({ error: 'Choose a mobile network returned by Bachs for this country.' }, { status: 422 });
      }
      const db = getDatabase();
      const [account] = await db.select({ bachsAccountId: creators.bachsAccountId }).from(creators).where(eq(creators.id, creator.id)).limit(1);
      if (!account?.bachsAccountId) return NextResponse.json({ error: 'Your payout account is not connected yet. Contact support to finish payout setup.' }, { status: 409 });
      const remote = await createBachsPayoutDestination(providerInput, account.bachsAccountId);
      if (!remote.id || remote.currency !== input.currency || remote.type !== input.type) throw new Error('Bachs returned a destination that does not match the selected route.');
      const sanitized = sanitizeBachsDestination(remote, creator.id);
      const saved = await db.transaction(async (tx) => {
        await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creator.id)).for('update');
        await tx.update(payoutDestinations).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(payoutDestinations.creatorId, creator.id), eq(payoutDestinations.currency, sanitized.currency), eq(payoutDestinations.method, sanitized.method), eq(payoutDestinations.isDefault, true)));
        const [row] = await tx.insert(payoutDestinations).values({ ...sanitized, isDefault: true }).returning({ id: payoutDestinations.id });
        return row;
      });
      if (!saved) throw new Error('Could not save the payout destination.');
      await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.destination.add', entityType: 'payout_destination', entityId: saved.id, after: { currency: sanitized.currency, type: sanitized.type, providerDestinationId: sanitized.providerDestinationId } });
      return NextResponse.json({ destination: { id: saved.id, providerDestinationId: sanitized.providerDestinationId, name: sanitized.name, type: sanitized.type, currency: sanitized.currency, method: sanitized.method, status: sanitized.status, statusReason: sanitized.statusReason, isUsable: sanitized.isUsable, isDefault: true, maskedDetails: sanitized.maskedDetails } }, { status: 201 });
    }
    return NextResponse.json({ error: 'Submit payout details through the secure Bachs destination form.' }, { status: 400 });
  } catch (error) { if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 }); const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : ''; console.error(code === 'PAYOUT_CURRENCY_NOT_ENABLED' ? 'Bachs payout currency is not enabled; flag for provider support review' : 'Payout method save failed', { code: code || 'PROVIDER_ERROR' }); return NextResponse.json({ error: code === 'PAYOUT_CURRENCY_NOT_ENABLED' ? 'This payout currency is not enabled yet. Support has been notified.' : 'Could not save payout method.' }, { status: code === 'PAYOUT_CURRENCY_NOT_ENABLED' ? 422 : 503 }); }
}
