'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { ArrowLeft, Download, Mail, Search } from 'lucide-react';
import CreatorNav from '../../../CreatorNav';

type Submission = { id: string; status: string; data: { values?: Record<string, unknown> }; createdAt: string; contact?: { name?: string | null; email?: string | null; phoneE164?: string | null } | null };
type FormData = { id: string; title: string; fields: { id: string; label: string }[] };

export default function FormSubmissionsPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = use(params);
  const [form, setForm] = useState<FormData | null>(null);
  const [rows, setRows] = useState<Submission[]>([]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError('');
    const queryString = new URLSearchParams({ ...(status !== 'all' ? { status } : {}), ...(query ? { q: query } : {}) });
    try {
      const response = await fetch(`/api/workspace/forms/${formId}/submissions?${queryString}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load responses.');
      setForm(result.form); setRows(result.rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load responses.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [formId, status, query]);
  async function setRead(row: Submission) {
    const nextStatus = row.status === 'new' ? 'read' : 'new';
    const response = await fetch(`/api/workspace/forms/${formId}/submissions/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: nextStatus }) });
    if (response.ok) setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: nextStatus } : item));
  }
  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main"><header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace/forms">Forms & leads</Link><span>/</span><strong>Responses</strong></div><Link className="studio-account-chip" href="/workspace/forms">Back to forms</Link></header>
    <div className="creator-dashboard__body studio-overview"><div className="forms-intro"><div><span className="creator-panel-kicker">YOUR LEAD INBOX</span><h1>{form?.title ?? 'Form responses'}</h1><p>Every response, with its contact details and answers, in one place.</p></div><a className="creator-primary-action" href={`/api/workspace/forms/${formId}/submissions?format=csv`}><Download size={15}/> Export CSV</a></div>
      <section className="forms-list-panel"><div className="forms-section-heading"><div><h2>Responses <span>{rows.length}</span></h2><p>Newest submissions appear first.</p></div><div className="forms-inbox-tools"><label className="forms-search"><Search size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search responses"/></label><WorkspaceSelect value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter response status"><option value="all">All responses</option><option value="new">New</option><option value="read">Read</option><option value="archived">Archived</option></WorkspaceSelect></div></div>
        {error && <p className="form-error" role="alert">{error}</p>}{loading ? <div className="forms-loading">Loading responses…</div> : rows.length ? <div className="forms-inbox-list">{rows.map((row) => <article key={row.id} className={row.status === 'new' ? 'is-unread' : ''}><div className="forms-inbox-person"><strong>{row.contact?.name || row.contact?.email || 'New response'}</strong><small>{row.contact?.email || row.contact?.phoneE164 || 'Contact details were not provided'}</small></div><div className="forms-inbox-answers">{form?.fields.map((field) => { const value = row.data?.values?.[field.id]; return value ? <span key={field.id}><b>{field.label}</b>{Array.isArray(value) ? value.join(', ') : String(value)}</span> : null; })}</div><time>{new Date(row.createdAt).toLocaleString()}</time><div className="forms-inbox-actions">{row.contact?.email && <a href={`mailto:${row.contact.email}`} aria-label="Email contact"><Mail size={15}/></a>}<button onClick={() => void setRead(row)}>{row.status === 'new' ? 'Mark read' : 'Mark new'}</button></div></article>)}</div> : <div className="studio-empty"><strong>No responses yet</strong><p>When someone submits your published form, their answers will appear here.</p><Link href={'/workspace/forms/' + formId}><ArrowLeft size={15}/> Edit form</Link></div>}</section>
    </div></div></main>;
}
