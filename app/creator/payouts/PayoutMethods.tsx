'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Building2, Check, LoaderCircle, Plus, ShieldCheck } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

type Bank = { name: string; code: string };
type Destination = { id: string; name: string; type: string; currency: string; status: string; statusReason: string | null; isUsable: boolean; isDefault: boolean; bankName: string | null; maskedDetails: string | null };

export default function PayoutMethods({ country }: { country: string }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session) { window.location.assign('/login'); return; }
    const headers = { Authorization: `Bearer ${data.session.access_token}` };
    const response = await fetch('/api/creator/payouts/destinations', { headers, cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Could not load payout methods.');
    setDestinations(payload.destinations ?? []);
    if (country === 'NG') {
      const bankResponse = await fetch('/api/creator/connect/banks', { headers, cache: 'no-store' });
      const bankPayload = await bankResponse.json();
      if (!bankResponse.ok) throw new Error(bankPayload.error || 'Could not load banks.');
      setBanks(bankPayload.banks ?? []);
    }
  }, [country]);

  useEffect(() => {
    let active = true;
    void load().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load payout methods.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  async function token() {
    const supabase = getSupabase();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    return data.session?.access_token;
  }

  async function addMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Your session expired. Sign in again to continue.');
      const response = await fetch('/api/creator/payouts/destinations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ name, accountNumber, bankCode }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not add payout method.');
      setAccountNumber(''); setName(''); setBankCode('');
      setNotice(payload.destination?.isUsable ? 'Bank account added. You can now choose it as your default payout method.' : 'Bank account submitted. Bachs is reviewing it; it can be used after approval.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add payout method.'); }
    finally { setSaving(false); }
  }

  async function setDefault(destinationId: string) {
    setUpdatingId(destinationId); setError(''); setNotice('');
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error('Your session expired. Sign in again to continue.');
      const response = await fetch(`/api/creator/payouts/destinations/${encodeURIComponent(destinationId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ isDefault: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not change the default payout method.');
      setNotice('Default payout method updated.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update payout method.'); }
    finally { setUpdatingId(''); }
  }

  return <section className="payout-methods" aria-labelledby="payout-methods-title">
    <div className="payout-methods__heading"><div><h2 id="payout-methods-title">Withdrawal method</h2><p>Choose where your available creator balance should be paid out.</p></div><ShieldCheck size={20} aria-hidden="true"/></div>
    {loading ? <p className="payout-methods__loading"><LoaderCircle size={16} className="payout-spin"/> Loading your payout methods…</p> : <>
      {destinations.length > 0 && <div className="payout-method-list">{destinations.map(destination => <article className="payout-method" key={destination.id}><span className="payout-method__icon"><Building2 size={18}/></span><div className="payout-method__details"><strong>{destination.name}</strong><span>{destination.bankName ? `${destination.bankName} · ` : ''}{destination.maskedDetails ?? destination.type} · {destination.currency}</span><small className={destination.isUsable ? 'is-ready' : 'is-pending'}>{destination.isUsable ? 'Approved' : destination.statusReason || 'Pending approval'}{destination.isDefault ? ' · Default' : ''}</small></div>{destination.isUsable && !destination.isDefault && <button className="payout-method__make-default" type="button" disabled={updatingId === destination.id} onClick={() => void setDefault(destination.id)}>{updatingId === destination.id ? 'Saving…' : 'Make default'}</button>}{destination.isDefault && <span className="payout-method__check" aria-label="Default payout method"><Check size={16}/></span>}</article>)}</div>}
      {country === 'NG' ? <form className="payout-method-form" onSubmit={addMethod}><div className="payout-method-form__intro"><Plus size={16}/><strong>{destinations.length ? 'Add another bank account' : 'Add a bank account'}</strong></div><div className="payout-method-form__grid"><div className="field"><label htmlFor="payout-name">Name this method</label><input id="payout-name" value={name} onChange={event => setName(event.target.value)} placeholder="Personal account" required maxLength={100}/></div><div className="field"><label htmlFor="payout-bank">Bank</label><select id="payout-bank" value={bankCode} onChange={event => setBankCode(event.target.value)} required><option value="">Choose a bank</option>{banks.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></div><div className="field payout-method-form__account"><label htmlFor="payout-account">10-digit account number</label><input id="payout-account" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={event => setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="0123456789" minLength={10} maxLength={10} pattern="[0-9]{10}" required/></div></div><p className="payout-method-form__privacy">Your bank details are sent directly to Bachs over a secure server connection. Onselli doesn’t store the account number.</p><button className="button button--mint" type="submit" disabled={saving || !banks.length} style={{ background: '#014733', color: '#fff' }}>{saving ? 'Adding account…' : 'Add payout method'}</button></form> : <p className="payout-methods__unsupported">Payout method management for {country} isn’t available in Onselli yet. Contact support and we’ll help you set it up through Bachs.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    </>}
    <p className="payout-methods__footnote">A destination must be approved by Bachs before it can receive payouts. Setting a default doesn’t initiate a withdrawal.</p>
  </section>;
}
