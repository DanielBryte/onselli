'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartNoAxesColumnIncreasing, CircleHelp, Package, Plus } from 'lucide-react';
import CreatorNav from './CreatorNav';
import { useCreatorWorkspaceIdentity } from './CreatorWorkspaceIdentity';
import { WorkspaceTopbar } from './WorkspaceTopbar';

type Overview = {
  creator: { id: string; name: string; slug: string; headline: string | null; userName: string };
  currency: 'NGN' | 'USD';
  offers: { id: string; title: string; type: string; status: string; priceMinor: string; createdAt: string }[];
  daily: { day: string; orderCount: number; revenueMinor: string }[];
  topProducts: { productId: string | null; title: string; type: string | null; status: string | null; currency: string; units: number; orders: number; views: number; revenueMinor: string }[];
  traffic: { productViews: number; checkoutStarts: number; sources: { source: string; views: number }[] };
  metrics: { days: number; allTimeOrders: number; totalOrders: number; previousOrders: number; salesMinor: string; previousSalesMinor: string; averageOrderValueMinor: string; availableToWithdrawMinor: string; pendingPayoutMinor: string; payoutMethodReady: boolean };
  hasActivity: boolean;
};

const money = (minor: string | number, currency = 'NGN') => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(minor) / 100);
const compactMoney = (minor: number, currency: string) => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-NG', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(minor / 100);
const dateLabel = (value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en-NG', options).format(new Date(value));

function changeLabel(current: number, previous: number, format: (value: number) => string) {
  const difference = current - previous;
  if (previous === 0) return difference > 0 ? `+${format(difference)} vs previous period` : 'No change vs previous period';
  const percentage = Math.round((difference / previous) * 1000) / 10;
  return `${difference >= 0 ? '+' : ''}${percentage.toFixed(1)}% vs previous period`;
}

function percentChangeLabel(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 'New' : '0.0%';
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
}

export default function StudioPage() {
  const identity = useCreatorWorkspaceIdentity();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [days, setDays] = useState(30);
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const visibleDays = data?.metrics.days ?? days;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void (async () => {
      let attempt = 0;
      while (active && !controller.signal.aborted) {
        try {
          const query = new URLSearchParams({ days: String(days), currency });
          const response = await fetch(`/api/workspace/overview?${query.toString()}`, { cache: 'no-store', signal: controller.signal });
          const result = await response.json().catch(() => ({}));
          if (!active || controller.signal.aborted) return;
          if (response.status === 401) { router.replace('/login?next=%2Fworkspace'); return; }
          if (response.status === 403 && result.error?.includes('onboarding')) { router.replace('/onboarding'); return; }
          if (response.status === 403 && result.error?.includes('creator setup')) { router.replace('/workspace/setup'); return; }
          if (!response.ok) {
            if ([502, 503, 504].includes(response.status) && attempt === 0) {
              attempt += 1;
              await new Promise((resolve) => window.setTimeout(resolve, 650));
              continue;
            }
            throw new Error(result.requestId ? `${result.error || 'Your workspace could not load.'} Reference: ${result.requestId}` : result.error || 'Your workspace could not load.');
          }
          setData(result as Overview);
          setError('');
          setLoading(false);
          return;
        } catch (cause) {
          if (!active || controller.signal.aborted) return;
          if (attempt === 0 && cause instanceof TypeError) {
            attempt += 1;
            await new Promise((resolve) => window.setTimeout(resolve, 650));
            continue;
          }
          setError(cause instanceof Error ? cause.message : 'Your workspace could not load.');
          setLoading(false);
          return;
        }
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [days, currency, retryKey, router]);

  const chartEntries = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const rows = new Map((data?.daily ?? []).map((row) => [row.day, row]));
    return Array.from({ length: visibleDays }, (_, index) => {
      const day = new Date(today);
      day.setUTCDate(today.getUTCDate() - (visibleDays - index - 1));
      const key = day.toISOString().slice(0, 10);
      const row = rows.get(key);
      return { day: key, orders: row?.orderCount ?? 0, revenue: Number(row?.revenueMinor ?? 0) / 100 };
    });
  }, [data?.daily, visibleDays]);

  const hasChartSales = chartEntries.some((item) => item.orders > 0 || item.revenue > 0);
  const visibleProducts = data?.topProducts ?? [];
  const chartPaths = useMemo(() => {
    const width = 760;
    const height = 230;
    const xPad = 12;
    const yPad = 16;
    const pointsFor = (values: number[], maxValue: number) => values.map((value, index) => {
      const x = xPad + (values.length === 1 ? 0.5 : index / (values.length - 1)) * (width - xPad * 2);
      const y = height - yPad - (value / maxValue) * (height - yPad * 2);
      return { x, y };
    });
    const curve = (points: { x: number; y: number }[]) => points.slice(0, -1).map((point, index) => {
      const previous = points[Math.max(0, index - 1)]!;
      const next = points[index + 1]!;
      const after = points[Math.min(points.length - 1, index + 2)]!;
      const controlOne = { x: point.x + (next.x - previous.x) / 6, y: point.y + (next.y - previous.y) / 6 };
      const controlTwo = { x: next.x - (after.x - point.x) / 6, y: next.y - (after.y - point.y) / 6 };
      return ` C ${controlOne.x},${controlOne.y} ${controlTwo.x},${controlTwo.y} ${next.x},${next.y}`;
    }).join('');
    const orderMax = Math.max(1, ...chartEntries.map((item) => item.orders));
    const revenueMax = Math.max(1, ...chartEntries.map((item) => item.revenue));
    const barWidth = Math.min(18, ((width - xPad * 2) / Math.max(1, chartEntries.length)) * 0.42);
    const orderBars = chartEntries.map((entry, index) => {
      const x = xPad + (chartEntries.length === 1 ? 0.5 : index / (chartEntries.length - 1)) * (width - xPad * 2) - barWidth / 2;
      const barHeight = (entry.orders / orderMax) * (height - yPad * 2);
      return { day: entry.day, x, y: height - yPad - barHeight, width: barWidth, height: barHeight };
    });
    const revenuePoints = pointsFor(chartEntries.map((item) => item.revenue), revenueMax);
    const baseline = height - yPad;
    const firstPoint = revenuePoints[0] ?? { x: xPad, y: baseline };
    const lastPoint = revenuePoints[revenuePoints.length - 1] ?? firstPoint;
    const revenue = `M ${firstPoint.x},${firstPoint.y}${curve(revenuePoints)}`;
    const area = `M ${firstPoint.x},${baseline} L ${firstPoint.x},${firstPoint.y}${curve(revenuePoints)} L ${lastPoint.x},${baseline} Z`;
    return {
      width, height, revenueMax, orderMax,
      orderBars,
      revenue,
      area,
    };
  }, [chartEntries]);

  const displayName = identity.workspaceSlug.trim();
  const orderChange = data ? changeLabel(data.metrics.totalOrders, data.metrics.previousOrders, (value) => value.toLocaleString()) : '';
  const salesChange = data ? changeLabel(Number(data.metrics.salesMinor), Number(data.metrics.previousSalesMinor), (value) => money(value, currency)) : '';
  const chartSalesChange = data ? percentChangeLabel(Number(data.metrics.salesMinor), Number(data.metrics.previousSalesMinor)) : '';
  const emptyChartCta = data?.metrics.allTimeOrders
    ? { href: '/workspace/orders', label: 'View all orders', external: false }
    : data?.offers.some((offer) => offer.status === 'published')
      ? { href: `/c/${data.creator.slug}`, label: 'View storefront', external: true }
      : { href: '/workspace/products', label: 'Create an offer', external: false };

  return <main className="creator-dashboard creator-dashboard--reference"><CreatorNav/><div className="creator-dashboard__main">
    <WorkspaceTopbar><div className="creator-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Overview</strong></div></WorkspaceTopbar>
    <div className="creator-dashboard__body studio-overview studio-overview--reference">
      <section className="studio-reference-heading"><div><h1>{displayName ? `Hi ${displayName},` : 'Your overview'}</h1><p>{data && !data.hasActivity ? 'Your business, at a glance.' : 'Here’s how your business is performing today'}</p></div><CurrencySwitch currency={currency} setCurrency={setCurrency}/>
      </section>
      {data && loading && <p className="studio-refresh-loading" role="status">Updating overview…</p>}
      {data && error && <p className="studio-refresh-error" role="status">Couldn’t refresh this view. Showing the last loaded data. {error}</p>}
      {!data ? <DashboardContentSkeleton days={days} setDays={setDays} error={error} onRetry={() => setRetryKey((key) => key + 1)}/> : <>
        {!data.hasActivity && <section className="studio-first-product-cta" aria-labelledby="studio-first-product-title"><span className="studio-first-product-cta__icon"><Package size={22}/></span><div><h2 id="studio-first-product-title">Add your first product</h2><p>Set up a course, download, bundle, or payment link.</p></div><Link href="/workspace/products" className="creator-primary-action"><Plus size={16}/> Add product <ArrowRight size={15}/></Link></section>}
        <section className="studio-reference-kpis" aria-label="Business summary">
          <MetricCard title={`Revenue · ${currency}`} value={money(data.metrics.salesMinor, currency)} detail={Number(data.metrics.salesMinor) ? salesChange : 'No paid revenue in this period'} trend={salesChange.startsWith('+')} negative={salesChange.startsWith('-')}/>
          <MetricCard title="Total orders" value={data.metrics.totalOrders.toLocaleString()} detail={data.metrics.totalOrders ? orderChange : 'No orders in this period'} trend={orderChange.startsWith('+')} negative={orderChange.startsWith('-')}/>
          <MetricCard title="Available balance" value={money(data.metrics.availableToWithdrawMinor, currency)} detail={data.metrics.payoutMethodReady ? 'Ready to withdraw' : 'Set up payouts to withdraw'} action={<Link href="/workspace/earnings">View wallet <ArrowRight size={13}/></Link>}/>
          <MetricCard title="Pending payout" value={money(data.metrics.pendingPayoutMinor, currency)} detail={Number(data.metrics.pendingPayoutMinor) ? 'Reserved for an in-progress payout' : 'No payout in progress'}/>
        </section>
        <article className="studio-reference-panel studio-reference-sales studio-reference-sales--dashboard"><div className="studio-reference-panel__heading"><div><h2>Sales overview</h2><p>A little more momentum, every day.</p></div><div className="studio-reference-range-switch" role="group" aria-label="Sales chart date range">{([{days:90,label:'90 days'},{days:30,label:'30 days'},{days:7,label:'7 days'}] as const).map((range) => <button key={range.days} type="button" aria-pressed={days === range.days} className={days === range.days ? 'is-selected' : ''} onClick={() => setDays(range.days)}>{range.label}</button>)}</div></div>
          <div className="studio-reference-chart-summary"><strong>{money(data.metrics.salesMinor, currency)}</strong><span className={`studio-reference-change ${Number(data.metrics.salesMinor) > Number(data.metrics.previousSalesMinor) ? 'is-positive' : Number(data.metrics.salesMinor) < Number(data.metrics.previousSalesMinor) ? 'is-negative' : ''}`}>{Number(data.metrics.salesMinor) >= Number(data.metrics.previousSalesMinor) ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {chartSalesChange}</span><div className="studio-reference-legend"><span><i className="is-revenue"/>Revenue</span><span><i className="is-orders"/>Orders</span></div></div>
          {hasChartSales ? <div className="studio-reference-chart"><div className="studio-reference-chart__grid"><span/><span/><span/><span/></div><div className="studio-reference-chart__axis studio-reference-chart__axis--left"><span>{compactMoney(chartPaths.revenueMax * 100, currency)}</span><span>{compactMoney(chartPaths.revenueMax * 50, currency)}</span><span>{compactMoney(0, currency)}</span></div><div className="studio-reference-chart__axis studio-reference-chart__axis--right"><span>{chartPaths.orderMax}</span><span>{chartPaths.orderMax > 2 ? Math.round(chartPaths.orderMax / 2) : ''}</span><span>0</span></div><svg viewBox={`0 0 ${chartPaths.width} ${chartPaths.height}`} role="img" aria-label={`Revenue and orders over ${days === 1 ? 'today' : `the last ${visibleDays} days`}`} preserveAspectRatio="none"><path d={chartPaths.area} className="studio-reference-chart__area"/>{chartPaths.orderBars.map((bar) => <rect key={bar.day} x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={4} className="studio-reference-chart__bar"/>)}<path d={chartPaths.revenue} className="studio-reference-chart__line studio-reference-chart__line--revenue"/></svg><div className="studio-reference-chart__dates">{days === 1 ? <span>{dateLabel(chartEntries[0]?.day ?? '', { month: 'short', day: 'numeric' })}</span> : <><span>{dateLabel(chartEntries[0]?.day ?? '', { month: 'short', day: 'numeric' })}</span><span>{dateLabel(chartEntries[Math.floor(chartEntries.length / 2)]?.day ?? '', { month: 'short', day: 'numeric' })}</span><span>{dateLabel(chartEntries[chartEntries.length - 1]?.day ?? '', { month: 'short', day: 'numeric' })}</span></>}</div></div> : <div className="studio-reference-chart-empty"><span className="studio-reference-chart-empty__icon"><ChartNoAxesColumnIncreasing size={19}/></span><strong>{Number(data.metrics.allTimeOrders) ? 'No sales in this period' : 'Your sales chart starts here'}</strong><span>{Number(data.metrics.allTimeOrders) ? 'Try a longer date range to include earlier sales.' : 'Create and share an offer to start tracking paid revenue and orders.'}</span><Link href={emptyChartCta.href} className="studio-empty-cta" target={emptyChartCta.external ? '_blank' : undefined} rel={emptyChartCta.external ? 'noreferrer' : undefined}>{emptyChartCta.label}<ArrowRight size={14}/></Link></div>}
        </article>
        <section className="studio-reference-secondary-grid studio-reference-secondary-grid--single">
          <article className="studio-reference-panel studio-reference-products"><div className="studio-reference-panel__heading"><div><h2>Top products</h2><p>Products driving paid orders in the selected period.</p></div><div className="studio-reference-panel__actions"><Link href="/workspace/products">View all products <ArrowRight size={14}/></Link></div></div>
            {visibleProducts.length ? <div className="studio-reference-table-wrap"><table className="studio-reference-table studio-reference-table--products"><thead><tr><th>Product</th><th>Orders</th><th>Views</th><th>Revenue</th><th>Status</th></tr></thead><tbody>{visibleProducts.map((product, index) => <tr key={`${product.productId ?? product.title}-${index}`}><td><span className="studio-product-cell"><span>{product.title.slice(0, 1).toUpperCase()}</span><span><strong>{product.title}</strong><small>{product.type ?? 'Offer'}</small></span></span></td><td>{product.orders.toLocaleString()}</td><td>{product.views.toLocaleString()}</td><td>{money(product.revenueMinor, currency)}</td><td><span className={`studio-product-status studio-product-status--${product.status ?? 'archived'}`}>{product.status === 'published' ? 'Active' : product.status === 'draft' ? 'Draft' : product.status === 'archived' ? 'Archived' : 'Unavailable'}</span></td></tr>)}</tbody></table></div> : <EmptyPanel icon={<Package size={19}/>} title="No paid orders in this period" text="Products will appear here after a customer completes a purchase." link="/workspace/products" linkLabel="View products"/>}
          </article>
        </section>
        <section className="studio-reference-panel studio-traffic-panel"><div className="studio-reference-panel__heading"><div><h2>How people find you</h2><p>Where recorded product views came from · {days === 1 ? 'today' : `last ${visibleDays} days`}</p></div><strong className="studio-traffic-total">{data.traffic.productViews.toLocaleString()} <span>product views</span></strong></div>{data.traffic.sources.length ? <div className="studio-traffic-list">{data.traffic.sources.map((source) => { const share = data.traffic.productViews ? Math.round(source.views / data.traffic.productViews * 100) : 0; return <div className="studio-traffic-row" key={source.source}><span className="studio-traffic-source">{source.source}</span><span className="studio-traffic-count">{source.views.toLocaleString()}</span><span className="studio-traffic-track" role="img" aria-label={`${share}% of recorded product views`}><i style={{width:`${share}%`}}/></span><strong>{share}%</strong></div>; })}</div> : <div className="studio-traffic-empty"><span className="studio-reference-chart-empty__icon"><ChartNoAxesColumnIncreasing size={19}/></span><strong>{data.offers.some((offer) => offer.status === 'published') ? 'Your traffic sources will show here' : 'Publish your first offer to get started'}</strong><p>{data.offers.some((offer) => offer.status === 'published') ? 'Share your storefront link to bring visitors in. We’ll show which sources send them.' : 'Once your offer is live and people visit it, you’ll see where they found you.'}</p><Link href={data.offers.some((offer) => offer.status === 'published') ? `/c/${data.creator.slug}` : '/workspace/products'} className="studio-empty-cta" target={data.offers.some((offer) => offer.status === 'published') ? '_blank' : undefined} rel={data.offers.some((offer) => offer.status === 'published') ? 'noreferrer' : undefined}>{data.offers.some((offer) => offer.status === 'published') ? 'View storefront' : 'Create an offer'}<ArrowRight size={14}/></Link></div>}<p className="studio-traffic-note">View counts can include repeat visits. Sources without a referring site are grouped as Direct / unattributed.</p></section>
      </>}
    </div>
  </div></main>;
}

function CurrencySwitch({ currency, setCurrency }: { currency: 'NGN' | 'USD'; setCurrency: (value: 'NGN' | 'USD') => void }) {
  return <div className="studio-currency-control"><span className="studio-currency-control__label">Currency</span><div className="studio-currency-switch" role="group" aria-label="Dashboard currency">{(['NGN', 'USD'] as const).map((option) => <button key={option} type="button" aria-pressed={currency === option} className={currency === option ? 'is-selected' : ''} onClick={() => setCurrency(option)}>{option}</button>)}</div></div>;
}

function MetricCard({ title, value, detail, trend = false, negative = false, alert = false, action }: { title: string; value: string; detail: string; trend?: boolean; negative?: boolean; alert?: boolean; action?: ReactNode }) {
  return <article className="studio-reference-metric"><div className="studio-reference-metric__heading"><span>{title}</span></div><strong>{value}</strong><div className="studio-reference-metric__footer"><small className={alert ? 'is-alert' : trend ? 'is-positive' : negative ? 'is-negative' : ''}>{trend && <ArrowUpRight size={14}/>} {negative && <ArrowDownRight size={14}/>} {alert && <CircleHelp size={14}/>} {detail}</small>{action}</div></article>;
}

function EmptyPanel({ icon, title, text, link, linkLabel, external = false }: { icon: ReactNode; title: string; text: string; link?: string; linkLabel?: string; external?: boolean }) {
  return <div className="studio-reference-empty-panel"><span>{icon}</span><strong>{title}</strong><p>{text}</p>{link && <Link href={link} className="studio-empty-cta" target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{linkLabel}<ArrowRight size={14}/></Link>}</div>;
}

function DashboardContentSkeleton({ days, setDays, error, onRetry }: {
  days: number; setDays: (value: number) => void;
  error: string; onRetry: () => void;
}) {
  return <div className="studio-dashboard-skeleton" aria-busy="true" aria-label="Loading overview data">
    <span className="sr-only" role="status">Loading overview metrics and sales analytics</span>
    {error && <div className="creator-dashboard-error" role="alert"><CircleHelp size={20}/><div><strong>Your workspace couldn’t load</strong><p>{error}</p></div><button type="button" onClick={onRetry}>Try again</button></div>}
    <div className="studio-dashboard-skeleton__stats">{[0, 1, 2, 3].map((stat) => <div key={stat}><i/><b/><span/></div>)}</div>
    <div className="studio-dashboard-skeleton__panels">
      <section className="studio-dashboard-skeleton__panel studio-dashboard-skeleton__panel--wide studio-dashboard-skeleton__panel--overview"><header><strong>Sales overview</strong><div className="studio-reference-range-switch" role="group" aria-label="Sales chart date range">{([{days:90,label:'90 days'},{days:30,label:'30 days'},{days:7,label:'7 days'}] as const).map((range) => <button key={range.days} type="button" aria-pressed={days === range.days} className={days === range.days ? 'is-selected' : ''} onClick={() => setDays(range.days)}>{range.label}</button>)}</div></header><div className="studio-dashboard-skeleton__chart-summary"><i/><b/></div><div className="studio-dashboard-skeleton__chart"/><div className="studio-dashboard-skeleton__mini-stats">{[0,1,2].map((item) => <span key={item}><i/><b/></span>)}</div></section>
      <section className="studio-dashboard-skeleton__panel studio-dashboard-skeleton__panel--wide"><header><strong>Top products</strong></header><div>{[0, 1, 2].map((row) => <i key={row}/>)}</div></section>
      <section className="studio-dashboard-skeleton__panel studio-dashboard-skeleton__panel--wide"><header><strong>How people find you</strong></header><div>{[0, 1, 2, 3].map((row) => <i key={row}/>)}</div></section>
    </div>
  </div>;
}
