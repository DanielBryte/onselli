'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, CircleAlert, Clock3, X } from 'lucide-react';
import UserAvatar from '@/app/components/UserAvatar';
import PayoutControlsPanel from './PayoutControlsPanel';

type Payout = { id: string; creator_id: string; bachs_account_id: string | null; amount_minor: string; currency: string; source_amount_minor: string; source_currency: string; fee_minor: string; provider_payout_id: string | null; provider_ref: string | null; status: string; requested_at: string; updated_at: string; failure_reason: string | null; bank_snapshot: { destinationName?: string; type?: string; method?: string; currency?: string; maskedDetails?: string; exchangeRate?: string | null } | null; creators: { display_name: string; slug: string } | null };
type Pause = { reason: string; pausedAt: string; pausedBy: string };
type Controls = { global: Pause | null; accounts: Record<string, Pause>; routes: Record<string, Pause> };
type PauseTarget = { scope: 'global' } | { scope: 'account'; key: string } | { scope: 'route'; sourceCurrency: string; destinationCurrency: string; method: 'bank_transfer'|'mobile_money'|'crypto' };
type Account = { id: string; name: string; slug: string };
const money = (minor: string, currency: string) => { try { const value=BigInt(minor);const negative=value<0n;const absolute=negative?-value:value;const digits=/^(USDT|USDC)_/.test(currency)?6:new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits ?? 2;const scale=10n**BigInt(digits);const grouped=new Intl.NumberFormat('en-NG',{maximumFractionDigits:0}).format(absolute/scale);const fraction=(absolute%scale).toString().padStart(digits,'0');if(!/^[A-Z]{3}$/.test(currency))return `${currency} ${grouped}${digits?`.${fraction}`:''}`;return new Intl.NumberFormat('en-NG',{style:'currency',currency,minimumFractionDigits:digits,maximumFractionDigits:digits}).formatToParts(negative?-1:1).map(part=>part.type==='integer'?grouped:part.type==='fraction'?fraction:part.value).join('');}catch{return `${currency} ${minor}`;} };

