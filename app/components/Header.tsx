'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import Logo from './Logo';

const navigationItems = [
  { label: 'Product', href: '/#platform' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Company', href: '/#company' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Community', href: '/discover' },
] as const;

export default function Header() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header className="sticky top-0 z-[100] isolate border-b border-[#edf0ec] bg-white">
      <div className="mx-auto flex h-[82px] max-w-[1440px] items-center gap-[clamp(18px,2.35vw,34px)] px-[42px] max-[960px]:h-[76px] max-[960px]:gap-5 max-[960px]:px-6 max-[760px]:h-[72px] max-[760px]:px-5 max-[390px]:px-[14px]">
        <Link href="/" aria-label="Onselli home" className="flex flex-1 items-center" onClick={closeMenu}>
          <Logo className="gap-[14px] [&_.onselli-logo-mark]:size-11 [&_.onselli-logo-mark]:rounded-[11px] [&_strong]:text-[29px] [&_strong]:tracking-[-.045em] max-[960px]:[&_.onselli-logo-mark]:size-10 max-[960px]:[&_strong]:text-[27px] max-[390px]:gap-[10px] max-[390px]:[&_.onselli-logo-mark]:size-9 max-[390px]:[&_strong]:text-[25px]" />
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-[clamp(16px,2.25vw,34px)] whitespace-nowrap text-[14px] font-semibold text-ink max-[960px]:hidden" aria-label="Main navigation">
          {navigationItems.map((item) => <Link key={item.label} href={item.href}>{item.label}</Link>)}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-[25px] max-[960px]:hidden">
          <Link className="text-[14px] font-semibold text-ink hover:text-display" href="/login">Log in</Link>
          <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-display px-5 text-xs font-extrabold text-white shadow-[0_3px_0_#075c39] transition hover:bg-display-strong" href="/signup">Start for free <ArrowRight size={15} /></Link>
        </div>

        <button
          type="button"
          className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-white text-ink min-[961px]:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <nav
        id="mobile-navigation"
        className={`${open ? 'grid' : 'hidden'} absolute left-[14px] right-[14px] top-[calc(100%+8px)] z-[110] max-h-[calc(100svh-96px)] grid-cols-2 gap-1.5 overflow-y-auto rounded-[18px] border border-[#e4ebe4] bg-white p-3 shadow-[0_20px_55px_rgba(10,39,24,.16)] animate-[mobile-menu-in_.16s_ease-out] min-[961px]:hidden max-[390px]:left-[10px] max-[390px]:right-[10px] max-[390px]:gap-1 max-[390px]:p-[9px]`}
        aria-label="Mobile navigation"
        aria-hidden={!open}
      >
        {navigationItems.map((item) => (
          <Link
            key={item.label}
            className="flex min-h-[46px] items-center rounded-full px-[13px] py-[11px] text-[15px] font-semibold leading-[1.2] text-ink hover:bg-surface-hover hover:text-display max-[390px]:px-[10px] max-[390px]:text-sm"
            href={item.href}
            onClick={closeMenu}
            tabIndex={open ? 0 : -1}
          >
            {item.label}
          </Link>
        ))}
        <Link
          className="flex min-h-[46px] items-center rounded-full px-[13px] py-[11px] text-[15px] font-semibold leading-[1.2] text-ink hover:bg-surface-hover hover:text-display max-[390px]:px-[10px] max-[390px]:text-sm"
          href="/login"
          onClick={closeMenu}
          tabIndex={open ? 0 : -1}
        >
          Log in
        </Link>
        <Link
          className="col-span-2 mt-[3px] flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-display px-[13px] py-[11px] text-[15px] font-bold leading-[1.2] text-white hover:bg-brand-strong"
          href="/signup"
          onClick={closeMenu}
          tabIndex={open ? 0 : -1}
        >
          Start for free <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}
