'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PricingPlanGrid from './PricingPlanGrid';

export default function HomePricing() {
  return <section className="scroll-mt-6 bg-white px-[clamp(18px,5vw,72px)] pb-[82px] pt-[90px] max-[760px]:px-4 max-[760px]:pb-[58px] max-[760px]:pt-16" id="pricing" aria-labelledby="home-pricing-title">
    <div className="mx-auto mb-[30px] max-w-[1100px] text-center max-[760px]:mb-[23px]"><span className="block text-xs font-[750] uppercase leading-[1.5] tracking-[.17em] text-[#71847a]">SIMPLE PLANS, ROOM TO GROW</span><h2 id="home-pricing-title" className="my-3 text-[clamp(34px,4.4vw,54px)] font-[650] leading-[1.04] tracking-[-.06em] text-[#17241c] max-[760px]:text-4xl">Choose the plan<br/>that fits <em className="text-[#397b5d] not-italic">your next step.</em></h2><p className="mt-[10px] text-sm leading-[1.6] text-[#718077] max-[760px]:text-[13px]">Start free, then upgrade when your audience and business are ready.</p></div>
    <PricingPlanGrid presentation="marketing" renderAction={(plan) => <Link href="/signup" className={`pricing-plan__action !mt-px !flex !min-h-[46px] !w-full !items-center !justify-center !gap-2 !rounded-[10px] !border !border-[#dce5de] !bg-white !px-[14px] !text-[13px] !font-semibold !text-[#253a2c] !no-underline !transition-[background-color,border-color,transform] hover:!-translate-y-px hover:!border-[#0b6848] hover:!bg-[#eff7f2] ${plan.id === 'pro' ? '!border-[#07573d] !bg-[#07573d] !text-white hover:!bg-[#086345]' : ''}`}>
      {plan.id === 'free' ? 'Start for free' : `Choose ${plan.name}`}<ArrowRight size={15}/>
    </Link>} />
  </section>;
}
