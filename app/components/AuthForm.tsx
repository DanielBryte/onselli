'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const target = new URL(value, window.location.origin);
    return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}

export default function AuthForm({ mode }: { mode: 'signup' | 'login' }) {
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
  const signup = mode === 'signup';

  async function signInWithProvider() {
    setError('');
    setMessage('');
    setNeedsConfirmation(false);
    const supabase = getSupabase();
    if (!supabase) {
      setError('Google sign-in is unavailable until Supabase is configured.');
      return;
    }

    setBusy(true);
    const next = new URLSearchParams(window.location.search).get('next');
    const safeNext = getSafeNext(next);
    const redirectPath = safeNext ?? (signup ? '/creator/setup' : '/creator');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: new URL(`/auth/callback?next=${encodeURIComponent(redirectPath)}`, window.location.origin).toString() },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start social sign-in. Please try again.');
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setNeedsConfirmation(false);
    const supabase = getSupabase();
    if (!supabase) {
      setError('Supabase is not configured yet. Add the public web URL and publishable key to the web environment.');
      return;
    }
    setBusy(true);
    try {
      const result = signup
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: new URL(`/auth/callback?next=${encodeURIComponent('/creator/setup')}`, window.location.origin).toString() } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (result.error) {
        setError(result.error.message);
        return;
      }
      if (signup && !result.data.session) {
        setNeedsConfirmation(true);
        setMessage('We’ve sent a confirmation link to your email. Open it to verify your address and continue setting up your creator profile.');
        return;
      }
      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      const safeNext = getSafeNext(next);
      router.push(safeNext ?? (signup ? '/creator/setup' : '/creator'));
      router.refresh();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.');
      return;
    }
  }

  async function resendConfirmation() {
    const supabase = getSupabase();
    if (!supabase) { setError('Email confirmation is temporarily unavailable.'); return; }
    setError(''); setResending(true);
    try {
      const emailRedirectTo = new URL(`/auth/callback?next=${encodeURIComponent('/creator/setup')}`, window.location.origin).toString();
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo } });
      if (resendError) throw resendError;
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
            <p>{signup ? 'Create a workspace for your courses, products, and audience.' : 'Sign in to manage your creator workspace.'}</p>
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
          <div className="auth-social-divider"><span>or continue with</span></div>
          <div className="auth-social-providers" aria-label="Sign in with a social account">
            <button className="auth-social-button" type="button" onClick={() => signInWithProvider()} disabled={busy} aria-label="Continue with Google">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.25-.2-1.8H12v3.42h5.37a4.6 4.6 0 0 1-1.99 3.02v2.22h3.22c1.88-1.73 2.75-4.27 2.75-6.86Z"/><path fill="#34A853" d="M12 21.6c2.7 0 4.97-.9 6.63-2.43l-3.22-2.22c-.9.6-2.05.96-3.41.96-2.62 0-4.84-1.77-5.63-4.15H3.05v2.29A10 10 0 0 0 12 21.6Z"/><path fill="#FBBC05" d="M6.37 13.76a6 6 0 0 1 0-3.52V7.95H3.05a10 10 0 0 0 0 8.1l3.32-2.29Z"/><path fill="#EA4335" d="M12 6.1c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 3.1 14.7 2.2 12 2.2a10 10 0 0 0-8.95 5.75l3.32 2.29C7.16 7.87 9.38 6.1 12 6.1Z"/></svg><span>Google</span>
            </button>
          </div>
          <p className="auth-switch">{signup ? 'Already have an account?' : 'New to Onselli?'} <Link href={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link></p>
          <div className="auth-secure"><img className="auth-secure-logo" src="/logo.png" alt="" aria-hidden="true" /><span>Your creator workspace, all in one place.</span></div>
        </div>
        <footer className="auth-main-footer"><Link href="/legal/privacy">Privacy</Link><Link href="/legal/terms">Terms</Link></footer>
      </section>
    </main>
  );
}
