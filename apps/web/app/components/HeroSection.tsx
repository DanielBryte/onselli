'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  ChevronDown,
  ArrowRight,
  Check,
  Shirt,
  Sofa,
  Smartphone,
  Wrench,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { POPULAR_SEARCHES, CATEGORIES } from '../data/mockData';

const BUSINESS_OFFERS = [
  { title: 'storefront' },
  { title: 'ads manager' },
  { title: 'customers' },
  { title: 'products' },
  { title: 'invoices' },
] as const;

export default function HeroSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('Lagos');
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [activeOffer, setActiveOffer] = useState(0);
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const locations = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan'];
  const activeBusinessOffer = BUSINESS_OFFERS.at(activeOffer) ?? BUSINESS_OFFERS[0]!;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!locationMenuRef.current?.contains(event.target as Node)) setIsLocationOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const intervalId = window.setInterval(() => {
      setActiveOffer((current) => (current + 1) % BUSINESS_OFFERS.length);
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (location) params.set('location', location);
    router.push(`/discover?${params.toString()}`);
  };

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
    router.push(`/discover?q=${encodeURIComponent(tag)}`);
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Shirt':
        return <Shirt className="w-6 h-6" />;
      case 'Sofa':
        return <Sofa className="w-6 h-6" />;
      case 'Smartphone':
        return <Smartphone className="w-6 h-6" />;
      case 'Wrench':
        return <Wrench className="w-6 h-6" />;
      case 'Sparkles':
        return <Sparkles className="w-6 h-6" />;
      case 'Utensils':
        return <Utensils className="w-6 h-6" />;
      default:
        return <Search className="w-6 h-6" />;
    }
  };

  return (
    <section className="relative overflow-hidden bg-white px-4 pb-16 pt-14 sm:px-6 sm:pt-18">
      <div className="pointer-events-none absolute inset-0 hidden 2xl:block" aria-hidden="true">
        <div className="hero-side-card hero-side-card--left hero-notification absolute left-8 top-[158px] flex w-fit items-center gap-2.5 rounded-full px-3.5 py-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e5f8ed]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#42c77d]" />
          </span>
          <p className="whitespace-nowrap text-[12.5px] leading-none">
            <span className="font-bold text-[#112d21]">New customer message</span>
            <span className="font-normal text-[#84958b]"> · just now</span>
          </p>
        </div>

        <div className="hero-side-card hero-side-card--left-bottom hero-notification absolute left-14 top-[232px] flex w-fit items-center gap-2.5 rounded-full px-3.5 py-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#edf5ff]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#5a91d6]" />
          </span>
          <p className="whitespace-nowrap text-[12.5px] leading-none">
            <span className="font-bold text-[#112d21]">12 profile views</span>
            <span className="font-normal text-[#84958b]"> · today</span>
          </p>
        </div>

        <div className="hero-side-card hero-side-card--right-top hero-notification absolute right-8 top-[146px] flex w-fit items-center gap-2.5 rounded-full px-3.5 py-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#02924B] text-white">
            <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
          </span>
          <p className="whitespace-nowrap text-[12.5px] leading-none">
            <span className="font-bold text-[#112d21]">Profile is live</span>
            <span className="font-normal text-[#84958b]"> · today</span>
          </p>
        </div>

        <div className="hero-side-card hero-side-card--right-bottom hero-notification absolute right-14 top-[220px] flex w-fit items-center gap-2.5 rounded-full px-3.5 py-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fff5df]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#e5a51d]" />
          </span>
          <p className="whitespace-nowrap text-[12.5px] leading-none">
            <span className="font-bold text-[#112d21]">New 5-star review</span>
            <span className="font-normal text-[#84958b]"> · today</span>
          </p>
        </div>
      </div>

      <div className="max-w-[1140px] mx-auto text-center">
        <h1 className="mx-auto max-w-[900px] whitespace-nowrap text-[clamp(2rem,9vw,4.25rem)] font-bold leading-[1.04] tracking-[-0.045em] text-[#111111]">
          <span className="text-[#111111]">Your </span>
          <span className="inline-block min-h-[1.08em] rounded-[0.18em] bg-[#02924B] px-[0.22em] pb-[0.07em] pt-[0.03em] text-white shadow-[0_0.08em_0_#017A3F]" aria-live="polite">
            <span className="hero-offer-word" key={activeBusinessOffer.title}>
              {activeBusinessOffer.title}
            </span>
          </span>
          <span className="mt-1 block text-[#111111]">all in one place.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[620px] text-[15px] font-medium leading-relaxed text-[#486659] sm:text-[17px]">
          Onselli gives your business the tools to be discovered, build trust, and turn local attention into growth.
        </p>

        {/* Primary conversion action: search by need and location. */}
        <form
          onSubmit={handleSearch}
          className="mx-auto mt-8 flex max-w-[820px] flex-col items-stretch gap-2 rounded-2xl border border-[#c9ded2] bg-white p-2 shadow-[0_10px_24px_rgba(5,41,31,0.07)] transition-[border-color,box-shadow] focus-within:border-[#02924B] focus-within:shadow-[0_10px_24px_rgba(5,41,31,0.12)] sm:flex-row"
        >
          <div className="flex-1 flex items-center gap-3 px-4 min-h-14 w-full text-left">
            <Search className="w-5 h-5 text-[#02924B] shrink-0" aria-hidden="true" />
            <div className="w-full">
              <label htmlFor="business-search" className="sr-only">
                What are you looking for?
              </label>
              <input
                id="business-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search businesses, products or services"
                className="w-full text-[15px] font-semibold text-[#05291F] placeholder-[#7d998c] bg-transparent outline-none border-none p-0"
              />
            </div>
          </div>

          <div className="h-px w-full bg-[#e2efe7] sm:h-10 sm:w-px self-center" />

          <div className="relative w-full sm:w-[190px] shrink-0" ref={locationMenuRef}>
            <button
              type="button"
              id="search-location"
              aria-haspopup="listbox"
              aria-expanded={isLocationOpen}
              aria-controls="search-location-options"
              onClick={() => setIsLocationOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsLocationOpen(false);
              }}
              className="relative flex min-h-14 w-full items-center gap-2 rounded-xl bg-[#F2F3F0] px-4 text-left text-[14px] font-semibold text-[#05291F] outline-none transition-colors hover:bg-[#e8eee9] focus-visible:ring-2 focus-visible:ring-[#02924B] focus-visible:ring-offset-2"
            >
              <MapPin className="w-4 h-4 text-[#02924B] shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">{location}</span>
              <ChevronDown className={`h-4 w-4 text-[#557367] transition-transform ${isLocationOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isLocationOpen && (
              <div id="search-location-options" role="listbox" aria-labelledby="search-location" className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-xl border border-[#d8e5dd] bg-white p-1.5 shadow-[0_16px_32px_rgba(5,41,31,0.14)]">
                <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#658276]">Choose location</p>
                {locations.map((city) => {
                  const isSelected = city === location;
                  return (
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      key={city}
                      onClick={() => {
                        setLocation(city);
                        setIsLocationOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${isSelected ? 'bg-[#e7f5ed] text-[#02924B] font-semibold' : 'text-[#25483a] hover:bg-[#F2F3F0]'}`}
                    >
                      <span>{city}</span>
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-[#02924B]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="flex min-h-14 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#02924B] px-6 text-[14px] font-semibold text-white shadow-[0_3px_0_#017A3F] transition-all hover:translate-y-px hover:bg-[#017A3F] hover:shadow-[0_2px_0_#017A3F] active:translate-y-[2px] active:shadow-none sm:w-auto"
          >
            <span>Search</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Popular Searches Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-6 text-[12.5px]">
          <span className="font-semibold text-[#05291F] mr-1">Popular searches:</span>
          {POPULAR_SEARCHES.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="px-3.5 py-1.5 rounded-full bg-white border border-[#e2efe7] text-[#3e5e51] font-medium hover:border-[#00a859] hover:text-[#00a859] hover:bg-[#f0f8f4] transition-all shadow-2xs"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* 6 Pastel Category Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-14">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => router.push(`/discover?category=${encodeURIComponent(cat.title)}`)}
              className="group flex flex-col items-center p-4 rounded-2xl bg-white/80 hover:bg-white border border-[#e2efe7] hover:border-[#00a859] hover:shadow-[0_12px_30px_rgba(7,56,39,0.06)] transition-all text-center"
            >
              <div
                className="w-13 h-13 rounded-full flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ backgroundColor: cat.bgHex, color: cat.iconColor }}
              >
                {getCategoryIcon(cat.iconName)}
              </div>
              <h3 className="font-semibold text-[#073827] text-[13.5px] leading-tight mb-1 group-hover:text-[#00a859] transition-colors">
                {cat.title}
              </h3>
              <p className="text-[11px] text-[#718c80] leading-snug">
                {cat.subtext}
              </p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
