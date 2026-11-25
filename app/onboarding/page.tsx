'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, AtSign, BriefcaseBusiness, CalendarDays, Camera, Check, CheckCircle2,
  GraduationCap, HeartHandshake, Lightbulb, Mail, MessageCircle, Play, Plus,
  Search, Store, UserRound, Users, Wallet, X,
} from 'lucide-react';
import { authClient } from '@/src/server/auth/client';
import { creatorCountries } from '@/src/shared/countries';
import { WorkspaceAvatarPicker } from '@/app/components/WorkspaceAvatar';
import { workspaceAvatarPresetKey } from '@/src/shared/workspace-avatar-presets';
import { getSafeNextPath } from '@/lib/navigation/safe-next-path.mjs';

const roleChoices = [
  { id: 'creator', title: 'Creator', detail: 'I make content, courses, or digital products.', icon: Lightbulb, avatar: 'coral', art: 'bg-[#f8e9e5] text-danger-strong group-aria-checked:bg-[#f9efec]' },
  { id: 'entrepreneur', title: 'Entrepreneur', detail: 'I’m building a business and growing an audience.', icon: BriefcaseBusiness, avatar: 'fern', art: 'bg-brand-tint text-brand group-aria-checked:bg-brand-tint' },
  { id: 'coach', title: 'Coach or consultant', detail: 'I help people reach a goal through my expertise.', icon: HeartHandshake, avatar: 'lilac', art: 'bg-[#f0eaf4] text-[#735785] group-aria-checked:bg-[#f3eef5]' },
  { id: 'small_business', title: 'Small business owner', detail: 'I run a brand and want to sell online.', icon: Store, avatar: 'amber', art: 'bg-[#f8f0e2] text-[#93602d] group-aria-checked:bg-[#f9f3e9]' },
  { id: 'educator', title: 'Educator', detail: 'I teach skills and want to serve learners online.', icon: GraduationCap, avatar: 'sky', art: 'bg-[#e9f0f7] text-[#416f99] group-aria-checked:bg-[#eef3f8]' },
  { id: 'service_provider', title: 'Service provider', detail: 'I work directly with clients using my expertise.', icon: CalendarDays, avatar: 'ocean', art: 'bg-[#e7f2ef] text-display group-aria-checked:bg-[#edf5f3]' },
] as const;

const referralChoices = [
  { id: 'google', label: 'Google search', icon: Search },
  { id: 'friend', label: 'Friend or colleague', icon: Users },
  { id: 'linkedin', label: 'LinkedIn', icon: AtSign },
  { id: 'instagram', label: 'Instagram', icon: Camera },
  { id: 'x', label: 'X (Twitter)', icon: AtSign },
  { id: 'youtube', label: 'YouTube', icon: Play },
  { id: 'whatsapp', label: 'WhatsApp community', icon: MessageCircle },
  { id: 'newsletter', label: 'Newsletter or podcast', icon: Mail },
  { id: 'event', label: 'Event or meetup', icon: CalendarDays },
  { id: 'other', label: 'Other', icon: Plus },
] as const;

const draftKey = 'onselli.creator-onboarding.v1';
const makeSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

