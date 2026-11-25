import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomeFinalCTA() {
  return <section className="bg-white px-[30px] pb-6 max-[760px]:px-[22px] max-[760px]:pb-[65px]" aria-labelledby="home-last-call-title">
    <div className="relative mx-auto flex min-h-[455px] max-w-[1440px] flex-col items-center justify-center overflow-hidden rounded-[27px] bg-display px-6 py-[72px] pb-[96px] text-center text-white sm:px-8 sm:pb-[104px] max-[600px]:min-h-[390px] max-[600px]:rounded-[21px] max-[600px]:px-5 max-[600px]:pb-[82px] max-[600px]:pt-[48px]">
      <span className="relative z-[1] text-[10px] font-extrabold tracking-[.18em] text-on-brand-muted">YOUR KNOWLEDGE HAS VALUE</span>
      <h2 id="home-last-call-title" className="relative z-[1] my-[22px] mb-[14px] max-w-[850px] text-[clamp(43px,6vw,76px)] font-bold leading-[.98] tracking-[-.065em] max-[600px]:text-[clamp(30px,8vw,42px)] max-[360px]:text-[28px]">What you know can<br />take someone further.</h2>
      <p className="relative z-[1] max-w-[560px] text-[17px] leading-[1.7] text-on-brand-muted max-[700px]:text-[15px] max-[600px]:text-sm max-[380px]:text-[13px]">Give your next idea a home and make it easy for people to learn from you.</p>
      <Link href="/signup" className="relative z-[1] mt-6 inline-flex min-h-[48px] min-w-0 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-center text-[13px] font-extrabold leading-tight text-ink shadow-[0_3px_0_rgba(0,35,18,.24)] transition hover:-translate-y-0.5 hover:bg-[#f0f5f0] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d09] min-[480px]:min-h-[54px] min-[480px]:gap-2.5 min-[480px]:px-[22px] min-[480px]:text-sm sm:flex-none">Start for free <ArrowRight className="hidden size-4 shrink-0 min-[360px]:block min-[480px]:size-[17px]" /></Link>
      <span className="pointer-events-none absolute bottom-[-37px] left-1/2 -translate-x-1/2 text-6xl leading-none text-white sm:bottom-[-37px] sm:text-7xl md:bottom-[-42px] md:text-[83px]" aria-hidden="true">✳</span>
    </div>
  </section>;
}
