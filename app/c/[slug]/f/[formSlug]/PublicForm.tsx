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

  return <main className="public-form-page"><header><Link href={'/c/' + creatorSlug}>{creatorName}</Link><span>Secure form</span></header><section className="public-form-card"><span className="section-kicker">{creatorName}</span><h1>{title}</h1>{config.description && <p className="public-form-description">{config.description}</p>}
    {success ? <div className="public-form-success"><CheckCircle2 size={28}/><h2>Response received</h2><p>{success}</p></div> : <form onSubmit={submit}>
      {formFields.map((field) => <label className="public-form-field" key={field.id}><span>{field.label}{field.required && <i>Required</i>}</span>{field.helpText && <small>{field.helpText}</small>}
        {field.type === 'long_text' ? <textarea required={field.required} maxLength={5000} placeholder={field.placeholder} value={String(values[field.id] ?? '')} onChange={(event) => update(field, event.target.value)}/> :
        field.type === 'dropdown' ? <select required={field.required} value={String(values[field.id] ?? '')} onChange={(event) => update(field, event.target.value)}><option value="">Select an option</option>{field.options?.map((option) => <option value={option} key={option}>{option}</option>)}</select> :
        field.type === 'single_choice' ? <span className="public-form-options">{field.options?.map((option) => <label key={option}><input type="radio" name={field.id} value={option} required={field.required} checked={values[field.id] === option} onChange={() => update(field, option)}/>{option}</label>)}</span> :
        field.type === 'multiple_choice' ? <span className="public-form-options">{field.options?.map((option) => { const selected = Array.isArray(values[field.id]) ? values[field.id] as string[] : []; return <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => update(field, event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}/>{option}</label>; })}</span> :
        <input type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} required={field.required} maxLength={500} placeholder={field.placeholder} value={String(values[field.id] ?? '')} onChange={(event) => update(field, event.target.value)}/>}
      </label>)}
      <label className="public-form-consent"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required/><span>I agree to the <Link href="/legal/terms" target="_blank">Terms</Link> and <Link href="/legal/privacy" target="_blank">Privacy Policy</Link>.</span></label>
      <label className="public-form-consent"><input type="checkbox" checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)}/><span>Send me helpful updates from {creatorName}. I can unsubscribe at any time.</span></label>
      <div className="public-form-honeypot" aria-hidden="true"><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} options={{ theme: 'light' }}/>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="creator-primary-action public-form-submit" disabled={busy || !termsAccepted}>{busy ? 'Sending…' : config.buttonText || 'Submit'}<ArrowRight size={15}/></button>
      <small className="public-form-privacy">Your information goes to {creatorName} and is handled under their privacy policy.</small>
    </form>}</section>{config.poweredBy !== false && <footer className="public-form-powered">A form by <Link href="/">Onselli</Link> · Run. Sell. Grow.</footer>}</main>;
}
