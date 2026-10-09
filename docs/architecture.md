# Onselli web product architecture

## Product direction

Onselli is a web-first operating platform for creators who teach, coach, and sell expertise. It helps a creator move from an audience on X, TikTok, YouTube, Instagram, or email to an owned business: a public creator page, paid or free offers, checkout, learner access, and customer relationships. The product is not a local business directory and does not require a native mobile app.

## Runtime and deployment boundary

The product is a TypeScript modular monolith with one Next.js App Router application rooted at `/app`. Run it directly from the repository root with `npm run dev`. Supabase provides authentication, PostgreSQL with row-level security, and private storage. Keep browser code limited to publishable configuration. Credentials, provider calls, webhook verification, order creation, refunds, and entitlement changes stay server-side.

```text
Creator / learner browser
        │
        ▼
app/ — Next.js pages, server routes, server actions
lib/ ├── domains            creator, offer, commerce, learning rules
     ├── payments           Bachs and Paystack provider adapters
     └── Supabase           auth, PostgreSQL/RLS, private storage
```

## Product domains

- **Identity and creator profile:** Auth user identity, public slug, brand, biography, and connected social links.
- **Offers:** Courses, downloads, workshops, coaching, and later memberships or cohorts. Offer content and publication status belong to the creator.
- **Storefront and discovery:** Public creator page and offer pages are the shareable destination for social audiences. Discovery is an optional acquisition surface; each creator owns their audience relationship.
- **Commerce:** Orders, payment attempts, refunds, disputes, and webhook event ledger. A provider callback alone never grants access.
- **Learning:** Entitlements are derived from confirmed orders and control access to private course/download content. Revocation follows refunds or lost disputes.
- **Creator operations:** Sales, payout onboarding and status, learner support, and later analytics/CRM.

Keep route files as thin HTTP/UI adapters. Put reusable validation and domain rules in feature-owned modules rather than coupling product behavior to page components or provider payloads. Internal `packages/` are domain/database contracts only; there is no separate web or mobile app workspace.

## Route map

- `/` — public product and creator acquisition page
- `/signup`, `/login` — identity entry points
- `/creator/*` — authenticated creator setup, offers, sales, and payout workspace
- `/c/[slug]` and `/c/[slug]/[productSlug]` — creator-owned public storefront and offer pages
- `/learn` — buyer learning library, guarded by entitlements
- `/discover` — optional creator/offer discovery
- `/api/checkout` — authenticated order and checkout-session creation
- `/api/webhooks/{provider}` — signed, idempotent provider event ingestion

`/studio/*` is retained as a temporary redirect to `/creator/*` for existing links.

## Payments architecture

Bachs is the preferred checkout and connected-account provider. Paystack is a separately configured secondary provider for the currencies and settlement models it can support. Select the provider before creating an order, persist that provider and its identifiers, and process its webhook independently. Do not silently retry a second processor after an ambiguous timeout: that can charge a buyer twice. A fallback attempt is safe only when the first provider confirms failure or an operator-approved recovery flow establishes that no charge can settle.

Normalize provider operations behind an adapter boundary, while retaining provider-specific account, checkout, charge, refund, and dispute IDs. Verify signatures over the raw webhook body, record event IDs under a unique constraint, validate amount/currency/account against the order, and fulfill an order atomically and idempotently. Keep live payment controls disabled until merchant settlement roles, platform fees, tax/refund/dispute ownership, regional coverage, and support operations are explicitly approved.

## Persistence and authorization

`auth.uid()` identifies the signed-in person. `creators.user_id` establishes creator ownership; products and creator operations are scoped through the creator. RLS is the enforcement layer for user-facing reads and writes. Service-role access is server-only and must check the caller’s identity and ownership before privileged mutations. Anonymous users can read only published creator and offer records.

Never store paid course files in a public bucket. Grant learning access only after server-side payment confirmation; serve private assets through an ownership-checked route or short-lived signed URL. Refunds and chargebacks update the entitlement state through the same commerce domain.

## Build sequence

1. Reliable creator profile and offer publishing.
2. Safe hosted checkout, payment confirmation, and learner entitlement delivery.
3. Creator sales and payout operations, with provider reconciliation and refund/dispute support.
4. Email capture, launch tools, analytics, and imports from creator social channels.
5. Courses, memberships, cohorts, community, and workflow automation based on creator demand.

Do not add broad integrations or marketplace features ahead of proving the full creator-to-paid-learner loop.
