'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, X, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';

type CartLine = { productId: string; title: string; slug: string; priceMinor: string; currency: string; quantity: number };
type CartValue = { lines: CartLine[]; add: (line: CartLine) => boolean; remove: (id: string) => void; change: (id: string, delta: number) => void; open: () => void };
const CartContext = createContext<CartValue | null>(null);
const storageKey = (slug: string) => `onselli:cart:${slug}`;
const money = (minor: string, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(minor) / 100);

export function PublicCartProvider({ creatorSlug, children }: { creatorSlug: string; initialEmail?: string; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(creatorSlug)) ?? '[]');
      const valid = Array.isArray(parsed) ? parsed.filter((line): line is CartLine => Boolean(line && typeof line === 'object' && typeof line.productId === 'string' && typeof line.title === 'string' && typeof line.slug === 'string' && typeof line.priceMinor === 'string' && /^\d{1,15}$/.test(line.priceMinor) && ['NGN', 'USD'].includes(line.currency) && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 20)) : [];
      setLines(valid);
    } catch { setLines([]); }
    setHydrated(true);
  }, [creatorSlug]);
  useEffect(() => { if (hydrated) { try { localStorage.setItem(storageKey(creatorSlug), JSON.stringify(lines)); } catch { /* Checkout remains available for this session. */ } } }, [creatorSlug, lines, hydrated]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [open]);
  const add = useCallback((line: CartLine) => {
    if (lines.some((item) => item.currency !== line.currency)) return false;
    const found = lines.find((item) => item.productId === line.productId);
    setLines(found ? lines.map((item) => item.productId === line.productId ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item) : [...lines, { ...line, quantity: 1 }]);
    return true;
  }, [lines]);
  const remove = useCallback((id: string) => setLines((current) => current.filter((item) => item.productId !== id)), []);
  const change = useCallback((id: string, delta: number) => setLines((current) => current.map((item) => item.productId === id ? { ...item, quantity: Math.max(1, Math.min(20, item.quantity + delta)) } : item)), []);
  const value = useMemo(() => ({ lines, add, remove, change, open: () => setOpen(true) }), [lines, add, remove, change]);
  const total = lines.reduce((sum, item) => sum + BigInt(item.priceMinor) * BigInt(item.quantity), 0n);
  function checkout() { setOpen(false); router.push(`/checkout/start?cart=${encodeURIComponent(creatorSlug)}`); }
  return <CartContext.Provider value={value}>
    {children}
    {open && <div className="public-cart-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="public-cart-panel" role="dialog" aria-modal="true" aria-labelledby="public-cart-title">
        <header><div><span className="section-kicker">YOUR ORDER</span><h2 id="public-cart-title">Shopping cart</h2></div><button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Close cart"><X size={20} /></button></header>
        {lines.length ? <>
          <ul className="public-cart-lines">{lines.map((item) => <li key={item.productId}>
            <div className="public-cart-line-copy"><strong>{item.title}</strong><span>{money(item.priceMinor, item.currency)} each</span></div>
            <div className="public-cart-line-actions"><div className="public-cart-quantity"><button type="button" onClick={() => change(item.productId, -1)} aria-label={`Reduce ${item.title} quantity`}><Minus size={14} /></button><span>{item.quantity}</span><button type="button" onClick={() => change(item.productId, 1)} aria-label={`Increase ${item.title} quantity`}><Plus size={14} /></button></div><strong>{money((BigInt(item.priceMinor) * BigInt(item.quantity)).toString(), item.currency)}</strong><button className="public-cart-remove" type="button" onClick={() => remove(item.productId)} aria-label={`Remove ${item.title}`}><Trash2 size={16} /></button></div>
          </li>)}</ul>
          <div className="public-cart-total"><span>Total · {lines[0]?.currency}</span><strong>{money(total.toString(), lines[0]?.currency ?? 'NGN')}</strong></div>
          <p className="public-cart-note">Your name and email are collected securely at checkout.</p>
          <button type="button" className="public-cart-checkout" onClick={checkout}>Continue to checkout<ArrowRight size={17} /></button>
        </> : <div className="public-cart-empty"><ShoppingBag size={24} /><p>Your cart is empty.</p><span>Add an item from this creator’s store to get started.</span></div>}
      </section>
    </div>}
  </CartContext.Provider>;
}

export function AddToCartButton({ item }: { item: CartLine }) {
  const cart = useContext(CartContext);
  const [message, setMessage] = useState('');
  if (!cart) return null;
  return <div className="public-add-cart-wrap"><button type="button" className="public-add-cart" onClick={() => { const accepted = cart.add(item); setMessage(accepted ? '' : 'Your cart uses another currency. Finish or clear it before adding this item.'); cart.open(); }}><ShoppingBag size={17} /> Add to cart</button>{message && <span className="public-add-cart-message" role="status">{message}</span>}</div>;
}

export function CartTrigger() {
  const cart = useContext(CartContext);
  if (!cart) return null;
  const count = cart.lines.reduce((n, item) => n + item.quantity, 0);
  return <button type="button" className="public-cart-trigger" onClick={cart.open} aria-label={`Open cart, ${count} items`}>
    <ShoppingBag size={18} /><span>Cart</span>{count > 0 && <b>{count}</b>}
  </button>;
}
