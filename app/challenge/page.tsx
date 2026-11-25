import Link from 'next/link';
import { ArrowRight, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import Header from '../components/Header';
import Logo from '../components/Logo';

export const metadata = {
  title: 'Onselli 14-Day Creator Launch Challenge | Onselli',
  description:
    'Turn what you know into your first $1,000 online. A guided 14-day sprint to package your knowledge, launch your storefront, and get your first paying students.',
};

const challengeSteps = [
  { day: 'Days 1-3', title: 'Define Your High-Value Knowledge', desc: 'Identify the exact problem you solve, map your target audience, and outline your core offer.' },
  { day: 'Days 4-7', title: 'Package Your Course or Digital Product', desc: 'Structure your lessons, create actionable templates or record your masterclass with zero fluff.' },
  { day: 'Days 8-10', title: 'Launch Your Branded Storefront', desc: 'Set up your Onselli link-in-bio storefront, configure multi-currency payments, and write clear offer copy.' },
  { day: 'Days 11-14', title: 'Get Your First 10 Paying Customers', desc: 'Execute the organic launch strategy to your existing audience or social followers and make your first sales.' },
];

export default function ChallengePage() {
  return (
    <main className="flex min-h-screen flex-col overflow-x-clip">
      <Header />

      <section className="mx-auto max-w-[1080px] px-6 pt-20 pb-[60px] text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-tint px-[14px] py-1.5 text-xs font-bold uppercase tracking-[.05em] text-brand">
          <Sparkles size={14} /> 14-Day Sprint for Creators
        </span>
        <h1 className="mx-auto mb-5 mt-0 max-w-[820px] text-[clamp(36px,5vw,64px)] font-extrabold leading-[1.1] tracking-[-.035em] text-ink">
          Turn what you know into your next <span className="text-brand">$1,000 online.</span>
        </h1>
        <p className="mx-auto mb-8 mt-0 max-w-[640px] text-[18px] leading-[1.7] text-ink-secondary">
          Stop waiting to launch. Join hundreds of educators, coaches, and creators in a structured 14-day challenge to build and launch your first digital product or course.
        </p>
        <div className="flex flex-wrap justify-center gap-[14px]">
          <Link href="/signup" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(180deg,#0a5137_0%,#014733_100%)] px-7 text-[15px] font-extrabold text-white shadow-[0_10px_24px_rgba(1,71,51,.18),inset_0_1px_0_rgba(255,255,255,.14)] transition hover:-translate-y-0.5">
            Join the Challenge Free <ArrowRight size={18} />
          </Link>
          <Link href="/#how-it-works" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[10px] border border-border bg-white px-6 text-[15px] font-bold text-ink transition hover:border-brand hover:bg-[#eff7f2]">
            See how Onselli works
          </Link>
        </div>
      </section>

      <section className="mx-auto mb-20 w-full max-w-[960px] px-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          <div className="rounded-2xl border border-border bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
            <div className="mb-4 grid size-10 place-items-center rounded-[10px] bg-brand-tint text-brand">
              <Zap size={20} />
            </div>
            <h3 className="mb-2 mt-0 text-[18px] font-bold text-ink">Zero Overwhelm</h3>
            <p className="m-0 text-sm leading-[1.6] text-ink-secondary">Bite-sized daily prompts that eliminate decision fatigue and help you focus on high-impact steps.</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
            <div className="mb-4 grid size-10 place-items-center rounded-[10px] bg-brand-tint text-brand">
              <Users size={20} />
            </div>
            <h3 className="mb-2 mt-0 text-[18px] font-bold text-ink">Community Accountability</h3>
            <p className="m-0 text-sm leading-[1.6] text-ink-secondary">Launch alongside fellow creators. Get feedback on your offer pricing, copy, and positioning.</p>
          </div>
          <div className="rounded-2xl border border-border bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
            <div className="mb-4 grid size-10 place-items-center rounded-[10px] bg-brand-tint text-brand">
              <Trophy size={20} />
            </div>
            <h3 className="mb-2 mt-0 text-[18px] font-bold text-ink">Live Revenue Milestone</h3>
            <p className="m-0 text-sm leading-[1.6] text-ink-secondary">By Day 14, your storefront is live and accepting payments in global currencies directly to your account.</p>
          </div>
        </div>

        <div className="mt-[54px] rounded-[20px] border border-border bg-[#f9fafb] p-9 max-sm:p-5">
          <h2 className="mb-6 mt-0 text-center text-2xl font-bold text-ink">The 14-Day Roadmap</h2>
          <div className="grid gap-4">
            {challengeSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-4 rounded-xl border border-border bg-white px-5 py-[18px] max-sm:flex-col">
                <span className="whitespace-nowrap rounded-md bg-brand-tint px-[10px] py-1 text-xs font-extrabold text-brand">{step.day}</span>
                <div>
                  <h4 className="mb-1 mt-0 text-[15px] font-bold text-ink">{step.title}</h4>
                  <p className="m-0 text-[13px] leading-[1.5] text-ink-secondary">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(180deg,#0a5137_0%,#014733_100%)] px-5 text-xs font-extrabold text-white shadow-[0_10px_24px_rgba(1,71,51,.18),inset_0_1px_0_rgba(255,255,255,.14)] transition hover:-translate-y-0.5">
              Start Your Free 14-Day Challenge <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-[#e8eee6] bg-white px-7 py-6">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
          <Link href="/" className="flex items-center"><Logo /></Link>
          <small className="text-[10px] text-muted">© {new Date().getFullYear()} Onselli. Built for what you know.</small>
        </div>
      </footer>
    </main>
  );
}
