'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import Button from '@/app/components/ui/Button';

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
    try {
      const { error: resetError } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: '/auth/reset-password' });
      if (resetError) { setError(getAuthErrorMessage(resetError, 'We couldn’t request a reset link. Please try again.')); return; }
      setSent(true);
    } catch (cause) {
      setError(getAuthErrorMessage(cause, 'We couldn’t request a reset link. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-canvas px-5 py-[clamp(36px,10vh,100px)]"><div className="mx-auto max-w-[520px]"><Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"><ArrowLeft size={14}/> Back to login</Link><section className="mt-6 rounded-2xl border border-border bg-white p-7 sm:p-9"><span className="text-xs font-bold uppercase tracking-[.12em] text-muted">Account recovery</span><h1 className="mt-3 text-[clamp(30px,5vw,40px)] font-semibold leading-tight tracking-[-.04em] text-ink">Reset your password</h1><p className="mb-6 mt-2 text-sm leading-relaxed text-muted">Enter your email and we’ll check whether reset instructions can be sent.</p>{sent ? <div className="rounded-xl bg-success-tint p-4 text-sm leading-relaxed text-success" role="status"><p className="m-0">If an account can be recovered with this address, reset instructions will arrive shortly. Check your inbox and spam folder.</p><Button variant="secondary" size="sm" className="mt-4" type="button" onClick={() => { setSent(false); setError(''); }} disabled={busy}>Send another reset link</Button></div> : <form onSubmit={submit} className="grid gap-4"><div className="grid gap-2"><label htmlFor="recovery-email" className="text-sm font-semibold text-ink-secondary">Email address</label><input className="h-[52px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none transition placeholder:text-muted hover:border-ink-secondary focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15" id="recovery-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></div>{error && <p className="rounded-xl bg-danger-tint p-3 text-sm leading-relaxed text-danger" role="alert">{error}</p>}<button className="mt-1 flex h-[52px] w-full items-center justify-between rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Sending link…' : 'Send reset link'} <ArrowRight size={15}/></button></form>}</section></div></main>;
}
