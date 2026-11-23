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

  return <main className="page-shell"><div className="page-content auth-status-page"><Link href="/" className="brand-lockup"><img src="/logo.png" alt="Onselli" /></Link><h1>{error ? 'Sign-in needs another try' : 'Finishing sign-in…'}</h1><p>{error || 'We’re securely setting up your Onselli session.'}</p>{error && <div className="auth-status-actions"><Link className="button button--mint" href="/login">Back to login</Link><Link className="text-link" href="/signup">Create an account</Link></div>}</div></main>;
}
