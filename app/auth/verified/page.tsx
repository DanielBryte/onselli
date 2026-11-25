'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import { getSafeNextPath } from '@/lib/navigation/safe-next-path.mjs';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import Button from '@/app/components/ui/Button';

type View = 'checking' | 'invalid' | 'resend' | 'sending' | 'sent' | 'error';

export default function VerifiedEmailPage() {
  const router = useRouter();
  const [view, setView] = useState<View>('checking');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('/onboarding');

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const requestedDestination = getSafeNextPath(query.get('next'), window.location.origin) ?? '/onboarding';
    setDestination(requestedDestination);

    if (query.has('error')) {
      setView('invalid');
      return () => { active = false; };
    }

    void authClient.getSession().then(({ data }) => {
      if (!active) return;
      if (data?.user?.emailVerified) {
        router.replace(requestedDestination);
        router.refresh();
        return;
      }
      setError('We couldn’t confirm your email yet. Sign in and request a fresh verification link.');
      setView('error');
    }).catch(() => {
      if (active) {
        setError('We couldn’t check your verification status. Sign in and request a fresh link if needed.');
        setView('error');
      }
    });

    return () => { active = false; };
  }, [router]);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setView('sending');
    try {
      const callbackURL = `/auth/verified?next=${encodeURIComponent(destination)}`;
      const { error: resendError } = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL });
      if (resendError) throw resendError;
      setView('sent');
    } catch (cause) {
      setError(getAuthErrorMessage(cause, 'We couldn’t resend the verification email. Please wait a moment and try again.'));
      setView('resend');
    }
  }

  const title = view === 'checking' ? 'Confirming your email…' : view === 'sent' ? 'Check your email' : view === 'error' ? 'Email not confirmed yet' : 'This link needs a refresh';

  return <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-12 text-center">
    <Link href="/" aria-label="Onselli home" className="mb-8 inline-flex"><img className="h-[38px] w-auto" src="/logo.png" alt="Onselli" /></Link>
    <section className="w-full max-w-[480px] rounded-2xl border border-border bg-white p-6 sm:p-9">
      <h1 className="text-[clamp(27px,5vw,36px)] font-semibold leading-tight tracking-[-.04em] text-ink">{title}</h1>
      {view === 'checking' && <p className="mt-3 text-sm leading-relaxed text-muted">We’re finishing your Onselli account setup.</p>}
      {(view === 'invalid' || view === 'error') && <>
        <p className="mt-3 text-sm leading-relaxed text-muted">{view === 'invalid' ? 'This verification link has expired, was already used, or could not be confirmed. Request a new link to continue.' : error}</p>
        <Button variant="secondary" size="sm" className="mt-5" type="button" onClick={() => { setError(''); setView('resend'); }}>Request another verification link</Button>
      </>}
      {(view === 'resend' || view === 'sending') && <form className="mt-5 grid gap-4 text-left" onSubmit={resend}>
        <p className="text-center text-sm leading-relaxed text-muted">If this address needs verification, we’ll send a fresh link.</p>
        <div className="grid gap-2"><label htmlFor="verification-email" className="text-sm font-semibold text-ink-secondary">Email address</label><input className="h-[52px] w-full rounded-full border border-border bg-canvas px-[18px] text-sm text-ink outline-none transition placeholder:text-muted focus:border-brand focus:bg-white focus:ring-[3px] focus:ring-brand/15" id="verification-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></div>
        {error && <p className="rounded-xl bg-danger-tint p-3 text-sm leading-relaxed text-danger" role="alert">{error}</p>}
        <button className="flex h-[52px] w-full items-center justify-between rounded-full bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong disabled:cursor-wait disabled:opacity-60" type="submit" disabled={view === 'sending'}>{view === 'sending' ? 'Sending link…' : 'Send verification link'} <ArrowRight size={15}/></button>
      </form>}
      {view === 'sent' && <p className="mt-3 rounded-xl bg-success-tint p-4 text-sm leading-relaxed text-success" role="status">If this address needs verification, a fresh link will arrive shortly. Check your inbox and spam folder.</p>}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2"><Link className="inline-flex min-h-8 items-center rounded-control px-3 text-sm font-semibold text-brand transition hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2" href="/login">Back to log in</Link>{view === 'sent' && <Button variant="tertiary" size="sm" className="text-brand" type="button" onClick={() => setView('resend')}>Send another link</Button>}</div>
    </section>
  </main>;
}
