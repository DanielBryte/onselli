'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function CheckoutCompletePage() {
  const [status, setStatus] = useState('Checking payment confirmation…');
  const [paid, setPaid] = useState(false);
  const [guestAccessPending, setGuestAccessPending] = useState(false);
  const [productType, setProductType] = useState<string | null>(null);
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [creatorConfirmation, setCreatorConfirmation] = useState<string | null>(null);
  const [includedProducts, setIncludedProducts] = useState<Array<{ title: string; type: string }>>([]);
  const [itemTitles, setItemTitles] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const id = new URL(window.location.href).searchParams.get('order');
      if (!id) { if (active) setStatus('Your purchase reference is missing.'); return; }
      for (let attempt = 0; attempt < 8 && active; attempt++) {
        const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const payload = await response.json();
        if (response.ok && payload.order?.status === 'paid') {
          setGuestAccessPending(Boolean(payload.order.guestAccessPending));
          const type = typeof payload.order.productType === 'string' ? payload.order.productType : null;
          setProductType(type);
          const purchasedTypes = Array.isArray(payload.order.productTypes) ? payload.order.productTypes : [];
          setProductTypes(purchasedTypes);
          setItemTitles(Array.isArray(payload.order.itemTitles) ? payload.order.itemTitles : []);
          if (typeof payload.order.creatorSlug === 'string' && Array.isArray(payload.order.purchasedProductIds)) {
            const key = `onselli:cart:${payload.order.creatorSlug}`;
            try {
              const cart = JSON.parse(localStorage.getItem(key) ?? '[]');
              const purchased = new Set(payload.order.purchasedProductIds);
              if (Array.isArray(cart)) localStorage.setItem(key, JSON.stringify(cart.filter((line) => !purchased.has(line?.productId))));
            } catch { /* Leave a malformed local cart untouched. */ }
          }
          setCreatorConfirmation(typeof payload.order.creatorConfirmation === 'string' ? payload.order.creatorConfirmation : null);
          setIncludedProducts(Array.isArray(payload.order.includedProducts) ? payload.order.includedProducts : []);
          setPaid(true);
          setStatus(payload.order.guestAccessPending ? 'Payment confirmed. Check your email for the secure link to verify your address and open your purchase.' : purchasedTypes.length > 0 && purchasedTypes.every((itemType: string) => itemType === 'payment_link') ? 'Payment confirmed. Your receipt will arrive by email.' : 'Payment confirmed. Your access is ready.');
          return;
        }
        if (response.ok && ['failed','expired','cancelled'].includes(payload.order?.status)) { setStatus('The payment was not completed. Return to the offer and try again.'); return; }
        await new Promise(resolve => setTimeout(resolve, 1800));
      }
      if (active) setStatus('Your payment is still processing. Check your account again in a moment.');
    })();
    return () => { active = false; };
  }, []);
  const hasLearningAccess = productTypes.some((type) => ['course', 'download', 'bundle'].includes(type)) || productType === 'course' || productType === 'download' || productType === 'bundle';
  return <main className="min-h-screen bg-[var(--paper)]"><section className="mx-auto max-w-[760px] px-6 pt-[100px] pb-[88px] max-[560px]:px-[18px] max-[560px]:pb-[70px]"><span className="section-kicker">Checkout update</span><h1 className="my-[10px] text-[clamp(32px,5vw,48px)] leading-[1.05] !tracking-[-.06em]">{paid ? (hasLearningAccess && !guestAccessPending ? 'You’re in.' : 'Payment confirmed') : 'Finishing up.'}</h1><p className="max-w-[650px] text-sm leading-[1.75] text-[var(--muted)]" role="status">{status}</p>{paid && creatorConfirmation && !guestAccessPending && <aside aria-label="Message from the creator"><span>MESSAGE FROM THE CREATOR</span><p>{creatorConfirmation}</p></aside>}{paid && productType === 'bundle' && includedProducts.length > 0 && <section aria-label="Bundle contents"><h2>Your bundle includes</h2><ul>{includedProducts.map((item, index) => <li key={`${item.title}-${index}`}><span>{item.type === 'course' ? 'Course' : 'Digital download'}</span><strong>{item.title}</strong></li>)}</ul></section>}{paid && productType === 'cart' && <section aria-label="Purchased items"><h2>Your items</h2><ul>{itemTitles.map((title, index) => <li key={`${title}-${index}`}><span>Purchased</span><strong>{title}</strong></li>)}</ul></section>}<Link className="mt-[22px] inline-flex items-center justify-center gap-[9px] rounded-full bg-display px-5 py-[14px] text-[13px] font-extrabold !text-white !no-underline transition-[transform,background,color] duration-[180ms] hover:-translate-y-px hover:bg-mint-hover" href={paid ? (guestAccessPending ? '/purchase/access' : hasLearningAccess ? '/dashboard/learning' : '/discover') : '/discover'}>{paid ? (guestAccessPending ? 'Manage purchase access' : hasLearningAccess ? 'Open my library' : 'Continue exploring') : 'Return to Onselli'}</Link></section></main>;
}
