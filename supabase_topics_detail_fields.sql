alter table public.topics
  add column if not exists detail_image text not null default '',
  add column if not exists body text not null default '';
