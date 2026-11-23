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
  return <main className="checkout-start-page">
    <div className="checkout-start-wrap">
      <Link className="checkout-start-back" href={backHref}><ArrowLeft size={16} /> Back to {isCart ? 'store' : 'offer'}</Link>
      <div className="checkout-start-layout">
        <section className="checkout-start-card">
          <p className="checkout-start-kicker">SECURE CHECKOUT</p>
          <h1>Your details</h1>
          <p className="checkout-start-intro">We’ll use these details to send your receipt and {isCart ? 'purchase' : 'access'} information.</p>
          <form onSubmit={submit} className="checkout-start-fields">
            <label><span>Full name</span><input name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="Your name" /></label>
            <label><span>Email address</span><input name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required placeholder="you@example.com" /></label>
            {error && <p className="checkout-start-error" role="alert">{error}</p>}
            <button className="checkout-start-pay" type="submit" disabled={busy || (isCart && cartItems.length === 0)}>{busy ? 'Preparing secure payment…' : Number(checkoutAmount) === 0 ? 'Get access' : 'Pay securely'}<ArrowRight size={17} /></button>
            <p className="checkout-start-security"><LockKeyhole size={15} /> Payment is processed securely by Bachs.</p>
          </form>
        </section>
        <aside className="checkout-start-summary">
          <p className="checkout-start-kicker">ORDER SUMMARY</p>
          <h2>{title}</h2>
          {isCart ? <ul>{cartItems.map((item) => <li key={item.productId}><span>{item.title}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span><strong>{formatMoney((BigInt(item.priceMinor) * BigInt(item.quantity)).toString(), item.currency)}</strong></li>)}</ul> : <p className="checkout-start-single-title">{props.product.title}</p>}
          <div className="checkout-start-total"><span>Total</span><strong>{formatMoney(checkoutAmount, currency)}</strong></div>
        </aside>
      </div>
    </div>
  </main>;
}
