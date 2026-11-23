'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import { getSafeNextPath } from '@/lib/navigation/safe-next-path.mjs';

function getSafeNext(value: string | null) { return getSafeNextPath(value, window.location.origin); }

function getSignupCallbackURL() {
  const safeNext = getSafeNext(new URLSearchParams(window.location.search).get('next'));
  return safeNext ? `/auth/continue?next=${encodeURIComponent(safeNext)}` : '/onboarding';
}

function getAuthErrorMessage(cause: unknown) {
  const error = cause instanceof Error
    ? { message: cause.message, status: undefined }
    : typeof cause === 'object' && cause !== null
      ? {
          message: 'message' in cause && typeof cause.message === 'string' ? cause.message : '',
          status: 'status' in cause && typeof cause.status === 'number' ? cause.status : undefined,
        }
      : { message: '', status: undefined };
  if (error.status !== undefined && error.status >= 500 || /connection|network|fetch failed|internal server error|server error/i.test(error.message)) {
    return 'We couldn’t reach the sign-in service. Check your connection and try again in a moment.';
  }
  return error.message || 'We couldn’t complete sign-in. Please try again in a moment.';
}

export default function AuthForm({ mode, googleEnabled }: { mode: 'signup' | 'login'; googleEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [nextQuery, setNextQuery] = useState('');
  const signup = mode === 'signup';

  useEffect(() => {
    const safeNext = getSafeNext(new URLSearchParams(window.location.search).get('next'));
    if (safeNext) setNextQuery(`?next=${encodeURIComponent(safeNext)}`);
  }, []);

  async function signInWithProvider() {
    setError('');
    setMessage('');
    setNeedsConfirmation(false);
    setBusy(true);
    const next = new URLSearchParams(window.location.search).get('next');
    const safeNext = getSafeNext(next);
    const redirectPath = signup ? (safeNext ? `/auth/continue?next=${encodeURIComponent(safeNext)}` : '/onboarding') : safeNext ?? '/auth/continue';
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: redirectPath });
      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        setBusy(false);
      }
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setNeedsConfirmation(false);
    setBusy(true);
    try {
      const result = signup
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: getSignupCallbackURL() })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: getSafeNext(new URLSearchParams(window.location.search).get('next')) ?? '/auth/continue' });
      setBusy(false);
      if (result.error) {
        if (!signup && result.error.code === 'EMAIL_NOT_VERIFIED') {
          setNeedsConfirmation(true);
          setMessage('Your email is not verified yet. We sent a new verification link; check your inbox and spam folder.');
          return;
        }
        setError(getAuthErrorMessage(result.error));
        return;
      }
      if (signup) {
        setNeedsConfirmation(true);
        setMessage('We’ve sent a verification link to your email. Verify your address to continue.');
        return;
      }
      if (result.data && 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect) {
        router.replace('/two-factor');
        return;
      }
      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      const safeNext = getSafeNext(next);
      router.push(signup ? '/onboarding' : safeNext ?? '/auth/continue');
      router.refresh();
    } catch (cause) {
      setBusy(false);
      setError(getAuthErrorMessage(cause));
      return;
    }
  }

  async function resendConfirmation() {
    setError(''); setResending(true);
    try {
      const callbackURL = signup
        ? getSignupCallbackURL()
        : getSafeNext(new URLSearchParams(window.location.search).get('next')) ?? '/auth/continue';
      const { error: resendError } = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL });
      if (resendError) throw new Error(resendError.message);
      setMessage('A new confirmation link has been sent. Check your inbox and spam folder.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend the confirmation link. Please try again.');
    } finally { setResending(false); }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="About Onselli">
        <div className="auth-story-mark"><img src="/logo.png" alt="Onselli" /></div>
        <div className="auth-story-content">
          <h2>Turn what you know<br />into what you earn.</h2>
          <p>Bring your courses, workshops, and digital products together in one storefront.</p>
        </div>
        <div className="auth-story-footer"><a href="https://unsplash.com/photos/woman-working-on-laptop-at-office-desk-xzgsTWQ28hE" target="_blank" rel="noreferrer">Photo by Vitaly Gariev / Unsplash</a></div>
      </section>

      <section className="auth-main">
        <div className="auth-mobile-brand"><Link href="/" aria-label="Onselli home"><img src="/logo.png" alt="Onselli" /></Link><nav className="auth-mode-switch" aria-label="Choose account action"><Link href="/signup" aria-current={signup ? 'page' : undefined} className={signup ? 'is-active' : undefined}>Sign up</Link><Link href="/login" aria-current={!signup ? 'page' : undefined} className={!signup ? 'is-active' : undefined}>Log in</Link></nav></div>
        <div className="auth-form-wrap">
          <div className="auth-heading">
            <h1>{signup ? 'Create an account' : 'Welcome back'}</h1>
            <p>{signup ? 'Create an account to get started with Onselli.' : 'Sign in to continue to your Onselli workspace or purchase.'}</p>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {signup && <div className="auth-field"><label htmlFor="name">Your name</label><input id="name" autoComplete="name" placeholder="e.g. Olivia James" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></div>}
            <div className="auth-field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="auth-field"><label htmlFor="password">Password</label><div className="auth-password-input"><input id="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /><button className="auth-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
            {!signup && <div className="auth-form-meta"><p className="auth-forgot"><Link href={`/auth/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}>Forgot password?</Link></p></div>}
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="form-success" role="status">{message}</p>}
            {needsConfirmation && <button className="auth-resend" type="button" onClick={() => void resendConfirmation()} disabled={resending}>{resending ? 'Sending another link…' : 'Resend confirmation email'}</button>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}<ArrowRight size={16} /></button>
          </form>
          {googleEnabled && <><div className="auth-social-divider"><span>or continue with</span></div>
            <div className="auth-social-providers" aria-label="Sign in with a social account">
              <button className="auth-social-button" type="button" onClick={() => signInWithProvider()} disabled={busy} aria-label="Continue with Google">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.25-.2-1.8H12v3.42h5.37a4.6 4.6 0 0 1-1.99 3.02v2.22h3.22c1.88-1.73 2.75-4.27 2.75-6.86Z"/><path fill="#34A853" d="M12 21.6c2.7 0 4.97-.9 6.63-2.43l-3.22-2.22c-.9.6-2.05.96-3.41.96-2.62 0-4.84-1.77-5.63-4.15H3.05v2.29A10 10 0 0 0 12 21.6Z"/><path fill="#FBBC05" d="M6.37 13.76a6 6 0 0 1 0-3.52V7.95H3.05a10 10 0 0 0 0 8.1l3.32-2.29Z"/><path fill="#EA4335" d="M12 6.1c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 3.1 14.7 2.2 12 2.2a10 10 0 0 0-8.95 5.75l3.32 2.29C7.16 7.87 9.38 6.1 12 6.1Z"/></svg><span>Google</span>
              </button>
            </div></>}
          <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Onselli?'} <Link href={`${signup ? '/login' : '/signup'}${nextQuery}`}>{signup ? 'Log in' : 'Create an account'}</Link></p>
          <div className="auth-secure"><img className="auth-secure-logo" src="/logo.png" alt="" aria-hidden="true" /><span>Your Onselli account, ready wherever you need it.</span></div>
        </div>
        <footer className="auth-main-footer"><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link></footer>
      </section>
    </main>
  );
}
