'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, CircleHelp, ExternalLink, Landmark, LockKeyhole, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import CreatorNav from '../CreatorNav';

type Transaction = { id: string; type: string; bucket: string; amountMinor: string; currency: string; refType: string; reference: string; context: string; createdAt: string; orderGrossMinor: string | null; buyerPaidAmountMinor: string | null; buyerPaidCurrency: string | null; feesMinor: string | null; payoutStatus: string | null; providerReference: string | null };
type Payout = { id: string; amount_minor: string; currency: string; source_amount_minor: string; source_currency: string; fee_minor: string; status: string; requested_at: string; updated_at: string; provider_ref: string | null; bank_snapshot: { destinationName?: string; type?: string; currency?: string; maskedDetails?: string; exchangeRate?: string | null } | null; timeline: { status: string; at: string; message: string }[]; decision_reason: string | null; failure_reason: string | null };
type Destination = { id: string; name: string; type: string; currency: string; countryCode?: string | null; method: string; maskedDetails: string | null; verified: boolean; isDefault: boolean };
type Earnings = { currency: string; currencies: string[]; range: string; balances: { pending: string; available: string; reserved: string; held: string }; paidOutMinor: string; payoutFeeMinor: string | null; riskPolicyReady: boolean; kycStatus: string; connect: { accountStatus: string; transfersStatus: string; payoutsStatus: string; internationalPayouts: boolean; requirements: { currentlyDue?: string[]; pendingVerification?: string[]; errors?: string[] } } | null; hasEarnings: boolean; destination: Destination | null; destinations: Destination[]; payouts: Payout[]; transactions: Transaction[] };
type WalletTrend = { currency: WalletCurrency; range: Range; unit: 'day' | 'month'; points: { period: string; amountMinor: string }[] };
type Range = '7' | '30' | '90' | 'all';
type WalletCurrency = string;
type WalletView = 'balance' | 'transactions' | 'methods';

