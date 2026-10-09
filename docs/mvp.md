# Onselli creator web MVP

## Product direction

Onselli is becoming a web platform for creators to build a business around their knowledge. The long-term product connects creation, sales, learning delivery, customer relationships, marketing, community, analytics, and creator operations. The first release should validate one complete creator workflow before broadening into the full platform.

## Current vertical slice

- Email/password sign up and sign in through Supabase Auth.
- Creator profile and public storefront setup.
- Creator product records for courses, downloads, coaching, workshops, and communities.
- Draft and published offer states.
- Public creator directory, storefront, and offer detail pages.
- RLS scopes creator management to its owner and allows public access only to published profiles and offers.

The codebase contains Bachs Connect checkout, order creation, signed webhook processing, creator payout onboarding, entitlement fulfillment, full refunds, and dispute state handling. Production payments remain disabled until Bachs approval, creator settlement terms, support operations, legal responsibilities, and end-to-end live readiness are confirmed. Paystack is a potential secondary processor, but marketplace checkout remains intentionally unavailable until creator settlement onboarding and reconciliation exist.

## Product discovery gates

The recommended initial audience is social-first creators teaching a practical skill. Validate with creator and buyer interviews and a concierge pilot before treating this audience or offer mix as settled. A proposed early continuation signal is several creators independently naming the same sales/delivery pain, five creators agreeing to pilot, and three pilot creators making sales beyond their immediate personal circle.

## Explicitly out of scope for this web MVP

- Native app implementation.
- Automatic payment failover, escrow, automated recurring billing, and unreviewed live payment collection.
- Full course lesson authoring and private asset delivery, learner progress, email campaigns, community, affiliate management, and AI features.
- Marketplace discovery ranking or paid placements.
