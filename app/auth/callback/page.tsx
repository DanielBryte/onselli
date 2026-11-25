'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/server/auth/client';
import { getAuthErrorMessage } from '@/lib/auth-errors';
import { getSafeNextPath } from '@/lib/navigation/safe-next-path.mjs';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
      const query = new URLSearchParams(window.location.search);
      const providerError = query.get('error');
      if (providerError === 'email_not_verified') {
        setError('Google could not confirm this email address. Verify it with Google, or sign in with your email and password.');
        return;
      }
      if (providerError) { setError('Google sign-in could not be completed. Return to login and try again.'); return; }
      const { data } = await authClient.getSession();
      if (!active) return;
      if (!data?.session) { setError('This sign-in link has expired or was already used. Please sign in again.'); return; }

      const next = getSafeNextPath(query.get('next'), window.location.origin);
      // Resolve the signed-in user's role and onboarding state before choosing
      // a destination; sending every callback straight to /workspace breaks
      // buyers and users who still need onboarding.
      router.replace(next ?? '/auth/continue');
      router.refresh();
      } catch (cause) {
        if (active) setError(getAuthErrorMessage(cause, 'We couldn’t complete sign-in. Return to the login page and try again.'));
      }
    })();
    return () => { active = false; };
  }, [router]);

  return <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-12 text-center"><Link href="/" aria-label="Onselli home" className="mb-[30px] inline-flex"><img className="h-[30px] w-auto" src="/logo.png" alt="Onselli" /></Link><div className="w-full max-w-[560px]"><h1 className="mb-2 text-[clamp(26px,5vw,36px)] font-semibold tracking-[-.04em] text-ink">{error ? 'Sign-in needs another try' : 'Finishing sign-in…'}</h1><p className="m-0 text-sm leading-[1.7] text-muted">{error || 'We’re securely setting up your Onselli session.'}</p>{error && <div className="mt-6 flex flex-wrap items-center justify-center gap-5"><Link className="inline-flex min-h-11 items-center rounded-full bg-display px-5 text-sm font-semibold text-white hover:bg-brand-strong" href="/login">Back to login</Link><Link className="text-sm font-semibold text-display underline-offset-4 hover:underline" href="/signup">Create an account</Link></div>}</div></main>;
}
