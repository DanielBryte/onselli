'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, Check, GraduationCap, HeartHandshake, Lightbulb, LoaderCircle, Pencil, Store, X } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import Surface from '@/app/components/ui/Surface';
import { WorkspaceAvatar, WorkspaceAvatarPicker } from '@/app/components/WorkspaceAvatar';

type Profile = {
  displayName: string;
  slug: string;
  headline: string;
  bio: string;
  whatsappE164: string;
  timezone: string;
  avatarKey: string;
  avatarUrl: string | null;
  persona: string;
};
type Field = 'displayName' | 'slug' | 'headline' | 'bio' | 'whatsappE164' | 'timezone' | 'avatarKey' | 'persona';

const roleChoices = [
  { id: 'creator', title: 'Creator', detail: 'Content, courses, or digital products', icon: Lightbulb },
  { id: 'entrepreneur', title: 'Entrepreneur', detail: 'Building a business and an audience', icon: BriefcaseBusiness },
  { id: 'coach', title: 'Coach or consultant', detail: 'Helping people reach a goal', icon: HeartHandshake },
  { id: 'small_business', title: 'Small business owner', detail: 'Selling products for your brand', icon: Store },
  { id: 'educator', title: 'Educator', detail: 'Teaching and serving learners', icon: GraduationCap },
  { id: 'service_provider', title: 'Service provider', detail: 'Expertise, client services, or resources', icon: BriefcaseBusiness },
] as const;

const labels: Record<Field, string> = {
  displayName: 'Name', slug: 'Username', headline: 'What you do', bio: 'About', whatsappE164: 'WhatsApp', timezone: 'Time zone', avatarKey: 'Profile image', persona: 'Role',
};

