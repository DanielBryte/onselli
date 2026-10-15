'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpen, Check, Download, GraduationCap, Users, Video } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

const makeSlug = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);

const offerTypes = [
  { value: 'COURSE', label: 'Course', detail: 'Teach a skill in clear, guided steps.', Icon: GraduationCap },
  { value: 'DOWNLOAD', label: 'Digital download', detail: 'Share guides, templates, or resources.', Icon: Download },
  { value: 'WORKSHOP', label: 'Workshop', detail: 'Host a live or cohort-based experience.', Icon: Video },
  { value: 'COACHING', label: 'Coaching', detail: 'Work directly with clients or students.', Icon: Users },
  { value: 'COMMUNITY', label: 'Community', detail: 'Bring your people together around a topic.', Icon: BookOpen },
] as const;

type OfferKind = typeof offerTypes[number]['value'];

export default function CreatorSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [offerKind, setOfferKind] = useState<OfferKind | ''>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) { if (active) { setError('Supabase is not configured.'); setLoading(false); } return; }
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !auth.user) { router.replace('/login'); return; }
        setUserId(auth.user.id);
        setDisplayName(auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.name ?? '');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) { router.replace('/login'); return; }
        const response = await fetch('/api/creator/setup', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) { setError(result.error ?? 'Creator setup is temporarily unavailable. Check your connection and try again.'); setLoading(false); return; }
        if (result.exists) { router.replace('/creator'); return; }
        setLoading(false);
      } catch {
        if (active) { setError('We couldn’t connect to your creator setup. Check your connection and refresh to try again.'); setLoading(false); }
      }
    };
    void load();
    return () => { active = false; };
  }, [router]);

  function nextFromIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (displayName.trim().length < 2) { setError('Enter a creator or brand name with at least 2 characters.'); return; }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2) { setError('Use at least 2 lowercase letters or numbers. You can separate words with hyphens.'); return; }
    setStep(1);
  }

  async function finishSetup(offerChoice: OfferKind | '' = offerKind) {
    if (busy) return;
    setError('');
    const supabase = getSupabase();
    if (!supabase || !userId) { setError('Your session is missing. Sign in again to continue.'); return; }
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { setError('Your session has expired. Sign in again to continue.'); return; }
      const response = await fetch('/api/creator/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, slug, headline, bio }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.field === 'slug') setStep(0);
        setError(result.error ?? 'We couldn’t save your creator page. Your answers are still here—please try again.');
        return;
      }
      if (offerChoice) router.push(`/creator/products/new?kind=${offerChoice}`);
      else router.push('/creator');
      router.refresh();
    } catch {
      setError('We couldn’t connect to save your creator page. Your answers are still here—check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  function skipIntroduction() {
    setHeadline('');
    setBio('');
    setError('');
    setStep(2);
  }

  function finishLater() {
    setOfferKind('');
    void finishSetup('');
  }

  if (loading) return <main className="creator-onboard-loading"><img src="/logo.png" alt="Onselli" /><p>Preparing your creator setup…</p></main>;

  return (
    <main className="creator-onboard">
      <section className="creator-onboard-main" aria-labelledby="creator-onboard-title">
        <header className="creator-onboard-top"><div className="creator-onboard-header-brand"><Link href="/" className="creator-onboard-brand" aria-label="Onselli home"><img src="/logo.png" alt="Onselli" /></Link><span>Creator setup</span></div><Link href="/" className="creator-onboard-exit">Exit setup</Link></header>
        <div className="creator-onboard-content">
          <div className="creator-onboard-progress" aria-label={`Step ${step + 1} of 3`}>
            <div className="creator-onboard-progress-label"><span>STEP {step + 1} OF 3</span><span>{step === 0 ? 'Your page' : step === 1 ? 'Your introduction' : 'Your first offer'}</span></div>
            <div className="creator-onboard-progress-track"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
          </div>

          {step === 0 && <form className="creator-onboard-step" onSubmit={nextFromIdentity}>
            <div className="creator-onboard-heading"><span className="creator-onboard-step-index">01</span><h2 id="creator-onboard-title">Let’s create your page.</h2><p>Start with a name and a simple address people can remember.</p></div>
            <div className="creator-onboard-fields">
              <div className="creator-onboard-field"><label htmlFor="creator-name">Creator or brand name <span>Required</span></label><input id="creator-name" value={displayName} onChange={event => { setDisplayName(event.target.value); setSlug(makeSlug(event.target.value)); }} autoComplete="organization" required minLength={2} maxLength={100} placeholder="e.g. The Creative Studio" autoFocus /></div>
              <div className="creator-onboard-field"><label htmlFor="creator-slug">Your page address <span>Required</span></label><div className="creator-onboard-slug"><span>onselli.com/c/</span><input id="creator-slug" value={slug} onChange={event => setSlug(makeSlug(event.target.value))} required minLength={2} maxLength={70} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="creator-slug-help" /></div><small id="creator-slug-help">Lowercase letters, numbers, and hyphens. You can change this later.</small></div>
            </div>
            <StepError error={error} />
            <div className="creator-onboard-actions creator-onboard-actions--end"><button className="creator-onboard-button creator-onboard-button--primary" type="submit">Continue <ArrowRight size={16} /></button></div>
          </form>}

          {step === 1 && <form className="creator-onboard-step" onSubmit={event => { event.preventDefault(); setError(''); setStep(2); }}>
            <div className="creator-onboard-heading"><span className="creator-onboard-step-index">02</span><h2 id="creator-onboard-title">Tell people what you do.</h2><p>A short introduction helps the right learners know they’re in the right place. You can skip this and add it later.</p></div>
            <div className="creator-onboard-fields">
              <div className="creator-onboard-field"><label htmlFor="creator-headline">What do you help people do? <span>Optional</span></label><input id="creator-headline" value={headline} onChange={event => setHeadline(event.target.value)} maxLength={160} placeholder="I help new founders build a clear brand" /></div>
              <div className="creator-onboard-field"><label htmlFor="creator-bio">A little about your work <span>Optional</span></label><textarea id="creator-bio" value={bio} onChange={event => setBio(event.target.value)} maxLength={1500} rows={4} placeholder="Share what you teach, who you help, and what learners can expect." /><small>{bio.length}/1,500</small></div>
            </div>
            <StepError error={error} />
            <div className="creator-onboard-actions"><button className="creator-onboard-button creator-onboard-button--back" type="button" onClick={() => { setError(''); setStep(0); }}><ArrowLeft size={16} /> Back</button><div className="creator-onboard-action-group"><button className="creator-onboard-skip" type="button" onClick={skipIntroduction}>Skip for now</button><button className="creator-onboard-button creator-onboard-button--primary" type="submit">Continue <ArrowRight size={16} /></button></div></div>
          </form>}

          {step === 2 && <div className="creator-onboard-step">
            <div className="creator-onboard-heading"><span className="creator-onboard-step-index">03</span><h2 id="creator-onboard-title">What might you share first?</h2><p>We’ll take you to the right starting point. Not sure yet? You can decide later.</p></div>
            <div className="creator-onboard-offers" role="group" aria-label="Choose your first offer type">
              {offerTypes.map(({ value, label, detail, Icon }) => <button key={value} type="button" aria-pressed={offerKind === value} className={`creator-onboard-offer${offerKind === value ? ' is-selected' : ''}`} onClick={() => setOfferKind(value)}><span className="creator-onboard-offer-icon"><Icon size={19} /></span><span className="creator-onboard-offer-copy"><strong>{label}</strong><small>{detail}</small></span><span className="creator-onboard-radio" aria-hidden="true">{offerKind === value && <Check size={13} />}</span></button>)}
            </div>
            <p className="creator-onboard-payout-note">You can set up payouts later. Bachs onboarding is required before you can collect payments.</p>
            <StepError error={error} />
            <div className="creator-onboard-actions"><button className="creator-onboard-button creator-onboard-button--back" type="button" onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={16} /> Back</button><div className="creator-onboard-action-group"><button className="creator-onboard-skip" type="button" disabled={busy} onClick={finishLater}>Skip for now</button><button className="creator-onboard-button creator-onboard-button--primary" type="button" disabled={busy} onClick={() => void finishSetup()}>{busy ? 'Saving your page…' : offerKind ? 'Create first offer' : 'Finish setup'}{!busy && <ArrowRight size={16} />}</button></div></div>
          </div>}
        </div>
        <footer className="creator-onboard-footer"><span>By continuing, you agree to Onselli’s</span><Link href="/legal/terms">Terms</Link><span>and</span><Link href="/legal/privacy">Privacy Policy</Link></footer>
      </section>
    </main>
  );
}

function StepError({ error }: { error: string }) {
  return error ? <p className="creator-onboard-error" role="alert">{error}</p> : null;
}
