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
    {open && <div className="fixed inset-0 z-[200] flex justify-end bg-[rgba(10,20,15,.38)]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="relative flex h-screen w-[min(420px,100vw)] flex-col overflow-hidden border-l border-[#e5e7eb] bg-white animate-[cart-slide-in_.22s_cubic-bezier(.25,.46,.45,.94)]" role="dialog" aria-modal="true" aria-labelledby="public-cart-title">
        <header className="flex shrink-0 items-center justify-between border-b border-[#f0f4f1] px-5 pb-4 pt-5"><div className="grid gap-0.5"><span className="section-kicker !text-[9.5px] !tracking-[.1em] !text-[#9ca3af]">YOUR ORDER</span><h2 className="m-0 text-[17px] font-bold tracking-[-.025em] text-[#111815]" id="public-cart-title">Shopping cart</h2></div><button className="grid size-[34px] shrink-0 place-items-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] transition-[border-color,color] hover:border-[#d1d5db] hover:text-[#111815]" ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Close cart"><X size={20} /></button></header>
        {lines.length ? <>
          <ul className="m-0 flex flex-1 list-none flex-col gap-0 overflow-y-auto px-5 py-0">{lines.map((item) => <li className="flex flex-col gap-2.5 border-b border-[#f0f4f1] py-4" key={item.productId}>
            <div className="grid gap-[3px]"><strong className="text-[13.5px] font-[650] leading-[1.35] text-[#17221d]">{item.title}</strong><span className="text-xs text-[#9ca3af]">{money(item.priceMinor, item.currency)} each</span></div>
            <div className="flex items-center gap-2.5"><div className="inline-flex items-center overflow-hidden rounded-lg border border-[#e5e7eb]"><button className="grid size-[30px] place-items-center border-0 bg-transparent text-[#374151] transition-colors hover:bg-[#f4f6f4]" type="button" onClick={() => change(item.productId, -1)} aria-label={`Reduce ${item.title} quantity`}><Minus size={14} /></button><span className="min-w-7 border-x border-[#e5e7eb] text-center text-[13px] font-semibold leading-[30px] text-[#111815]">{item.quantity}</span><button className="grid size-[30px] place-items-center border-0 bg-transparent text-[#374151] transition-colors hover:bg-[#f4f6f4]" type="button" onClick={() => change(item.productId, 1)} aria-label={`Increase ${item.title} quantity`}><Plus size={14} /></button></div><strong className="ml-auto text-[13px] font-[650] text-[#17221d]">{money((BigInt(item.priceMinor) * BigInt(item.quantity)).toString(), item.currency)}</strong><button className="grid size-[30px] place-items-center rounded-[7px] border-0 bg-transparent text-[#d1d5db] transition-[color,background-color] hover:bg-[#fff3f1] hover:text-[#b93831]" type="button" onClick={() => remove(item.productId)} aria-label={`Remove ${item.title}`}><Trash2 size={16} /></button></div>
          </li>)}</ul>
          <div className="flex shrink-0 items-baseline justify-between gap-3 border-t border-[#e5e7eb] px-5 py-[14px]"><span className="text-xs font-medium text-[#6b7280]">Total · {lines[0]?.currency}</span><strong className="text-xl font-[750] tracking-[-.03em] text-[#111815]">{money(total.toString(), lines[0]?.currency ?? 'NGN')}</strong></div>
          <p className="m-0 shrink-0 px-5 pb-2.5 text-[11px] text-[#9ca3af]">Your name and email are collected securely at checkout.</p>
          <button type="button" className="mx-5 mb-5 flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[10px] border-0 bg-[#006b4c] text-sm font-[650] leading-none text-white transition-colors hover:bg-[#00543d]" onClick={checkout}>Continue to checkout<ArrowRight size={17} /></button>
        </> : <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-[#9ca3af]"><ShoppingBag className="mb-1 text-[#d1d5db]" size={24} /><p className="m-0 text-sm font-semibold text-[#374151]">Your cart is empty.</p><span className="max-w-[240px] text-[12.5px] leading-[1.5] text-[#9ca3af]">Add an item from this creator’s store to get started.</span></div>}
      </section>
    </div>}
  </CartContext.Provider>;
}

export function AddToCartButton({ item }: { item: CartLine }) {
  const cart = useContext(CartContext);
  const [message, setMessage] = useState('');
  if (!cart) return null;
  return <div><button type="button" className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-[7px] rounded-[9px] border border-[#d1d5db] bg-white text-[13.5px] font-semibold leading-none text-[#006b4c] transition-[border-color,background-color] hover:border-[#006b4c] hover:bg-[#f6faf8]" onClick={() => { const accepted = cart.add(item); setMessage(accepted ? '' : 'Your cart uses another currency. Finish or clear it before adding this item.'); cart.open(); }}><ShoppingBag size={17} /> Add to cart</button>{message && <span role="status">{message}</span>}</div>;
}

export function CartTrigger() {
  const cart = useContext(CartContext);
  if (!cart) return null;
  const count = cart.lines.reduce((n, item) => n + item.quantity, 0);
  return <button type="button" className="inline-flex h-9 min-h-9 shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[9px] border border-[#e2e8e4] bg-white px-[14px] text-[13px] font-semibold text-[#17221d] transition-all hover:border-[#07533c] hover:bg-[#fbfdfc] hover:text-[#07533c] max-[760px]:px-[10px]" onClick={cart.open} aria-label={`Open cart, ${count} items`}>
    <ShoppingBag className="shrink-0" size={18} /><span className="max-[760px]:hidden">Cart</span>{count > 0 && <b className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#014733] px-[5px] text-[10px] font-[750] leading-none text-white">{count}</b>}
  </button>;
}
