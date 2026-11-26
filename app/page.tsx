import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, BookOpen, Check, Video } from 'lucide-react';
import Header from './components/Header';
import Logo from './components/Logo';
import HomeFinalCTA from './components/HomeFinalCTA';
import HeroDashboardPreview from './components/HeroDashboardPreview';
import PublicFooter from './components/PublicFooter';

export const metadata = {
  title: 'Turn what you know into what you earn | Onselli',
  description:
    'Build a premium home for your knowledge business with courses, digital products, workshops, and a creator storefront that sells with clarity.',
};

const offers = [
  { kind: 'WORKSHOP', title: 'The Brand Clarity Workshop', detail: 'A practical place to start', price: '₦18,000', color: 'sage' },
  { kind: 'FIELD GUIDE', title: 'The Creator’s Brand Playbook', detail: 'A resource to keep close', price: '₦8,500', color: 'cream' },
];

type Creator = { role: string; photo: string; rotate: number; mono?: boolean };

const creatorRows: Creator[][] = [
  [
    { role: 'Streamers',  photo: 'photo-1542751371-adc38448a05e', rotate: 20 },
    { role: 'Comedians',  photo: 'photo-1585699324551-f6c309eedeca', rotate: -25, mono: true },
    { role: 'Businesses', photo: 'photo-1522071820081-009f0129c71c', rotate: 40 },
    { role: 'Artists',    photo: 'photo-1513364776144-60967b0f800f', rotate: -8 },
    { role: 'Creators',   photo: 'photo-1534528741775-53994a69daeb', rotate: 45 },
    { role: 'Coaches',    photo: 'photo-1573496359142-b8d87734a5a2', rotate: -14 },
  ],
  [
    { role: 'Educators',  photo: 'photo-1577896851231-70ef18881754', rotate: 25 },
    { role: 'Authors',    photo: 'photo-1455390582262-044cdead277a', rotate: -15 },
    { role: 'Cosplayers', photo: 'photo-1578662996442-48f60103fc96', rotate: 15 },
    { role: 'Athletes',   photo: 'photo-1517838277536-f5f99be501cd', rotate: 40, mono: true },
    { role: 'Podcasters', photo: 'photo-1590602847861-f357a9332bbc', rotate: -8 },
    { role: 'Designers',  photo: 'photo-1507238691740-187a5b1d37b8', rotate: 35 },
  ],
];

