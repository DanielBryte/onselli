alter table public.creator_orders drop constraint creator_orders_status_check;
alter table public.creator_orders add constraint creator_orders_status_check check(status in ('PENDING','PAID','FAILED','REFUND_PENDING','REFUNDED','DISPUTED','DISPUTED_WON','DISPUTED_LOST'));

create table public.creator_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.creator_orders(id) on delete restrict,
  provider_refund_id text unique,
  provider_reference text not null unique,
  status text not null check(status in ('PROCESSING','PAID','FAILED')),
  requested_amount numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger creator_refunds_updated_at before update on public.creator_refunds for each row execute function public.set_updated_at();

create table public.creator_disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.creator_orders(id) on delete restrict,
  provider_dispute_id text not null unique,
  status text not null,
  amount numeric(12,2),
  currency char(3),
  reason text,
  response_due_at timestamptz,
  evidence_due boolean,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index creator_disputes_order_idx on public.creator_disputes(order_id,created_at desc);
alter table public.creator_refunds enable row level security;
alter table public.creator_disputes enable row level security;
grant select on public.creator_refunds, public.creator_disputes to authenticated;
grant all on public.creator_refunds, public.creator_disputes to service_role;
create policy creator_refunds_owner_read on public.creator_refunds for select using (exists(select 1 from public.creator_orders o join public.creators c on c.id=o.creator_id where o.id=order_id and c.user_id=auth.uid()));
create policy creator_disputes_owner_read on public.creator_disputes for select using (exists(select 1 from public.creator_orders o join public.creators c on c.id=o.creator_id where o.id=order_id and c.user_id=auth.uid()));
