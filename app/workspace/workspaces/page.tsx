'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, LoaderCircle, Plus, X } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { PLAN_CATALOG, type PlanId } from '@/src/server/billing/plans';
import CreatorNav from '../CreatorNav';
import PricingModal from '../PricingModal';
import { useCreatorWorkspaceIdentity } from '../CreatorWorkspaceIdentity';
import { WorkspaceAvatar, WorkspaceAvatarPicker } from '@/app/components/WorkspaceAvatar';
import { workspaceAvatarPresetKey } from '@/src/shared/workspace-avatar-presets';

type WorkspaceDraft = { displayName: string; slug: string; headline: string };
const makeSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

export default function WorkspacesPage() {
  const router = useRouter();
  const { workspaces, workspaceCount, activeWorkspaceId, planId, billingEnabled } = useCreatorWorkspaceIdentity();
  const plan = PLAN_CATALOG[planId as PlanId];
  const limit = plan.maxWorkspaces;
  const [showForm, setShowForm] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [draft, setDraft] = useState<WorkspaceDraft>({ displayName: '', slug: '', headline: '' });
  const [avatarKey, setAvatarKey] = useState(workspaceAvatarPresetKey('fern'));
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [switchingId, setSwitchingId] = useState('');
  const [error, setError] = useState('');
  const atLimit = workspaceCount >= limit;

  function startCreate() {
    if (atLimit) { setPricingOpen(true); return; }
    setError(''); setShowForm(true);
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || avatarBusy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/workspace/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, avatarKey, newWorkspace: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.code === 'WORKSPACE_LIMIT') { setShowForm(false); setPricingOpen(true); return; }
        throw new Error(result.error || 'We could not create this workspace. Try again.');
      }
      window.location.assign('/workspace');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not create this workspace. Try again.'); }
    finally { setBusy(false); }
  }

  async function selectWorkspace(id: string) {
    if (id === activeWorkspaceId || switchingId) { if (id === activeWorkspaceId) router.push('/workspace'); return; }
    setSwitchingId(id); setError('');
    try {
      const response = await fetch('/api/workspace/workspaces', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: id }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We could not open this workspace. Try again.');
      window.location.assign('/workspace');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not open this workspace. Try again.'); setSwitchingId(''); }
  }

  return <main className="creator-dashboard creator-dashboard--reference"><CreatorNav/><div className="creator-dashboard__main"><header className="creator-dashboard__topbar"><div className="creator-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>Workspaces</strong></div></header><div className="creator-workspaces-page">
    <header className="creator-workspaces-header creator-workspaces-header--actions"><h1 className="sr-only">Your workspaces</h1><Button variant="primary" className="creator-workspaces-add" onClick={startCreate}><Plus size={17}/> Add workspace</Button><p className="creator-workspaces-count">{workspaceCount} of {limit} {limit === 1 ? 'workspace' : 'workspaces'} on your {plan.name} plan</p></header>
    {showForm && <section className="creator-workspace-form-card" aria-labelledby="new-workspace-title">
      <div className="creator-workspace-form-heading"><div><h2 id="new-workspace-title">Add a new workspace</h2><p>Give this brand its own storefront and dashboard.</p></div><button type="button" className="creator-workspace-close" aria-label="Cancel creating workspace" onClick={() => { setShowForm(false); setError(''); }}><X size={18}/></button></div>
      <form onSubmit={createWorkspace} className="creator-workspace-form">
        <div className="creator-workspace-avatar-field"><WorkspaceAvatarPicker value={avatarKey} previewUrl={avatarPreview} onChange={(key, url) => { setAvatarKey(key); setAvatarPreview(url); }} onBusyChange={setAvatarBusy}/></div>
        <label className="creator-workspace-field"><span>Workspace name</span><input value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value, slug: makeSlug(event.target.value) }))} required minLength={2} maxLength={100} placeholder="e.g. Northwind Studio" autoComplete="organization"/></label>
        <label className="creator-workspace-field"><span>Workspace URL</span><div className="creator-workspace-slug"><span>onselli.com/c/</span><input value={draft.slug} onChange={(event) => setDraft((current) => ({ ...current, slug: makeSlug(event.target.value) }))} required minLength={3} maxLength={30} pattern="[a-z0-9]+(-[a-z0-9]+)*"/><Check size={17}/></div><small>Letters, numbers, and dashes only.</small></label>
        <label className="creator-workspace-field"><span>Short description <em>Optional</em></span><input value={draft.headline} onChange={(event) => setDraft((current) => ({ ...current, headline: event.target.value }))} maxLength={160} placeholder="What does this brand help people do?"/></label>
        {error && <p className="creator-workspace-error" role="alert">{error}</p>}
        <div className="creator-workspace-form-actions"><Button variant="secondary" className="creator-workspace-cancel" onClick={() => setShowForm(false)}>Cancel</Button><Button variant="primary" size="md" className="creator-workspaces-add" type="submit" disabled={busy || avatarBusy}>{busy ? <><LoaderCircle size={16} className="creator-workspace-spin"/> Creating…</> : <>Create workspace <ArrowRight size={16}/></>}</Button></div>
      </form>
    </section>}
    {!showForm && error && <p className="creator-workspace-error" role="alert">{error}</p>}
    <section className="creator-workspaces-list" aria-label="Your workspaces">{workspaces.map((workspace) => <button type="button" key={workspace.id} className={`creator-workspace-row${workspace.id === activeWorkspaceId ? ' is-active' : ''}`} onClick={() => void selectWorkspace(workspace.id)} disabled={Boolean(switchingId)}>
      <WorkspaceAvatar src={workspace.logoUrl} fallbackSeed={workspace.id} className="creator-workspace-row-logo"/><span className="creator-workspace-row-copy"><strong>{workspace.displayName}{workspace.id === activeWorkspaceId && <small>Current</small>}</strong><span>onselli.com/c/{workspace.slug}</span></span><span className="creator-workspace-row-action">{switchingId === workspace.id ? <LoaderCircle size={19} className="creator-workspace-spin"/> : <ArrowRight size={19}/>}</span>
    </button>)}</section>
  </div></div><PricingModal open={pricingOpen} onOpen={() => setPricingOpen(true)} onClose={() => setPricingOpen(false)} trigger={<button className="creator-workspaces-hidden-trigger" aria-hidden="true" tabIndex={-1} type="button"/>} currentPlan={planId} billingEnabled={billingEnabled}/></main>;
}
