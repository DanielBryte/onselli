'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { currencyDecimalToMinor } from '@/lib/money.mjs';

type Balance = { currency: string; available: string; pending: string };
type FinanceData = {
  balance: { accountId: string; balances: Balance[]; fetchedAt: string } | null;
  balanceError: string | null;
  refundCandidates: Array<{ orderId: string; orderNumber: string; amountMinor: string; currency: string; paidAt: string | null; chargeId: string | null; creator: { name: string; slug: string } }>;
  refunds: Array<{ id: string; orderId: string; orderNumber: string; amountMinor: string; currency: string; reason: string; status: string; decisionMessage: string | null; providerRef: string | null; updatedAt: string; creator: { name: string; slug: string }; requesterName: string }>;
  disputes: Array<{ id: string; providerRef: string; orderNumber: string; amountMinor: string; currency: string; status: string; reason: string | null; editable: boolean; dueAt: string | null; updatedAt: string; creator: { name: string; slug: string } }>;
  webhookFailures: Array<{ id: string; provider: string; eventId: string; type: string; status: string; attempts: number; error: string | null; createdAt: string }>;
  staleSales: Array<{ id: string; number: string; currency: string; updatedAt: string }>;
  launchGates: { platformAccount: boolean; providerApiKey: boolean; webhookSecret: boolean; approvedRiskPolicy: boolean; sameCurrencyFees: Array<{ route: string; configured: boolean }> };
};
type Evidence = Record<string, string>;
const evidenceFields = [
  ['customer_name', 'Customer name'], ['customer_email_address', 'Customer email'], ['product_description', 'Product or service provided'], ['service_date', 'Service or delivery date'], ['access_activity_log', 'Access or activity log'], ['billing_address', 'Billing address'], ['refund_policy_disclosure', 'Refund policy shown to customer'], ['refund_refusal_explanation', 'Reason refund was declined'], ['cancellation_policy_disclosure', 'Cancellation policy shown to customer'], ['notes', 'Additional notes'],
] as const;

function money(minor: string | number | bigint, currency: string) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const value = BigInt(minor); const negative = value < 0n; const absolute = negative ? -value : value; const scale = 10n ** BigInt(digits);
  const grouped = (absolute / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % scale).toString().padStart(digits, '0');
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).formatToParts(negative ? -1 : 1).map(part => part.type === 'integer' ? grouped : part.type === 'fraction' ? fraction : part.value).join('');
}
function providerMoney(amount: string, currency: string) {
  try { const minor = currencyDecimalToMinor(amount, currency); return money(minor, currency); }
  catch { return `${amount} ${currency}`; }
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not provided';
}
function human(value: string) { return value.replaceAll('_', ' '); }

