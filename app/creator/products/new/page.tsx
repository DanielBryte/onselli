'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const makeSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

export default function NewProductPage() {
  const router = useRouter();
  const [creatorId, setCreatorId] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [kind, setKind] = useState('COURSE');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [status, setStatus] = useState('DRAFT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabase is not configured.'); return; }
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return; }
      const { data: creator } = await supabase.from('creators').select('id').eq('user_id', data.user.id).maybeSingle();
      if (!creator) router.replace('/creator/setup'); else setCreatorId(creator.id);
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const supabase = getSupabase();
    if (!supabase || !creatorId) { setError('Your creator workspace is not ready. Sign in again or finish setup.'); return; }
    setBusy(true);
    const { data: product, error: insertError } = await supabase.from('creator_products').insert({ creator_id: creatorId, title: title.trim(), slug, kind, description: description.trim(), price_amount: Number(price), currency, status }).select('id').single();
    if (!insertError && product) {
      const { error: contentError } = await supabase.from('creator_product_content').upsert({ product_id: product.id, content_body: content.trim() }, { onConflict: 'product_id' });
      if (contentError) { setBusy(false); setError(`Offer saved, but its learning content could not be saved: ${contentError.message}`); return; }
    }
    setBusy(false);
    if (insertError) { setError(insertError.code === '23505' ? 'You already have an offer with that address. Change the title or address.' : insertError.message); return; }
    router.push('/creator'); router.refresh();
  }

  return <main className="page-shell"><div className="page-content"><Link href="/creator" className="text-link" style={{ color: '#52645a' }}><ArrowLeft size={14}/> Back to studio</Link><div style={{ marginTop: 35 }}><span className="section-kicker">Create an offer</span><h1 className="page-title">Package what you know.</h1><p className="page-subtitle">Start with one useful experience. Your offer gets a public page when you publish it.</p></div><form className="form-card" style={{ maxWidth: 720, marginTop: 26 }} onSubmit={submit}>
    <div className="field"><label htmlFor="kind">Offer type</label><select id="kind" value={kind} onChange={e => setKind(e.target.value)}><option value="COURSE">Course</option><option value="DOWNLOAD">Digital download</option><option value="WORKSHOP">Workshop or cohort</option><option value="COACHING">Coaching</option><option value="COMMUNITY">Community</option></select></div>
    <div className="field"><label htmlFor="title">Offer title</label><input id="title" value={title} onChange={e => { setTitle(e.target.value); setSlug(makeSlug(e.target.value)); }} required minLength={3} maxLength={140} placeholder="The Brand Clarity Workshop" /></div>
    <div className="field"><label htmlFor="slug">Page address</label><input id="slug" value={slug} onChange={e => setSlug(makeSlug(e.target.value))} required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></div>
    <div className="field"><label htmlFor="description">What will learners get?</label><textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required minLength={10} maxLength={6000} placeholder="Describe the result, who this is for and what the experience includes." /></div>
    <div className="field"><label htmlFor="content">Purchased content</label><textarea id="content" value={content} onChange={e => setContent(e.target.value)} maxLength={1000000} placeholder="Add the first lesson, workshop notes, or download instructions. Only buyers with a completed payment can access this." style={{ minHeight: 190 }} /></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 12 }}><div className="field"><label htmlFor="price">Price</label><input id="price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required placeholder="25000" /></div><div className="field"><label htmlFor="currency">Currency</label><select id="currency" value={currency} onChange={e => setCurrency(e.target.value)}><option value="NGN">NGN</option><option value="USD">USD</option><option value="GHS">GHS</option><option value="KES">KES</option><option value="ZAR">ZAR</option></select></div></div>
    <div className="field"><label htmlFor="status">Publishing</label><select id="status" value={status} onChange={e => setStatus(e.target.value)}><option value="DRAFT">Save as draft</option><option value="PUBLISHED">Publish offer page</option></select></div>
    {status === 'PUBLISHED' && <p className="notice" style={{ marginTop: 15 }}>The sales page is public. The learning content stays private and is released only after a verified payment.</p>}
    {error && <p className="form-error" role="alert" style={{ marginTop: 15 }}>{error}</p>}
    <button className="button button--mint" type="submit" disabled={busy} style={{ width: '100%', marginTop: 20, background: '#014733', color: '#fff' }}>{busy ? 'Saving offer…' : status === 'PUBLISHED' ? 'Publish offer page' : 'Save draft'} <ArrowRight size={15}/></button>
  </form></div></main>;
}
