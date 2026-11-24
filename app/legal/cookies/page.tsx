import Link from 'next/link';
import Logo from '../../components/Logo';

export const metadata = {
  title: 'Cookie Policy | Onselli',
  description: 'How Onselli uses cookies and similar technologies on its platform.',
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf7_0%,#f1f6f2_100%)] pb-12 text-[#152219]">
      <header className="border-b border-[#e6ece6] bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1100px] items-center justify-between gap-[18px] px-6 py-[18px]">
        <Link href="/" className="inline-flex items-center" aria-label="Go to Onselli home"><Logo /></Link>
        <Link href="/legal" className="text-[13px] font-bold text-[#244833] hover:text-[#014733]">Legal center</Link>
      </div></header>
      <section className="mx-auto max-w-[900px] px-6 pt-[42px] pb-5">
        <div className="border-b border-[#e3ebe4] pb-[18px]">
          <span className="mb-[18px] inline-block text-[10px] font-extrabold tracking-[.17em] text-[#0f5b3a]">COOKIE POLICY</span>
          <h1 className="my-[10px] text-[clamp(34px,3.7vw,54px)] leading-[1.04] tracking-[-.055em] text-[#13241b]">Cookie Policy</h1>
          <p className="m-0 text-[15px] text-[#68796f]">Effective 2 November 2026 · Updated 2 November 2026</p>
        </div>
        <div className="pt-[18px] [&_p]:text-base [&_p]:leading-[1.8] [&_p]:text-[#3c4d46] [&_li]:text-base [&_li]:leading-[1.8] [&_li]:text-[#3c4d46] [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-[22px] [&_h2]:leading-[1.2] [&_h2]:tracking-[-.04em] [&_h2]:text-[#13261d] [&_a]:text-[#014733] [&_a]:underline [&_a]:underline-offset-2">
          <p>This policy explains how Onselli uses cookies and similar browser technologies. Cookies are small files stored by a website in your browser or device. Our <Link href="/legal/privacy">Privacy Policy</Link> explains our wider use of personal data.</p>

          <h2>1. Technologies we use</h2>
          <p>Onselli may use first-party cookies, local storage, pixels, or similar technologies. We use essential technologies to provide core account and security functions. Optional tools, if enabled, are used for the purposes described in this policy and in the preference controls presented to you.</p>

          <h2>2. Essential technologies</h2>
          <p>Some technologies are necessary to provide a service you request, such as keeping an account signed in, protecting against abuse, remembering security state, or completing a checkout. These cannot be turned off through an optional-analytics control without affecting the service. We limit them to those necessary for the requested function.</p>

          <h2>3. Optional analytics and similar tools</h2>
          <p>Analytics, advertising, or other non-essential technologies should only be enabled after the visitor has made the choice required by the law applicable to their location. They must remain off until consent where consent is required. If Onselli enables an analytics or advertising provider, this policy and the consent interface must name or clearly identify it and explain its purpose before it is activated.</p>

          <h2>4. Your choices</h2>
          <p>You can manage cookies through your browser settings, though browser controls may not remove information stored by other technologies. Where Onselli presents a cookie preference tool, you can use it to accept, reject, or change optional categories and revisit that choice. Optional technologies that require prior consent will not be activated before you consent.</p>

          <h2>5. Third parties</h2>
          <p>Some features may rely on third-party providers, for example identity, payment, fraud prevention, or analytics services. Their technologies are used only when the feature is active and subject to the required notice and consent. Third-party processing is also described in the <Link href="/legal/privacy">Privacy Policy</Link>.</p>

          <h2>6. Updates and contact</h2>
          <p>We will update this policy when the technologies we use change. For questions, contact <a href="mailto:support@onselli.com">support@onselli.com</a>.</p>
        </div>
      </section>
    </main>
  );
}
