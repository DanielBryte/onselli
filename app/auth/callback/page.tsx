'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

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
      const supabase = getSupabase();
      if (!supabase) { setError('Sign-in is temporarily unavailable. Please try again later.'); return; }

      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const providerError = query.get('error_description') ?? hash.get('error_description');
      if (providerError) { setError(providerError.replaceAll('+', ' ')); return; }

      const code = query.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) { if (active) setError('This sign-in link has expired or was already used. Please request a new one.'); return; }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError || !data.session) { setError('We could not complete sign-in. Please return to the login page and try again.'); return; }

      const next = safeNext(query.get('next'));
      router.replace(next ?? '/creator');
      router.refresh();
      } catch {
        if (active) setError('We could not complete sign-in. Please return to the login page and try again.');
      }
    })();
    return () => { active = false; };
  }, [router]);

  return <main className="page-shell"><div className="page-content auth-status-page"><Link href="/" className="brand-lockup"><img src="/logo.png" alt="Onselli" /></Link><h1>{error ? 'Sign-in needs another try' : 'Finishing sign-in…'}</h1><p>{error || 'We’re securely setting up your Onselli session.'}</p>{error && <div className="auth-status-actions"><Link className="button button--mint" href="/login">Back to login</Link><Link className="text-link" href="/signup">Create an account</Link></div>}</div></main>;
}