type Draft = { step: number; role: string; referralSource: string; referralSourceDetail?: string; displayName: string; slug: string; countryCode: string; avatarKey?: string; logoPreview?: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralSourceDetail, setReferralSourceDetail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspaceUrlError, setWorkspaceUrlError] = useState('');
  const [slug, setSlug] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [avatarKey, setAvatarKey] = useState(workspaceAvatarPresetKey('fern'));
  const [logoPreview, setLogoPreview] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [returnPath, setReturnPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const safeReturnPath = getSafeNextPath(new URLSearchParams(window.location.search).get('next'), window.location.origin);
    setReturnPath(safeReturnPath);
    void authClient.getSession().then(({ data }) => {
      if (!active) return;
      if (!data?.user) { router.replace(`/login?next=${encodeURIComponent(safeReturnPath ?? '/onboarding')}`); return; }
      const user = data.user as typeof data.user & {
        adminRole?: string | null;
        emailVerified?: boolean;
        role?: string;
        onboardingCompletedAt?: Date | string | null;
      };
      if (user.adminRole) { router.replace('/admin'); return; }
      if (user.onboardingCompletedAt) { router.replace(safeReturnPath ?? '/workspace'); return; }
      if (user.emailVerified === false) {
        setError('Verify your email before setting up your creator workspace.');
        setLoading(false);
        return;
      }

      let restored: Draft | null = null;
      try {
        const raw = sessionStorage.getItem(draftKey);
        if (raw) restored = JSON.parse(raw) as Draft;
      } catch { /* Continue with a fresh onboarding draft if storage is unavailable. */ }
      if (restored) {
        setStep(Math.min(Math.max(restored.step || 0, 0), 2));
        setRole(restored.role || '');
        setReferralSource(restored.referralSource || '');
        setReferralSourceDetail(restored.referralSourceDetail || '');
        setDisplayName(restored.displayName || user.name || '');
        setSlug(restored.slug || makeSlug(user.name || ''));
        setCountryCode(restored.countryCode || '');
        setAvatarKey(restored.avatarKey || workspaceAvatarPresetKey('fern'));
        setLogoPreview(restored.logoPreview || '');
      } else {
        setDisplayName(user.name || '');
        setSlug(makeSlug(user.name || ''));
      }
      setDraftReady(true);
      setLoading(false);
    }).catch(() => {
      if (active) {
        setError('We could not check your sign-in. Refresh the page or sign in again to continue.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!draftReady) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify({ step, role, referralSource, referralSourceDetail, displayName, slug, countryCode, avatarKey, logoPreview } satisfies Draft)); }
    catch { /* The flow still works when browser storage is unavailable. */ }
  }, [draftReady, step, role, referralSource, referralSourceDetail, displayName, slug, countryCode, avatarKey, logoPreview]);

  function handleRoleKeys(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = roleChoices.findIndex((choice) => choice.id === role);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1 + roleChoices.length) % roleChoices.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + roleChoices.length) % roleChoices.length;
    else return;
    event.preventDefault();
    const nextRole = roleChoices[nextIndex]?.id;
    if (!nextRole) return;
    setRole(nextRole);
    document.getElementById(`onboarding-role-${nextRole}`)?.focus();
  }

  function handleReferralKeys(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = referralChoices.findIndex((choice) => choice.id === referralSource);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1 + referralChoices.length) % referralChoices.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + referralChoices.length) % referralChoices.length;
    else return;
    event.preventDefault();
    const nextSource = referralChoices[nextIndex]?.id;
    if (!nextSource) return;
    setReferralSource(nextSource);
    document.getElementById(`onboarding-source-${nextSource}`)?.focus();
  }

  function continueFromRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role) { setError('Choose the option that best describes your work.'); return; }
    setError('');
    setStep(1);
  }

  function continueFromReferral() {
    if (referralSource === 'other' && !referralSourceDetail.trim()) {
      setError('Tell us where you heard about Onselli.');
      document.getElementById('onboarding-source-detail')?.focus();
      return;
    }
    setError('');
    setStep(2);
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      if (logoBusy) throw new Error('Wait for your workspace logo to finish uploading.');
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, referralSource, referralSourceDetail: referralSource === 'other' ? referralSourceDetail : '', displayName, slug, countryCode, avatarKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.field === 'slug') {
          const message = payload.error || 'This address is already in use. Try a different one.';
          setWorkspaceUrlError(message);
          document.getElementById('workspace-slug')?.focus();
          return;
        }
        if (payload.field === 'countryCode') document.getElementById('creator-country')?.focus();
        throw new Error(payload.error || 'We could not create your workspace. Please try again.');
      }
      try { sessionStorage.removeItem(draftKey); } catch { /* Ignore unavailable storage. */ }
      setStep(3);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not create your workspace. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const stepNumber = step + 1;

  if (loading) return <main className="grid min-h-svh place-content-center justify-items-center gap-[18px] bg-white text-sm text-muted"><img className="h-[58px] w-[58px] object-contain" src="/logo.png" alt="Onselli"/><p>Preparing your creator setup…</p></main>;

  return (
    <main className="flex min-h-svh flex-col bg-white px-[clamp(20px,5vw,76px)] pt-[26px] pb-[18px] text-ink max-[600px]:px-[17px] max-[600px]:pt-4 max-[600px]:pb-[14px] motion-reduce:[&_*]:!scroll-auto motion-reduce:[&_*]:!transition-none motion-reduce:[&_*::before]:!transition-none motion-reduce:[&_*::after]:!transition-none">
      <header className="mx-auto grid min-h-14 w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-[22px] max-[600px]:grid-cols-[auto_1fr] max-[600px]:gap-3">
        <Link href="/" className="flex w-max items-center" aria-label="Onselli home"><img className="block max-h-[45px] w-[142px] object-contain object-left max-[600px]:w-[105px]" src="/logo.png" alt="Onselli"/></Link>
        <div className="flex items-center gap-5 whitespace-nowrap text-sm font-[650] text-muted max-[600px]:justify-self-end max-[600px]:gap-[9px] max-[600px]:text-[11px]" aria-label={`Step ${stepNumber} of 4`}>
          <span>Step {stepNumber} of 4</span>
          <div className="flex gap-2 max-[600px]:gap-1">{[0, 1, 2, 3].map((item) => <i key={item} className={`h-[7px] w-12 rounded-lg max-[600px]:h-[5px] max-[600px]:w-5 ${item < stepNumber ? 'bg-display' : 'bg-[#d8e1dc]'}`}/>)}</div>
        </div>
        <a className="justify-self-end text-sm font-semibold text-muted !text-muted hover:!underline hover:!underline-offset-[3px] max-[600px]:hidden" href="mailto:hello@onselli.com">Need help?</a>
      </header>

      {step === 0 && <section className="mx-auto mt-[clamp(34px,7vh,82px)] mb-9 w-full max-w-[1160px] flex-1 max-[900px]:mt-[46px] max-[600px]:mt-[34px] max-[600px]:mb-[30px]" aria-labelledby="onboarding-title">
        <div className="mb-[38px] text-center max-[600px]:mb-[25px]"><span className="mb-4 inline-block text-xs font-extrabold tracking-[.14em] text-display">LET’S SET UP YOUR CREATOR SPACE</span><h1 id="onboarding-title" className="m-0 text-[clamp(32px,4.5vw,56px)] font-[720] leading-[1.1] !tracking-[-.055em] max-[600px]:text-[34px]">How will you use Onselli?</h1><p className="mt-[14px] mb-0 text-[clamp(15px,1.8vw,20px)] leading-[1.55] text-muted max-[600px]:text-[15px]">Choose the option that fits you best. You can update your profile later.</p></div>
        <form onSubmit={continueFromRole}>
          <div className="grid grid-cols-3 gap-[18px] max-[900px]:grid-cols-2 max-[600px]:gap-[11px]" role="radiogroup" aria-label="Choose your creator role" onKeyDown={handleRoleKeys}>
            {roleChoices.map(({ id, title, detail, icon: Icon, avatar, art }, index) => <button
              id={`onboarding-role-${id}`} key={id} type="button" role="radio" aria-checked={role === id}
              tabIndex={role === id || (!role && index === 0) ? 0 : -1}
              className={`group relative flex min-h-[270px] flex-col items-stretch rounded-[20px] border bg-white p-5 text-left text-ink transition-[border-color,box-shadow,transform] duration-[160ms] hover:-translate-y-0.5 focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] max-[900px]:min-h-[235px] max-[600px]:min-h-[205px] max-[600px]:rounded-[15px] max-[600px]:p-3 ${role === id ? 'border-2 border-[#064b34] p-[19px] shadow-[0_0_0_4px_#064b3416] max-[600px]:p-[11px]' : 'border-[#dce6e0]'}`}
              onClick={() => setRole(id)}
            >
              <span className={`relative isolate mb-[18px] grid h-[120px] place-items-center overflow-hidden rounded-[14px] transition-colors duration-[180ms] before:absolute before:left-1/2 before:top-1/2 before:size-[108px] before:-translate-x-[58%] before:-translate-y-1/2 before:rounded-full before:bg-white/70 before:content-[''] max-[900px]:h-[100px] max-[600px]:mb-3 max-[600px]:h-20 ${art}`} aria-hidden="true"><img className="relative z-[1] -ml-5 block size-[76px] rounded-[19px] border-2 border-white/90 object-cover shadow-[0_3px_8px_rgba(28,56,39,.09)] transition-transform duration-[180ms] group-hover:-translate-y-0.5 max-[900px]:-ml-[17px] max-[900px]:size-[66px] max-[900px]:rounded-[17px] max-[600px]:-ml-[14px] max-[600px]:size-[54px] max-[600px]:rounded-[14px]" src={`/workspace-avatars/${avatar}.svg`} alt=""/><span className="absolute top-1/2 left-[calc(50%+12px)] z-[1] grid size-[42px] translate-y-[-34%] place-items-center rounded-[14px] border-2 border-white bg-white text-current shadow-[0_3px_10px_rgba(28,56,39,.1)] transition-transform duration-[180ms] group-hover:translate-y-[calc(-34%_-_2px)] max-[900px]:left-[calc(50%+9px)] max-[900px]:size-[38px] max-[900px]:rounded-[13px] max-[600px]:left-[calc(50%+7px)] max-[600px]:size-8 max-[600px]:rounded-[10px] max-[600px]:border"><Icon size={19} strokeWidth={1.9} className="max-[600px]:size-4"/></span><span aria-hidden="true" className={`absolute top-3 right-3 z-[2] grid size-[26px] place-items-center rounded-full border-2 max-[600px]:top-2 max-[600px]:right-2 max-[600px]:size-[22px] ${role === id ? 'border-[#064b34] bg-display text-white' : 'border-[#cbd9d1] bg-white text-transparent'}`}>{role === id ? <Check size={15} strokeWidth={3}/> : null}</span></span>
              <strong className="mb-2 text-[19px] !tracking-[-.02em] max-[600px]:text-[15px]">{title}</strong><small className="text-sm leading-[1.55] text-muted max-[600px]:text-xs">{detail}</small>
            </button>)}
          </div>
          <FlowError error={error}/>
          <div className="mx-auto mt-[34px] flex flex-col items-center justify-center gap-3 max-[600px]:mt-6"><button className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[13px] border border-transparent bg-display px-[25px] text-[15px] font-bold !text-white transition-[background,border-color,transform] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#075d40] focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-50 max-[600px]:min-h-12 max-[600px]:px-4 max-[600px]:text-[13px]" type="submit" disabled={!role || Boolean(error)}>Continue <ArrowRight size={18}/></button><span className="text-[13px] text-muted">Takes less than a minute</span></div>
        </form>
      </section>}

      {step === 1 && <section className="mx-auto mt-[clamp(34px,7vh,82px)] mb-9 w-full max-w-[760px] flex-1 max-[900px]:mt-[46px] max-[600px]:mt-[34px] max-[600px]:mb-[30px]" aria-labelledby="onboarding-title">
        <div className="mb-9 text-center max-[600px]:mb-[25px]"><h1 id="onboarding-title" className="m-0 text-[clamp(32px,4.5vw,56px)] font-[720] leading-[1.1] !tracking-[-.055em] max-[600px]:text-[34px]">How did you hear about us?</h1><p className="mt-[14px] mb-0 text-[clamp(15px,1.8vw,20px)] leading-[1.55] text-muted max-[600px]:text-[15px]">It helps us reach more people like you.</p></div>
        <div className="rounded-[22px] border border-[#e0e9e3] bg-white p-[clamp(22px,4vw,38px)] max-[600px]:rounded-[17px] max-[600px]:p-5">
          <h2 className="mb-5 mt-0 text-[17px] font-semibold !tracking-[-.025em]">I found Onselli through:</h2>
          <div className="flex flex-wrap gap-2.5 max-[600px]:gap-2" role="radiogroup" aria-label="How you found Onselli" onKeyDown={handleReferralKeys}>
            {referralChoices.map(({ id, label, icon: Icon }, index) => <button
              id={`onboarding-source-${id}`} key={id} type="button" role="radio" aria-checked={referralSource === id}
              tabIndex={referralSource === id || (!referralSource && index === 0) ? 0 : -1}
              className={`inline-flex min-h-[47px] items-center gap-2.5 rounded-xl border px-[15px] text-sm font-semibold text-ink transition-colors hover:border-[#8caf9a] focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] max-[600px]:min-h-[43px] max-[600px]:px-[11px] max-[600px]:text-xs ${referralSource === id ? 'border-[#064b34] bg-[#eaf3ee] text-display' : 'border-border bg-white'}`}
              onClick={() => setReferralSource(id)}
            ><Icon size={19}/><span>{label}</span></button>)}
          </div>
          {referralSource === 'other' && <div className="mt-5 grid gap-2 rounded-xl border border-[#e3ebe5] bg-[#fbfcfb] p-4 max-[600px]:mt-4 max-[600px]:p-[13px]"><label className="text-sm font-[650] text-ink max-[600px]:text-[13px]" htmlFor="onboarding-source-detail">Where did you hear about Onselli?</label><input className="h-12 w-full rounded-[9px] border border-border bg-white px-[13px] text-sm text-ink outline-none placeholder:text-muted focus:border-brand focus:shadow-[0_0_0_3px_#0a57381a] focus-visible:!outline-none max-[600px]:h-[46px]" id="onboarding-source-detail" type="text" value={referralSourceDetail} onChange={event => setReferralSourceDetail(event.target.value.slice(0, 160))} maxLength={160} autoFocus placeholder="e.g. A community, event, or website" aria-describedby="onboarding-source-detail-hint"/><small className="text-xs leading-[1.4] text-muted" id="onboarding-source-detail-hint">A short answer is perfect.</small></div>}
          <p className="mt-6 mb-0 flex items-center gap-2.5 border-t border-[#e7eee9] pt-5 text-[13px] text-muted max-[600px]:text-xs"><Lightbulb className="shrink-0" size={18}/>Pick the one that fits best. This only takes a second.</p>
        </div>
        <FlowError error={error}/>
        <div className="mx-auto mt-[34px] flex items-center justify-between gap-4 max-[600px]:mt-6 max-[600px]:gap-2"><button type="button" className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[13px] border border-border bg-white px-[25px] text-[15px] font-bold text-ink transition-colors hover:bg-surface-hover focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] max-[600px]:min-h-12 max-[600px]:px-4 max-[600px]:text-[13px]" onClick={() => { setError(''); setStep(0); }}><ArrowLeft size={17}/> Back</button><div className="flex items-center gap-[18px] max-[600px]:gap-[9px]"><button type="button" className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[13px] border border-transparent bg-display px-[25px] text-[15px] font-bold !text-white !no-underline transition-[background,transform] duration-150 hover:-translate-y-px hover:bg-brand-strong focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] max-[600px]:min-h-12 max-[600px]:px-4 max-[600px]:text-[13px]" onClick={continueFromReferral}>Continue <ArrowRight size={18}/></button><button type="button" className="border-0 bg-transparent text-sm font-[650] text-muted focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] max-[600px]:text-xs" onClick={() => { setError(''); setReferralSource(''); setReferralSourceDetail(''); setStep(2); }}>Skip for now</button></div></div>
      </section>}

      {step === 2 && <section className="mx-auto mt-[clamp(34px,7vh,82px)] mb-9 w-full max-w-[760px] flex-1 max-[900px]:mt-[46px] max-[600px]:mt-[34px] max-[600px]:mb-[30px]" aria-labelledby="onboarding-title">
        <div className="mb-9 text-center max-[600px]:mb-[25px]"><h1 id="onboarding-title" className="m-0 text-[clamp(32px,4.5vw,56px)] font-[720] leading-[1.1] !tracking-[-.055em] max-[600px]:text-[34px]">Customize your workspace</h1><p className="mt-[14px] mb-0 text-[clamp(15px,1.8vw,20px)] leading-[1.55] text-muted max-[600px]:text-[15px]">Set up your space. You can edit your profile later.</p></div>
        <form id="onboarding-create-workspace" className="grid gap-6 rounded-[22px] border border-[#e0e9e3] bg-white p-[clamp(22px,4vw,38px)] max-[600px]:rounded-[17px] max-[600px]:p-5" onSubmit={createWorkspace}>
          <WorkspaceAvatarPicker value={avatarKey} previewUrl={logoPreview} onChange={(key, url) => { setAvatarKey(key); setLogoPreview(url); }} onBusyChange={setLogoBusy} title="Workspace image" description="Choose an avatar or upload your brand logo."/>
          <div className="grid gap-[9px]"><label className="text-[15px] font-bold text-ink max-[600px]:text-sm" htmlFor="workspace-name">Workspace name</label><input className="h-[54px] w-full min-w-0 rounded-xl border border-border bg-white px-[15px] text-[15px] text-ink outline-none focus:border-brand focus:shadow-[0_0_0_3px_#0a57381a] focus-visible:!outline-none max-[600px]:h-12 max-[600px]:text-sm" id="workspace-name" value={displayName} onChange={(event) => { const value = event.target.value; setDisplayName(value); setSlug(makeSlug(value)); setWorkspaceUrlError(''); }} autoComplete="organization" required minLength={2} maxLength={100} placeholder="e.g. Northwind Studio"/></div>
          <div className="grid gap-[9px]"><label className="text-[15px] font-bold text-ink max-[600px]:text-sm" htmlFor="workspace-slug">Workspace URL</label><div className={`flex items-center gap-3 rounded-xl border bg-white px-[14px] focus-within:border-[#458566] focus-within:shadow-[0_0_0_3px_#0a57381a] max-[600px]:gap-2 max-[600px]:px-[10px] ${workspaceUrlError ? 'border-[#c45a50] focus-within:border-[#c45a50] focus-within:shadow-[0_0_0_3px_#c45a501a]' : 'border-border'}`}><span className="shrink-0 text-sm text-muted max-[600px]:text-[11px]">onselli.com/c/</span><input className="h-[52px] w-full min-w-0 border-0 bg-transparent p-0 text-[15px] text-ink outline-none focus:!border-0 focus:!shadow-none focus-visible:!outline-none max-[600px]:h-12 max-[600px]:text-sm" id="workspace-slug" value={slug} onChange={(event) => { setSlug(makeSlug(event.target.value)); setWorkspaceUrlError(''); }} required minLength={3} maxLength={30} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-invalid={Boolean(workspaceUrlError)} aria-describedby={workspaceUrlError ? 'workspace-slug-help workspace-slug-error' : 'workspace-slug-help'}/>{workspaceUrlError ? <X className="shrink-0 text-danger" size={18} aria-hidden="true"/> : <Check className="shrink-0 text-display" size={18} aria-hidden="true"/>}</div>{workspaceUrlError && <small id="workspace-slug-error" className="text-xs leading-[1.45] text-danger-text" role="alert">{workspaceUrlError}</small>}<small className="text-xs leading-[1.5] text-muted" id="workspace-slug-help">Letters, numbers, and dashes only. This is where your storefront lives.</small></div>
          <div className="grid gap-[9px]"><label className="text-[15px] font-bold text-ink max-[600px]:text-sm" htmlFor="creator-country">Country where your business is based</label><select className="h-[54px] w-full min-w-0 cursor-pointer rounded-xl border border-border bg-white px-[15px] text-[15px] text-ink outline-none focus:!border-[#087653] focus:!shadow-none focus-visible:!outline-none max-[600px]:h-12 max-[600px]:text-sm" id="creator-country" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} required aria-describedby="creator-country-help"><option value="">Select a country</option>{creatorCountries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select><small className="text-xs leading-[1.5] text-muted" id="creator-country-help">Used to set up your creator profile and tailor the experience to your region.</small></div>
          <FlowError error={error}/>
        </form>
        <div className="mx-auto mt-[34px] flex items-center justify-between gap-4 max-[600px]:mt-6"><button type="button" className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[13px] border border-border bg-white px-[25px] text-[15px] font-bold text-ink transition-colors hover:bg-surface-hover focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] max-[600px]:min-h-12 max-[600px]:px-4 max-[600px]:text-[13px]" onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={17}/> Back</button><button type="submit" form="onboarding-create-workspace" className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[13px] border border-transparent bg-display px-[25px] text-[15px] font-bold !text-white !no-underline transition-[background,transform] duration-150 hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#075d40] focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-50 max-[600px]:min-h-12 max-[600px]:px-4 max-[600px]:text-[13px]" disabled={busy || logoBusy || displayName.trim().length < 2 || slug.length < 3 || !countryCode || Boolean(error)}>{busy ? 'Creating workspace…' : 'Create workspace'}{!busy && <ArrowRight size={18}/>}</button></div>
      </section>}

      {step === 3 && <section className="mx-auto mt-[clamp(24px,5vh,58px)] mb-9 flex w-full max-w-[720px] flex-1 flex-col items-center max-[600px]:mt-6 max-[600px]:mb-[30px]" aria-labelledby="onboarding-title">
        <div className="relative mb-7 grid size-[150px] place-items-center rounded-full bg-brand-tint text-white before:absolute before:inset-[18px] before:rounded-full before:bg-[#cfe4d9] before:content-[''] max-[600px]:size-[118px]"><CheckCircle2 className="relative z-[1] size-[78px] rounded-full bg-display p-[14px] max-[600px]:size-[66px]" strokeWidth={1.7}/><span className="absolute top-[9px] right-0 text-[28px] text-[#e9ac37]">✦</span></div>
        <div className="mb-7 text-center"><span className="mb-4 inline-block text-xs font-extrabold tracking-[.14em] text-display">SETUP COMPLETE</span><h1 id="onboarding-title" className="m-0 text-[clamp(34px,4vw,48px)] font-[720] leading-[1.1] !tracking-[-.055em]">You’re all set!</h1><p className="mt-[14px] mb-0 text-[clamp(15px,1.8vw,20px)] leading-[1.55] text-muted max-[600px]:text-[15px]">Your workspace is ready. Here are a few useful next steps.</p></div>
        <div className="w-full rounded-[22px] border border-[#e0e9e3] bg-white px-[26px] py-3 max-[600px]:rounded-[17px] max-[600px]:px-[17px] max-[600px]:py-2">
          <Link className="grid min-h-[84px] grid-cols-[40px_1fr_22px] items-center gap-[15px] border-b border-border-subtle !text-display !no-underline last:border-b-0 hover:[&_strong]:underline hover:[&_strong]:underline-offset-[3px] max-[600px]:min-h-[78px] max-[600px]:grid-cols-[34px_1fr_18px] max-[600px]:gap-[11px]" href="/workspace/products"><span className="grid size-[38px] place-items-center rounded-full bg-brand-tint text-[15px] font-bold max-[600px]:size-8">1</span><div className="grid gap-[5px]"><strong className="text-[15px] text-ink max-[600px]:text-[13px]">Add your first offer</strong><small className="text-[13px] leading-[1.45] text-muted max-[600px]:text-[11px]">Choose a format and set up your first product.</small></div><ArrowRight size={18}/></Link>
          <Link className="grid min-h-[84px] grid-cols-[40px_1fr_22px] items-center gap-[15px] border-b border-border-subtle !text-display !no-underline last:border-b-0 hover:[&_strong]:underline hover:[&_strong]:underline-offset-[3px] max-[600px]:min-h-[78px] max-[600px]:grid-cols-[34px_1fr_18px] max-[600px]:gap-[11px]" href="/workspace/settings/payouts"><span className="grid size-[38px] place-items-center rounded-full bg-brand-tint text-[15px] font-bold max-[600px]:size-8">2</span><div className="grid gap-[5px]"><strong className="text-[15px] text-ink max-[600px]:text-[13px]">Set up payouts</strong><small className="text-[13px] leading-[1.45] text-muted max-[600px]:text-[11px]">Connect your bank account when you’re ready to get paid.</small></div><Wallet size={18}/></Link>
          <Link className="grid min-h-[84px] grid-cols-[40px_1fr_22px] items-center gap-[15px] border-b border-border-subtle !text-display !no-underline last:border-b-0 hover:[&_strong]:underline hover:[&_strong]:underline-offset-[3px] max-[600px]:min-h-[78px] max-[600px]:grid-cols-[34px_1fr_18px] max-[600px]:gap-[11px]" href={`/c/${slug}`} target="_blank"><span className="grid size-[38px] place-items-center rounded-full bg-brand-tint text-[15px] font-bold max-[600px]:size-8">3</span><div className="grid gap-[5px]"><strong className="text-[15px] text-ink max-[600px]:text-[13px]">Share your storefront</strong><small className="text-[13px] leading-[1.45] text-muted max-[600px]:text-[11px]">Send your Onselli link to your first customers.</small></div><ArrowRight size={18}/></Link>
        </div>
        <Link href={returnPath ?? '/workspace'} className="mt-[25px] inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-[13px] border border-transparent bg-display px-[25px] text-[15px] font-bold !text-white !no-underline transition-[background,transform] duration-150 hover:-translate-y-px hover:bg-brand-strong focus-visible:!outline-[3px] focus-visible:!outline-focus focus-visible:!outline-offset-[3px] max-[600px]:min-h-12 max-[600px]:px-4 max-[600px]:text-[13px]">{returnPath ? 'Return to the product' : 'Go to your workspace'} <ArrowRight size={18}/></Link>
      </section>}
    </main>
  );
}

function FlowError({ error }: { error: string }) {
  return error ? <p className="mt-4 rounded-[11px] border border-[#f0d2ce] bg-[#fff8f7] px-[14px] py-3 text-[13px] leading-[1.5] text-danger-text" role="alert">{error}</p> : null;
}
