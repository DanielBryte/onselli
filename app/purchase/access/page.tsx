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
  return <main className="min-h-screen bg-[var(--paper)]"><section className="mx-auto max-w-[620px] px-6 pt-16 pb-[88px] max-[560px]:px-[18px] max-[560px]:pb-[70px]"><span className="section-kicker">Purchase access</span><h1 className="my-[10px] text-[clamp(32px,5vw,48px)] leading-[1.05] !tracking-[-.06em]">{state === 'ready' ? 'You’re all set.' : 'Open your purchase'}</h1><p className="max-w-[650px] text-sm leading-[1.75] text-[var(--muted)]" role="status">{message}</p>{state === 'ready' && <><Link className="mt-5 inline-flex items-center justify-center gap-[9px] rounded-full bg-display px-5 py-[14px] text-[13px] font-extrabold !text-white !no-underline transition-[transform,background,color] duration-[180ms] hover:-translate-y-px hover:bg-display-strong" href="/dashboard/learning">Open my purchases</Link><p className="mt-[18px]">Want your purchases in an Onselli account? <Link className="!text-display-strong !underline underline-offset-2" href={`/signup?next=${encodeURIComponent('/purchase/claim')}`}>Create an account</Link> using this verified email.</p></>}{(state === 'invalid' || state === 'recover') && <form onSubmit={recover} className="mt-6 grid gap-3"><label className="grid gap-2 text-[13px] font-semibold text-ink-secondary">Email used at checkout<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block min-h-[46px] w-full rounded-[10px] border border-border-hover bg-white px-[13px] py-3 text-[13px] font-normal text-[var(--ink)] outline-none focus:border-brand"/></label><button className="mt-[14px] inline-flex w-fit items-center justify-center gap-[9px] rounded-full bg-mint px-5 py-[14px] text-[13px] font-extrabold text-display-dark transition-[transform,background,color] duration-[180ms] hover:-translate-y-px hover:bg-mint-hover disabled:cursor-not-allowed disabled:opacity-50" disabled={!email.trim()}>Send a fresh access link</button></form>}</section></main>;
}
