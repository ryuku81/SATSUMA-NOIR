create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  value text primary key,
  label text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id bigserial primary key,
  name text not null,
  category_value text references public.product_categories(value) on update cascade on delete set null,
  price integer not null default 0 check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  glyph text not null default '',
  image text not null default '',
  tag text not null default '',
  description text not null default '',
  feature_head text not null default '',
  feature_body text not null default '',
  feature_image text not null default '',
  spec_size text not null default '',
  spec_expiry text not null default '',
  spec_ingredients text not null default '',
  notes text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id bigserial primary key,
  name text not null,
  email text not null unique,
  phone text not null default '',
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id bigserial primary key,
  auth_user_id uuid references auth.users(id) on delete set null,
  customer_id bigint references public.customers(id) on delete set null,
  customer text not null,
  email text not null default '',
  address text not null default '',
  note text not null default '',
  items jsonb not null default '[]'::jsonb,
  total integer not null default 0 check (total >= 0),
  status text not null default 'unshipped' check (status in ('unshipped', 'shipped')),
  payment text not null default '',
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'cod', 'demo')),
  payment_intent_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscribers (
  id bigserial primary key,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id bigserial primary key,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news (
  id bigserial primary key,
  date date not null,
  cat text not null default 'INFO',
  title text not null,
  url text not null default '#',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journals (
  id bigserial primary key,
  date date not null,
  cat text not null default '',
  title text not null,
  image text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faqs (
  id bigserial primary key,
  question text not null,
  answer text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recruit_settings (
  id integer primary key default 1 check (id = 1),
  lead text not null default '',
  body text not null default '',
  button_label text not null default 'エントリーはこちら',
  button_url text not null default 'entry.html',
  positions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applicants (
  id bigserial primary key,
  name text not null,
  kana text not null default '',
  email text not null,
  phone text not null default '',
  position text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'read')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  instagram_url text not null default '',
  x_url text not null default '',
  note_url text not null default '',
  hero_image text not null default '',
  statement_image text not null default '',
  howto_image1 text not null default '',
  howto_image2 text not null default '',
  howto_image3 text not null default '',
  about_image text not null default '',
  about_heading text not null default '',
  about_body text not null default '',
  hero_concept_label text not null default '',
  hero_concept_head text not null default '',
  hero_concept_body text not null default '',
  statement_head text not null default '',
  statement_body text not null default '',
  howto_eyebrow text not null default '',
  howto_title text not null default '',
  howto_recommend_label text not null default '',
  howto_recommend_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id bigserial primary key,
  image text not null default '',
  title text not null,
  description text not null default '',
  url text not null default '#',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bestsellers (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  rank integer not null check (rank between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rank),
  unique (product_id)
);

create table if not exists public.stores (
  id bigserial primary key,
  name text not null,
  lead text not null default '',
  open_date text not null default '',
  hours text not null default '',
  address text not null default '',
  map_image text not null default '',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists stores_single_primary_idx
on public.stores (is_primary)
where is_primary;

create table if not exists public.privacy_policy (
  id integer primary key default 1 check (id = 1),
  lead text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  date text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_notice (
  id integer primary key default 1 check (id = 1),
  lead text not null default '',
  rows jsonb not null default '[]'::jsonb,
  date text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_value_idx on public.products(category_value);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_auth_user_id_idx on public.orders(auth_user_id);
create index if not exists orders_payment_intent_id_idx on public.orders(payment_intent_id);
create index if not exists inquiries_status_created_at_idx on public.inquiries(status, created_at desc);
create index if not exists news_date_idx on public.news(date desc);
create index if not exists journals_date_idx on public.journals(date desc);
create index if not exists faqs_sort_order_idx on public.faqs(sort_order);
create index if not exists applicants_status_created_at_idx on public.applicants(status, created_at desc);
create index if not exists topics_sort_order_idx on public.topics(sort_order);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_product_categories_updated_at on public.product_categories;
create trigger set_product_categories_updated_at before update on public.product_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_subscribers_updated_at on public.subscribers;
create trigger set_subscribers_updated_at before update on public.subscribers
for each row execute function public.set_updated_at();

drop trigger if exists set_inquiries_updated_at on public.inquiries;
create trigger set_inquiries_updated_at before update on public.inquiries
for each row execute function public.set_updated_at();

drop trigger if exists set_news_updated_at on public.news;
create trigger set_news_updated_at before update on public.news
for each row execute function public.set_updated_at();

drop trigger if exists set_journals_updated_at on public.journals;
create trigger set_journals_updated_at before update on public.journals
for each row execute function public.set_updated_at();

drop trigger if exists set_faqs_updated_at on public.faqs;
create trigger set_faqs_updated_at before update on public.faqs
for each row execute function public.set_updated_at();

drop trigger if exists set_recruit_settings_updated_at on public.recruit_settings;
create trigger set_recruit_settings_updated_at before update on public.recruit_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_applicants_updated_at on public.applicants;
create trigger set_applicants_updated_at before update on public.applicants
for each row execute function public.set_updated_at();

drop trigger if exists set_site_settings_updated_at on public.site_settings;
create trigger set_site_settings_updated_at before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_topics_updated_at on public.topics;
create trigger set_topics_updated_at before update on public.topics
for each row execute function public.set_updated_at();

drop trigger if exists set_bestsellers_updated_at on public.bestsellers;
create trigger set_bestsellers_updated_at before update on public.bestsellers
for each row execute function public.set_updated_at();

drop trigger if exists set_stores_updated_at on public.stores;
create trigger set_stores_updated_at before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists set_privacy_policy_updated_at on public.privacy_policy;
create trigger set_privacy_policy_updated_at before update on public.privacy_policy
for each row execute function public.set_updated_at();

drop trigger if exists set_legal_notice_updated_at on public.legal_notice;
create trigger set_legal_notice_updated_at before update on public.legal_notice
for each row execute function public.set_updated_at();

insert into public.recruit_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

insert into public.privacy_policy (id)
values (1)
on conflict (id) do nothing;

insert into public.legal_notice (id)
values (1)
on conflict (id) do nothing;
