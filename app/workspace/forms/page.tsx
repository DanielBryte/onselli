'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, Copy, FilePlus2, Plus, Search } from 'lucide-react';
import CreatorNav from '../CreatorNav';
import type { FormField } from '@/src/server/forms/validation';

type FormRow = { id: string; title: string; slug: string; status: string; submissionsCount: number; createdAt: string; updatedAt: string };
type TemplateId = 'contact' | 'lead' | 'service' | 'event' | 'feedback';
const field = (id: string, type: FormField['type'], label: string, required = false, options?: string[]): FormField => ({ id, type, label, required, options });
const templates: { id: TemplateId; title: string; detail: string; fields: FormField[] }[] = [
  { id: 'contact', title: 'Contact us', detail: 'A simple way for customers to reach you.', fields: [field('name','short_text','Your name',true), field('email','email','Email address',true), field('message','long_text','How can we help?',true)] },
  { id: 'lead', title: 'Lead capture', detail: 'Start a conversation with a new prospect.', fields: [field('name','short_text','Your name',true), field('email','email','Work email',true), field('phone','phone','Phone number'), field('goal','long_text','What are you looking to achieve?')] },
  { id: 'service', title: 'Service request or quote', detail: 'Learn what a potential customer needs.', fields: [field('name','short_text','Your name',true), field('email','email','Email address',true), field('service','dropdown','Which service do you need?',true,['Consulting','Design','Other']), field('budget','dropdown','Estimated budget',false,['Under ₦50,000','₦50,000–₦200,000','Over ₦200,000']), field('details','long_text','Tell us about the project',true)] },
  { id: 'event', title: 'Event registration', detail: 'Collect attendee details and preferences.', fields: [field('name','short_text','Attendee name',true), field('email','email','Email address',true), field('date','date','Preferred date'), field('attendance','single_choice','How will you attend?',true,['In person','Online'])] },
  { id: 'feedback', title: 'Feedback', detail: 'Gather structured feedback from your audience.', fields: [field('email','email','Email address'), field('rating','single_choice','How was your experience?',true,['Excellent','Good','Okay','Needs improvement']), field('feedback','long_text','What could we do better?',true)] },
];
const makeSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);

export default function FormsPage() {
  const [rows, setRows] = useState<FormRow[]>([]);
  const [creatorSlug, setCreatorSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<TemplateId | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    let active = true;
    void fetch('/api/workspace/forms', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Your forms could not be loaded.');
      if (active) { setRows(data.forms); setCreatorSlug(data.creatorSlug); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Your forms could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = useMemo(() => rows.filter((row) => row.title.toLowerCase().includes(query.toLowerCase())), [rows, query]);
  async function create(template: typeof templates[number]) {
    setCreating(template.id); setError('');
    const title = template.title;
    const response = await fetch('/api/workspace/forms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, slug: makeSlug(title) + '-' + crypto.randomUUID().slice(0, 4), fields: template.fields, settings: { description: '', buttonText: 'Submit', successMessage: 'Thanks for reaching out.', notificationEmails: [], onePerEmail: false, poweredBy: true } }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || 'Could not create the form.'); setCreating(null); return; }
    window.location.assign('/workspace/forms/' + result.form.id);
  }
  async function copyLink(row: FormRow) {
    await navigator.clipboard.writeText(new URL('/c/' + creatorSlug + '/f/' + row.slug, window.location.origin).toString());
  }
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main"><header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><strong>Forms & leads</strong></div><span className="studio-account-chip"><i className="studio-account-chip__dot"/>Your lead inbox</span></header>
    <div className="creator-dashboard__body studio-overview"><header className="workspace-page-heading"><h1>Forms &amp; leads</h1><p>Collect leads and requests with forms on your store.</p></header>
      <section className="forms-templates"><div className="forms-section-heading"><div><h2>Start with a template</h2><p>Choose a form and customize the questions for your business.</p></div></div><div className="forms-template-grid">{templates.map((template) => <button key={template.id} disabled={creating !== null} onClick={() => void create(template)}><span><FilePlus2 size={17}/></span><strong>{template.title}</strong><small>{template.detail}</small><b>{creating === template.id ? 'Creating…' : 'Use template'}<ArrowRight size={14}/></b></button>)}</div></section>
      <section className="forms-list-panel"><div className="forms-section-heading"><div><h2>Your forms <span>{rows.length}</span></h2><p>Published forms collect responses on your public Onselli page.</p></div><label className="forms-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search forms"/></label></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {loading ? <div className="forms-loading">Loading your forms…</div> : visible.length ? <div className="forms-table">{visible.map((row) => <article key={row.id}><span className={'forms-status forms-status--' + row.status}>{row.status}</span><div><strong>{row.title}</strong><small>/c/{creatorSlug}/f/{row.slug}</small></div><span className="forms-response-count">{row.submissionsCount} responses</span><Link href={'/workspace/forms/' + row.id}>Edit form <ArrowRight size={14}/></Link><button aria-label="Copy form link" onClick={() => void copyLink(row)}><Copy size={15}/></button></article>)}</div> : <div className="studio-empty"><span className="studio-empty__icon"><ClipboardList size={20}/></span><strong>{query ? 'No forms match that search' : 'Your first form is ready to create'}</strong><p>Choose a template above to begin collecting leads and requests.</p>{!query && <a href="#" onClick={(event) => { event.preventDefault(); document.querySelector('.forms-templates')?.scrollIntoView({ behavior: 'smooth' }); }} className="creator-primary-action"><Plus size={15}/> Choose a template</a>}</div>}
      </section>
    </div>
  </div></main>;
}
