'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, CircleHelp, RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import CreatorNav from '../CreatorNav';
import { WorkspaceDataLoading } from '../WorkspaceLoading';

type Totals = { currency: string; gross_revenue: number; refunds: number; net_revenue: number; paid_orders: number; buyers: number };
type Daily = { day: string; currency: string; net_revenue: number; paid_orders: number };
type Product = { product_id: string; title: string; currency: string; net_revenue: number; refunds: number; paid_orders: number; buyers: number };
type Payload = {
  days: number;
  currency_totals: Totals[];
  available_currencies: string[];
  daily: Daily[];
  products: Product[];
  funnel: { product_views: number; checkout_starts: number; paid_orders: number };
  traffic_sources: { source: string; views: number }[];
  total_traffic_views: number;
};
type ChartEntry = { day: string; amount: number };

const periods = [7, 30, 90] as const;
const finiteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function normalizePayload(value: unknown): Payload | null {
  if (!isRecord(value) || !Array.isArray(value.currency_totals) || !Array.isArray(value.daily) || !Array.isArray(value.products) || !isRecord(value.funnel) || !Array.isArray(value.traffic_sources)) return null;
  const currencyTotals = value.currency_totals.filter(isRecord).map((item) => ({
    currency: typeof item.currency === 'string' ? item.currency : 'NGN',
    gross_revenue: finiteNumber(item.gross_revenue), refunds: finiteNumber(item.refunds), net_revenue: finiteNumber(item.net_revenue),
    paid_orders: finiteNumber(item.paid_orders), buyers: finiteNumber(item.buyers),
  }));
  const availableCurrencies = Array.isArray(value.available_currencies) ? value.available_currencies.filter((item): item is string => typeof item === 'string' && /^[A-Z]{3}$/.test(item)) : [];
  const daily = value.daily.filter(isRecord).map((item) => ({
    day: typeof item.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.day) ? item.day : '',
    currency: typeof item.currency === 'string' ? item.currency : 'NGN',
    net_revenue: finiteNumber(item.net_revenue), paid_orders: finiteNumber(item.paid_orders),
  })).filter((item) => item.day);
  const products = value.products.filter(isRecord).map((item) => ({
    product_id: typeof item.product_id === 'string' ? item.product_id : '',
    title: typeof item.title === 'string' ? item.title : 'Untitled offer',
    currency: typeof item.currency === 'string' ? item.currency : 'NGN',
    net_revenue: finiteNumber(item.net_revenue), refunds: finiteNumber(item.refunds),
    paid_orders: finiteNumber(item.paid_orders), buyers: finiteNumber(item.buyers),
  })).filter((item) => item.product_id);
  const trafficSources = value.traffic_sources.filter(isRecord).map((item) => ({ source: typeof item.source === 'string' ? item.source : 'Unattributed', views: finiteNumber(item.views) }));
  return {
    days: periods.includes(value.days as typeof periods[number]) ? value.days as number : 30,
    currency_totals: currencyTotals,
    available_currencies: [...new Set(availableCurrencies)],
    daily,
    products,
    funnel: {
      product_views: finiteNumber(value.funnel.product_views),
      checkout_starts: finiteNumber(value.funnel.checkout_starts),
      paid_orders: finiteNumber(value.funnel.paid_orders),
    },
    traffic_sources: trafficSources,
    total_traffic_views: finiteNumber(value.total_traffic_views),
  };
}

const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
};
const compactMoney = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount); }
  catch { return `${currency} ${Math.round(amount).toLocaleString()}`; }
};
const date = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const dayKey = (value: Date) => value.toISOString().slice(0, 10);

