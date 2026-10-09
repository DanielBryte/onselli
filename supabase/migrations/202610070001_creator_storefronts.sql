-- Creator knowledge-commerce foundation. Apply only through Supabase migrations.
create type public.creator_product_kind as enum ('COURSE','DOWNLOAD','COACHING','WORKSHOP','COMMUNITY');

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  headline text,
  bio text,
  avatar_url text,
  cover_url text,
  social_links jsonb not null default '{}'::jsonb,
  status public.publication_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.creator_products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  kind public.creator_product_kind not null,
  title text not null check (char_length(trim(title)) between 3 and 140),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(trim(description)) between 10 and 6000),
  price_amount numeric(12,2) not null check (price_amount >= 0),
  currency char(3) not null default 'NGN' check (currency = upper(currency)),
  cover_url text,
  status public.publication_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, slug)
);

create index creators_public_slug_idx on public.creators(slug) where status = 'PUBLISHED';
create index creator_products_public_idx on public.creator_products(creator_id, status, created_at desc);

create trigger creators_updated_at before update on public.creators for each row execute function public.set_updated_at();
create trigger creator_products_updated_at before update on public.creator_products for each row execute function public.set_updated_at();

alter table public.creators enable row level security;
alter table public.creator_products enable row level security;

grant select on public.creators, public.creator_products to anon, authenticated;
grant insert, update, delete on public.creators, public.creator_products to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

create policy creators_public_or_owner_read on public.creators for select using (
  status = 'PUBLISHED' or user_id = auth.uid() or public.is_admin()
);
create policy creators_owner_insert on public.creators for insert with check (user_id = auth.uid());
create policy creators_owner_update on public.creators for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy creators_owner_delete on public.creators for delete using (user_id = auth.uid() or public.is_admin());

create policy creator_products_public_or_owner_read on public.creator_products for select using (
  (status = 'PUBLISHED' and exists (
    select 1 from public.creators c where c.id = creator_id and c.status = 'PUBLISHED'
  ))
  or exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
  or public.is_admin()
);
create policy creator_products_owner_insert on public.creator_products for insert with check (
  exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid())
);
create policy creator_products_owner_update on public.creator_products for update using (
  exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()) or public.is_admin()
) with check (
  exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()) or public.is_admin()
);
create policy creator_products_owner_delete on public.creator_products for delete using (
  exists (select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()) or public.is_admin()
);
