-- RLS is the authorization boundary. Service-role callers are restricted to Edge Functions.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.users where id = auth.uid() and platform_role in ('ADMIN','SUPPORT'));
$$;
create or replace function public.is_business_member(target_business_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.business_memberships where business_id = target_business_id and user_id = auth.uid());
$$;
create or replace function public.is_business_manager(target_business_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.business_memberships where business_id = target_business_id and user_id = auth.uid() and role in ('OWNER','ADMIN'));
$$;
grant execute on function public.is_admin(), public.is_business_member(uuid), public.is_business_manager(uuid) to authenticated;

-- Atomic onboarding avoids a client inserting a business without its owner membership.
create or replace function public.create_business(name_input text, slug_input text, mode_input public.location_mode, online_url_input text default null)
returns public.businesses language plpgsql security definer set search_path = public as $$
declare created_business public.businesses;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if length(trim(name_input)) < 2 or slug_input !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'invalid business identity'; end if;
  if mode_input = 'ONLINE' and online_url_input is null then raise exception 'online businesses require an online URL'; end if;
  insert into public.businesses(owner_user_id,name,slug,location_mode,online_url)
  values(auth.uid(),trim(name_input),slug_input,mode_input,online_url_input) returning * into created_business;
  insert into public.business_memberships(business_id,user_id,role) values(created_business.id,auth.uid(),'OWNER');
  update public.users set platform_role = 'BUSINESS_OWNER' where id = auth.uid() and platform_role = 'CUSTOMER';
  return created_business;
end;
$$;
grant execute on function public.create_business(text,text,public.location_mode,text) to authenticated;

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.listing_tags enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.inquiries enable row level security;
alter table public.quotes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.service_requests enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_slots enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.reviews enable row level security;
alter table public.review_replies enable row level security;
alter table public.review_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.business_verifications enable row level security;
alter table public.reports enable row level security;
alter table public.promotion_packages enable row level security;
alter table public.promotion_campaigns enable row level security;
alter table public.promotion_payments enable row level security;
alter table public.promotion_events enable row level security;
alter table public.analytics_events enable row level security;

