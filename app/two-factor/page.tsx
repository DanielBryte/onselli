'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/server/auth/client';

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
      if (result.error) throw new Error(result.error.message || 'That code could not be verified.');
      router.replace('/auth/continue');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code could not be verified.');
    } finally { setBusy(false); }
  }

  async function startEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await authClient.twoFactor.enable({ password, method: 'totp', issuer: 'Onselli' });
      if (result.error) throw new Error(result.error.message || 'Could not start two-factor setup.');
      if (result.data?.method !== 'totp') throw new Error('Could not create an authenticator setup.');
      const uri = new URL(result.data.totpURI);
      setTotpSecret(uri.searchParams.get('secret') ?? '');
      setBackupCodes(result.data.backupCodes);
      setPhase('backup-codes');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start two-factor setup.');
    } finally { setBusy(false); }
  }

  async function confirmEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ''), trustDevice: false });
      if (result.error) throw new Error(result.error.message || 'That code could not be verified.');
      router.replace('/admin');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code could not be verified.');
    } finally { setBusy(false); }
  }

  if (phase === 'loading') return <main className="onboarding-loading"><img src="/logo.png" alt="Onselli"/><p>Checking your security setup…</p></main>;

  return <main className="auth-shell"><section className="auth-main" style={{ gridColumn: '1 / -1' }}><div className="auth-form-wrap">
    <div className="auth-heading"><h1>{phase === 'challenge' ? 'Verify it’s you' : phase === 'backup-codes' ? 'Set up two-factor sign-in' : 'Two-factor verification'}</h1><p>{phase === 'challenge' ? 'Enter the code from your authenticator app to finish signing in.' : phase === 'backup-codes' ? 'Add Onselli to your authenticator app using this setup key. Save your backup codes before continuing.' : 'Admin accounts must secure sign-in with an authenticator app.'}</p></div>
    {phase === 'challenge' && <form className="auth-form" onSubmit={event => { event.preventDefault(); void verify(); }}><div className="auth-field"><label htmlFor="auth-code">Authenticator code</label><input id="auth-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} minLength={6} maxLength={8} required/></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button></form>}
    {phase === 'enroll' && <form className="auth-form" onSubmit={event => void startEnrollment(event)}><div className="auth-field"><label htmlFor="admin-password">Confirm your password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required/></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Preparing setup…' : 'Set up authenticator'}</button></form>}
    {phase === 'backup-codes' && <><div className="empty-state" style={{ margin: '24px 0' }}><p>In your authenticator app, add an account manually and enter this key:</p><p style={{ fontFamily: 'monospace', fontWeight: 800, overflowWrap: 'anywhere' }}>{totpSecret || 'Setup key unavailable'}</p><p>These backup codes can each be used once if you lose access to your authenticator:</p><p style={{ fontFamily: 'monospace', fontWeight: 800, overflowWrap: 'anywhere' }}>{backupCodes.join('  ·  ')}</p></div><form className="auth-form" onSubmit={event => void confirmEnrollment(event)}><div className="auth-field"><label htmlFor="setup-code">Enter the code from your authenticator</label><input id="setup-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} minLength={6} maxLength={8} required/></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Finish setup'}</button></form></>}
    <p className="auth-switch"><Link href="/login">Return to sign in</Link></p>
  </div></section></main>;
}
