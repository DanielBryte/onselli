'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CircleHelp, TrendingUp } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import CreatorNav from '../CreatorNav';

type Totals = { currency: string; gross_revenue: number; refunds: number; net_revenue: number; paid_orders: number; buyers: number };
type Daily = { day: string; currency: string; net_revenue: number; paid_orders: number };
type Product = { product_id: string; title: string; currency: string; net_revenue: number; refunds: number; paid_orders: number; buyers: number; page_views: number; checkout_starts: number };
type Payload = { days: number; currency_totals: Totals[]; daily: Daily[]; products: Product[] };
const money = (amount: number, currency: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch { return `${currency} ${amount.toLocaleString()}`; } };
const date = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`));

export default function CreatorAnalyticsPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatorId, setCreatorId] = useState('');

  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    if (!creatorId) return;
    const { data, error: rpcError } = await supabase.rpc('get_creator_analytics', { creator_id_input: creatorId, days_input: days, currency_input: currency || null });
    if (rpcError) setError(rpcError.message); else { setPayload(data as Payload); setError(''); }
    setLoading(false);
  }, [creatorId, days, currency]);
  useEffect(() => { let active = true; void (async () => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { window.location.assign('/login'); return; }
    const { data: creator, error: creatorError } = await supabase.from('creators').select('id').eq('user_id', auth.user.id).maybeSingle();
    if (!active) return;
    if (creatorError || !creator) { setError(creatorError?.message || 'Creator profile not found.'); setLoading(false); return; }
    setCreatorId(creator.id);
  })(); return () => { active = false; }; }, []);
  useEffect(() => { if (!creatorId) return; setLoading(true); void refresh(); }, [refresh, creatorId]);

  const selectedTotals = useMemo(() => currency ? payload?.currency_totals.find(item => item.currency === currency) : null, [payload, currency]);
  const selectedDaily = useMemo(() => currency ? (payload?.daily ?? []).filter(item => item.currency === currency) : [], [payload, currency]);
  const chart = useMemo(() => {
    if (!selectedDaily.length) return null;
    const entries = Array.from({ length: days }, (_, index) => {
      const dateValue = new Date(); dateValue.setUTCHours(0, 0, 0, 0); dateValue.setUTCDate(dateValue.getUTCDate() - (days - index - 1));
      const key = dateValue.toISOString().slice(0, 10);
      return { day: key, amount: Number(selectedDaily.find(item => item.day === key)?.net_revenue ?? 0) };
    });
    const max = Math.max(1, ...entries.map(entry => entry.amount));
    const width = 720; const height = 220; const pad = 12;
    const points = entries.map((entry, index) => `${pad + (index / Math.max(1, entries.length - 1)) * (width - pad * 2)},${height - pad - (entry.amount / max) * (height - pad * 2)}`).join(' ');
    return { entries, points, width, height };
  }, [selectedDaily, days]);

  const totals = selectedTotals;
  return <main className="page-shell"><div className="page-content creator-workspace">
    <CreatorNav />
    <section className="creator-workspace__content">
      <div className="insight-header"><div><span className="section-kicker">Your business</span><h1 className="page-title">Analytics</h1><p className="page-subtitle">See what is selling and where buyers drop off, using provider-confirmed payments.</p></div><div className="analytics-filters"><label><span>Period</span><select value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><label><span>Currency</span><select value={currency} onChange={event => setCurrency(event.target.value)}><option value="">All currencies</option>{(payload?.currency_totals ?? []).map(item => <option key={item.currency} value={item.currency}>{item.currency}</option>)}</select></label></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && !payload ? <p className="insight-loading">Loading your analytics…</p> : payload && <>
        <div className="insight-kpis">
          <article className="insight-kpi"><span>Net revenue</span><strong>{totals ? money(Number(totals.net_revenue), currency) : currency ? money(0, currency) : '—'}</strong><small>{currency ? 'After confirmed refunds' : 'Choose a currency to see one total'}</small></article>
          <article className="insight-kpi"><span>Paid orders</span><strong>{totals ? Number(totals.paid_orders).toLocaleString() : currency ? '0' : '—'}</strong><small>Confirmed by Bachs</small></article>
          <article className="insight-kpi"><span>Buyers</span><strong>{totals ? Number(totals.buyers).toLocaleString() : currency ? '0' : '—'}</strong><small>Unique buyers in this period</small></article>
          <article className="insight-kpi"><span>Refunds</span><strong>{totals ? money(Number(totals.refunds), currency) : currency ? money(0, currency) : '—'}</strong><small>Confirmed refund amount</small></article>
        </div>
        {!currency && payload.currency_totals.length > 0 && <div className="currency-breakdown"><div><strong>Revenue by currency</strong><span>Each currency is kept separate to avoid misleading totals.</span></div><div className="currency-breakdown__items">{payload.currency_totals.map(item => <button key={item.currency} onClick={() => setCurrency(item.currency)}><span>{item.currency}</span><strong>{money(Number(item.net_revenue), item.currency)}</strong><small>{Number(item.paid_orders)} paid orders</small></button>)}</div></div>}
        <article className="analytics-panel"><div className="analytics-panel__heading"><div><h2><TrendingUp size={18}/> Revenue trend</h2><p>{currency ? `Net revenue in ${currency} · last ${days} days` : 'Choose a currency to view its revenue trend.'}</p></div>{currency && <span className="trend-legend"><i/> Net revenue</span>}</div>
          {currency && chart ? <div className="revenue-chart"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`${currency} net revenue over the last ${days} days`} preserveAspectRatio="none"><line x1="12" y1="208" x2="708" y2="208" className="chart-axis"/><polyline points={chart.points} className="chart-line"/><polygon points={`12,208 ${chart.points} 708,208`} className="chart-area"/></svg><div className="chart-range"><span>{date(chart.entries[0]?.day ?? new Date().toISOString().slice(0, 10))}</span><span>{date(chart.entries[Math.floor(chart.entries.length / 2)]?.day ?? new Date().toISOString().slice(0, 10))}</span><span>{date(chart.entries[chart.entries.length - 1]?.day ?? new Date().toISOString().slice(0, 10))}</span></div></div> : <div className="chart-empty"><BarChart3 size={20}/><span>{currency ? 'No paid sales in this period yet.' : 'Select a currency above to see a meaningful trend.'}</span></div>}
        </article>
        <article className="analytics-panel product-performance"><div className="analytics-panel__heading"><div><h2><BarChart3 size={18}/> Offer performance</h2><p>Purchases come from confirmed payments. Page views and checkout starts are directional.</p></div><span className="performance-info"><CircleHelp size={15}/> {days} days</span></div>
          {(payload.products ?? []).length ? <div className="performance-table-wrap"><table className="performance-table"><thead><tr><th>Offer</th><th>Currency</th><th>Net revenue</th><th>Orders</th><th>Buyers</th><th>Page views</th><th>Checkout starts</th><th>Checkout rate</th></tr></thead><tbody>{payload.products.map(item => <tr key={`${item.product_id}-${item.currency}`}><td className="performance-title">{item.title}</td><td>{item.currency}</td><td className="performance-emphasis">{money(Number(item.net_revenue), item.currency)}</td><td>{Number(item.paid_orders)}</td><td>{Number(item.buyers)}</td><td>{Number(item.page_views).toLocaleString()}</td><td>{Number(item.checkout_starts).toLocaleString()}</td><td>{Number(item.page_views) ? `${Math.min(100, Number(item.checkout_starts) / Number(item.page_views) * 100).toFixed(1)}%` : '—'}</td></tr>)}</tbody></table></div> : <div className="chart-empty">Confirmed offer sales will appear here.</div>}
        </article>
        <p className="analytics-footnote">Revenue reflects completed Bachs payments and subtracts confirmed refunds. Platform and processing fees are not deducted from the revenue figures. Activity counts are approximate and may include repeat visits.</p>
      </>}
    </section>
  </div></main>;
}
