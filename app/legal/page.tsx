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
    <main className="legal-page">
      <header className="legal-header">
        <div className="legal-header__inner">
          <Link href="/" className="legal-brand" aria-label="Go to Onselli home">
            <Logo />
          </Link>
          <Link href="/" className="home-button home-button--green legal-back">
            Back to site
          </Link>
        </div>
      </header>

      <section className="legal-hero">
        <div className="legal-hero__panel">
          <span className="section-overline legal-kicker">LEGAL</span>
          <h1>Clear agreements for a trusted platform.</h1>
          <p>
            Onselli is designed to help creators build sustainable businesses with clarity, confidence,
            and respect for both their audience and their own work.
          </p>
          <div className="legal-email">
            <span>Questions?</span>
            <a href="mailto:support@onselli.com">support@onselli.com</a>
          </div>
        </div>
      </section>

      <section className="legal-content legal-content--stacked">
        <div className="legal-grid">
          {legalLinks.map((item) => (
            <Link href={item.href} key={item.href} className="legal-card">
              <span className="legal-card__eyebrow">Read</span>
              <h2>{item.label}</h2>
              <p>{item.summary}</p>
              <span className="legal-card__link">Open document →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
