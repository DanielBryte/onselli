'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MOCK_BUSINESSES } from '../data/mockData';
import BusinessCard from './BusinessCard';

export default function PopularBusinesses() {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="py-16 px-4 sm:px-6 bg-[#F2F3F0]">
      <div className="max-w-[1240px] mx-auto">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-wider text-[#02924B] block mb-1">
              CURATED FOR YOU
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#05291F] tracking-tight">
              Popular businesses near you
            </h2>
          </div>
          <Link
            href="/discover"
            className="text-[13.5px] font-semibold text-[#02924B] hover:text-[#017A3F] flex items-center gap-1 group transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* 5-Column Responsive Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {MOCK_BUSINESSES.slice(0, 5).map((biz) => (
            <BusinessCard key={biz.id} business={biz} isFavorite={Boolean(favorites[biz.id])} onToggleFavorite={(event) => toggleFavorite(biz.id, event)} />
          ))}
        </div>
      </div>
    </section>
  );
}
