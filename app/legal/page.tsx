import Link from 'next/link';
import Logo from '../components/Logo';

const legalLinks = [
  { href: '/legal/terms', label: 'Terms of Service', summary: 'How creators and customers use Onselli.' },
  { href: '/legal/privacy', label: 'Privacy Policy', summary: 'How we collect, handle, and protect personal data.' },
  { href: '/legal/cookies', label: 'Cookie Policy', summary: 'How we use cookies and tracking technologies.' },
];

export const metadata = {
  title: 'Legal | Onselli',
  description: 'Onselli legal information, terms, privacy policy, and cookie notice.',
};

export default function LegalIndexPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf7_0%,#f1f6f2_100%)] text-[#152219]">
      <header className="border-b border-[#e6ece6] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-[18px] px-6 py-[18px]">
          <Link href="/" className="inline-flex items-center" aria-label="Go to Onselli home">
            <Logo />
          </Link>
          <Link href="/" className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[10px] bg-[#014733] px-[18px] text-xs font-extrabold text-white hover:bg-[#086345]">
            Back to site
          </Link>
        </div>
      </header>

      <section className="px-6 pt-[60px] pb-[18px]">
        <div className="mx-auto max-w-[1100px] rounded-[28px] border border-[#e4eee3] bg-[radial-gradient(circle_at_top_left,rgba(111,201,150,.18),transparent_40%),linear-gradient(135deg,#fff,#f3f7f2)] px-[34px] py-[52px] shadow-[0_18px_60px_rgba(20,48,28,.06)] max-sm:px-6 max-sm:py-9">
          <span className="mb-[18px] inline-block text-[10px] font-extrabold tracking-[.17em] text-[#0f5b3a]">LEGAL</span>
          <h1 className="m-0 text-[clamp(38px,4vw,62px)] leading-[1.02] tracking-[-.06em] text-[#0c1a13]">Clear agreements for a trusted platform.</h1>
          <p className="mt-[18px] max-w-[690px] text-[17px] leading-[1.7] text-[#52635c]">
            Onselli is designed to help creators build sustainable businesses with clarity, confidence,
            and respect for both their audience and their own work.
          </p>
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-[#dfeae1] bg-[#f6faf7] px-[14px] py-[10px] text-[13px] font-bold text-[#1b352a]">
            <span>Questions?</span>
            <a className="text-[#014733]" href="mailto:support@onselli.com">support@onselli.com</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 pt-[18px] pb-[72px]">
        <div className="grid grid-cols-3 gap-5 max-md:grid-cols-1">
          {legalLinks.map((item) => (
            <Link href={item.href} key={item.href} className="flex flex-col gap-[14px] rounded-[20px] border border-[#e1eae0] bg-white px-6 py-[26px] shadow-[0_10px_30px_rgba(18,42,26,.04)] transition hover:-translate-y-0.5 hover:border-[#d1e3d6] hover:shadow-[0_18px_40px_rgba(13,47,29,.08)]">
              <span className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#1a6e4f]">Read</span>
              <h2 className="m-0 text-[27px] leading-[1.1] tracking-[-.045em] text-[#14241d]">{item.label}</h2>
              <p className="m-0 text-[15px] leading-[1.7] text-[#5f6f67]">{item.summary}</p>
              <span className="mt-auto pt-3 text-[13px] font-bold text-[#014733]">Open document →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
