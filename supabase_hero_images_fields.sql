alter table public.site_settings
  add column if not exists hero_image2 text not null default '',
  add column if not exists hero_image3 text not null default '',
  add column if not exists hero_image4 text not null default '';
