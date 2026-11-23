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
  { id: 'creator', title: 'Creator', detail: 'I make content, courses, or digital products.', icon: Lightbulb, avatar: 'coral' },
  { id: 'entrepreneur', title: 'Entrepreneur', detail: 'I’m building a business and growing an audience.', icon: BriefcaseBusiness, avatar: 'fern' },
  { id: 'coach', title: 'Coach or consultant', detail: 'I help people reach a goal through my expertise.', icon: HeartHandshake, avatar: 'lilac' },
  { id: 'small_business', title: 'Small business owner', detail: 'I run a brand and want to sell online.', icon: Store, avatar: 'amber' },
  { id: 'educator', title: 'Educator', detail: 'I teach skills and want to serve learners online.', icon: GraduationCap, avatar: 'sky' },
  { id: 'service_provider', title: 'Service provider', detail: 'I work directly with clients using my expertise.', icon: CalendarDays, avatar: 'ocean' },
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
      if (user.onboardingCompletedAt) { router.replace(safeReturnPath ?? '/dashboard'); return; }
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

  if (loading) return <main className="onboarding-loading"><img src="/logo.png" alt="Onselli"/><p>Preparing your creator setup…</p></main>;

  return (
    <main className="onboarding-flow">
      <header className="onboarding-flow__top">
        <Link href="/" className="onboarding-flow__brand" aria-label="Onselli home"><img src="/logo.png" alt="Onselli"/></Link>
        <div className="onboarding-flow__progress" aria-label={`Step ${stepNumber} of 4`}>
          <span>Step {stepNumber} of 4</span>
          <div>{[0, 1, 2, 3].map((item) => <i key={item} className={item < stepNumber ? 'is-complete' : undefined}/>)}</div>
        </div>
        <a className="onboarding-flow__help" href="mailto:hello@onselli.com">Need help?</a>
      </header>

      {step === 0 && <section className="onboarding-flow__step onboarding-flow__step--roles" aria-labelledby="onboarding-title">
        <div className="onboarding-flow__heading"><span className="onboarding-flow__kicker">LET’S SET UP YOUR CREATOR SPACE</span><h1 id="onboarding-title">How will you use Onselli?</h1><p>Choose the option that fits you best. You can update your profile later.</p></div>
        <form onSubmit={continueFromRole}>
          <div className="onboarding-role-grid" role="radiogroup" aria-label="Choose your creator role" onKeyDown={handleRoleKeys}>
            {roleChoices.map(({ id, title, detail, icon: Icon, avatar }, index) => <button
              id={`onboarding-role-${id}`} key={id} type="button" role="radio" aria-checked={role === id}
              tabIndex={role === id || (!role && index === 0) ? 0 : -1}
              className={`onboarding-role-card${role === id ? ' is-selected' : ''}`}
              onClick={() => setRole(id)}
            >
              <span className={`onboarding-role-card__art onboarding-role-card__art--${id}`} aria-hidden="true"><img src={`/workspace-avatars/${avatar}.svg`} alt=""/><span className="onboarding-role-card__symbol"><Icon size={19} strokeWidth={1.9}/></span><span className="onboarding-role-card__check">{role === id ? <Check size={15}/> : null}</span></span>
              <strong>{title}</strong><small>{detail}</small>
            </button>)}
          </div>
          <FlowError error={error}/>
          <div className="onboarding-flow__actions onboarding-flow__actions--center"><button className="onboarding-flow__button onboarding-flow__button--primary" type="submit" disabled={!role || Boolean(error)}>Continue <ArrowRight size={18}/></button><span>Takes less than a minute</span></div>
        </form>
      </section>}

      {step === 1 && <section className="onboarding-flow__step onboarding-flow__step--referral" aria-labelledby="onboarding-title">
        <div className="onboarding-flow__heading"><h1 id="onboarding-title">How did you hear about us?</h1><p>It helps us reach more people like you.</p></div>
        <div className="onboarding-referral-card">
          <h2>I found Onselli through:</h2>
          <div className="onboarding-referral-options" role="radiogroup" aria-label="How you found Onselli" onKeyDown={handleReferralKeys}>
            {referralChoices.map(({ id, label, icon: Icon }, index) => <button
              id={`onboarding-source-${id}`} key={id} type="button" role="radio" aria-checked={referralSource === id}
              tabIndex={referralSource === id || (!referralSource && index === 0) ? 0 : -1}
              className={`onboarding-referral-option${referralSource === id ? ' is-selected' : ''}`}
              onClick={() => setReferralSource(id)}
            ><Icon size={19}/><span>{label}</span></button>)}
          </div>
          {referralSource === 'other' && <div className="onboarding-referral-other"><label htmlFor="onboarding-source-detail">Where did you hear about Onselli?</label><input id="onboarding-source-detail" type="text" value={referralSourceDetail} onChange={event => setReferralSourceDetail(event.target.value.slice(0, 160))} maxLength={160} autoFocus placeholder="e.g. A community, event, or website" aria-describedby="onboarding-source-detail-hint"/><small id="onboarding-source-detail-hint">A short answer is perfect.</small></div>}
          <p className="onboarding-referral-hint"><Lightbulb size={18}/>Pick the one that fits best. This only takes a second.</p>
        </div>
        <FlowError error={error}/>
        <div className="onboarding-flow__actions"><button type="button" className="onboarding-flow__button onboarding-flow__button--back" onClick={() => { setError(''); setStep(0); }}><ArrowLeft size={17}/> Back</button><div><button type="button" className="onboarding-flow__button onboarding-flow__button--primary" onClick={continueFromReferral}>Continue <ArrowRight size={18}/></button><button type="button" className="onboarding-flow__skip" onClick={() => { setError(''); setReferralSource(''); setReferralSourceDetail(''); setStep(2); }}>Skip for now</button></div></div>
      </section>}

      {step === 2 && <section className="onboarding-flow__step onboarding-flow__step--customize" aria-labelledby="onboarding-title">
        <div className="onboarding-flow__heading"><h1 id="onboarding-title">Customize your workspace</h1><p>Set up your space. You can edit your profile later.</p></div>
        <form id="onboarding-create-workspace" className="onboarding-customize-card" onSubmit={createWorkspace}>
          <WorkspaceAvatarPicker value={avatarKey} previewUrl={logoPreview} onChange={(key, url) => { setAvatarKey(key); setLogoPreview(url); }} onBusyChange={setLogoBusy} title="Workspace image" description="Choose an avatar or upload your brand logo."/>
          <div className="onboarding-field"><label htmlFor="workspace-name">Workspace name</label><input id="workspace-name" value={displayName} onChange={(event) => { const value = event.target.value; setDisplayName(value); setSlug(makeSlug(value)); setWorkspaceUrlError(''); }} autoComplete="organization" required minLength={2} maxLength={100} placeholder="e.g. Northwind Studio"/></div>
          <div className="onboarding-field"><label htmlFor="workspace-slug">Workspace URL</label><div className={`onboarding-slug${workspaceUrlError ? ' has-error' : ''}`}><span>onselli.com/c/</span><input id="workspace-slug" value={slug} onChange={(event) => { setSlug(makeSlug(event.target.value)); setWorkspaceUrlError(''); }} required minLength={3} maxLength={30} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-invalid={Boolean(workspaceUrlError)} aria-describedby={workspaceUrlError ? 'workspace-slug-help workspace-slug-error' : 'workspace-slug-help'}/>{workspaceUrlError ? <X size={18} aria-hidden="true"/> : <Check size={18} aria-hidden="true"/>}</div>{workspaceUrlError && <small id="workspace-slug-error" className="onboarding-field__error" role="alert">{workspaceUrlError}</small>}<small id="workspace-slug-help">Letters, numbers, and dashes only. This is where your storefront lives.</small></div>
          <div className="onboarding-field"><label htmlFor="creator-country">Country where your business is based</label><select id="creator-country" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} required aria-describedby="creator-country-help"><option value="">Select a country</option>{creatorCountries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}</select><small id="creator-country-help">Used to set up your creator profile and tailor the experience to your region.</small></div>
          <FlowError error={error}/>
        </form>
        <div className="onboarding-flow__actions"><button type="button" className="onboarding-flow__button onboarding-flow__button--back" onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={17}/> Back</button><button type="submit" form="onboarding-create-workspace" className="onboarding-flow__button onboarding-flow__button--primary" disabled={busy || logoBusy || displayName.trim().length < 2 || slug.length < 3 || !countryCode || Boolean(error)}>{busy ? 'Creating workspace…' : 'Create workspace'}{!busy && <ArrowRight size={18}/>}</button></div>
      </section>}

      {step === 3 && <section className="onboarding-flow__step onboarding-flow__step--complete" aria-labelledby="onboarding-title">
        <div className="onboarding-success-mark"><CheckCircle2 size={48} strokeWidth={1.7}/><span>✦</span></div>
        <div className="onboarding-flow__heading"><span className="onboarding-flow__kicker">SETUP COMPLETE</span><h1 id="onboarding-title">You’re all set!</h1><p>Your workspace is ready. Here are a few useful next steps.</p></div>
        <div className="onboarding-next-steps">
          <Link href="/workspace/products"><span>1</span><div><strong>Add your first offer</strong><small>Choose a format and set up your first product.</small></div><ArrowRight size={18}/></Link>
          <Link href="/workspace/settings/payouts"><span>2</span><div><strong>Set up payouts</strong><small>Connect your bank account when you’re ready to get paid.</small></div><Wallet size={18}/></Link>
          <Link href={`/c/${slug}`} target="_blank"><span>3</span><div><strong>Share your storefront</strong><small>Send your Onselli link to your first customers.</small></div><ArrowRight size={18}/></Link>
        </div>
        <Link href={returnPath ?? '/dashboard'} className="onboarding-flow__button onboarding-flow__button--primary onboarding-flow__dashboard">{returnPath ? 'Return to the product' : 'Go to dashboard'} <ArrowRight size={18}/></Link>
      </section>}

      <footer className="onboarding-flow__footer"><span>Run. Sell. Grow.</span><span><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link></span></footer>
    </main>
  );
}

function FlowError({ error }: { error: string }) {
  return error ? <p className="onboarding-flow__error" role="alert">{error}</p> : null;
}
