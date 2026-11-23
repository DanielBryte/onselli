# Onselli platform architecture

## Product

Onselli is a creator business platform. Creators use one workspace to publish a branded website, sell downloads, courses, bundles, and payment links, collect leads, manage contacts, see performance, and manage earnings. Buyers use creator pages, checkout, and their learning library. Admins review risk, KYC, payouts, and support issues.

## Current stack

- **Application:** Next.js App Router with TypeScript strict mode; one codebase serves marketing, creator/buyer/admin pages, and APIs.
- **Database:** Neon Postgres. `DATABASE_URL` is the pooled runtime connection; `DATABASE_URL_UNPOOLED` is reserved for schema migrations.
- **Queries and migrations:** Drizzle ORM and Drizzle Kit. Database contracts are in `src/server/db/schema.ts`; committed SQL migrations live in `drizzle/`.
- **Authentication:** Better Auth with Neon-backed sessions, role/persona onboarding, email verification, password reset, optional Google OAuth, and the two-factor plugin.
- **Files:** Cloudflare R2 for private downloads and KYC material. Do not expose a public bucket or long-lived object URL.
- **Course video:** Bunny Stream handles hosted lesson uploads and playback. Uploads use server-signed TUS credentials; learners receive short-lived signed player embeds only after server-side entitlement checks. Existing YouTube/Vimeo links remain externally hosted.
- **Payments:** Bachs API. Live payment/payout switches remain off pending confirmed platform payout capabilities and account approval.
- **Email:** ZeptoMail API for transactional application messages, React Email for templated markup, and Amazon SES for creator and Onselli newsletter campaigns. Zoho Mail is the human support mailbox only.
- **Jobs:** Upstash Workflow (backed by QStash) for campaign delivery, form notifications, hold release, and expirations. Upstash Redis is used separately for API rate limits.
- **Safety:** Upstash Redis rate limits and Cloudflare Turnstile verification for public forms and checkout.
- **Observability:** Sentry and PostHog dependencies are present; environment configuration and operational dashboards are deployment work.

## Runtime boundaries

```text
Creator / buyer browser
        │
        ▼
Next.js App Router — pages, route handlers, server actions
        │
        ├── Better Auth ── Neon Postgres (Drizzle)
        ├── Upstash Workflow ── durable jobs, retries, and schedules
        ├── ZeptoMail ──── transactional mail
        ├── Amazon SES ─── creator and Onselli campaign mail
        ├── Cloudflare R2 ─ private files and KYC documents
        ├── Bunny Stream ─ signed course video
        └── Bachs API ──── checkout and approved payouts
```

Browser code may use public site keys only. Database, mail, storage, video, payment, encryption, and webhook secrets are server-only. Route handlers validate input, authenticate the caller, check creator/admin ownership, and write audit events for sensitive changes.

## Module map

1. Identity, roles, and onboarding — Better Auth sessions and post-auth persona choice.
2. Creator setup — profile, public slug, branding, timezone, and first actions.
3. Products — courses, digital downloads, one-time bundles, and payment links, priced in integer minor units for NGN or USD.
4. Courses — sections, lessons, learner progress, and Bunny video metadata.
5. Storefront and website — creator site, page builder, published content, SEO, and product rendering.
6. Checkout and orders — order snapshots, Bachs references, payment events, and entitlements.
7. Earnings and payouts — append-only ledger, payout requests, bank destinations, KYC, and review records.
8. Forms and leads — public forms, consent, submissions, status management, notifications, and CSV export.
9. Contacts — contact identity, tags, notes, consent, purchase history, and suppression.
10. Analytics — events, daily aggregates, and creator reporting.
11. Platform operations — admin roles/2FA, audit log, moderation, settings, email logs, and webhook queue.

The schema establishes persistence contracts across these modules. The application uses Neon and Drizzle as its database layer; Better Auth manages identity and sessions.

## Money and access invariants

- Store monetary values as integer minor units in their explicit currency. Never use floating point for balances, fees, order totals, or ledger entries.
- The ledger is append-only; balances are derived from ledger entries grouped by bucket.
- Reserve payout funds atomically. A request or admin decision cannot directly edit ledger history.
- Verify Bachs signatures against the raw body, persist provider event IDs uniquely, and make fulfillment idempotent.
- A browser redirect never grants paid access. Only a verified payment transition creates an entitlement and ledger credit.
- Keep live payments disabled until Bachs confirms seller ownership, payout destination, reconciliation, refunds, and dispute responsibilities for Onselli's intended platform model.
- Private downloads require an active entitlement and short-lived signed URLs. KYC documents are never public.

## Local setup

1. Copy `.env.example` to `.env.local` and configure a disposable development database plus a 32-character `BETTER_AUTH_SECRET`.
2. Run `npm install` and `npm run db:migrate` against the intended development database using the unpooled migration URL. Do not point a sandbox rehearsal at production data.
3. Configure provider credentials individually when enabling those features. Keep `PAYMENTS_LIVE_ENABLED=false` and `BACHS_PLATFORM_READY=false` until provider approval.
4. Start with `npm run dev`.

### Bunny Stream course videos

Set `BUNNY_STREAM_LIBRARY_ID`, that library's Stream API key in `BUNNY_STREAM_API_KEY`, and the library's separate Embed View Token Authentication key in `BUNNY_STREAM_TOKEN_AUTH_KEY`. In Bunny Stream, enable Embed View Token Authentication and set `BUNNY_STREAM_EMBED_TOKEN_AUTH_ENABLED=true` only after confirming that library setting; unsigned embeds are otherwise public. Do not enable public original-file exposure or promise DRM unless it is separately configured and verified with Bunny. Creator uploads use TUS directly from the browser with a one-hour signed authorization; learner player embeds are signed server-side for one hour after an active paid course entitlement is confirmed. These signed embeds limit casual unauthorized access but cannot prevent screen recording or copying after playback.

### Learner course progress

Lesson completion and resumable positions are stored per authenticated buyer and lesson. The progress API rechecks a paid order, active course entitlement, published course/module/lesson, and matching creator ownership on every update. Resume positions are currently collected only from Onselli-hosted Bunny videos through the Bunny Player Player.js `timeupdate` events; YouTube and Vimeo lessons do not report positions to Onselli. Positions are saved periodically and on pause/page exit, with offline updates retained for retry during the session. No additional progress migration is required because `lesson_progress.last_position_seconds` and its user/lesson unique key already exist.

Do not use production credentials in local development. Secrets belong in deployment secret storage, not source control.

### Product launch readiness

Guest checkout sends a transactional receipt and, for course/download/bundle purchases, a single-use email link that establishes a private purchase session. Payment-link purchases receive a receipt without product access. Registered-account buyers see order status on the completion page; a registered-buyer receipt email is not currently implemented. Email delivery is attempted after webhook fulfillment and is not backed by a durable outbox, so delivery failure requires the buyer to request a fresh access email. Bachs checkout, webhook fulfillment, refunds, and dispute operations still require a sandbox rehearsal; code and unit-test coverage alone do not confirm provider behavior.
