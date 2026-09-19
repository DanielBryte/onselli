'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  MapPin,
  ShieldCheck,
  ChevronDown,
  ArrowRight,
  Shirt,
  Sofa,
  Smartphone,
  Wrench,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { POPULAR_SEARCHES, CATEGORIES } from '../data/mockData';

export default function HeroSection() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('Lagos');

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
    <section className="bg-white pt-14 pb-16 px-4 sm:px-6">
      <div className="max-w-[1140px] mx-auto text-center">
        {/* Top Trust Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#00a859] text-white text-[12.5px] font-semibold mb-6">
          <ShieldCheck className="w-4 h-4 text-white" />
          <span>Trusted by 10,000+ businesses across Nigeria</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-extrabold text-[#073827] tracking-tight leading-[1.08] max-w-[880px] mx-auto mb-5">
          Discover businesses,{' '}
          <span className="text-[#00a859] relative inline-block">
            products and services
          </span>{' '}
          near you.
        </h1>

        {/* Subtitle */}
        <p className="text-[15px] sm:text-[17px] text-[#486659] max-w-[640px] mx-auto font-medium leading-relaxed mb-9">
          Find trusted businesses, explore quality products and services, and connect directly - all in one place.
        </p>

        {/* Primary conversion action: search by need and location. */}
        <form
          onSubmit={handleSearch}
          className="max-w-[820px] mx-auto bg-white p-2 rounded-2xl border border-[#c9ded2] shadow-[0_10px_24px_rgba(7,56,39,0.07)] flex flex-col sm:flex-row items-stretch gap-2 transition-[border-color,box-shadow] focus-within:border-[#00a859] focus-within:shadow-[0_10px_24px_rgba(7,56,39,0.12)]"
        >
          <div className="flex-1 flex items-center gap-3 px-4 min-h-14 w-full text-left">
            <Search className="w-5 h-5 text-[#00a859] shrink-0" aria-hidden="true" />
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
                className="w-full text-[15px] font-semibold text-[#073827] placeholder-[#7d998c] bg-transparent outline-none border-none p-0"
              />
            </div>
          </div>

          <div className="h-px w-full bg-[#e2efe7] sm:h-10 sm:w-px self-center" />

          <div className="relative flex items-center gap-2 px-4 min-h-14 bg-[#f6fbf8] rounded-xl w-full sm:w-[178px] shrink-0">
            <MapPin className="w-4 h-4 text-[#00a859] shrink-0" />
            <label htmlFor="search-location" className="sr-only">
              Search location
            </label>
            <select
              id="search-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent text-[14px] font-bold text-[#073827] outline-none cursor-pointer pr-5 border-none p-0 appearance-none"
            >
              <option value="Lagos">Lagos</option>
              <option value="Abuja">Abuja</option>
              <option value="Port Harcourt">Port Harcourt</option>
              <option value="Ibadan">Ibadan</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#6b8b7d] absolute right-4 pointer-events-none" />
          </div>

          <button
            type="submit"
            className="min-h-14 w-full sm:w-auto px-6 rounded-xl bg-[#00a859] hover:bg-[#008f4c] text-white font-bold text-[14px] flex items-center justify-center gap-2 transition-colors shadow-[0_6px_14px_rgba(0,168,89,0.24)] active:scale-[0.98] shrink-0"
          >
            <span>Search</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Popular Searches Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mt-6 text-[12.5px]">
          <span className="font-bold text-[#073827] mr-1">Popular searches:</span>
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
              <h3 className="font-bold text-[#073827] text-[13.5px] leading-tight mb-1 group-hover:text-[#00a859] transition-colors">
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
