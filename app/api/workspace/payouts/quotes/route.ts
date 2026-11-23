import { and, eq, sum } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { creators, ledgerEntries, payoutDestinations, payoutQuotes } from '@/src/server/db/schema';
import { amountToDecimal, configuredPayoutFeeMinor, createBachsPayoutQuote, decimalToMinor, getBachsAccountBalances, getBachsPayoutDestination, payoutDestinationLimitsMinor, payoutCurrencies } from '@/lib/payments/bachs-payouts';
import { payoutPauseReason } from '@/src/server/payments/payout-controls';
import { getCreatorRiskPolicy } from '@/src/server/payments/creator-risk-policy';
import { bachsCreatorAccountState, refreshBachsAccount } from '@/lib/payments/bachs';
import { isPayoutSourceAllowed } from '@/lib/payments/payout-source-rules.mjs';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const { creator } = await requireCreator();
    const body = await request.json().catch(() => null);
    const destinationId = typeof body?.destinationId === 'string' ? body.destinationId : '';
    const sourceCurrency = typeof body?.sourceCurrency === 'string' ? body.sourceCurrency.toUpperCase() : '';
    const amountMinorRaw = typeof body?.amountMinor === 'string' ? body.amountMinor : '';
    if (!destinationId || !['NGN','USD'].includes(sourceCurrency) || !/^\d{1,18}$/.test(amountMinorRaw)) return NextResponse.json({ error: 'Choose an eligible source balance, payout destination, and valid amount.' }, { status: 400 });
    const amountMinor = BigInt(amountMinorRaw);
    if (amountMinor <= 0n || amountMinor > 9_223_372_036_854_775_807n) return NextResponse.json({ error: 'Enter a positive amount within the supported limit.' }, { status: 400 });
    const db = getDatabase();
    const [[destination], [account]] = await Promise.all([
      db.select().from(payoutDestinations).where(and(eq(payoutDestinations.id, destinationId), eq(payoutDestinations.creatorId, creator.id))).limit(1),
      db.select({ bachsAccountId: creators.bachsAccountId, kycStatus: creators.kycStatus }).from(creators).where(eq(creators.id, creator.id)).limit(1),
    ]);
    if (!destination) return NextResponse.json({ error: 'Payout destination not found.' }, { status: 404 });
    if (!account?.bachsAccountId) return NextResponse.json({ error: 'Your payout account is not connected yet. Contact support to finish payout setup.' }, { status: 409 });
    if (!payoutCurrencies.includes(destination.currency as typeof payoutCurrencies[number])) return NextResponse.json({ error: 'This destination currency is not supported by Bachs.' }, { status: 422 });
    if (!getCreatorRiskPolicy()) return NextResponse.json({ error: 'Withdrawals are paused until Onselli configures its approved refund and dispute reserve policy.' }, { status: 409 });
    if (!isPayoutSourceAllowed(sourceCurrency, destination.currency)) return NextResponse.json({ error: `This Bachs payout route must be funded from your ${destination.currency === 'NGN' ? 'NGN or USD' : 'USD'} balance.` }, { status: 409 });
    const pauseReason = await payoutPauseReason({ accountId: account.bachsAccountId, sourceCurrency, destinationCurrency: destination.currency, method: destination.method });
    if (pauseReason) return NextResponse.json({ error: `Withdrawals on this route are paused: ${pauseReason}` }, { status: 409 });
    const providerAccount = await refreshBachsAccount(account.bachsAccountId);
    const accountState = bachsCreatorAccountState(providerAccount.account);
    if (providerAccount.account.id !== account.bachsAccountId || accountState.status !== 'approved' || accountState.payoutsStatus !== 'active' || accountState.transfersStatus !== 'active' || account.kycStatus !== 'approved') return NextResponse.json({ error: 'Complete Bachs identity verification and wait until payout capability is active.' }, { status: 409 });
    const needsInternational = destination.type === 'mobile_money' || destination.type === 'crypto_wallet' || (destination.type === 'bank_account' && destination.countryCode !== 'NG');
    if (needsInternational && !accountState.internationalPayouts) return NextResponse.json({ error: 'International payouts are not enabled. Complete the required name, email, and address details in Bachs verification.' }, { status: 409 });
    await db.update(creators).set({ bachsAccountStatus: accountState.status, bachsTransfersStatus: accountState.transfersStatus, bachsPayoutsStatus: accountState.payoutsStatus, bachsInternationalPayouts: accountState.internationalPayouts, bachsRequirements: accountState.requirements, updatedAt: new Date() }).where(eq(creators.id, creator.id));
    if (!destination.isUsable) return NextResponse.json({ error: 'This payout destination is not ready to receive funds.' }, { status: 409 });
    const providerDestination = await getBachsPayoutDestination(destination.providerDestinationId, account.bachsAccountId);
    if (providerDestination.id !== destination.providerDestinationId || providerDestination.currency !== destination.currency || providerDestination.type !== destination.type) return NextResponse.json({ error: 'The provider destination no longer matches the saved route. Refresh payout settings before withdrawing.' }, { status: 409 });
    if (providerDestination.is_usable !== true) return NextResponse.json({ error: providerDestination.status_reason || 'This payout destination is not currently usable.' }, { status: 409 });
    if (sourceCurrency === destination.currency) {
      const limits = payoutDestinationLimitsMinor(destination.currency, destination.method);
      if (limits && (amountMinor < limits.min || amountMinor > limits.max)) return NextResponse.json({ error: `Enter an amount within Bachs’ ${destination.currency} payout limits.` }, { status: 400 });
      const feeMinor = configuredPayoutFeeMinor(sourceCurrency, destination.method, destination.currency);
      const [available] = await db.select({ total: sum(ledgerEntries.amountMinor) }).from(ledgerEntries).where(and(eq(ledgerEntries.creatorId, creator.id), eq(ledgerEntries.currency, sourceCurrency), eq(ledgerEntries.bucket, 'available')));
      if (feeMinor === null) return NextResponse.json({ error: 'This payout route fee is not configured. Withdrawals are unavailable until finance verifies it.' }, { status: 409 });
      if (BigInt(String(available?.total ?? 0)) < amountMinor + feeMinor) return NextResponse.json({ error: `Your available ${sourceCurrency} balance does not cover the amount and fee.` }, { status: 409 });
      const providerBalances = await getBachsAccountBalances(account.bachsAccountId);
      const providerAvailable = providerBalances.account_id === account.bachsAccountId ? providerBalances.balances.find((balance) => balance.currency.toUpperCase() === sourceCurrency)?.available_balance : null;
      if (!providerAvailable || decimalToMinor(providerAvailable, sourceCurrency) < amountMinor + feeMinor) return NextResponse.json({ error: `Bachs does not have enough settled ${sourceCurrency} to cover this withdrawal and fee.` }, { status: 409 });
      return NextResponse.json({ quoteRequired: false, destinationId, sourceCurrency, destinationCurrency: destination.currency, sourceAmountMinor: amountMinor.toString(), destinationAmountMinor: amountMinor.toString(), feeMinor: feeMinor.toString(), totalDebitMinor: (amountMinor + feeMinor).toString(), feeAvailable: true });
    }
    const quote = await createBachsPayoutQuote({ fromCurrency: sourceCurrency, toCurrency: destination.currency, amount: amountToDecimal(amountMinor, sourceCurrency), method: destination.method === 'mobile_money' ? 'MOBILE_MONEY' : destination.method === 'crypto' ? 'CRYPTO' : 'BANK_TRANSFER', accountId: account.bachsAccountId });
    const expiresAt = new Date(quote.expires_at);
    const quotedFromMinor = decimalToMinor(quote.from_amount, sourceCurrency);
    const destinationMinor = decimalToMinor(quote.to_amount, destination.currency);
    if (!quote.quote_id || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date() || quotedFromMinor !== amountMinor) throw new Error('Bachs returned an invalid or expired payout quote.');
    const limits = payoutDestinationLimitsMinor(destination.currency, destination.method);
    if (limits && (destinationMinor < limits.min || destinationMinor > limits.max)) return NextResponse.json({ error: `The quoted amount is outside Bachs’ ${destination.currency} mobile-money limits.` }, { status: 400 });
    let feeMinor: bigint | null = null;
    if (typeof quote.total_debited === 'string') {
      const total = decimalToMinor(quote.total_debited, sourceCurrency);
      if (total < quotedFromMinor) throw new Error('Bachs returned an invalid payout total.');
      feeMinor = total - quotedFromMinor;
    } else if ((typeof quote.fee === 'string' && quote.fee_currency === sourceCurrency) || (typeof quote.withdrawal_fee === 'string' && (!quote.fee_currency || quote.fee_currency === sourceCurrency))) {
      feeMinor = decimalToMinor(quote.fee ?? quote.withdrawal_fee!, sourceCurrency);
    }
    if (feeMinor === null) return NextResponse.json({ error: 'Bachs did not provide a verifiable fee for this payout quote. Do not continue; contact support.' }, { status: 409 });
    const [available] = await db.select({ total: sum(ledgerEntries.amountMinor) }).from(ledgerEntries).where(and(eq(ledgerEntries.creatorId, creator.id), eq(ledgerEntries.currency, sourceCurrency), eq(ledgerEntries.bucket, 'available')));
    if (BigInt(String(available?.total ?? 0)) < quotedFromMinor + feeMinor) return NextResponse.json({ error: `Your available ${sourceCurrency} balance does not cover this quote and fee.` }, { status: 409 });
    const providerBalances = await getBachsAccountBalances(account.bachsAccountId);
    const providerAvailable = providerBalances.account_id === account.bachsAccountId ? providerBalances.balances.find((balance) => balance.currency.toUpperCase() === sourceCurrency)?.available_balance : null;
    if (!providerAvailable || decimalToMinor(providerAvailable, sourceCurrency) < quotedFromMinor + feeMinor) return NextResponse.json({ error: `Bachs does not have enough settled ${sourceCurrency} to cover this quote and fee.` }, { status: 409 });
    await db.insert(payoutQuotes).values({ creatorId: creator.id, destinationId: destination.id, providerQuoteId: quote.quote_id, sourceCurrency, destinationCurrency: destination.currency, sourceAmountMinor: quotedFromMinor, destinationAmountMinor: destinationMinor, feeMinor, exchangeRate: quote.exchange_rate ?? null, expiresAt });
    return NextResponse.json({ quoteId: quote.quote_id, quoteRequired: true, destinationId, sourceCurrency, destinationCurrency: destination.currency, sourceAmountMinor: quotedFromMinor.toString(), destinationAmountMinor: destinationMinor.toString(), feeMinor: feeMinor?.toString() ?? null, totalDebitMinor: feeMinor === null ? null : (quotedFromMinor + feeMinor).toString(), feeAvailable: feeMinor !== null, exchangeRate: quote.exchange_rate ?? null, expiresAt: expiresAt.toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
    console.error(code === 'PAYOUT_CURRENCY_NOT_ENABLED' ? 'Bachs payout currency is not enabled; flag for provider support review' : 'Payout quote failed', { code: code || 'PROVIDER_ERROR' });
    return NextResponse.json({ error: code === 'PAYOUT_CURRENCY_NOT_ENABLED' ? 'This payout route is not enabled yet. Support has been notified.' : 'Could not get a current payout quote. Refresh and try again.' }, { status: code === 'PAYOUT_CURRENCY_NOT_ENABLED' ? 422 : 503 });
  }
}
