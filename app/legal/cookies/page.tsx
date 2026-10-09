import Link from 'next/link';
import Logo from '../../components/Logo';

export const metadata = {
  title: 'Cookie Policy | Onselli',
  description: 'Onselli cookie and tracking information for account functionality, analytics, and personalization.',
};

export default function CookiesPage() {
  return (
    <main className="legal-page legal-page--document">
      <header className="legal-header">
        <div className="legal-header__inner">
          <Link href="/" className="legal-brand" aria-label="Go to Onselli home">
            <Logo />
          </Link>
          <Link href="/legal" className="legal-inline-link">Legal center</Link>
        </div>
      </header>

      <section className="legal-document">
        <div className="legal-document__intro">
          <span className="section-overline legal-kicker">COOKIE POLICY</span>
          <h1>Cookie Policy</h1>
          <p>Effective as of October 2026.</p>
        </div>

        <div className="legal-document__content">
          <p>
            Onselli uses cookies and similar technologies to operate and improve the platform. This Cookie Policy explains
            what cookies are, which ones we use, and how you can manage them.
          </p>

          <h2>1. What are cookies?</h2>
          <p>
            Cookies are small text files stored on your device when you visit a website. They help websites remember
            your preferences, understand how visitors use the platform, and improve security and performance.
          </p>

          <h2>2. Types of cookies we use</h2>
          <p>
            We use a mix of strictly necessary cookies, performance cookies, functionality cookies, and marketing or
            analytics cookies. Necessary cookies support core site functionality such as sign-in sessions, security,
            checkout, and site stability. Performance cookies help us understand traffic patterns and feature usage, and
            functionality cookies remember decisions such as locale or dashboard preferences.
          </p>

          <h2>3. Why we use cookies</h2>
          <p>
            We use cookies to deliver the Service securely, remember your preferences, support essential account functions,
            measure engagement, identify issues, and improve the user experience for creators and customers.
          </p>

          <h2>4. Third-party cookies</h2>
          <p>
            Some cookies may be placed by trusted third-party partners, such as analytics providers, payment providers,
            or embedded tooling required for service delivery. These third parties are responsible for their own cookie
            practices and may process data in accordance with their own privacy notices.
          </p>

          <h2>5. Managing your cookie preferences</h2>
          <p>
            You can accept, reject, or manage cookies through your browser settings or by using available cookie
            preferences on the site. Please note that disabling certain cookies may affect service functionality, including
            sign-in, payments, or checkout experiences.
          </p>

          <h2>6. Updates</h2>
          <p>
            We may update this Cookie Policy as our tools and services evolve. Material changes will be reflected in the
            policy and in relevant site notices where appropriate.
          </p>

          <p>
            Questions about cookies or data practices can be sent to
            <a href="mailto:support@onselli.com">support@onselli.com</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
