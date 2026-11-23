import { and, eq, inArray, sum } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, creators, ledgerEntries, payoutDestinations, payoutQuotes, payouts } from '@/src/server/db/schema';
import { amountToDecimal, configuredPayoutFeeMinor, createBachsPayout, decimalToMinor, getBachsPayoutDestination, payoutDestinationLimitsMinor } from '@/lib/payments/bachs-payouts';
import { getCreatorRiskPolicy } from '@/src/server/payments/creator-risk-policy';
import { bachsCreatorAccountState, refreshBachsAccount } from '@/lib/payments/bachs';
import { getBachsAccountBalances, payoutCurrencies } from '@/lib/payments/bachs-payouts';
import { payoutPauseReason } from '@/src/server/payments/payout-controls';
import { isPayoutSourceAllowed } from '@/lib/payments/payout-source-rules.mjs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { session, creator } = await requireCreator();
    const body = await request.json().catch(() => null);
    const destinationId = typeof body?.destinationId === 'string' ? body.destinationId : '';
    const sourceCurrency = typeof body?.sourceCurrency === 'string' ? body.sourceCurrency.toUpperCase() : '';
    const quoteId = typeof body?.quoteId === 'string' ? body.quoteId : null;
    const amountMinorRaw = typeof body?.amountMinor === 'string' ? body.amountMinor : '';
    if (!destinationId || !['NGN','USD'].includes(sourceCurrency) || !/^\d{1,18}$/.test(amountMinorRaw)) return NextResponse.json({ error: 'Choose an eligible source balance, payout destination, and valid amount.' }, { status: 400 });
    const db = getDatabase();
    const [[destination], [account]] = await Promise.all([
      db.select().from(payoutDestinations).where(and(eq(payoutDestinations.id, destinationId), eq(payoutDestinations.creatorId, creator.id))).limit(1),
      db.select({ bachsAccountId: creators.bachsAccountId }).from(creators).where(eq(creators.id, creator.id)).limit(1),
    ]);
    if (!destination) return NextResponse.json({ error: 'Payout destination not found.' }, { status: 404 });
    if (!payoutCurrencies.includes(destination.currency as typeof payoutCurrencies[number])) return NextResponse.json({ error: 'This payout destination currency is not supported.' }, { status: 422 });
    if (!isPayoutSourceAllowed(sourceCurrency, destination.currency)) return NextResponse.json({ error: `This Bachs payout route must be funded from your ${destination.currency === 'NGN' ? 'NGN or USD' : 'USD'} balance.` }, { status: 409 });
    if (!getCreatorRiskPolicy()) return NextResponse.json({ error: 'Withdrawals are paused until Onselli configures its approved refund and dispute reserve policy.' }, { status: 409 });
    if (!account?.bachsAccountId) return NextResponse.json({ error: 'Your payout account is not connected yet. Contact support to finish payout setup.' }, { status: 409 });
    const bachsAccountId = account.bachsAccountId;
    const pauseReason = await payoutPauseReason({ accountId: bachsAccountId, sourceCurrency, destinationCurrency: destination.currency, method: destination.method });
    if (pauseReason) return NextResponse.json({ error: `Withdrawals on this route are paused: ${pauseReason}` }, { status: 409 });
    const providerAccount = await refreshBachsAccount(bachsAccountId);
    const accountState = bachsCreatorAccountState(providerAccount.account);
    if (providerAccount.account.id !== bachsAccountId || accountState.status !== 'approved' || accountState.payoutsStatus !== 'active' || accountState.transfersStatus !== 'active') return NextResponse.json({ error: 'Complete Bachs identity verification and wait until payouts are approved.' }, { status: 409 });
    const needsInternational = destination.type === 'mobile_money' || destination.type === 'crypto_wallet' || (destination.type === 'bank_account' && destination.countryCode !== 'NG');
    if (needsInternational && !accountState.internationalPayouts) return NextResponse.json({ error: 'International payouts are not enabled for your Bachs account yet. Open payout verification and complete the required name, email, and address details.' }, { status: 409 });
    await db.update(creators).set({ bachsAccountStatus: accountState.status, bachsTransfersStatus: accountState.transfersStatus, bachsPayoutsStatus: accountState.payoutsStatus, bachsInternationalPayouts: accountState.internationalPayouts, bachsRequirements: accountState.requirements, kycStatus: 'approved', updatedAt: new Date() }).where(eq(creators.id, creator.id));
    if (!destination.isUsable) return NextResponse.json({ error: 'This payout destination is not ready to receive funds.' }, { status: 409 });
    const sourceAmount = BigInt(amountMinorRaw);
    if (sourceAmount <= 0n || sourceAmount > 9_223_372_036_854_775_807n) return NextResponse.json({ error: 'Enter a positive amount within the supported limit.' }, { status: 400 });
    const quoteRow = quoteId ? (await db.select().from(payoutQuotes).where(and(eq(payoutQuotes.creatorId, creator.id), eq(payoutQuotes.destinationId, destination.id), eq(payoutQuotes.providerQuoteId, quoteId))).limit(1))[0] : null;
    if (sourceCurrency !== destination.currency && (!quoteRow || quoteRow.sourceCurrency !== sourceCurrency || quoteRow.destinationCurrency !== destination.currency || quoteRow.sourceAmountMinor !== sourceAmount || quoteRow.expiresAt <= new Date())) return NextResponse.json({ error: 'Get a new payout quote for this amount and destination before withdrawing.' }, { status: 409 });
    if (sourceCurrency === destination.currency && quoteId) return NextResponse.json({ error: 'A quote is not needed for a same-currency payout. Refresh and try again.' }, { status: 409 });
    const feeMinor = quoteRow ? quoteRow.feeMinor : configuredPayoutFeeMinor(sourceCurrency, destination.method, destination.currency);
    if (feeMinor === null) return NextResponse.json({ error: 'The payout fee for this currency is not configured. Contact support before withdrawing.' }, { status: 409 });
    if (feeMinor < 0n) return NextResponse.json({ error: 'The provider returned an invalid payout fee.' }, { status: 409 });
    const totalDebit = sourceAmount + feeMinor;
    const destinationAmount = quoteRow?.destinationAmountMinor ?? sourceAmount;
    const destinationLimits = payoutDestinationLimitsMinor(destination.currency, destination.method);
    if (destinationLimits && (destinationAmount < destinationLimits.min || destinationAmount > destinationLimits.max)) return NextResponse.json({ error: `This payout is outside Bachs’ ${destination.currency} mobile-money limits.` }, { status: 400 });
    const remote = await getBachsPayoutDestination(destination.providerDestinationId, bachsAccountId);
    if (remote.id !== destination.providerDestinationId || remote.currency !== destination.currency || remote.type !== destination.type) return NextResponse.json({ error: 'The payout destination changed at Bachs. Refresh your payout settings before withdrawing.' }, { status: 409 });
    if (remote.is_usable !== true) return NextResponse.json({ error: remote.status_reason || 'This payout destination is no longer usable.' }, { status: 409 });
    const providerBalances = await getBachsAccountBalances(bachsAccountId);
    if (providerBalances.account_id !== bachsAccountId) return NextResponse.json({ error: 'Could not verify the connected payout balance.' }, { status: 502 });
    const providerAvailable = providerBalances.balances.find((balance) => balance.currency.toUpperCase() === sourceCurrency)?.available_balance;
    if (!providerAvailable || decimalToMinor(providerAvailable, sourceCurrency) < totalDebit) return NextResponse.json({ error: `Bachs does not yet have enough settled ${sourceCurrency} to cover this withdrawal and its fee.` }, { status: 409 });

    const payout = await db.transaction(async (tx) => {
      const [lockedCreator] = await tx.select({ id: creators.id, kycStatus: creators.kycStatus, bachsAccountId: creators.bachsAccountId, bachsPayoutsStatus: creators.bachsPayoutsStatus, bachsInternationalPayouts: creators.bachsInternationalPayouts }).from(creators).where(eq(creators.id, creator.id)).for('update');
      if (lockedCreator?.bachsAccountId !== bachsAccountId || lockedCreator.bachsPayoutsStatus !== 'active') throw new Error('Complete Bachs identity verification and wait until payouts are approved.');
      if (lockedCreator?.kycStatus !== 'approved') throw new Error('Complete identity verification before withdrawing funds.');
      if (needsInternational && !lockedCreator.bachsInternationalPayouts) throw new Error('International payout eligibility changed. Complete Bachs verification before withdrawing.');
      const [active] = await tx.select({ id: payouts.id }).from(payouts).where(and(eq(payouts.creatorId, creator.id), inArray(payouts.status, ['requested','approved','processing']))).limit(1);
      if (active) throw new Error('You already have a withdrawal in progress.');
      const [balance] = await tx.select({ total: sum(ledgerEntries.amountMinor) }).from(ledgerEntries).where(and(eq(ledgerEntries.creatorId, creator.id), eq(ledgerEntries.currency, sourceCurrency), eq(ledgerEntries.bucket, 'available')));
      if (BigInt(String(balance?.total ?? 0)) < totalDebit) throw new Error('Your available balance does not cover the payout and fee.');
      if (quoteRow && quoteRow.feeMinor === null) throw new Error('The payout fee is unavailable for this quote. Refresh the quote before withdrawing.');
      const [created] = await tx.insert(payouts).values({ creatorId: creator.id, amountMinor: destinationAmount, currency: destination.currency, sourceAmountMinor: sourceAmount, sourceCurrency, feeMinor, payoutDestinationId: destination.id, quoteId: quoteRow?.id ?? null, providerRef: `onselli_${crypto.randomUUID().replaceAll('-', '')}`, status: 'processing', bankSnapshot: { destinationName: destination.name, type: destination.type, currency: destination.currency, countryCode: destination.countryCode, method: destination.method, maskedDetails: destination.maskedDetails, exchangeRate: quoteRow?.exchangeRate ?? null } }).returning({ id: payouts.id, providerRef: payouts.providerRef });
      if (!created) throw new Error('The payout could not be reserved.');
      if (!created.providerRef) throw new Error('The payout reference could not be created.');
      const key = `payout:${created.id}:provider`;
      await tx.insert(ledgerEntries).values([
        { creatorId: creator.id, type: 'payout_reservation', bucket: 'available', amountMinor: -totalDebit, currency: sourceCurrency, refType: 'payout', refId: created.id, idempotencyKey: `${key}:available`, createdBy: session.user.id },
        { creatorId: creator.id, type: 'payout_reservation', bucket: 'reserved', amountMinor: totalDebit, currency: sourceCurrency, refType: 'payout', refId: created.id, idempotencyKey: `${key}:reserved`, createdBy: session.user.id },
      ]);
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.request', entityType: 'payout', entityId: created.id, after: { status: 'processing', amountMinor: sourceAmount.toString(), currency: destination.currency, sourceAmountMinor: sourceAmount.toString(), sourceCurrency, feeMinor: feeMinor.toString(), method: destination.method } });
      return created;
    });
    const providerReference = payout.providerRef;
    if (!providerReference) throw new Error('The payout reference could not be created.');

    try {
      const result = await createBachsPayout({ destination: destination.providerDestinationId, reference: providerReference, idempotencyKey: providerReference, ...(quoteRow ? { quoteId: quoteRow.providerQuoteId } : { amount: amountToDecimal(sourceAmount, sourceCurrency) }), accountId: bachsAccountId });
      const actualTotalDebit = decimalToMinor(result.total_debited, sourceCurrency);
      const actualFee = decimalToMinor(result.fee, sourceCurrency);
      if (actualTotalDebit !== totalDebit || actualFee !== feeMinor || result.source_currency !== sourceCurrency || result.currency !== destination.currency || decimalToMinor(result.amount, destination.currency) !== (quoteRow?.destinationAmountMinor ?? sourceAmount)) {
        console.error('Payout provider amount mismatch; payout left reserved for reconciliation', { payoutId: payout.id, providerPayoutId: result.id });
        await db.transaction(async (tx) => {
          await tx.update(payouts).set({ providerPayoutId: result.id, failureReason: 'Provider debit mismatch; support review required.', updatedAt: new Date() }).where(eq(payouts.id, payout.id));
          await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.reconciliation_required', entityType: 'payout', entityId: payout.id, after: { status: 'processing', providerPayoutId: result.id, reason: 'provider_amount_mismatch' } });
        });
        return NextResponse.json({ id: payout.id, status: 'processing', message: 'The payout was accepted and is being reconciled.' }, { status: 202 });
      }
      const completed = ['paid','completed','succeeded'].includes(result.status.toLowerCase());
      const failed = ['failed','rejected','cancelled','canceled'].includes(result.status.toLowerCase());
      await db.transaction(async (tx) => {
        const [locked] = await tx.select({ status: payouts.status }).from(payouts).where(eq(payouts.id, payout.id)).for('update');
        if (!locked || locked.status !== 'processing') return;
        if (completed || failed) {
          const key = `payout:${payout.id}:provider:${completed ? 'paid' : 'failed'}`;
          await tx.insert(ledgerEntries).values([
            { creatorId: creator.id, type: completed ? 'payout_paid' : 'payout_failed', bucket: 'reserved', amountMinor: -totalDebit, currency: sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `${key}:reserved` },
            ...(failed ? [{ creatorId: creator.id, type: 'payout_reversal', bucket: 'available' as const, amountMinor: totalDebit, currency: sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `${key}:available` }] : []),
          ]).onConflictDoNothing();
        }
        await tx.update(payouts).set({ providerPayoutId: result.id, status: completed ? 'paid' : failed ? 'failed' : 'processing', paidAt: completed ? new Date() : null, failureReason: failed ? (result.failure_reason ?? 'The payout failed.') : null, updatedAt: new Date() }).where(eq(payouts.id, payout.id));
        await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.provider_update', entityType: 'payout', entityId: payout.id, after: { status: completed ? 'paid' : failed ? 'failed' : 'processing', providerPayoutId: result.id, providerStatus: result.status } });
      });
      return NextResponse.json({ id: payout.id, status: result.status, amountMinor: destinationAmount.toString(), currency: destination.currency, sourceAmountMinor: sourceAmount.toString(), sourceCurrency, feeMinor: feeMinor.toString() }, { status: 202 });
    } catch (error) {
      // A timeout or server failure can mean the provider accepted the request. Keep funds reserved; reconcile by reference before retrying.
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : null;
      const providerCode = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
      const definiteCodes = new Set(['PAYOUT_CURRENCY_NOT_ENABLED','PAYOUT_SOURCE_CURRENCY_UNSUPPORTED','PAYOUT_RECIPIENT_INCOMPLETE','BANK_ROUTING_DETAILS_INVALID','QUOTE_EXPIRED','AMOUNT_NOT_ALLOWED_WITH_QUOTE','VALIDATION_ERROR']);
      const definiteFailure = status !== null && status >= 400 && status < 500 && status !== 408 && status !== 409 && status !== 425 && status !== 429 && (status < 400 || status >= 500 || definiteCodes.has(providerCode));
      if (!definiteFailure) {
        console.error('Payout provider result uncertain; reserved for reconciliation', { payoutId: payout.id });
        await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.submission_uncertain', entityType: 'payout', entityId: payout.id, after: { status: 'processing', providerReference, reason: 'provider_result_uncertain' } });
        return NextResponse.json({ id: payout.id, status: 'processing', message: 'Payout status is being confirmed. Do not submit it again.' }, { status: 202 });
      }
      const code = providerCode;
      const reason = code ? `Bachs rejected payout (${code}).` : 'Bachs rejected payout.';
      await db.transaction(async (tx) => {
        const [locked] = await tx.select({ status: payouts.status }).from(payouts).where(eq(payouts.id, payout.id)).for('update');
        if (!locked || locked.status !== 'processing') return;
        await tx.update(payouts).set({ status: 'failed', failureReason: reason, updatedAt: new Date() }).where(eq(payouts.id, payout.id));
        await tx.insert(ledgerEntries).values([
          { creatorId: creator.id, type: 'payout_reversal', bucket: 'reserved', amountMinor: -totalDebit, currency: sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `payout:${payout.id}:provider-failure:reserved`, createdBy: session.user.id },
          { creatorId: creator.id, type: 'payout_reversal', bucket: 'available', amountMinor: totalDebit, currency: sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `payout:${payout.id}:provider-failure:available`, createdBy: session.user.id },
        ]);
        await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'payout.provider_rejected', entityType: 'payout', entityId: payout.id, after: { status: 'failed', reason, providerCode: code || null } });
      });
      if (code === 'PAYOUT_CURRENCY_NOT_ENABLED' || reason.includes('PAYOUT_CURRENCY_NOT_ENABLED')) console.error('Bachs payout route is not enabled; flag for provider support review', { payoutId: payout.id, currency: destination.currency, method: destination.method });
      return NextResponse.json({ error: code === 'PAYOUT_CURRENCY_NOT_ENABLED' || reason.includes('PAYOUT_CURRENCY_NOT_ENABLED') ? 'This payout route is not enabled yet. Support has been notified.' : 'The provider rejected this payout. The reserved amount was returned to your available balance.' }, { status: 409 });
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof Error && /identity verification|withdrawal in progress|available balance/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Creator payout request failed', { errorType: error instanceof Error ? error.name : 'UNKNOWN' });
    return NextResponse.json({ error: 'Your payout could not be created.' }, { status: 503 });
  }
}