const orbitIcons = [
  { name: 'Framer', src: 'https://cdn.simpleicons.org/framer/0055FF', position: 'top-[8%] left-[28%] h-[34px] w-[34px]', mobile: 'max-[760px]:top-[12%] max-[760px]:left-[7%] max-[760px]:h-[25px] max-[760px]:w-[25px]', tiny: 'max-[420px]:left-[7%] max-[420px]:h-[21px] max-[420px]:w-[21px]' },
  { name: 'Stripe', src: 'https://cdn.simpleicons.org/stripe/635BFF', position: 'top-[3%] left-1/2 h-[52px] w-[52px]', mobile: 'max-[760px]:top-[6%] max-[760px]:left-[24%] max-[760px]:h-[31px] max-[760px]:w-[31px]', tiny: 'max-[420px]:left-[24%] max-[420px]:h-[25px] max-[420px]:w-[25px]' },
  { name: 'Canva', src: '/icons/canva.svg', position: 'top-[8%] left-[72%] h-14 w-14', mobile: 'max-[760px]:top-[3%] max-[760px]:left-[43%] max-[760px]:h-[37px] max-[760px]:w-[37px]', tiny: 'max-[420px]:left-[43%] max-[420px]:h-[31px] max-[420px]:w-[31px]' },
  { name: 'Notion', src: 'https://cdn.simpleicons.org/notion/000000', position: 'top-[20%] left-[88%] h-[42px] w-[42px]', mobile: 'max-[760px]:top-[3%] max-[760px]:left-[62%] max-[760px]:h-[29px] max-[760px]:w-[29px]', tiny: 'max-[420px]:left-[62%] max-[420px]:h-6 max-[420px]:w-6' },
  { name: 'Figma', src: 'https://cdn.simpleicons.org/figma/F24E1E', position: 'top-[80%] left-[12%] h-12 w-12', mobile: 'max-[760px]:top-[6%] max-[760px]:left-[81%] max-[760px]:h-[31px] max-[760px]:w-[31px]', tiny: 'max-[420px]:left-[81%] max-[420px]:h-[25px] max-[420px]:w-[25px]' },
  { name: 'WordPress', src: 'https://cdn.simpleicons.org/wordpress/21759B', position: 'top-[92%] left-[28%] h-12 w-12', mobile: 'max-[760px]:top-[94%] max-[760px]:left-[24%] max-[760px]:h-8 max-[760px]:w-8', tiny: 'max-[420px]:left-[24%] max-[420px]:h-[27px] max-[420px]:w-[27px]' },
  { name: 'YouTube', src: 'https://cdn.simpleicons.org/youtube/FF0033', position: 'top-[96%] left-1/2 h-[43px] w-[43px]', mobile: 'max-[760px]:top-[97%] max-[760px]:left-[43%] max-[760px]:h-[29px] max-[760px]:w-[29px]', tiny: 'max-[420px]:left-[43%] max-[420px]:h-6 max-[420px]:w-6' },
  { name: 'TikTok', src: 'https://cdn.simpleicons.org/tiktok/000000', position: 'top-[92%] left-[72%] h-[43px] w-[43px]', mobile: 'max-[760px]:top-[94%] max-[760px]:left-[81%] max-[760px]:h-[29px] max-[760px]:w-[29px]', tiny: 'max-[420px]:left-[81%] max-[420px]:h-6 max-[420px]:w-6' },
  { name: 'Instagram', src: 'https://cdn.simpleicons.org/instagram/E4405F', position: 'top-[80%] left-[88%] h-[43px] w-[43px]', mobile: 'max-[760px]:top-[88%] max-[760px]:left-[94%] max-[760px]:h-[31px] max-[760px]:w-[31px]', tiny: 'max-[420px]:left-[94%] max-[420px]:h-[27px] max-[420px]:w-[27px]' },
  { name: 'Discord', src: 'https://cdn.simpleicons.org/discord/5865F2', position: 'top-1/2 left-[96%] h-[50px] w-[50px]', mobile: 'max-[760px]:top-[97%] max-[760px]:left-[62%] max-[760px]:h-[35px] max-[760px]:w-[35px]', tiny: 'max-[420px]:w-[31px] max-[420px]:h-[31px]' },
  { name: 'X', src: 'https://cdn.simpleicons.org/x/000000', position: 'top-[20%] left-[12%] h-7 w-7', mobile: 'max-[760px]:top-[88%] max-[760px]:left-[7%] max-[760px]:h-[23px] max-[760px]:w-[23px]', tiny: 'max-[420px]:left-[7%] max-[420px]:h-5 max-[420px]:w-5' },
  { name: 'Google', src: 'https://cdn.simpleicons.org/google/4285F4', position: 'top-1/2 left-[4%] h-[34px] w-[34px]', mobile: 'max-[760px]:top-[12%] max-[760px]:left-[94%] max-[760px]:h-[25px] max-[760px]:w-[25px]', tiny: 'max-[420px]:left-[94%] max-[420px]:h-[21px] max-[420px]:w-[21px]' },
];

// Scale so an upright photo still covers its rotated square
const coverScale = (deg: number) => {
  const r = (Math.abs(deg) * Math.PI) / 180;
  return Math.cos(r) + Math.sin(r);
};

