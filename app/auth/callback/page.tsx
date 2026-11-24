'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/server/auth/client';

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const target = new URL(value, window.location.origin);
    return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
      const query = new URLSearchParams(window.location.search);
      const providerError = query.get('error_description');
      if (providerError) { setError(providerError.replaceAll('+', ' ')); return; }
      const { data } = await authClient.getSession();
      if (!active) return;
      if (!data?.session) { setError('This sign-in link has expired or was already used. Please sign in again.'); return; }

      const next = safeNext(query.get('next'));
      router.replace(next ?? '/workspace');
      router.refresh();
      } catch {
        if (active) setError('We could not complete sign-in. Please return to the login page and try again.');
      }
    })();
    return () => { active = false; };
  }, [router]);

  return <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f9f7] px-5 py-12 text-center"><Link href="/" aria-label="Onselli home" className="mb-[30px] inline-flex"><img className="h-[30px] w-auto" src="/logo.png" alt="Onselli" /></Link><div className="w-full max-w-[560px]"><h1 className="mb-2 text-[clamp(26px,5vw,36px)] font-semibold tracking-[-.04em] text-[#17261d]">{error ? 'Sign-in needs another try' : 'Finishing sign-in…'}</h1><p className="m-0 text-sm leading-[1.7] text-[#68766e]">{error || 'We’re securely setting up your Onselli session.'}</p>{error && <div className="mt-6 flex flex-wrap items-center justify-center gap-5"><Link className="inline-flex min-h-11 items-center rounded-full bg-[#014733] px-5 text-sm font-semibold text-white hover:bg-[#0c5b38]" href="/login">Back to login</Link><Link className="text-sm font-semibold text-[#145336] underline-offset-4 hover:underline" href="/signup">Create an account</Link></div>}</div></main>;
}
