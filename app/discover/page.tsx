'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type Creator = { id: string; display_name: string; slug: string; headline: string | null; bio: string | null };

export default function DiscoverPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setMessage('Creator discovery is being prepared. Check back soon.'); setLoading(false); return; }
    void supabase.from('creators').select('id,display_name,slug,headline,bio').eq('status', 'PUBLISHED').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setMessage('Creator discovery is temporarily unavailable.'); else setCreators((data ?? []) as Creator[]);
      setLoading(false);
    });
  }, []);
  const filtered = useMemo(() => creators.filter(creator => `${creator.display_name} ${creator.headline ?? ''} ${creator.bio ?? ''}`.toLowerCase().includes(query.toLowerCase())), [creators, query]);
  return <main className="page-shell"><header className="storefront-hero"><div className="storefront-header"><Link href="/" className="text-link" style={{ color: '#4e6558' }}>← Onselli</Link><div style={{ marginTop: 32 }}><span className="section-kicker">Explore knowledge</span><h1 className="page-title">Learn from people<br/>who’ve been there.</h1><p className="page-subtitle">Discover creators sharing the skills, ideas and experience that help you take your next step.</p><label htmlFor="creator-search" style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 540, marginTop: 24, padding: '0 15px', minHeight: 50, border: '1px solid #c9d9ce', borderRadius: 12, background: 'rgba(255,255,255,.8)' }}><Search size={17} color="#66766f"/><input id="creator-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search creators or topics" style={{ width: '100%', border: 0, outline: 0, background: 'transparent', fontSize: 12 }}/></label></div></div></header>
    <section className="page-content" style={{ paddingTop: 48 }}><div className="studio-top"><div><span className="section-kicker">Creator directory</span><h2 style={{ margin: '8px 0', fontSize: 20, letterSpacing: '-.04em' }}>Find your next learning space</h2></div><Link href="/signup" className="text-link" style={{ color: '#014733' }}>Become a creator <ArrowUpRight size={14}/></Link></div>
      {loading ? <p style={{ color: '#66766f', fontSize: 12, marginTop: 28 }}>Finding creators…</p> : message ? <div className="empty-state" style={{ marginTop: 24 }}><p>{message}</p></div> : filtered.length ? <div className="offer-grid" style={{ marginTop: 23 }}>{filtered.map((creator, index) => <Link key={creator.id} href={`/c/${creator.slug}`} className="offer-card"><div className="offer-art" style={{ background: index % 2 ? 'linear-gradient(130deg,#101b18,#126345 65%,#a1f2c3)' : undefined }}/><div className="offer-content"><span className="section-kicker">Creator</span><h2 style={{ marginTop: 8 }}>{creator.display_name}</h2><p>{creator.headline || creator.bio || 'Explore this creator’s knowledge and offers.'}</p><div className="offer-meta"><span>View storefront</span><ArrowUpRight size={15}/></div></div></Link>)}</div> : <div className="empty-state" style={{ marginTop: 24 }}><h3>{query ? 'No creators match that search yet.' : 'The directory is just getting started.'}</h3><p>{query ? 'Try another name or topic.' : 'Be one of the first creators to open your Onselli storefront.'}</p><Link href="/signup" className="button button--mint" style={{ background: '#014733', color: '#fff' }}>Create your storefront <ArrowUpRight size={14}/></Link></div>}
    </section></main>;
}
