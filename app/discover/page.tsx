'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';

type Creator = { id: string; display_name: string; slug: string; headline: string | null; bio: string | null };

export default function DiscoverPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => { let active = true; void fetch('/api/discover').then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) setCreators(data.creators); }).catch(() => { if (active) setMessage('Creator discovery is temporarily unavailable.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const filtered = useMemo(() => creators.filter(creator => `${creator.display_name} ${creator.headline ?? ''} ${creator.bio ?? ''}`.toLowerCase().includes(query.toLowerCase())), [creators, query]);
   return <main className="page-shell"><header className="storefront-hero"><div className="storefront-header"><Link href="/" className="text-link" style={{ color: '#4e6558' }}>← Onselli</Link><div style={{ marginTop: 32 }}><span className="section-kicker">Explore Onselli</span><h1 className="page-title">Find your next<br/>great experience.</h1><p className="page-subtitle">Discover independent creators and explore the products, services, and experiences they offer.</p><label htmlFor="creator-search" style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 540, marginTop: 24, padding: '0 15px', minHeight: 50, border: '1px solid #c9d9ce', borderRadius: 12, background: 'rgba(255,255,255,.8)' }}><Search size={17} color="#66766f"/><input id="creator-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search creators or what you need" style={{ width: '100%', border: 0, outline: 0, background: 'transparent', fontSize: 12 }}/></label></div></div></header>
    <section className="page-content" style={{ paddingTop: 48 }}><div className="studio-top"><div><span className="section-kicker">Creator directory</span><h2 style={{ margin: '8px 0', fontSize: 20, letterSpacing: '-.04em' }}>Explore creators and their offers</h2></div><Link href="/signup" className="text-link" style={{ color: '#014733' }}>Become a creator <ArrowUpRight size={14}/></Link></div>
      {loading ? <p style={{ color: '#66766f', fontSize: 12, marginTop: 28 }}>Finding creators…</p> : message ? <div className="empty-state" style={{ marginTop: 24 }}><p>{message}</p></div> : filtered.length ? <div className="offer-grid" style={{ marginTop: 23 }}>{filtered.map((creator, index) => <Link key={creator.id} href={`/c/${creator.slug}`} className="offer-card"><div className="offer-art" style={{ background: index % 2 ? 'linear-gradient(130deg,#101b18,#126345 65%,#a1f2c3)' : undefined }}/><div className="offer-content"><span className="section-kicker">Creator</span><h2 style={{ marginTop: 8 }}>{creator.display_name}</h2><p>{creator.headline || creator.bio || 'Explore this creator’s knowledge and offers.'}</p><div className="offer-meta"><span>View storefront</span><ArrowUpRight size={15}/></div></div></Link>)}</div> : <div className="empty-state" style={{ marginTop: 24 }}><h3>{query ? 'No creators match that search yet.' : 'The directory is just getting started.'}</h3><p>{query ? 'Try another name or topic.' : 'Be one of the first creators to open your Onselli storefront.'}</p><Link href="/signup" className="button button--mint" style={{ background: '#014733', color: '#fff' }}>Create your storefront <ArrowUpRight size={14}/></Link></div>}
    </section></main>;
}
