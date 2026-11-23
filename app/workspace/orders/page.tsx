'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, BarChart3, Info, Mail, RotateCcw, Search, ShoppingBag, Plus } from 'lucide-react';
import CreatorNav from '../CreatorNav';
import { WorkspaceDataLoading } from '../WorkspaceLoading';

type Sale = { id: string; number: string; buyer_email: string; buyer_name: string; status: string; refund_status: string | null; amount_minor: string; paid_amount_minor: string | null; paid_currency: string; platform_fee_minor: string; currency: string; created_at: string; paid_at: string | null; title: string };
type Summary = { sales: number; revenueByCurrency: { currency: string; amountMinor: string; creatorNetMinor: string }[]; pending: number; pendingByCurrency: { currency: string; amountMinor: string }[]; refunded: number; refundedByCurrency: { currency: string; amountMinor: string; count: number }[]; daily: { day: string; currency: string; amountMinor: string }[] };
const formatMoney = (minor: string, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(minor) / 100);
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

export default function CreatorOrdersPage() {
  const [orders, setOrders] = useState<Sale[]>([]); const [summary, setSummary] = useState<Summary>({ sales: 0, revenueByCurrency: [], pending: 0, pendingByCurrency: [], refunded: 0, refundedByCurrency: [], daily: [] });
  const [loading, setLoading] = useState(true); const [loadingMore, setLoadingMore] = useState(false); const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [query, setQuery] = useState(''); const [period, setPeriod] = useState('all'); const [statusFilter, setStatusFilter] = useState('all');
  const [requestId, setRequestId] = useState(''); const [requestReason, setRequestReason] = useState(''); const [busyId, setBusyId] = useState('');
  const [chartCurrency, setChartCurrency] = useState('NGN');

  const load = useCallback(async (offset = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/workspace/orders?offset=${offset}`, { cache: 'no-store' }); const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Sales could not be loaded.');
      setOrders((current) => append ? [...current, ...(data.orders ?? [])] : (data.orders ?? [])); const nextSummary: Summary = data.summary ?? { sales: 0, revenueByCurrency: [], pending: 0, pendingByCurrency: [], refunded: 0, refundedByCurrency: [], daily: [] }; setSummary(nextSummary); setChartCurrency(current => nextSummary.revenueByCurrency.some(item => item.currency === current) ? current : nextSummary.revenueByCurrency[0]?.currency ?? 'NGN'); setHasMore(Boolean(data.hasMore));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sales could not be loaded.'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const cutoff = period === 'all' ? 0 : Date.now() - Number(period) * 86_400_000; const term = query.trim().toLowerCase();
    return orders.filter((order) => (statusFilter === 'all' || order.status.toLowerCase() === statusFilter) && (period === 'all' || new Date(order.created_at).getTime() >= cutoff) && (!term || `${order.number} ${order.title} ${order.buyer_name} ${order.buyer_email}`.toLowerCase().includes(term)));
  }, [orders, period, query, statusFilter]);

  async function submitRefundRequest(orderId: string) {
    setBusyId(orderId); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspace/orders/${encodeURIComponent(orderId)}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: requestReason }) });
      const payload = await response.json().catch(() => ({}));
      if (payload.status && (response.ok || response.status === 409)) setOrders((current) => current.map((item) => item.id === orderId ? { ...item, refund_status: payload.status } : item));
      if (!response.ok) throw new Error(payload.error || payload.message || 'Refund request could not be submitted.');
      setNotice('Refund review request sent to Onselli support.'); setRequestId(''); setRequestReason('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Refund request could not be submitted.'); }
    finally { setBusyId(''); }
  }

  const periods = [['90', 'Last 90 days'], ['30', 'Last 30 days'], ['7', 'Last 7 days'], ['all', 'All time']];
  const chartDays = Array.from({ length: 30 }, (_, index) => { const day = new Date(); day.setUTCHours(0, 0, 0, 0); day.setUTCDate(day.getUTCDate() - (29 - index)); const key = day.toISOString().slice(0, 10); return { day: key, amount: Number(summary.daily.find(item => item.day === key && item.currency === chartCurrency)?.amountMinor ?? 0) / 100 }; });
  const chartMax = Math.max(1, ...chartDays.map(item => item.amount));
  const chartCurrencies = Array.from(new Set([...summary.revenueByCurrency.map(item => item.currency), ...summary.daily.map(item => item.currency)]));
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main"><header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Sales</strong></div></header><section className="creator-dashboard__body studio-overview sales-page">
    <header className="workspace-page-heading sales-page__heading"><div><h1>Sales</h1><p>Orders, revenue, and refunds at a glance.</p></div><a href="/api/workspace/orders/export?days=all" className="sales-page__export"><ArrowDownToLine size={15}/>Export CSV</a></header>
    {loading ? <SalesMetricsLoading/> : <div className="sales-page__stats"><article><div className="sales-stat__label">Gross sales</div>{summary.revenueByCurrency.length ? summary.revenueByCurrency.map(entry => <strong key={entry.currency}>{formatMoney(entry.amountMinor, entry.currency)}</strong>) : <strong>{formatMoney('0', 'NGN')}</strong>}<small>Across {summary.sales.toLocaleString()} paid orders</small></article><article><div className="sales-stat__label">You earn</div>{summary.revenueByCurrency.length ? summary.revenueByCurrency.map(entry => <strong key={entry.currency}>{formatMoney(entry.creatorNetMinor, entry.currency)}</strong>) : <strong>{formatMoney('0', 'NGN')}</strong>}<small>After recorded platform and payment fees</small></article><article><div className="sales-stat__label">Waiting for payment</div><strong>{summary.pending.toLocaleString()}</strong>{summary.pendingByCurrency.length ? summary.pendingByCurrency.map(item => <small key={item.currency}>{formatMoney(item.amountMinor, item.currency)} pending</small>) : <small>No pending order value</small>}</article><article><div className="sales-stat__label">Refunded</div>{summary.refundedByCurrency.length ? summary.refundedByCurrency.map(item => <strong key={item.currency}>{formatMoney(item.amountMinor, item.currency)}</strong>) : <strong>{formatMoney('0', 'NGN')}</strong>}<small>{summary.refunded} refunded {summary.refunded === 1 ? 'order' : 'orders'}</small></article></div>}
    <section className="sales-trend"><div className="sales-trend__heading"><div><h2><BarChart3 size={17}/> Daily sales</h2><p>Paid orders over the last 30 days</p></div><label><span className="sr-only">Chart currency</span><WorkspaceSelect value={chartCurrency} onChange={event => setChartCurrency(event.target.value)}>{chartCurrencies.length ? chartCurrencies.map(code => <option key={code} value={code}>{code}</option>) : <option value="NGN">NGN</option>}</WorkspaceSelect></label></div>{loading ? <WorkspaceDataLoading label="daily sales chart" variant="chart"/> : <><div className="sales-trend__chart" role="img" aria-label={`Daily paid revenue in ${chartCurrency} for the last 30 days`}>{chartDays.map(item => <div className="sales-trend__bar-wrap" key={item.day} title={`${formatDate(item.day)}: ${formatMoney(String(Math.round(item.amount * 100)), chartCurrency)}`}><i style={{ height: `${item.amount / chartMax * 100}%` }}/></div>)}</div><div className="sales-trend__dates"><span>{formatDate(chartDays[0]?.day ?? new Date().toISOString())}</span><span>{formatDate(chartDays[14]?.day ?? new Date().toISOString())}</span><span>{formatDate(chartDays[29]?.day ?? new Date().toISOString())}</span></div></>}</section>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="product-library__notice" role="status">{notice}</p>}
    <section className="sales-page__panel"><div className="sales-page__toolbar"><label className="sales-page__search"><Search size={16}/><input aria-label="Search sales" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, buyer or order"/></label><label><span className="sr-only">Date range</span><WorkspaceSelect value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</WorkspaceSelect></label><label><span className="sr-only">Order status</span><WorkspaceSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="refunded">Refunded</option><option value="needs_review">Needs review</option></WorkspaceSelect></label></div>
      {loading ? <WorkspaceDataLoading label="sales" variant="table"/> : filtered.length ? <><div className="sales-page__table-wrap"><table className="sales-page__table"><thead><tr><th>Order</th><th>Buyer</th><th>Date</th><th>Buyer paid</th><th>Platform fee (base)</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.map((order) => <tr key={order.id}><td><strong>{order.title}</strong><small>#{order.number}</small></td><td><strong>{order.buyer_name || order.buyer_email || 'Guest buyer'}</strong>{order.buyer_email && <small>{order.buyer_email}</small>}</td><td>{formatDate(order.paid_at ?? order.created_at)}</td><td className="sales-page__amount">{formatMoney(order.paid_amount_minor ?? order.amount_minor, order.paid_currency || order.currency)}</td><td>{formatMoney(order.platform_fee_minor, order.currency)}</td><td><span className={`sales-status sales-status--${order.status.toLowerCase()}`}>{order.refund_status ? `Refund ${order.refund_status.replaceAll('_', ' ')}` : order.status.replaceAll('_', ' ').toLowerCase()}</span></td><td><div className="sales-page__actions">{order.buyer_email && <a href={`mailto:${encodeURIComponent(order.buyer_email)}?subject=${encodeURIComponent(`Onselli order ${order.number}`)}`} aria-label={`Email ${order.buyer_name || 'buyer'}`} title="Email buyer"><Mail size={15}/></a>}{order.status === 'PAID' && !order.refund_status && <button type="button" onClick={() => setRequestId(requestId === order.id ? '' : order.id)} aria-label={`Request refund review for order ${order.number}`} title="Request refund review"><RotateCcw size={15}/></button>}</div>{requestId === order.id && <form className="sales-page__refund" onSubmit={(event) => { event.preventDefault(); void submitRefundRequest(order.id); }}><label>Reason for review<textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} minLength={8} maxLength={500} required/></label><div><button type="button" onClick={() => { setRequestId(''); setRequestReason(''); }}>Cancel</button><button type="submit" disabled={requestReason.trim().length < 8 || Boolean(busyId)}>{busyId === order.id ? 'Sending…' : 'Send request'}</button></div><small>This requests a review; it does not automatically issue a refund.</small></form>}</td></tr>)}</tbody></table></div><div className="sales-page__foot"><span>Showing {filtered.length} of {orders.length} loaded orders{hasMore ? ' · more available' : ''}</span>{hasMore && <button type="button" disabled={loadingMore} onClick={() => void load(orders.length, true)}>{loadingMore ? 'Loading…' : 'Load more'}</button>}</div></> : <div className="sales-page__empty"><span><ShoppingBag size={21}/></span><strong>{query || period !== 'all' || statusFilter !== 'all' ? 'No sales match these filters' : 'Sales will appear here'}</strong><p>{query || period !== 'all' || statusFilter !== 'all' ? 'Try a different search or filter.' : 'When a buyer completes checkout, the confirmed order and payment details will show here.'}</p>{!orders.length && <Link href="/workspace/products"><Plus size={15}/> Create a product</Link>}</div>}
    </section>
    <p className="sales-page__privacy"><Info size={14}/> Only completed purchases count toward all-time sales and revenue. Refund requests are reviewed by Onselli support.</p>
  </section></div></main>;
}

function SalesMetricsLoading() {
  const cards = [
    ['Gross sales', 'Across paid orders'],
    ['You earn', 'After platform and payment fees'],
    ['Waiting for payment', 'Pending order value'],
    ['Refunded', 'Refunded orders'],
  ];
  return <div className="sales-page__stats sales-page__stats--loading" role="status" aria-busy="true"><span className="sr-only">Loading sales summary</span>{cards.map(([label, detail]) => <article key={label}><div className="sales-stat__label">{label}</div><strong aria-hidden="true"><i/></strong><small>{detail}</small></article>)}</div>;
}
