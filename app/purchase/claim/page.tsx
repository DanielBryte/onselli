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
  return <main className="page-shell"><section className="page-content !max-w-[620px] !pt-16"><span className="section-kicker">Purchase access</span><h1 className="page-title">Link purchases to your account</h1><p className="page-subtitle" role="status">{message}</p>{done && <Link className="button button--mint !mt-5 !bg-[#014733] !text-white hover:!bg-[#06683f]" href="/dashboard/learning">Open my library</Link>}{!done && <p className="mt-[18px]"><Link href={`/login?next=${encodeURIComponent('/purchase/claim')}`}>Sign in with the purchase email</Link></p>}</section></main>;
}
