'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import Logo from './Logo';

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

  return (
    <header className="site-header site-header--light">
      <div className="site-header__inner">
        <Link href="/" aria-label="Onselli home" className="brand-lockup brand-lockup--home"><Logo /></Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="#platform">Product</Link><Link href="#how-it-works">How it works</Link><Link href="#company">Company</Link><Link href="#pricing">Pricing</Link><Link href="/discover">Community</Link>
        </nav>
        <div className="header-actions"><Link className="text-link" href="/login">Log in</Link><Link className="button button--small button--mint" href="/signup">Start for free <ArrowRight size={15} /></Link></div>
        <button className="menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation"><Link onClick={() => setOpen(false)} href="#platform">Product</Link><Link onClick={() => setOpen(false)} href="#how-it-works">How it works</Link><Link onClick={() => setOpen(false)} href="#company">Company</Link><Link onClick={() => setOpen(false)} href="#pricing">Pricing</Link><Link onClick={() => setOpen(false)} href="/discover">Community</Link><Link onClick={() => setOpen(false)} href="/learn">My learning</Link><Link onClick={() => setOpen(false)} href="/login">Log in</Link><Link className="mobile-nav__cta" onClick={() => setOpen(false)} href="/signup">Start for free <ArrowRight size={16}/></Link></nav>}
    </header>
  );
}
