'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import CreatorNav from '../../CreatorNav';
import { formFieldTypes, type FormField } from '@/src/server/forms/validation';

type Settings = { description: string; buttonText: string; successMessage: string; redirectUrl?: string; notificationEmails: string[]; confirmationEmail: boolean; confirmationMessage?: string; closesAt?: string; maxSubmissions?: number; onePerEmail: boolean; poweredBy: boolean };
type EditorForm = { id: string; title: string; slug: string; status: 'draft' | 'published'; fields: FormField[]; settings: Settings; submissionsCount: number };
const fieldLabels: Record<typeof formFieldTypes[number], string> = { short_text: 'Short text', long_text: 'Long text', email: 'Email', phone: 'Phone', number: 'Number', dropdown: 'Dropdown', single_choice: 'Single choice', multiple_choice: 'Multiple choice', date: 'Date' };
const initialSettings: Settings = { description: '', buttonText: 'Submit', successMessage: 'Thanks for reaching out.', notificationEmails: [], confirmationEmail: false, onePerEmail: false, poweredBy: true };

function SortableField({ field, onChange, onRemove }: { field: FormField; onChange: (field: FormField) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .65 : 1 }} className="form-builder-field">
    <header><button type="button" {...attributes} {...listeners} aria-label={'Reorder ' + field.label}><GripVertical size={15}/></button><span>{fieldLabels[field.type]}</span><button type="button" className="form-builder-remove" aria-label="Remove field" onClick={onRemove}><Trash2 size={14}/></button></header>
    <div className="form-builder-field-grid"><label>Question<input value={field.label} maxLength={120} onChange={(event) => onChange({ ...field, label: event.target.value })}/></label><label>Placeholder<input value={field.placeholder ?? ''} maxLength={160} onChange={(event) => onChange({ ...field, placeholder: event.target.value })}/></label></div>
    <label>Help text<input value={field.helpText ?? ''} maxLength={300} onChange={(event) => onChange({ ...field, helpText: event.target.value })}/></label>
    {['dropdown','single_choice','multiple_choice'].includes(field.type) && <label>Options, separated by commas<input value={(field.options ?? []).join(', ')} onChange={(event) => onChange({ ...field, options: event.target.value.split(',').map((value) => value.trim()).filter(Boolean).slice(0,50) })}/></label>}
    <label className="form-builder-required"><input type="checkbox" checked={field.required} onChange={(event) => onChange({ ...field, required: event.target.checked })}/> Required question</label>
  </article>;
}

