create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '');
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.users;
begin
  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role: %', p_role;
  end if;

  if not public.current_user_is_admin() then
    raise exception 'Admin permission required';
  end if;

  select *
    into target
    from public.users
    where id = p_user_id;

  if target.id is null then
    raise exception 'User not found';
  end if;

  if target.auth_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'Cannot remove your own admin role';
  end if;

  update public.users
    set role = p_role,
        updated_at = now()
    where id = p_user_id
    returning * into target;

  return target;
end;
$$;

grant execute on function public.set_user_role(uuid, text) to authenticated;

alter table public.users enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.subscribers enable row level security;
alter table public.inquiries enable row level security;
alter table public.news enable row level security;
alter table public.journals enable row level security;
alter table public.faqs enable row level security;
alter table public.recruit_settings enable row level security;
alter table public.applicants enable row level security;
alter table public.site_settings enable row level security;
alter table public.topics enable row level security;
alter table public.bestsellers enable row level security;
alter table public.stores enable row level security;
alter table public.privacy_policy enable row level security;
alter table public.legal_notice enable row level security;

drop policy if exists "users select own or admin" on public.users;
create policy "users select own or admin" on public.users
for select to authenticated
using (auth.uid() = auth_user_id or public.current_user_is_admin());

drop policy if exists "users update admin only" on public.users;
create policy "users update admin only" on public.users
for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "users update own profile" on public.users;
create policy "users update own profile" on public.users
for update to authenticated
using (auth.uid() = auth_user_id)
with check (
  auth.uid() = auth_user_id
  and role = 'member'
  and email = public.current_user_email()
);

drop policy if exists "public read product_categories" on public.product_categories;
create policy "public read product_categories" on public.product_categories
for select to anon, authenticated using (true);
drop policy if exists "admin all product_categories" on public.product_categories;
create policy "admin all product_categories" on public.product_categories
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
for select to anon, authenticated using (true);
drop policy if exists "admin all products" on public.products;
create policy "admin all products" on public.products
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "customers select own or admin" on public.customers;
create policy "customers select own or admin" on public.customers
for select to authenticated
using (email = public.current_user_email() or public.current_user_is_admin());
drop policy if exists "customers admin all" on public.customers;
create policy "customers admin all" on public.customers
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "orders insert anon authenticated" on public.orders;
create policy "orders insert anon authenticated" on public.orders
for insert to anon, authenticated with check (true);
drop policy if exists "orders select own or admin" on public.orders;
create policy "orders select own or admin" on public.orders
for select to authenticated
using (
  auth.uid() = auth_user_id
  or (
    auth_user_id is null
    and email = public.current_user_email()
  )
  or public.current_user_is_admin()
);
drop policy if exists "orders admin update delete" on public.orders;
create policy "orders admin update delete" on public.orders
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "subscribers insert public" on public.subscribers;
create policy "subscribers insert public" on public.subscribers
for insert to anon, authenticated with check (true);
drop policy if exists "subscribers admin all" on public.subscribers;
create policy "subscribers admin all" on public.subscribers
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "inquiries insert public" on public.inquiries;
create policy "inquiries insert public" on public.inquiries
for insert to anon, authenticated with check (true);
drop policy if exists "inquiries admin all" on public.inquiries;
create policy "inquiries admin all" on public.inquiries
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "applicants insert public" on public.applicants;
create policy "applicants insert public" on public.applicants
for insert to anon, authenticated with check (true);
drop policy if exists "applicants admin all" on public.applicants;
create policy "applicants admin all" on public.applicants
for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read news" on public.news;
create policy "public read news" on public.news for select to anon, authenticated using (true);
drop policy if exists "admin all news" on public.news;
create policy "admin all news" on public.news for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read journals" on public.journals;
create policy "public read journals" on public.journals for select to anon, authenticated using (true);
drop policy if exists "admin all journals" on public.journals;
create policy "admin all journals" on public.journals for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read faqs" on public.faqs;
create policy "public read faqs" on public.faqs for select to anon, authenticated using (true);
drop policy if exists "admin all faqs" on public.faqs;
create policy "admin all faqs" on public.faqs for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read recruit_settings" on public.recruit_settings;
create policy "public read recruit_settings" on public.recruit_settings for select to anon, authenticated using (true);
drop policy if exists "admin all recruit_settings" on public.recruit_settings;
create policy "admin all recruit_settings" on public.recruit_settings for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read site_settings" on public.site_settings;
create policy "public read site_settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "admin all site_settings" on public.site_settings;
create policy "admin all site_settings" on public.site_settings for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read topics" on public.topics;
create policy "public read topics" on public.topics for select to anon, authenticated using (true);
drop policy if exists "admin all topics" on public.topics;
create policy "admin all topics" on public.topics for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read bestsellers" on public.bestsellers;
create policy "public read bestsellers" on public.bestsellers for select to anon, authenticated using (true);
drop policy if exists "admin all bestsellers" on public.bestsellers;
create policy "admin all bestsellers" on public.bestsellers for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores for select to anon, authenticated using (true);
drop policy if exists "admin all stores" on public.stores;
create policy "admin all stores" on public.stores for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read privacy_policy" on public.privacy_policy;
create policy "public read privacy_policy" on public.privacy_policy for select to anon, authenticated using (true);
drop policy if exists "admin all privacy_policy" on public.privacy_policy;
create policy "admin all privacy_policy" on public.privacy_policy for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read legal_notice" on public.legal_notice;
create policy "public read legal_notice" on public.legal_notice for select to anon, authenticated using (true);
drop policy if exists "admin all legal_notice" on public.legal_notice;
create policy "admin all legal_notice" on public.legal_notice for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects
for select to anon, authenticated
using (bucket_id in ('product-images', 'site-images'));

drop policy if exists "admin write product images" on storage.objects;
create policy "admin write product images" on storage.objects
for all to authenticated
using (bucket_id in ('product-images', 'site-images') and public.current_user_is_admin())
with check (bucket_id in ('product-images', 'site-images') and public.current_user_is_admin());
