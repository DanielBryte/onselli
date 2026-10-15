'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Mail, Search, Users } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import CreatorNav from '../CreatorNav';

type Contact = { buyer_user_id: string; buyer_email: string; purchase_count: number; spend_by_currency: Record<string, number>; first_purchase_at: string; last_purchase_at: string; last_product_title: string; last_order_status: string; total_contacts: number };
const PAGE_SIZE = 25;
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
const money = (amount: number, currency: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); } catch { return `${currency} ${amount.toLocaleString()}`; } };

export default function CreatorContactsPage() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [creatorId, setCreatorId] = useState('');
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (nextOffset: number, search: string, append: boolean) => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    if (!creatorId) return;
    const { data, error: rpcError } = await supabase.rpc('get_creator_contacts', { creator_id_input: creatorId, search_input: search || null, page_size_input: PAGE_SIZE, page_offset_input: nextOffset });
    if (rpcError) { setError(rpcError.message); setLoading(false); setLoadingMore(false); return; }
    const contacts = (data ?? []) as Contact[];
    setRows(current => append ? [...current, ...contacts] : contacts);
    setTotal(Number(contacts[0]?.total_contacts ?? 0)); setOffset(nextOffset + contacts.length); setLoading(false); setLoadingMore(false);
  }, [creatorId]);

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

  useEffect(() => { if (!creatorId) return; const timer = window.setTimeout(() => { setLoading(true); setError(''); setOffset(0); void load(0, query.trim(), false); }, query ? 250 : 0); return () => window.clearTimeout(timer); }, [query, load, creatorId]);

  async function exportCsv() {
    if (!creatorId) return;
    setExporting(true);
    const supabase = getSupabase();
    if (!supabase) { setExporting(false); return; }
    let exportRows = [...rows];
    try {
      while (exportRows.length < total) {
        const { data, error: rpcError } = await supabase.rpc('get_creator_contacts', { creator_id_input: creatorId, search_input: query.trim() || null, page_size_input: 50, page_offset_input: exportRows.length });
        if (rpcError) throw rpcError;
        const next = (data ?? []) as Contact[];
        if (!next.length) break;
        exportRows = [...exportRows, ...next];
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not export contacts.');
      setExporting(false);
      return;
    }
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = [['Email', 'Purchases', 'Spend by currency', 'First purchase', 'Latest purchase', 'Latest offer'], ...exportRows.map(row => [row.buyer_email, String(row.purchase_count), Object.entries(row.spend_by_currency ?? {}).map(([currency, spend]) => `${currency} ${Number(spend).toFixed(2)}`).join(' | '), date(row.first_purchase_at), date(row.last_purchase_at), row.last_product_title])];
    const blob = new Blob([lines.map(line => line.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'onselli-contacts.csv'; anchor.click(); URL.revokeObjectURL(url);
    setExporting(false);
  }

  return <main className="page-shell"><div className="page-content creator-workspace">
    <CreatorNav />
    <section className="creator-workspace__content">
      <div className="insight-header"><div><span className="section-kicker">Your audience</span><h1 className="page-title">Contacts</h1><p className="page-subtitle">A clear list of people who have purchased from you, with their purchase history and spend.</p></div><button className="button button--outline insight-export" disabled={!rows.length || exporting} onClick={() => void exportCsv()}><Download size={15}/> {exporting ? 'Preparing export…' : 'Export CSV'}</button></div>
      <div className="contact-toolbar"><label className="contact-search"><Search size={17}/><input aria-label="Search buyer email" placeholder="Search by email" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</label><span className="contact-count">{loading ? 'Updating…' : `${total.toLocaleString()} ${total === 1 ? 'buyer' : 'buyers'}`}</span></div>
      {error ? <p className="form-error" role="alert">{error}</p> : loading && !rows.length ? <p className="insight-loading">Loading your contacts…</p> : rows.length ? <>
        <div className="contact-list" aria-live="polite">{rows.map(row => <article className="contact-card" key={row.buyer_user_id}>
          <div className="contact-card__identity"><span className="contact-avatar" aria-hidden="true">{row.buyer_email?.[0]?.toUpperCase() || '?'}</span><div><a href={`mailto:${encodeURIComponent(row.buyer_email)}?subject=${encodeURIComponent('Your Onselli purchase')}`} className="contact-email">{row.buyer_email}</a><span className="contact-secondary">Customer since {date(row.first_purchase_at)}</span></div></div>
          <div className="contact-card__metric"><span>Purchases</span><strong>{Number(row.purchase_count)}</strong></div>
          <div className="contact-card__metric"><span>Total spend</span><strong>{Object.entries(row.spend_by_currency ?? {}).map(([currency, amount]) => money(Number(amount), currency)).join(' · ') || '—'}</strong></div>
          <div className="contact-card__latest"><span>Last purchase</span><strong>{row.last_product_title}</strong><small>{date(row.last_purchase_at)}</small></div>
          <a className="contact-action" href={`mailto:${encodeURIComponent(row.buyer_email)}?subject=${encodeURIComponent('Your Onselli purchase')}`} aria-label={`Email ${row.buyer_email}`}><Mail size={16}/><span>Contact</span></a>
        </article>)}</div>
        {offset < total && <div className="load-more-wrap"><button className="button button--outline load-more" disabled={loadingMore} onClick={() => { setLoadingMore(true); void load(offset, query.trim(), true); }}>{loadingMore ? 'Loading…' : 'Load more buyers'}</button></div>}
      </> : <div className="empty-state contact-empty"><span className="contact-empty__icon"><Users size={22}/></span><h2>{query ? 'No buyers match that search.' : 'Your buyer list starts with your first sale.'}</h2><p>{query ? 'Try another email address or clear your search.' : 'When someone purchases an offer, they will appear here with their order history and spend.'}</p>{query && <button className="button button--outline load-more" onClick={() => setQuery('')}>Clear search</button>}</div>}
    </section>
  </div></main>;
}