export default function AdminPayoutsPage() {
  const [payouts,setPayouts]=useState<Payout[]>([]);
  const [creatorAccounts,setCreatorAccounts]=useState<Account[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  const [rejectId,setRejectId]=useState('');
  const [reason,setReason]=useState('');
  const [controls,setControls]=useState<Controls|null>(null);
  const [pauseTarget,setPauseTarget]=useState<PauseTarget|null>(null);
  const [pauseReason,setPauseReason]=useState('');
  const accountOptions=creatorAccounts.map(item=>({id:item.id,label:`${item.name} (@${item.slug})`,paused:Boolean(controls?.accounts[item.id]),reason:controls?.accounts[item.id]?.reason}));
  const routePairs:[string,string,'bank_transfer'|'mobile_money'|'crypto'][]=[['NGN','NGN','bank_transfer'],...['GHS','KES','TZS','UGX','GBP','EUR','USD','CAD'].map(currency=>['USD',currency,'bank_transfer'] as [string,string,'bank_transfer']),...['GHS','KES','TZS'].map(currency=>['USD',currency,'mobile_money'] as [string,string,'mobile_money']),...['USDT_TRC20','USDT_BEP20','USDT_ERC20','USDT_SOL','USDC_ERC20','USDC_BEP20','USDC_SOL','USDC_BASE'].map(currency=>['USD',currency,'crypto'] as [string,string,'crypto'])];
  const routeOptions=routePairs.map(([sourceCurrency,destinationCurrency,method])=>{const key=`${sourceCurrency}:${method}:${destinationCurrency}`;return {key,label:`${sourceCurrency} → ${destinationCurrency} · ${method.replaceAll('_',' ')}`,sourceCurrency,destinationCurrency,method,paused:Boolean(controls?.routes[key]),reason:controls?.routes[key]?.reason};});

  const load=useCallback(async()=>{
    const response=await fetch('/api/admin/payouts',{cache:'no-store'});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){setError(payload.error||'Could not load the finance queue.');setLoading(false);return;}
    const controlsResponse=await fetch('/api/admin/payout-controls',{cache:'no-store'});
    const controlsPayload=await controlsResponse.json().catch(()=>({}));
    if(!controlsResponse.ok)throw new Error(controlsPayload.error||'Could not load payout pause controls.');
    setPayouts(payload.payouts??[]);setCreatorAccounts(payload.accounts??[]);setControls(controlsPayload.controls??{global:null,accounts:{},routes:{}});setError('');setLoading(false);
  },[]);
  useEffect(()=>{void load();},[load]);

  async function decide(payout:Payout){
    setBusy(payout.id);setError('');
    try{
      const response=await fetch('/api/admin/payouts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:payout.id,approve:false,reason})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Decision could not be saved.');
      setRejectId('');setReason('');await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'Decision could not be saved.');}
    finally{setBusy('');}
  }

  async function reconcile(payout:Payout){
    setBusy(payout.id);setError('');
    try{
      const response=await fetch('/api/admin/payouts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reconcile',id:payout.id})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Could not reconcile this payout.');
      if(response.status===202)setError(payload.message||'Bachs still reports this payout as processing.');
      await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not reconcile this payout.');}
    finally{setBusy('');}
  }

  async function updatePause(target:PauseTarget, paused:boolean, pauseReasonValue=''){
    setBusy('controls');setError('');
    try{
      const response=await fetch('/api/admin/payout-controls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...target,paused,reason:paused?pauseReasonValue:undefined})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Payout controls could not be updated.');
      setPauseTarget(null);setPauseReason('');await load();
    }catch(cause){setError(cause instanceof Error?cause.message:'Payout controls could not be updated.');}
    finally{setBusy('');}
  }

  return <main className="admin-finance"><header className="admin-finance-top"><span className="admin-finance-brand"><img src="/logo.png" alt="Onselli"/> FINANCE</span><span><Clock3 size={15}/> Two-factor protected</span></header><section className="admin-finance-content"><div className="admin-finance-heading"><div><span>FINANCE OPERATIONS</span><h1>Payout operations</h1><p>Review creator requests, reconcile uncertain submissions, and pause a payout corridor during incidents.</p></div><div className="admin-finance-count">{payouts.length}<small>open requests</small></div></div>
    <section className="admin-finance-callout"><strong>{controls?.global ? 'All creator withdrawals are paused.' : 'Creator withdrawals are enabled subject to route checks.'}</strong>{controls?.global&&<p>{controls.global.reason}</p>}<button type="button" disabled={busy==='controls'||!controls} onClick={()=>controls?.global?void updatePause({scope:'global'},false):setPauseTarget({scope:'global'})}>{controls?.global?'Resume all withdrawals':'Pause all withdrawals'}</button></section>
    {pauseTarget?.scope==='global'&&<form className="admin-finance-reject" onSubmit={event=>{event.preventDefault();void updatePause(pauseTarget,true,pauseReason);}}><label htmlFor="pause-global-reason">Reason shown to creators</label><textarea id="pause-global-reason" value={pauseReason} onChange={event=>setPauseReason(event.target.value)} minLength={8} maxLength={500} required/><button type="submit" disabled={busy==='controls'}>Pause all withdrawals</button><button type="button" onClick={()=>{setPauseTarget(null);setPauseReason('');}}>Cancel</button></form>}
    <PayoutControlsPanel accounts={accountOptions} routes={routeOptions} onUpdated={load}/>
    {error&&<p className="admin-finance-error" role="alert"><CircleAlert size={17}/>{error}</p>}
    {loading?<div className="admin-finance-empty">Loading payout queue…</div>:payouts.length===0?<div className="admin-finance-empty"><span><Check size={19}/></span><strong>All caught up</strong><p>New creator requests and delayed provider payouts will appear here.</p></div>:<div className="admin-finance-list">{payouts.map(payout=><article className="admin-finance-row" key={payout.id}><UserAvatar name={payout.creators?.display_name??'Creator'} size={40} shape="square" className="admin-finance-avatar"/><div className="admin-finance-main"><strong>{payout.creators?.display_name??'Creator'}</strong><small>@{payout.creators?.slug} · Requested {new Date(payout.requested_at).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'})}</small><small>{payout.bank_snapshot?.destinationName ?? 'Payout destination'} · {payout.bank_snapshot?.type ?? 'details unavailable'} · •••• {payout.bank_snapshot?.maskedDetails?.slice(-4) ?? 'details hidden'}</small><small>Debit {money((BigInt(payout.source_amount_minor)+BigInt(payout.fee_minor)).toString(),payout.source_currency)} (fee {money(payout.fee_minor,payout.source_currency)})</small><small>Onselli ref: {payout.provider_ref ?? 'not assigned'}</small></div><strong className="admin-finance-amount">{money(payout.amount_minor,payout.currency)}</strong><span className="admin-finance-status">{payout.status}</span><div className="admin-finance-actions">{payout.status==='processing'?<button type="button" disabled={busy===payout.id||!payout.provider_ref} onClick={()=>void reconcile(payout)}><Clock3 size={15}/>{busy===payout.id?'Checking…':payout.provider_ref?'Reconcile by reference':'Manual review required'}</button>:<button type="button" className="is-reject" disabled={busy===payout.id} onClick={()=>{setRejectId(payout.id);setReason('');}}><X size={15}/>Resolve legacy request</button>}</div>{payout.failure_reason&&<small>{payout.failure_reason}</small>}{rejectId===payout.id&&<form className="admin-finance-reject" onSubmit={event=>{event.preventDefault();void decide(payout);}}><label htmlFor={`reason-${payout.id}`}>Reason for releasing this legacy request</label><textarea id={`reason-${payout.id}`} value={reason} onChange={event=>setReason(event.target.value)} minLength={8} maxLength={500} required/><button type="submit" disabled={busy===payout.id}>Record and release</button></form>}</article>)}</div>}
    <aside className="admin-finance-callout"><strong>Creator initiated withdrawals</strong><p>Creators submit normal withdrawals from Wallet. Use this queue to investigate legacy requests and reconcile uncertain or delayed Bachs payouts; do not submit creator payouts manually from the platform account.</p></aside>
  </section></main>;
}
