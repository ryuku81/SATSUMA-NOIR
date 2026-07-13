alter table public.site_settings
  add column if not exists hero_slide2_head text not null default '',
  add column if not exists hero_slide2_body text not null default '',
  add column if not exists hero_slide3_head text not null default '',
  add column if not exists hero_slide3_body text not null default '',
  add column if not exists hero_slide4_head text not null default '',
  add column if not exists hero_slide4_body text not null default '';
