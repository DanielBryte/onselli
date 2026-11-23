# Onselli development plan

## Product modules

The launch scope is identity/onboarding, creator setup, four product types, courses, storefront/website, checkout/orders, earnings/payouts, forms/leads, contacts, analytics, and platform operations. Appointment booking is out of scope.

## Stack and delivery sequence

1. **Foundation:** Next.js App Router, TypeScript strict, Neon Postgres, Drizzle migrations, Better Auth, and server-side authorization.
2. **Creator launch:** role onboarding, creator profile, product creation, public storefront, website builder, and forms.
3. **Commerce:** Bachs hosted checkout, integer-kobo fee snapshots, idempotent signed webhooks, entitlements, refunds, and dispute handling.
4. **Buyer experience:** course authoring, Bunny Stream playback, private downloads, learning library, and transactional account mail. Purchase receipt email is not implemented yet.
5. **Creator operations:** contacts and consent, analytics, append-only ledger and payout requests.
6. **Platform operations:** admin 2FA, KYC review, payout queues, audit/moderation/settings, alerts, backups, and data retention.

## Current status

The launch product scope implemented in the current code is courses (curriculum, resources, Bunny video, progress, and quizzes), digital downloads (private files or external links), one-time bundles, payment links, product/storefront pages, checkout, orders, and access delivery. Events, services, and memberships are outside this release scope. Bachs sandbox checkout and webhook flows still require a credentialed end-to-end rehearsal; production collection and payout remain disabled. Purchase receipt email is not implemented. Data from any former Supabase project must be exported and reconciled into Neon separately before launch.

## Environments & release management

- **Production:** [onselli.com](https://onselli.com) (tracked by `master` branch)
- **Staging:** [onselli-dev](https://onselli-dev) (tracked by `dev` branch)
- **Branch & deployment workflow:** See [docs/git-workflow.md](file:///c:/Users/DELL%20USER/Desktop/Projects/onselli/docs/git-workflow.md) for full branch rules, Conventional Commit standards, and staging/prod promotion sequence.

## Release constraints

- Keep Bachs live collection and payout disabled until permitted platform settlement, destination ownership, reconciliation, refund, and dispute responsibilities are confirmed.
- Keep KYC and bank data private and encrypted; restrict access to authorized compliance and finance admins.
- Do not grant entitlements from redirects, email callbacks, or unverified webhooks.
- Use database migrations for schema changes and retain an auditable, append-only financial ledger.
- Before launch, run money, ledger, and authorization tests, complete a provider sandbox rehearsal, and verify backup restoration.
- Apply and verify all Drizzle migrations on the intended deployment database before launch; never use a production database for the sandbox rehearsal.
