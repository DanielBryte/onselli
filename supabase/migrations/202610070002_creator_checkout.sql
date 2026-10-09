create table public.creator_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.users(id) on delete restrict,
  buyer_email text not null,
  creator_id uuid not null references public.creators(id) on delete restrict,
  product_id uuid not null references public.creator_products(id) on delete restrict,
  amount numeric(12,2) not null check(amount > 0),
  platform_fee_amount numeric(12,2) not null check(platform_fee_amount >= 0 and platform_fee_amount < amount),
  currency char(3) not null check(currency = upper(currency)),
  status text not null default 'PENDING' check(status in ('PENDING','PAID','FAILED','REFUNDED','DISPUTED')),
  payment_provider text not null check(payment_provider in ('bachs','paystack')),
  provider_checkout_id text unique,
  provider_charge_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index creator_orders_buyer_idx on public.creator_orders(buyer_user_id,created_at desc);
create index creator_orders_creator_idx on public.creator_orders(creator_id,created_at desc);
create index creator_orders_product_idx on public.creator_orders(product_id);
alter table public.creator_orders add column provider_account_id text;
create trigger creator_orders_updated_at before update on public.creator_orders for each row execute function public.set_updated_at();

create table public.creator_product_content (
  product_id uuid primary key references public.creator_products(id) on delete cascade,
  content_body text not null default '' check(char_length(content_body) <= 1000000),
  updated_at timestamptz not null default now()
);
create trigger creator_product_content_updated_at before update on public.creator_product_content for each row execute function public.set_updated_at();

create table public.creator_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.creator_orders(id) on delete restrict,
  buyer_user_id uuid not null references public.users(id) on delete restrict,
  product_id uuid not null references public.creator_products(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index creator_entitlements_buyer_idx on public.creator_entitlements(buyer_user_id,granted_at desc);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

alter table public.creator_orders enable row level security;
alter table public.creator_entitlements enable row level security;
alter table public.creator_product_content enable row level security;
alter table public.payment_webhook_events enable row level security;
grant select on public.creator_orders, public.creator_entitlements, public.creator_product_content to authenticated;
grant insert, update on public.creator_product_content to authenticated;
grant all on public.creator_orders, public.creator_entitlements, public.creator_product_content, public.payment_webhook_events to service_role;
create policy creator_orders_buyer_read on public.creator_orders for select using (buyer_user_id = auth.uid());
create policy creator_orders_creator_read on public.creator_orders for select using (exists(select 1 from public.creators c where c.id = creator_id and c.user_id = auth.uid()));
create policy creator_entitlements_buyer_read on public.creator_entitlements for select using (buyer_user_id = auth.uid());
create policy creator_entitlements_creator_read on public.creator_entitlements for select using (exists(select 1 from public.creator_products p join public.creators c on c.id=p.creator_id where p.id=product_id and c.user_id=auth.uid()));
create policy creator_content_owner_read on public.creator_product_content for select using (exists(select 1 from public.creator_products p join public.creators c on c.id=p.creator_id where p.id=product_id and c.user_id=auth.uid()));
create policy creator_content_owner_insert on public.creator_product_content for insert with check (exists(select 1 from public.creator_products p join public.creators c on c.id=p.creator_id where p.id=product_id and c.user_id=auth.uid()));
create policy creator_content_owner_update on public.creator_product_content for update using (exists(select 1 from public.creator_products p join public.creators c on c.id=p.creator_id where p.id=product_id and c.user_id=auth.uid())) with check (exists(select 1 from public.creator_products p join public.creators c on c.id=p.creator_id where p.id=product_id and c.user_id=auth.uid()));

create or replace function public.fulfill_creator_order(order_id_input uuid, provider_charge_id_input text default null)
returns void language plpgsql security definer set search_path = public as $$
declare target_order public.creator_orders;
begin
  select * into target_order from public.creator_orders where id=order_id_input for update;
  if not found then raise exception 'order not found'; end if;
  if target_order.status = 'PAID' then return; end if;
  if target_order.status <> 'PENDING' then raise exception 'order is not pending'; end if;
  update public.creator_orders set status='PAID', provider_charge_id=provider_charge_id_input, paid_at=now() where id=target_order.id;
  insert into public.creator_entitlements(order_id,buyer_user_id,product_id)
  values(target_order.id,target_order.buyer_user_id,target_order.product_id) on conflict(order_id) do nothing;
end;
$$;
revoke all on function public.fulfill_creator_order(uuid,text) from public, anon, authenticated;
grant execute on function public.fulfill_creator_order(uuid,text) to service_role;

create table public.creator_payment_accounts (
  creator_id uuid primary key references public.creators(id) on delete cascade,
  provider_account_id text not null unique,
  country char(2) not null,
  entity_type text not null check(entity_type in ('individual','company')),
  connect_status text not null default 'ONBOARDING' check(connect_status in ('ONBOARDING','NEEDS_INFO','IN_REVIEW','READY','RESTRICTED')),
  capabilities jsonb not null default '{}'::jsonb,
  requirements jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger creator_payment_accounts_updated_at before update on public.creator_payment_accounts for each row execute function public.set_updated_at();
alter table public.creator_payment_accounts enable row level security;
grant select on public.creator_payment_accounts to authenticated;
grant all on public.creator_payment_accounts to service_role;
create policy creator_payment_accounts_owner_read on public.creator_payment_accounts for select using (exists(select 1 from public.creators c where c.id=creator_id and c.user_id=auth.uid()));
