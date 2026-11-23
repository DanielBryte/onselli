'use client';

import { useState } from 'react';
import { CirclePause, Play } from 'lucide-react';

type Scope = 'account' | 'route';
type AccountOption = { id: string; label: string; paused: boolean; reason?: string };
type RouteOption = { key: string; label: string; sourceCurrency: string; destinationCurrency: string; method: 'bank_transfer'|'mobile_money'|'crypto'; paused: boolean; reason?: string };

export default function PayoutControlsPanel({ accounts, routes, onUpdated }: { accounts: AccountOption[]; routes: RouteOption[]; onUpdated: () => Promise<void> }) {
  const [scope, setScope] = useState<Scope>('route');
  const [accountId, setAccountId] = useState('');
  const [routeKey, setRouteKey] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedAccount = accounts.find(item => item.id === accountId);
  const selectedRoute = routes.find(item => item.key === routeKey);
  const current = scope === 'account' ? selectedAccount : selectedRoute;

  async function update(paused: boolean) {
    if (paused && reason.trim().length < 8) { setError('Add a clear reason with at least eight characters.'); return; }
    setBusy(true); setError('');
    const payload = scope === 'account'
      ? { scope, key: accountId, paused, ...(paused ? { reason: reason.trim() } : {}) }
      : selectedRoute ? { scope, sourceCurrency: selectedRoute.sourceCurrency, destinationCurrency: selectedRoute.destinationCurrency, method: selectedRoute.method, paused, ...(paused ? { reason: reason.trim() } : {}) } : null;
    if (!payload) { setError('Choose an account or payout route.'); setBusy(false); return; }
    try {
      const response = await fetch('/api/admin/payout-controls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Payout control could not be updated.');
      setReason(''); await onUpdated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Payout control could not be updated.'); }
    finally { setBusy(false); }
  }

  const targetLabel = scope === 'route' ? 'route' : 'account';
  return <section className="admin-finance-callout" aria-labelledby="payout-controls-title"><strong id="payout-controls-title">Account and route controls</strong><p>Pauses are enforced before quote and withdrawal creation, and each change is audited.</p><div className="admin-finance-actions"><label>Pause scope<select value={scope} onChange={event => setScope(event.target.value as Scope)}><option value="route">Payout route</option><option value="account">Creator account</option></select></label>{scope === 'route' ? <label>Route<select value={routeKey} onChange={event => setRouteKey(event.target.value)}><option value="">Choose a route</option>{routes.map(route => <option value={route.key} key={route.key}>{route.label}{route.paused ? ' · paused' : ''}</option>)}</select></label> : <label>Creator Bachs account<select value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">Choose an account</option>{accounts.map(account => <option value={account.id} key={account.id}>{account.label}{account.paused ? ' · paused' : ''}</option>)}</select></label>}</div>{current?.paused&&<p role="status">Currently paused: {current.reason}</p>}{current&&!current.paused&&<label>Pause reason<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={8} maxLength={500} placeholder="Describe the incident or payout restriction"/></label>}<div className="admin-finance-actions"><button type="button" disabled={busy||!current} onClick={() => void update(!current?.paused)}>{busy?'Saving…':current?.paused?<><Play size={15}/>Resume {targetLabel}</>:<><CirclePause size={15}/>Pause {targetLabel}</>}</button></div>{error&&<p className="admin-finance-error" role="alert">{error}</p>}</section>;
}
