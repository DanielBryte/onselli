# Onselli: Full Platform Build Specification

Source: Untitled.pdf (26 pages)

> **Current product decision (November 21, 2026):** Appointment bookings are removed from the product scope. The active launch supports courses, digital downloads, payment links, and bundles. Booking requirements later in this source document are superseded and must not be implemented unless the product scope changes again.


## Source page 1

Untitled
Onselli: Full Platform Build Prompt
Oct 17, 2026 · @Daniel Ezediniru
Onselli is a Naira-first platform where creators and small businesses sell digital products,
take bookings, collect leads and get paid, all in one place. This is the full build specification
for the MVP, including the admin panel that approves payouts.
Working rules
You are the lead engineer building Onselli. This document is the single source of truth: if
the code and this document disagree, stop and ask.
Save this document in the repo as docs/SPEC.md before writing code, and update it
whenever a decision changes.
Read the whole document first. Your first reply is a short Phase 0 plan plus any
blocking questions. Write no code in that reply, then wait.
Build one phase at a time (see "Testing, quality bar and build phases"). At the end of
each phase run typecheck, lint and tests, list what works and what you skipped, then
wait for approval.
Ask before you add a dependency outside the stack, change a money or ledger rule, or
deviate from this spec. Do not ask about anything this spec already decides.
Never invent Bachs API behaviour. Read docs.bachs.io and its OpenAPI spec. Where
they are silent, build behind the PaymentProvider interface, state your assumption,
and cover it with a test that uses a recorded fixture.
Build nothing listed under "Not in the MVP", and add no AI features. Design so those
items can be added later, but ship none of them.
Never commit secrets. Commit .env.example and validate environment variables at
startup.
Write tests in the same commit as the code, and always for money, ledger, booking-slot
and permission code.
Use small pull requests and conventional commit messages, for example
feat(payouts): reserve funds on request .
Provide a seed script: one demo creator with a course, a download, a payment link, a
form, a booking service and a published site, plus one buyer and one admin, so every
screen can be reviewed with data.
Page 1 of 26

## Source page 2

Untitled
Product and money model
Onselli lets creators, coaches and small-business owners in Nigeria sell what they know
and run the work around it from one place: products, a website, forms, contacts, bookings,
reports and payouts. It is Naira-first and mobile-first, and its tagline is "Run. Sell. Grow."
Who uses it
Creator: sells products, takes bookings, collects leads and requests payouts.
Buyer: pays, then uses a library of courses, downloads and bookings.
Admin team: approves KYC and payouts, and handles refunds, disputes and reports.
How money moves
1. A buyer pays through Bachs hosted checkout. Every payment lands in Onselli's Bachs
account, so Onselli collects on behalf of creators.
2. After Onselli verifies the payment, it records the order and credits the creator's ledger
with the net amount: the sale minus the platform fee and the processing fee. The credit
stays pending for the hold period, then becomes available.
3. A creator with approved KYC and a verified bank account requests a payout. The
amount is reserved in the ledger at once.
4. An admin approves or rejects the request. On approval, Onselli asks Bachs to withdraw
the money to the creator's bank account.
5. Bachs confirms by webhook and the ledger entry becomes final. A failure puts the
reserved amount back into the creator's available balance.
The MVP does not use Bachs Connect (connected accounts and transfers). Admin
approval means Onselli, not Bachs, decides when money leaves.
What Onselli replaces
Every tool in your screenshot maps to an Onselli module; forms, sheets, calendar and
payments arrive in the MVP, while WhatsApp and Instagram automation arrive in v2.
Tool today What creators use it Onselli module Release
for
Google Forms Customer forms, Forms with a MVP
collecting requests submissions inbox
Page 2 of 26

## Source page 3

Untitled
Tool today What creators use it Onselli module Release
for
Google Sheets Sales, customer and Contacts, orders, MVP
and Excel inventory tracking; reports with CSV
records, reports and export, sales caps for
calculations limited stock
Google Appointments and Appointment booking MVP (Google
Calendar bookings with reminders and Calendar sync in v2)
calendar files
Bachs Payment tracking and Checkout, payment MVP
payment workflows links, orders, earnings
ledger and payouts, all
on Bachs
Instagram Product discovery, Link-in-bio site MVP (DM
social selling template, QR codes automation in v2)
and share links
WhatsApp Customer WhatsApp chat MVP (inbox and
conversations, order button on sites and ManyChat-style
inquiries one-tap WhatsApp automation in v2)
links on every contact
Courses, downloads and the website builder cover what Kajabi, Selar and Nestuge do. The
rows above are what make Onselli more than a course checkout.
MVP scope
Twelve modules ship in the MVP. Items marked (added) are mine, beyond your list; the
next table explains why each belongs.
Module What it does in the MVP
1. Accounts and profile Sign up with email and password or Google; verify
email; creator profile with name, slug, bio, avatar,
WhatsApp number and social links; onboarding
checklist (added)
Page 3 of 26

