'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PricingPlanGrid from './PricingPlanGrid';

export default function HomePricing({ asPage = false }: { asPage?: boolean }) {
  const Heading = asPage ? 'h1' : 'h2';
  return (
    <section
      className={`scroll-mt-12 bg-white px-4 sm:px-6 lg:px-8 pb-20 pt-16 sm:pb-28 sm:pt-24 ${
        asPage ? 'min-h-[calc(100svh-82px)] pt-20 sm:pt-28' : ''
      }`}
      id="pricing"
      aria-labelledby="home-pricing-title"
    >
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <span className="block text-xs font-extrabold uppercase tracking-widest text-brand mb-2">
          SIMPLE PLANS, ROOM TO GROW
        </span>
        <Heading
          id="home-pricing-title"
          className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-ink leading-[1.08]"
        >
          A clear plan for <em className="text-display not-italic font-black">what’s next.</em>
        </Heading>
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-muted">
          Start with the essentials, then unlock more room to sell, grow your audience, and understand what’s working. Compare plans and choose the pace that fits your business.
        </p>
      </div>

      <PricingPlanGrid
        presentation="marketing"
        renderAction={(plan) => (
          <Link
            href="/signup"
            className={`flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-150 cursor-pointer ${
              plan.id === 'pro'
                ? 'bg-brand text-white shadow-sm hover:bg-brand-strong hover:shadow-md'
                : 'border border-border bg-surface text-ink hover:border-brand hover:bg-brand-tint/60'
            }`}
          >
            {plan.id === 'free' ? 'Start for free' : `Choose ${plan.name}`}
            <ArrowRight size={16} />
          </Link>
        )}
      />
    </section>
  );
}
