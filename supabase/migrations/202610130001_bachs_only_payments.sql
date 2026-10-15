-- Bachs Connect is Onselli's sole supported payment provider.
-- NOT VALID preserves historical rows while enforcing the constraint on new writes.
alter table public.creator_orders
  add constraint creator_orders_bachs_only_check
  check (payment_provider = 'bachs') not valid;
