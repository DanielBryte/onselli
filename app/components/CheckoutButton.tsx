'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';

export default function CheckoutButton({ productId, returnPath }: { productId: string; returnPath: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function checkout() {
    setError('');
    const supabase = getSupabase();
    const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
    if (!data.session) { router.push(`/login?next=${encodeURIComponent(returnPath)}`); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ productId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Checkout could not be started.');
      window.location.assign(payload.checkoutUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Checkout could not be started.'); setBusy(false); }
  }
  return <div><button className="button button--mint" type="button" onClick={checkout} disabled={busy} style={{ width: '100%', marginTop: 18, background: '#014733', color: '#fff' }}>{busy ? 'Preparing secure checkout…' : 'Continue to checkout'} <ArrowRight size={14}/></button>{error && <p className="form-error" role="alert">{error}</p>}</div>;
}
