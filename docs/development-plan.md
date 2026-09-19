# ONSELLI development plan

## Completed foundation (current change)

1. Establish npm workspaces, strict TypeScript, formatting, environment contract, and shells.
2. Add versioned Supabase migrations for relational schema, indexes, roles, and RLS.
3. Define shared role/domain types and Zod validation for onboarding and listings.
4. Establish the public web shell and Expo Router mobile shell.

## Vertical delivery sequence

1. Business onboarding: auth session handling, create-business RPC, location-mode UI,
   membership bootstrap, and cross-business RLS integration tests.
2. Profile/categories: categories, completion, Cloudinary signing, public storefront.
3. Listings/forms: draft/publish, media metadata, public listing pages, inquiry forms.
4. Discovery: `SearchProvider`, FTS/trigram, PostGIS, cursor pagination, sponsored slots.
5. Connection: Realtime conversations, notifications, CRM, inquiries and quotes.
6. Coordination: order, service request, booking state machines/history.
7. Trust: reviews, reports, blocking, verification, admin queues, analytics.
8. Promotions: packages/campaigns, Paystack verification, RevenueCat, labelled placements.
9. Release hardening: RLS tests, observability, performance, EAS/Vercel/Actions deployment.

## Quality gates

Run `npm run typecheck`, `npm run lint`, relevant tests, and affected builds. Database changes
are migration-only; security-sensitive flows receive RLS integration tests before UI work.
