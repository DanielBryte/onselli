'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PricingPlanGrid from './PricingPlanGrid';

export default function HomePricing() {
  return <section className="home-pricing" id="pricing" aria-labelledby="home-pricing-title">
    <div className="home-pricing__intro"><span className="section-overline">SIMPLE PLANS, ROOM TO GROW</span><h2 id="home-pricing-title">Choose the plan<br/>that fits <em>your next step.</em></h2><p>Start free, then upgrade when your audience and business are ready.</p></div>
    <PricingPlanGrid className="home-pricing__grid" renderAction={(plan) => <Link href="/signup" className={`pricing-plan__action${plan.id === 'pro' ? ' pricing-plan__action--primary' : ''}`}>
      {plan.id === 'free' ? 'Start for free' : `Choose ${plan.name}`}<ArrowRight size={15}/>
    </Link>} />
  </section>;
}
