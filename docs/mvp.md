# ONSELLI MVP scope

## Included

Discovery across categories, businesses, products, services, storefronts, search, location,
and shareable links; customer messaging, inquiries, quotes, requests, bookings, orders,
reviews, forms/data collection, notifications, verification, moderation, and paid promoted
visibility.

## Explicitly excluded

Customer-to-business payment, checkout, escrow, commissions, seller payouts, refunds,
disputes, microservices, Redis, AI features, and a dedicated search engine.

## Business location modes

- `PHYSICAL`: public shop address and map point.
- `SERVICE_AREA`: operating point and optional radius; address can remain private.
- `ONLINE`: no shop address; show website/social/contact channels and fulfil remotely.

Listings may expose configurable inquiry forms. Form submissions create a typed inquiry and
are visible only to the customer and authorized business members.

## First vertical slice

An authenticated user can create a business, select online/physical/service-area mode,
become its owner, create a draft listing, and publish it after required validation. Public
web can render published storefront shells. RLS protects private data.
