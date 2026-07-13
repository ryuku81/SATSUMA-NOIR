alter table public.news
  add column if not exists body text not null default '',
  add column if not exists image text not null default '';
