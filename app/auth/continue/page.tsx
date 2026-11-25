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
          ? safeNext ?? '/dashboard/learning'
          : !user.onboardingCompletedAt
            ? safeNext ? `/onboarding?next=${encodeURIComponent(safeNext)}` : '/onboarding'
            : safeNext ?? '/workspace';
      router.replace(destination);
    }).catch(() => {
      if (active) setError('We could not finish signing you in. Please try again.');
    });
    return () => { active = false; };
  }, [router]);

  return <main className="grid min-h-svh place-content-center justify-items-center gap-[18px] bg-white text-center text-sm text-muted">
    <img className="h-[58px] w-[58px] object-contain" src="/logo.png" alt="Onselli" />
    {error ? <><p role="alert">{error}</p><Link className="font-semibold text-display hover:underline" href="/login">Return to sign in</Link></> : <p>Taking you to your Onselli workspace…</p>}
  </main>;
}