export default function CreatorAnalyticsPage() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loadedFor, setLoadedFor] = useState('');
  const [days, setDays] = useState<number>(30);
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestVersion.current;
    try {
      const response = await fetch(`/api/workspace/analytics?days=${days}&currency=${encodeURIComponent(currency)}`, { cache: 'no-store', signal });
      const result: unknown = await response.json().catch(() => ({}));
      if (signal?.aborted || requestId !== requestVersion.current) return;
      if (response.status === 402 && isRecord(result) && result.code === 'UPGRADE_REQUIRED') window.dispatchEvent(new Event('onselli:open-pricing'));
      if (!response.ok) {
        setError(isRecord(result) && typeof result.error === 'string' ? result.error : 'Analytics could not be loaded.');
        return;
      }
      const normalized = normalizePayload(result);
      if (!normalized) throw new Error('Analytics returned an incomplete response. Please try again.');
      setPayload(normalized);
      setLoadedFor(`${days}:${currency}`);
      setError('');
    } catch (cause) {
      if (!signal?.aborted && requestId === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Analytics could not be loaded. Check your connection and try again.');
    } finally {
      if (!signal?.aborted && requestId === requestVersion.current) setLoading(false);
    }
  }, [days, currency]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const hasPayload = Boolean(payload && loadedFor);
  const [loadedDays, loadedCurrency] = loadedFor ? loadedFor.split(':') : [String(days), currency];
  const displayDays = Number(loadedDays) || days;
  const displayCurrency = loadedCurrency || currency;

  const totals = useMemo(() => payload?.currency_totals.find((item) => item.currency === displayCurrency), [payload, displayCurrency]);
  const chart = useMemo(() => {
    if (!payload) return null;
    const byDay = new Map(payload.daily.filter((item) => item.currency === displayCurrency).map((item) => [item.day, Math.max(0, item.net_revenue)]));
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const entries: ChartEntry[] = Array.from({ length: displayDays }, (_, index) => {
      const dateValue = new Date(today);
      dateValue.setUTCDate(dateValue.getUTCDate() - (displayDays - index - 1));
      const day = dayKey(dateValue);
      return { day, amount: finiteNumber(byDay.get(day)) };
    });
    const max = Math.max(0, ...entries.map((entry) => entry.amount));
    if (max <= 0) return { entries, max, path: '', area: '' };
    const width = 720; const height = 220; const padX = 10; const top = 12; const bottom = 208;
    const coordinates = entries.map((entry, index) => ({
      x: padX + (index / Math.max(1, entries.length - 1)) * (width - padX * 2),
      y: bottom - (entry.amount / max) * (bottom - top),
    }));
    const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ');
    const area = `${path} L ${coordinates[coordinates.length - 1]?.x ?? width - padX},${bottom} L ${padX},${bottom} Z`;
    return { entries, max, path, area };
  }, [payload, displayCurrency, displayDays]);

  const topOffers = useMemo(() => [...(payload?.products ?? [])]
    .filter((item) => item.currency === displayCurrency)
    .sort((a, b) => b.net_revenue - a.net_revenue || b.paid_orders - a.paid_orders || a.title.localeCompare(b.title))
    .slice(0, 5), [payload, displayCurrency]);
  const currentTotals = totals;
  const funnel = payload?.funnel;
  const hasPaidRevenue = Boolean(chart?.max);
  const periodLabel = `${displayDays} days`;
  const currencyOptions = [...new Set(['NGN', 'USD', ...(payload?.available_currencies ?? [])])];

  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main">
    <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Analytics</strong></div></header>
    <section className="creator-dashboard__body studio-overview analytics-page">
      <div className="analytics-toolbar">
        <div className="analytics-toolbar__intro"><h1 className="page-title">Analytics</h1><p>Track revenue, orders, and customer activity over time.</p></div>
        <div className="analytics-filters">
          <div className="analytics-period" role="group" aria-label="Analytics date range">
            {periods.map((value) => <button type="button" key={value} aria-pressed={days === value} className={days === value ? 'is-active' : ''} onClick={() => setDays(value)}>{value} days</button>)}
          </div>
          <div className="analytics-currency"><WorkspaceSelect value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Revenue currency">
            {currencyOptions.map((code) => <option key={code} value={code}>{code}</option>)}
          </WorkspaceSelect></div>
        </div>
      </div>

      {error && hasPayload && <div className="creator-dashboard-error analytics-error" role="alert"><span>{error} Showing the last successfully loaded data for {displayDays} days · {displayCurrency}.</span><button type="button" onClick={() => { setLoading(true); void refresh(); }}><RefreshCw size={14}/> Try again</button></div>}
      {!hasPayload && loading && <AnalyticsInitialSkeleton/>}
      {!hasPayload && !loading && error && <div className="analytics-state analytics-state--error" role="alert"><BarChart3 size={22}/><strong>Analytics are temporarily unavailable</strong><p>{error}</p><button type="button" className="button button--outline" onClick={() => { setLoading(true); void refresh(); }}>Try again</button></div>}

      {hasPayload && payload && <>
        <section className="analytics-summary" aria-label={`${periodLabel} revenue summary`} aria-busy={loading}>
          <div className="analytics-summary__top"><div><span className="analytics-eyebrow">Sales summary</span><p>Orders created in the last {displayDays} days · {displayCurrency}</p></div>{loading && <span className="analytics-updating" role="status">Updating to {days} days · {currency}…</span>}</div>
          <div className="insight-kpis">
            <article className="insight-kpi insight-kpi--revenue"><span>Net revenue</span><strong>{money(currentTotals?.net_revenue ?? 0, displayCurrency)}</strong><small>After confirmed refunds</small></article>
            <article className="insight-kpi"><span>Paid orders</span><strong>{(currentTotals?.paid_orders ?? 0).toLocaleString()}</strong><small>Confirmed payments</small></article>
            <article className="insight-kpi"><span>Buyers</span><strong>{(currentTotals?.buyers ?? 0).toLocaleString()}</strong><small>Customers with a paid order</small></article>
            <article className="insight-kpi"><span>Refunds</span><strong>{money(currentTotals?.refunds ?? 0, displayCurrency)}</strong><small>Fully refunded orders</small></article>
          </div>
          <div className="analytics-trend" aria-labelledby="analytics-revenue-heading">
          <div className="analytics-panel__heading"><div><h2 id="analytics-revenue-heading"><TrendingUp size={17}/> Net revenue trend</h2><p>Orders created each day · {displayCurrency} · last {displayDays} days</p></div><span className="trend-legend"><i/> Net revenue</span></div>
          {hasPaidRevenue && chart ? <div className="revenue-chart" aria-busy={loading}>
            <div className="revenue-chart__scale" aria-hidden="true"><span>{compactMoney(chart.max, displayCurrency)}</span><span>{compactMoney(chart.max / 2, displayCurrency)}</span><span>{money(0, displayCurrency)}</span></div>
            <svg viewBox="0 0 720 220" role="img" aria-label={`${displayCurrency} net revenue by order creation day, for the last ${displayDays} days`} preserveAspectRatio="none">
              <line x1="10" y1="12" x2="710" y2="12" className="chart-axis"/><line x1="10" y1="110" x2="710" y2="110" className="chart-axis"/><line x1="10" y1="208" x2="710" y2="208" className="chart-axis"/>
              <path d={chart.area} className="chart-area"/><path d={chart.path} className="chart-line"/>
            </svg>
            <div className="chart-range"><span>{date(chart.entries[0]?.day ?? '')}</span><span>{date(chart.entries[Math.floor(chart.entries.length / 2)]?.day ?? '')}</span><span>{date(chart.entries[chart.entries.length - 1]?.day ?? '')}</span></div>
            <ul className="sr-only">{chart.entries.map((entry) => <li key={entry.day}>{date(entry.day)}: {money(entry.amount, displayCurrency)}</li>)}</ul>
          </div> : <div className="analytics-state analytics-state--compact"><BarChart3 size={20}/><strong>No paid revenue in this period</strong><p>Your revenue trend will appear after a confirmed payment.</p></div>}
          </div>
        </section>

        <section className="analytics-panel analytics-funnel" aria-labelledby="analytics-activity-heading">
          <div className="analytics-panel__heading"><div><h2 id="analytics-activity-heading">Buyer journey activity</h2><p>Activity recorded in the last {displayDays} days.</p></div><span className="analytics-funnel__currency-note">All currencies</span></div>
          <div className="analytics-funnel__steps">
            {[
              { label: 'Product views', value: funnel?.product_views ?? 0, detail: 'Recorded product page views', kind: 'views' },
              { label: 'Checkout starts', value: funnel?.checkout_starts ?? 0, detail: 'Recorded checkout attempts', kind: 'event' },
              { label: 'Paid orders', value: funnel?.paid_orders ?? 0, detail: 'Confirmed orders · all currencies', kind: 'order' },
            ].map((item, index) => <article className="analytics-funnel__step" key={item.label}>
              <span className="analytics-funnel__number">0{index + 1}</span><span><small>{item.label}</small><strong>{item.value.toLocaleString()}</strong><em>{item.kind === 'views' && item.value === 0 ? 'View tracking isn’t connected yet' : item.value === 0 ? `No ${item.label.toLowerCase()} in this period` : item.detail}</em></span>
            </article>)}
          </div>
        </section>

        <section className="analytics-bottom-grid" aria-label="Offer performance and traffic sources">
          <article className="analytics-panel product-performance"><div className="analytics-panel__heading"><div><h2>Top offers</h2><p>By net revenue in {displayCurrency} · last {displayDays} days</p></div><span className="performance-info"><CircleHelp size={14}/> Confirmed payments</span></div>
            {topOffers.length ? <div className="performance-table-wrap"><table className="performance-table"><caption className="sr-only">Top offers by net revenue in {displayCurrency} for the last {displayDays} days</caption><thead><tr><th scope="col">Offer</th><th scope="col">Net revenue</th><th scope="col">Paid orders</th></tr></thead><tbody>{topOffers.map((item) => <tr key={`${item.product_id}-${item.currency}`}><th scope="row" className="performance-title">{item.title}<small>{item.currency}</small></th><td className="performance-emphasis">{money(item.net_revenue, item.currency)}</td><td>{item.paid_orders.toLocaleString()}</td></tr>)}</tbody></table></div> : <div className="analytics-state analytics-state--compact"><BarChart3 size={20}/><strong>No offer sales in this period</strong><p>Offers with confirmed sales will appear here.</p></div>}
          </article>
          <article className="analytics-panel analytics-sources"><div className="analytics-panel__heading"><div><h2>Traffic sources</h2><p>Recorded product views · all currencies</p></div></div>
            {payload.traffic_sources.length ? <><div className="analytics-sources__total">{payload.total_traffic_views.toLocaleString()} recorded product views</div>{payload.traffic_sources.map((item) => {
              const share = payload.total_traffic_views > 0 ? Math.min(100, item.views / payload.total_traffic_views * 100) : 0;
              return <div className="analytics-source-row" key={item.source}><div><span>{item.source === 'Unattributed' ? 'Unattributed' : item.source}</span><small>{item.views.toLocaleString()} views · {Math.round(share)}%</small></div><span className="analytics-source-track" role="img" aria-label={`${Math.round(share)} percent of recorded product views`}><i style={{ width: `${share}%` }}/></span></div>;
            })}<p className="analytics-sources__note">Top sources for recorded product views.</p></> : <div className="analytics-state analytics-state--compact"><BarChart3 size={20}/><strong>No traffic sources yet</strong><p>Sources will appear once product views are recorded.</p></div>}
          </article>
        </section>
      </>}
    </section>
  </div></main>;
}

