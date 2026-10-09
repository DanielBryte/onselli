'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type LearningItem = { id: string; title: string; kind: string; content_body: string; creator: { display_name: string; slug: string } | null; order: { id: string; amount: number; currency: string } | null };

export default function LearningLibraryPage() {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void (async () => {
    const supabase = getSupabase(); const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session) { setError('Log in to see the experiences you have purchased.'); setLoading(false); return; }
    const response = await fetch('/api/learning', { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
    const payload = await response.json(); if (!active) return;
    if (!response.ok) setError(payload.error || 'Your library could not be loaded.'); else setItems(payload.items ?? []);
    setLoading(false);
  })(); return () => { active = false; }; }, []);
  return <main className="page-shell"><div className="page-content"><span className="section-kicker">Your learning library</span><h1 className="page-title">Keep growing.</h1><p className="page-subtitle">Your purchases and creator experiences, together.</p>{loading ? <p style={{ marginTop: 28 }}>Loading your library…</p> : error ? <div className="empty-state" style={{ marginTop: 28 }}><p>{error}</p><Link href="/login" className="button button--mint">Log in</Link></div> : items.length ? <div className="product-list" style={{ marginTop: 28 }}>{items.map(item => <article key={item.id} className="product-row"><div><span className="section-kicker">{item.kind.toLowerCase()}</span><h2 style={{ margin: '6px 0', fontSize: 17 }}>{item.title}</h2><p>By {item.creator?.display_name ?? 'Creator'}</p><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{item.content_body || 'Your creator has not added learning materials yet. Contact them for access details.'}</p>{item.order && <a href={`mailto:hello@onselli.com?subject=${encodeURIComponent(`Purchase support ${item.order.id}`)}&body=${encodeURIComponent(`Please help me with purchase ${item.order.id} for ${item.title}. I would like to ask about access or request a refund.`)}`} style={{ display: 'inline-block', marginTop: 10, color: '#014733', fontSize: 11, fontWeight: 800 }}>Get purchase support or request a refund</a>}</div><BookOpen size={19}/></article>)}</div> : <div className="empty-state" style={{ marginTop: 28 }}><h2>No purchases yet</h2><p>When you buy a creator’s experience, it will be available here.</p><Link href="/discover" className="button button--mint">Discover creators <ArrowRight size={14}/></Link></div>}</div></main>;
}
