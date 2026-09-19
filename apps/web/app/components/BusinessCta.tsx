'use client';

import React from 'react';
import Link from 'next/link';
import Logo from './Logo';
import {
  ArrowRight,
  TrendingUp,
  MessageSquare,
  CheckCircle2,
  Building2
} from 'lucide-react';

export default function BusinessCta() {
  return (
    <section className="px-4 pb-14 pt-16 sm:px-6 sm:pb-20" id="for-businesses">
      <div className="max-w-[1240px] mx-auto rounded-[28px] overflow-hidden bg-[#073827] border border-[#164f3a] text-white">

        <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-stretch">
          {/* Left Column - Headline & CTA */}
          <div className="lg:col-span-5 px-7 py-10 sm:px-12 sm:py-14 lg:px-14 lg:py-16 flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#00a859] px-3 py-1.5 text-white text-[12px] font-bold">
              <Building2 className="w-4 h-4" />
              <span>For business owners</span>
            </div>

            <h2 className="mt-5 text-[34px] sm:text-5xl font-extrabold tracking-[-0.045em] leading-[1.06] text-white">
              Get discovered. <br className="hidden sm:block" />Grow with confidence.
            </h2>

            <p className="mt-5 text-[15px] text-[#b7d3c5] leading-7 max-w-[390px]">
              Create a polished profile that helps local customers find, trust, and contact your business.
            </p>

            <div className="mt-8 flex flex-col sm:items-start gap-4">
              <Link href="/discover" className="px-6 py-3.5 rounded-full bg-[#00a859] hover:bg-[#18b969] font-extrabold text-[14px] inline-flex justify-center items-center gap-2 transition-colors group">
                <span>List your business</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#how-it-works" className="text-[13px] text-[#b7d3c5] font-semibold hover:text-white transition-colors underline underline-offset-4 decoration-white/30">Already listed? Claim your business</a>
            </div>
            <div className="mt-8 pt-6 border-t border-white/10 text-[12px] text-[#a5c7b9]">
              No setup fee · Reach customers across Nigeria
            </div>
          </div>

          {/* Middle Column - Interactive Dashboard UI Mockup */}
          <div className="lg:col-span-7 bg-[#f3f9f5] p-7 sm:p-10 lg:p-12 flex items-center justify-center">
            <div className="w-full max-w-[440px] bg-white rounded-2xl p-5 text-[#073827] border border-[#d4ede0]">
              {/* Header inside Dashboard Mockup */}
              <div className="flex items-center justify-between pb-3 border-b border-[#e2efe7]">
                <div className="flex items-center gap-2">
                  <Logo variant="icon" className="w-6 h-6" />
                  <span className="font-extrabold text-[13px] text-[#073827]">
                    Ade Fashion House
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#e6f4ec] text-[#00a859] text-[9.5px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 text-[#00a859]" />
                  Verified
                </span>
              </div>

              {/* Live Metric Stats Cards */}
              <div className="grid grid-cols-3 gap-2 my-3 text-center">
                <div className="p-2 rounded-xl bg-[#f4f9f6] border border-[#e2efe7]">
                  <span className="text-[9.5px] text-[#6b897c] font-medium block">
                    Views
                  </span>
                  <span className="font-extrabold text-[13px] text-[#073827] block">
                    2.4K
                  </span>
                  <span className="text-[9px] font-bold text-[#00a859] flex items-center justify-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" /> +18%
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-[#f4f9f6] border border-[#e2efe7]">
                  <span className="text-[9.5px] text-[#6b897c] font-medium block">
                    Inquiries
                  </span>
                  <span className="font-extrabold text-[13px] text-[#073827] block">
                    312
                  </span>
                  <span className="text-[9px] font-bold text-[#00a859] flex items-center justify-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" /> +24%
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-[#f4f9f6] border border-[#e2efe7]">
                  <span className="text-[9.5px] text-[#6b897c] font-medium block">
                    Orders
                  </span>
                  <span className="font-extrabold text-[13px] text-[#073827] block">
                    87
                  </span>
                  <span className="text-[9px] font-bold text-[#00a859] flex items-center justify-center gap-0.5">
                    <TrendingUp className="w-2.5 h-2.5" /> +12%
                  </span>
                </div>
              </div>

              {/* Smooth Animated Green Chart Graphic */}
              <div className="bg-[#f0f8f4] p-3 rounded-xl border border-[#d8ebdf] mb-3">
                <div className="flex items-center justify-between text-[10px] text-[#557567] mb-1.5 font-bold">
                  <span>Weekly Growth</span>
                  <span className="text-[#00a859]">Live</span>
                </div>
                <svg viewBox="0 0 200 45" className="w-full h-10 overflow-visible">
                  <path
                    d="M 0 35 Q 30 25, 60 30 T 120 15 T 180 5 L 200 8"
                    fill="none"
                    stroke="#00a859"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="180" cy="5" r="4" fill="#00a859" />
                </svg>
              </div>

              {/* Listing Items Preview Grid */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-[#e2efe7] overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=100&q=80"
                    alt="product"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#e2efe7] overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=100&q=80"
                    alt="product"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="w-10 h-10 rounded-lg bg-[#e2efe7] overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=100&q=80"
                    alt="product"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-right text-[10.5px] font-bold text-[#00a859]">
                  + 14 more
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
