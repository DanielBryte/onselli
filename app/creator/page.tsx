'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ExternalLink, LogOut, Plus } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type Creator = { id: string; display_name: string; slug: string; headline: string | null; status: string };
type Product = { id: string; title: string; kind: string; status: string; price_amount: number; currency: string; slug: string };

export default function StudioPage() {
  const router = useRouter();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase) { setError('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the web environment.'); setLoading(false); return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      setEmail(auth.user.email ?? '');
      const { data, error: creatorError } = await supabase.from('creators').select('id,display_name,slug,headline,status').eq('user_id', auth.user.id).maybeSingle();
      if (!active) return;
      if (creatorError) { setError(creatorError.message); setLoading(false); return; }
      if (!data) { router.replace('/creator/setup'); return; }
      setCreator(data as Creator);
      const { data: items, error: productsError } = await supabase.from('creator_products').select('id,title,kind,status,price_amount,currency,slug').eq('creator_id', data.id).order('created_at', { ascending: false });
      if (!active) return;
      if (productsError) setError(productsError.message); else setProducts((items ?? []) as Product[]);
      setLoading(false);
    };
    void load(); return () => { active = false; };
  }, [router]);

  async function signOut() { const supabase = getSupabase(); if (supabase) await supabase.auth.signOut(); router.replace('/'); }
  const drafts = products.filter(product => product.status === 'DRAFT').length;
  const live = products.filter(product => product.status === 'PUBLISHED').length;

  return <main className="page-shell"><div className="page-content">
    <div className="studio-top"><div><span className="section-kicker">Creator workspace</span><h1 className="page-title">{creator ? `Welcome, ${creator.display_name}.` : 'Your Onselli studio.'}</h1><p className="page-subtitle">Shape what you know into experiences your audience can grow with.</p></div><button className="button button--outline" style={{ color: '#314c3c', borderColor: '#cbd8cf' }} onClick={signOut}><LogOut size={14}/> Sign out</button></div>
    {loading ? <p style={{ marginTop: 32, color: '#68766e', fontSize: 13 }}>Loading your studio…</p> : error ? <p className="form-error" role="alert" style={{ marginTop: 24 }}>{error}</p> : creator && <div className="studio-layout" style={{ marginTop: 32 }}>
      <aside className="studio-sidebar" aria-label="Creator workspace navigation"><Link className="active" href="/creator">Overview</Link><Link href="/creator/products/new">Products</Link><Link href="/creator/orders">Sales</Link><Link href="/creator/payouts">Payout setup</Link><Link href={`/c/${creator.slug}`} target="_blank">View storefront</Link><a href="mailto:hello@onselli.com">Help</a></aside>
      <section className="studio-main"><div className="studio-top"><div><p style={{ margin: 0, color: '#617168', fontSize: 11 }}>Signed in as {email}</p><h2 style={{ margin: '7px 0 0', fontSize: 18, letterSpacing: '-.04em' }}>Your business at a glance</h2></div><Link href="/creator/products/new" className="button button--mint" style={{ background: '#014733', color: '#fff' }}><Plus size={15}/> New offer</Link></div>
        <div className="stats-grid"><div className="stat-card"><span>Published offers</span><strong>{live}</strong></div><div className="stat-card"><span>Draft offers</span><strong>{drafts}</strong></div><div className="stat-card"><span>Payments</span><strong style={{ fontSize: 13 }}>Setup pending</strong></div></div>
        <div className="studio-top"><h2 style={{ margin: 0, fontSize: 16 }}>Your offers</h2><Link href={`/c/${creator.slug}`} target="_blank" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#014733', fontSize: 11, fontWeight: 800 }}>Open storefront <ExternalLink size={13}/></Link></div>
        {products.length ? <div className="product-list">{products.map(product => <article className="product-row" key={product.id}><div><h3>{product.title}</h3><p>{product.kind.toLowerCase()} · {product.currency} {Number(product.price_amount).toLocaleString()}</p></div><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className={`status-pill ${product.status === 'PUBLISHED' ? 'status-pill--published' : ''}`}>{product.status.toLowerCase()}</span>{product.status === 'PUBLISHED' && <Link aria-label={`View ${product.title}`} href={`/c/${creator.slug}/${product.slug}`}><ArrowRight size={15}/></Link>}</div></article>)}</div> : <div className="empty-state" style={{ marginTop: 15 }}><h3>Your first offer starts here.</h3><p>Create a course, download, workshop or coaching offer. You can publish its storefront page now; checkout will be enabled after creator payouts are confirmed.</p><Link href="/creator/products/new" className="button button--mint" style={{ background: '#014733', color: '#fff' }}>Create your first offer <ArrowRight size={14}/></Link></div>}
        <p className="notice" style={{ marginTop: 18 }}>Checkout and creator payouts are currently gated on payment-provider approval and seller settlement terms. Publishing a page does not collect payment or grant paid access.</p>
      </section>
    </div>}
  </div></main>;
}
