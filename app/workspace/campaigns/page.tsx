'use client';

import { useEffect, useState } from 'react';
import { Mail, Send, Users } from 'lucide-react';
import CreatorNav from '../CreatorNav';

type Campaign = { id: string; name: string; subject: string; status: string; queuedCount: number; sentCount: number; deliveredCount: number; bouncedCount: number; complainedCount: number; createdAt: string };

export default function CreatorCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [credits, setCredits] = useState(0);
  const [eligibleContacts, setEligibleContacts] = useState(0);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [html, setHtml] = useState('<h1>Hello!</h1><p>Write your campaign message here.</p>');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const response = await fetch('/api/workspace/campaigns', { cache: 'no-store' });
    const data = await response.json();
    if (response.status === 402 && data.code === 'UPGRADE_REQUIRED') window.dispatchEvent(new Event('onselli:open-pricing'));
    if (!response.ok) throw new Error(data.error || 'Campaigns could not be loaded.');
    setCampaigns(data.campaigns); setCredits(data.credits); setEligibleContacts(data.eligibleContacts);
  }
  useEffect(() => { void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Campaigns could not be loaded.')); }, []);

  async function saveDraft(schedule = false) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/workspace/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, subject, previewText, html }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save this draft.');
      if (schedule) {
        const queued = await fetch(`/api/workspace/campaigns/${data.campaign.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }) });
        const queuedData = await queued.json();
        if (!queued.ok) throw new Error(queuedData.error || 'Draft saved, but the schedule could not be created.');
      }
      setName(''); setSubject(''); setPreviewText(''); setScheduledAt(''); setNotice(schedule ? 'Campaign scheduled.' : 'Draft saved.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this draft.'); }
    finally { setBusy(false); }
  }

  async function queueCampaign(campaignId: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/workspace/campaigns/${campaignId}/send`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Campaign could not be queued.');
      setNotice(`Queued for ${data.queued.toLocaleString()} consented contacts.`); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Campaign could not be queued.'); }
    finally { setBusy(false); }
  }

  return <main className="page-shell"><div className="page-content creator-workspace"><CreatorNav/><section className="creator-workspace__content">
    <div className="insight-header"><div><span className="section-kicker">Audience growth</span><h1 className="page-title">Email campaigns</h1><p className="page-subtitle">Create a broadcast for contacts who have opted in to marketing emails.</p></div></div>
    <div className="campaign-metrics"><article><span><Users size={16}/> Opted-in contacts</span><strong>{eligibleContacts.toLocaleString()}</strong></article><article><span><Mail size={16}/> Prepaid email credits</span><strong>{credits.toLocaleString()}</strong></article></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="campaign-notice" role="status">{notice}</p>}
    <div className="campaign-layout"><section className="campaign-editor"><div className="campaign-section-heading"><div><h2>New campaign</h2><p>Transactional messages stay separate from marketing broadcasts.</p></div></div>
      <label>Campaign name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="October newsletter"/></label>
      <label>Subject line<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={180} placeholder="Your subject line"/></label>
      <label>Preview text <span>Optional</span><input value={previewText} onChange={(event) => setPreviewText(event.target.value)} maxLength={240} placeholder="A short inbox preview"/></label>
      <label>Schedule send <span>Optional</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)}/></label>
      <label>Email HTML<textarea value={html} onChange={(event) => setHtml(event.target.value)} rows={11} spellCheck={false}/></label>
      <p className="campaign-helper">Onselli adds an unsubscribe link automatically and checks consent again before each send.</p>
      <div className="campaign-editor-actions"><button className="button button--primary" onClick={() => void saveDraft()} disabled={busy || !name.trim() || !subject.trim() || !html.trim()}><Mail size={16}/>{busy ? 'Saving…' : 'Save draft'}</button>{scheduledAt && <button className="button button--outline" onClick={() => void saveDraft(true)} disabled={busy || !credits || !eligibleContacts || !name.trim() || !subject.trim() || !html.trim()}><Send size={15}/>{busy ? 'Scheduling…' : 'Save & schedule'}</button>}</div>
    </section><section className="campaign-preview"><div className="campaign-section-heading"><div><h2>Preview</h2><p>Scripts are disabled in the preview.</p></div></div><iframe title="Campaign email preview" sandbox="" srcDoc={html} /></section></div>
    <section className="campaign-history"><div className="campaign-section-heading"><div><h2>Campaigns</h2><p>Only recipients with marketing consent enter the queue.</p></div></div>
      {campaigns.length ? <div className="campaign-list">{campaigns.map((campaign) => <article key={campaign.id}><div className="campaign-list-main"><strong>{campaign.name}</strong><span>{campaign.subject}</span><small>{new Date(campaign.createdAt).toLocaleDateString()}</small></div><span className={`campaign-status campaign-status--${campaign.status}`}>{campaign.status}</span><div className="campaign-result"><strong>{campaign.sentCount.toLocaleString()}</strong><small>accepted</small></div><div className="campaign-result"><strong>{campaign.deliveredCount.toLocaleString()}</strong><small>delivered</small></div><div className="campaign-result"><strong>{campaign.bouncedCount.toLocaleString()}</strong><small>bounced</small></div>{campaign.status === 'draft' && <button className="button button--outline" disabled={busy || !credits || !eligibleContacts} onClick={() => void queueCampaign(campaign.id)}><Send size={15}/> Queue send</button>}</article>)}</div> : <div className="campaign-empty"><Mail size={22}/><strong>No campaigns yet</strong><span>Save your first campaign draft above.</span></div>}
    </section>{credits === 0 && <p className="campaign-credit-help">Email uses prepaid credits so each creator’s quota cannot create an unplanned sending bill. To send your first campaign, contact <a href="mailto:support@onselli.com">Onselli support</a> to add credits.</p>}
  </section></div></main>;
}
