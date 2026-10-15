-- Small, privacy-conscious creator insights: aggregate product activity and
-- return buyer/order summaries without copying raw customer data to the browser.
create table public.creator_product_daily_metrics (
  product_id uuid not null references public.creator_products(id) on delete cascade,
  metric_date date not null,
  page_views bigint not null default 0 check (page_views >= 0),
  checkout_starts bigint not null default 0 check (checkout_starts >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, metric_date)
);

alter table public.creator_product_daily_metrics enable row level security;
revoke all on public.creator_product_daily_metrics from anon, authenticated;
grant all on public.creator_product_daily_metrics to service_role;

create or replace function public.record_creator_product_metric(product_id_input uuid, metric_input text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if metric_input not in ('PAGE_VIEW', 'CHECKOUT_START') then return; end if;
  if not exists (
    select 1 from public.creator_products p
    join public.creators c on c.id = p.creator_id
    where p.id = product_id_input and p.status = 'PUBLISHED' and c.status = 'PUBLISHED'
  ) then return; end if;

  insert into public.creator_product_daily_metrics(product_id, metric_date, page_views, checkout_starts)
  values (
    product_id_input,
    (now() at time zone 'UTC')::date,
    case when metric_input = 'PAGE_VIEW' then 1 else 0 end,
    case when metric_input = 'CHECKOUT_START' then 1 else 0 end
  )
  on conflict (product_id, metric_date) do update set
    page_views = public.creator_product_daily_metrics.page_views + excluded.page_views,
    checkout_starts = public.creator_product_daily_metrics.checkout_starts + excluded.checkout_starts,
    updated_at = now();
end;
$$;
revoke all on function public.record_creator_product_metric(uuid, text) from public, anon, authenticated;
grant execute on function public.record_creator_product_metric(uuid, text) to service_role;

create or replace function public.get_creator_contacts(
  creator_id_input uuid,
  search_input text default null,
  page_size_input integer default 25,
  page_offset_input integer default 0
)
returns table (
  buyer_user_id uuid,
  buyer_email text,
  purchase_count bigint,
  spend_by_currency jsonb,
  first_purchase_at timestamptz,
  last_purchase_at timestamptz,
  last_product_title text,
  last_order_status text,
  total_contacts bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.creators c where c.id = creator_id_input and c.user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  return query
  with paid_orders as (
    select o.id, o.buyer_user_id, o.buyer_email, o.product_id, o.currency, o.amount, o.paid_at, o.status
    from public.creator_orders o
    where o.creator_id = creator_id_input and o.paid_at is not null
  ), buyer_totals as (
    select p.buyer_user_id, max(p.buyer_email) as buyer_email,
      count(*) as purchase_count, min(p.paid_at) as first_purchase_at, max(p.paid_at) as last_purchase_at
    from paid_orders p
    group by p.buyer_user_id
  ), currency_totals as (
    select p.buyer_user_id, p.currency,
      sum(p.amount - case when r.status = 'PAID' then coalesce(r.requested_amount, p.amount) else 0 end) as net_spend
    from paid_orders p
    left join public.creator_refunds r on r.order_id = p.id
    group by p.buyer_user_id, p.currency
  ), currency_json as (
    select ct.buyer_user_id, jsonb_object_agg(ct.currency, ct.net_spend) as spend_by_currency
    from currency_totals ct group by ct.buyer_user_id
  ), latest_orders as (
    select distinct on (p.buyer_user_id) p.buyer_user_id, product.title as last_product_title, p.status as last_order_status
    from paid_orders p join public.creator_products product on product.id = p.product_id
    order by p.buyer_user_id, p.paid_at desc, p.id desc
  ), filtered as (
    select bt.* from buyer_totals bt
    where search_input is null or trim(search_input) = '' or bt.buyer_email ilike '%' || trim(search_input) || '%'
  )
  select f.buyer_user_id, f.buyer_email, f.purchase_count,
    coalesce(cj.spend_by_currency, '{}'::jsonb), f.first_purchase_at, f.last_purchase_at,
    lo.last_product_title, lo.last_order_status, count(*) over ()
  from filtered f
  join currency_json cj on cj.buyer_user_id = f.buyer_user_id
  join latest_orders lo on lo.buyer_user_id = f.buyer_user_id
  order by f.last_purchase_at desc
  limit least(greatest(coalesce(page_size_input, 25), 1), 50)
  offset greatest(coalesce(page_offset_input, 0), 0);
end;
$$;
revoke all on function public.get_creator_contacts(uuid, text, integer, integer) from public, anon;
grant execute on function public.get_creator_contacts(uuid, text, integer, integer) to authenticated;

create or replace function public.get_creator_analytics(
  creator_id_input uuid,
  days_input integer default 30,
  currency_input text default null
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  window_days integer := least(greatest(coalesce(days_input, 30), 7), 90);
  normalized_currency text := nullif(upper(trim(currency_input)), '');
  result jsonb;
begin
  if not exists (select 1 from public.creators c where c.id = creator_id_input and c.user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;

  with paid_orders as (
    select o.id, o.product_id, o.buyer_user_id, o.currency, o.amount, o.paid_at, r.status as refund_status,
      coalesce(r.requested_amount, o.amount) as refund_amount
    from public.creator_orders o
    left join public.creator_refunds r on r.order_id = o.id
    where o.creator_id = creator_id_input
      and o.paid_at >= now() - make_interval(days => window_days)
      and (normalized_currency is null or o.currency = normalized_currency)
  ), currency_totals as (
    select currencies.currency,
      coalesce(sum(p.amount), 0) as gross_revenue,
      coalesce(sum(case when p.refund_status = 'PAID' then p.refund_amount else 0 end), 0) as refunds,
      count(p.id) as paid_orders,
      count(distinct p.buyer_user_id) as buyers
    from (select distinct trim(cp.currency::text) as currency from public.creator_products cp where cp.creator_id = creator_id_input) currencies
    left join paid_orders p on trim(p.currency::text) = currencies.currency
    group by currencies.currency
  ), daily_totals as (
    select (p.paid_at at time zone 'UTC')::date as day, p.currency,
      sum(p.amount - case when p.refund_status = 'PAID' then p.refund_amount else 0 end) as net_revenue,
      count(*) as paid_orders
    from paid_orders p group by day, p.currency
  ), product_totals as (
    select p.product_id, product.title, p.currency,
      sum(p.amount - case when p.refund_status = 'PAID' then p.refund_amount else 0 end) as net_revenue,
      sum(case when p.refund_status = 'PAID' then p.refund_amount else 0 end) as refunds,
      count(*) as paid_orders,
      count(distinct p.buyer_user_id) as buyers
    from paid_orders p join public.creator_products product on product.id = p.product_id
    group by p.product_id, product.title, p.currency
  ), product_activity as (
    select m.product_id, sum(m.page_views) as page_views, sum(m.checkout_starts) as checkout_starts
    from public.creator_product_daily_metrics m
    where m.metric_date >= (current_date - (window_days - 1))
      and m.product_id in (select p.id from public.creator_products p where p.creator_id = creator_id_input)
    group by m.product_id
  ), product_rows as (
    select p.id as product_id, p.title, trim(coalesce(pt.currency, p.currency)::text) as currency,
      coalesce(pt.net_revenue, 0) as net_revenue, coalesce(pt.refunds, 0) as refunds,
      coalesce(pt.paid_orders, 0) as paid_orders, coalesce(pt.buyers, 0) as buyers
    from public.creator_products p
    left join product_totals pt on pt.product_id = p.id
    where p.creator_id = creator_id_input and p.status = 'PUBLISHED'
      and (normalized_currency is null or p.currency = normalized_currency)
  )
  select jsonb_build_object(
    'days', window_days,
    'currency_totals', coalesce((select jsonb_agg(jsonb_build_object(
      'currency', ct.currency, 'gross_revenue', ct.gross_revenue, 'refunds', ct.refunds,
      'net_revenue', ct.gross_revenue - ct.refunds, 'paid_orders', ct.paid_orders, 'buyers', ct.buyers
    ) order by ct.currency) from currency_totals ct), '[]'::jsonb),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'day', dt.day, 'currency', dt.currency, 'net_revenue', dt.net_revenue, 'paid_orders', dt.paid_orders
    ) order by dt.day, dt.currency) from daily_totals dt), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object(
      'product_id', pr.product_id, 'title', pr.title, 'currency', pr.currency,
      'net_revenue', pr.net_revenue, 'refunds', pr.refunds, 'paid_orders', pr.paid_orders, 'buyers', pr.buyers,
      'page_views', coalesce(pa.page_views, 0), 'checkout_starts', coalesce(pa.checkout_starts, 0)
    ) order by pr.net_revenue desc, pr.title) from product_rows pr left join product_activity pa on pa.product_id = pr.product_id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_creator_analytics(uuid, integer, text) from public, anon;
grant execute on function public.get_creator_analytics(uuid, integer, text) to authenticated;