export default function FinanceConsole() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'refunds' | 'disputes' | 'balance'>('refunds');
  const [refundOrder, setRefundOrder] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [rejectRefundId, setRejectRefundId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');
  const [reconciledAt, setReconciledAt] = useState('');
  const [selectedDispute, setSelectedDispute] = useState('');
  const [evidence, setEvidence] = useState<Evidence>({});
  const [disputeEditable, setDisputeEditable] = useState(false);
  const [savedFields, setSavedFields] = useState<string[]>([]);
  const [evidenceSavedAt, setEvidenceSavedAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/finance', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load finance operations.');
      setData(payload); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load finance operations.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post(body: unknown) {
    const response = await fetch('/api/admin/finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Finance action could not be completed.');
    return payload;
  }

  async function issueRefund() {
    const candidate = data?.refundCandidates.find((item) => item.orderId === refundOrder);
    if (!candidate || !window.confirm(`Issue a full refund of ${money(candidate.amountMinor, candidate.currency)} for order ${candidate.orderNumber}? This debits Onselli’s Bachs platform balance.`)) return;
    setBusy(candidate.orderId); setError('');
    try { const result = await post({ action: 'create_refund', orderId: candidate.orderId, reason: refundReason }); setRefundOrder(''); setRefundReason(''); await load(); if (result.message) setError(result.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Refund could not be issued.'); }
    finally { setBusy(''); }
  }

  async function approveRefund(item: FinanceData['refunds'][number]) {
    if (!window.confirm(`Approve and issue a full refund of ${money(item.amountMinor, item.currency)} for order ${item.orderNumber}? This debits Onselli’s Bachs platform balance.`)) return;
    setBusy(item.id); setError('');
    try { const result = await post({ action: 'create_refund', refundId: item.id, reason: item.reason }); await load(); if (result.message) setError(result.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Refund could not be issued.'); }
    finally { setBusy(''); }
  }

  async function rejectRefund(item: FinanceData['refunds'][number]) {
    setBusy(item.id); setError('');
    try { await post({ action: 'reject_refund', refundId: item.id, reason: rejectionReason }); setRejectRefundId(''); setRejectionReason(''); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Refund request could not be declined.'); }
    finally { setBusy(''); }
  }

  async function reconcile() {
    setBusy('balance'); setError('');
    try { const result = await post({ action: 'reconcile_balance', note: reconcileNote }); setReconciledAt(result.checkedAt); setReconcileNote(''); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Balance review could not be recorded.'); }
    finally { setBusy(''); }
  }

  async function openDispute(id: string) {
    setBusy(id); setError('');
    try {
      const response = await fetch(`/api/admin/finance/disputes/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load dispute details.');
      setSelectedDispute(id); setEvidence(payload.dispute?.evidence ?? {}); setDisputeEditable(payload.dispute?.is_response_editable === true); setEvidenceSavedAt(''); setSavedFields([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load dispute details.'); }
    finally { setBusy(''); }
  }

  async function disputeAction(action: 'save_evidence' | 'submit_evidence') {
    if (!selectedDispute) return;
    if (action === 'submit_evidence' && !window.confirm('Submit this evidence to Bachs now? Submission is final and locks further edits.')) return;
    setBusy(selectedDispute); setError('');
    try {
      const response = await fetch(`/api/admin/finance/disputes/${encodeURIComponent(selectedDispute)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'save_evidence' ? { action, evidence } : { action, confirm: true }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Dispute action could not be completed.');
      if (action === 'save_evidence') { setSavedFields(payload.fieldNames ?? []); setEvidenceSavedAt(payload.savedAt); }
      else { setSelectedDispute(''); await load(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Dispute action could not be completed.'); }
    finally { setBusy(''); }
  }

  const dispute = data?.disputes.find((item) => item.id === selectedDispute);
  return <main className="admin-finance">
    <header className="admin-finance-top"><span className="admin-finance-brand"><img src="/logo.png" alt="Onselli"/> FINANCE OPERATIONS</span><span><ShieldCheck size={15}/> Two-factor protected</span></header>
    <section className="admin-finance-content admin-ops-content">
      <div className="admin-finance-heading"><div><span>PLATFORM FINANCE</span><h1>Refunds &amp; disputes</h1><p>Manage buyer cases and review Onselli’s Bachs platform balance.</p></div><button className="admin-ops-refresh" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? 'Refreshing' : 'Refresh'}</button></div>
      <aside className="admin-finance-callout"><strong>These cases debit Onselli’s platform account.</strong><p>Destination-charge refunds and disputes do not reverse money already transferred to a creator. Follow the approved recovery policy before issuing refunds or enabling creator withdrawals.</p></aside>
      {data && <section className="admin-ops-warning" aria-label="Payout launch checks"><strong>Withdrawal launch checks</strong><p>Creator withdrawals stay closed when approved policy, provider access, webhook verification, or exact local route fees are missing.</p><ul>{([['Bachs platform account',data.launchGates.platformAccount],['Bachs API key',data.launchGates.providerApiKey],['Webhook signing secret',data.launchGates.webhookSecret],['Approved reserve policy',data.launchGates.approvedRiskPolicy],...data.launchGates.sameCurrencyFees.map(item=>[`${item.route} fee`,item.configured])] as [string,boolean][]).map(([label,ready])=><li key={label}><span>{label}</span><b>{ready?'Configured':'Missing'}</b></li>)}</ul></section>}
      {error && <p className="admin-finance-error" role="alert"><AlertTriangle size={17}/>{error}</p>}
      <nav className="admin-ops-tabs" aria-label="Finance operations">
        {(['refunds', 'disputes', 'balance'] as const).map((item) => <button key={item} type="button" aria-current={tab === item ? 'page' : undefined} onClick={() => { setTab(item); setSelectedDispute(''); }}>{item === 'balance' ? 'Platform balance' : item[0]!.toUpperCase() + item.slice(1)}{item === 'disputes' && data?.disputes.length ? <span>{data.disputes.length}</span> : null}</button>)}
      </nav>
      {data?.webhookFailures?.length ? <section className="admin-ops-warning" aria-labelledby="webhook-failures-title"><strong id="webhook-failures-title">Webhook events need attention ({data.webhookFailures.length})</strong><p>Failed or unprocessed provider events can leave financial states out of sync. Investigate and replay safely from the provider after correcting the cause.</p><div className="admin-ops-records">{data.webhookFailures.map(event=><article className="admin-ops-record" key={event.id}><div><strong>{event.provider} · {event.type}</strong><small>Event {event.eventId} · {event.status} · {event.attempts} attempts · {date(event.createdAt)}</small><small>{event.error || 'Received but not marked processed.'}</small></div></article>)}</div></section> : null}
      {data?.staleSales?.length ? <section className="admin-ops-warning" aria-label="Creator settlement reconciliation"><strong>Creator transfers need reconciliation ({data.staleSales.length})</strong><p>Paid orders with a Bachs transfer still pending locally after 15 minutes. The recurring reconciliation workflow will retry; investigate any that remain.</p>{data.staleSales.map(item=><small key={item.id}>{item.number} · {item.currency} · last updated {date(item.updatedAt)}</small>)}</section> : null}

      {tab === 'refunds' && <div className="admin-ops-panel">
        <div className="admin-ops-section-heading"><div><h2>Refund queue</h2><p>Issue full refunds for eligible Bachs charges and track provider outcomes.</p></div><span>{data?.refunds.length ?? 0} records</span></div>
        {data?.refundCandidates.length ? <div className="admin-ops-form"><label htmlFor="refund-order">Paid order</label><select id="refund-order" value={refundOrder} onChange={(event) => setRefundOrder(event.target.value)}><option value="">Select an order</option>{data.refundCandidates.map((item) => <option key={item.orderId} value={item.orderId}>{item.orderNumber} · {item.creator.name} · {money(item.amountMinor, item.currency)}</option>)}</select><label htmlFor="refund-reason">Reason for refund</label><textarea id="refund-reason" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} minLength={8} maxLength={500} placeholder="Record a clear operational reason"/><button type="button" disabled={!refundOrder || refundReason.trim().length < 8 || Boolean(busy)} onClick={() => void issueRefund()}>{busy === refundOrder ? 'Submitting…' : 'Issue full refund'}<ArrowUpRight size={15}/></button><small>Refunds are full amount only. Confirm the buyer request and applicable policy before issuing.</small></div> : <div className="admin-finance-empty admin-ops-empty"><span><Check size={19}/></span><strong>No eligible paid orders</strong><p>Paid Bachs orders with no active refund will appear here.</p></div>}
        {loading && !data ? <div className="admin-finance-empty">Loading refund records…</div> : data?.refunds.length ? <div className="admin-ops-records">{data.refunds.map((item) => <article className="admin-ops-record" key={item.id}><div><strong>{item.orderNumber} · {item.creator.name}</strong><small>@{item.creator.slug} · Requested by {item.requesterName} · Updated {date(item.updatedAt)}</small><small>Request: {item.reason}</small>{item.decisionMessage && <small>{item.decisionMessage}</small>}</div><b>{money(item.amountMinor, item.currency)}</b><span className={`admin-ops-status status-${item.status}`}>{human(item.status)}</span>{item.status === 'requested' && <div className="admin-ops-refund-actions"><button type="button" disabled={Boolean(busy)} onClick={() => void approveRefund(item)}>{busy === item.id ? 'Submitting…' : 'Approve & issue'}</button>{rejectRefundId === item.id ? <div className="admin-ops-inline-reject"><label htmlFor={`decline-${item.id}`}>Reason for declining</label><textarea id={`decline-${item.id}`} minLength={8} maxLength={500} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)}/><button type="button" disabled={rejectionReason.trim().length < 8 || Boolean(busy)} onClick={() => void rejectRefund(item)}>Confirm decline</button><button type="button" className="is-cancel" onClick={() => setRejectRefundId('')}>Cancel</button></div> : <button type="button" className="is-decline" disabled={Boolean(busy)} onClick={() => { setRejectRefundId(item.id); setRejectionReason(''); }}>Decline request</button>}</div>}</article>)}</div> : <div className="admin-finance-empty admin-ops-empty"><span><Check size={19}/></span><strong>No refund requests</strong><p>Refund requests awaiting review will appear here. Staff can also issue a full refund for a verified support case above.</p></div>}
      </div>}

      {tab === 'disputes' && <div className="admin-ops-panel">
        <div className="admin-ops-section-heading"><div><h2>Disputes</h2><p>Watch response deadlines and prepare evidence while Bachs still accepts it.</p></div><span>{data?.disputes.length ?? 0} cases</span></div>
        {selectedDispute && dispute ? <section className="admin-ops-evidence"><div className="admin-ops-section-heading"><div><h3>{dispute.orderNumber} · {dispute.creator.name}</h3><p>{human(dispute.reason || 'reason not supplied')} · Deadline {date(dispute.dueAt)}</p></div><button type="button" onClick={() => setSelectedDispute('')}>Close</button></div>
          {!disputeEditable && <p className="admin-ops-warning"><Clock3 size={16}/> Bachs has closed evidence submissions for this dispute.</p>}
          <div className="admin-ops-evidence-grid">{evidenceFields.map(([key, label]) => <label key={key}>{label}<textarea disabled={!disputeEditable} value={evidence[key] ?? ''} onChange={(event) => { setEvidence((current) => ({ ...current, [key]: event.target.value })); setSavedFields([]); setEvidenceSavedAt(''); }}/></label>)}</div>
          <div className="admin-ops-form"><strong>Supporting files</strong><p className="admin-ops-help">Upload documents in Bachs, then paste each returned attachment ID. Onselli does not store dispute evidence files.</p>{([['refund_policy_attachment_id','Refund policy'],['cancellation_policy_attachment_id','Cancellation policy'],['customer_communication_attachment_id','Customer communication'],['uncategorized_attachment_id','Other evidence']] as const).map(([key, label]) => <label key={key}>{label} attachment ID<input disabled={!disputeEditable} value={evidence[key] ?? ''} onChange={(event) => { setEvidence((current) => ({ ...current, [key]: event.target.value })); setSavedFields([]); setEvidenceSavedAt(''); }}/></label>)}<div className="admin-ops-evidence-actions"><button type="button" disabled={!disputeEditable || Boolean(busy)} onClick={() => void disputeAction('save_evidence')}>Save evidence draft</button><button type="button" className="is-submit" disabled={!disputeEditable || !savedFields.length || Boolean(busy)} onClick={() => void disputeAction('submit_evidence')}>Submit to Bachs</button></div>{evidenceSavedAt && <small>Saved to Bachs at {date(evidenceSavedAt)} · {savedFields.length} fields. Evidence content is not stored in Onselli.</small>}</div>
        </section> : loading && !data ? <div className="admin-finance-empty">Loading disputes…</div> : data?.disputes.length ? <div className="admin-ops-records">{data.disputes.map((item) => <article className="admin-ops-record" key={item.id}><div><strong>{item.orderNumber} · {item.creator.name}</strong><small>@{item.creator.slug} · {human(item.reason || 'reason not supplied')}</small><small>Response deadline: {date(item.dueAt)}</small></div><b>{money(item.amountMinor, item.currency)}</b><span className={`admin-ops-status status-${item.status}`}>{human(item.status)}</span><button type="button" disabled={Boolean(busy)} onClick={() => void openDispute(item.id)}>{busy === item.id ? 'Loading…' : 'Review'}</button></article>)}</div> : <div className="admin-finance-empty admin-ops-empty"><span><Check size={19}/></span><strong>No open disputes</strong><p>New cases arrive from Bachs dispute webhooks.</p></div>}
      </div>}

      {tab === 'balance' && <div className="admin-ops-panel">
        <div className="admin-ops-section-heading"><div><h2>Bachs platform balance</h2><p>Provider-reported funds for Onselli, separated by currency.</p></div>{data?.balance && <span>Updated {date(data.balance.fetchedAt)}</span>}</div>
        {data?.balance ? <div className="admin-ops-balances">{data.balance.balances.map((item) => <article key={item.currency}><span>{item.currency}</span><div><small>Available</small><strong>{providerMoney(item.available, item.currency)}</strong></div><div><small>Pending</small><strong>{providerMoney(item.pending, item.currency)}</strong></div></article>)}</div> : <div className="admin-ops-warning"><AlertTriangle size={16}/>{data?.balanceError || 'Provider balance has not loaded.'}</div>}
        <div className="admin-ops-reconcile"><h3>Record a balance review</h3><p>This records the current Bachs snapshot and your reconciliation note in the admin audit log. It does not move funds or adjust the local creator ledger.</p><label htmlFor="reconcile-note">Review note</label><textarea id="reconcile-note" value={reconcileNote} onChange={(event) => setReconcileNote(event.target.value)} minLength={8} maxLength={500} placeholder="What did you compare or investigate?"/><button type="button" disabled={reconcileNote.trim().length < 8 || Boolean(busy) || !data?.balance} onClick={() => void reconcile()}>{busy === 'balance' ? 'Recording…' : 'Record balance review'}</button>{reconciledAt && <small>Review recorded {date(reconciledAt)}.</small>}{data?.balanceError && <small className="admin-ops-error-text">{data.balanceError}</small>}</div>
      </div>}
    </section>
  </main>;
}
