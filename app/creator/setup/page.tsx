'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const makeSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

export default function CreatorSetupPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setError('Supabase is not configured.'); return; }
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.replace('/login'); return; }
      setUserId(data.user.id);
      setDisplayName(data.user.user_metadata?.full_name ?? '');
      const { data: creator } = await supabase.from('creators').select('id').eq('user_id', data.user.id).maybeSingle();
      if (creator) router.replace('/creator');
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const supabase = getSupabase();
    if (!supabase || !userId) { setError('Your session is missing. Please sign in again.'); return; }
    setBusy(true);
    const { error: insertError } = await supabase.from('creators').insert({ user_id: userId, display_name: displayName.trim(), slug, headline: headline.trim() || null, bio: bio.trim() || null, status: 'PUBLISHED' });
    setBusy(false);
    if (insertError) { setError(insertError.code === '23505' ? 'That storefront address is already taken. Try another.' : insertError.message); return; }
    router.push('/creator'); router.refresh();
  }

  return <main className="page-shell"><div className="page-content"><Link href="/" className="text-link" style={{ color: '#52645a' }}><ArrowLeft size={14}/> Home</Link><div style={{ marginTop: 36 }}><span className="section-kicker">Creator profile · 1 of 1</span><h1 className="page-title">Give your work a home.</h1><p className="page-subtitle">This becomes the page you can share with your audience. You can refine it as your creator business grows.</p></div><form className="form-card" style={{ marginTop: 28 }} onSubmit={submit}>
    <div className="field"><label htmlFor="display-name">Creator or brand name</label><input id="display-name" value={displayName} onChange={e => { setDisplayName(e.target.value); setSlug(makeSlug(e.target.value)); }} required minLength={2} maxLength={100} /></div>
    <div className="field"><label htmlFor="slug">Your Onselli address</label><div style={{ display: 'flex', alignItems: 'center', minHeight: 46, padding: '0 12px', border: '1px solid #cedbd3', borderRadius: 10, fontSize: 12, color: '#6c7a72' }}><span>onselli.com/c/</span><input id="slug" value={slug} onChange={e => setSlug(makeSlug(e.target.value))} required minLength={2} maxLength={70} pattern="[a-z0-9]+(-[a-z0-9]+)*" style={{ border: 0, outline: 0, minHeight: 42, padding: '8px 0', flex: 1, minWidth: 0 }} /></div></div>
    <div className="field"><label htmlFor="headline">What do you help people do?</label><input id="headline" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="I help first-time founders build a clear brand" maxLength={160} /></div>
    <div className="field"><label htmlFor="bio">A short introduction</label><textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Share what you know, who you help and what learners can expect." maxLength={1500} /></div>
    {error && <p className="form-error" role="alert" style={{ marginTop: 15 }}>{error}</p>}
    <button className="button button--mint" type="submit" disabled={busy} style={{ width: '100%', marginTop: 20, background: '#014733', color: 'white' }}>{busy ? 'Saving profile…' : 'Publish creator profile'} <ArrowRight size={15}/></button>
  </form><p style={{ maxWidth: 560, marginTop: 14, color: '#77857d', fontSize: 10, lineHeight: 1.7 }}>Your profile is public when published. Payment collection and seller payouts are not enabled yet.</p></div></main>;
}
