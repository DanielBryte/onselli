'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Download, GraduationCap, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { currencyMinorToDecimal } from '@/lib/money.mjs';

type BundleItem = { id: string; title: string; type: 'course' | 'download' | 'payment_link' | 'bundle'; status: string; currency: string; priceMinor: string; position: number };
const money = (minor: string, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(currencyMinorToDecimal(minor, currency)));

export default function BundleItemsEditor({ productId, currency, onReadyChange }: { productId: string; currency: string; onReadyChange?: (ready: boolean) => void }) {
  const [available, setAvailable] = useState<BundleItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [savedSelection, setSavedSelection] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const [catalogResponse, currentResponse] = await Promise.all([
        fetch('/api/workspace/products', { cache: 'no-store', signal }),
        fetch(`/api/workspace/products/${encodeURIComponent(productId)}/bundle-items`, { cache: 'no-store', signal }),
      ]);
      const [catalog, current] = await Promise.all([catalogResponse.json().catch(() => ({})), currentResponse.json().catch(() => ({}))]);
      if (!catalogResponse.ok) throw new Error(catalog.error || 'Your products could not be loaded.');
      if (!currentResponse.ok) throw new Error(current.error || 'This bundle could not be loaded.');
      if (!Array.isArray(catalog.products) || !Array.isArray(current.items)) throw new Error('Bundle setup returned incomplete data. Please retry.');
      setAvailable(catalog.products.filter((item: BundleItem) => item.id !== productId && ['course', 'download'].includes(item.type)));
      setSelected(current.items.map((item: BundleItem) => item.id));
      setSavedSelection(current.items.map((item: BundleItem) => item.id));
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Bundle products could not be loaded.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [productId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const toggle = (id: string) => setSelected((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : ids.length < 20 ? [...ids, id] : ids);
  const validSelection = selected.length >= 2 && selected.length <= 20 && selected.every((id) => {
    const item = available.find((entry) => entry.id === id);
    return item?.status === 'published' && item.currency === currency;
  });
  const eligibleCount = available.filter((item) => item.status === 'published' && item.currency === currency).length;
  const publishedCount = available.filter((item) => item.status === 'published').length;
  const draftCount = available.filter((item) => item.status === 'draft').length;
  const eligibilityMessage = eligibleCount === 1
    ? `1 published product uses ${currency}. Publish one more in ${currency} to make a bundle.`
    : eligibleCount > 1
      ? `${eligibleCount} published products in ${currency} can be added. Select at least 2.`
      : publishedCount > 0
        ? `Your published products use a different currency. Change this bundle to their currency, or publish products in ${currency}.`
        : draftCount > 0
          ? 'The products below are drafts, so buyers cannot access them yet. Publish at least 2 courses or downloads to add them.'
          : `Publish at least 2 courses or downloads in ${currency} before adding products to this bundle.`;
  useEffect(() => { onReadyChange?.(!loading && !error && validSelection && selected.slice().sort().join('|') === savedSelection.slice().sort().join('|')); }, [error, loading, onReadyChange, savedSelection, selected, validSelection]);
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspace/products/${encodeURIComponent(productId)}/bundle-items`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productIds: selected }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Bundle contents could not be saved.');
      setNotice('Included products saved.');
      setSavedSelection([...selected]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Bundle contents could not be saved.'); }
    finally { setBusy(false); }
  }
  return <section className="bundle-editor" aria-labelledby="bundle-items-heading">
    <div><h2 id="bundle-items-heading">Choose what’s included</h2><p className="product-editor__intro">Select 2–20 published courses or downloads in {currency}. Buyers receive access to each included product.</p></div>
    {error && <div className="product-library__load-error" role="alert"><p>{error}</p><button type="button" className="button button--outline" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Try again</button></div>}{notice && <p className="product-library__notice" role="status">{notice}</p>}
    {loading ? <p role="status">Loading your published products…</p> : error ? null : <>
      {eligibleCount < 2 && <div className="bundle-editor__eligibility" role="status"><p>{eligibilityMessage}</p><Link href="/workspace/products">Manage products</Link></div>}
      {available.length ? <div className="bundle-editor__list">{available.map((item) => {
      const eligible = item.status === 'published' && item.currency === currency;
      const availability = item.status === 'draft' ? 'Draft · publish to add' : item.status === 'archived' ? 'Archived · publish to add' : item.currency !== currency ? `Wrong currency · ${item.currency}` : `Published · ${item.currency}`;
      const reasonId = `bundle-item-reason-${item.id}`;
      const checked = selected.includes(item.id); const Icon = item.type === 'course' ? GraduationCap : Download;
      return <label className={`bundle-editor__item ${!eligible ? 'is-disabled' : ''}`} key={item.id}>
        <input type="checkbox" checked={checked} disabled={!eligible && !checked} aria-describedby={!eligible ? reasonId : undefined} onChange={() => toggle(item.id)}/><span className="bundle-editor__check"><Check size={14}/></span><Icon size={18}/>
        <span className="bundle-editor__details"><strong>{item.title}</strong><small>{item.type === 'course' ? 'Course' : 'Digital download'} · <span id={reasonId} className={`bundle-editor__availability${!eligible ? ' is-unavailable' : ''}`}>{availability}</span></small></span><span>{money(item.priceMinor, item.currency)}</span>
      </label>;
      })}</div> : <p>Publish a course or digital download first. It will appear here when it is ready to include.</p>}
    </>}
    <p className="bundle-editor__count">{selected.length} of 20 selected · Choose at least 2 products to publish</p>
    <button className="button button--outline" type="button" onClick={save} disabled={busy || loading || Boolean(error) || !validSelection}>{busy ? 'Saving…' : 'Save included products'}</button>
  </section>;
}
