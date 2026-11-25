'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import { getSafeNextPath } from '@/lib/navigation/safe-next-path.mjs';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import Button from '@/app/components/ui/Button';

function getSafeNext(value: string | null) { return getSafeNextPath(value, window.location.origin); }

function getSignupCallbackURL() {
  const safeNext = getSafeNext(new URLSearchParams(window.location.search).get('next'));
  const destination = safeNext ? `/auth/continue?next=${encodeURIComponent(safeNext)}` : '/onboarding';
  return `/auth/verified?next=${encodeURIComponent(destination)}`;
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
  const [existingAccount, setExistingAccount] = useState(false);
  const [resending, setResending] = useState(false);
  const [nextQuery, setNextQuery] = useState('');
  const signup = mode === 'signup';

  useEffect(() => {
    const safeNext = getSafeNext(new URLSearchParams(window.location.search).get('next'));
    if (safeNext) setNextQuery(`?next=${encodeURIComponent(safeNext)}`);
    if (!signup && new URLSearchParams(window.location.search).get('passwordReset') === 'success') {
      setMessage('Your password has been updated. Sign in with your new password.');
    }
  }, [signup]);

  async function signInWithProvider() {
    setError('');
    setMessage('');
    setNeedsConfirmation(false);
    setExistingAccount(false);
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
    setExistingAccount(false);
    setBusy(true);
    try {
      const result = signup
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: getSignupCallbackURL() })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: getSafeNext(new URLSearchParams(window.location.search).get('next')) ?? '/auth/continue' });
      setBusy(false);
      if (result.error) {
        if (!signup && result.error.code === 'EMAIL_NOT_VERIFIED') {
          setNeedsConfirmation(true);
          setMessage('This account needs email verification. Check your inbox and spam folder, or request a fresh link below.');
          return;
        }
        if (signup && result.error.code === 'USER_ALREADY_EXISTS') {
          setExistingAccount(true);
          setError(getAuthErrorMessage(result.error));
          return;
        }
        setError(getAuthErrorMessage(result.error, signup ? 'We couldn’t create your account. Check your details and try again.' : 'We couldn’t sign you in. Check your details and try again.'));
        return;
      }
      if (signup) {
        setNeedsConfirmation(true);
        setMessage('If this address needs verification, we’ve requested a secure link. Check your inbox and spam folder.');
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
      setMessage('If this address needs verification, a fresh link will arrive shortly. Check your inbox and spam folder.');
    } catch (cause) {
      setError(getAuthErrorMessage(cause, 'We couldn’t resend the confirmation link. Please try again.'));
    } finally { setResending(false); }
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[minmax(0,.88fr)_minmax(390px,1.12fr)] lg:overflow-hidden">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-brand-strong bg-[linear-gradient(180deg,rgba(7,29,19,.12)_0%,rgba(7,29,19,.22)_38%,rgba(7,29,19,.88)_100%),url('/images/onselli-creator-story-v2.jpg')] bg-cover bg-[position:50%_center] p-[clamp(28px,4vw,62px)] text-white lg:flex" aria-label="About Onselli">
        <div className="relative z-10 flex items-center gap-2.5 text-[11px] font-bold tracking-[.12em] text-white"><img className="h-10 w-10 rounded-[9px] object-cover" src="/logo.png" alt="Onselli" /></div>
        <div className="relative z-10 my-auto flex min-h-[clamp(320px,calc(100svh-400px),580px)] w-full max-w-[590px] flex-col justify-end py-[50px] pb-[26px]">
          <h2 className="mb-[17px] mt-[22px] max-w-[560px] text-[clamp(43px,4.6vw,64px)] font-semibold leading-[1.02] tracking-[-.045em] [text-shadow:0_2px_18px_rgba(0,0,0,.32)]">Turn what you know<br />into what you earn.</h2>
          <p className="m-0 max-w-[420px] text-[15px] leading-[1.7] text-white [text-shadow:0_1px_10px_rgba(0,0,0,.4)]">Bring your courses, workshops, and digital products together in one storefront.</p>
        </div>
        <div className="relative z-10 flex justify-between gap-3 text-[10px] text-white/70"><a className="text-white/70 underline decoration-white/35 underline-offset-[3px] hover:text-white" href="https://unsplash.com/photos/woman-working-on-laptop-at-office-desk-xzgsTWQ28hE" target="_blank" rel="noreferrer">Photo by Vitaly Gariev / Unsplash</a></div>
      </section>

      <section className="flex h-screen min-h-screen flex-col items-center overflow-y-auto bg-white px-[22px] pb-3 pt-[14px] lg:px-[clamp(34px,5vw,82px)] lg:pb-5 lg:pt-[30px]">
        <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-2.5 lg:gap-[18px]">
          <Link href="/" aria-label="Onselli home"><img className="h-[52px] w-[52px] rounded-[10px] object-cover lg:hidden" src="/logo.png" alt="Onselli" /></Link><nav className="flex items-center gap-[3px] rounded-full bg-canvas p-1" aria-label="Choose account action"><Link href="/signup" aria-current={signup ? 'page' : undefined} className={`min-w-[88px] rounded-full px-[14px] py-[9px] text-center text-[13px] font-semibold leading-[1.2] transition-colors hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 lg:min-w-[92px] lg:px-4 lg:py-2.5 lg:text-sm ${signup ? 'bg-brand-strong text-white' : 'text-muted'}`}>Sign up</Link><Link href="/login" aria-current={!signup ? 'page' : undefined} className={`min-w-[88px] rounded-full px-[14px] py-[9px] text-center text-[13px] font-semibold leading-[1.2] transition-colors hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2 lg:min-w-[92px] lg:px-4 lg:py-2.5 lg:text-sm ${!signup ? 'bg-brand-strong text-white' : 'text-muted'}`}>Log in</Link></nav>
        </div>
        <div className="my-auto w-full max-w-[440px] py-2 lg:flex-[0_1_440px] lg:py-0">
          {needsConfirmation ? <section className="w-full rounded-2xl border border-border bg-white p-6 text-center sm:p-8" aria-labelledby="confirmation-title" aria-live="polite">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-success-tint text-success" aria-hidden="true"><svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <h1 id="confirmation-title" className="text-[clamp(26px,5vw,34px)] font-semibold leading-tight tracking-[-.04em] text-ink">Check your email</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">We’ve requested a verification link for <strong className="break-all font-semibold text-ink">{email}</strong>. If an account needs verification, the link will arrive shortly. Check your spam folder too.</p>
            {message && <p className="mt-4 rounded-xl bg-success-tint p-3 text-sm leading-relaxed text-success" role="status">{message}</p>}
            {error && <p className="mt-4 rounded-xl bg-danger-tint p-3 text-sm leading-relaxed text-danger" role="alert">{error}</p>}
            <button className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-ink transition hover:bg-canvas disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2" type="button" onClick={() => void resendConfirmation()} disabled={resending}>{resending ? 'Sending link…' : 'Resend confirmation email'}</button>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2"><Button variant="tertiary" size="sm" className="text-brand" type="button" onClick={() => { setNeedsConfirmation(false); setMessage(''); setError(''); }}>Use a different email</Button><Link className="inline-flex min-h-8 items-center rounded-control px-3 text-sm font-semibold text-brand transition hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2" href={`/login${nextQuery}`}>Back to log in</Link></div>
          </section> : <>
          <div className="mb-[15px] w-full text-center lg:mb-5">
            <h1 className="mb-[7px] text-[30px] font-semibold leading-[1.12] tracking-[-.04em] text-ink lg:text-[clamp(32px,3.2vw,40px)]">{signup ? 'Create an account' : 'Welcome back'}</h1>
            <p className="mx-auto min-h-[2.8em] max-w-[370px] text-[13px] leading-[1.5] text-muted lg:min-h-0 lg:text-[15px] lg:leading-[1.65]">{signup ? 'Create an account to get started with Onselli.' : 'Sign in to continue to your Onselli workspace or purchase.'}</p>
          </div>
          <form className="grid w-full gap-2.5 lg:gap-4" onSubmit={submit}>
            {signup && <div className="grid w-full gap-1.5"><label className="pl-[3px] text-xs font-semibold leading-[1.35] text-ink-secondary lg:text-[13px]" htmlFor="name">Your name</label><input className="h-[46px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none transition placeholder:text-muted hover:border-ink-secondary hover:bg-white focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15 lg:h-[52px]" id="name" autoComplete="name" placeholder="e.g. Olivia James" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></div>}
            <div className="grid w-full gap-1.5"><label className="pl-[3px] text-xs font-semibold leading-[1.35] text-ink-secondary lg:text-[13px]" htmlFor="email">Email address</label><input className={`h-[46px] w-full rounded-full border bg-canvas px-[18px] text-sm text-ink outline-none transition placeholder:text-muted hover:border-ink-secondary hover:bg-white focus:bg-white focus:ring-[3px] lg:h-[52px] ${existingAccount ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-border focus:border-brand focus:ring-brand/15'}`} id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setExistingAccount(false); setError(''); }} required aria-invalid={existingAccount} aria-describedby={existingAccount ? 'signup-email-error' : undefined} />{existingAccount && <p id="signup-email-error" className="m-0 px-1 text-[13px] leading-relaxed text-danger" role="alert">An account with this email already exists. <Link className="font-semibold underline underline-offset-2" href={`/login${nextQuery}`}>Log in</Link>.</p>}</div>
            <div className="grid w-full gap-1.5"><label className="pl-[3px] text-xs font-semibold leading-[1.35] text-ink-secondary lg:text-[13px]" htmlFor="password">Password</label><div className="relative w-full"><input className="h-[46px] w-full rounded-full border border-border bg-canvas px-[18px] pr-[54px] text-sm text-ink outline-none transition placeholder:text-muted hover:border-ink-secondary hover:bg-white focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15 lg:h-[52px]" id="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /><button className="absolute right-2 top-1/2 grid h-[38px] w-[38px] -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-brand-tint hover:text-brand-strong focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-1" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
            {!signup && <div className="-mb-1 flex justify-end px-0.5 text-[13px]"><Link className="font-bold text-brand underline-offset-4 hover:underline" href={`/auth/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}>Forgot password?</Link></div>}
            {error && !existingAccount && <p className="m-0 rounded-xl bg-danger-tint px-3 py-2.5 text-[13px] leading-relaxed text-danger" role="alert">{error}</p>}
            {message && <p className="m-0 rounded-xl bg-success-tint px-3 py-2.5 text-[13px] leading-relaxed text-success" role="status">{message}</p>}
            <button className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-white transition hover:-translate-y-px hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60 lg:mt-0 lg:h-[52px]" type="submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}<ArrowRight className="hidden lg:block" size={16} /></button>
          </form>
          {googleEnabled && <><div className="my-2.5 flex items-center gap-3.5 text-xs text-muted before:h-px before:flex-1 before:bg-border-subtle after:h-px after:flex-1 after:bg-border-subtle"><span>or continue with</span></div>
            <div className="grid w-full grid-cols-1 gap-2">
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-2.5 text-[13px] font-semibold text-ink-secondary transition hover:-translate-y-px hover:border-ink-secondary hover:bg-canvas disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2" type="button" onClick={() => signInWithProvider()} disabled={busy} aria-label="Continue with Google">
                <svg className="h-[18px] w-[18px] flex-none" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.25-.2-1.8H12v3.42h5.37a4.6 4.6 0 0 1-1.99 3.02v2.22h3.22c1.88-1.73 2.75-4.27 2.75-6.86Z"/><path fill="#34A853" d="M12 21.6c2.7 0 4.97-.9 6.63-2.43l-3.22-2.22c-.9.6-2.05.96-3.41.96-2.62 0-4.84-1.77-5.63-4.15H3.05v2.29A10 10 0 0 0 12 21.6Z"/><path fill="#FBBC05" d="M6.37 13.76a6 6 0 0 1 0-3.52V7.95H3.05a10 10 0 0 0 0 8.1l3.32-2.29Z"/><path fill="#EA4335" d="M12 6.1c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 3.1 14.7 2.2 12 2.2a10 10 0 0 0-8.95 5.75l3.32 2.29C7.16 7.87 9.38 6.1 12 6.1Z"/></svg><span>Google</span>
              </button>
            </div></>}
          <p className="mt-[14px] text-center text-xs leading-relaxed text-muted lg:mt-[19px] lg:text-[13px]">{signup ? 'Already have an account?' : 'New to Onselli?'} <Link className="font-bold text-brand underline-offset-4 hover:underline" href={`${signup ? '/login' : '/signup'}${nextQuery}`}>{signup ? 'Log in' : 'Create an account'}</Link></p>
          <div className="mt-[13px] flex items-center justify-center gap-2 border-t border-border-subtle pt-2.5 text-center text-[11px] text-muted lg:mt-[22px] lg:py-[15px] lg:text-xs"><img className="h-4 w-4 rounded object-cover" src="/logo.png" alt="" aria-hidden="true" /><span>Your Onselli account, ready wherever you need it.</span></div>
          </>}
        </div>
        <footer className="mt-auto flex w-full max-w-[440px] justify-center gap-5 pt-2 text-[11px] text-muted lg:text-xs"><Link className="hover:text-brand-strong" href="/legal/privacy">Privacy</Link><Link className="hover:text-brand-strong" href="/legal/terms">Terms</Link></footer>
      </section>
    </main>
  );
}
