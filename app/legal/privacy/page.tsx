import Link from 'next/link';
import Logo from '../../components/Logo';

export const metadata = {
  title: 'Privacy Policy | Onselli',
  description: 'How Onselli uses and protects personal data across creator workspaces, storefronts, and customer purchases.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf7_0%,#f1f6f2_100%)] pb-12 text-[#152219]">
      <header className="border-b border-[#e6ece6] bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1100px] items-center justify-between gap-[18px] px-6 py-[18px]">
        <Link href="/" className="inline-flex items-center" aria-label="Go to Onselli home"><Logo /></Link>
        <Link href="/legal" className="text-[13px] font-bold text-[#244833] hover:text-[#014733]">Legal center</Link>
      </div></header>
      <section className="mx-auto max-w-[900px] px-6 pt-[42px] pb-5">
        <div className="border-b border-[#e3ebe4] pb-[18px]">
          <span className="mb-[18px] inline-block text-[10px] font-extrabold tracking-[.17em] text-[#0f5b3a]">PRIVACY POLICY</span>
          <h1 className="my-[10px] text-[clamp(34px,3.7vw,54px)] leading-[1.04] tracking-[-.055em] text-[#13241b]">Privacy Policy</h1>
          <p className="m-0 text-[15px] text-[#68796f]">Effective 2 November 2026 · Updated 2 November 2026</p>
        </div>
        <div className="pt-[18px] [&_p]:text-base [&_p]:leading-[1.8] [&_p]:text-[#3c4d46] [&_li]:text-base [&_li]:leading-[1.8] [&_li]:text-[#3c4d46] [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-[22px] [&_h2]:leading-[1.2] [&_h2]:tracking-[-.04em] [&_h2]:text-[#13261d] [&_a]:text-[#014733] [&_a]:underline [&_a]:underline-offset-2">
          <p><strong>Before publication, complete:</strong> [LEGAL COMPANY NAME], [REGISTERED ADDRESS], and [PRIVACY/DPO CONTACT]. These details identify the data controller and are required for people to contact the responsible organization. This policy describes Onselli’s current product; update it whenever providers or data practices change.</p>

          <h2>1. Who is responsible for your data?</h2>
          <p>[LEGAL COMPANY NAME] (“Onselli”, “we”, “us”) operates the Onselli platform and is responsible for personal data used to create and secure accounts, operate subscriptions, administer the service, prevent abuse, and meet our legal obligations. Contact us at <a href="mailto:support@onselli.com">support@onselli.com</a> or [PRIVACY/DPO CONTACT].</p>
          <p>Creators decide why they collect information from their customers through creator forms, storefronts, and marketing. For those creator-directed purposes, the creator may be the data controller and Onselli may process data on the creator’s instructions to provide the platform. Onselli may separately use limited data to secure the platform, administer transactions, handle support, and comply with law. A creator’s own privacy notice applies to their independent use of customer data.</p>

          <h2>2. Personal data we handle</h2>
          <ul>
            <li><strong>Account and workspace data:</strong> name, email, authentication and account settings, profile and business details, country, and workspace content.</li>
            <li><strong>Commerce records:</strong> product and order details, transaction references, subscription status, payout requests, and limited payout destination information. Card details are collected by the payment provider, not stored by Onselli.</li>
            <li><strong>Creator/customer data:</strong> contact details, form responses, support messages, consent and unsubscribe status, and creator-uploaded content.</li>
            <li><strong>Technical and security data:</strong> device/browser information, session and access logs, approximate network identifiers, rate-limit/security signals, and usage events.</li>
            <li><strong>Support and compliance records:</strong> identity or business verification information and records needed to resolve disputes, prevent fraud, administer payouts, and meet legal duties.</li>
          </ul>
          <p>Do not use general creator forms to collect passwords, payment-card data, bank credentials, government identifiers, health information, or children’s information. If a feature specifically requests verification data, provide only what is requested through that secured flow.</p>

          <h2>3. Why and on what basis we use data</h2>
          <p>We use personal data to provide accounts and workspaces; publish storefronts; process orders and subscriptions; deliver products; manage contacts and support; maintain security; prevent fraud and abuse; troubleshoot and improve the Service; communicate operational messages; and meet accounting, tax, and legal duties. Where required, we use consent for optional marketing, non-essential cookies, or other consent-based processing. We rely on contract, legal obligation, legitimate interests, and consent as appropriate to the purpose and applicable law.</p>
          <p>Creators are responsible for selecting and documenting a lawful basis for their own marketing and customer-data uses. We do not treat the act of submitting a form or buying a product as consent to marketing.</p>

          <h2>4. When we share data</h2>
          <p>We share only the information needed with service providers that host or operate parts of Onselli, such as database and cloud-storage providers, authentication and security services, payment processors, transactional and campaign email providers, job-processing services, and error or product analytics tools when enabled. Providers must be subject to appropriate contractual safeguards and may use the data only for the services they provide to us.</p>
          <p>We may disclose information to a creator when you interact with that creator’s offer; to payment, banking, or fraud-prevention partners to process or investigate a transaction; to professional advisers; or to authorities where legally required or necessary to protect people, rights, and the Service. We do not sell personal data.</p>

          <h2>5. International processing</h2>
          <p>Our providers may process data in countries outside Nigeria or your country. Before a transfer, Onselli must use a transfer basis and safeguards required by applicable data-protection law, such as an adequacy decision, approved contractual protection, or another permitted ground. Contact us if you would like information about the safeguards relevant to your data.</p>

          <h2>6. How long we keep data</h2>
          <p>We keep data only for as long as needed for the stated purpose, to provide the Service, resolve disputes, enforce agreements, protect against fraud, and meet legal or accounting duties. Different records have different retention periods. When a creator or user closes an account, some data may remain in backups for a limited backup cycle or in transaction, security, suppression, or legal records where retention is necessary. Onselli must maintain and follow an internal retention schedule; contact us to ask about the period for a particular record.</p>

          <h2>7. Your choices and rights</h2>
          <p>Depending on applicable law, you may have the right to request access, correction, deletion, restriction, objection, or portability; withdraw consent; and complain to a data-protection authority. You can unsubscribe from creator marketing using the link in the message. To exercise a privacy right, email <a href="mailto:support@onselli.com">support@onselli.com</a> with enough information for us to locate your data. We may ask for reasonable verification and may need to retain some information to meet legal obligations or protect others’ rights.</p>
          <p>If your data relates to a creator’s independent use, contact that creator first. We will assist the creator as required by our contract and applicable law.</p>

          <h2>8. Security and incidents</h2>
          <p>We use administrative and technical safeguards designed to protect personal data, including access controls, encryption for payout account details, abuse prevention, and monitoring. No system is risk-free. If a security incident affects your data, we will investigate, contain it, preserve relevant evidence, and notify the appropriate authority and affected people when required by law.</p>

          <h2>9. Children</h2>
          <p>Onselli’s creator and customer account services are intended for people aged 18 or older. Creators must not knowingly collect or market to children through the Service without a lawful basis and any required parental authorization. If you believe a child has provided personal data, contact us so we can review and take appropriate action.</p>

          <h2>10. Cookies and analytics</h2>
          <p>Necessary cookies support sign-in, security, and core operation. Optional analytics or similar technologies should be used only with the choice and consent required in the visitor’s location. See our <Link href="/legal/cookies">Cookie Policy</Link> for details. We must keep that policy aligned with the actual cookies and tools enabled in production.</p>

          <h2>11. Changes and complaints</h2>
          <p>We will update this policy when our data practices or legal obligations materially change and show the new effective date. Where required, we will notify you or ask for consent. If you are not satisfied with our response, you may complain to the Nigeria Data Protection Commission or another authority with jurisdiction over you.</p>
          <p>Privacy contact: [PRIVACY/DPO CONTACT]. General support: <a href="mailto:support@onselli.com">support@onselli.com</a>. Postal address: [REGISTERED ADDRESS].</p>
        </div>
      </section>
    </main>
  );
}
