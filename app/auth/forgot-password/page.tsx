'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const supabase = getSupabase();
    if (!supabase) { setError('Password recovery is temporarily unavailable.'); setBusy(false); return; }
    const redirectTo = new URL(`/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`, window.location.origin).toString();
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) { setError(resetError.message); return; }
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the reset link. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell"><div className="page-content auth-recovery"><Link href="/login" className="text-link"><ArrowLeft size={14}/> Back to login</Link><section className="form-card auth-recovery__card"><span className="section-kicker">Account recovery</span><h1 className="page-title">Reset your password</h1><p className="page-subtitle">Enter the email address on your Onselli account and we’ll send you a secure reset link.</p>{sent ? <p className="form-success" role="status">If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam folder.</p> : <form onSubmit={submit}><div className="field"><label htmlFor="recovery-email">Email address</label><input id="recovery-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--mint" type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, background: '#014733', color: '#fff' }}>{busy ? 'Sending link…' : 'Send reset link'} <ArrowRight size={15}/></button></form>}</section></div></main>;
}
