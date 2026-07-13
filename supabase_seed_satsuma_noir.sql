insert into public.product_categories (value, label, sort_order) values
  ('baked', 'BAKED', 1),
  ('rare', 'RARE', 2),
  ('special', 'SPECIAL', 3)
on conflict (value) do update set label = excluded.label, sort_order = excluded.sort_order;

insert into public.products
  (id, name, category_value, price, stock, glyph, image, tag, description)
values
  (1, 'バスクチーズケーキ', 'baked', 2600, 12, '🧀', 'images/basque-cheesecake.png', '人気', '高温で焼き上げた表面のほろ苦さと、とろける中心。'),
  (2, 'バスクチーズタルト', 'special', 2400, 8, '🥧', 'images/basque-cheese-tart.png', 'NEW', 'サクサクのタルト生地に、濃厚なバスク生地を重ねて。'),
  (3, 'イタリアンティラミス', 'special', 3200, 6, '🍮', 'images/italian-tiramisu.png', '', 'マスカルポーネとエスプレッソが織りなす大人の余韻。'),
  (4, 'レアチーズケーキ', 'rare', 2200, 15, '🍰', 'images/rare-cheesecake.png', '', '焼かずに仕上げた、軽やかでなめらかな口どけ。'),
  (5, 'ベリーレアチーズケーキ', 'rare', 2800, 0, '🫐', 'images/berry-rare-cheesecake.png', '限定', '甘酸っぱいベリーを重ねた、華やかなレアチーズ。'),
  (6, 'ニューヨークチーズケーキ', 'baked', 3000, 10, '🧀', 'images/newyork-cheesecake.png', '', '湯せん焼きでしっとり濃密。王道のニューヨークスタイル。'),
  (7, 'ベイクドチーズケーキ', 'baked', 2000, 20, '🧀', 'images/baked-cheesecake.png', '', 'クリームチーズの素朴な甘みを、じっくり焼き上げて。'),
  (8, 'スフレチーズケーキ', 'baked', 2300, 3, '☁️', 'images/souffle-cheesecake.png', '', 'ふわっと軽い口あたり。空気を含ませた優しい味わい。')
on conflict (id) do update set
  name = excluded.name,
  category_value = excluded.category_value,
  price = excluded.price,
  stock = excluded.stock,
  glyph = excluded.glyph,
  image = excluded.image,
  tag = excluded.tag,
  description = excluded.description;

select setval(pg_get_serial_sequence('public.products', 'id'), greatest((select max(id) from public.products), 1), true);

insert into public.bestsellers (product_id, rank) values
  (7, 1), (3, 2), (1, 3)
on conflict (rank) do update set product_id = excluded.product_id;

insert into public.news (id, date, cat, title, url, body, image) values
  (1, '2026-06-05', 'INFO', '「熟成冷凍チーズケーキ」数量限定で再入荷しました。', '#', '', ''),
  (2, '2026-05-20', 'ITEM', '新作「オペラ」がコレクションに登場しました。', '#', '', ''),
  (3, '2026-05-01', 'GIFT', '季節限定ギフトボックスの受付を開始しました。', '#', '', ''),
  (4, '2026-04-15', 'INFO', '大型連休期間中の配送スケジュールについて。', '#', '', '')
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.news', 'id'), greatest((select max(id) from public.news), 1), true);

insert into public.faqs (id, question, answer, sort_order) values
  (1, '解凍後はどのくらい日持ちしますか？', '解凍後は冷蔵庫で2〜3日を目安にお召し上がりください。小分けにカットし、食べる分だけ解凍して残りは冷凍庫で保存いただくのがおすすめです。', 1),
  (2, 'おすすめの食べごろを教えてください。', '独自の”熟成冷凍”製法により、解凍後がいちばんの食べごろです。室温で1時間ほど解凍してからお楽しみください。', 2),
  (3, '配送はどのように届きますか？', '商品は冷凍便にてお届けします。到着後はすぐに冷凍庫で保管いただき、お召し上がりになる分だけ解凍してください。', 3),
  (4, 'ギフト包装には対応していますか？', 'はい、ギフト包装に対応しております。ご注文時の備考欄にご希望をご記入いただくか、お問い合わせよりご相談ください。', 4),
  (5, 'アレルギー情報はどこで確認できますか？', '各商品ページに原材料・アレルギー情報を記載しています。ご不明な点はお問い合わせよりお気軽にご連絡ください。', 5)
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.faqs', 'id'), greatest((select max(id) from public.faqs), 1), true);

insert into public.topics (id, image, title, description, url, detail_image, body, sort_order) values
  (1, 'images/terukuni-store.jpg', '照国本店、カフェスペースのご案内', '焼きたて・解凍したての一皿をその場で。エスプレッソやお茶とともにお楽しみいただけます。', '#', '', '', 1),
  (2, 'images/souffle-cheesecake.png', '“熟成冷凍”のおいしい解凍ガイド', '室温で約1時間。半解凍とフル解凍で変わる、口どけの違いをご紹介します。', '#', '', '', 2),
  (3, 'images/basque-cheesecake.png', 'バスクチーズケーキ専門店としてのこだわり', '高温で焼き上げる表面のほろ苦さと、とろける中心。私たちの原点の一台です。', '#', '', '', 3),
  (4, 'images/truffle-collection.png', 'ご褒美に、トリュフチョコレートの詰め合わせ', 'ひと粒に込めた濃密なひととき。大切な方への贈り物にもおすすめです。', '#', '', '', 4)
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.topics', 'id'), greatest((select max(id) from public.topics), 1), true);

