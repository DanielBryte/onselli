'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type Creator = { id: string; display_name: string; slug: string; headline: string | null; bio: string | null };
type Product = { id: string; title: string; slug: string; kind: string; description: string; price_amount: number; currency: string };
const money = (amount: number, currency: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); } catch { return `${currency} ${amount}`; } };

export default function Storefront({ slug }: { slug: string }) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      const { data: found } = await supabase.from('creators').select('id,display_name,slug,headline,bio').eq('slug', slug).eq('status', 'PUBLISHED').maybeSingle();
      if (!active) return;
      if (!found) { setNotFound(true); setLoading(false); return; }
      setCreator(found as Creator);
      const { data } = await supabase.from('creator_products').select('id,title,slug,kind,description,price_amount,currency').eq('creator_id', found.id).eq('status', 'PUBLISHED').order('created_at', { ascending: false });
      if (!active) return;
      setProducts((data ?? []) as Product[]); setLoading(false);
    })();
    return () => { active = false; };
  }, [slug]);

  if (loading) return <main className="page-shell"><div className="page-content">Opening this storefront…</div></main>;
  if (notFound || !creator) return <main className="page-shell"><div className="page-content"><Link href="/discover">← Explore creators</Link><div className="empty-state" style={{ marginTop: 30 }}><h1>This storefront isn’t available.</h1><p>It may still be in draft or the address may have changed.</p><Link href="/discover" className="button button--mint" style={{ background: '#014733', color: 'white' }}>Explore creators <ArrowRight size={14}/></Link></div></div></main>;

  return <main className="page-shell"><section className="storefront-hero"><div className="storefront-header"><Link href="/discover" className="text-link" style={{ color: '#4e6558' }}><ArrowLeft size={13}/> Explore creators</Link><div className="preview-creator" style={{ marginTop: 34 }}><div className="avatar" style={{ width: 54, height: 54, fontSize: 15 }}>{creator.display_name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div><div><b style={{ fontSize: 13 }}>{creator.display_name}</b><small>{creator.headline || 'Creator on Onselli'}</small></div></div><h1 className="page-title" style={{ maxWidth: 760, marginTop: 22 }}>{creator.headline || `Learn with ${creator.display_name}.`}</h1><p className="page-subtitle">{creator.bio || 'Explore the ideas, skills and experiences this creator shares.'}</p></div></section>
    <section className="storefront-body"><div className="studio-top" style={{ marginBottom: 18 }}><div><span className="section-kicker">Explore the work</span><h2 style={{ margin: '7px 0 0', fontSize: 20, letterSpacing: '-.04em' }}>Offers from {creator.display_name}</h2></div></div>{products.length ? <div className="offer-grid">{products.map(product => <article className="offer-card" key={product.id}><div className="offer-art"/><div className="offer-content"><span className="section-kicker">{product.kind.toLowerCase()}</span><h2 style={{ marginTop: 8 }}>{product.title}</h2><p>{product.description}</p><div className="offer-meta"><span>{money(Number(product.price_amount), product.currency)}</span><Link href={`/c/${creator.slug}/${product.slug}`} aria-label={`View ${product.title}`}><ArrowRight size={16}/></Link></div></div></article>)}</div> : <div className="empty-state"><h3>More learning experiences are on the way.</h3><p>Check back soon to see what {creator.display_name} is creating.</p></div>}</section>
  </main>;
}
