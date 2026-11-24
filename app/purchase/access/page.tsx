'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

export default function GuestPurchaseAccessPage() {
  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'recover'>('checking');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('Verifying your secure purchase link…');
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    window.history.replaceState({}, document.title, window.location.pathname);
    if (!token) { setState('invalid'); setMessage('This link is missing or has expired. Request a fresh access email.'); return; }
    void fetch('/api/purchase/access/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setState('ready'); setMessage('Your email is verified. Your purchase access is ready.'); })
      .catch((error) => { setState('invalid'); setMessage(error instanceof Error ? error.message : 'This link could not be verified.'); });
  }, []);
  async function recover(event: FormEvent) {
    event.preventDefault(); setState('checking');
    try { await fetch('/api/purchase/access/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); }
    catch { /* Keep the response generic so recovery does not reveal whether an order exists. */ }
    setState('recover'); setMessage('If a matching paid purchase is available, we’ll send a fresh access email.');
  }
  return <main className="page-shell"><section className="page-content !max-w-[620px] !pt-16"><span className="section-kicker">Purchase access</span><h1 className="page-title">{state === 'ready' ? 'You’re all set.' : 'Open your purchase'}</h1><p className="page-subtitle" role="status">{message}</p>{state === 'ready' && <><Link className="button button--mint !mt-5 !bg-[#014733] !text-white hover:!bg-[#06683f]" href="/dashboard/learning">Open my purchases</Link><p className="mt-[18px]">Want your purchases in an Onselli account? <Link href={`/signup?next=${encodeURIComponent('/purchase/claim')}`}>Create an account</Link> using this verified email.</p></>}{(state === 'invalid' || state === 'recover') && <form onSubmit={recover} className="mt-6"><label>Email used at checkout<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full"/></label><button className="button button--mint mt-[14px]" disabled={!email.trim()}>Send a fresh access link</button></form>}</section></main>;
}
