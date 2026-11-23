'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setBusy(true);
    try {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) { setError('This reset link is invalid or has expired. Request a new one to continue.'); return; }
      const { error: updateError } = await authClient.resetPassword({ newPassword: password, token });
      if (updateError) { setError(updateError.message || 'This password reset link has expired. Request a new one.'); return; }
      router.replace('/login');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="page-shell"><div className="page-content auth-recovery"><Link href="/" className="brand-lockup"><img src="/logo.png" alt="Onselli" /></Link><section className="form-card auth-recovery__card"><span className="section-kicker">Account recovery</span><h1 className="page-title">Choose a new password</h1><p className="page-subtitle">Use at least 8 characters and keep it somewhere safe.</p><form onSubmit={submit}><div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></div><div className="field" style={{ marginTop: 14 }}><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} required /></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button--mint" type="submit" disabled={busy} style={{ width: '100%', marginTop: 18, background: '#014733', color: '#fff' }}>{busy ? 'Updating password…' : 'Save new password'} <ArrowRight size={15}/></button></form></section></div></main>;
}
