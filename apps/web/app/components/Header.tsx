'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Logo from './Logo';
import { MapPin, Search, ChevronDown, User, Store } from 'lucide-react';

interface HeaderProps {
  activeTab?: string;
}

export default function Header({ activeTab = 'home' }: HeaderProps) {
  const [selectedLocation, setSelectedLocation] = useState('Lagos');
  const [isLocOpen, setIsLocOpen] = useState(false);

  const locations = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu'];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#e2efe7]">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center group transition-transform active:scale-98">
          <Logo showTagline={false} />
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#446356]">
          <Link
            href="/"
            className={`py-6 border-b-2 transition-colors ${
              activeTab === 'home'
                ? 'border-[#00a859] text-[#00a859] font-semibold'
                : 'border-transparent hover:text-[#00a859]'
            }`}
          >
            Home
          </Link>
          <Link
            href="/discover"
            className={`py-6 border-b-2 transition-colors ${
              activeTab === 'explore'
                ? 'border-[#00a859] text-[#00a859] font-semibold'
                : 'border-transparent hover:text-[#00a859]'
            }`}
          >
            Explore
          </Link>
          <a
            href="#for-businesses"
            className="py-6 border-b-2 border-transparent hover:text-[#00a859] transition-colors"
          >
            For Businesses
          </a>
          <a
            href="#about"
            className="py-6 border-b-2 border-transparent hover:text-[#00a859] transition-colors"
          >
            About
          </a>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Location Selector */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setIsLocOpen(!isLocOpen)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#d2e4da] bg-[#f7fbf9] text-[13px] font-medium text-[#073827] hover:border-[#00a859] transition-all"
            >
              <MapPin className="w-3.5 h-3.5 text-[#00a859]" />
              <span>{selectedLocation}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#67877a]" />
            </button>

            {isLocOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-[#e2efe7] py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {locations.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => {
                      setSelectedLocation(loc);
                      setIsLocOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-[13px] hover:bg-[#f0f8f4] transition-colors ${
                      loc === selectedLocation ? 'text-[#00a859] font-semibold bg-[#f0f8f4]' : 'text-[#2b473c]'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Direct Search icon button */}
          <Link
            href="/discover"
            className="p-2 rounded-full text-[#446356] hover:text-[#00a859] hover:bg-[#f0f8f4] transition-all"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </Link>

          {/* Auth Buttons */}
          <button className="hidden lg:block px-4 py-2 text-[13px] font-semibold text-[#073827] hover:text-[#00a859] transition-colors">
            Sign In
          </button>
          <button className="px-4 py-2.5 rounded-full bg-[#00a859] text-white text-[13px] font-bold hover:bg-[#008f4c] shadow-[0_4px_14px_rgba(0,168,89,0.28)] hover:shadow-[0_6px_20px_rgba(0,168,89,0.36)] transition-all active:scale-97">
            Create Account
          </button>
        </div>
      </div>
    </header>
  );
}