insert into public.stores (
  id, name, lead, open_date, hours, address, map_image,
  hero_image1, hero_image2, detail_image,
  limited_name, limited_desc, limited_image, limited_product, limited_price,
  regular_brand, regular_desc, regular_items,
  is_primary
)
values (
  1,
  '照国本店',
  '照国神社のほど近く、静かな路地にひっそりと佇む工房兼ショップ。もちろん、店頭でのご購入もいただけますが、ここではエスプレッソやお茶とともに、焼きたて・解凍したての一皿をその場で味わえる小さなカフェスペースを設えています。職人がひとつひとつ手仕事で仕上げる“熟成冷凍”チーズケーキを、いちばんの食べごろでお楽しみいただける場所です。',
  '2025年4月1日（火）',
  '11:00〜19:00
※カフェ営業時間
平日 11:30〜18:30（L.O.18:00）
土日 11:00〜18:30（L.O.18:00）
※店頭販売は売り切れ次第終了となります',
  '〒892-0841 鹿児島県鹿児島市照国町14-15',
  '',
  'images/terukuni-store.jpg',
  'images/noir-tablette.png',
  'images/terukuni-store.jpg',
  '焼きたて NOIR BAKED CHEESECAKE',
  '店内で焼き上げた、出来立てのひとくちチーズケーキ「NOIR BAKED CHEESECAKE」をご用意。毎週 金曜日・土曜日・日曜日 13:00 の焼き上がりです。',
  'images/baked-cheesecake.png',
  'Original',
  '¥459/個（税込）',
  'SATSUMA NOIR',
  '温度によって変化する味わいと香りを楽しめる、レストランデザートのようなチーズケーキ。',
  '[{"id":1},{"id":2},{"id":3},{"id":4},{"id":5}]'::jsonb,
  true
)
on conflict (id) do update set
  name = excluded.name,
  lead = excluded.lead,
  open_date = excluded.open_date,
  hours = excluded.hours,
  address = excluded.address,
  map_image = excluded.map_image,
  hero_image1 = excluded.hero_image1,
  hero_image2 = excluded.hero_image2,
  detail_image = excluded.detail_image,
  limited_name = excluded.limited_name,
  limited_desc = excluded.limited_desc,
  limited_image = excluded.limited_image,
  limited_product = excluded.limited_product,
  limited_price = excluded.limited_price,
  regular_brand = excluded.regular_brand,
  regular_desc = excluded.regular_desc,
  regular_items = excluded.regular_items,
  is_primary = excluded.is_primary;
select setval(pg_get_serial_sequence('public.stores', 'id'), greatest((select max(id) from public.stores), 1), true);

update public.recruit_settings
set
  lead = 'わたしたちと一緒に、
「週末気分」をつくる仲間を募集しています。',
  body = 'パティシエ・販売スタッフ・ECチームなど、さまざまなポジションでお待ちしています。地道なモノ作りに真摯に向き合える方からのご応募をお待ちしています。',
  button_label = 'エントリーはこちら',
  button_url = 'entry.html',
  positions = '["パティシエ", "販売スタッフ", "ECチーム", "その他"]'::jsonb
where id = 1;

update public.site_settings
set
  about_heading = 'SOUL CAKE SHOPへようこそ',
  about_body = '2018年、九州初のバスクチーズケーキ専門店として創業。
独自製法”熟成冷凍”加工にて『解凍後がいちばんの食べごろ』となるように製造しています。全国各地のお客様に愛され続けるモノ作りに取り組んでいます。2025年、原点回帰による”目が届く範囲”のみで運営します。',
  hero_concept_label = 'CONCEPT：WEEKEND_BASQUE',
  hero_concept_head = '『ひと口食べた瞬間、週末気分に』',
  hero_concept_body = 'その瞬間のためだけに地道なモノ作りをしていると言っても過言ではありません。品質と味をトコトン大切にひとつひとつ地道で地味な作業を繰り返しています。',
  statement_head = 'いつもの一日を、特別な週末に。',
  statement_body = '濃厚なのに、すっと溶ける。
ひと口ごとに広がる、深い余韻。
素材と静かに向き合い、手仕事で仕上げた一皿を。
あなたの週末に、ささやかな贅沢を。',
  howto_eyebrow = 'お召し上がり方',
  howto_title = '熟成冷凍チーズケーキの
お召し上がり方',
  howto_recommend_label = 'STAFF RECOMMEND',
  howto_recommend_text = 'スタッフおすすめは、室温で1時間解凍したら小分けにカットし、食べる分だけ解凍し、残りは冷凍庫へ♪
毎日のご褒美に少しずつお楽しみ頂けます。'
where id = 1;