## Source page 4

Untitled
Module What it does in the MVP
2. Products Three digital product types: course, downloadable
files, and payment link (added). Free or paid in
NGN; cover, description and refund window;
publish or unpublish; coupon codes (added);
optional sales cap (added); share link and QR code
(added)
3. Course builder Sections and lessons; video, text and file lessons;
drag to reorder; draft and publish; free-preview
lessons; student player with progress and resume
4. Checkout and orders Bachs hosted checkout; receipts and access
emails; order list and detail; free-product claim
with email capture (added); refund requests
5. Forms Form builder with 9 field types and 5 starter
templates; success message or redirect; email
notifications; submissions inbox; CSV export; spam
protection (added)
6. Leads and contacts Contacts created from forms, checkout, bookings
and CSV import; tags, notes and follow-up status;
search and filters; activity timeline; customers
view; email, call and WhatsApp buttons (added)
7. Appointment booking Services with duration and price; weekly hours and
date overrides; buffers and minimum notice;
timezones; free or paid; confirmation and reminder
emails; reschedule and cancel; .ics calendar file; list
and calendar views
8. Website builder 5 templates; multiple pages; 16 section types;
theme settings; SEO fields; mobile preview; publish
at onselli.com/c/your-name
9. Analytics and reports Overview dashboard; traffic and conversion
funnel; sales, customer, lead and booking reports;
payout statement; CSV export on every report
Page 4 of 26

## Source page 5

Untitled
Module What it does in the MVP
10. Earnings, KYC and payouts Pending, available and in-payout balances; ledger
statement; KYC form; bank accounts with account-
name check; payout requests with status tracking
and email alerts
11. Admin panel Dashboard; creators; KYC queue; payout
approvals; refunds and disputes; moderation;
platform settings; audit log; mandatory two-factor
sign-in
12. Platform essentials (added) Transactional email; buyer library; legal pages and
consent checkboxes; rate limiting; SEO basics;
error monitoring; backups
What I added, and why
Addition Why it belongs in the MVP
Free products with email capture Lead magnets are the cheapest way to fill the
contacts list.
Coupon codes Every launch and promotion needs a discount
code.
Payment links Service sellers need to collect a custom amount
without building a product; this replaces payment
tracking in other tools.
Sales cap Limited seats or copies; covers the inventory-
tracking job creators do in spreadsheets.
QR codes and share links Social selling without DM automation: post or
print a QR code for any page, product, form or
booking.
WhatsApp chat button and one-tap Bridges to the v2 WhatsApp inbox; WhatsApp is
links where Nigerian customers talk.
Onboarding checklist Takes a new creator to a first product, a published
page and a first share; the biggest activation
lever.
Page 5 of 26

## Source page 6

Untitled
Addition Why it belongs in the MVP
Spam protection and rate limits Public forms and booking pages get abused
within days of launch.
Platform essentials A product that handles money cannot launch
without emails, legal pages, monitoring and
backups.
Not in the MVP (nothing here gets built)
The first two are your v2 list. The rest are my cuts to keep the MVP shippable.
WhatsApp and Instagram inbox and automation (the ManyChat alternative), v2
Workflow automation, v2
Email broadcasts and campaigns
Subscriptions and memberships
Order bumps, upsells and affiliates
Quizzes, certificates and drip scheduling
Community and live classes
Custom domains
Invoices
Google Sheets and Google Calendar sync
USD and other currencies
Staff accounts
Native mobile apps
AI features
Tech stack and architecture
Onselli is one TypeScript codebase on Next.js and Postgres, and everything that is not
Onselli's own product is bought in. Pin exact versions and commit the lockfile.
Page 6 of 26

## Source page 7

Untitled
Layer Choice What it does in Onselli
App framework Next.js (App Router), React, Marketing site, creator
TypeScript strict dashboard, buyer area, public
creator sites and admin panel in
one app
UI Tailwind CSS, shadcn/ui, Radix, Design system, accessible
Motion, Lucide components, light animation
Forms and React Hook Form, Zod The same Zod schemas validate
validation on the client and the server
Tables and TanStack Table, Recharts Contacts, orders and payout
charts queues; analytics charts
Rich text Tiptap Lesson content and product
descriptions
Drag and drop dnd-kit Curriculum, form fields and site
sections
Database Managed Postgres (Supabase used All data; extensions citext,
as Postgres only) pg_trgm and btree_gist
ORM and Drizzle ORM, drizzle-kit Typed queries and SQL
migrations migrations (custom SQL for
constraints Drizzle cannot
express)
Auth Better Auth Email and password, Google,
email verification, password
reset, roles, two-factor for
admins
Payments Bachs, behind a PaymentProvider Checkout, refunds, disputes,
interface bank lookup and payouts
Video Bunny Stream Upload, encoding and signed
playback for lessons
Files and images Cloudflare R2 Downloads, KYC documents
(private) and published images
(public bucket on a CDN domain)
Page 7 of 26