export default function FormEditorPage() {
  const params = useParams<{ formId: string }>();
  const [form, setForm] = useState<EditorForm | null>(null);
  const [creatorSlug, setCreatorSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newFieldType, setNewFieldType] = useState<typeof formFieldTypes[number]>('short_text');
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const load = useCallback(async () => {
    const response = await fetch('/api/workspace/forms/' + encodeURIComponent(params.formId), { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Form could not be loaded.');
    const record = result.form;
    setCreatorSlug(result.creatorSlug);
    setForm({ ...record, fields: (record.fields ?? []) as FormField[], settings: { ...initialSettings, ...(record.settings ?? {}) } });
  }, [params.formId]);
  useEffect(() => { let active = true; void load().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Form could not be loaded.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load]);
  function updateField(index: number, field: FormField) { if (!form) return; const fields = [...form.fields]; fields[index] = field; setForm({ ...form, fields }); }
  function dragEnd(event: DragEndEvent) {
    if (!form || !event.over || event.active.id === event.over.id) return;
    const from = form.fields.findIndex((field) => field.id === event.active.id);
    const to = form.fields.findIndex((field) => field.id === event.over?.id);
    if (from < 0 || to < 0) return;
    const fields = [...form.fields]; const [item] = fields.splice(from, 1); fields.splice(to, 0, item!); setForm({ ...form, fields });
  }
  function addField() {
    if (!form || form.fields.length >= 50) return;
    const id = crypto.randomUUID();
    const label = fieldLabels[newFieldType];
    setForm({ ...form, fields: [...form.fields, { id, type: newFieldType, label, required: false, ...(['dropdown','single_choice','multiple_choice'].includes(newFieldType) ? { options: ['Option 1', 'Option 2'] } : {}) }] });
  }
  async function save(status = form?.status) {
    if (!form || !status) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/workspace/forms/' + encodeURIComponent(form.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, slug: form.slug, status, fields: form.fields, settings: form.settings }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save the form.');
      setForm((current) => current ? { ...current, ...result.form, fields: result.form.fields as FormField[], settings: { ...initialSettings, ...result.form.settings } } : current);
      setNotice(status === 'published' ? 'Your form is live.' : 'Changes saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the form.'); }
    finally { setSaving(false); }
  }
  async function copyLink() { if (!form) return; await navigator.clipboard.writeText(new URL('/c/' + creatorSlug + '/f/' + form.slug, window.location.origin).toString()); setNotice('Form link copied.'); }

  return <main className="creator-dashboard"><CreatorNav/><div className="creator-dashboard__main"><header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><Link href="/workspace">Workspace</Link><span>/</span><Link href="/workspace/forms">Forms</Link><span>/</span><strong>{form?.title || 'Edit form'}</strong></div><div className="forms-editor-actions"><Link href={'/workspace/forms/' + params.formId + '/submissions'}><ClipboardList size={14}/> Submissions</Link><button onClick={() => void copyLink()} disabled={!form}><Copy size={14}/> Share</button><button onClick={() => void save('draft')} disabled={saving}><Check size={14}/> Save</button><button className="forms-editor-publish" onClick={() => void save(form?.status === 'published' ? 'draft' : 'published')} disabled={saving}>{saving ? 'Saving…' : form?.status === 'published' ? 'Unpublish' : 'Publish'}<ArrowRight size={14}/></button></div></header>
    <div className="creator-dashboard__body forms-editor-body"><Link href="/workspace/forms" className="studio-back-link"><ArrowLeft size={14}/> All forms</Link>
      {loading ? <div className="forms-loading">Loading form editor…</div> : error && !form ? <p className="form-error" role="alert">{error}</p> : form && <>
        <div className="forms-editor-intro"><h1 className="sr-only">Form builder</h1><span className={'forms-status forms-status--' + form.status}>{form.status}</span></div>
        <div className="forms-editor-layout"><section className="forms-editor-main">
          <article className="forms-builder-panel"><h2>Form details</h2><div className="forms-builder-grid"><label>Title<input value={form.title} maxLength={140} onChange={(event) => setForm({ ...form, title: event.target.value })}/></label><label>Public address<div className="forms-slug-field"><span>/c/{creatorSlug}/f/</span><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'') })}/></div></label></div><label>Description<textarea rows={3} maxLength={1000} value={form.settings.description} onChange={(event) => setForm({ ...form, settings: { ...form.settings, description: event.target.value } })}/></label></article>
          <article className="forms-builder-panel"><div className="forms-builder-title"><div><h2>Questions</h2><p>Drag to reorder · {form.fields.length}/50</p></div><div className="forms-add-field"><WorkspaceSelect aria-label="Field type" value={newFieldType} onChange={(event) => setNewFieldType(event.target.value as typeof newFieldType)}>{formFieldTypes.map((type) => <option key={type} value={type}>{fieldLabels[type]}</option>)}</WorkspaceSelect><button onClick={addField} disabled={form.fields.length >= 50}><Plus size={14}/> Add field</button></div></div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={form.fields.map((field) => field.id)} strategy={verticalListSortingStrategy}><div className="forms-builder-fields">{form.fields.map((field, index) => <SortableField key={field.id} field={field} onChange={(next) => updateField(index, next)} onRemove={() => setForm({ ...form, fields: form.fields.filter((item) => item.id !== field.id) })}/>)}</div></SortableContext></DndContext>
            {!form.fields.length && <div className="forms-no-fields"><ClipboardList size={22}/><strong>Add a question</strong><small>Start with an email field or add a short text question.</small><button onClick={addField}><Plus size={14}/> Add first field</button></div>}
          </article>
          <article className="forms-builder-panel"><h2>After submission</h2><label>Button label<input value={form.settings.buttonText} maxLength={40} onChange={(event) => setForm({ ...form, settings: { ...form.settings, buttonText: event.target.value } })}/></label><label>Success message<textarea rows={2} maxLength={500} value={form.settings.successMessage} onChange={(event) => setForm({ ...form, settings: { ...form.settings, successMessage: event.target.value } })}/></label><label>Redirect URL <span>Optional</span><input type="url" value={form.settings.redirectUrl ?? ''} onChange={(event) => setForm({ ...form, settings: { ...form.settings, redirectUrl: event.target.value || undefined } })} placeholder="https://example.com/thank-you"/></label></article>
        </section><aside className="forms-editor-sidebar">
          <article className="forms-builder-panel"><h2>Notifications</h2><label>Email addresses<textarea rows={3} value={form.settings.notificationEmails.join(', ')} onChange={(event) => setForm({ ...form, settings: { ...form.settings, notificationEmails: event.target.value.split(',').map((email) => email.trim()).filter(Boolean) } })} placeholder="you@business.com"/><small>Leave blank to use the account email.</small></label><label className="forms-toggle"><input type="checkbox" checked={form.settings.confirmationEmail} onChange={(event) => setForm({ ...form, settings: { ...form.settings, confirmationEmail: event.target.checked } })}/> Email a confirmation to the submitter</label>{form.settings.confirmationEmail && <label>Confirmation note<textarea rows={3} maxLength={500} value={form.settings.confirmationMessage ?? ''} onChange={(event) => setForm({ ...form, settings: { ...form.settings, confirmationMessage: event.target.value } })}/></label>}</article>
          <article className="forms-builder-panel"><h2>Response limits</h2><label>Close on date<input type="datetime-local" value={form.settings.closesAt ? form.settings.closesAt.slice(0,16) : ''} onChange={(event) => setForm({ ...form, settings: { ...form.settings, closesAt: event.target.value ? new Date(event.target.value).toISOString() : undefined } })}/></label><label>Maximum responses<input type="number" min="1" value={form.settings.maxSubmissions ?? ''} onChange={(event) => setForm({ ...form, settings: { ...form.settings, maxSubmissions: event.target.value ? Number(event.target.value) : undefined } })}/></label><label className="forms-toggle"><input type="checkbox" checked={form.settings.onePerEmail} onChange={(event) => setForm({ ...form, settings: { ...form.settings, onePerEmail: event.target.checked } })}/> One submission per email</label><label className="forms-toggle"><input type="checkbox" checked={form.settings.poweredBy} onChange={(event) => setForm({ ...form, settings: { ...form.settings, poweredBy: event.target.checked } })}/> Show Onselli credit</label></article>
          <article className="forms-share-card"><span className="creator-panel-kicker">PUBLIC FORM</span><strong>{form.submissionsCount} responses</strong><p>Embed-free, mobile-ready, and easy to share.</p><button onClick={() => void copyLink()}><Copy size={14}/> Copy link</button><Link href={'/workspace/forms/' + form.id + '/submissions'}>Open submissions <ArrowRight size={14}/></Link></article>
        </aside></div>
        <div className="forms-editor-footer">{error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<button onClick={() => void save(form.status)} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}<Check size={14}/></button></div>
      </>}
    </div>
  </div></main>;
}
