'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import { getDefaultWorkspaceAvatarId, getWorkspaceAvatarPreset, getWorkspaceAvatarPresetFromKey, workspaceAvatarPresetKey, WORKSPACE_AVATAR_PRESETS } from '@/src/shared/workspace-avatar-presets';

export function WorkspaceAvatar({ src, fallbackSeed, className = '' }: { src?: string | null; fallbackSeed: string; className?: string }) {
  const fallback = getWorkspaceAvatarPreset(getDefaultWorkspaceAvatarId(fallbackSeed))!;
  return <span className={`workspace-avatar ${className}`.trim()} aria-hidden="true">
    <img src={src || fallback.src} alt="" />
  </span>;
}

export function WorkspaceAvatarPicker({ value, previewUrl, onChange, onBusyChange, title = 'Workspace image', description = 'Choose an illustrated avatar or upload your brand logo.' }: {
  value: string;
  previewUrl: string;
  onChange: (value: string, previewUrl: string) => void;
  onBusyChange?: (busy: boolean) => void;
  title?: string;
  description?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedPreset = getWorkspaceAvatarPresetFromKey(value);
  const activePreview = previewUrl || selectedPreset?.src || getWorkspaceAvatarPreset('fern')!.src;

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG, JPG, or WebP image smaller than 2 MB.');
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      const body = new FormData();
      body.append('logo', file);
      const response = await fetch('/api/workspace/workspaces/logo', { method: 'POST', body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.key !== 'string' || typeof result.url !== 'string') throw new Error(result.error || 'Logo upload failed. Try again.');
      onChange(result.key, result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Logo upload failed. Try again.');
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return <section className="workspace-avatar-picker" aria-label="Workspace image">
    <div className="workspace-avatar-picker__current">
      <WorkspaceAvatar src={activePreview} fallbackSeed="fern" className="workspace-avatar--large" />
      <div><strong>{title}</strong><p>{description}</p></div>
    </div>
    <div className="workspace-avatar-picker__choices" role="group" aria-label="Choose an illustrated workspace avatar">
      {WORKSPACE_AVATAR_PRESETS.map((preset) => {
        const selected = selectedPreset?.id === preset.id;
        return <button key={preset.id} type="button" className={selected ? 'is-selected' : ''} aria-label={`${preset.label} avatar`} aria-pressed={selected} onClick={() => { setError(''); onChange(workspaceAvatarPresetKey(preset.id), ''); }}>
          <img src={preset.src} alt="" />
        </button>;
      })}
      <button type="button" className="workspace-avatar-picker__upload" onClick={() => inputRef.current?.click()} disabled={busy} aria-label="Upload a workspace logo">
        {busy ? <LoaderCircle size={19} className="creator-workspace-spin"/> : <ImagePlus size={19}/>}<span>{busy ? 'Uploading' : 'Upload'}</span>
      </button>
    </div>
    <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadLogo(event)} aria-label="Choose a PNG, JPG, or WebP logo" />
    <p className="workspace-avatar-picker__hint">PNG, JPG, or WebP · up to 2 MB</p>
    {error && <p className="workspace-avatar-picker__error" role="alert">{error}</p>}
  </section>;
}
