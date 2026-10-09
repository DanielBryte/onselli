'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

export default function AuthForm({ mode }: { mode: 'signup' | 'login' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const supabase = getSupabase();
    if (!supabase) { setError('Supabase is not configured yet. Add the public web URL and publishable key to the web environment.'); return; }
    setBusy(true);
    const result = signup
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    if (signup && !result.data.session) { setMessage('Check your email to confirm your account, then come back to finish your creator profile.'); return; }
    const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
    const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : null;
    router.push(safeNext ?? (signup ? '/creator/setup' : '/creator'));
    router.refresh();
  }

  return <main className="page-shell"><div className="page-content"><Link className="text-link" style={{ color: '#52645a' }} href="/"><ArrowLeft size={14}/> Back to Onselli</Link><div style={{ marginTop: 38 }}><span className="section-kicker">{signup ? 'Your next chapter' : 'Welcome back'}</span><h1 className="page-title">{signup ? 'Create your creator account.' : 'Sign in to your workspace.'}</h1><p className="page-subtitle">{signup ? 'Set up your home for the knowledge and experiences you share.' : 'Pick up where you left off and keep building.'}</p></div><form className="form-card" style={{ marginTop: 30 }} onSubmit={submit}>
    {signup && <div className="field"><label htmlFor="name">Your name</label><input id="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></div>}
    <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
    <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></div>
    {error && <p className="form-error" role="alert" style={{ marginTop: 16 }}>{error}</p>}{message && <p className="form-success" role="status" style={{ marginTop: 16 }}>{message}</p>}
    <button className="button button--mint" style={{ width: '100%', marginTop: 21, background: '#014733', color: 'white' }} type="submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'} <ArrowRight size={15}/></button>
    <p style={{ margin: '19px 0 0', color: '#65756c', fontSize: 11 }}>{signup ? 'Already have an account?' : 'New to Onselli?'}{' '}<Link style={{ color: '#014733', fontWeight: 800 }} href={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link></p>
  </form><p style={{ maxWidth: 560, marginTop: 16, color: '#78877f', fontSize: 10, lineHeight: 1.7 }}>Payments and creator payouts are not enabled in this setup flow. They will be added after the marketplace payment model is confirmed.</p></div></main>;
}
