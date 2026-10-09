'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CircleCheck, ShieldCheck } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type ConnectStatus = 'NOT_STARTED' | 'ONBOARDING' | 'NEEDS_INFO' | 'IN_REVIEW' | 'READY' | 'RESTRICTED';
const labels: Record<ConnectStatus, string> = { NOT_STARTED: 'Not started', ONBOARDING: 'Onboarding in progress', NEEDS_INFO: 'More information required', IN_REVIEW: 'Under review', READY: 'Ready for eligible payments', RESTRICTED: 'Action required' };

export default function CreatorPayoutsPage() {
  const [country, setCountry] = useState('NG');
  const [entityType, setEntityType] = useState('individual');
  const [status, setStatus] = useState<ConnectStatus>('NOT_STARTED');
  const [requirements, setRequirements] = useState<string[]>([]);
  const [platformFeeBps, setPlatformFeeBps] = useState(1000);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; void (async () => {
    const supabase = getSupabase(); const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session) { window.location.assign('/login'); return; }
    const response = await fetch('/api/creator/connect/status', { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
    const payload = await response.json(); if (!active) return;
    if (response.ok) { setStatus(payload.status); if (payload.country) setCountry(payload.country); if (payload.entityType) setEntityType(payload.entityType); if (Number.isFinite(payload.platformFeeBps)) setPlatformFeeBps(payload.platformFeeBps); setRequirements(payload.requirements?.currently_due ?? []); }
    else if (payload.error) setError(payload.error);
    setLoading(false);
  })(); return () => { active = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const supabase = getSupabase(); const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session) { window.location.assign('/login'); return; }
    const response = await fetch('/api/creator/connect/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ country, entityType }) });
    const payload = await response.json(); setBusy(false);
    if (!response.ok) { setError(payload.error || 'Could not start creator payment setup.'); return; }
    window.location.assign(payload.onboardingUrl);
  }
  async function refresh() {
    const supabase = getSupabase(); const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session) return;
    const response = await fetch('/api/creator/connect/status', { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
    const payload = await response.json(); if (response.ok) { setStatus(payload.status); if (Number.isFinite(payload.platformFeeBps)) setPlatformFeeBps(payload.platformFeeBps); setRequirements(payload.requirements?.currently_due ?? []); } else setError(payload.error || 'Status refresh failed.');
  }
  return <main className="page-shell"><div className="page-content"><Link href="/creator" className="text-link" style={{ color: '#52645a' }}><ArrowLeft size={14}/> Back to studio</Link><div style={{ maxWidth: 720, marginTop: 30 }}><span className="section-kicker">Creator payments</span><h1 className="page-title">Get ready to earn.</h1><p className="page-subtitle">Connect your payout details securely with Bachs. Onselli never collects or stores your identity documents or bank account credentials.</p></div>{loading ? <p>Checking payment setup…</p> : <section className="form-card" style={{ maxWidth: 720, marginTop: 24 }}><p style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 800, fontSize: 13 }}><ShieldCheck size={18} color="#014733"/> {labels[status]}</p><p style={{ color: '#627168', fontSize: 12, lineHeight: 1.8 }}>Your connected creator account receives the sale directly. You remain the seller for that transaction and handle the buyer relationship and refund requests. Current Onselli platform fee: <strong>{(platformFeeBps / 100).toFixed(1)}%</strong>.</p>{status === 'READY' ? <><p className="form-success">Your connected account is ready for supported checkout currencies.</p><button className="button button--outline" onClick={refresh} style={{ marginTop: 15, color: '#014733', borderColor: '#cbd8cf' }}>Refresh status</button></> : <><p style={{ color: '#627168', fontSize: 12, lineHeight: 1.8 }}>Bachs collects your onboarding and payout information in its hosted flow. You’ll need to finish its requested steps before supported payments can be enabled.</p>{requirements.length > 0 && <div className="notice"><strong>Still needed from Bachs:</strong><ul>{requirements.map(item => <li key={item}>{item.replaceAll('.', ' · ')}</li>)}</ul></div>}<form onSubmit={submit}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}><div className="field"><label htmlFor="country">Country code (ISO 3166-1 alpha-2)</label><input id="country" value={country} onChange={event => setCountry(event.target.value.toUpperCase().slice(0, 2))} minLength={2} maxLength={2} pattern="[A-Z]{2}" required /></div><div className="field"><label htmlFor="entity">Legal account type</label><select id="entity" value={entityType} onChange={event => setEntityType(event.target.value)}><option value="individual">Individual</option><option value="company">Registered company</option></select></div></div><button className="button button--mint" type="submit" disabled={busy} style={{ width: '100%', marginTop: 20, background: '#014733', color: '#fff' }}>{busy ? 'Connecting securely…' : status === 'NOT_STARTED' ? 'Continue with Bachs' : 'Continue Bachs onboarding'} <ArrowRight size={14}/></button></form><button className="text-link" onClick={refresh} style={{ marginTop: 15, border: 0, background: 'transparent', color: '#014733' }}><CircleCheck size={14}/> I finished onboarding — refresh status</button></>}{error && <p className="form-error" role="alert">{error}</p>}<p className="notice" style={{ marginTop: 18 }}>Returning from Bachs is not proof of approval. Onselli checks your account’s verified capabilities before enabling checkout.</p></section>}</div></main>;
}