export default function ProfileSettings({ initialProfile, email, googleConnected }: { initialProfile: Profile; email: string; googleConnected: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState('');
  const [avatarDraft, setAvatarDraft] = useState({ key: '', url: '' });
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function begin(field: Field) {
    setError(''); setNotice(''); setEditing(field);
    if (field === 'avatarKey') setAvatarDraft({ key: profile.avatarKey, url: profile.avatarUrl ?? '' });
    else setDraft(profile[field]);
  }

  function cancel() { setEditing(null); setError(''); }

  async function save(field: Field) {
    if (busy) return;
    const value = field === 'avatarKey' ? avatarDraft.key : draft;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/workspace/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, value }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not save this change.');
      setProfile(current => ({ ...current, [field]: result.value ?? value, ...(field === 'avatarKey' ? { avatarUrl: result.avatarUrl ?? null } : {}) }));
      setEditing(null); setNotice(`${labels[field]} saved.`);
      if (field === 'slug' || field === 'displayName' || field === 'avatarKey') router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this change.'); }
    finally { setBusy(false); }
  }

  function fieldValue(field: Field) {
    if (field === 'slug') return `onselli.com/c/${profile.slug}`;
    if (field === 'avatarKey') return <WorkspaceAvatar src={profile.avatarUrl} fallbackSeed={profile.slug} className="profile-settings-avatar"/>;
    if (field === 'persona') {
      const choice = roleChoices.find(item => item.id === profile.persona);
      if (!choice) return 'Choose a role';
      const Icon = choice.icon;
      return <span className="profile-settings-role-value"><span className={`profile-settings-role-icon profile-settings-role-icon--${choice.id}`}><Icon size={17} strokeWidth={1.9}/></span><span>{choice.title}</span></span>;
    }
    return profile[field] || '—';
  }

  function editor(field: Field) {
    if (field === 'avatarKey') return <div className="profile-settings-avatar-editor"><WorkspaceAvatarPicker value={avatarDraft.key} previewUrl={avatarDraft.url} onChange={(key, url) => setAvatarDraft({ key, url })} onBusyChange={setAvatarBusy} title="Profile image" description="Choose an avatar or upload your brand logo."/></div>;
    const inputId = `profile-${field}`;
    if (field === 'persona') return <div className="profile-settings-role-picker" role="group" aria-label="Choose your role">{roleChoices.map(({ id, title, detail, icon: Icon }) => <button key={id} type="button" className={`profile-settings-role-option${draft === id ? ' is-selected' : ''}`} aria-pressed={draft === id} onClick={() => setDraft(id)}><span className={`profile-settings-role-icon profile-settings-role-icon--${id}`}><Icon size={18} strokeWidth={1.9}/></span><span className="profile-settings-role-option__copy"><strong>{title}</strong><small>{detail}</small></span>{draft === id && <Check size={16} className="profile-settings-role-option__check" aria-hidden="true"/>}</button>)}</div>;
    if (field === 'bio') return <><label className="sr-only" htmlFor={inputId}>{labels[field]}</label><textarea id={inputId} autoFocus rows={4} maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} /></>;
    if (field === 'timezone') return <><label className="sr-only" htmlFor={inputId}>{labels[field]}</label><WorkspaceSelect id={inputId} autoFocus value={draft || 'Africa/Lagos'} onChange={event => setDraft(event.target.value)}><option value="Africa/Lagos">Lagos (WAT)</option><option value="Africa/Accra">Accra (GMT)</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="America/Los_Angeles">Los Angeles</option><option value="Asia/Dubai">Dubai</option></WorkspaceSelect></>;
    return <div className={field === 'slug' ? 'profile-settings-url-input' : undefined}>{field === 'slug' && <span>onselli.com/c/</span>}<label className="sr-only" htmlFor={inputId}>{labels[field]}</label><input id={inputId} type={field === 'whatsappE164' ? 'tel' : 'text'} autoFocus value={draft} maxLength={field === 'displayName' ? 100 : field === 'slug' ? 30 : field === 'whatsappE164' ? 16 : 160} onChange={event => setDraft(field === 'slug' ? event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') : event.target.value)} />{field === 'whatsappE164' && <small>Include country code, for example +234…</small>}</div>;
  }

  function row(field: Field) {
    const active = editing === field;
    return <div className={`profile-settings-row${active ? ' is-editing' : ''}`} key={field}>
      <div className="profile-settings-row__summary"><div><span>{labels[field]}</span><strong>{fieldValue(field)}</strong>{field === 'slug' && !active && <small>Your public workspace address</small>}</div>{!active && <Button variant="quiet" size="sm" className="profile-settings-edit" onClick={() => begin(field)} aria-label={`Edit ${labels[field]}`}><Pencil size={14}/><span>Edit</span></Button>}</div>
      {active && <div className="profile-settings-editor">{editor(field)}{error && <p className="profile-settings-error" role="alert">{error}</p>}<div className="profile-settings-actions"><Button variant="secondary" size="sm" onClick={cancel} disabled={busy}><X size={14}/> Cancel</Button><Button variant="primary" size="sm" className="is-save" onClick={() => void save(field)} disabled={busy || avatarBusy || (field === 'persona' && !draft)}>{busy ? <LoaderCircle size={14} className="creator-workspace-spin"/> : <Check size={14}/>} Save</Button></div></div>}
    </div>;
  }

  return <div className="profile-settings">
    <Surface as="section" className="settings-section profile-settings-section" id="workspace-profile" aria-labelledby="profile-settings-title">
      <div className="profile-settings-title"><h2 id="profile-settings-title">Profile</h2></div>
      <div className="profile-settings-list">{(['avatarKey', 'displayName', 'slug', 'persona', 'headline', 'bio', 'whatsappE164', 'timezone'] as Field[]).map(row)}</div>
      <div className="profile-settings-readonly"><span>Email</span><strong>{email || '—'}</strong><small>Managed through your sign-in account</small></div>
      {notice && <p className="profile-settings-notice" role="status">{notice}</p>}
      {googleConnected && <div className="profile-settings-google"><img className="profile-settings-google-mark" src="/icons/google.svg" alt="" aria-hidden="true"/><div><strong>Google</strong><small>Connected as {email}</small></div><span className="profile-settings-connected"><i/>Connected</span></div>}
    </Surface>
  </div>;
}
