import Link from 'next/link';
import Logo from '../../components/Logo';

export const metadata = {
  title: 'Terms of Service | Onselli',
  description: 'Terms governing creator and customer use of the Onselli platform.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7faf7_0%,#f1f6f2_100%)] pb-12 text-[#152219]">
      <header className="border-b border-[#e6ece6] bg-white/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1100px] items-center justify-between gap-[18px] px-6 py-[18px]">
        <Link href="/" className="inline-flex items-center" aria-label="Go to Onselli home"><Logo /></Link>
        <Link href="/legal" className="text-[13px] font-bold text-[#244833] hover:text-[#014733]">Legal center</Link>
      </div></header>
      <section className="mx-auto max-w-[900px] px-6 pt-[42px] pb-5">
        <div className="border-b border-[#e3ebe4] pb-[18px]">
          <span className="mb-[18px] inline-block text-[10px] font-extrabold tracking-[.17em] text-[#0f5b3a]">TERMS OF SERVICE</span>
          <h1 className="my-[10px] text-[clamp(34px,3.7vw,54px)] leading-[1.04] tracking-[-.055em] text-[#13241b]">Terms of Service</h1>
          <p className="m-0 text-[15px] text-[#68796f]">Effective 2 November 2026 · Updated 2 November 2026</p>
        </div>
        <div className="pt-[18px] [&_p]:text-base [&_p]:leading-[1.8] [&_p]:text-[#3c4d46] [&_li]:text-base [&_li]:leading-[1.8] [&_li]:text-[#3c4d46] [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-[22px] [&_h2]:leading-[1.2] [&_h2]:tracking-[-.04em] [&_h2]:text-[#13261d] [&_a]:text-[#014733] [&_a]:underline [&_a]:underline-offset-2">
          <p><strong>Operator details must be completed before these terms are published as final:</strong> replace <em>[LEGAL COMPANY NAME]</em>, <em>[COMPANY NUMBER]</em>, and <em>[REGISTERED ADDRESS]</em> with the registered details of the Onselli operating entity. This draft is written for Onselli’s current creator-commerce service and needs Nigerian legal review, particularly for payment and marketplace responsibilities.</p>

          <h2>1. Who these terms cover</h2>
          <p>These Terms govern your access to onselli.com, the Onselli workspace, creator storefronts hosted by Onselli, and related services (the “Service”). The Service is operated by [LEGAL COMPANY NAME], company number [COMPANY NUMBER], of [REGISTERED ADDRESS] (“Onselli”, “we”, “us”). By creating an account or using the Service, you agree to these Terms. If you use the Service for a business, you confirm that you can bind that business to these Terms.</p>
          <p>“Creator” means a person or business using Onselli to publish or sell offers. “Customer” means a person who visits a storefront, submits a form, books a service, or buys an offer. Some people may use the Service in both roles.</p>

          <h2>2. Eligibility and accounts</h2>
          <p>You must be at least 18 and legally able to enter a contract to create an account or sell through Onselli. Keep your account information accurate, protect your credentials and authentication factors, and tell us promptly at <a href="mailto:support@onselli.com">support@onselli.com</a> if you suspect unauthorized access. You are responsible for activity under your account unless it resulted from our failure to use reasonable security.</p>
          <p>We may require identity, business, tax, or payout information to verify an account, prevent fraud, meet legal obligations, or enable a feature. Do not submit information you are not authorized to provide.</p>

          <h2>3. The Service and creator offers</h2>
          <p>Onselli provides tools for creators to publish storefronts, offer digital products and courses, collect leads, manage contacts, send permitted marketing messages, and review business activity. Feature availability may depend on your plan, location, account status, and third-party provider availability.</p>
          <p>Unless the checkout page expressly identifies Onselli as the seller, the creator named on the offer and checkout is responsible for the offer, its description, price, delivery, support, and applicable refund or cancellation terms. Onselli provides the platform and may coordinate payment processing and order delivery through service providers. The checkout disclosure for a particular transaction controls who the buyer contracts with and how payment is processed. Onselli does not become the creator’s agent or reseller solely because it hosts an offer.</p>
          <p>Creators must provide accurate information before purchase, deliver what they advertised, comply with consumer, tax, privacy, intellectual-property, and marketing laws that apply to them, and respond to customer issues promptly. Creators must not collect payment card credentials through forms or store them in Onselli content fields.</p>

          <h2>4. Prices, subscriptions, payments, and refunds</h2>
          <p>The price, currency, billing interval, taxes, renewal terms, and payment provider for an order or subscription will be shown before you confirm payment. Subscription prices may be charged in USD where shown. Your bank or card issuer may apply conversion rates or fees. A plan’s usage limits, including contact, email, workspace, and storage limits, are shown in the plan details and may change prospectively with reasonable notice.</p>
          <p>Payments are processed by the provider named at checkout. Onselli does not request or store full card numbers or security codes. Where creator payouts are offered, they are subject to verification, provider rules, settlement, reserves, disputes, and applicable law. A pending balance is not a promise that funds are immediately withdrawable. We may delay or restrict a payout where reasonably necessary to investigate fraud, resolve a dispute, verify identity, or comply with law, and will provide an explanation where permitted.</p>
          <p>The seller’s refund, cancellation, and digital-delivery terms must be shown before purchase. Mandatory consumer rights continue to apply and cannot be excluded by a “no refunds” label. For a problem with a creator’s offer, contact the creator first using the contact details shown at checkout; you may also contact <a href="mailto:support@onselli.com">support@onselli.com</a> if the issue concerns the platform, payment status, or an unresolved complaint. Nothing here limits a right to a refund or other remedy required by law.</p>

          <h2>5. Creator content and intellectual property</h2>
          <p>Creators retain ownership of content they upload. They grant Onselli a worldwide, non-exclusive, royalty-free license to host, reproduce, process, display, transmit, and make that content available only as needed to operate, secure, support, and promote the Service as requested by the creator. This license ends when the content is deleted, except for copies retained in backups, transaction records, or as required by law.</p>
          <p>Creators must own or have permission to use their content, brand assets, customer lists, and other materials. Do not upload unlawful, deceptive, infringing, abusive, or harmful material; facilitate fraud; sell prohibited goods or services; or use the Service to send unsolicited bulk messages. Customers may use purchased content only under the license or terms provided by its creator.</p>
          <p>To report alleged copyright infringement or other unlawful content, email <a href="mailto:support@onselli.com">support@onselli.com</a> with the relevant URL, a description of the issue, your contact details, and evidence that you are authorized to make the report. We may remove or restrict access to reported content while we review it and may suspend repeat infringers.</p>

          <h2>6. Privacy and customer communications</h2>
          <p>Our <Link href="/legal/privacy">Privacy Policy</Link> explains how Onselli handles personal data. Creators are responsible for having a lawful basis and giving required notices when they collect or use customer information through their storefronts, forms, exports, and marketing tools. Marketing consent must be separate, clear, optional where required, and recorded; a purchase or form submission alone is not permission to send marketing.</p>
          <p>Creators must honor unsubscribes and suppression requests, use customer data only for disclosed and lawful purposes, secure exports, and delete data they no longer need. Do not upload purchased, scraped, or otherwise unlawfully obtained contact lists.</p>

          <h2>7. Suspension and termination</h2>
          <p>You may stop using the Service at any time. We may restrict or suspend access where reasonably necessary to protect users, investigate suspected abuse or security incidents, enforce these Terms, address non-payment, or comply with law. Where practicable, we will explain the reason and provide a way to appeal. We may terminate an account for a serious or repeated breach, or where we are legally required to do so.</p>
          <p>On account closure, creators should export information they are entitled to keep. We will handle remaining personal data under the Privacy Policy and applicable retention duties. Closing an account does not cancel an outstanding payment, refund, chargeback, tax, or legal obligation.</p>

          <h2>8. Service changes and disclaimers</h2>
          <p>We may update or discontinue features to maintain security, improve the Service, or meet legal or provider requirements. We will give reasonable notice of material changes when practical. We work to keep the Service available but do not promise uninterrupted operation or particular commercial results. Nothing in these Terms excludes a statutory guarantee or other liability that applicable law does not allow us to exclude.</p>

          <h2>9. Liability</h2>
          <p>To the extent permitted by law, neither party is liable to the other for indirect or consequential losses that were not reasonably foreseeable. Nothing in these Terms limits liability for fraud, willful misconduct, death or personal injury caused by negligence, a breach of a non-excludable consumer right, or any other liability that cannot lawfully be limited. Any other liability cap must be clearly stated in the final terms and reviewed for enforceability before publication.</p>

          <h2>10. Complaints and governing law</h2>
          <p>Contact <a href="mailto:support@onselli.com">support@onselli.com</a> for platform complaints. Include the account email, transaction reference or storefront URL, and a description of the issue; do not email passwords, full bank details, or payment-card information. We aim to acknowledge complaints within five business days and provide a meaningful update within 15 business days, or explain why more time is needed. These response targets do not shorten any statutory deadline or consumer right.</p>
          <p>These Terms are governed by the laws of the Federal Republic of Nigeria, subject to mandatory consumer protections and any non-waivable right to bring a claim in another competent forum. Before publication, counsel should confirm the correct operating entity, dispute forum, and whether this governing-law clause suits Onselli’s customer locations.</p>

          <h2>11. Changes and contact</h2>
          <p>We may update these Terms to reflect changes in the Service or law. We will post the updated version and effective date and give notice of material changes where required. Continued use after the effective date means you accept the changes, except where applicable law requires a different form of consent.</p>
          <p>Legal notices: [LEGAL COMPANY NAME], [REGISTERED ADDRESS]. General support: <a href="mailto:support@onselli.com">support@onselli.com</a>.</p>
        </div>
      </section>
    </main>
  );
}
