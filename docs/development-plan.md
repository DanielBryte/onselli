# ONSELLI development plan

## Creator web platform

1. Keep one Next.js App Router web product as the only app runtime.
2. Organize product behavior around creators, offers, commerce, learning, and payments.
3. Continue versioned Supabase migrations and owner/public RLS for creators and offers.
4. Preserve Supabase Auth, creator workspace, publishing, storefront, order, and learner flows.
5. Confirm the initial creator segment and offer format through interviews and a concierge pilot.

## Release sequence

1. **Creator storefront:** profile setup, offer authoring, draft/publish, discovery, and public offer pages.
2. **Payments readiness:** reconcile Bachs sandbox checkout, Connect, webhooks, refunds, disputes, creator terms, support operations, and live-mode controls.
3. **Buyer and learning experience:** buyer identity, order history, confirmed entitlements, private content delivery, and access revocation.
4. **Learning depth:** course modules/lessons, cohorts/workshops, learner progress, announcements, and support.
5. **Creator growth:** customer history/export, email/lifecycle communication, coupons, bundles, affiliates, analytics, and automation. Initial buyer contacts and sales analytics are implemented in the creator workspace; marketing consent and messaging remain separate follow-up work.
6. **Platform expansion:** custom domains, imports/migration tools, more markets, approved social integrations, team roles, and deeper community capabilities.

## Quality and security principles

- Database changes are migration-only.
- Payment secrets stay server-side. Webhooks are signature-verified and idempotent.
- Never grant paid access from a browser redirect or an uncertain payment state.
- Keep live collection disabled until Bachs Connect requirements and legal/commercial responsibilities are confirmed.
- Paid content must use private storage and authorization checks.
- Web is the product scope; mobile implementation is out of scope.
# Current web checkout implementation

The creator purchase flow uses server-side order creation and provider webhooks as the only source of paid access. Bachs hosted checkout uses Connect direct charges: the creator’s connected account is the merchant of record, receives the balance, and pays the configured platform fee. `ONSELLI_PLATFORM_FEE_BPS` defaults to 1000 (10%) and must be reviewed before launch. Do not automatically retry a declined or ambiguous provider request through another provider because the first processor may still have created a charge.

Required server environment:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never add a `NEXT_PUBLIC_` prefix)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` for private digital product files.
- Bachs is the only supported payment provider. No provider selector is required.
- For Bachs: sandbox `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`, and `BACHS_ENV=sandbox`; switch `BACHS_ENV=live` and use live credentials only after account verification and end-to-end production readiness review.
- `PAYMENTS_LIVE_ENABLED=true` is a deliberate live-mode switch. Bachs additionally requires `BACHS_CONNECT_READY=true`. Keep these false until creator onboarding, payment settlement, refund/dispute handling, and provider approval are operational.

Register the Bachs webhook at `/api/webhooks/bachs` with `event_source=connect` (or `all`) and subscribe to `checkout.completed`, `account.updated`, and `capability.updated`. The Connect events must be delivered for seller accounts. Webhook events are signature-verified and deduplicated; paid orders are matched to the expected connected account, charge, amount, and currency, then fulfillment grants the entitlement atomically. Buyer access is exposed through an authenticated learning library endpoint; creator offer content is held in a separate table and never included in public storefront reads.

Create a private Cloudflare R2 bucket and a bucket-scoped API token with object read/write access. Keep public bucket access disabled. Add a CORS rule allowing `PUT` from the local development origin and Onselli's production origin with the `Content-Type` header. Digital product uploads are limited to 100 MB; the buyer download endpoint checks the active Supabase entitlement and issues a three-minute signed URL.

Refund and risk lifecycle: creators can request a full refund for their paid Bachs direct-charge orders. The order is reserved while Bachs processes the refund; only `refund.paid` marks it refunded and revokes learning access, while `refund.failed` restores the paid state. The creator dashboard warns that the seller balance is debited for the full amount and neither the platform fee nor Bachs processing fee is returned. Subscribe the `connect` webhook endpoint to `refund.created`, `refund.paid`, `refund.failed`, `dispute.created`, and `dispute.updated` as well. Disputes are recorded against their charge and reflected in the creator sales status; a lost dispute revokes access. Creator support procedures and dispute evidence tooling remain launch requirements.

Apply migrations `202610070001_creator_storefronts.sql`, `202610070002_creator_checkout.sql`, `202610070003_refunds_disputes.sql`, `202610130001_bachs_only_payments.sql`, `202610130002_creator_product_files.sql`, and `202610140001_creator_insights.sql` in order. Bachs sandbox requires a `sk_sandbox_...` key and the platform's `connect` capability active. Connect onboarding creates seller accounts and hosted account links, then reads capabilities server-side before allowing USD or NGN checkout. The account ID is stored in a private table, not the public creator profile. The charge is a Connect direct charge: the seller is merchant of record and responsible for their buyer relationship/refunds/disputes; the platform receives a fee from the sale. This responsibility and the 10% default fee must be reflected in creator terms before launch. Bachs direct-charge refund requests must be funded by the seller’s balance; insufficient balances are refused, and the platform fee is not reversed. Bachs Connect must be approved for production; keep `BACHS_CONNECT_READY=false` and `PAYMENTS_LIVE_ENABLED=false` until then.

The creator workspace also includes an owner-scoped Contacts view and Analytics. Contacts list paid buyers and show refunds-adjusted spend separately by currency; analytics use Bachs-confirmed paid orders and confirmed refunds. Product page-view and checkout-start counts are directional event counts, not unique visitors or an attribution-grade conversion report. They should not be used as billing or financial records.
