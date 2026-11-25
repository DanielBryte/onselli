# Onselli creator web MVP

## Product direction

Onselli is becoming a web platform for creators to build a business around their knowledge. The long-term product connects creation, sales, learning delivery, customer relationships, marketing, community, analytics, and creator operations. The first release should validate one complete creator workflow before broadening into the full platform.

## Current vertical slice

- Email/password sign up and sign in through Better Auth backed by Neon Postgres.
- Creator profile and public storefront setup.
- Creator product records for courses, digital downloads, one-time bundles, and payment links.
- Draft and published offer states.
- Direct public storefront and offer detail pages that creators can share with their audiences.
- Server-side Better Auth role and ownership checks scope creator management; public routes expose only published profiles and offers.

The product code includes Bachs hosted checkout, order creation, signed webhook processing, entitlement fulfillment, admin-reviewed refund requests, and dispute event tracking. Guest buyers receive a transactional receipt and, for access products, a single-use purchase link. Registered-account buyers receive the on-screen order confirmation; a registered-buyer receipt email is not currently implemented. Receipt/access email delivery is attempted after webhook fulfillment without a durable outbox, so delivery retries rely on the purchase access recovery flow. These payment and refund paths have not yet completed a Bachs sandbox rehearsal. Live payments and payouts remain disabled pending Bachs approval, creator settlement terms, support operations, legal responsibilities, and end-to-end readiness.

## Product discovery gates

The recommended initial audience is social-first creators teaching a practical skill. Validate with creator and buyer interviews and a concierge pilot before treating this audience or offer mix as settled. A proposed early continuation signal is several creators independently naming the same sales/delivery pain, five creators agreeing to pilot, and three pilot creators making sales beyond their immediate personal circle.

## Explicitly out of scope for this web MVP

- Native app implementation.
- Events, services, and memberships.
- Automatic payment failover, escrow, automated recurring billing, and live payment collection before approval.
- Email campaigns, affiliate management, and AI features.
- Marketplace discovery ranking or paid placements.
