'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, LockKeyhole } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import CheckoutButton from '../../../components/CheckoutButton';

type Product = { id: string; title: string; slug: string; kind: string; description: string; price_amount: number; currency: string };
type Creator = { display_name: string; slug: string; headline: string | null };

export default function PublicProductPage({ creatorSlug, productSlug }: { creatorSlug: string; productSlug: string }) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    if (!supabase) { setLoading(false); return; }
    void (async () => {
      const { data: profile } = await supabase.from('creators').select('id,display_name,slug,headline').eq('slug', creatorSlug).eq('status', 'PUBLISHED').maybeSingle();
      if (!active) return;
      if (!profile) { setLoading(false); return; }
      const { data: offer } = await supabase.from('creator_products').select('id,title,slug,kind,description,price_amount,currency').eq('creator_id', profile.id).eq('slug', productSlug).eq('status', 'PUBLISHED').maybeSingle();
      if (!active) return;
      setCreator(profile as Creator); setProduct(offer as Product | null); setLoading(false);
    })();
    return () => { active = false; };
  }, [creatorSlug, productSlug]);
  if (loading) return <main className="page-shell"><div className="page-content">Loading offer…</div></main>;
  if (!product || !creator) return <main className="page-shell"><div className="page-content"><div className="empty-state"><h1>This offer isn’t available.</h1><p>It may still be in draft or the page address may have changed.</p><Link href="/discover">Explore creators</Link></div></div></main>;
  let price = `${product.currency} ${Number(product.price_amount).toLocaleString()}`;
  try { price = new Intl.NumberFormat(undefined, { style: 'currency', currency: product.currency }).format(Number(product.price_amount)); } catch { /* Keep the stored currency label. */ }
  return <main className="page-shell"><header className="storefront-hero"><div className="storefront-header"><Link href={`/c/${creator.slug}`} className="text-link" style={{ color: '#4e6558' }}><ArrowLeft size={13}/> {creator.display_name}</Link><div style={{ marginTop: 36 }}><span className="section-kicker">{product.kind.toLowerCase()} · by {creator.display_name}</span><h1 className="page-title" style={{ maxWidth: 760 }}>{product.title}</h1><p className="page-subtitle">{creator.headline || `A learning experience from ${creator.display_name}.`}</p></div></div></header><section className="page-content" style={{ maxWidth: 940, paddingTop: 38 }}><div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 28, alignItems: 'start' }}><article style={{ padding: 26, background: '#fff', border: '1px solid #dce7e0', borderRadius: 16 }}><h2 style={{ margin: '0 0 13px', fontSize: 18 }}>About this experience</h2><p style={{ color: '#586b60', fontSize: 13, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{product.description}</p></article><aside style={{ padding: 23, background: '#fff', border: '1px solid #dce7e0', borderRadius: 16 }}><span className="section-kicker">Your investment</span><strong style={{ display: 'block', marginTop: 10, fontSize: 26, letterSpacing: '-.05em' }}>{price}</strong><CheckoutButton productId={product.id} returnPath={`/c/${creator.slug}/${product.slug}`} /><p style={{ color: '#718078', fontSize: 10, lineHeight: 1.7, marginTop: 13 }}><LockKeyhole size={12} style={{ display: 'inline', verticalAlign: 'middle' }}/> Secure hosted checkout. Your learning access unlocks after payment confirmation.</p><Link href={`/c/${creator.slug}`} className="text-link" style={{ display: 'inline-flex', marginTop: 8, color: '#014733' }}>More from {creator.display_name} <ArrowUpRight size={13}/></Link></aside></div></section></main>;
}