## Source page 8

Untitled
Layer Choice What it does in Onselli
Background jobs Inngest Webhook processing, emails,
reminders, expiries, rollups and
reconciliation
Email ZeptoMail with React Email All transactional email; Amazon SES for creator and Onselli campaigns
Rate limits and Upstash Redis Rate limiting and short-lived
cache caches
Bot protection Cloudflare Turnstile Signup, public forms, booking and
report pages
Dates and times Luxon Timezone-safe booking,
reminders and reports
Calendar files ics package .ics files for bookings
CSV Papa Parse Contact import; streamed CSV
export
QR codes qrcode package QR codes for shareable links
Analytics First-party events table for Creator traffic stats; funnel and
creators; PostHog for Onselli's own usage analytics for you
product analytics
Errors and Sentry; an external uptime monitor Error tracking and downtime
uptime alerts
Testing Vitest, Playwright, fast-check Unit and property tests; end-to-
end journeys
CI and hosting GitHub Actions; Vercel Pro Checks on every pull request;
hosting and previews (Vercel's
free plan is for non-commercial
use only)
Architecture rules
1. One Next.js app. Domain code lives in src/server/<module> (auth, catalog, courses,
checkout, ledger, payouts, kyc, forms, contacts, booking, sites, analytics, admin,
emails). Pages, route handlers and server actions call these services. Components
never touch the database.
Page 8 of 26

## Source page 9

Untitled
2. Every creator-owned table has creator_id . All creator queries go through repository
helpers that require a creator id, and a test fails if a query on a creator-owned table
leaves it out.
3. Authorize in the service layer ( requireCreator() , requireBuyer() ,
requireAdmin(permission) ), never only in the UI or middleware.
4. Validate every boundary with Zod. Server actions return { ok: true, data } or {
ok: false, error } .
5. Money is integer kobo in the database and in code ( bigint plus currency ). Convert
to and from Bachs decimal strings only inside the Bachs adapter. Never use floats.
6. Webhooks: verify the signature on the raw body, store the raw event, return 200
quickly, process in Inngest, and keep every handler idempotent.
7. Public pages (creator sites, product pages, marketing) are statically rendered with tag-
based revalidation. Dashboard, learning and admin pages are dynamic.
8. Files and video are never public by URL. Issue signed, short-lived URLs only after an
entitlement check.
9. Use the pooled (transaction-mode) database connection at runtime with prepared
statements disabled, and the direct connection for migrations. Run the database and
the Vercel functions in the same region, as close to Lagos as your providers allow
(London or Cape Town).
10. Read environment variables through one typed schema; the app refuses to boot if a
required variable is missing. Keep separate sandbox and live Bachs keys per
environment.
11. Put a request id in every log line, run Sentry on server and client, and write an audit-log
row for every sensitive action.
12. Change the schema only through drizzle-kit migrations, and never edit a migration that
has been applied.
Roles, permissions and routes
There are two kinds of everyday users and four admin roles, and every route below needs
a service-layer permission check, not only a hidden button.
Buyer: any signed-in user. Owns a library of courses, downloads and bookings.
Creator: a user with a creator profile. A creator can also be a buyer.
Page 9 of 26

## Source page 10

