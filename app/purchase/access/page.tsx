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
  return <main className="page-shell"><section className="page-content" style={{ maxWidth: 620, paddingTop: 64 }}><span className="section-kicker">Purchase access</span><h1 className="page-title">{state === 'ready' ? 'You’re all set.' : 'Open your purchase'}</h1><p className="page-subtitle" role="status">{message}</p>{state === 'ready' && <><Link className="button button--mint" href="/dashboard/learning" style={{ marginTop: 20, background: '#014733', color: '#fff' }}>Open my purchases</Link><p style={{ marginTop: 18 }}>Want your purchases in an Onselli account? <Link href={`/signup?next=${encodeURIComponent('/purchase/claim')}`}>Create an account</Link> using this verified email.</p></>}{(state === 'invalid' || state === 'recover') && <form onSubmit={recover} style={{ marginTop: 24 }}><label>Email used at checkout<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 8 }}/></label><button className="button button--mint" disabled={!email.trim()} style={{ marginTop: 14 }}>Send a fresh access link</button></form>}</section></main>;
}
