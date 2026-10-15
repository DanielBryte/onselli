'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, BadgeCheck, CircleHelp, ExternalLink, Eye, Plus, ShoppingBag, Wallet } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import CreatorNav from './CreatorNav';

type Creator = { id: string; display_name: string; slug: string; headline: string | null; status: string };
type Product = { id: string; title: string; kind: string; status: string; price_amount: number; currency: string; slug: string; created_at?: string };
type Order = { id: string; status: string; amount: number; platform_fee_amount: number; currency: string; created_at: string; paid_at: string | null; creator_products: { title: string } | null };

const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `${currency} ${amount.toLocaleString()}`; }
};

export default function StudioPage() {
  const router = useRouter();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [productsError, setProductsError] = useState('');
  const [salesError, setSalesError] = useState('');
  const [period, setPeriod] = useState('30');
  const [currency, setCurrency] = useState('all');
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase) { setPageError('Supabase is not configured. Add the public web URL and publishable key to the web environment.'); setLoading(false); return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      setEmail(auth.user.email ?? '');
      const { data, error: creatorError } = await supabase.from('creators').select('id,display_name,slug,headline,status').eq('user_id', auth.user.id).maybeSingle();
      if (!active) return;
      if (creatorError) { setPageError('We couldn’t load your studio. Please refresh and try again.'); setLoading(false); return; }
      if (!data) { router.replace('/creator/setup'); return; }
      setCreator(data as Creator);
      const [productResult, orderResult] = await Promise.all([
        supabase.from('creator_products').select('id,title,kind,status,price_amount,currency,slug,created_at').eq('creator_id', data.id).order('created_at', { ascending: false }),
        supabase.from('creator_orders').select('id,status,amount,platform_fee_amount,currency,created_at,paid_at,creator_products(title)').eq('creator_id', data.id).order('created_at', { ascending: false }).limit(1000),
      ]);
      if (!active) return;
      if (productResult.error) setProductsError('Your offers couldn’t be loaded. Please refresh and try again.');
      else { setProducts((productResult.data ?? []) as Product[]); setProductsLoaded(true); }
      if (orderResult.error) setSalesError(orderResult.error.code === 'PGRST205'
        ? 'Earnings and sales will appear after the creator payments database setup is applied to this Supabase project.'
        : 'We couldn’t load earnings right now. Your offers and storefront are still available.');
      else setOrders((orderResult.data ?? []) as unknown as Order[]);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [router]);

  const published = products.filter(product => product.status === 'PUBLISHED').length;
  const drafts = products.filter(product => product.status === 'DRAFT').length;
  const paidOrders = orders.filter(order => order.status === 'PAID' || order.status === 'DISPUTED_WON');
  const availableCurrencies = [...new Set(paidOrders.map(order => order.currency.trim()))].sort();
  const periodStart = new Date(); periodStart.setHours(0, 0, 0, 0); periodStart.setDate(periodStart.getDate() - (Number(period) - 1));
  const periodOrders = paidOrders.filter(order => new Date(order.paid_at ?? order.created_at) >= periodStart);
  const visibleOrders = currency === 'all' ? periodOrders : periodOrders.filter(order => order.currency.trim() === currency);
  const paidByCurrency = useMemo(() => visibleOrders.reduce<Record<string, number>>((totals, order) => {
    totals[order.currency.trim()] = (totals[order.currency.trim()] ?? 0) + Number(order.amount) - Number(order.platform_fee_amount);
    return totals;
  }, {}), [visibleOrders]);
  const activity = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const days = Number(period);
    const date = new Date(periodStart); date.setDate(date.getDate() + Math.floor((index * days) / 7));
    const next = new Date(periodStart); next.setDate(next.getDate() + Math.floor(((index + 1) * days) / 7));
    const startKey = date.toLocaleDateString('en-CA');
    const endKey = next.toLocaleDateString('en-CA');
    const count = visibleOrders.filter(order => {
      const key = new Date(order.paid_at ?? order.created_at).toLocaleDateString('en-CA');
      return key >= startKey && (index === 6 ? key <= endKey : key < endKey);
    }).length;
    return { key: startKey, label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count };
  }), [visibleOrders, period, periodStart]);
  const chartMax = Math.max(1, ...activity.map(day => day.count));

  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main">
    <header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Overview</strong></div><div className="creator-top-actions"><span className="creator-account-email" title={email}>{email}</span><Link className="creator-top-avatar" href="/creator/payouts" aria-label="Payment settings"><Wallet size={17}/></Link></div></header>
    <div className="creator-dashboard__body">
      <div className="creator-welcome"><div><span className="creator-eyebrow"><span/> YOUR STUDIO</span><h1>{creator ? `Welcome back, ${creator.display_name}.` : 'Your Onselli studio'}</h1><p>Here’s what’s happening with your creator business.</p></div><div className="creator-welcome-actions"><Link href={`/c/${creator?.slug ?? ''}`} target="_blank" className="creator-secondary-action" aria-disabled={!creator}><Eye size={16}/> View storefront <ExternalLink size={13}/></Link><Link href="/creator/products/new" className="creator-primary-action"><Plus size={17}/> Create an offer</Link></div></div>

      {loading ? <div className="creator-dashboard-skeleton" aria-label="Loading your studio"><span/><span/><span/><span/></div> : pageError ? <div className="creator-dashboard-error" role="alert"><CircleHelp size={19}/><div><strong>Your studio couldn’t load</strong><p>{pageError}</p></div><button onClick={() => window.location.reload()}>Try again</button></div> : creator && <>
        {productsError && <div className="creator-dashboard-error creator-dashboard-error--compact" role="alert"><CircleHelp size={18}/><div><strong>Your offer list couldn’t load</strong><p>{productsError}</p></div><button onClick={() => window.location.reload()}>Try again</button></div>}
        {productsLoaded && products.length === 0 && <section className="creator-first-product"><div className="creator-first-product-art"><div className="creator-first-product-card"><span>YOUR FIRST OFFER</span><div className="creator-first-product-cover"><ShoppingBag size={24}/></div><i/><i/><i/></div><span className="creator-first-product-spark creator-first-product-spark--one">✳</span><span className="creator-first-product-spark creator-first-product-spark--two">✦</span></div><div className="creator-first-product-copy"><span className="creator-panel-kicker">A GREAT PLACE TO START</span><h2>Turn your knowledge into your first offer.</h2><p>Create a course, download, workshop or coaching offer. We’ll guide you through the details and help you publish it to your storefront.</p><Link href="/creator/products/new" className="creator-primary-action"><Plus size={17}/> Build your first product <ArrowRight size={15}/></Link><small>You can save it as a draft and finish it whenever you’re ready.</small></div></section>}
        <section className="creator-summary-grid" aria-label="Business summary">
          <article className="creator-summary-card creator-summary-card--dark"><div className="creator-summary-card__top"><span>Paid sales · {period} days</span><span className="creator-summary-icon"><ShoppingBag size={17}/></span></div><strong>{salesError ? '—' : visibleOrders.length}</strong><small>Confirmed transactions in this period</small><Link href="/creator/orders" aria-label="View sales"><ArrowUpRight size={17}/></Link></article>
          <article className="creator-summary-card"><div className="creator-summary-card__top"><span>Published offers</span><span className="creator-summary-icon creator-summary-icon--green"><BadgeCheck size={17}/></span></div><strong>{published}</strong><small>{drafts} {drafts === 1 ? 'draft' : 'drafts'} in your studio</small><Link href="/creator/products/new" aria-label="Create an offer"><ArrowUpRight size={17}/></Link></article>
          <article className="creator-summary-card"><div className="creator-summary-card__top"><span>Your earnings</span><span className="creator-summary-icon creator-summary-icon--sand"><Wallet size={17}/></span></div>{salesError ? <strong>—</strong> : Object.entries(paidByCurrency).length ? <div className="creator-revenue-values">{Object.entries(paidByCurrency).slice(0, 2).map(([code, amount]) => <strong key={code}>{money(amount, code)}</strong>)}</div> : <strong>{currency === 'all' ? '—' : money(0, currency)}</strong>}<small>Creator share · before Bachs fees and refunds</small><Link href="/creator/analytics" aria-label="View analytics"><ArrowUpRight size={17}/></Link></article>
          <article className="creator-summary-card"><div className="creator-summary-card__top"><span>Storefront views</span><span className="creator-summary-icon creator-summary-icon--blue"><Eye size={17}/></span></div><strong>—</strong><small>Analytics are available by offer</small><Link href="/creator/analytics" aria-label="View analytics"><ArrowUpRight size={17}/></Link></article>
        </section>

        <div className="creator-dashboard-grid">
          <section className="creator-panel creator-sales-panel"><div className="creator-panel-heading"><div><span className="creator-panel-kicker">YOUR MONEY, AT A GLANCE</span><h2>Earnings overview</h2><p>Creator share from confirmed payments</p></div><Link href="/creator/analytics" className="creator-inline-link">Full analytics <ArrowRight size={14}/></Link></div>
            <div className="creator-earnings-filters"><label>Period<select value={period} onChange={event => setPeriod(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}><option value="all">All currencies</option>{availableCurrencies.map(code => <option key={code} value={code}>{code}</option>)}</select></label></div>
            {salesError ? <div className="creator-earnings-unavailable" role="status"><Wallet size={19}/><div><strong>Earnings are not connected yet</strong><p>{salesError}</p></div></div> : visibleOrders.length ? <><div className="creator-earnings-total"><span>{currency === 'all' ? 'Creator share by currency' : `Creator share · ${currency}`}</span><div>{Object.entries(paidByCurrency).map(([code, amount]) => <strong key={code}>{money(amount, code)}</strong>)}</div><small>After Onselli’s platform fee · before Bachs processing fees and refunds</small></div><div className="creator-chart" role="img" aria-label={`Paid orders in the last ${period} days: ${activity.map(day => `${day.label} ${day.count}`).join(', ')}`}><div className="creator-chart-grid"><span/><span/><span/><span/></div><div className="creator-chart-bars">{activity.map(day => <div className="creator-chart-column" key={day.key}><div className="creator-chart-track"><span style={{ height: `${Math.max(day.count ? 18 : 3, (day.count / chartMax) * 100)}%` }} title={`${day.count} paid ${day.count === 1 ? 'order' : 'orders'}`}/></div><small>{day.label}</small></div>)}</div></div><div className="creator-chart-foot"><span><i/> Paid orders</span><strong>{visibleOrders.length} in this period</strong></div></> : <div className="creator-earnings-empty"><span className="creator-earnings-empty-icon"><ShoppingBag size={18}/></span><div><strong>No paid sales in this period yet</strong><p>When a customer completes checkout, your confirmed earnings will show here.</p></div></div>}
          </section>
          <section className="creator-panel creator-store-panel"><div className="creator-store-art"><div className="creator-store-art__orb"/><div className="creator-store-preview"><span>YOUR STOREFRONT</span><strong>{creator.display_name}</strong><small>{creator.headline || 'A home for your offers'}</small><div className="creator-store-preview__line"/><div className="creator-store-preview__line creator-store-preview__line--short"/><span className="creator-store-preview__button">Explore offers <ArrowRight size={12}/></span></div><span className="creator-store-tag"><span/> LIVE VIEW</span></div><div className="creator-store-copy"><div><h2>Your public storefront</h2><p>Share your page to help customers discover your work.</p></div><Link href={`/c/${creator.slug}`} target="_blank" aria-label="Open public storefront"><ArrowUpRight size={17}/></Link></div></section>
        </div>

        {products.length > 0 && <section className="creator-panel creator-offers-panel"><div className="creator-panel-heading"><div><span className="creator-panel-kicker">YOUR CATALOG</span><h2>Offers</h2><p>Manage what you sell and keep your storefront fresh.</p></div><Link href="/creator/products/new" className="creator-secondary-action"><Plus size={15}/> New offer</Link></div>
          {products.length ? <div className="creator-offers-list">{products.map(product => <article className="creator-offer-row" key={product.id}><span className="creator-offer-icon"><ShoppingBag size={17}/></span><div className="creator-offer-info"><strong>{product.title}</strong><small>{product.kind.toLowerCase().replaceAll('_', ' ')} · {money(Number(product.price_amount), product.currency)}</small></div><span className={`creator-offer-status ${product.status === 'PUBLISHED' ? 'is-live' : ''}`}><i/>{product.status === 'PUBLISHED' ? 'Live' : product.status.toLowerCase()}</span>{product.kind === 'DOWNLOAD' && <Link href={`/creator/products/${product.id}/files`} className="creator-offer-manage">Files <ArrowRight size={13}/></Link>}{product.status === 'PUBLISHED' && <Link href={`/c/${creator.slug}/${product.slug}`} target="_blank" className="creator-offer-open" aria-label={`Open ${product.title}`}><ExternalLink size={15}/></Link>}</article>)}</div> : <div className="creator-offers-empty"><span className="creator-offer-icon"><ShoppingBag size={19}/></span><div><strong>Your next idea belongs here.</strong><p>Create an offer, set its price, and make it available from your Onselli storefront.</p></div><Link href="/creator/products/new" className="creator-inline-link">Create your first offer <ArrowRight size={14}/></Link></div>}
        </section>}

        <section className="creator-quick-links" aria-label="Creator tools"><Link href="/creator/orders"><span className="creator-quick-icon"><ShoppingBag size={17}/></span><span><strong>Sales & refunds</strong><small>View customer orders and manage refund requests</small></span><ArrowRight size={16}/></Link><Link href="/creator/contacts"><span className="creator-quick-icon"><Eye size={17}/></span><span><strong>Customer contacts</strong><small>See your buyers and export your contact list</small></span><ArrowRight size={16}/></Link><Link href="/creator/payouts"><span className="creator-quick-icon"><Wallet size={17}/></span><span><strong>Payments & payouts</strong><small>Manage your connected creator account</small></span><ArrowRight size={16}/></Link></section>
      </>}
      <footer className="creator-dashboard-footer"><span>Made for independent creators</span><span>Onselli Studio</span></footer>
    </div>
  </div></main>;
}