function AnalyticsInitialSkeleton() {
  return <div className="analytics-initial" aria-busy="true">
    <span className="sr-only" role="status">Loading analytics data</span>
    <section className="analytics-summary" aria-label="Sales summary loading"><div className="analytics-summary__top"><div><span className="analytics-eyebrow">Sales summary</span><p>Waiting for recorded orders</p></div></div><WorkspaceDataLoading label="sales summary" variant="metrics"/><div className="analytics-panel__heading"><div><h2><TrendingUp size={17}/> Net revenue trend</h2><p>Daily totals will appear when the analytics request completes.</p></div></div><WorkspaceDataLoading label="revenue trend" variant="chart"/></section>
    <section className="analytics-panel"><div className="analytics-panel__heading"><div><h2>Buyer journey activity</h2><p>Recorded product and checkout events.</p></div></div><WorkspaceDataLoading label="buyer journey" variant="metrics"/></section>
    <div className="analytics-bottom-grid"><section className="analytics-panel"><div className="analytics-panel__heading"><h2>Top products</h2></div><WorkspaceDataLoading label="top products" variant="table"/></section><section className="analytics-panel"><div className="analytics-panel__heading"><h2>Traffic sources</h2></div><WorkspaceDataLoading label="traffic sources" variant="table"/></section></div>
  </div>;
}
