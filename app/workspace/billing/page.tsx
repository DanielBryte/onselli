'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';

type Result = { ok: boolean; pending?: boolean; error?: string; planId?: string };

export default function BillingReturnPage() {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (!reference) {
      setResult({ ok: false, error: 'We could not find a payment reference. Check your billing status or contact support.' });
      return;
    }
    let active = true;
    void (async () => {
      try {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          const response = await fetch(`/api/billing/verify?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' });
          const data = await response.json().catch(() => ({}));
          if (response.status === 202 && data.pending) {
            if (attempt < 9) await new Promise((resolve) => window.setTimeout(resolve, 1500));
            continue;
          }
          if (!response.ok) throw new Error(data.error || 'We could not confirm your payment.');
          if (active) setResult({ ok: true, planId: data.planId });
          return;
        }
        if (active) setResult({ ok: false, pending: true, error: 'Your payment is still syncing. Your plan will activate as soon as Bachs confirms it.' });
      } catch (error: unknown) {
        if (active) setResult({ ok: false, error: error instanceof Error ? error.message : 'We could not confirm your payment.' });
      }
    })();
    return () => { active = false; };
  }, []);

  return <main className="billing-return-page"><section className="billing-return-card" aria-live="polite">
    {!result ? <><LoaderCircle className="billing-return-icon is-loading" size={30}/><h1>Confirming your payment</h1><p>Bachs is confirming your subscription. This usually takes a few seconds.</p></>
      : result.ok ? <><CheckCircle2 className="billing-return-icon is-success" size={32}/><h1>Your {result.planId === 'studio' ? 'Studio' : 'Pro'} plan is active</h1><p>Your workspace access has been updated. You can continue using your dashboard.</p></>
        : <><CircleAlert className={`billing-return-icon ${result.pending ? 'is-loading' : 'is-error'}`} size={32}/><h1>{result.pending ? 'Payment received' : 'Payment not confirmed'}</h1><p>{result.error}</p></>}
    <div className="billing-return-actions"><Link className="creator-primary-action" href="/workspace">Go to dashboard <ArrowRight size={15}/></Link>{result && !result.ok && !result.pending && <a href="mailto:support@onselli.com?subject=Subscription%20payment%20help">Contact support</a>}</div>
  </section></main>;
}