const currencyDigits = (currency: string) => /^(USDT|USDC)_/.test(currency) ? 6 : new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
const currencyScale = (currency: string) => 10 ** currencyDigits(currency);
const money = (minor: string | number, currency: WalletCurrency) => {
  try {
    const value = BigInt(String(minor)); const negative = value < 0n; const absolute = negative ? -value : value; const digits = currencyDigits(currency); const scale = 10n ** BigInt(digits); const whole = absolute / scale; const fraction = (absolute % scale).toString().padStart(digits, '0');
    const grouped = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(whole);
    if (!/^[A-Z]{3}$/.test(currency)) return `${currency} ${grouped}${digits ? `.${fraction}` : ''}`;
    const formatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
    return formatter.formatToParts(negative ? -1 : 1).map(part => part.type === 'integer' ? grouped : part.type === 'fraction' ? fraction : part.value).join('');
  } catch { return `${currency} ${String(minor)}`; }
};
const toMinorUnits = (value: string, currency: string) => {
  let digits: number;
  try { digits = currencyDigits(currency); } catch { return null; }
  const match = (digits ? new RegExp(`^(\\d+)(?:\\.(\\d{1,${digits}}))?$`) : /^(\d+)$/).exec(value.trim());
  if (!match) return null;
  return BigInt(match[1] ?? '0') * (10n ** BigInt(digits)) + BigInt((match[2] ?? '').padEnd(digits, '0') || '0');
};
const minorToInput = (minor: bigint, currency: string) => { const digits = currencyDigits(currency); const scale = 10n ** BigInt(digits); return digits ? `${minor / scale}.${(minor % scale).toString().padStart(digits, '0')}` : String(minor); };
const dateTime = (value: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const periodLabel = (value: Range) => value === 'all' ? 'all time' : `the last ${value} days`;
const pendingStatuses = ['requested', 'approved', 'processing'];

export default function CreatorEarningsPage() {
  const [data, setData] = useState<Earnings | null>(null);
  const [range, setRange] = useState<Range>('30');
  const [currency, setCurrency] = useState<WalletCurrency>('NGN');
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [quote, setQuote] = useState<{ quoteId?: string; quoteRequired: boolean; sourceCurrency: string; destinationCurrency: string; sourceAmountMinor: string; destinationAmountMinor: string; feeMinor: string | null; totalDebitMinor: string | null; exchangeRate: string | null; expiresAt?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [connectBusy, setConnectBusy] = useState(false);
  const [activeView, setActiveView] = useState<WalletView>('balance');
  const [retryToken, setRetryToken] = useState(0);
  const [trend, setTrend] = useState<WalletTrend | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');

  const load = useCallback(async (selectedRange: Range, selectedCurrency: WalletCurrency, signal?: AbortSignal) => {
    const response = await fetch(`/api/workspace/earnings?range=${selectedRange}&currency=${selectedCurrency}`, { cache: 'no-store', signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Your wallet could not be loaded.');
    if (signal?.aborted) return;
    setData(payload as Earnings);
    if (!destinationId) {
      const suggested = (payload.destinations as Destination[] | undefined)?.find(item => item.currency === selectedCurrency && item.isDefault && item.verified)
        ?? (payload.destinations as Destination[] | undefined)?.find(item => item.currency === selectedCurrency && item.verified)
        ?? (payload.destinations as Destination[] | undefined)?.find(item => item.isDefault && item.verified)
        ?? (payload.destinations as Destination[] | undefined)?.find(item => item.verified);
      if (suggested) setDestinationId(suggested.id);
    }
    setError('');
    if (!signal?.aborted && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('connect')) {
      const statusResponse = await fetch('/api/workspace/payouts/connect', { cache: 'no-store', signal });
      const status = await statusResponse.json().catch(() => ({}));
      if (statusResponse.ok) setData(current => current ? { ...current, connect: { accountStatus: status.status, transfersStatus: status.transfersStatus, payoutsStatus: status.payoutsStatus, internationalPayouts: status.internationalPayouts === true, requirements: status.requirements } } : current);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [destinationId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void load(range, currency, controller.signal).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Your wallet could not be loaded.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, range, currency, retryToken]);

  useEffect(() => {
    const controller = new AbortController();
    setTrendLoading(true);
    setTrendError('');
    void fetch(`/api/workspace/earnings/trend?range=${range}&currency=${currency}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Wallet activity could not be loaded.');
        if (!controller.signal.aborted) setTrend(payload as WalletTrend);
      })
      .catch(cause => { if (!controller.signal.aborted) setTrendError(cause instanceof Error ? cause.message : 'Wallet activity could not be loaded.'); })
      .finally(() => { if (!controller.signal.aborted) setTrendLoading(false); });
    return () => controller.abort();
  }, [range, currency, retryToken]);

  const activePayout = useMemo(() => data?.payouts.find(item => pendingStatuses.includes(item.status)), [data]);
  const selectedDestination = data?.destinations.find(item => item.id === destinationId) ?? data?.destination ?? null;
  const failedPayout = useMemo(() => data?.payouts[0]?.status === 'failed' ? data.payouts[0] : undefined, [data]);
  const isCurrentCurrency = data?.currency === currency;
  const isCurrentRange = data?.range === range;
  const isCurrentData = isCurrentCurrency && isCurrentRange;
  const selectedRouteNeedsInternational = Boolean(selectedDestination && (selectedDestination.type === 'mobile_money' || selectedDestination.type === 'crypto_wallet' || (selectedDestination.type === 'bank_account' && selectedDestination.countryCode !== 'NG')));
  const connectStatus = data?.connect?.accountStatus ?? 'not_created';
  const availableMinor = BigInt(data?.balances.available ?? '0');
  const configuredFeeMinor = BigInt(data?.payoutFeeMinor ?? '0');
  const currentQuoteFeeMinor = quote?.totalDebitMinor ? BigInt(quote.totalDebitMinor) - BigInt(quote.sourceAmountMinor) : null;
  const withdrawFeeMinor = currentQuoteFeeMinor ?? (selectedDestination?.currency === currency ? configuredFeeMinor : 0n);
  const maxWithdrawMinor = availableMinor > withdrawFeeMinor ? availableMinor - withdrawFeeMinor : 0n;
  const connectReady = data?.connect?.payoutsStatus === 'active' && data.connect.transfersStatus === 'active' && data.kycStatus === 'approved';
  const withdrawReason = !data ? 'Loading withdrawal eligibility…'
    : !isCurrentCurrency ? `Updating ${currency} withdrawal details…`
    : !data.hasEarnings ? 'Withdrawals become available after your first successful sale.'
    : !connectReady ? connectStatus === 'pending_review' ? 'Bachs is reviewing your verification.' : 'Complete identity verification with Bachs.'
    : !selectedDestination ? 'Add a supported payout destination in Payout settings.'
    : !selectedDestination.verified ? 'Your payout destination is still being verified by Bachs.'
    : selectedRouteNeedsInternational && currency !== 'USD' ? 'This international bank or mobile-money route must be funded from your USD balance. Switch to USD to continue.'
    : selectedRouteNeedsInternational && !data.connect?.internationalPayouts ? 'Enable international payouts in Bachs verification and complete your name, email, and address details.'
    : activePayout ? 'A withdrawal is already being processed.'
    : !data.riskPolicyReady ? 'Withdrawals are paused until Onselli configures its approved refund and dispute reserve policy.'
    : availableMinor <= 0n ? `There is no available ${currency} balance to withdraw.`
    : data.payoutFeeMinor === null && selectedDestination.currency === currency ? 'Withdrawals are paused until the confirmed Bachs payout fee is configured for this route.'
    : selectedDestination.currency === currency && availableMinor <= configuredFeeMinor ? 'There are no settled funds available to cover a withdrawal and its fee.'
    : '';

  async function startVerification() {
    setConnectBusy(true); setError('');
    try {
      const response = await fetch('/api/workspace/payouts/connect', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== 'string') throw new Error(payload.error || 'Could not open verification.');
      window.location.assign(payload.url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open verification.'); setConnectBusy(false); }
  }

  async function requestPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !isCurrentCurrency || withdrawReason) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const amountMinor = toMinorUnits(amount, currency);
      if (amountMinor === null || amountMinor <= 0n) throw new Error(`Enter a valid ${currency} amount using the decimal places for that currency.`);
      if (selectedDestination?.currency === currency && amountMinor + configuredFeeMinor > availableMinor) throw new Error('The amount and payout fee exceed your available balance.');
      if (!selectedDestination?.id) throw new Error('Add a supported payout destination in Payout settings.');
      if (quote && ((quote.expiresAt && quote.expiresAt <= new Date().toISOString()) || quote.sourceCurrency !== currency || quote.sourceAmountMinor !== String(amountMinor) || selectedDestination.currency !== quote.destinationCurrency)) setQuote(null);
      if (!quote || (quote.expiresAt && quote.expiresAt <= new Date().toISOString()) || quote.sourceCurrency !== currency || quote.sourceAmountMinor !== String(amountMinor) || selectedDestination.currency !== quote.destinationCurrency) {
        const quoteResponse = await fetch('/api/workspace/payouts/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinationId: selectedDestination.id, sourceCurrency: currency, amountMinor: amountMinor.toString() }) });
        const quoted = await quoteResponse.json().catch(() => ({}));
        if (!quoteResponse.ok) throw new Error(quoted.error || 'Could not get a current payout quote.');
        if (!quoted.feeAvailable || !quoted.totalDebitMinor) throw new Error('The confirmed payout fee is not configured for this route. Contact support before withdrawing.');
        if (BigInt(quoted.totalDebitMinor) > availableMinor) throw new Error('The quoted amount and fees exceed your available balance.');
        setQuote({ ...quoted, quoteRequired: Boolean(quoted.quoteRequired) });
        setNotice('Review the payout amount, destination, and fees, then confirm this withdrawal.');
        return;
      }
      if (!quote.totalDebitMinor || BigInt(quote.totalDebitMinor) > availableMinor) throw new Error('The quoted amount and fees exceed your available balance. Get a fresh quote.');
      const response = await fetch('/api/workspace/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinationId: selectedDestination.id, sourceCurrency: currency, amountMinor: amountMinor.toString(), ...(quote.quoteRequired && quote.quoteId ? { quoteId: quote.quoteId } : {}) }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Your withdrawal request could not be submitted.');
      setNotice('Withdrawal submitted to Bachs. The amount is reserved while the payout is processed.'); setAmount(''); setQuote(null);
      setRetryToken(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your withdrawal request could not be submitted.'); }
    finally { setBusy(false); }
  }

  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main">
    <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Wallet &amp; Payouts</strong></div></header>
    <div className="creator-dashboard__body studio-overview wallet-page">
      <header className="workspace-page-heading wallet-page__heading"><div><h1>Wallet &amp; payouts</h1><p>Manage your balances, payouts, and transaction history.</p></div><button className="wallet-withdraw-button wallet-withdraw-button--header" type={activeView === 'balance' ? 'submit' : 'button'} form={activeView === 'balance' ? 'wallet-withdraw-form' : undefined} onClick={activeView === 'balance' ? undefined : () => setActiveView('balance')} disabled={activeView === 'balance' ? (!isCurrentCurrency || Boolean(withdrawReason) || busy) : false}>{busy ? 'Submitting…' : activeView === 'balance' ? 'Withdraw funds' : 'Go to balance'}<ArrowUpRight size={16}/></button></header>
      {notice && <p className="form-success" role="status">{notice}</p>}
      {error && <div className="creator-dashboard-error" role="alert"><CircleHelp size={19}/><div><strong>Wallet needs attention</strong><p>{error}</p></div><button type="button" onClick={() => { setLoading(true); setError(''); setRetryToken(value => value + 1); }}>Retry</button></div>}
      {loading && !data ? <WalletSkeleton/> : data && <>
        {!connectReady && connectStatus !== 'pending_review' && <div className={`wallet-kyc-callout${!data.hasEarnings ? ' wallet-kyc-callout--ready' : connectStatus === 'rejected' ? ' wallet-kyc-callout--attention' : ''}`}><span className="wallet-kyc-callout__icon"><ShieldCheck size={18}/></span><div><strong>{connectStatus === 'rejected' ? 'Verification needs attention' : data.hasEarnings ? 'Verify your identity to withdraw' : 'Get ready for your first payout'}</strong><p>{connectStatus === 'rejected' ? 'Review your details with Bachs to continue setting up payouts.' : data.hasEarnings ? 'Complete Bachs’ secure verification. Onselli receives your status, not your identity documents.' : 'Complete identity verification with Bachs now. Withdrawals become available after your first successful sale.'}</p></div><button type="button" onClick={() => void startVerification()} disabled={connectBusy}>{connectBusy ? 'Opening…' : connectStatus === 'rejected' ? 'Review details' : data.hasEarnings ? 'Verify now' : 'Start verification'}</button></div>}
        {!connectReady && connectStatus === 'pending_review' && <div className="wallet-kyc-callout wallet-kyc-callout--approved"><span className="wallet-kyc-callout__icon"><ShieldCheck size={18}/></span><div><strong>Verification is under review</strong><p>Bachs will update this page when the review is complete. Withdrawals become available after your first successful sale and verification approval.</p></div></div>}

        <div className="wallet-overview-toolbar"><div><span className="wallet-overview-toolbar__eyebrow">Wallet balance</span><p>Current ledger balances in {data.currency}. Each currency is kept separate.</p></div><div className="wallet-currency-switch-wrap"><div className="wallet-currency-switch" role="group" aria-label="Balance currency">{data.currencies.map((code) => <button type="button" key={code} aria-pressed={currency === code} className={currency === code ? 'is-active' : ''} onClick={() => { setAmount(''); setQuote(null); setCurrency(code); }}>{code}</button>)}</div>{loading && !isCurrentCurrency && <span className="wallet-inline-loading" role="status"><i/>Updating to {currency}; still showing {data.currency}</span>}{error && !isCurrentCurrency && <span className="wallet-inline-loading wallet-inline-loading--error" role="status">Showing {data.currency}; {currency} balances could not be loaded.</span>}</div></div>
        <section className="wallet-summary-grid" aria-label={`Wallet balances in ${data.currency}`}>
          <BalanceCard label="Available to withdraw" value={money(data.balances.available, data.currency)} detail="Settled funds, subject to withdrawal eligibility"/>
          <BalanceCard label="Pending" value={money(data.balances.pending, data.currency)} detail="Funds awaiting settlement"/>
          <BalanceCard label="Paid out" value={money(data.paidOutMinor, data.currency)} detail="Total sent to payout destinations"/>
        </section>

        {data.payouts.length > 0 && <section className="wallet-panel wallet-recent-activity" aria-labelledby="wallet-payout-history-title"><div className="wallet-recent-activity__heading"><div><h2 id="wallet-payout-history-title">Withdrawal history</h2><p>Amounts and statuses are shown in their own currencies.</p></div></div><div className="wallet-recent-activity__list">{data.payouts.slice(0, 8).map(payout => <article key={payout.id}><span className={`wallet-recent-activity__icon wallet-recent-activity__icon--${statusClass(payout.status)}`}><ArrowUpRight size={15}/></span><div><strong>{money(payout.amount_minor, payout.currency)} to {payout.bank_snapshot?.destinationName ?? 'saved payout destination'}</strong><small>Debited {money((BigInt(payout.source_amount_minor) + BigInt(payout.fee_minor)).toString(), payout.source_currency)} · fee {money(payout.fee_minor, payout.source_currency)}</small><small>{payout.bank_snapshot?.type ?? 'destination'} · {payout.bank_snapshot?.maskedDetails ?? 'masked details unavailable'} · requested {dateTime(payout.requested_at)}</small><small>Status: {payout.timeline.length ? payout.timeline.map(step => `${readable(step.status)} · ${dateTime(step.at)}`).join(' → ') : readable(payout.status)}</small><small>Support reference: {payout.provider_ref ?? 'pending'}</small>{(payout.failure_reason || payout.decision_reason) && <small>{payout.failure_reason || payout.decision_reason}</small>}</div><b className={`wallet-status-pill wallet-status-pill--${statusClass(payout.status)}`}>{readable(payout.status)}</b></article>)}</div></section>}

        <nav className="wallet-view-tabs" role="tablist" aria-label="Wallet sections">
          {([['balance', 'Balance'], ['transactions', 'Transactions'], ['methods', 'Payout methods']] as [WalletView, string][]).map(([view, label], index, views) => <button key={view} id={`wallet-tab-${view}`} role="tab" type="button" aria-selected={activeView === view} tabIndex={activeView === view ? 0 : -1} className={activeView === view ? 'is-active' : ''} onClick={() => setActiveView(view)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const direction = event.key === 'ArrowRight' ? 1 : -1; const nextView = views[(index + direction + views.length) % views.length]?.[0]; if (!nextView) return; setActiveView(nextView); document.getElementById(`wallet-tab-${nextView}`)?.focus(); } }}>{label}</button>)}
        </nav>

        {failedPayout && <div className="wallet-payout-alert" role="status"><span className="wallet-payout-alert__icon"><ShieldAlert size={17}/></span><div><strong>Latest payout failed</strong><p>{money((BigInt(failedPayout.source_amount_minor) + BigInt(failedPayout.fee_minor)).toString(), failedPayout.source_currency)} was returned to your available balance, including the payout fee. {failedPayout.failure_reason || failedPayout.decision_reason || 'Review your payout method before submitting another withdrawal.'}</p></div><Link href="/workspace/settings/payouts">Review payout method<ExternalLink size={14}/></Link></div>}

        {activeView === 'balance' && <section className="wallet-view-panel" id="wallet-panel-balance" role="tabpanel" aria-labelledby="wallet-tab-balance" tabIndex={0}>
        <WalletTrendPanel trend={trend} currency={currency} range={range} loading={trendLoading} error={trendError} onRangeChange={setRange}/>
        <section className="wallet-balance-breakdown" aria-labelledby="wallet-breakdown-title"><div className="wallet-balance-breakdown__heading"><h2 id="wallet-breakdown-title">Other balance states</h2><p>These funds are not currently available to withdraw.</p></div><dl><div><dt><span className="wallet-balance-breakdown__icon"><LockKeyhole size={14}/></span><span>Reserved</span><small>Withdrawal in progress</small></dt><dd>{money(data.balances.reserved, data.currency)}</dd></div><div><dt><span className="wallet-balance-breakdown__icon"><ShieldAlert size={14}/></span><span>Held</span><small>Refund and dispute reserve</small></dt><dd>{money(data.balances.held, data.currency)}</dd></div></dl></section>
        <section className="wallet-primary-grid">
          <article className="wallet-panel wallet-withdraw-panel"><div className="wallet-panel-heading"><div><h2>Withdraw funds</h2><p>Sent to your default {data.currency} payout destination through Bachs.</p></div></div>
            <form id="wallet-withdraw-form" className="wallet-withdraw-form" onSubmit={requestPayout}><label htmlFor="wallet-withdraw-destination">Payout destination</label><select id="wallet-withdraw-destination" value={selectedDestination?.id ?? ''} onChange={event => { setDestinationId(event.target.value); setQuote(null); }} required><option value="">Choose a verified destination</option>{data.destinations.map(item => <option key={item.id} value={item.id} disabled={!item.verified}>{item.name} · {item.currency} · {readable(item.method)}{item.isDefault ? ' · Default' : ''}</option>)}</select><label htmlFor="wallet-withdraw-amount">Amount to withdraw from {currency}</label><div className="wallet-amount-field"><span>{currency}</span><input id="wallet-withdraw-amount" inputMode="decimal" min={minorToInput(1n, currency)} max={minorToInput(maxWithdrawMinor, currency)} step={1 / currencyScale(currency)} type="number" required value={amount} disabled={!isCurrentCurrency} onChange={event => { setAmount(event.target.value); setQuote(null); setNotice(''); }} placeholder="0"/><span>{currency}</span></div><div className="wallet-withdraw-form__meta"><span>{quote ? `Quoted fee: ${quote.feeMinor === null ? 'Unavailable' : money(quote.feeMinor, quote.sourceCurrency)}` : data.payoutFeeMinor !== null ? `Payout fee: ${money(data.payoutFeeMinor, data.currency)}` : 'Payout fee unavailable'}</span><button type="button" disabled={!isCurrentCurrency || maxWithdrawMinor <= 0n} onClick={() => maxWithdrawMinor > 0n && setAmount(minorToInput(maxWithdrawMinor, currency))}>Use available balance</button></div>
              {quote && <p className="wallet-withdraw-reason" role="status">Review: send {money(quote.sourceAmountMinor, quote.sourceCurrency)}; recipient gets {money(quote.destinationAmountMinor, quote.destinationCurrency)}. Fee: {quote.feeMinor === null ? 'Unavailable' : money(quote.feeMinor, quote.sourceCurrency)}.{quote.sourceCurrency !== quote.destinationCurrency ? ` Rate: ${quote.exchangeRate ?? 'provider quote'}.` : ''}{quote.expiresAt ? ` Quote expires ${dateTime(quote.expiresAt)}.` : ''}</p>}
              {withdrawReason && <p className="wallet-withdraw-reason" role="status">{withdrawReason}{(!selectedDestination || !selectedDestination.verified) && <> <Link href="/workspace/settings/payouts">Payout settings</Link></>}</p>}
              <button className="wallet-withdraw-button wallet-withdraw-button--form" type="submit" disabled={!isCurrentCurrency || Boolean(withdrawReason) || busy}>{busy ? 'Submitting…' : quote ? 'Confirm withdrawal' : 'Review withdrawal'}<ArrowUpRight size={16}/></button>
            </form>
            <p className="wallet-manual-note"><Banknote size={15}/> You start each withdrawal. Bachs processes it to your selected destination; processing does not mean it has arrived.</p>
          </article>
          <article className="wallet-panel wallet-method-panel"><h2>Selected payout method</h2><div className="wallet-destination"><span className="wallet-destination__icon"><Landmark size={17}/></span><div><small>{selectedDestination ? `${selectedDestination.currency} destination` : 'Payout destination'}</small><strong>{selectedDestination ? `${selectedDestination.name} · ${selectedDestination.maskedDetails ?? selectedDestination.type}` : 'No approved destination selected'}</strong></div></div><div className="wallet-method-panel__status"><span className={selectedDestination?.verified ? 'is-ready' : ''}>{selectedDestination?.verified ? 'Ready for payouts' : 'Review payout settings'}</span><Link href="/workspace/settings/payouts">Manage<ExternalLink size={13}/></Link></div><div className="wallet-method-panel__kyc"><ShieldCheck size={16}/><span>Identity verification</span><strong>{readable(connectStatus)}</strong></div>{!selectedDestination && <p className="wallet-method-panel__hint">A bank account may still be under review. Open payout settings to check its status or add a method.</p>}
          </article>
        </section>
        {loading && !isCurrentData ? <section className="wallet-panel wallet-recent-activity"><div className="wallet-recent-activity__heading"><div><h2>Recent activity</h2><p>Latest ledger entries in {data.currency}.</p></div></div><p className="wallet-history-loading"><RefreshCw size={15}/> Updating wallet activity…</p></section> : data.transactions.length > 0 ? <section className="wallet-panel wallet-recent-activity"><div className="wallet-recent-activity__heading"><div><h2>Recent activity</h2><p>Latest ledger entries in {data.currency}.</p></div><button type="button" onClick={() => setActiveView('transactions')}>View transactions<ArrowUpRight size={14}/></button></div><div className="wallet-recent-activity__list">{data.transactions.slice(0, 3).map(tx => <article key={tx.id}><span className={`wallet-recent-activity__icon wallet-recent-activity__icon--${statusClass(tx.payoutStatus || tx.bucket)}`}>{tx.type === 'payout_reservation' || tx.type === 'payout_paid' ? <ArrowUpRight size={15}/> : <ArrowDownLeft size={15}/>}</span><div><strong>{tx.context || transactionLabel(tx.type, tx.bucket)}</strong><small>{transactionLabel(tx.type, tx.bucket)} · {dateTime(tx.createdAt)}</small></div><b className={BigInt(tx.amountMinor) < 0n ? 'is-debit' : 'is-credit'}>{tx.type === 'refund' || tx.type === 'dispute' ? '—' : `${BigInt(tx.amountMinor) > 0n ? '+' : ''}${money(tx.amountMinor, data.currency)}`}</b></article>)}</div></section> : <section className="wallet-panel wallet-recent-activity wallet-history-empty"><span><ArrowDownLeft size={19}/></span><strong>No wallet activity yet</strong><p>Settled sales, holds, and withdrawals will appear here.</p></section>}
        </section>}

        {activeView === 'transactions' && <section className="wallet-panel wallet-history" id="wallet-panel-transactions" role="tabpanel" aria-labelledby="wallet-tab-transactions" tabIndex={0}><div className="wallet-history-heading"><div><span className="wallet-section-eyebrow">{data.currency} ledger</span><h2>Transactions</h2><p>Entries shown in {data.currency} for the selected period.</p></div><label className="wallet-range-select"><span className="sr-only">Filter transactions by date</span><WorkspaceSelect menuClassName="workspace-select__content--wallet" hideCheckmark value={range} onChange={event => setRange(event.target.value as Range)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></WorkspaceSelect></label></div>
          {loading || !isCurrentData ? <p className={`wallet-history-loading${error ? ' wallet-history-loading--error' : ''}`} role="status">{error ? `Could not load ${currency} transactions for ${periodLabel(range)}. The last successful results were ${data.currency} for ${periodLabel(data.range as Range)}.` : <><RefreshCw size={15}/> Updating transactions…</>}</p> : data.transactions.length ? <><div className="wallet-table-wrap"><table className="wallet-table"><thead><tr><th>Date</th><th>Transaction</th><th>Product / reference</th><th>Buyer paid</th><th>Creator sale</th><th>Platform fee</th><th>Net movement</th><th>Status</th></tr></thead><tbody>{data.transactions.map(tx => <tr key={tx.id}><td data-label="Date">{dateTime(tx.createdAt)}</td><td data-label="Transaction"><strong>{transactionLabel(tx.type, tx.bucket)}</strong><small>{tx.reference}</small></td><td data-label="Product / reference"><span>{tx.context}</span>{tx.providerReference && <small>Provider ref: {tx.providerReference}</small>}</td><td data-label="Buyer paid">{tx.buyerPaidAmountMinor ? money(tx.buyerPaidAmountMinor, tx.buyerPaidCurrency || data.currency) : '—'}</td><td data-label="Creator sale">{tx.orderGrossMinor ? money(tx.orderGrossMinor, data.currency) : '—'}</td><td data-label="Platform fee">{tx.feesMinor ? money(tx.feesMinor, data.currency) : '—'}</td><td data-label="Net movement" className={tx.type === 'refund' || tx.type === 'dispute' ? 'is-neutral' : BigInt(tx.amountMinor) < 0n ? 'is-debit' : 'is-credit'}>{tx.type === 'refund' || tx.type === 'dispute' ? 'No balance change' : `${BigInt(tx.amountMinor) > 0n ? '+' : ''}${money(tx.amountMinor, data.currency)}`}</td><td data-label="Status"><span className={`wallet-status-pill wallet-status-pill--${statusClass(tx.payoutStatus || tx.bucket)}`}>{readable(tx.payoutStatus || tx.bucket)}</span></td></tr>)}</tbody></table></div><p className="wallet-history-footnote">Showing {data.transactions.length === 100 ? 'the latest 100' : data.transactions.length} entries.</p></> : <div className="wallet-history-empty"><span><ArrowDownLeft size={19}/></span><strong>{data.hasEarnings ? 'No activity in this period' : 'No earnings yet'}</strong><p>{data.hasEarnings ? 'Choose a longer date range to see earlier transactions.' : 'Paid sales and balance updates will appear here.'}</p></div>}
        </section>}

        {activeView === 'methods' && <section className="wallet-panel wallet-methods-view" id="wallet-panel-methods" role="tabpanel" aria-labelledby="wallet-tab-methods" tabIndex={0}><div className="wallet-panel-heading"><div><span className="wallet-section-eyebrow">Withdrawal destination</span><h2>Payout methods</h2><p>Manage destinations and check verification in your payout settings.</p></div><Landmark size={20}/></div>{selectedDestination ? <article className="wallet-methods-view__destination"><span className="wallet-destination__icon"><Landmark size={18}/></span><div><strong>{selectedDestination.name}</strong><small>{selectedDestination.maskedDetails} · {selectedDestination.currency}</small></div><span className="wallet-methods-view__status"><CheckCircle2 size={15}/> Approved</span></article> : <div className="wallet-methods-view__empty"><span><Landmark size={19}/></span><div><strong>No approved default destination</strong><p>There may be a destination under review. Open payout settings to check its status or add a bank account.</p></div></div>}<dl className="wallet-methods-view__connect"><div><dt>Identity verification</dt><dd>{readable(data.kycStatus)}</dd></div><div><dt>Payout account</dt><dd>{readable(data.connect?.payoutsStatus ?? 'unavailable')}</dd></div><div><dt>International payouts</dt><dd>{data.connect?.internationalPayouts ? 'Enabled' : 'Not enabled'}</dd></div><div><dt>Transfers</dt><dd>{readable(data.connect?.transfersStatus ?? 'unavailable')}</dd></div></dl><Link className="wallet-methods-view__manage" href="/workspace/settings/payouts">Manage payout settings<ArrowUpRight size={15}/></Link></section>}
      </>}
    </div>
  </div></main>;
}

function BalanceCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="wallet-balance-card"><div className="wallet-balance-card__top"><span className="wallet-balance-card__label">{label}</span></div><strong>{value}</strong><small>{detail}</small></article>;
}

function WalletTrendPanel({ trend, currency, range, loading, error, onRangeChange }: { trend: WalletTrend | null; currency: WalletCurrency; range: Range; loading: boolean; error: string; onRangeChange: (range: Range) => void }) {
  const isCurrent = trend?.currency === currency && trend.range === range;
  const points = trend?.points ?? [];
  const chartCurrency = trend?.currency ?? currency;
  const chartRange = trend?.range ?? range;
  const values = points.map(point => Number(point.amountMinor) / currencyScale(currency)).filter(Number.isFinite);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const span = maxValue - minValue || 1;
  const left = 52, right = 992, top = 20, bottom = 218;
  const xy = values.map((value, index) => ({ x: left + (points.length <= 1 ? 0 : (right - left) * index / (points.length - 1)), y: top + (maxValue - value) / span * (bottom - top), value }));
  const line = xy.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const zeroY = top + (maxValue / span) * (bottom - top);
  const area = xy.length > 1 ? `${line} L${right},${zeroY.toFixed(1)} L${left},${zeroY.toFixed(1)} Z` : '';
  const dateLabel = (period: string) => new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${period.slice(0, 10)}T00:00:00Z`));
  const formatTick = (value: number) => new Intl.NumberFormat('en-NG', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const labels = points.length ? [points[0]!.period, points[Math.floor((points.length - 1) / 2)]!.period, points[points.length - 1]!.period] : [];
  const currentPeriod = chartRange === 'all' ? 'all time, grouped by month' : `the last ${chartRange} days, grouped by day`;

  return <section className="wallet-panel wallet-trend" aria-labelledby="wallet-trend-title">
    <div className="wallet-trend__heading"><div><h2 id="wallet-trend-title">Available balance movement</h2><p>Net changes recorded in the available ledger bucket · {currency} · {currentPeriod}</p></div><label className="wallet-range-select"><span className="sr-only">Chart date range</span><WorkspaceSelect menuClassName="workspace-select__content--wallet" hideCheckmark value={range} onChange={event => onRangeChange(event.target.value as Range)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></WorkspaceSelect></label></div>
    {loading && !isCurrent && <p className="wallet-trend__status" role="status"><RefreshCw size={15}/> {trend ? `Showing ${chartCurrency} · ${periodLabel(chartRange)} while updating to ${currency} · ${periodLabel(range)}…` : `Loading chart for ${currency} · ${periodLabel(range)}…`}</p>}
    {error && !isCurrent && <p className="wallet-trend__status wallet-trend__status--error" role="status">{trend ? `Could not update the chart. Showing the last loaded ${chartCurrency} activity for ${periodLabel(chartRange)}.` : error}</p>}
    {points.length > 0 ? <>
      <p className="sr-only" id="wallet-trend-summary">Chart of net changes to the available wallet balance in {chartCurrency} for {currentPeriod}. Values may be positive or negative. The selected range contains {points.length} periods.</p>
      <div className="wallet-trend__chart" role="img" aria-labelledby="wallet-trend-title wallet-trend-summary">
        <div className="wallet-trend__scale" aria-hidden="true"><span>{chartCurrency} {formatTick(maxValue)}</span><span>{chartCurrency} {formatTick((maxValue + minValue) / 2)}</span><span>{chartCurrency} {formatTick(minValue)}</span></div>
        <svg viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
          {[0, 1, 2].map(index => <line key={index} className="wallet-trend__gridline" x1={left} x2={right} y1={top + (bottom - top) * index / 2} y2={top + (bottom - top) * index / 2}/>)}
          {values.length > 1 && <path className="wallet-trend__area" d={area}/>}
          {values.length > 1 ? <path className="wallet-trend__line" d={line}/> : <circle className="wallet-trend__point" cx={xy[0]?.x ?? left} cy={xy[0]?.y ?? bottom} r="4"/>}
        </svg>
        <div className="wallet-trend__dates" aria-hidden="true">{labels.map((label, index) => <span key={`${label}-${index}`}>{dateLabel(label)}</span>)}</div>
      </div>
      <p className="wallet-trend__note">This shows ledger movement, not total sales or a forecast.</p>
    </> : isCurrent ? <div className="wallet-trend__empty"><strong>No available-balance activity in this period</strong><span>Ledger changes will appear here when your available balance moves.</span></div> : !loading && !error ? <p className="wallet-trend__status" role="status">The chart is waiting for the selected period.</p> : null}
  </section>;
}

function WalletSkeleton() {
  return <section className="wallet-initial-skeleton" aria-label="Loading wallet and payouts" aria-busy="true">
    <span className="sr-only" role="status">Loading wallet and payout information…</span>
    <div className="wallet-initial-skeleton__banner" aria-hidden="true"><i/><div><b/><b/></div><i/></div>
    <div className="wallet-overview-toolbar"><div><span className="wallet-overview-toolbar__eyebrow">Wallet balance</span><p>Balances remain separate by currency.</p></div><div className="wallet-currency-switch" aria-hidden="true"><span>NGN</span><span>USD</span></div></div>
    <div className="wallet-initial-skeleton__cards" aria-label="Balance summary loading">{['Available to withdraw', 'Pending', 'Paid out'].map(label => <div key={label}><span className="wallet-initial-skeleton__label">{label}</span><b/><small/></div>)}</div>
    <div className="wallet-initial-skeleton__tabs" role="tablist" aria-label="Wallet sections"><span>Balance</span><span>Transactions</span><span>Payout methods</span></div>
    <section className="wallet-panel wallet-trend"><div className="wallet-panel-heading"><div><h2>Available balance activity</h2><p>Loading ledger activity…</p></div></div><div className="wallet-initial-skeleton__panel" aria-hidden="true"><i/><i/><i/></div></section>
    <section className="wallet-panel wallet-balance-breakdown"><div className="wallet-panel-heading"><div><h2>Other balance states</h2><p>These amounts are not available to withdraw.</p></div></div><div className="wallet-initial-skeleton__columns" aria-hidden="true"><div><b/><i/></div><div><b/><i/></div></div></section>
    <section className="wallet-panel wallet-recent-activity"><div className="wallet-recent-activity__heading"><div><h2>Recent activity</h2><p>Latest ledger entries</p></div></div><div className="wallet-initial-skeleton__activity" aria-hidden="true">{[0, 1, 2].map(item => <i key={item}/>)}</div></section>
  </section>;
}

function transactionLabel(type: string, bucket: string) {
  if (type === 'refund') return 'Buyer refund';
  if (type === 'dispute') return 'Dispute';
  if (type === 'sale') return bucket === 'pending' ? 'Sale earning' : 'Sale adjustment';
  if (type === 'sale_settlement') return 'Sale settlement';
  if (type === 'hold_release') return bucket === 'available' ? 'Earning released' : 'Hold released';
  if (type === 'payout_reservation') return 'Withdrawal request';
  if (type === 'payout_reversal') return 'Withdrawal returned';
  if (type === 'payout_failed') return 'Withdrawal failed';
  return readable(type);
}

function statusClass(value: string) {
  return ['available', 'paid', 'refunded', 'approved', 'won'].includes(value) ? 'success' : ['pending', 'requested', 'processing', 'reserved', 'needs_response', 'under_review'].includes(value) ? 'pending' : ['held', 'rejected', 'failed', 'lost'].includes(value) ? 'attention' : 'neutral';
}
