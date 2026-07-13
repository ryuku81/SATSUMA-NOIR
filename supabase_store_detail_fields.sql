alter table public.stores
  add column if not exists hero_image1 text not null default '',
  add column if not exists hero_image2 text not null default '',
  add column if not exists detail_image text not null default '',
  add column if not exists limited_name text not null default '',
  add column if not exists limited_desc text not null default '',
  add column if not exists limited_image text not null default '',
  add column if not exists limited_product text not null default '',
  add column if not exists limited_price text not null default '',
  add column if not exists regular_brand text not null default '',
  add column if not exists regular_desc text not null default '',
  add column if not exists regular_items jsonb not null default '[]'::jsonb;

update public.stores
set
  hero_image1 = coalesce(nullif(hero_image1, ''), 'images/terukuni-store.jpg'),
  hero_image2 = coalesce(nullif(hero_image2, ''), 'images/noir-tablette.png'),
  detail_image = coalesce(nullif(detail_image, ''), 'images/terukuni-store.jpg'),
  limited_name = coalesce(nullif(limited_name, ''), '焼きたて NOIR BAKED CHEESECAKE'),
  limited_desc = coalesce(nullif(limited_desc, ''), '店内で焼き上げた、出来立てのひとくちチーズケーキ「NOIR BAKED CHEESECAKE」をご用意。毎週 金曜日・土曜日・日曜日 13:00 の焼き上がりです。'),
  limited_image = coalesce(nullif(limited_image, ''), 'images/baked-cheesecake.png'),
  limited_product = coalesce(nullif(limited_product, ''), 'Original'),
  limited_price = coalesce(nullif(limited_price, ''), '¥459/個（税込）'),
  regular_brand = coalesce(nullif(regular_brand, ''), 'SATSUMA NOIR'),
  regular_desc = coalesce(nullif(regular_desc, ''), '温度によって変化する味わいと香りを楽しめる、レストランデザートのようなチーズケーキ。'),
  regular_items = case
    when regular_items is null
      or regular_items = '[]'::jsonb
      or not exists (
        select 1
        from jsonb_array_elements(regular_items) as item
        where item ? 'id'
      )
    then '[{"id":1},{"id":2},{"id":3},{"id":4},{"id":5}]'::jsonb
    else regular_items
  end
where is_primary = true or id = 1;
