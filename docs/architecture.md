# ONSELLI architecture

## Product boundary

ONSELLI is a discovery, connection, and business-workspace product. PostgreSQL is the
system of record. The MVP records requests, bookings, quotes, orders, and promotion
payments; it does not process customer-to-business checkout, escrow, payouts,
commissions, refunds, or disputes.

## Runtime topology

This repository is a TypeScript modular monolith. `apps/web` is the public discovery
surface and authenticated workspace. `apps/mobile` is the Expo Router client. Both
consume shared contracts in `packages/*` and the same Supabase project. Domain logic is
organized by business capability, not deployment service.

```
apps/{web,mobile} -> packages/{api,auth,validation,types,database,ui,config,utils}
                           -> Supabase (Auth, PostgreSQL/PostGIS, Realtime, Storage,
                                         Edge Functions, pgmq, pg_cron)
```

Next.js server routes/server actions and Supabase Edge Functions are the privileged
boundary. Browser and mobile clients only use the Supabase publishable key. They never
receive service-role, payment, Cloudinary signing, RevenueCat, Resend, or Termii secrets.

## Authorization

Supabase Auth owns identity. `public.users` mirrors the authenticated user and uses the
same UUID. Business data is scoped through `business_memberships`:

```
auth.uid() -> users.id -> business_memberships.user_id -> businesses.id
```

RLS checks membership for business-private records. Customer users can read public
discovery data, their own profile, their conversation membership and messages; business
members cannot read another business's private customers, requests, orders, or documents.
Support/admin privileges are evaluated server-side and in RLS using `users.platform_role`.

## Location and online businesses

`businesses.location_mode` is `PHYSICAL`, `SERVICE_AREA`, or `ONLINE`. Physical
businesses store a PostGIS `geography(Point, 4326)` plus a display address. Service-area
businesses store a point/radius when available. Online businesses require no shop address
and can publish `online_url`; discovery filters must not exclude them merely because they
lack coordinates. Nearby queries use PostGIS, never city text alone.

## Search, media, messaging, promotions

The initial `PostgresSearchProvider` uses maintained full-text vectors, `pg_trgm`,
category/location filters, and cursor pagination. A `SearchProvider` interface isolates
product use-cases from PostgreSQL. Sponsored rows are separately labelled; organic
relevance is never overwritten. Cloudinary holds public imagery and Supabase Storage's
private bucket holds verification files. Conversations use Supabase Realtime. Queued Edge
Functions handle notification fan-out. Promotion entitlement is provider-neutral: verified
Paystack webhooks and RevenueCat both activate the same campaign state.
