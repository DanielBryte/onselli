'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get('email') ?? '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const { error: resetError } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: '/auth/reset-password' });
      if (resetError) { setError(resetError.message || 'Could not request a reset link. Please try again.'); return; }
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the reset link. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f7f9f7] px-5 py-[clamp(36px,10vh,100px)]"><div className="mx-auto max-w-[520px]"><Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-[#145336] hover:underline"><ArrowLeft size={14}/> Back to login</Link><section className="mt-6 rounded-2xl border border-[#e3e9e4] bg-white p-7 shadow-[0_16px_48px_rgba(23,55,35,.07)] sm:p-9"><span className="text-xs font-bold uppercase tracking-[.12em] text-[#548064]">Account recovery</span><h1 className="mt-3 text-[clamp(30px,5vw,40px)] font-semibold leading-tight tracking-[-.04em] text-[#17261d]">Reset your password</h1><p className="mb-6 mt-2 text-sm leading-relaxed text-[#68766e]">Enter the email address on your Onselli account and we’ll send you a secure reset link.</p>{sent ? <p className="rounded-xl bg-[#f0f8f1] p-3 text-sm leading-relaxed text-[#24653c]" role="status">If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam folder.</p> : <form onSubmit={submit} className="grid gap-4"><div className="grid gap-2"><label htmlFor="recovery-email" className="text-sm font-semibold text-[#34443a]">Email address</label><input className="h-[52px] w-full rounded-full border border-[#dfe6e0] bg-[#f8faf8] px-[18px] text-sm text-[#1a2b20] outline-none transition placeholder:text-[#8c9990] hover:border-[#c5d3c7] focus:border-[#26744a] focus:bg-white focus:ring-[3px] focus:ring-[#26744a]/[.12]" id="recovery-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></div>{error && <p className="rounded-xl bg-[#fff4f2] p-3 text-sm leading-relaxed text-[#b04437]" role="alert">{error}</p>}<button className="mt-1 flex h-[52px] w-full items-center justify-between rounded-full bg-[#014733] px-5 text-sm font-semibold text-white transition hover:bg-[#0c5b38] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Sending link…' : 'Send reset link'} <ArrowRight size={15}/></button></form>}</section></div></main>;
}
