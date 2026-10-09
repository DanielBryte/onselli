'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function CheckoutCompletePage() {
  const [status, setStatus] = useState('Checking payment confirmation…');
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabase();
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const id = new URL(window.location.href).searchParams.get('order');
      if (!id || !data.session) { if (active) setStatus('Sign in with the account used at checkout to check your purchase.'); return; }
      for (let attempt = 0; attempt < 8 && active; attempt++) {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
        const payload = await response.json();
        if (response.ok && payload.order?.status === 'PAID') { setPaid(true); setStatus('Payment confirmed. Your learning access is ready.'); return; }
        if (response.ok && payload.order?.status === 'FAILED') { setStatus('The payment was not completed. Return to the offer and try again.'); return; }
        await new Promise(resolve => setTimeout(resolve, 1800));
      }
      if (active) setStatus('Your payment is still processing. Check your learning library in a moment.');
    })();
    return () => { active = false; };
  }, []);
  return <main className="page-shell"><section className="page-content" style={{ maxWidth: 760, paddingTop: 100 }}><span className="section-kicker">Checkout update</span><h1 className="page-title">{paid ? 'You’re in.' : 'Finishing up.'}</h1><p className="page-subtitle" role="status">{status}</p><Link className="button button--mint" style={{ marginTop: 22, background: '#014733', color: '#fff' }} href={paid ? '/learn' : '/'}>{paid ? 'Open my learning library' : 'Return to Onselli'}</Link></section></main>;
}
