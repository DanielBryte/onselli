'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

export default function DownloadButton({ fileId, fileName }: { fileId: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    const supabase = getSupabase();
    if (!supabase) { setError('Sign in again to download this file.'); return; }
    setBusy(true); setError('');
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`/api/learning/files/${fileId}`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok || typeof payload.url !== 'string') { setError(payload.error || 'Could not prepare this download.'); return; }
    window.location.assign(payload.url);
  }

  return <div style={{ marginTop: 12 }}><button className="button button--outline" type="button" onClick={() => void download()} disabled={busy} style={{ color: '#014733', borderColor: '#cbd8cf' }}><Download size={14}/>{busy ? 'Preparing…' : `Download ${fileName}`}</button>{error && <p className="form-error" role="alert" style={{ marginTop: 8 }}>{error}</p>}</div>;
}
