import Link from 'next/link';
import Logo from '../../components/Logo';

export const metadata = {
  title: 'Terms of Service | Onselli',
  description: 'Onselli terms of service covering platform usage, payments, content, and creator obligations.',
};

export default function TermsPage() {
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
          <span className="section-overline legal-kicker">TERMS OF SERVICE</span>
          <h1>Terms of Service</h1>
          <p>Effective as of October 2026.</p>
        </div>

        <div className="legal-document__content">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Onselli platform and
            related services (the &ldquo;Service&rdquo;). By creating an account, subscribing to a plan, or otherwise
            using the Service, you agree to be bound by these Terms.
          </p>

          <h2>1. Overview</h2>
          <p>
            Onselli provides a digital commerce and creator platform that allows individuals and businesses to host
            their offers, sell digital products, deliver learning experiences, and manage customer relationships.
            We provide the infrastructure, but your content, identity, and commercial decisions remain yours.
          </p>

          <h2>2. Eligibility and account responsibility</h2>
          <p>
            You must be at least 18 years old, or have parental or guardian consent where required by law, to use
            the Service. You are responsible for keeping your login credentials secure and for all activity that occurs
            under your account. If you become aware of any unauthorized access, you must notify us immediately at
            <a href="mailto:support@onselli.com">support@onselli.com</a>.
          </p>

          <h2>3. Your content and intellectual property</h2>
          <p>
            You remain the owner of the content you upload or publish through the Service, including courses,
            presentations, digital downloads, written materials, and brand assets. By using Onselli, you grant us a
            limited license to host, process, and distribute that content solely to the extent necessary to provide the
            Service and to support the features you request.
          </p>
          <p>
            You agree not to upload content that violates third-party rights, includes unlawful material, infringes on
            copyright, misrepresents the identity of a person, or contains harmful, deceptive, or abusive material.
          </p>

          <h2>4. Payments, fees, and refunds</h2>
          <p>
            Fees for access to the Service, subscriptions, or transaction processing may apply. Pricing, billing cycles,
            and payment methods are described in the relevant plan details at the time of purchase. You are responsible
            for providing accurate billing information and for any taxes or duties associated with your use of the Service.
          </p>
          <p>
            Refund eligibility depends on the product or plan purchased and any applicable policy shown at checkout or
            in the relevant order details. Unless otherwise stated, digital products and instant-access content are not
            always refundable once access has been granted, subject to applicable consumer protections.
          </p>

          <h2>5. Acceptable use</h2>
          <p>
            You may not use the Service to engage in fraud, phishing, spam, abusive marketing, or any activity that
            materially interferes with the safety, integrity, or performance of the platform. You may not attempt to
            reverse engineer the Service, access data not intended for you, or interfere with other users&apos; access or
            commercial activity.
          </p>

          <h2>6. Service availability and changes</h2>
          <p>
            We work to provide a reliable Service, but we do not guarantee uninterrupted availability or that the Service
            will be free from defect. We may update, improve, suspend, or discontinue features as needed to support the
            platform, maintain security, or comply with applicable law. We will notify users where reasonably necessary.
          </p>

          <h2>7. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service if you breach these Terms, fail to pay charges owed,
            or engage in conduct that risks the platform, other users, or our legal obligations. Upon termination, your
            right to access the Service will end, and we may remove or archive content in accordance with our Privacy
            Policy and applicable legal requirements.
          </p>

          <h2>8. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Onselli provides the Service on an &ldquo;as is&rdquo; basis and does
            not guarantee specific outcomes, revenue, or customer acquisition. We are not liable for indirect,
            incidental, consequential, or punitive damages arising from your use of the Service, except where liability
            cannot be excluded under applicable law.
          </p>

          <h2>9. Governing law and support</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction in which Onselli operates, without regard to
            conflict-of-laws principles. If you have questions or would like to discuss a concern, contact us at
            <a href="mailto:support@onselli.com">support@onselli.com</a>.
          </p>

          <p>
            We may update these Terms from time to time. Continued use of the Service after changes are published
            constitutes acceptance of the revised Terms.
          </p>
        </div>
      </section>
    </main>
  );
}
