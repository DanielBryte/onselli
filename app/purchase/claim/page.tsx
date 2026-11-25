'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ClaimPurchasesPage() {
  const [message, setMessage] = useState('Linking your verified purchases to your Onselli account…');
  const [done, setDone] = useState(false);
  useEffect(() => {
    void fetch('/api/purchase/claim', { method: 'POST' }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setDone(true); setMessage('Your purchase history and course progress are now linked to your account.');
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'Sign in with the verified email used for your purchase.'));
  }, []);
  return <main className="min-h-screen bg-[var(--paper)]"><section className="mx-auto max-w-[620px] px-6 pt-16 pb-[88px] max-[560px]:px-[18px] max-[560px]:pb-[70px]"><span className="section-kicker">Purchase access</span><h1 className="my-[10px] text-[clamp(32px,5vw,48px)] leading-[1.05] !tracking-[-.06em]">Link purchases to your account</h1><p className="max-w-[650px] text-sm leading-[1.75] text-[var(--muted)]" role="status">{message}</p>{done && <Link className="mt-5 inline-flex items-center justify-center gap-[9px] rounded-full bg-display px-5 py-[14px] text-[13px] font-extrabold !text-white !no-underline transition-[transform,background,color] duration-[180ms] hover:-translate-y-px hover:bg-display-strong" href="/dashboard/learning">Open my library</Link>}{!done && <p className="mt-[18px]"><Link className="!text-display-strong !underline underline-offset-2" href={`/login?next=${encodeURIComponent('/purchase/claim')}`}>Sign in with the purchase email</Link></p>}</section></main>;
}
