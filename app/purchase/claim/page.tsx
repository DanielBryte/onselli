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
  return <main className="page-shell"><section className="page-content" style={{ maxWidth: 620, paddingTop: 64 }}><span className="section-kicker">Purchase access</span><h1 className="page-title">Link purchases to your account</h1><p className="page-subtitle" role="status">{message}</p>{done && <Link className="button button--mint" href="/dashboard/learning" style={{ marginTop: 20, background: '#014733', color: '#fff' }}>Open my library</Link>}{!done && <p style={{ marginTop: 18 }}><Link href={`/login?next=${encodeURIComponent('/purchase/claim')}`}>Sign in with the purchase email</Link></p>}</section></main>;
}
