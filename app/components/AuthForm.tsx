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
    <main className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[minmax(0,.88fr)_minmax(390px,1.12fr)] lg:overflow-hidden">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-[#123b28] bg-[linear-gradient(180deg,rgba(7,29,19,.12)_0%,rgba(7,29,19,.22)_38%,rgba(7,29,19,.88)_100%),url('/images/onselli-creator-story-v2.jpg')] bg-cover bg-[position:50%_center] p-[clamp(28px,4vw,62px)] text-white lg:flex" aria-label="About Onselli">
        <div className="relative z-10 flex items-center gap-2.5 text-[11px] font-bold tracking-[.12em] text-white"><img className="h-10 w-10 rounded-[9px] object-cover" src="/logo.png" alt="Onselli" /></div>
        <div className="relative z-10 my-auto flex min-h-[clamp(320px,calc(100svh-400px),580px)] w-full max-w-[590px] flex-col justify-end py-[50px] pb-[26px]">
          <h2 className="mb-[17px] mt-[22px] max-w-[560px] text-[clamp(43px,4.6vw,64px)] font-semibold leading-[1.02] tracking-[-.045em] [text-shadow:0_2px_18px_rgba(0,0,0,.32)]">Turn what you know<br />into what you earn.</h2>
          <p className="m-0 max-w-[420px] text-[15px] leading-[1.7] text-white [text-shadow:0_1px_10px_rgba(0,0,0,.4)]">Bring your courses, workshops, and digital products together in one storefront.</p>
        </div>
        <div className="relative z-10 flex justify-between gap-3 text-[10px] text-white/70"><a className="text-white/70 underline decoration-white/35 underline-offset-[3px] hover:text-white" href="https://unsplash.com/photos/woman-working-on-laptop-at-office-desk-xzgsTWQ28hE" target="_blank" rel="noreferrer">Photo by Vitaly Gariev / Unsplash</a></div>
      </section>

      <section className="flex h-screen min-h-screen flex-col items-center overflow-y-auto bg-white px-[22px] pb-3 pt-[14px] lg:px-[clamp(34px,5vw,82px)] lg:pb-5 lg:pt-[30px]">
        <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-2.5 lg:gap-[18px]">
          <Link href="/" aria-label="Onselli home"><img className="h-[52px] w-[52px] rounded-[10px] object-cover lg:hidden" src="/logo.png" alt="Onselli" /></Link><nav className="flex items-center gap-[3px] rounded-full bg-[#f3f6f3] p-1" aria-label="Choose account action"><Link href="/signup" aria-current={signup ? 'page' : undefined} className={`min-w-[88px] rounded-full px-[14px] py-[9px] text-center text-[13px] font-semibold leading-[1.2] transition-colors hover:text-[#123b28] focus-visible:outline-2 focus-visible:outline-[#12623f] focus-visible:outline-offset-2 lg:min-w-[92px] lg:px-4 lg:py-2.5 lg:text-sm ${signup ? 'bg-[#123b28] text-white shadow-[0_2px_7px_rgba(18,59,40,.16)]' : 'text-[#637168]'}`}>Sign up</Link><Link href="/login" aria-current={!signup ? 'page' : undefined} className={`min-w-[88px] rounded-full px-[14px] py-[9px] text-center text-[13px] font-semibold leading-[1.2] transition-colors hover:text-[#123b28] focus-visible:outline-2 focus-visible:outline-[#12623f] focus-visible:outline-offset-2 lg:min-w-[92px] lg:px-4 lg:py-2.5 lg:text-sm ${!signup ? 'bg-[#123b28] text-white shadow-[0_2px_7px_rgba(18,59,40,.16)]' : 'text-[#637168]'}`}>Log in</Link></nav>
        </div>
        <div className="my-auto w-full max-w-[440px] py-2 lg:flex-[0_1_440px] lg:py-0">
          <div className="mb-[15px] w-full text-center lg:mb-5">
            <h1 className="mb-[7px] text-[30px] font-semibold leading-[1.12] tracking-[-.04em] text-[#17261d] lg:text-[clamp(32px,3.2vw,40px)]">{signup ? 'Create an account' : 'Welcome back'}</h1>
            <p className="mx-auto min-h-[2.8em] max-w-[370px] text-[13px] leading-[1.5] text-[#68756d] lg:min-h-0 lg:text-[15px] lg:leading-[1.65]">{signup ? 'Create an account to get started with Onselli.' : 'Sign in to continue to your Onselli workspace or purchase.'}</p>
          </div>
          <form className="grid w-full gap-2.5 lg:gap-4" onSubmit={submit}>
            {signup && <div className="grid w-full gap-1.5"><label className="pl-[3px] text-xs font-semibold leading-[1.35] text-[#34443a] lg:text-[13px]" htmlFor="name">Your name</label><input className="h-[46px] w-full rounded-full border border-[#dfe6e0] bg-[#f8faf8] px-[18px] text-sm text-[#1a2b20] outline-none transition placeholder:text-[#8c9990] hover:border-[#c5d3c7] hover:bg-white focus:border-[#26744a] focus:bg-white focus:ring-[3px] focus:ring-[#26744a]/[.12] lg:h-[52px]" id="name" autoComplete="name" placeholder="e.g. Olivia James" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></div>}
            <div className="grid w-full gap-1.5"><label className="pl-[3px] text-xs font-semibold leading-[1.35] text-[#34443a] lg:text-[13px]" htmlFor="email">Email address</label><input className="h-[46px] w-full rounded-full border border-[#dfe6e0] bg-[#f8faf8] px-[18px] text-sm text-[#1a2b20] outline-none transition placeholder:text-[#8c9990] hover:border-[#c5d3c7] hover:bg-white focus:border-[#26744a] focus:bg-white focus:ring-[3px] focus:ring-[#26744a]/[.12] lg:h-[52px]" id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="grid w-full gap-1.5"><label className="pl-[3px] text-xs font-semibold leading-[1.35] text-[#34443a] lg:text-[13px]" htmlFor="password">Password</label><div className="relative w-full"><input className="h-[46px] w-full rounded-full border border-[#dfe6e0] bg-[#f8faf8] px-[18px] pr-[54px] text-sm text-[#1a2b20] outline-none transition placeholder:text-[#8c9990] hover:border-[#c5d3c7] hover:bg-white focus:border-[#26744a] focus:bg-white focus:ring-[3px] focus:ring-[#26744a]/[.12] lg:h-[52px]" id="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /><button className="absolute right-2 top-1/2 grid h-[38px] w-[38px] -translate-y-1/2 place-items-center rounded-full text-[#6a796f] transition hover:bg-[#edf3ee] hover:text-[#174d31] focus-visible:outline-2 focus-visible:outline-[#38c985] focus-visible:outline-offset-1" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
            {!signup && <div className="-mb-1 flex justify-end px-0.5 text-[13px]"><Link className="font-bold text-[#145336] underline-offset-4 hover:underline" href={`/auth/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}>Forgot password?</Link></div>}
            {error && <p className="m-0 rounded-xl bg-[#fff4f2] px-3 py-2.5 text-[13px] leading-relaxed text-[#b04437]" role="alert">{error}</p>}
            {message && <p className="m-0 rounded-xl bg-[#f0f8f1] px-3 py-2.5 text-[13px] leading-relaxed text-[#24653c]" role="status">{message}</p>}
            {needsConfirmation && <button className="justify-self-center py-1 text-xs font-bold text-[#145336] underline underline-offset-4 disabled:cursor-wait disabled:opacity-60" type="button" onClick={() => void resendConfirmation()} disabled={resending}>{resending ? 'Sending another link…' : 'Resend confirmation email'}</button>}
            <button className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#124b31] text-sm font-semibold text-white shadow-[0_5px_14px_rgba(18,75,49,.12)] transition hover:-translate-y-px hover:bg-[#0c5b38] hover:shadow-[0_8px_18px_rgba(18,75,49,.16)] disabled:cursor-wait disabled:opacity-60 lg:mt-0 lg:h-[52px]" type="submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}<ArrowRight className="hidden lg:block" size={16} /></button>
          </form>
          {googleEnabled && <><div className="my-2.5 flex items-center gap-3.5 text-xs text-[#758078] before:h-px before:flex-1 before:bg-[#e7ebe7] after:h-px after:flex-1 after:bg-[#e7ebe7]"><span>or continue with</span></div>
            <div className="grid w-full grid-cols-1 gap-2">
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#e0e6e1] bg-white px-2.5 text-[13px] font-semibold text-[#334239] transition hover:-translate-y-px hover:border-[#b9cfbd] hover:bg-[#f8faf8] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#12623f] focus-visible:outline-offset-2" type="button" onClick={() => signInWithProvider()} disabled={busy} aria-label="Continue with Google">
                <svg className="h-[18px] w-[18px] flex-none" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.23c0-.72-.06-1.25-.2-1.8H12v3.42h5.37a4.6 4.6 0 0 1-1.99 3.02v2.22h3.22c1.88-1.73 2.75-4.27 2.75-6.86Z"/><path fill="#34A853" d="M12 21.6c2.7 0 4.97-.9 6.63-2.43l-3.22-2.22c-.9.6-2.05.96-3.41.96-2.62 0-4.84-1.77-5.63-4.15H3.05v2.29A10 10 0 0 0 12 21.6Z"/><path fill="#FBBC05" d="M6.37 13.76a6 6 0 0 1 0-3.52V7.95H3.05a10 10 0 0 0 0 8.1l3.32-2.29Z"/><path fill="#EA4335" d="M12 6.1c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.96 3.1 14.7 2.2 12 2.2a10 10 0 0 0-8.95 5.75l3.32 2.29C7.16 7.87 9.38 6.1 12 6.1Z"/></svg><span>Google</span>
              </button>
            </div></>}
          <p className="mt-[14px] text-center text-xs leading-relaxed text-[#6e7a72] lg:mt-[19px] lg:text-[13px]">{signup ? 'Already have an account?' : 'New to Onselli?'} <Link className="font-bold text-[#145336] underline-offset-4 hover:underline" href={`${signup ? '/login' : '/signup'}${nextQuery}`}>{signup ? 'Log in' : 'Create an account'}</Link></p>
          <div className="mt-[13px] flex items-center justify-center gap-2 border-t border-[#ecefec] pt-2.5 text-center text-[11px] text-[#77837b] lg:mt-[22px] lg:py-[15px] lg:text-xs"><img className="h-4 w-4 rounded object-cover" src="/logo.png" alt="" aria-hidden="true" /><span>Your Onselli account, ready wherever you need it.</span></div>
        </div>
        <footer className="mt-auto flex w-full max-w-[440px] justify-center gap-5 pt-2 text-[11px] text-[#879087] lg:text-xs"><Link className="hover:text-[#185c37]" href="/legal/privacy">Privacy</Link><Link className="hover:text-[#185c37]" href="/legal/terms">Terms</Link></footer>
      </section>
    </main>
  );
}