create policy users_self_read on public.users for select using (id = auth.uid() or public.is_admin());
create policy users_self_update on public.users for update using (id = auth.uid()) with check (id = auth.uid() and platform_role = (select platform_role from public.users where id = auth.uid()));
create policy categories_public_read on public.categories for select using (status = 'PUBLISHED' or public.is_admin());
create policy categories_admin_write on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy businesses_public_read on public.businesses for select using ((status = 'PUBLISHED' and deleted_at is null) or public.is_business_member(id) or public.is_admin());
create policy businesses_manager_update on public.businesses for update using (public.is_business_manager(id) or public.is_admin()) with check (public.is_business_manager(id) or public.is_admin());
create policy memberships_member_read on public.business_memberships for select using (user_id = auth.uid() or public.is_business_manager(business_id) or public.is_admin());
create policy memberships_manager_write on public.business_memberships for all using (public.is_business_manager(business_id) or public.is_admin()) with check (public.is_business_manager(business_id) or public.is_admin());
create policy listings_public_read on public.listings for select using ((status = 'PUBLISHED' and deleted_at is null) or public.is_business_member(business_id) or public.is_admin());
create policy listings_member_write on public.listings for all using (public.is_business_member(business_id) or public.is_admin()) with check (public.is_business_member(business_id) or public.is_admin());
create policy images_public_read on public.listing_images for select using (exists(select 1 from public.listings l where l.id=listing_id and (l.status='PUBLISHED' or public.is_business_member(l.business_id) or public.is_admin())));
create policy images_member_write on public.listing_images for all using (exists(select 1 from public.listings l where l.id=listing_id and (public.is_business_member(l.business_id) or public.is_admin()))) with check (exists(select 1 from public.listings l where l.id=listing_id and (public.is_business_member(l.business_id) or public.is_admin())));
create policy tags_public_read on public.listing_tags for select using (exists(select 1 from public.listings l where l.id=listing_id and (l.status='PUBLISHED' or public.is_business_member(l.business_id) or public.is_admin())));
create policy tags_member_write on public.listing_tags for all using (exists(select 1 from public.listings l where l.id=listing_id and public.is_business_member(l.business_id))) with check (exists(select 1 from public.listings l where l.id=listing_id and public.is_business_member(l.business_id)));
create policy customers_business_only on public.customers for all using (public.is_business_member(business_id) or public.is_admin()) with check (public.is_business_member(business_id) or public.is_admin());
create policy notes_business_only on public.customer_notes for all using (exists(select 1 from public.customers c where c.id=customer_id and public.is_business_member(c.business_id))) with check (exists(select 1 from public.customers c where c.id=customer_id and public.is_business_member(c.business_id)));
create policy conversations_members_read on public.conversations for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()) or public.is_admin());
create policy conversation_members_read on public.conversation_members for select using (user_id=auth.uid() or exists(select 1 from public.conversation_members self where self.conversation_id=conversation_id and self.user_id=auth.uid()) or public.is_admin());
create policy messages_members_read on public.messages for select using (exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()) or public.is_admin());
create policy messages_members_insert on public.messages for insert with check (sender_user_id=auth.uid() and exists(select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.user_id=auth.uid()));
create policy inquiries_scoped on public.inquiries for select using (customer_user_id=auth.uid() or public.is_business_member(business_id) or public.is_admin());
create policy inquiries_customer_insert on public.inquiries for insert with check (customer_user_id=auth.uid());
create policy inquiries_business_update on public.inquiries for update using (public.is_business_member(business_id) or public.is_admin()) with check (public.is_business_member(business_id) or public.is_admin());
create policy quotes_scoped on public.quotes for select using (public.is_business_member(business_id) or exists(select 1 from public.inquiries i where i.id=inquiry_id and i.customer_user_id=auth.uid()) or public.is_admin());
create policy quotes_business_write on public.quotes for all using (public.is_business_member(business_id) or public.is_admin()) with check (public.is_business_member(business_id) or public.is_admin());
create policy orders_business_only on public.orders for all using (public.is_business_member(business_id) or public.is_admin()) with check (public.is_business_member(business_id) or public.is_admin());
create policy order_items_scoped on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and public.is_business_member(o.business_id)) or public.is_admin());
create policy order_history_scoped on public.order_status_history for select using (exists(select 1 from public.orders o where o.id=order_id and public.is_business_member(o.business_id)) or public.is_admin());
create policy service_requests_scoped on public.service_requests for select using (customer_user_id=auth.uid() or public.is_business_member(business_id) or public.is_admin());
create policy service_requests_customer_insert on public.service_requests for insert with check(customer_user_id=auth.uid());
create policy service_requests_business_update on public.service_requests for update using(public.is_business_member(business_id) or public.is_admin()) with check(public.is_business_member(business_id) or public.is_admin());
create policy bookings_scoped on public.bookings for select using(customer_user_id=auth.uid() or public.is_business_member(business_id) or public.is_admin());
create policy booking_slots_business_only on public.booking_slots for all using(public.is_business_member(business_id) or public.is_admin()) with check(public.is_business_member(business_id) or public.is_admin());
create policy booking_history_scoped on public.booking_status_history for select using(exists(select 1 from public.bookings b where b.id=booking_id and (b.customer_user_id=auth.uid() or public.is_business_member(b.business_id))) or public.is_admin());
create policy reviews_public_read on public.reviews for select using(status='PUBLISHED' or author_user_id=auth.uid() or public.is_business_member(business_id) or public.is_admin());
create policy reviews_author_insert on public.reviews for insert with check(author_user_id=auth.uid());
create policy reviews_author_update on public.reviews for update using(author_user_id=auth.uid() or public.is_admin()) with check(author_user_id=auth.uid() or public.is_admin());
create policy replies_public_read on public.review_replies for select using(exists(select 1 from public.reviews r where r.id=review_id and r.status='PUBLISHED'));
create policy replies_business_write on public.review_replies for all using(exists(select 1 from public.reviews r where r.id=review_id and public.is_business_member(r.business_id))) with check(exists(select 1 from public.reviews r where r.id=review_id and public.is_business_member(r.business_id)));
create policy review_reports_author_write on public.review_reports for all using(reporter_user_id=auth.uid() or public.is_admin()) with check(reporter_user_id=auth.uid() or public.is_admin());
create policy notifications_self on public.notifications for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy verification_business_read on public.business_verifications for select using(public.is_business_manager(business_id) or public.is_admin());
create policy verification_business_insert on public.business_verifications for insert with check(submitted_by_user_id=auth.uid() and public.is_business_manager(business_id));
create policy reports_author_or_admin on public.reports for all using(reporter_user_id=auth.uid() or public.is_admin()) with check(reporter_user_id=auth.uid() or public.is_admin());
create policy packages_public_read on public.promotion_packages for select using(active or public.is_admin());
create policy packages_admin_write on public.promotion_packages for all using(public.is_admin()) with check(public.is_admin());
create policy campaigns_business_read on public.promotion_campaigns for select using(public.is_business_member(business_id) or public.is_admin());
create policy payments_business_read on public.promotion_payments for select using(exists(select 1 from public.promotion_campaigns p where p.id=promotion_id and public.is_business_member(p.business_id)) or public.is_admin());
create policy events_business_read on public.promotion_events for select using(exists(select 1 from public.promotion_campaigns p where p.id=promotion_id and public.is_business_member(p.business_id)) or public.is_admin());
create policy analytics_business_read on public.analytics_events for select using((business_id is not null and public.is_business_member(business_id)) or public.is_admin());
