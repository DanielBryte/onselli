import Link from 'next/link';
import Logo from '../../components/Logo';

export const metadata = {
  title: 'Cookie Policy | Onselli',
  description: 'How Onselli uses cookies and similar technologies on its platform.',
};

export default function CookiesPage() {
  return (
    <main className="legal-page legal-page--document">
      <header className="legal-header"><div className="legal-header__inner">
        <Link href="/" className="legal-brand" aria-label="Go to Onselli home"><Logo /></Link>
        <Link href="/legal" className="legal-inline-link">Legal center</Link>
      </div></header>
      <section className="legal-document">
        <div className="legal-document__intro">
          <span className="section-overline legal-kicker">COOKIE POLICY</span>
          <h1>Cookie Policy</h1>
          <p>Effective 2 November 2026 · Updated 2 November 2026</p>
        </div>
        <div className="legal-document__content">
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
