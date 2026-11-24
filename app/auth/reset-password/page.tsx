'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { authClient } from '@/src/server/auth/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (password !== confirm) { setError('Those passwords don’t match.'); return; }
    setBusy(true);
    try {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) { setError('This reset link is invalid or has expired. Request a new one to continue.'); return; }
      const { error: updateError } = await authClient.resetPassword({ newPassword: password, token });
      if (updateError) { setError(updateError.message || 'This password reset link has expired. Request a new one.'); return; }
      router.replace('/login');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#f7f9f7] px-5 py-[clamp(36px,10vh,100px)]"><div className="mx-auto max-w-[520px]"><Link href="/" aria-label="Onselli home" className="inline-flex"><img className="h-[30px] w-auto" src="/logo.png" alt="Onselli" /></Link><section className="mt-6 rounded-2xl border border-[#e3e9e4] bg-white p-7 shadow-[0_16px_48px_rgba(23,55,35,.07)] sm:p-9"><span className="text-xs font-bold uppercase tracking-[.12em] text-[#548064]">Account recovery</span><h1 className="mt-3 text-[clamp(30px,5vw,40px)] font-semibold leading-tight tracking-[-.04em] text-[#17261d]">Choose a new password</h1><p className="mb-6 mt-2 text-sm leading-relaxed text-[#68766e]">Use at least 8 characters and keep it somewhere safe.</p><form onSubmit={submit} className="grid gap-4"><div className="grid gap-2"><label htmlFor="new-password" className="text-sm font-semibold text-[#34443a]">New password</label><input className="h-[52px] w-full rounded-full border border-[#dfe6e0] bg-[#f8faf8] px-[18px] text-sm text-[#1a2b20] outline-none transition placeholder:text-[#8c9990] focus:border-[#26744a] focus:bg-white focus:ring-[3px] focus:ring-[#26744a]/[.12]" id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required /></div><div className="grid gap-2"><label htmlFor="confirm-password" className="text-sm font-semibold text-[#34443a]">Confirm new password</label><input className="h-[52px] w-full rounded-full border border-[#dfe6e0] bg-[#f8faf8] px-[18px] text-sm text-[#1a2b20] outline-none transition placeholder:text-[#8c9990] focus:border-[#26744a] focus:bg-white focus:ring-[3px] focus:ring-[#26744a]/[.12]" id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={event => setConfirm(event.target.value)} required /></div>{error && <p className="rounded-xl bg-[#fff4f2] p-3 text-sm leading-relaxed text-[#b04437]" role="alert">{error}</p>}<button className="mt-1 flex h-[52px] w-full items-center justify-between rounded-full bg-[#014733] px-5 text-sm font-semibold text-white transition hover:bg-[#0c5b38] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy ? 'Updating password…' : 'Save new password'} <ArrowRight size={15}/></button></form></section></div></main>;
}
