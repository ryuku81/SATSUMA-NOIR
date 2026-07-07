create table if not exists public.cart_items (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  qty integer not null default 1 check (qty > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.wishlist_items (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists cart_items_user_id_idx on public.cart_items(user_id);
create index if not exists wishlist_items_user_id_idx on public.wishlist_items(user_id);

drop trigger if exists set_cart_items_updated_at on public.cart_items;
create trigger set_cart_items_updated_at before update on public.cart_items
for each row execute function public.set_updated_at();

drop trigger if exists set_wishlist_items_updated_at on public.wishlist_items;
create trigger set_wishlist_items_updated_at before update on public.wishlist_items
for each row execute function public.set_updated_at();

alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;

drop policy if exists "cart items own select" on public.cart_items;
create policy "cart items own select" on public.cart_items
for select to authenticated
using (auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "cart items own insert" on public.cart_items;
create policy "cart items own insert" on public.cart_items
for insert to authenticated
with check (auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "cart items own update" on public.cart_items;
create policy "cart items own update" on public.cart_items
for update to authenticated
using (auth.uid() = user_id or public.current_user_is_admin())
with check (auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "cart items own delete" on public.cart_items;
create policy "cart items own delete" on public.cart_items
for delete to authenticated
using (auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "wishlist items own select" on public.wishlist_items;
create policy "wishlist items own select" on public.wishlist_items
for select to authenticated
using (auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "wishlist items own insert" on public.wishlist_items;
create policy "wishlist items own insert" on public.wishlist_items
for insert to authenticated
with check (auth.uid() = user_id or public.current_user_is_admin());

drop policy if exists "wishlist items own delete" on public.wishlist_items;
create policy "wishlist items own delete" on public.wishlist_items
for delete to authenticated
using (auth.uid() = user_id or public.current_user_is_admin());
