import Link from 'next/link';
import Logo from '../../components/Logo';

export const metadata = {
  title: 'Privacy Policy | Onselli',
  description: 'Onselli privacy policy covering personal data, account details, payments, analytics, and user rights.',
};

export default function PrivacyPage() {
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
          <span className="section-overline legal-kicker">PRIVACY POLICY</span>
          <h1>Privacy Policy</h1>
          <p>Effective as of October 2026.</p>
        </div>

        <div className="legal-document__content">
          <p>
            Onselli respects the privacy of the people who use our platform. This Privacy Policy explains how we collect,
            use, disclose, retain, and protect personal information in connection with the Onselli platform and services.
          </p>

          <h2>1. Information we collect</h2>
          <p>
            We may collect information you provide directly to us, such as your name, email address, billing information,
            account profile details, and any content or digital products you upload or sell. We also collect information
            automatically when you use the Service, including device and browser data, IP address, activity logs, and usage
            metrics.
          </p>

          <h2>2. How we use your information</h2>
          <p>
            We use personal data to provide, improve, secure, and personalize the Service. This includes account
            administration, payment processing, order fulfillment, customer support, product analytics, fraud prevention,
            security monitoring, and communication about service updates, offers, or important notices.
          </p>
          <p>
            We may also use your information to understand how features are used and to improve the quality of the
            experience for creators and customers alike.
          </p>

          <h2>3. Sharing with third parties</h2>
          <p>
            We may share personal information with trusted service providers that help operate the platform, such as
            payment processors, cloud infrastructure providers, analytics tools, and customer support systems. These
            providers are bound by contractual obligations to handle data securely and only for the purposes described here.
          </p>
          <p>
            We may also share information when required by law, for legal proceedings, or to protect the legitimate
            interests of Onselli, its users, and the public.
          </p>

          <h2>4. Cookies and tracking technologies</h2>
          <p>
            Onselli uses cookies and related technologies to recognize returning users, remember preferences, analyze
            performance, and support core platform functionality. You can manage cookie preferences through your browser
            settings or the cookie controls presented in our services where available.
          </p>

          <h2>5. Data retention</h2>
          <p>
            We retain personal information only for as long as necessary to fulfill the purposes for which it was
            collected, comply with applicable legal obligations, resolve disputes, and enforce our agreements. When data
            is no longer needed, we remove it or anonymize it in a secure manner.
          </p>

          <h2>6. Your rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, delete, restrict, or object to the
            processing of your personal data. You may also have the right to data portability and to withdraw consent
            where consent is used as the lawful basis for processing. To exercise these rights, contact us at
            <a href="mailto:support@onselli.com">support@onselli.com</a>.
          </p>

          <h2>7. Security</h2>
          <p>
            We implement reasonable administrative, technical, and organizational safeguards designed to protect personal
            information against unauthorized access, use, disclosure, alteration, or destruction. No method of transmission
            or storage is completely infallible, and we cannot guarantee absolute security.
          </p>

          <h2>8. Children&apos;s privacy</h2>
          <p>
            The Service is not directed to children under the age of 13, and we do not knowingly collect personal
            information from children without appropriate parental consent or as required by applicable law.
          </p>

          <h2>9. International transfers</h2>
          <p>
            Data processed by Onselli may be transferred to and stored in countries outside your jurisdiction. Where
            applicable, we implement appropriate safeguards to support lawful and secure international transfers.
          </p>

          <h2>10. Updates to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time to reflect changes in services, legal requirements, or
            operational practices. Material updates will be communicated through the Service or by direct notification
            where appropriate.
          </p>

          <p>
            If you have questions about this policy, please contact us at
            <a href="mailto:support@onselli.com">support@onselli.com</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
