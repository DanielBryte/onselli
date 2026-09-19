-- ONSELLI core schema. Apply only through Supabase migrations.
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists postgis;

create type public.platform_role as enum ('CUSTOMER','BUSINESS_OWNER','BUSINESS_ADMIN','BUSINESS_STAFF','SUPPORT','ADMIN');
create type public.membership_role as enum ('OWNER','ADMIN','STAFF');
create type public.location_mode as enum ('PHYSICAL','SERVICE_AREA','ONLINE');
create type public.listing_kind as enum ('PRODUCT','SERVICE');
create type public.publication_status as enum ('DRAFT','PUBLISHED','HIDDEN','ARCHIVED');
create type public.request_status as enum ('PENDING','ACCEPTED','REJECTED','CANCELLED','COMPLETED');
create type public.promotion_status as enum ('DRAFT','PENDING_PAYMENT','ACTIVE','PAUSED','EXPIRED','CANCELLED');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  platform_role public.platform_role not null default 'CUSTOMER',
  full_name text,
  avatar_asset_id text,
  phone text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), parent_id uuid references public.categories(id),
  name text not null, slug text not null unique, description text, image_asset_id text,
  status public.publication_status not null default 'DRAFT', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.businesses (
  id uuid primary key default gen_random_uuid(), owner_user_id uuid not null references public.users(id),
  name text not null, slug text not null unique, description text, category_id uuid references public.categories(id),
  status public.publication_status not null default 'DRAFT', location_mode public.location_mode not null default 'ONLINE',
  address text, city text, state text, country text, location geography(Point,4326), service_radius_meters integer,
  online_url text, logo_asset_id text, cover_asset_id text, is_verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint business_location_mode_check check (
    (location_mode = 'ONLINE' and address is null and location is null) or
    (location_mode = 'PHYSICAL' and address is not null and location is not null) or
    (location_mode = 'SERVICE_AREA' and service_radius_meters is not null)
  ),
  constraint business_radius_check check (service_radius_meters is null or service_radius_meters > 0)
);
create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.membership_role not null, created_at timestamptz not null default now(),
  primary key (business_id,user_id)
);
create table public.listings (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id), kind public.listing_kind not null, title text not null, slug text not null unique,
  description text, status public.publication_status not null default 'DRAFT', price_amount numeric(12,2), currency char(3),
  search_vector tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  constraint listing_price_currency_check check ((price_amount is null and currency is null) or (price_amount >= 0 and currency is not null))
);
create table public.listing_images (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  cloudinary_asset_id text not null, public_id text not null, alt_text text, width integer, height integer, position smallint not null default 0,
  created_at timestamptz not null default now(), unique(listing_id, public_id)
);
create table public.listing_tags (listing_id uuid not null references public.listings(id) on delete cascade, tag text not null, primary key(listing_id,tag));
create table public.customers (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references public.users(id), name text not null, email text, phone text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(business_id,user_id)
);
create table public.customer_notes (id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade, author_user_id uuid not null references public.users(id), body text not null, created_at timestamptz not null default now());
create table public.conversations (id uuid primary key default gen_random_uuid(), business_id uuid references public.businesses(id) on delete cascade, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.conversation_members (conversation_id uuid not null references public.conversations(id) on delete cascade, user_id uuid not null references public.users(id) on delete cascade, last_read_at timestamptz, created_at timestamptz not null default now(), primary key(conversation_id,user_id));
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade, sender_user_id uuid not null references public.users(id), body text, attachment_path text, created_at timestamptz not null default now(), deleted_at timestamptz, constraint message_content_check check (body is not null or attachment_path is not null));
create table public.inquiries (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), listing_id uuid references public.listings(id), customer_user_id uuid references public.users(id), form_data jsonb not null default '{}'::jsonb, status public.request_status not null default 'PENDING', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.quotes (id uuid primary key default gen_random_uuid(), inquiry_id uuid not null references public.inquiries(id) on delete cascade, business_id uuid not null references public.businesses(id), amount numeric(12,2), currency char(3), message text, status public.request_status not null default 'PENDING', expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), customer_id uuid references public.customers(id), status public.request_status not null default 'PENDING', notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.order_items (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, listing_id uuid references public.listings(id), title_snapshot text not null, quantity integer not null check(quantity > 0), unit_price numeric(12,2));
create table public.order_status_history (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, status public.request_status not null, changed_by_user_id uuid references public.users(id), created_at timestamptz not null default now());
create table public.service_requests (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), listing_id uuid references public.listings(id), customer_user_id uuid references public.users(id), details text not null, status public.request_status not null default 'PENDING', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.bookings (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), listing_id uuid references public.listings(id), customer_user_id uuid references public.users(id), status public.request_status not null default 'PENDING', starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.booking_slots (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), starts_at timestamptz not null, ends_at timestamptz not null, capacity smallint not null default 1 check(capacity > 0), check(ends_at > starts_at));
create table public.booking_status_history (id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade, status public.request_status not null, changed_by_user_id uuid references public.users(id), created_at timestamptz not null default now());
create table public.reviews (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), listing_id uuid references public.listings(id), author_user_id uuid not null references public.users(id), rating smallint not null check(rating between 1 and 5), body text, status public.publication_status not null default 'PUBLISHED', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.review_replies (id uuid primary key default gen_random_uuid(), review_id uuid not null unique references public.reviews(id) on delete cascade, author_user_id uuid not null references public.users(id), body text not null, created_at timestamptz not null default now());
create table public.review_reports (id uuid primary key default gen_random_uuid(), review_id uuid not null references public.reviews(id) on delete cascade, reporter_user_id uuid not null references public.users(id), reason text not null, created_at timestamptz not null default now(), unique(review_id,reporter_user_id));
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade, type text not null, payload jsonb not null default '{}'::jsonb, read_at timestamptz, created_at timestamptz not null default now());
create table public.business_verifications (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade, submitted_by_user_id uuid not null references public.users(id), document_path text not null, status public.request_status not null default 'PENDING', reviewed_by_user_id uuid references public.users(id), created_at timestamptz not null default now(), reviewed_at timestamptz);
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_user_id uuid not null references public.users(id), business_id uuid references public.businesses(id), listing_id uuid references public.listings(id), review_id uuid references public.reviews(id), reason text not null, status public.request_status not null default 'PENDING', created_at timestamptz not null default now(), check(num_nonnulls(business_id,listing_id,review_id) = 1));
create table public.promotion_packages (id uuid primary key default gen_random_uuid(), name text not null, placement_type text not null, duration_days integer not null check(duration_days > 0), amount numeric(12,2) not null check(amount >= 0), currency char(3) not null, active boolean not null default true, created_at timestamptz not null default now());
create table public.promotion_campaigns (id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), listing_id uuid references public.listings(id), package_id uuid not null references public.promotion_packages(id), placement_type text not null, status public.promotion_status not null default 'DRAFT', starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now(), check(ends_at is null or starts_at is null or ends_at > starts_at));
create table public.promotion_payments (id uuid primary key default gen_random_uuid(), promotion_id uuid not null references public.promotion_campaigns(id), payment_provider text not null, provider_reference text not null unique, payment_status text not null, currency char(3) not null, amount numeric(12,2) not null check(amount >= 0), platform text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.promotion_events (id uuid primary key default gen_random_uuid(), promotion_id uuid not null references public.promotion_campaigns(id), type text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.analytics_events (id uuid primary key default gen_random_uuid(), user_id uuid references public.users(id), business_id uuid references public.businesses(id), listing_id uuid references public.listings(id), event_name text not null, properties jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now());

create index businesses_location_idx on public.businesses using gist(location);
create index businesses_name_trgm_idx on public.businesses using gin(name gin_trgm_ops);
create index listings_search_idx on public.listings using gin(search_vector);
create index listings_title_trgm_idx on public.listings using gin(title gin_trgm_ops);
create index listings_business_status_idx on public.listings(business_id,status);
create index customers_business_idx on public.customers(business_id);
create index messages_conversation_created_idx on public.messages(conversation_id,created_at desc);
create index inquiries_business_created_idx on public.inquiries(business_id,created_at desc);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc);
create index campaigns_active_idx on public.promotion_campaigns(placement_type,starts_at,ends_at) where status='ACTIVE';

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.users(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email)); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
