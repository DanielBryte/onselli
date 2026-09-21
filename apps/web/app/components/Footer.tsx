import React from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { ArrowUpRight, Camera, Mail, MessageCircle, Play } from 'lucide-react';

const footerLinks = {
  Explore: [
    { label: 'Discover businesses', href: '/discover' },
    { label: 'For businesses', href: '#for-businesses' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Help centre', href: '#help' }
  ],
  Company: [
    { label: 'About Onselli', href: '#about' },
    { label: 'Contact us', href: 'mailto:hello@onselli.com' },
    { label: 'Terms of use', href: '#terms' },
    { label: 'Privacy policy', href: '#privacy' }
  ]
};

export default function Footer() {
  return (
    <footer className="bg-[#05291F] px-4 pb-6 pt-14 text-white sm:px-6 sm:pt-16">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-12 border-b border-white/10 pb-12 md:grid-cols-[1.25fr_.7fr_.7fr] md:gap-8">
          <div className="max-w-[330px]">
            <Link href="/" className="inline-flex"><Logo variant="white" showTagline /></Link>
            <p className="mt-5 text-sm leading-6 text-[#a9c8b9]">Discover trusted local businesses and give yours a place to grow.</p>
            <a href="mailto:hello@onselli.com" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#84e2ae] transition hover:text-white"><Mail className="h-4 w-4" /> hello@onselli.com <ArrowUpRight className="h-3.5 w-3.5" /></a>
            <div className="mt-6 flex items-center gap-2.5">
              <a href="#" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#d8eee3] transition hover:border-[#02924B] hover:bg-[#02924B]"><Camera className="h-4 w-4" /></a>
              <a href="#" aria-label="X / Twitter" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#d8eee3] transition hover:border-[#02924B] hover:bg-[#02924B]"><MessageCircle className="h-4 w-4" /></a>
              <a href="#" aria-label="YouTube" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-[#d8eee3] transition hover:border-[#02924B] hover:bg-[#02924B]"><Play className="h-4 w-4" /></a>
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h2 className="text-sm font-semibold">{title}</h2>
              <ul className="mt-5 space-y-3.5">{links.map((link) => <li key={link.label}><a href={link.href} className="text-sm text-[#a9c8b9] transition hover:text-[#6fe2a2]">{link.label}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center gap-4 pt-6 text-xs font-medium text-[#89ad9c]">
          <p>© {new Date().getFullYear()} Onselli. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
