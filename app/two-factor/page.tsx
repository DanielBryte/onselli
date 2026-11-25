'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/server/auth/client';
import { getAuthErrorMessage } from '@/lib/auth-errors';

type Phase = 'loading' | 'challenge' | 'enroll' | 'backup-codes';

export default function TwoFactorPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void authClient.getSession().then(({ data }) => {
      if (!active) return;
      if (!data?.user) { setPhase('challenge'); return; }
      const user = data.user as typeof data.user & { adminRole?: string | null; twoFactorEnabled?: boolean };
      if (!user.adminRole) { router.replace('/auth/continue'); return; }
      if (user.twoFactorEnabled) { router.replace('/admin'); return; }
      setPhase('enroll');
    }).catch(() => { if (active) setPhase('challenge'); });
    return () => { active = false; };
  }, [router]);

  async function verify() {
    setBusy(true); setError('');
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ''), trustDevice: false });
      if (result.error) throw new Error(getAuthErrorMessage(result.error, 'That code could not be verified. Check it and try again.'));
      router.replace('/auth/continue');
    } catch (cause) {
      setError(getAuthErrorMessage(cause, 'That code could not be verified. Check it and try again.'));
    } finally { setBusy(false); }
  }

  async function startEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await authClient.twoFactor.enable({ password, method: 'totp', issuer: 'Onselli' });
      if (result.error) throw new Error(getAuthErrorMessage(result.error, 'We couldn’t start two-factor setup. Check your password and try again.'));
      if (result.data?.method !== 'totp') throw new Error('Could not create an authenticator setup.');
      const uri = new URL(result.data.totpURI);
      setTotpSecret(uri.searchParams.get('secret') ?? '');
      setBackupCodes(result.data.backupCodes);
      setPhase('backup-codes');
    } catch (cause) {
      setError(getAuthErrorMessage(cause, 'We couldn’t start two-factor setup. Check your password and try again.'));
    } finally { setBusy(false); }
  }

  async function confirmEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ''), trustDevice: false });
      if (result.error) throw new Error(getAuthErrorMessage(result.error, 'That code could not be verified. Check it and try again.'));
      router.replace('/admin');
    } catch (cause) {
      setError(getAuthErrorMessage(cause, 'That code could not be verified. Check it and try again.'));
    } finally { setBusy(false); }
  }

  if (phase === 'loading') return <main className="grid min-h-svh place-content-center justify-items-center gap-[18px] bg-white text-sm text-muted"><img className="h-[58px] w-[58px] object-contain" src="/logo.png" alt="Onselli"/><p>Checking your security setup…</p></main>;

  return <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-8"><section className="w-full max-w-[440px] rounded-[20px] border border-border bg-white p-6 shadow-[0_22px_70px_rgba(23,55,35,.07)] sm:p-9"><div className="mb-5 text-center"><h1 className="mb-2 text-[clamp(30px,3vw,38px)] font-semibold leading-[1.12] tracking-[-.045em] text-ink">{phase === 'challenge' ? 'Verify it’s you' : phase === 'backup-codes' ? 'Set up two-factor sign-in' : 'Two-factor verification'}</h1><p className="mx-auto max-w-[370px] text-sm leading-relaxed text-muted">{phase === 'challenge' ? 'Enter the code from your authenticator app to finish signing in.' : phase === 'backup-codes' ? 'Add Onselli to your authenticator app using this setup key. Save your backup codes before continuing.' : 'Admin accounts must secure sign-in with an authenticator app.'}</p></div>
    {phase === 'challenge' && <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void verify(); }}><div className="grid gap-2"><label className="text-[13px] font-semibold text-ink-secondary" htmlFor="auth-code">Authenticator code</label><input className="h-[52px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15" id="auth-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} minLength={6} maxLength={8} required/></div>{error && <p className="rounded-xl bg-danger-tint p-3 text-sm text-danger-text" role="alert">{error}</p>}<button className="flex h-[52px] items-center justify-center rounded-full bg-display px-5 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button></form>}
    {phase === 'enroll' && <form className="grid gap-4" onSubmit={event => void startEnrollment(event)}><div className="grid gap-2"><label className="text-[13px] font-semibold text-ink-secondary" htmlFor="admin-password">Confirm your password</label><input className="h-[52px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15" id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></div>{error && <p className="rounded-xl bg-danger-tint p-3 text-sm text-danger-text" role="alert">{error}</p>}<button className="flex h-[52px] items-center justify-center rounded-full bg-display px-5 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Preparing setup…' : 'Set up authenticator'}</button></form>}
    {phase === 'backup-codes' && <><div className="my-6 grid gap-3 rounded-xl bg-canvas p-4 text-sm text-ink-secondary"><p>In your authenticator app, add an account manually and enter this key:</p><p className="break-all font-mono font-extrabold text-ink">{totpSecret || 'Setup key unavailable'}</p><p>These backup codes can each be used once if you lose access to your authenticator:</p><p className="break-all font-mono font-extrabold text-ink">{backupCodes.join('  ·  ')}</p></div><form className="grid gap-4" onSubmit={event => void confirmEnrollment(event)}><div className="grid gap-2"><label className="text-[13px] font-semibold text-ink-secondary" htmlFor="setup-code">Enter the code from your authenticator</label><input className="h-[52px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15" id="setup-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} minLength={6} maxLength={8} required/></div>{error && <p className="rounded-xl bg-danger-tint p-3 text-sm text-danger-text" role="alert">{error}</p>}<button className="flex h-[52px] items-center justify-center rounded-full bg-display px-5 text-sm font-semibold text-white hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Finish setup'}</button></form></>}
    <p className="mt-5 text-center text-sm text-muted"><Link className="font-semibold text-display hover:underline" href="/login">Return to sign in</Link></p>
  </section></main>;
}