export default function HomePage() {
  return (
    <main className="overflow-x-clip bg-white font-[Urbanist,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-ink" id="top">
      <Header />

      <section className="bg-white px-8 pb-[30px] pt-4 max-[760px]:px-4 max-[760px]:pb-[22px] max-[760px]:pt-3 max-[480px]:px-[10px] max-[480px]:pb-[18px] max-[480px]:pt-[10px]">
        <div className="relative isolate mx-auto min-h-[min(822px,calc(100svh-116px))] w-full max-w-[1440px] overflow-hidden rounded-3xl bg-display text-white max-[900px]:min-h-[792px] max-[760px]:min-h-[640px] max-[760px]:rounded-[19px] max-[480px]:min-h-[540px] max-[480px]:rounded-2xl">
          <div className="absolute inset-0 hidden" aria-hidden="true" />
          <div className="relative min-h-[inherit] w-full">
            <div className="mx-auto max-w-[920px] px-6 pb-[500px] pt-[90px] text-center max-[900px]:pt-[90px] max-[760px]:px-[22px] max-[760px]:pb-0 max-[480px]:px-[17px] max-[480px]:pt-[72px]">
              <span className="inline-block text-[11px] font-bold tracking-[.16em] text-on-brand-muted max-[480px]:text-[8px] max-[480px]:tracking-[.2em]">YOUR COMPLETE CREATOR PLATFORM</span>
              <h1 className="mx-auto my-[27px] mb-[18px] max-w-[900px] text-[clamp(56px,7vw,92px)] font-[650] leading-[.99] tracking-[-.075em] text-white max-[760px]:text-[clamp(30px,7vw,52px)] max-[760px]:whitespace-nowrap max-[480px]:my-6 max-[480px]:mb-4 max-[480px]:text-[clamp(30px,8.8vw,42px)] max-[480px]:leading-[1.04] max-[360px]:text-[28px]">Turn what you know<br />into <span className="text-mint">what you earn.</span></h1>
              <p className="mx-auto max-w-[760px] text-[19px] leading-[1.72] text-[rgba(246,255,249,.82)] max-[760px]:text-sm max-[480px]:text-[13px] max-[480px]:leading-[1.7]">Build a home for your knowledge. Create courses, downloads, workshops, or coaching and turn them to earnings.</p>
              <div className="mx-auto mt-[22px] flex w-full max-w-[460px] flex-row items-stretch justify-center gap-2 px-4 min-[480px]:gap-3 sm:mt-7 sm:max-w-none sm:items-center sm:gap-5 sm:px-0">
                <Link
                  href="/signup"
                  className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-center text-[13px] font-extrabold leading-tight text-ink shadow-[0_3px_0_rgba(0,35,18,.24)] transition hover:-translate-y-0.5 hover:bg-[#f0f5f0] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d09] min-[480px]:min-h-[54px] min-[480px]:gap-2.5 min-[480px]:px-[22px] min-[480px]:text-sm sm:flex-none"
                >
                  Start for free
                  <ArrowRight className="hidden size-4 shrink-0 min-[360px]:block min-[480px]:size-[17px]" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-[rgba(255,255,255,.18)] bg-[rgba(255,255,255,.08)] px-3 text-center text-[13px] font-extrabold leading-tight text-white shadow-[0_10px_24px_rgba(0,20,12,.12)] backdrop-blur-[4px] transition hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,.14)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 min-[480px]:min-h-[54px] min-[480px]:gap-2.5 min-[480px]:px-[18px] min-[480px]:text-sm sm:flex-none"
                >
                  See how it works
                  <ArrowRight className="hidden size-4 shrink-0 min-[360px]:block min-[480px]:size-4" />
                </Link>
              </div>
            </div>

            <div className="absolute bottom-[-170px] left-1/2 z-[2] h-[610px] w-[min(940px,82vw)] max-w-[940px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_64px_rgba(0,19,11,.18)] max-[760px]:static max-[760px]:mx-auto max-[760px]:mt-8 max-[760px]:mb-8 max-[760px]:h-auto max-[760px]:w-[min(570px,calc(100%_-_24px))] max-[760px]:translate-x-0 max-[520px]:mt-6 max-[520px]:mb-5 max-[520px]:w-[calc(100%_-_16px)]" role="group" aria-label="Illustrative creator dashboard overview">
              <HeroDashboardPreview />
            </div>
          </div>
        </div>
      </section>
      {/* BUILT FOR CREATORS: rotated squircle photos, two-row marquee */}
      <section className="mx-auto max-w-[1600px] overflow-hidden bg-white py-24 text-center max-[700px]:py-[68px]" id="for-creators">
        <div className="px-6 text-center">
          <p className="my-3 block text-xs font-[750] uppercase leading-[1.5] tracking-[.17em] text-muted">BUILT FOR CREATORS</p>
          <h2 className="mt-[18px] text-[clamp(38px,4.4vw,58px)] font-[650] leading-[1.02] tracking-[-.065em] text-ink max-[700px]:text-[clamp(35px,9vw,48px)]">Onselli is for creators</h2>
        </div>

        {/* Screen-reader list, since the marquee itself is aria-hidden */}
        <ul className="sr-only">
          {creatorRows.flat().map((c) => <li key={c.role}>{c.role}</li>)}
        </ul>

        <div className="mt-[53px] grid gap-[22px] max-[700px]:mt-[34px]" aria-label="Creators who can build on Onselli">
          {creatorRows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="overflow-hidden [mask-image:linear-gradient(90deg,transparent_0%,#000_10%,#000_90%,transparent_100%)] motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]"
            >
              {/* No gap on the track: each item carries its own right spacing so one third of the width is exactly one copy (seamless loop). */}
              <div
                aria-hidden="true"
                className={`flex w-max items-center py-3 [will-change:transform] hover:[animation-play-state:paused] motion-reduce:animate-none ${
                  rowIndex === 0
                    ? 'ml-5 animate-[creator-rail-left_48s_linear_infinite]'
                    : 'ml-[90px] animate-[creator-rail-right_54s_linear_infinite]'
                }`}
              >
                {[...row, ...row, ...row].map((creator, index) => (
                  <article
                    key={`${creator.role}-${rowIndex}-${index}`}
                    className="group flex shrink-0 items-center gap-[20px] whitespace-nowrap pr-[72px] max-[700px]:gap-3 max-[700px]:pr-10"
                  >
                    {/* Rotated shape (clips the photo) */}
                    <div
                      className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[32%] transition-transform duration-300 group-hover:scale-[1.06] max-[700px]:h-[64px] max-[700px]:w-[64px]"
                      style={{ rotate: `${creator.rotate}deg` }}
                    >
                      {/* Counter-rotated photo so the subject stays upright */}
                      <Image
                        src={`https://images.unsplash.com/${creator.photo}?auto=format&fit=crop&w=240&h=240&q=85`}
                        alt={creator.role}
                        width={120}
                        height={120}
                        unoptimized
                        className={`h-full w-full object-cover ${creator.mono ? 'grayscale' : ''}`}
                        style={{ rotate: `${-creator.rotate}deg`, scale: coverScale(creator.rotate) }}
                      />
                    </div>
                    <span className="text-[21px] font-semibold leading-none tracking-[-.015em] text-ink max-[700px]:text-[16px]">{creator.role}</span>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white px-7 pb-[92px] pt-[76px] max-[760px]:px-4 max-[760px]:pb-[65px] max-[760px]:pt-[52px] max-[420px]:px-3" id="how-it-works">
        <div className="relative mx-auto grid min-h-[680px] w-full max-w-[1480px] place-items-center overflow-visible min-[761px]:max-[1024px]:min-h-[620px] max-[760px]:min-h-[clamp(700px,190vw,820px)] max-[760px]:max-w-[620px] max-[420px]:min-h-[clamp(700px,205vw,780px)]">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {orbitIcons.map((icon) => <span className={`absolute z-[1] grid -translate-x-1/2 -translate-y-1/2 place-items-center opacity-[.92] transition-[opacity,scale] duration-[250ms] hover:scale-[1.08] hover:opacity-100 min-[761px]:max-[1024px]:scale-[.84] max-[760px]:h-[30px] max-[760px]:w-[30px] ${icon.position} ${icon.mobile} ${icon.tiny} [&_img]:block [&_img]:h-full [&_img]:w-full [&_img]:object-contain`} key={icon.name}><img src={icon.src} alt="" /></span>)}
          </div>
          <div className="relative z-[2] w-full max-w-[760px] px-6 py-[38px] text-center min-[761px]:max-[1024px]:w-[min(660px,calc(100%-120px))] min-[761px]:max-[1024px]:px-[10px] min-[761px]:max-[1024px]:py-8 max-[760px]:w-full max-[760px]:max-w-[560px] max-[760px]:px-3 max-[760px]:py-[clamp(104px,16vw,128px)] max-[420px]:px-[3px] max-[420px]:py-[clamp(100px,18vw,116px)] [&_.onselli-logo-mark]:h-[42px] [&_.onselli-logo-mark]:w-[42px] [&_.onselli-logo-mark]:rounded-[11px] [&_strong]:text-[31px] [&_strong]:tracking-[-.045em] max-[760px]:[&_.onselli-logo-mark]:h-9 max-[760px]:[&_.onselli-logo-mark]:w-9 max-[760px]:[&_strong]:text-[27px]">
            <span className="mb-[27px] flex justify-center max-[760px]:mb-5"><Logo className="gap-3" /></span>
            <span className="block text-[11px] font-[750] uppercase leading-[1.5] tracking-[.16em] text-muted">YOUR COMPLETE CREATOR PLATFORM</span>
            <h2 className="my-[18px] mb-[19px] text-[clamp(44px,5.2vw,68px)] font-[650] leading-[1.02] tracking-[-.065em] text-ink min-[761px]:max-[1024px]:text-[clamp(42px,6vw,58px)] max-[760px]:text-[clamp(40px,9.5vw,56px)] max-[420px]:text-[clamp(36px,10vw,42px)]">Everything you need<br />to earn from <em className="text-display not-italic">what you know.</em></h2>
            <p className="mx-auto max-w-[650px] text-lg leading-[1.7] text-muted min-[761px]:max-[1024px]:text-base max-[760px]:text-base max-[760px]:leading-[1.65] max-[420px]:text-sm max-[420px]:leading-[1.6]">Stop stitching together a website, payment links, course tools, and a community. Bring your knowledge and business together in one place.</p>
            <Link href="/signup" className="mt-[27px] inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-display px-[22px] text-sm font-extrabold text-white shadow-[0_3px_0_rgba(0,34,18,.3)] hover:bg-display-strong">Start for free <ArrowRight size={17} /></Link>
          </div>
        </div>
      </section>

      <section className="mx-auto my-[94px] grid min-h-[520px] max-w-[1390px] grid-cols-[1fr_.93fr] items-center gap-[42px] overflow-hidden rounded-[34px] bg-[#f2f6f1] px-[6.2%] py-[70px] max-[980px]:mx-6 max-[980px]:gap-[15px] max-[980px]:px-[5%] max-[980px]:py-[55px] max-[700px]:mx-[14px] max-[700px]:my-12 max-[700px]:grid-cols-1 max-[700px]:rounded-3xl max-[700px]:px-[25px] max-[700px]:pb-5 max-[700px]:pt-[43px]" id="platform">
        <div className="relative z-[1] max-w-[550px]"><span className="block text-xs font-[750] uppercase leading-[1.5] tracking-[.17em] text-muted">A BUSINESS THAT FEELS LIKE YOURS</span><h2 className="my-5 mb-[15px] text-[clamp(44px,5.2vw,68px)] font-[620] leading-none tracking-[-.07em] text-ink max-[700px]:text-[50px]">Create, share,<br />and grow <em className="text-display not-italic">your way.</em></h2><p className="max-w-[480px] text-base leading-[1.75] text-muted max-[700px]:text-base">Build a home for your knowledge business with your offers, your voice, and a learning experience your audience can return to.</p><Link href="/signup" className="mt-[14px] inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-full bg-display px-[22px] text-sm font-extrabold text-white shadow-[0_3px_0_rgba(0,34,18,.3)] hover:bg-display-strong">Get started — it’s free <ArrowRight size={17} /></Link></div>
        <div className="relative grid min-h-[390px] place-items-center max-[700px]:min-h-[340px]" aria-label="Preview of an Onselli creator workspace"><div className="absolute right-[4%] top-[1%] z-0 h-[260px] w-[260px] rounded-full bg-[#b5f4d0] opacity-[.76]" /><div className="absolute bottom-[1%] left-[3%] z-0 h-[170px] w-[170px] rounded-full bg-[#d1f8e2]" /><div className="relative z-[1] w-full max-w-[390px] rotate-[-2deg] rounded-[22px] border border-[rgba(255,255,255,.85)] bg-[rgba(255,255,255,.91)] p-6 shadow-[0_28px_65px_rgba(20,73,44,.15)]"><div className="flex items-center justify-between border-b border-border pb-[17px] text-[8px] font-extrabold tracking-[.11em] text-muted"><span>YOUR CREATOR SPACE</span><span className="text-display">● LIVE</span></div><div className="my-5 mb-[10px] grid h-[43px] w-[43px] place-items-center rounded-full bg-[linear-gradient(135deg,#0a4d32,#67d895)] text-xs font-extrabold text-white">AA</div><b className="block text-base text-ink">Amara’s studio</b><small className="mt-1 block text-[10px] text-muted">Ideas worth learning from.</small><div className="my-[17px] mb-[13px] flex gap-[5px]"><i className="h-1 flex-1 rounded-full bg-[#239459]" /><i className="h-1 flex-1 rounded-full bg-[#dff3e5]" /><i className="h-1 flex-1 rounded-full bg-[#dff3e5]" /></div><div className="flex items-center gap-[10px] border-t border-[#edf0ec] py-[10px]"><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-[#e6f6eb] text-brand"><Video size={17} /></span><div className="flex-1"><b className="block text-[10px] text-ink">Build a brand that feels like you</b><small className="mt-1 block text-[8px] text-muted">Course · 6 lessons</small></div><ArrowRight className="text-muted" size={16} /></div><div className="flex items-center gap-[10px] border-t border-[#edf0ec] py-[10px]"><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-[#e6f6eb] text-brand"><BookOpen size={17} /></span><div className="flex-1"><b className="block text-[10px] text-ink">The Brand Clarity Workbook</b><small className="mt-1 block text-[8px] text-muted">Digital guide · instant access</small></div><ArrowRight className="text-muted" size={16} /></div></div></div>
      </section>

      <section className="mx-auto max-w-[1440px] px-12 pb-28 pt-[15px] max-[700px]:px-5 max-[700px]:pb-[78px] max-[700px]:pt-[30px]">
        <div className="mb-[37px] flex items-end justify-between gap-[35px] max-[700px]:mb-7 max-[700px]:block"><div><span className="block text-xs font-[750] uppercase leading-[1.5] tracking-[.17em] text-muted">ONE PLATFORM. ROOM TO EXPAND.</span><h2 className="mb-0 mt-[22px] text-[clamp(44px,5.3vw,66px)] font-semibold leading-[.99] tracking-[-.07em] text-ink">Build the kind of<br />business <em className="text-display not-italic">you believe in.</em></h2></div><p className="mb-[5px] max-w-[390px] text-[15px] leading-[1.75] text-muted max-[700px]:mt-4">Start with the simplest way to share what you know. Add more ways to teach as your community grows.</p></div>
        <div className="grid grid-cols-3 gap-[25px] max-[980px]:gap-[17px] max-[700px]:grid-cols-1 max-[700px]:gap-[34px]">
          <article className="min-w-0"><div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_at_75%_20%,#8ce0ae,transparent_39%),linear-gradient(135deg,#0d5539,#17412e_60%,#b5dfae)] max-[980px]:min-h-[245px] max-[700px]:min-h-[280px]"><span className="absolute left-5 top-[18px] text-[9px] font-extrabold tracking-[.14em] text-[rgba(255,255,255,.82)]">01 / TEACH</span><div className="flex h-[190px] w-[180px] rotate-[-6deg] flex-col justify-between rounded-[13px] border border-[rgba(255,255,255,.58)] bg-[linear-gradient(150deg,#f8fae9,#d2e8c8)] p-5 text-ink shadow-[0_20px_38px_rgba(0,0,0,.17)]"><BookOpen size={18} /><b className="text-[17px] leading-[1.04] tracking-[-.05em]">THE CREATOR<br />FIELD GUIDE</b><small className="text-[8px] text-muted">5 lessons · learn at your pace</small></div></div><div className="px-1 pt-[22px]"><h3 className="m-0 text-[23px] tracking-[-.045em] text-ink">Teach it your way.</h3><p className="my-[9px] mb-4 min-h-[78px] text-[15px] leading-[1.7] text-muted max-[700px]:min-h-0">Turn your process into courses, workshops, or coaching that help someone take their next step.</p><Link className="inline-flex items-center gap-[7px] text-sm font-extrabold text-brand hover:text-brand-strong" href="/signup">Create an offer <ArrowRight size={15} /></Link></div></article>
          <article className="min-w-0"><div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_at_20%_20%,#c4f3d0,transparent_40%),linear-gradient(140deg,#57a878,#157349_64%,#083b2b)] max-[980px]:min-h-[245px] max-[700px]:min-h-[280px]"><span className="absolute left-5 top-[18px] text-[9px] font-extrabold tracking-[.14em] text-[rgba(255,255,255,.82)]">02 / SELL</span><div className="flex min-h-[185px] w-[205px] rotate-[4deg] flex-col justify-between rounded-xl bg-[#f9f8ee] p-5 text-ink shadow-[0_19px_42px_rgba(0,0,0,.15)]"><small className="text-[8px] font-extrabold tracking-[.1em]">AMARA ADE · CREATOR</small><b className="text-[26px] leading-[.98] tracking-[-.06em]">Your next<br />good idea<br />starts here.</b><i className="text-[8px] not-italic text-muted">onselli.com/c/amara</i></div></div><div className="px-1 pt-[22px]"><h3 className="m-0 text-[23px] tracking-[-.045em] text-ink">Make it easy to find you.</h3><p className="my-[9px] mb-4 min-h-[78px] text-[15px] leading-[1.7] text-muted max-[700px]:min-h-0">Give every offer a place in a creator storefront designed around your work and your voice.</p><Link className="inline-flex items-center gap-[7px] text-sm font-extrabold text-brand hover:text-brand-strong" href="/signup">Build your page <ArrowRight size={15} /></Link></div></article>
          <article className="min-w-0"><div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_at_76%_14%,#d4f9e2,transparent_38%),linear-gradient(140deg,#c1dcaa,#438b5c_65%,#124831)] max-[980px]:min-h-[245px] max-[700px]:min-h-[280px]"><span className="absolute left-5 top-[18px] text-[9px] font-extrabold tracking-[.14em] text-[rgba(255,255,255,.82)]">03 / GROW</span><div className="w-[220px] rotate-[-4deg] rounded-[13px] bg-white p-5 text-ink shadow-[0_16px_45px_rgba(14,56,34,.2)]"><span className="block text-[8px] font-extrabold tracking-[.12em] text-muted">NEW ENROLLMENT</span><b className="my-5 block text-[19px] leading-[1.1] tracking-[-.04em]">Brand Clarity<br />Workshop</b><small className="flex items-center gap-[5px] border-t border-border pt-3 text-[9px] text-success">Access unlocked <Check size={13} /></small></div><div className="absolute right-[18%] top-[13%] text-[38px] text-[rgba(255,255,255,.76)]">✳</div></div><div className="px-1 pt-[22px]"><h3 className="m-0 text-[23px] tracking-[-.045em] text-ink">Keep the learning going.</h3><p className="my-[9px] mb-4 min-h-[78px] text-[15px] leading-[1.7] text-muted max-[700px]:min-h-0">Make checkout and buyer access feel like one clear journey, from first click to first lesson.</p><Link className="inline-flex items-center gap-[7px] text-sm font-extrabold text-brand hover:text-brand-strong" href="/signup">See how it works <ArrowRight size={15} /></Link></div></article>
        </div>
      </section>

      <HomeFinalCTA />
      <PublicFooter />
    </main>
  );
}