Untitled
Admin roles: super_admin , finance , compliance and support . Admin pages always
require two-factor sign-in. In production, give admins separate email addresses from
their creator accounts.
Action Creator Support Compliance Finance Super
admin
Manage own products, site, forms, contacts Yes – – – –
and bookings
View any creator's data (read-only) – Yes Yes Yes Yes
Resend emails, fix a creator's contact details – Yes – – Yes
Approve or reject KYC – – Yes – Yes
Approve or reject payouts – – – Yes Yes
Process refunds and handle disputes – Request – Yes Yes
only
Suspend a creator, unpublish content, handle – Yes – – Yes
reports
Manual ledger adjustment (reason and fresh – – – – Yes
two-factor code required)
Change platform settings and fees – – – – Yes
View the audit log – – Yes Yes Yes
Routes
Area Routes Notes
Marketing / , /features , /templates , /pricing , Static
/about , /contact , /blog , /legal/*
Auth /login , /signup , /forgot-password ,
/reset-password , /verify-email
Public creator /c/[creator] , /c/[creator]/[page] , p , book , f and other
sites /c/[creator]/p/[product] , reserved words can never be
/c/[creator]/book/[service] , page slugs
/c/[creator]/f/[form]
Checkout /checkout/[orderId] , The return page only shows
/checkout/return status and never grants
access
Page 10 of 26

## Source page 11

Untitled
Area Routes Notes
Buyer /library , /learn/[course] , Booking page opens from a
/learn/[course]/[lesson] , signed email link without
/orders/[orderId] , sign-in
/bookings/[bookingId] , /account
Creator /dashboard , /dashboard/products Dynamic
dashboard (with /new , /[id] , /[id]/curriculum ,
/[id]/students ), /dashboard/forms
(with /[id] , /[id]/submissions ),
/dashboard/contacts (with /[id] ),
/dashboard/orders (with /[id] ),
/dashboard/bookings (with /services ,
/availability ), /dashboard/site ,
/dashboard/analytics ,
/dashboard/reports ,
/dashboard/earnings ,
/dashboard/settings (profile, payouts,
notifications)
Admin /admin (with Two-factor required), /admin/payouts
/admin/refunds , /admin/disputes ,
/admin/reports , /admin/templates ,
/admin/settings , /admin/audit-log ,
/admin/webhooks
API /api/auth/[...all] ,
/api/webhooks/bachs ,
/api/webhooks/ses , /api/workflows/campaign-dispatch , /api/workflows/form-notification , /api/workflows/maintenance ,
/api/uploads/* , /api/track
Slug rules. A creator slug is 3 to 30 characters: lowercase letters, numbers and hyphens,
unique, and not on the reserved list (admin, api, dashboard, login, signup, checkout,
library, learn, legal, blog, and similar system words, stored in settings). Changing a slug
keeps the old one redirecting through creator_slug_history . Product, form, service and
page slugs are unique per creator and must not equal a reserved word.
Page 11 of 26

## Source page 12

Untitled
Data model
The database has about 45 tables in 11 groups. These conventions apply to all of them, and
the tables follow.
Primary keys are UUID v7. Every table has created_at and updated_at as
timestamptz (UTC).
Money is bigint kobo plus currency char(3) (default NGN ). Never numeric or
floats.
Emails use citext . Phone numbers are E.164 text, normalised with libphonenumber-js
(default region NG).
Every creator-owned table has creator_id NOT NULL and an index that starts with it.
jsonb columns are validated by Zod at the boundary and carry a schema_version .
Status columns are Postgres enums or text with a check constraint. Soft delete
( deleted_at ) is used only where noted.
Group Tables and key columns
1. Identity user , session , account , verification ,
two_factor (managed by Better Auth). creators
(user_id unique, slug unique citext, display_name,
bio, avatar_key, whatsapp_e164, timezone default
Africa/Lagos, status active or suspended,
kyc_status, storage_used_bytes,
fee_bps_override). creator_slug_history (slug,
creator_id)
2. Catalog products (creator_id, type course, download or
payment_link, title, slug, description jsonb,
cover_key, price_minor, currency, amount_type
fixed or customer_chooses, min_amount_minor,
max_sales, refund_window_days, status draft,
published or archived, thank_you jsonb; unique
creator_id + slug). product_files (product_id,
r2_key, name, size_bytes, content_type, position).
coupons (creator_id, code, type percent or fixed,
value, product_ids, max_redemptions,
one_per_buyer, starts_at, ends_at, active; unique
creator_id + lower(code)). coupon_redemptions
(coupon_id, order_id)
Page 12 of 26

## Source page 13

Untitled
Group Tables and key columns
3. Courses course_sections (product_id, title, position).
lessons (section_id, type video or text, title,
content jsonb, bunny_video_id, video_status,
duration_seconds, is_free_preview, status draft or
published, position, deleted_at).
lesson_attachments (lesson_id, r2_key, name,
size_bytes). lesson_progress (user_id, lesson_id,
completed_at, last_position_seconds; unique
user_id + lesson_id)
4. Commerce orders (number unique, buyer_user_id nullable,
contact_id, creator_id, status pending, paid, failed,
expired, cancelled, refunded or needs_review,
currency, subtotal_minor, discount_minor,
total_minor, platform_fee_minor,
processor_fee_minor, net_to_creator_minor,
coupon_id, provider, provider_ref unique, paid_at,
expires_at). order_items (order_id, product_id,
title_snapshot, unit_price_minor, quantity = 1).
payments (order_id, provider_ref, charge_id,
status, amount_minor, raw jsonb). entitlements
(user_id, product_id, order_id, status active or
revoked, granted_at). refunds (order_id,
requested_by, status requested, approved,
rejected, processing, refunded or failed, reason,
decision_message, provider_ref, decided_by).
disputes (order_id, provider_ref, status,
amount_minor, evidence jsonb, due_at)
Page 13 of 26

## Source page 14

Untitled
Group Tables and key columns
5. Money ledger_entries (creator_id, type, bucket
pending, available, reserved or held, amount_minor
signed, currency, ref_type, ref_id,
idempotency_key unique, created_by). payouts
(creator_id, amount_minor, currency, status
requested, approved, processing, paid, rejected,
cancelled or failed, bank_snapshot jsonb,
requested_at, decided_by, decided_at,
decision_reason, risk_flags jsonb, provider_ref,
paid_at, failure_reason). bank_accounts
(creator_id, bank_code, bank_name,
account_number_encrypted, last4, account_name,
verified_at, is_default, usable_from,
provider_destination_id, deactivated_at).
kyc_submissions (creator_id, version, status
submitted, approved or rejected, data_encrypted,
document_keys, reviewed_by, reviewed_at,
rejection_reason)
6. Contacts contacts (creator_id, email, phone_e164, name,
source, stage lead or customer, status new,
contacted, in_progress, won or lost,
marketing_consent_at, unsubscribed_at,
total_spent_minor, orders_count, last_activity_at;
unique creator_id + email where email is not null;
unique creator_id + phone_e164 where email is
null). tags (creator_id, name). contact_tags .
contact_notes (contact_id, author_user_id, body)
7. Forms forms (creator_id, title, slug, status, fields jsonb,
settings jsonb, submissions_count).
form_submissions (form_id, creator_id,
contact_id, data jsonb, source_page, utm jsonb,
status new, read or archived, ip_hash)
Page 14 of 26

## Source page 15

Untitled
Group Tables and key columns
8. Booking booking_services (creator_id, title, slug,
duration_minutes, price_minor,
buffer_before_minutes, buffer_after_minutes,
min_notice_hours, max_days_ahead,
slot_step_minutes, cancellation_window_hours,
location_type, location_details, intake_questions
jsonb, status). availability_rules (creator_id,
weekday, start_time, end_time).
availability_overrides (creator_id, date, kind
unavailable or custom, start_time, end_time).
bookings (service_id, creator_id, contact_id,
order_id, starts_at, ends_at, blocked_from,
blocked_until, status pending_payment,
confirmed, cancelled, completed or no_show,
client_timezone, answers jsonb,
manage_token_hash, cancelled_by,
reminders_sent jsonb)
9. Sites site_templates (name, preview_key,
default_theme jsonb, default_pages jsonb,
enabled). sites (creator_id unique, template_id,
theme jsonb, nav jsonb, seo jsonb, status draft or
published, published_at). pages (site_id, slug, title,
is_home, position, draft_content jsonb,
published_content jsonb, seo jsonb; unique site_id
+ slug)
10. Analytics events (creator_id, type, page_type, ref_id,
visitor_hash, referrer_host, utm jsonb, device,
country, occurred_at). daily_stats (creator_id,
date, metric, dimension, value)
Page 15 of 26

## Source page 16

Untitled
Group Tables and key columns
11. Platform webhook_events (provider, event_id, type,
payload, status, attempts, processed_at, error;
unique provider + event_id). audit_logs
(actor_user_id, action, entity_type, entity_id,
before jsonb, after jsonb, ip, user_agent).
settings (key, value jsonb). email_log (to,
template, status, provider_id). content_reports
(target_type, target_id, reason, reporter_email,
status, handled_by)
Constraints that must exist in the database, not only in code
bookings : an exclusion constraint on (creator_id, tstzrange(blocked_from,
blocked_until)) for statuses pending_payment and confirmed (needs btree_gist;
write it as a custom SQL migration).
ledger_entries : no UPDATE or DELETE for the application's database role, plus a
trigger that rejects both as a second guard.
entitlements : one active entitlement per user and product (partial unique index).
payouts : at most one payout per creator in requested , approved or processing
(partial unique index).
orders.provider_ref and webhook_events (provider, event_id) are unique.
Ledger and balances
The ledger is the only source of truth for what a creator is owed: balances are always
computed from it and never stored as editable numbers.
Rules
1. ledger_entries is append-only. Corrections are new entries, never edits.
2. Each entry is one signed amount in one bucket. Buckets: pending (earned, inside the
hold period), available (can be requested), reserved (locked by a payout request),
held (locked by a dispute).
3. A creator's balance in a bucket is the sum of amount_minor for that creator and
bucket.
Page 16 of 26

## Source page 17

Untitled
4. available can go negative only through a refund or a lost dispute after the money
was released. While it is negative the creator cannot request payouts, and new sales
repay it first.
5. Every entry carries an idempotency key built from its cause ( sale:{order_id} ,
release:{order_id} , payout_reserve:{payout_id} ), so a retried job can never
credit or debit twice.
6. A payout request runs in one database transaction that locks the creator's balance row
( SELECT ... FOR UPDATE on a per-creator lock row), re-reads available , checks the
amount, and writes the reserve entries and the payout together. Two parallel requests
can never overspend.
7. Fees on each order: platform_fee = round_half_up(total × fee_bps / 10,000)
using the creator's fee_bps_override if set, else the platform setting. processor_fee
comes from the Bachs payment detail when present, otherwise from the
processor_fee_estimate_bps setting. net_to_creator = max(0, total −
platform_fee − processor_fee) . Store all three on the order when it is paid; they
never change afterwards.
8. Amounts are NGN only in the MVP, but every entry carries a currency.
Entries written for each event
Event Entries (bucket: amount) Triggered by
Sale paid pending: +net Verified payment
Hold period ends pending: −net , available: Hourly Inngest job,
+net payout_hold_days after
paid_at
Refund confirmed pending: −net if still in hold, Bachs refund confirmation
otherwise available: −net
Payout requested available: −amount , Creator request
reserved: +amount
Payout rejected, reserved: −amount , Admin, creator or Bachs result
cancelled or failed available: +amount
Payout paid reserved: −amount (final) Bachs confirmation
Page 17 of 26

## Source page 18

Untitled
Event Entries (bucket: amount) Triggered by
Dispute opened available: −net , held: Bachs dispute event
+net (or from pending if still
in hold)
Dispute won held: −net , available: Dispute outcome
+net
Dispute lost held: −net Dispute outcome
Manual adjustment available: ±amount , reason Super admin only
required
A refund debits exactly the net that was credited for that order, so the creator never pays
back more than they received.
Nightly reconciliation (Inngest)
Every paid order has exactly one sale entry.
Every paid payout has matching entries and a Bachs withdrawal reference.
The sum of all creator balances does not exceed Onselli's Bachs balance.
Any mismatch raises a Sentry alert and appears on the admin dashboard.
Settings behind these rules (all editable by a super admin; values are placeholders to
confirm)
Setting Placeholder
platform_fee_bps 500 (5%)
processor_fee_estimate_bps 150 (1.5%)
payout_hold_days 3
min_payout_minor 500000 (₦5,000)
bank_change_cooloff_hours 24
Products, checkout and delivery
Three product types share one checkout: course, download and payment link. Courses
are digital products, as you described.
Page 18 of 26

## Source page 19

Untitled
Product basics
Fields: title, slug (unique per creator), cover image, description (rich text), price in NGN
(0 means free), status (draft, published or archived), refund window (0, 7, 14 or 30 days;
0 means no refunds), optional sales cap, thank-you message or redirect URL, and SEO
title and description.
Course: built in the course builder (next sections of this document).
Download: 1 to 10 files, up to 200 MB each, stored privately in R2. Buyers download
from their library through 60-second signed URLs.
Payment link: a fixed amount or a customer-chosen amount with a minimum, plus a
description. It has no fulfilment and works without an account, so creators can collect
for services.
Minimum paid price: the min_price_minor setting (placeholder ₦100; confirm Bachs's
own minimum).
Sales cap: max_sales empty means unlimited. Paid orders plus unexpired pending
orders count against the cap. At the cap the page shows "Sold out" and checkout is
blocked.
Coupons: percent or fixed, for all products or chosen ones, with start and end dates, a
maximum number of redemptions and an optional one-per-buyer rule. The server
validates a coupon when the order is created and again when payment arrives. A
redemption counts only once the order is paid. A discount never makes a price
negative, and fees are computed on the discounted total.
Share tools: every published product has a shareable URL, a copy-link button, a
WhatsApp share link and a downloadable QR code (SVG and PNG).
Checkout flow
1. The buyer opens /c/[creator]/p/[product] and clicks Buy.
2. The checkout form asks for name, email, phone (optional per product), a coupon code,
a required consent checkbox for the terms and refund policy, and an unchecked
marketing-contact checkbox. Courses and downloads need an account, so the buyer
signs up or signs in inline (email and password, or Google) with the email prefilled.
Payment links need no account.
3. The server creates the order as pending with expires_at 30 minutes ahead
( order_expiry_minutes ), snapshots prices, applies the coupon, computes the fees,
and creates the contact if it is new.
4. The server asks Bachs for a checkout session for the order total and redirects the
buyer to Bachs hosted checkout.
Page 19 of 26

## Source page 20

Untitled
5. Bachs confirms by webhook. The handler verifies the payment with Bachs, checks that
amount and currency match the order, marks the order paid, writes the ledger entry,
creates the entitlement (or marks the payment link paid), updates the contact (stage
customer, totals) and queues the emails.
6. /checkout/return polls the order status, then links to the library, the course or the
download. Never grant access from this page.
7. Pending orders expire after 30 minutes (Inngest job). If a verified payment arrives for
an expired order, the buyer did pay, so reopen the order and fulfil it.
Free products. Skip step 4: the order is created already paid with a total of 0, the
entitlement is granted, and the contact is created with source "free product" and the
marketing-consent choice recorded. The endpoint is rate limited and protected by
Turnstile.
Delivery
/library lists everything the buyer owns, grouped as courses, downloads and
bookings, with progress on courses.
Order numbers look like ONS- plus 6 uppercase base32 characters, unique across the
platform.
The receipt email and the order page show the order number, items, discount, total and
payment reference.
A refund revokes the entitlement immediately (see "Refunds, disputes and
moderation").
Course builder and learning area
Creators build a course from sections and lessons in a drag-and-drop editor, and students
learn in a player that remembers where they stopped.
Creator side ( /dashboard/products/[id]/curriculum )
A course has sections, and sections have lessons. Create, rename, reorder (dnd-kit,
with a keyboard alternative) and delete both. Deleting a lesson that has student
progress soft-deletes it.
Lesson types: video and text, each with optional file attachments.
Video upload: the browser uploads straight to Bunny Stream with a resumable (TUS)
upload, using a short-lived signature the server creates. The app stores the Bunny
video id and shows Processing, Ready or Failed, updated by Bunny's webhook or by
Page 20 of 26

## Source page 21

Untitled
polling. Maximum 2 GB per video ( max_video_bytes ) and 10 GB per creator
( storage_quota_bytes ), both checked before the upload starts.
Text lessons: Tiptap with headings, bold, italics, lists, links, images, quotes, dividers and
YouTube or Vimeo embeds. Content is saved as JSON and sanitised on save and on
render. No raw HTML.
Attachments: up to 5 files per lesson, 50 MB each, stored privately in R2.
Each lesson is draft or published, and has a Free preview toggle that lets anyone view it
from the product page before buying.
Autosave with a visible Saved state. "Preview as student" opens the player read-only.
A course can be published only when it has a title, a cover, a price (or free) and at least
one published lesson.
Students tab ( /dashboard/products/[id]/students ): name, email, enrolment date,
progress percentage and last activity, with CSV export.
Student side ( /learn/[course]/[lesson] )
Layout: a curriculum sidebar (a drawer on mobile), the lesson area, and Previous and
Next buttons.
Every lesson request checks for an active entitlement or the free-preview flag. Video
plays in Bunny's player with a signed token that the server issues per page load and
that expires after 2 hours. Turn off direct MP4 access in the Bunny library and limit
allowed referrers to onselli.com. This deters casual copying but cannot stop screen
recording, so do not promise otherwise.
Progress: a Mark complete button; video lessons complete automatically at 90%
watched; the playback position is saved every 10 seconds; the course page shows
percent complete and a Continue button that opens the next unfinished lesson.
When a creator adds lessons, existing students see them. Unpublished lessons
disappear from the sidebar but keep their progress records.
A refund or revoked entitlement ends access at once and keeps the progress data.
Keep the player's quality menu visible so students on slow connections can pick a
lower resolution.
Not in the MVP: quizzes, certificates, drip scheduling, comments, captions.
Page 21 of 26

## Source page 22

Untitled
Forms and leads
Forms replace Google Forms and feed the contacts list, so every submission becomes a
lead.
Builder ( /dashboard/forms/[id] )
Nine field types: short text, long text, email, phone, number, dropdown, single choice,
multiple choice and date. Each field has a label, help text, placeholder, a required
switch and, where relevant, options. Phone fields normalise to E.164 with Nigeria as the
default region. Fields can be reordered by drag (dnd-kit), duplicated and deleted. A
form can have up to 50 fields.
Five starter templates: Contact us, Lead capture, Service request or quote, Event
registration, Feedback.
Settings: title, description, button text, success message or redirect URL, notification
emails (default: the creator's), an optional confirmation email to the submitter with a
custom message, close date, maximum submissions, an optional one-submission-per-
email rule, and a toggle for the Powered by Onselli line.
A form is draft or published. A published form has a hosted page at
/c/[creator]/f/[form] , can be placed on the site through the Form section, and has
a copy link, a WhatsApp share link and a QR code.
Not in the MVP: file uploads, payments inside forms, conditional logic, multi-step forms
and embedding on other websites.
What happens on submit (public endpoint)
1. Rate limit per IP and per form (Upstash), verify the Turnstile token, check the hidden
honeypot field, and reject if the form is closed or full.
2. Validate against the form's saved fields with a Zod schema built from them. Reject
unknown keys, trim every value and cap lengths (long text at 5,000 characters).
3. Find or create the contact by email, or by phone when there is no email. A new contact
gets stage lead and source form: <title> . An existing contact gets a new activity
entry and a refreshed last_activity_at , and only blank fields are filled in.
4. Store the submission with the page and UTM parameters, and increase the form's
counter.
5. Queue the creator's notification email and the optional confirmation to the submitter.
The marketing-consent checkbox is unchecked by default and stored with a
timestamp.
6. Show the success message or redirect.
Page 22 of 26

## Source page 23

Untitled
Submissions inbox ( /dashboard/forms/[id]/submissions )
A table with search, a date filter, a status filter (new, read, archived) and a column per
field (the first five, the rest in a detail drawer). A row opens the full submission beside
the contact card.
Actions: mark read or unread, archive, tag the contact, open the contact, reply by
email, WhatsApp, call.
CSV export of the current filter, streamed. A badge in the dashboard navigation counts
new submissions.
Contacts, customers and orders
Each person gets one contact record per creator, built automatically from forms,
checkout, bookings and imports, so creators stop keeping customer lists in spreadsheets.
Contacts
A contact is created from a form submission, an order (paid or free), a booking, a
manual add or a CSV import. Match by email (case-insensitive), otherwise by phone
(E.164). The unique constraints prevent duplicates.
Stage is automatic: Lead until the first paid order, then Customer. The creator sets the
follow-up status: New, Contacted, In progress, Won or Lost. Tags are free-form per
creator.
List page: search by name, email or phone (trigram index), filters (stage, status, tag,
source, date added, has booking, total spent), sorting, bulk actions (tag, change status,
delete, export), cursor pagination at 25 rows, and a card layout on mobile.
Detail page: profile fields, tags, timestamped notes, an activity timeline (submissions,
orders, bookings, notes, status changes), lifetime spend and order count, and action
buttons for email ( mailto: ), call ( tel: ) and WhatsApp (a wa.me link with a prefilled
message).
Customers view: contacts with stage Customer, showing total spent, order count and
last purchase.
Import CSV: up to 5,000 rows, with a column-mapping step, a preview, a choice to skip
or update duplicates, and a downloadable error file. Imported contacts have no
marketing consent unless the file has a consent column set to yes.
Export CSV: the current filter, streamed.
Deleting a contact removes their personal data but keeps the order records in
anonymised form for accounting. The confirmation dialog says so.
Page 23 of 26

## Source page 24

Untitled
Orders ( /dashboard/orders )
List: filters for status, product, date range and coupon; search by order number, buyer
name or email; columns for order, buyer, items, total, fees, net, status and date; a totals
row for the current filter; CSV export.
Statuses: pending, paid, failed, expired, cancelled, refunded and needs_review (a
payment that did not match the order; only admins resolve it). Creators never edit
money fields.
Detail: items, discount, fee breakdown (platform fee, processing fee, net to you),
payment reference, buyer, status history, access status (course progress for courses)
and refund state.
Actions: resend receipt, resend access email, request a refund on the buyer's behalf,
copy the order link.
Inventory: the products table shows sold count and, for capped products, copies or
seats remaining.
Appointment booking
Booking replaces Google Calendar for appointments: creators publish services, visitors
pick a slot, and a double booking is impossible.
Creator setup
Services ( /dashboard/bookings/services ): title, description, duration (15 to 240
minutes), price (0 means free), buffer before and after, minimum notice in hours, how
many days ahead people can book, slot step (15, 30 or 60 minutes), location (online link,
phone call, in person or other) with details shown only after booking, optional intake
questions that reuse the form field types, an optional cancellation window in hours,
and status draft or published.
Availability ( /dashboard/bookings/availability ): weekly hours with several ranges
per day, the creator's timezone (default Africa/Lagos), date overrides (day off or
custom hours), and vacation ranges. The MVP has one availability schedule per creator,
shared by all services.
A published service has a page at /c/[creator]/book/[service] , a Booking section
for the site builder, a copy link, a WhatsApp share link and a QR code.
Slot generation (server)
Page 24 of 26

## Source page 25

Untitled
Compute free slots in UTC for the next max_days_ahead days: availability rules in the
creator's timezone, minus date overrides, minus existing bookings including their
buffers, respecting minimum notice and the slot step.
Show times in the visitor's detected timezone with a visible timezone selector. The
confirmation shows both the visitor's time and the creator's time.
Never trust the client: recompute and re-check the slot on the server when the
booking is submitted.
Test with a fixed clock across timezones, including a visitor in a timezone that observes
daylight saving.
Booking flow
1. The visitor picks a service, a date and a slot, then enters name, email, phone and any
intake answers. Turnstile protects the form.
2. The server creates the booking in a transaction. A free service is confirmed at once. A
paid service is pending_payment , holds the slot for 15 minutes
( booking_hold_minutes ), creates an order, and sends the visitor to Bachs checkout.
3. The payment webhook confirms the booking. An Inngest job cancels unpaid holds
when they expire and frees the slot.
4. Concurrency is settled by the database: the exclusion constraint on (creator_id,
tstzrange(blocked_from, blocked_until)) rejects any overlap. On a violation, show
"That time was just taken. Pick another slot."
5. Emails: confirmation to the visitor and the creator with an .ics attachment and a
manage link; reminders 24 hours and 1 hour before (Inngest sleepUntil ), each
switchable per service.
Managing a booking
The manage link in the email carries a random token (stored hashed) and opens
/bookings/[bookingId] with reschedule and cancel, no account needed. Visitors can
change or cancel until the cancellation window starts. Creators can reschedule, cancel
or mark completed or no-show at any time from the dashboard.
Refunds on paid bookings: a full refund starts automatically when the creator cancels,
or when the visitor cancels before the window. After the window there is no automatic
refund, and the creator can refund by hand.
Dashboard ( /dashboard/bookings ): an Upcoming list (the default on mobile), day, week
and month views, filters by service and status, a booking detail panel with the contact
card and actions, and a Today widget on the overview.
Page 25 of 26

## Source page 26

Untitled
Not in the MVP: Google or Outlook calendar sync, automatic Zoom or Google Meet links,
group sessions, recurring appointments and multiple staff.
Page 26 of 26
