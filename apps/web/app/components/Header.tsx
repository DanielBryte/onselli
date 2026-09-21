'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { Menu, X } from 'lucide-react';

interface HeaderProps {
  activeTab?: string;
}

export default function Header({ activeTab = 'home' }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#e2efe7]">
      <div className="relative mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center group transition-transform active:scale-98">
          <Logo showTagline={false} />
        </Link>

        {/* Center Nav Links */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 text-[14px] font-medium text-[#446356] md:flex">
          <Link
            href="/"
            className={`py-6 border-b-2 transition-colors ${
              activeTab === 'home'
                ? 'border-[#02924B] text-[#02924B] font-semibold'
                : 'border-transparent hover:text-[#02924B]'
            }`}
          >
            Home
          </Link>
          <Link
            href="/discover"
            className={`py-6 border-b-2 transition-colors ${
              activeTab === 'explore'
                ? 'border-[#02924B] text-[#02924B] font-semibold'
                : 'border-transparent hover:text-[#02924B]'
            }`}
          >
            Explore
          </Link>
          <a
            href="#for-businesses"
            className="py-6 border-b-2 border-transparent hover:text-[#02924B] transition-colors"
          >
            For Businesses
          </a>
          <a
            href="#about"
            className="py-6 border-b-2 border-transparent hover:text-[#02924B] transition-colors"
          >
            About
          </a>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Auth Buttons */}
          <button className="hidden lg:block px-4 py-2 text-[13px] font-semibold text-[#05291F] hover:text-[#02924B] transition-colors">
            Sign In
          </button>
          <button className="rounded-xl bg-[#02924B] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_3px_0_#017A3F] transition-all hover:translate-y-px hover:bg-[#017A3F] hover:shadow-[0_2px_0_#017A3F] active:translate-y-[2px] active:shadow-none">
            Start selling
          </button>
          <button
            type="button"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="md:hidden p-2 rounded-full text-[#05291F] hover:bg-[#F2F3F0] transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {isMenuOpen && (
        <div className="md:hidden border-t border-[#e2efe7] bg-white px-4 py-4 shadow-[0_12px_24px_rgba(7,56,39,0.08)]">
          <nav className="mx-auto flex max-w-[1240px] flex-col gap-1" aria-label="Mobile navigation">
            {[
              { label: 'Home', href: '/' },
              { label: 'Explore businesses', href: '/discover' },
              { label: 'For businesses', href: '#for-businesses' },
              { label: 'About Onselli', href: '#about' }
            ].map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setIsMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-[#264b3c] hover:bg-[#f0f8f4] hover:text-[#008f4c]">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
