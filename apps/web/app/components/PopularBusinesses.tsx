'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, Heart, CheckCircle2, ArrowRight, MapPin } from 'lucide-react';
import { MOCK_BUSINESSES, Business } from '../data/mockData';

export default function PopularBusinesses() {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="py-16 px-4 sm:px-6 bg-[#f4f9f6]">
      <div className="max-w-[1240px] mx-auto">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#00a859] block mb-1">
              CURATED FOR YOU
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#073827] tracking-tight">
              Popular businesses near you
            </h2>
          </div>
          <Link
            href="/discover"
            className="text-[13.5px] font-bold text-[#00a859] hover:text-[#008f4c] flex items-center gap-1 group transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* 5-Column Responsive Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {MOCK_BUSINESSES.slice(0, 5).map((biz) => (
            <article
              key={biz.id}
              className="group bg-white rounded-2xl border border-[#e2efe7] overflow-hidden hover:shadow-[0_16px_36px_rgba(7,56,39,0.09)] hover:border-[#00a859]/40 transition-all duration-300 flex flex-col"
            >
              {/* Cover Image Container */}
              <div className="relative h-44 w-full bg-[#e8f2ec] overflow-hidden">
                <img
                  src={biz.coverImage}
                  alt={biz.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                  {biz.topRated ? (
                    <span className="px-2.5 py-1 rounded-full bg-[#fff4db] text-[#b76e00] text-[10.5px] font-bold shadow-xs">
                      Top Rated
                    </span>
                  ) : biz.verified ? (
                    <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs text-[#00a859] text-[10.5px] font-bold flex items-center gap-1 shadow-xs">
                      <CheckCircle2 className="w-3 h-3 text-[#00a859]" />
                      Verified
                    </span>
                  ) : null}
                </div>

                {/* Favorite Toggle Button */}
                <button
                  onClick={(e) => toggleFavorite(biz.id, e)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white backdrop-blur-xs flex items-center justify-center text-[#425b6c] hover:text-[#e44367] transition-all shadow-xs active:scale-90"
                  aria-label="Save business"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      favorites[biz.id] ? 'fill-[#e44367] text-[#e44367]' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Card Details */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-3 mb-2.5">
                    {/* Business Avatar Initials */}
                    <div
                      className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-[12px] shadow-xs"
                      style={{ backgroundColor: biz.avatarBg }}
                    >
                      {biz.initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#073827] text-[14px] leading-snug truncate group-hover:text-[#00a859] transition-colors">
                        {biz.name}
                      </h3>
                      {/* Rating & Reviews */}
                      <div className="flex items-center gap-1 text-[12px] mt-0.5">
                        <Star className="w-3.5 h-3.5 fill-[#00a859] text-[#00a859]" />
                        <span className="font-bold text-[#073827]">{biz.rating}</span>
                        <span className="text-[#7d998c]">({biz.reviewsCount})</span>
                      </div>
                    </div>
                  </div>

                  {/* Location & Tags */}
                  <div className="space-y-1.5 mb-3">
                    <p className="text-[11.5px] font-semibold text-[#4e6b5e] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#7d998c]" />
                      <span>{biz.location}</span>
                      <span className="text-[#a4beaf]">·</span>
                      <span className="text-[#658577]">{biz.distance}</span>
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {biz.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md bg-[#f0f7f3] text-[#3b5e4f] text-[10.5px] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11.5px] text-[#5c7a6c] line-clamp-2 leading-relaxed mb-4">
                    {biz.description}
                  </p>
                </div>

                {/* Footer Price & Profile Link */}
                <div className="pt-3 border-t border-[#e2efe7] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#718c80] block">Starting</span>
                    <span className="font-extrabold text-[#073827] text-[13.5px]">
                      {biz.startingPrice}
                    </span>
                  </div>

                  <Link
                    href={`/discover?id=${biz.id}`}
                    className="text-[12px] font-bold text-[#00a859] hover:text-[#008f4c] flex items-center gap-1 group/btn"
                  >
                    <span>View profile</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
