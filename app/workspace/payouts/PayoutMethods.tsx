'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Building2, Check, LoaderCircle, Plus, ShieldCheck } from 'lucide-react';

type Destination = { id: string; name: string; type: string; currency: string; method: string; status: string; statusReason: string | null; isUsable: boolean; isDefault: boolean; maskedDetails: string | null };
type Route = { currency: string; methods: string[] };
type Bank = { name: string; code: string };
const bankCurrencies = ['NGN','GHS','KES','TZS','UGX','GBP','EUR','USD','CAD'];
const cryptoNetworks: Record<string, string> = { USDT_TRC20:'TRC20', USDT_BEP20:'BEP20', USDT_ERC20:'ERC20', USDT_SOL:'SOL', USDC_ERC20:'ERC20', USDC_BEP20:'BEP20', USDC_SOL:'SOL', USDC_BASE:'BASE' };
const localCountries: Record<string, string> = { NGN:'NG', GHS:'GH', KES:'KE', TZS:'TZ', UGX:'UG' };

export default function PayoutMethods(_props: { country: string }) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [kind, setKind] = useState<'bank_account'|'mobile_money'|'crypto_wallet'>('bank_account');
  const [currency, setCurrency] = useState('NGN');
  const [values, setValues] = useState<Record<string,string>>({});
  const [providers, setProviders] = useState<string[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const [destinationResponse, currencyResponse] = await Promise.all([
      fetch('/api/workspace/payouts/destinations', { cache: 'no-store' }),
      fetch('/api/workspace/payouts/currencies', { cache: 'no-store' }),
    ]);
    const destinationPayload = await destinationResponse.json();
    const currencyPayload = await currencyResponse.json();
    if (!destinationResponse.ok) throw new Error(destinationPayload.error || 'Could not load payout destinations.');
    if (!currencyResponse.ok) throw new Error(currencyPayload.error || 'Could not load Bachs payout routes.');
    setDestinations(destinationPayload.destinations ?? []);
    const entries = Array.isArray(currencyPayload.currencies) ? currencyPayload.currencies : [];
    const normalized = entries.map((entry: string | Record<string, unknown>) => typeof entry === 'string' ? { currency: entry, methods: [] } : ({ currency: String(entry.currency ?? entry.code ?? '').toUpperCase(), methods: Array.isArray(entry.methods) ? entry.methods.map(String) : [] })).filter((entry: Route) => entry.currency);
    setRoutes(normalized);
    if (!normalized.some((route: Route) => route.currency === currency)) setCurrency(normalized[0]?.currency ?? 'NGN');
  }, [currency]);

  useEffect(() => { let active = true; void load().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load payout settings.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [load]);

  useEffect(() => {
    if (kind !== 'mobile_money' || !['GHS','KES','TZS'].includes(currency)) { setProviders([]); return; }
    const country = currency === 'GHS' ? 'GH' : currency === 'KES' ? 'KE' : 'TZ';
    void fetch(`/api/workspace/payouts/mobile-money-providers?country_code=${country}`, { cache: 'no-store' }).then(response => response.json()).then(payload => setProviders((payload.providers ?? []).map((provider: {name:string}) => provider.name))).catch(() => setProviders([]));
  }, [kind, currency]);

  useEffect(() => {
    if (kind !== 'bank_account' || !localCountries[currency]) { setBanks([]); return; }
    let active = true;
    void fetch(`/api/workspace/payouts/banks?country_code=${localCountries[currency]}`, { cache: 'no-store' }).then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Bank directory unavailable.'); if (active) setBanks(payload.banks ?? []); }).catch(() => { if (active) setBanks([]); });
    return () => { active = false; };
  }, [kind, currency]);

  const setValue = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));
  const field = (key: string, label: string, required = true, type = 'text', placeholder?: string) => <div className="field" key={key}><label htmlFor={`payout-${key}`}>{label}</label><input id={`payout-${key}`} type={type} value={values[key] ?? ''} onChange={event => setValue(key, event.target.value)} placeholder={placeholder} required={required} autoComplete="off"/></div>;
  const selectField = (key: string, label: string, options: string[]) => <div className="field" key={key}><label htmlFor={`payout-${key}`}>{label}</label><WorkspaceSelect id={`payout-${key}`} menuClassName="workspace-select__content--payout" hideCheckmark value={values[key] ?? ''} onChange={event => setValue(key, event.target.value)} required><option value="">Choose {label.toLowerCase()}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</WorkspaceSelect></div>;
  const bankField = <div className="field" key="bank_code"><label htmlFor="payout-bank-code">Bank</label><WorkspaceSelect id="payout-bank-code" menuClassName="workspace-select__content--payout" hideCheckmark value={values.bank_code ?? ''} onChange={event => { const selected = banks.find(bank => bank.code === event.target.value); setValues(current => ({ ...current, bank_code: event.target.value, ...(selected ? { bank_name: selected.name } : {}) })); }} required><option value="">Choose bank</option>{banks.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</WorkspaceSelect>{banks.length === 0 && <small>Bachs bank list is loading or unavailable.</small>}</div>;

  async function addMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const name = values.name?.trim();
      if (!name) throw new Error('Name this payout destination.');
      let body: Record<string, unknown>;
      if (kind === 'crypto_wallet') {
        const network = cryptoNetworks[currency];
        if (!network) throw new Error('Choose a supported asset and network.');
        body = { type: kind, currency, name, network, wallet_address: values.wallet_address };
      } else if (kind === 'mobile_money') {
        const country_code = currency === 'GHS' ? 'GH' : currency === 'KES' ? 'KE' : 'TZ';
        body = { type: kind, currency, name, country_code, mobile_provider: values.mobile_provider, phone_number: values.phone_number };
      } else {
        const country_code = localCountries[currency] ?? (currency === 'GBP' ? 'GB' : currency === 'USD' ? 'US' : currency === 'CAD' ? 'CA' : values.country_code);
        body = { type: kind, currency, name, country_code, account_name: values.account_name, bank_name: values.bank_name, bank_code: values.bank_code, account_number: values.account_number, sort_code: values.sort_code, iban: values.iban, swift_bic: values.swift_bic, routing_number: values.routing_number, scheme: values.scheme, institution_number: values.institution_number, transit_number: values.transit_number, interac_email: values.interac_email, bank_address: currency === 'USD' ? { line1: values.address_line1, city: values.address_city, state: values.address_state, postal_code: values.address_postal_code, country: 'US' } : undefined };
        for (const key of Object.keys(body)) if (body[key] === '' || body[key] === undefined) delete body[key];
      }
      const response = await fetch('/api/workspace/payouts/destinations', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not add payout destination.');
      setValues({}); setNotice('Destination saved. It can receive withdrawals when Bachs marks it ready.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add payout destination.'); }
    finally { setSaving(false); }
  }

  async function setDefault(destinationId: string) {
    setUpdatingId(destinationId); setError(''); setNotice('');
    try { const response = await fetch(`/api/workspace/payouts/destinations/${encodeURIComponent(destinationId)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({isDefault:true}) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not update the default.'); setNotice('Default destination updated for this currency and method.'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the default destination.'); }
    finally { setUpdatingId(''); }
  }

  const currentRoute = routes.find(route => route.currency === currency);
  const supportedCurrencies = kind === 'crypto_wallet' ? routes.map(route => route.currency).filter(code => code in cryptoNetworks) : kind === 'mobile_money' ? routes.map(route => route.currency).filter(code => ['GHS','KES','TZS'].includes(code)) : routes.map(route => route.currency).filter(code => bankCurrencies.includes(code));
  const methods = kind === 'bank_account'
    ? currency === 'EUR' ? <>{field('account_name','Account holder name')}{field('bank_name','Bank name')}{selectField('country_code','SEPA country',['AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','LT','LU','LV','MT','NL','PT','SI','SK'])}{field('iban','IBAN')}{field('swift_bic','BIC')}</>
      : currency === 'USD' ? <>{field('account_name','Account holder name')}{field('bank_name','Bank name')}{selectField('scheme','Payout scheme',['ach','wire','rtp'])}{field('routing_number','9-digit routing number')}{field('account_number','Account number')}{field('address_line1','Bank branch street address')}{field('address_city','City')}{field('address_state','State')}{field('address_postal_code','Postal code')}</>
      : currency === 'GBP' ? <>{field('account_name','Account holder name')}{field('bank_name','Bank name')}{field('sort_code','6-digit sort code')}{field('account_number','Account number')}</>
      : currency === 'CAD' ? <>{field('account_name','Account holder name')}{field('bank_name','Bank name')}{selectField('scheme','Payout scheme',['eft','interac_account','interac_email'])}{values.scheme === 'interac_email' ? field('interac_email','Interac email',true,'email') : <>{field('institution_number','Institution number')}{field('transit_number','Transit number')}{field('account_number','Account number')}</>}</>
      : <>{field('account_name','Account holder name')}{bankField}{field('account_number','Account number')}</>
    : kind === 'mobile_money' ? <>{selectField('mobile_provider','Mobile money network',providers)}{field('phone_number','Wallet phone number with country code',true,'tel')}</>
    : <>{field('wallet_address','Wallet address')}{<p className="payout-method-form__privacy">Network: {cryptoNetworks[currency] ?? 'Choose an asset and network'}.</p>}</>;

  return <section className="payout-methods" aria-labelledby="payout-methods-title">
    <div className="payout-methods__heading"><div><h2 id="payout-methods-title">Payout destinations</h2><p>Add where you want available creator earnings sent.</p></div><ShieldCheck size={20} aria-hidden="true"/></div>
    {loading ? <p className="payout-methods__loading"><LoaderCircle size={16} className="payout-spin"/> Loading payout methods…</p> : <>
      {destinations.length > 0 && <div className="payout-method-list">{destinations.map(destination => <article className="payout-method" key={destination.id}><span className="payout-method__icon"><Building2 size={18}/></span><div className="payout-method__details"><strong>{destination.name}</strong><span>{destination.maskedDetails ?? destination.type} · {destination.currency} · {destination.method}</span><small className={destination.isUsable ? 'is-ready' : 'is-pending'}>{destination.isUsable ? 'Ready' : destination.statusReason || 'Pending approval'}{destination.isDefault ? ' · Default for this route' : ''}</small></div>{destination.isUsable && !destination.isDefault && <button className="payout-method__make-default" type="button" disabled={updatingId === destination.id} onClick={() => void setDefault(destination.id)}>{updatingId === destination.id ? 'Saving…' : 'Make default'}</button>}{destination.isDefault && <span className="payout-method__check" aria-label="Default payout method"><Check size={16}/></span>}</article>)}</div>}
      <form className="payout-method-form" onSubmit={addMethod}>
        <div className="payout-method-form__intro"><Plus size={16}/><strong>Add a payout destination</strong></div>
        <div className="payout-method-form__grid"><div className="field"><label htmlFor="payout-type">Destination type</label><WorkspaceSelect id="payout-type" menuClassName="workspace-select__content--payout" hideCheckmark value={kind} onChange={event => { setKind(event.target.value as typeof kind); setValues({}); }}><option value="bank_account">Bank account</option><option value="mobile_money">Mobile money</option><option value="crypto_wallet">Crypto wallet</option></WorkspaceSelect></div>
          <div className="field"><label htmlFor="payout-currency">Payout currency / asset</label><WorkspaceSelect id="payout-currency" menuClassName="workspace-select__content--payout" hideCheckmark value={currency} onChange={event => { setCurrency(event.target.value); setValues({}); }} required>{supportedCurrencies.map(code => <option value={code} key={code}>{code}</option>)}</WorkspaceSelect></div>
          {field('name','Name this destination')}{methods}
        </div>
        {currentRoute?.methods.length === 0 && <p className="payout-method-form__privacy">Bachs will validate this destination against the selected route when you save it.</p>}
        <p className="payout-method-form__privacy">Onselli sends payout details securely to Bachs. Never enter a password, private key, or recovery phrase.</p>
        <button className="button button--mint" type="submit" disabled={saving || !supportedCurrencies.includes(currency)} style={{background:'#014733',color:'#fff'}}>{saving ? 'Saving…' : 'Add payout destination'}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    </>}
    <p className="payout-methods__footnote">Routes depend on your country, Bachs account approval, and available source balance. Setting a default does not withdraw funds.</p>
  </section>;
}
