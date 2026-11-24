'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';

type Product = { id: string; title: string; slug: string; creatorSlug: string; priceMinor: string; amountMinor: string; amountType: string; minAmountMinor: string | null; currency: string };
type CartItem = { productId: string; title: string; slug: string; priceMinor: string; currency: string; quantity: number };
type Props = { mode: 'single'; product: Product; initialName: string; initialEmail: string } | { mode: 'cart'; cartSlug: string; creatorName: string; initialName: string; initialEmail: string };
const formatMoney = (minor: string, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(minor) / 100);
const cartStorageKey = (slug: string) => `onselli:cart:${slug}`;

export default function CheckoutStartForm(props: Props) {
  const [name, setName] = useState(props.initialName);
  const [email, setEmail] = useState(props.initialEmail);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutKey, setCheckoutKey] = useState('');
  useEffect(() => {
    setCheckoutKey(crypto.randomUUID());
    if (props.mode === 'cart') {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(cartStorageKey(props.cartSlug)) ?? '[]');
        if (Array.isArray(value)) setCartItems(value.filter((item): item is CartItem => Boolean(item && typeof item.productId === 'string' && typeof item.title === 'string' && typeof item.priceMinor === 'string' && Number.isInteger(item.quantity) && item.quantity > 0)));
      } catch { setCartItems([]); }
    }
  }, [props.mode, props.mode === 'cart' ? props.cartSlug : '']);
  const total = useMemo(() => cartItems.reduce((sum, item) => sum + BigInt(item.priceMinor) * BigInt(item.quantity), 0n).toString(), [cartItems]);
  const isCart = props.mode === 'cart';
  const currency = isCart ? cartItems[0]?.currency ?? 'NGN' : props.product.currency;
  const itemCount = isCart ? cartItems.reduce((sum, item) => sum + item.quantity, 0) : 1;
  const title = isCart ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} from ${props.creatorName}` : props.product.title;
  const checkoutAmount = isCart ? total : props.product.amountMinor;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (isCart && cartItems.length === 0) { setError('Your cart is empty. Return to the store to choose an offer.'); return; }
    if (!name.trim()) { setError('Enter your full name to continue.'); return; }
    if (!email.trim()) { setError('Enter an email address for your receipt and access.'); return; }
    setBusy(true);
    try {
      const body = isCart
        ? { items: cartItems.map(({ productId, quantity }) => ({ productId, quantity })), name: name.trim(), email: email.trim(), checkoutKey }
        : { productId: props.product.id, amountMinor: props.product.amountType === 'customer_chooses' ? props.product.amountMinor : undefined, name: name.trim(), email: email.trim(), checkoutKey };
      const response = await fetch(isCart ? '/api/checkout/cart' : '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) {
        setCheckoutKey(crypto.randomUUID());
        throw new Error(payload.error || 'Checkout could not be started.');
      }
      if (isCart) localStorage.removeItem(cartStorageKey(props.cartSlug));
      window.location.assign(payload.checkoutUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Checkout could not be started.'); setBusy(false); }
  }
  const backHref = isCart ? `/c/${props.cartSlug}` : `/c/${props.product.creatorSlug}/${props.product.slug}`;
  return <main className="min-h-[calc(100vh-72px)] bg-[#f6f7f5] px-6 pb-[88px] pt-10 text-[#17221d] max-[700px]:px-4 max-[700px]:pb-14 max-[700px]:pt-6">
    <div className="mx-auto w-full max-w-[1040px]">
      <Link className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#34423a] transition-colors hover:text-[#00543d] max-[700px]:mb-[18px]" href={backHref}><ArrowLeft size={16} /> Back to {isCart ? 'store' : 'offer'}</Link>
      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(280px,.8fr)] items-start gap-6 max-[700px]:grid-cols-1 max-[700px]:gap-[14px]">
        <section className="rounded-2xl border border-[#dfe5e0] bg-white p-8 shadow-[0_1px_2px_rgba(16,24,20,.03)] max-[700px]:px-5 max-[700px]:py-6">
          <p className="mb-2.5 mt-0 text-[11px] font-bold tracking-[.11em] text-[#647168]">SECURE CHECKOUT</p>
          <h1 className="m-0 text-[clamp(26px,3vw,34px)] font-semibold leading-[1.15] tracking-[-.04em]">Your details</h1>
          <p className="mb-[26px] mt-[11px] text-sm leading-[1.6] text-[#647168]">We’ll use these details to send your receipt and {isCart ? 'purchase' : 'access'} information.</p>
          <form onSubmit={submit} className="grid gap-[18px]">
            <label className="grid gap-2 text-[13px] font-[650] text-[#29352e]"><span>Full name</span><input className="min-h-[50px] w-full rounded-[9px] border border-[#d4ddd6] bg-white px-[14px] text-[13px] font-normal leading-[normal] text-[#17221d] outline-none placeholder:text-[#89938d] focus:border-[#00543d] focus:ring-[3px] focus:ring-[#00543d]/[.12]" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="Your name" /></label>
            <label className="grid gap-2 text-[13px] font-[650] text-[#29352e]"><span>Email address</span><input className="min-h-[50px] w-full rounded-[9px] border border-[#d4ddd6] bg-white px-[14px] text-[13px] font-normal leading-[normal] text-[#17221d] outline-none placeholder:text-[#89938d] focus:border-[#00543d] focus:ring-[3px] focus:ring-[#00543d]/[.12]" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required placeholder="you@example.com" /></label>
            {error && <p className="m-0 rounded-lg border border-[#f0caca] bg-[#fff7f7] px-[13px] py-[11px] text-[13px] leading-[1.5] text-[#a12626]" role="alert">{error}</p>}
            <button className="flex min-h-[52px] items-center justify-center gap-2.5 rounded-[9px] border-0 bg-[#006b4c] text-base font-bold text-white transition-[background-color,transform] hover:not-disabled:-translate-y-px hover:not-disabled:bg-[#00543d] disabled:cursor-wait disabled:opacity-[.65]" type="submit" disabled={busy || (isCart && cartItems.length === 0)}>{busy ? 'Preparing secure payment…' : Number(checkoutAmount) === 0 ? 'Get access' : 'Pay securely'}<ArrowRight size={17} /></button>
            <p className="m-0 flex items-center justify-center gap-2 text-xs text-[#65736a]"><LockKeyhole size={15} /> Payment is processed securely by Bachs.</p>
          </form>
        </section>
        <aside className="sticky top-6 rounded-2xl border border-[#dfe5e0] bg-white p-[26px] shadow-[0_1px_2px_rgba(16,24,20,.03)] max-[700px]:static max-[700px]:px-5 max-[700px]:py-[22px]">
          <p className="mb-2.5 mt-0 text-[11px] font-bold tracking-[.11em] text-[#647168]">ORDER SUMMARY</p>
          <h2 className="mb-[18px] mt-0 text-lg font-bold leading-[1.35] tracking-[-.02em]">{title}</h2>
          {isCart ? <ul className="m-0 grid list-none gap-[13px] p-0">{cartItems.map((item) => <li className="flex justify-between gap-4 text-[13px] leading-[1.45] text-[#59665e]" key={item.productId}><span>{item.title}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span><strong className="flex-none font-semibold text-[#17221d]">{formatMoney((BigInt(item.priceMinor) * BigInt(item.quantity)).toString(), item.currency)}</strong></li>)}</ul> : <p className="mb-[18px] mt-0 text-sm leading-[1.5] text-[#59665e]">{props.product.title}</p>}
          <div className="mt-[22px] flex items-center justify-between gap-4 border-t border-[#e7ebe8] pt-[18px] text-sm text-[#34423a]"><span>Total</span><strong className="text-xl font-semibold tracking-[-.03em] text-[#17221d]">{formatMoney(checkoutAmount, currency)}</strong></div>
        </aside>
      </div>
    </div>
  </main>;
}
