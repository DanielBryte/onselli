'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import type { FormField } from '@/src/server/forms/validation';

type FormSettings = { description?: string; buttonText?: string; successMessage?: string; redirectUrl?: string; poweredBy?: boolean };
export function PublicForm({ creatorSlug, creatorName, formSlug, title, fields, settings }: { creatorSlug: string; creatorName: string; formSlug: string; title: string; fields: unknown; settings: unknown }) {
  const formFields = (Array.isArray(fields) ? fields : []) as FormField[];
  const config = (settings ?? {}) as FormSettings;
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  function update(field: FormField, value: string | string[]) { setValues((current) => ({ ...current, [field.id]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const response = await fetch('/api/public/forms/' + encodeURIComponent(creatorSlug) + '/' + encodeURIComponent(formSlug), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: values, website: String(new FormData(event.currentTarget).get('website') ?? ''), termsAccepted, marketingConsent, turnstileToken, sourcePage: window.location.pathname, utm: Object.fromEntries(new URLSearchParams(window.location.search)) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Your response could not be sent.');
      if (config.redirectUrl) { window.location.assign(config.redirectUrl); return; }
      setSuccess(result.message || config.successMessage || 'Thanks for reaching out.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your response could not be sent.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[radial-gradient(ellipse_at_50%_0,#edf5eb,transparent_38%),#f7f9f6] px-[18px] pb-[38px] text-ink">
    <header className="mx-auto flex max-w-[900px] items-center justify-between py-5"><Link className="text-xs font-extrabold text-ink" href={'/c/' + creatorSlug}>{creatorName}</Link><span className="text-[9px] text-muted">Secure form</span></header>
    <section className="mx-auto mt-[35px] max-w-[650px] rounded-[17px] border border-[#e4ebe2] bg-white p-[clamp(22px,5vw,42px)] shadow-[0_22px_70px_rgba(37,66,39,0.07)]">
      <span className="section-kicker !text-display">{creatorName}</span><h1 className="my-[10px] text-[clamp(27px,5vw,40px)] font-[650] tracking-[-0.06em] text-ink">{title}</h1>{config.description && <p className="mb-[21px] text-[11px] leading-[1.75] text-muted">{config.description}</p>}
      {success ? <div className="grid justify-items-center px-[10px] py-[50px] text-center text-success"><CheckCircle2 size={28}/><h2 className="my-[15px] mb-[5px] text-xl text-ink">Response received</h2><p className="text-[11px] leading-[1.7] text-muted">{success}</p></div> : <form className="grid gap-[15px]" onSubmit={submit}>
        {formFields.map((field) => <label className="grid gap-[6px] text-[10px] font-bold text-ink-secondary" key={field.id}><span className="flex justify-between gap-[10px]">{field.label}{field.required && <i className="text-[8px] font-medium not-italic text-disabled">Required</i>}</span>{field.helpText && <small className="text-[8px] font-medium text-disabled">{field.helpText}</small>}
          {field.type === 'long_text' ? <textarea className="min-h-[105px] w-full resize-y rounded-lg border border-border bg-white px-3 py-[10px] text-[10px] font-normal leading-[1.65] text-ink outline-none focus:border-brand" required={field.required} maxLength={5000} placeholder={field.placeholder} value={String(values[field.id] ?? '')} onChange={(event) => update(field, event.target.value)}/> :
          field.type === 'dropdown' ? <select className="min-h-[43px] w-full rounded-lg border border-border bg-white px-3 py-[10px] text-[10px] font-normal text-ink outline-none focus:border-brand" required={field.required} value={String(values[field.id] ?? '')} onChange={(event) => update(field, event.target.value)}><option value="">Select an option</option>{field.options?.map((option) => <option value={option} key={option}>{option}</option>)}</select> :
          field.type === 'single_choice' ? <span className="grid gap-2 py-2">{field.options?.map((option) => <label className="flex items-start gap-2 text-[9px] font-medium leading-[1.55] text-muted" key={option}><input className="mt-px accent-brand" type="radio" name={field.id} value={option} required={field.required} checked={values[field.id] === option} onChange={() => update(field, option)}/>{option}</label>)}</span> :
          field.type === 'multiple_choice' ? <span className="grid gap-2 py-2">{field.options?.map((option) => { const selected = Array.isArray(values[field.id]) ? values[field.id] as string[] : []; return <label className="flex items-start gap-2 text-[9px] font-medium leading-[1.55] text-muted" key={option}><input className="mt-px accent-brand" type="checkbox" checked={selected.includes(option)} onChange={(event) => update(field, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}/>{option}</label>; })}</span> :
          <input className="min-h-[43px] w-full rounded-lg border border-border bg-white px-3 py-[10px] text-[10px] font-normal text-ink outline-none focus:border-brand" type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} required={field.required} maxLength={500} placeholder={field.placeholder} value={String(values[field.id] ?? '')} onChange={(event) => update(field, event.target.value)}/>}</label>)}
        <label className="flex items-start gap-2 text-[9px] font-medium leading-[1.55] text-muted"><input className="mt-px accent-brand" type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required/><span>I agree to the <Link className="text-brand underline underline-offset-2" href="/legal/terms" target="_blank">Terms</Link> and <Link className="text-brand underline underline-offset-2" href="/legal/privacy" target="_blank">Privacy Policy</Link>.</span></label>
        <label className="flex items-start gap-2 text-[9px] font-medium leading-[1.55] text-muted"><input className="mt-px accent-brand" type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)}/><span>Send me helpful updates from {creatorName}. I can unsubscribe at any time.</span></label>
        <div className="absolute left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} options={{ theme: 'light' }}/>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="creator-primary-action flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border-0 disabled:cursor-not-allowed disabled:opacity-[0.58]" disabled={busy || !termsAccepted}>{busy ? 'Sending…' : config.buttonText || 'Submit'}<ArrowRight size={15}/></button>
        <small className="text-center text-[8px] text-muted">Your information goes to {creatorName} and is handled under their privacy policy.</small>
      </form>}</section>{config.poweredBy !== false && <footer className="mt-[26px] text-center text-[8px] text-muted">A form by <Link className="font-extrabold text-brand" href="/">Onselli</Link> · Run. Sell. Grow.</footer>}</main>;
}
