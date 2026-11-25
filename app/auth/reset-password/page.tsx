'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import { getAuthErrorMessage, isAuthTokenError } from '@/lib/auth-errors';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const currentToken = query.get('token');
    setToken(currentToken);
    setInvalidLink(!currentToken || Boolean(query.get('error')));
    if (currentToken) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setBusy(true);
    try {
      if (!token) { setError('This reset link is invalid or has expired. Request a new one to continue.'); return; }
      const { error: updateError } = await authClient.resetPassword({ newPassword: password, token });
      if (updateError) { setError(getAuthErrorMessage(updateError, 'We couldn’t update your password. Request a fresh reset link if this one has expired.')); if (isAuthTokenError(updateError)) setInvalidLink(true); return; }
      router.replace('/login?passwordReset=success');
      router.refresh();
    } catch (cause) {
      setError(getAuthErrorMessage(cause, 'We couldn’t update your password. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-canvas px-5 py-[clamp(36px,10vh,100px)]"><div className="mx-auto max-w-[520px]"><Link href="/" aria-label="Onselli home" className="inline-flex"><img className="h-[30px] w-auto" src="/logo.png" alt="Onselli" /></Link><section className="mt-6 rounded-2xl border border-border bg-white p-7 sm:p-9"><span className="text-xs font-bold uppercase tracking-[.12em] text-muted">Account recovery</span><h1 className="mt-3 text-[clamp(30px,5vw,40px)] font-semibold leading-tight tracking-[-.04em] text-ink">{invalidLink ? 'Request a new reset link' : 'Choose a new password'}</h1>{invalidLink ? <><p className="mb-6 mt-2 text-sm leading-relaxed text-muted">This password reset link is missing, expired, or already used. Request a fresh link to continue.</p><Link className="flex h-[52px] w-full items-center justify-between rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong" href="/auth/forgot-password">Request a new reset link <ArrowRight size={15}/></Link></> : <><p className="mb-6 mt-2 text-sm leading-relaxed text-muted">Use at least 8 characters and keep it somewhere safe.</p><form onSubmit={submit} className="grid gap-4"><div className="grid gap-2"><label htmlFor="new-password" className="text-sm font-semibold text-ink-secondary">New password</label><input className="h-[52px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15" id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></div><div className="grid gap-2"><label htmlFor="confirm-password" className="text-sm font-semibold text-ink-secondary">Confirm new password</label><input className="h-[52px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15" id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} required /></div>{error && <p className="rounded-xl bg-danger-tint p-3 text-sm leading-relaxed text-danger" role="alert">{error}</p>}<button className="mt-1 flex h-[52px] w-full items-center justify-between rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Updating password…' : 'Save new password'} <ArrowRight size={15}/></button></form></>}</section></div></main>;
}
