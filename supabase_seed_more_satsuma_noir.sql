insert into public.journals (id, date, cat, title, image, body) values
  (1, '2026-06-10', 'Store', '照国本店、はじまりの話。“目が届く範囲”で、ひとつひとつ手仕事で。', 'images/terukuni-store.jpg', ''),
  (2, '2026-05-29', 'Craft', '熟成冷凍という選択。解凍後がいちばんの食べごろになる理由。', 'images/basque-cheesecake.png', ''),
  (3, '2026-05-18', 'Philosophy', '週末のための、深い甘さ。SATSUMA NOIR が大切にしていること。', 'images/noir-tablette.png', ''),
  (4, '2026-05-07', 'Recipe', '口どけを設計する。空気を含ませた、やわらかなスフレのこと。', 'images/souffle-cheesecake.png', ''),
  (5, '2026-04-26', 'Season''s Plate', 'コーヒーと余韻。大人のためのティラミスの、静かな楽しみ方。', 'images/italian-tiramisu.png', ''),
  (6, '2026-04-15', 'Store', '甘酸っぱさを重ねて。ベリーレアチーズに込めた、春の華やぎ。', 'images/berry-rare-cheesecake.png', '')
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.journals', 'id'), greatest((select max(id) from public.journals), 1), true);

update public.privacy_policy
set
  lead = 'SATSUMA NOIR（以下「当店」といいます）は、お客様の個人情報を適切に取り扱うことを社会的責務と考え、以下の方針に基づき個人情報の保護に努めます。',
  blocks = '[
    {"heading":"個人情報の取得について","text":"当店は、商品のご注文・お問い合わせ・会員登録などの際に、お名前・住所・電話番号・メールアドレスなどの個人情報を、適法かつ公正な手段により取得します。"},
    {"heading":"利用目的","text":"取得した個人情報は、商品の発送、ご注文内容の確認、お問い合わせへの対応、各種ご案内の送付など、必要な範囲でのみ利用します。"},
    {"heading":"第三者提供","text":"当店は、法令に基づく場合を除き、お客様の同意なく個人情報を第三者に提供することはありません。"}
  ]'::jsonb,
  date = '制定日：2025年1月1日'
where id = 1;

update public.legal_notice
set
  lead = '特定商取引に関する法律第11条に基づき、以下のとおり表示します。',
  rows = '[
    {"term":"販売事業者","value":"SATSUMA NOIR"},
    {"term":"運営責任者","value":"（担当者名）"},
    {"term":"所在地","value":"（郵便番号・住所）"},
    {"term":"電話番号","value":"（電話番号）\\n受付時間：平日 10:00〜17:00"},
    {"term":"メールアドレス","value":"（メールアドレス）"},
    {"term":"販売価格","value":"各商品ページに記載の価格（税込）"},
    {"term":"商品の引渡し時期","value":"ご注文・ご入金確認後、5営業日以内に冷凍便にて発送します。"}
  ]'::jsonb,
  date = '最終更新日：2025年1月1日'
where id = 1;
