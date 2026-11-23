'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/src/server/auth/client';
import { getSafeNextPath } from '@/lib/navigation/safe-next-path.mjs';

export default function ContinueAuthPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void authClient.getSession().then(({ data }) => {
      if (!active) return;
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      const user = data.user as typeof data.user & { role?: string; adminRole?: string | null; onboardingCompletedAt?: Date | string | null };
      const requestedNext = new URLSearchParams(window.location.search).get('next');
      const safeNext = getSafeNextPath(requestedNext, window.location.origin);
      const destination = user.adminRole
        ? '/admin'
        : user.role === 'buyer'
          ? safeNext ?? '/discover'
          : !user.onboardingCompletedAt
            ? safeNext ? `/onboarding?next=${encodeURIComponent(safeNext)}` : '/onboarding'
            : safeNext ?? '/dashboard';
      router.replace(destination);
    }).catch(() => {
      if (active) setError('We could not finish signing you in. Please try again.');
    });
    return () => { active = false; };
  }, [router]);

  return <main className="onboarding-loading">
    <img src="/logo.png" alt="Onselli" />
    {error ? <><p role="alert">{error}</p><Link href="/login">Return to sign in</Link></> : <p>Taking you to your Onselli workspace…</p>}
  </main>;
}
