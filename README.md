# SATSUMA NOIR

スイーツブランド「SATSUMA NOIR」の EC サイトです。商品の閲覧・カート・注文・会員機能を持つ公開サイトと、商品やコンテンツを運用するための管理画面で構成されています。

ビルド工程のない静的サイト（HTML / CSS / JavaScript）で、バックエンドには Supabase（データベース・認証・ストレージ・Edge Functions）を使用しています。

## 使用技術

| 分類 | 技術 |
|---|---|
| フロントエンド | HTML / CSS / JavaScript（フレームワーク・バンドラーなし） |
| フォント | Google Fonts（Cormorant Garamond / Inter / Noto Sans JP） |
| バックエンド | Supabase（PostgreSQL + RLS / Auth / Storage / Edge Functions） |
| Supabase クライアント | `@supabase/supabase-js@2`（jsDelivr CDN から読み込み） |
| Edge Functions | Deno / TypeScript |
| 決済 | Stripe（Stripe.js v3 / PaymentIntent / Webhook） |
| メール送信 | Resend |
| 配信サーバー | Python 3 標準ライブラリによる簡易 HTTP サーバー（`serve.py`） |

`package.json` は無く、npm 依存やビルド手順、自動テストはありません。

## ディレクトリ構成

```
SATSUMA-NOIR/
├── index.html                  # トップページ
├── item.html                   # 商品一覧
├── product.html                # 商品詳細（?id=商品ID）
├── cart.html                   # カート
├── wishlist.html               # 気になるリスト
├── checkout.html               # 注文・決済
├── login.html                  # ログイン / 会員登録 / パスワード再設定
├── mypage.html                 # マイページ
├── news.html / news-detail.html
├── journal.html / journal-detail.html
├── topic-detail.html           # TOPICS 詳細
├── store-terukuni.html         # 照国本店（主店舗）
├── store-detail.html           # 店舗詳細（?id=店舗ID）
├── faq.html / contact.html
├── recruit.html / entry.html   # 採用情報 / 応募フォーム
├── privacy.html / tokushoho.html
├── admin.html                  # 管理画面
│
├── app.js                      # 公開サイト共通スクリプト（ヘッダー・カート・決済など）
├── admin.js                    # 管理画面コントローラー
├── styles.css                  # 公開サイト・管理画面共通のスタイル
├── supabase-client.js          # Supabase クライアント初期化（window.sb）
├── auth.js                     # 認証ヘルパー（window.Auth）
│
├── store.js                    # ProductStore（商品）
├── categories.js               # CategoryStore（商品カテゴリ）
├── orders.js                   # OrderStore（注文）
├── customers.js                # CustomerStore（顧客）
├── subscribers.js              # SubscriberStore（メールマガジン登録者）
├── inquiries.js                # InquiryStore（お問い合わせ）
├── applicants.js               # ApplicantStore（採用応募者）
├── settings.js                 # SettingsStore（サイト設定）
├── storeinfo.js                # StoreStore（店舗情報）と店舗ページの描画
├── bestseller.js               # BestSellerStore（人気商品）
├── news.js / journal.js / topics.js / faq.js     # 各ストアと公開ページの描画
├── recruit.js / privacy.js / tokushoho.js        # 各ストアと公開ページの描画
│
├── serve.py                    # 静的ファイル配信サーバー
├── images/                     # 商品・店舗画像
│
├── supabase/
│   ├── functions/
│   │   ├── create-payment-intent/     # Stripe PaymentIntent 作成
│   │   ├── stripe-webhook/            # Stripe Webhook 受信
│   │   ├── send-order-confirmation/   # 注文確認メール送信
│   │   └── send-admin-notification/   # お問い合わせ・応募の管理者通知
│   └── migrations/                    # 注文テーブルの追加マイグレーション
│
├── supabase_*.sql              # スキーマ・RLS ポリシー・シードなどの SQL
├── supabase_stripe_setup.md    # Stripe 決済の設定手順
├── supabase_order_email_setup.md  # メール通知の設定手順
│
├── admin-concepts/             # 管理画面のデザイン案（静的モックアップ）
├── journal-concepts/           # JOURNAL のデザイン案（静的モックアップ）
└── ranking-proposals.html      # ランキングのデザイン案（静的モックアップ）
```

デザイン案の 3 つは、スタイルを内包した単独の HTML です。スクリプトを持たず、サイト本体からはリンクされていません。

### データアクセス層について

各 `*Store`（`store.js`、`orders.js` など）は、画面側から見たデータ操作の窓口です。

- **読み込み**: Supabase のテーブルから取得します。Supabase のクライアントを読み込めなかった場合や取得でエラーになった場合は、ブラウザの `localStorage` のデータを返します。
- **`localStorage` の初期値**: 各ストアに書かれたサンプルデータです。注文・顧客・お問い合わせなどにも架空のデータが入っています。
- **書き込み**: Supabase に接続している場合は Supabase に保存し、失敗するとエラーになります。`JournalStore` だけは、失敗時に `localStorage` への保存に切り替わります。

## セットアップ方法

### 前提

- Python 3
- Supabase プロジェクト
- Supabase CLI（Edge Functions をデプロイする場合）
- Stripe アカウント / Resend アカウント（決済・メール送信を有効にする場合）

### 1. リポジトリの取得

```bash
gh repo clone ZETTAI-INC/SATSUMA-NOIR
cd SATSUMA-NOIR
```

依存パッケージのインストールは不要です。

### 2. Supabase の接続先を設定

`supabase-client.js` の `SUPABASE_URL` と `SUPABASE_ANON_KEY` が接続先です。別の Supabase プロジェクトを使う場合は、この 2 つを書き換えてください。

### 3. データベースの作成

Supabase の SQL Editor で、以下の順に SQL を実行します。

| 順 | ファイル | 内容 |
|---|---|---|
| 1 | `supabase_schema_satsuma_noir.sql` | テーブル・インデックス・`updated_at` 更新トリガー |
| 2 | `supabase_auth_satsuma_noir.sql` | 会員登録時に `public.users` と `public.customers` へ行を作成するトリガー |
| 3 | `supabase_full_policies_satsuma_noir.sql` | RLS ポリシー、`current_user_is_admin` / `set_user_role` などの関数、ストレージのポリシー |
| 4 | `supabase_order_rpc_satsuma_noir.sql` | 注文作成 RPC `create_order` |
| 5 | `supabase_user_cart_wishlist.sql` | `cart_items` / `wishlist_items` テーブルとポリシー |
| 6 | `supabase_storage_satsuma_noir.sql` | ストレージバケット `product-images` / `site-images` |
| 7 | `supabase_seed_satsuma_noir.sql` | 初期データ（カテゴリ・商品・人気商品・NEWS・FAQ・TOPICS・店舗・採用情報・サイト設定） |
| 8 | `supabase_seed_more_satsuma_noir.sql` | 初期データ（JOURNAL・プライバシーポリシー・特定商取引法に基づく表示） |

実行順はリポジトリ内で明示されていません。上記は各 SQL が参照するテーブルと関数の依存関係から整理したもので、実際の Supabase プロジェクトでの実行確認はしていません。

次のファイルは、既存のデータベースに列・関数・ポリシーを後から追加するための差分です。内容は上記 1〜5 に含まれています。

- `supabase_hero_images_fields.sql` / `supabase_hero_text_fields.sql`
- `supabase_news_detail_fields.sql` / `supabase_topics_detail_fields.sql` / `supabase_store_detail_fields.sql`
- `supabase_auth_policies_satsuma_noir.sql` / `supabase_member_profile_policy.sql` / `supabase_member_role_rpc.sql`
- `supabase_order_auth_user_migration.sql`
- `supabase/migrations/202607070001_order_auth_user_id.sql`（`supabase_order_auth_user_migration.sql` と同一）
- `supabase/migrations/202607070002_stripe_payment_fields.sql`（決済用の列追加と、`supabase_order_rpc_satsuma_noir.sql` と同じ関数定義）

### 4. テストアカウントの作成（任意）

開発用のアカウントを作成する SQL です。本番環境では実行しないでください。

| ファイル | メールアドレス | 権限 |
|---|---|---|
| `supabase_create_test_admin.sql` | `admin@test.com` | 管理者 |
| `supabase_create_test_member.sql` | `member@test.com` | 一般会員 |

パスワードは各 SQL ファイル内に記載されています。

### 5. Edge Functions のデプロイ

```bash
supabase functions deploy create-payment-intent --project-ref <project-ref>
supabase functions deploy stripe-webhook --project-ref <project-ref> --no-verify-jwt
supabase functions deploy send-order-confirmation --project-ref <project-ref>
supabase functions deploy send-admin-notification --project-ref <project-ref>
```

Stripe Webhook の登録方法などの詳細は、`supabase_stripe_setup.md` と `supabase_order_email_setup.md` を参照してください。

## 環境変数

### フロントエンド

`.env` ファイルは使用していません。設定値は JavaScript ファイルに直接記述します。

| 設定値 | ファイル | 説明 |
|---|---|---|
| `SUPABASE_URL` | `supabase-client.js` | Supabase プロジェクトの URL |
| `SUPABASE_ANON_KEY` | `supabase-client.js` | Supabase の anon キー |
| `STRIPE_PUBLISHABLE_KEY` | `app.js` | Stripe の公開可能キー（`pk_test_` または `pk_live_` で始まる値）。初期値は空文字で、その場合はデモ用のカード入力欄が表示されます |

### 配信サーバー（`serve.py`）

| 変数 | 既定値 | 説明 |
|---|---|---|
| `PORT` | `8765` | 待受ポート。コマンドライン引数を指定した場合はそちらが優先されます |
| `HOST` | `0.0.0.0` | 待受ホスト |

### Edge Functions（Supabase Secrets）

| 変数 | 使用する関数 | 説明 |
|---|---|---|
| `STRIPE_SECRET_KEY` | `create-payment-intent` | Stripe のシークレットキー。未設定の場合は 501 を返します |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Webhook の署名検証用シークレット。未設定の場合は 501 を返します |
| `SUPABASE_SERVICE_ROLE_KEY` | `stripe-webhook` | 注文の `payment_status` を更新するためのキー。未設定の場合は更新を行いません |
| `SUPABASE_URL` | `create-payment-intent` / `stripe-webhook` / `send-order-confirmation` | Supabase プロジェクトの URL |
| `SUPABASE_ANON_KEY` | `create-payment-intent` / `send-order-confirmation` | Supabase の anon キー |
| `RESEND_API_KEY` | `send-order-confirmation` / `send-admin-notification` | Resend の API キー。未設定の場合はメールを送信しません |
| `MAIL_FROM` | `send-order-confirmation` / `send-admin-notification` | 送信元メールアドレス。未設定の場合は `SATSUMA NOIR <onboarding@resend.dev>` |
| `ADMIN_ORDER_EMAIL` | `send-order-confirmation` / `send-admin-notification` | 新規注文通知の宛先。未設定の場合は注文者への確認メールだけを送信します |
| `ADMIN_CONTACT_EMAIL` | `send-admin-notification` | お問い合わせ通知の宛先。未設定時は `ADMIN_ORDER_EMAIL` |
| `ADMIN_RECRUIT_EMAIL` | `send-admin-notification` | 採用応募通知の宛先。未設定時は `ADMIN_CONTACT_EMAIL`、次に `ADMIN_ORDER_EMAIL` |

設定コマンドの例は `supabase_stripe_setup.md` と `supabase_order_email_setup.md` に記載されています。

## 起動方法

```bash
python3 serve.py
```

ブラウザで以下を開きます。

| 画面 | URL |
|---|---|
| 公開サイト | http://localhost:8765/ |
| 管理画面 | http://localhost:8765/admin.html |

ポートを変更する場合は引数で指定します。

```bash
python3 serve.py 3000
```

`serve.py` は HTML / JS / CSS を常に最新の状態で返し（`no-store`）、画像とフォントは更新確認付きでキャッシュさせます。Render などのホスティング環境では、環境変数 `PORT` が使用されます。

## 主な機能

### 公開サイト

| 機能 | 内容 |
|---|---|
| トップページ | ヒーローカルーセル（4 枚）、人気商品、ステートメント、お召し上がり方、TOPICS、About、店舗情報、メールマガジン登録 |
| 商品一覧 | カテゴリによる絞り込み |
| 商品詳細 | 画像ギャラリー、在庫状況の表示、数量の指定、特集・商品概要・お取り扱いの説明 |
| カート | 数量の変更、削除、合計金額の表示 |
| 気になるリスト | 商品の追加と削除。ログインしていなくても使用できます |
| 注文・決済 | クレジット / デビットカード、代金引換（着払い）。ログインが必要です |
| 会員機能 | 会員登録、メールアドレスの確認、ログイン、ログアウト、パスワード再設定 |
| マイページ | 注文履歴の表示、お名前の変更 |
| コンテンツ | NEWS、JOURNAL（6 件ごとのページ送り）、TOPICS、店舗詳細、FAQ、採用情報、プライバシーポリシー、特定商取引法に基づく表示 |
| フォーム | お問い合わせ、採用エントリー。送信内容を保存し、管理者へメールで通知します |
| 表示 | ダーク / ライトテーマの切り替え、スマートフォン向けのレイアウト |

カートと気になるリストは `localStorage` に保存されます。ログイン中は Supabase の `cart_items` / `wishlist_items` と統合され、同期されます。

カード決済の流れは次のとおりです。

1. Edge Function `create-payment-intent` が、Supabase 上の商品価格から合計金額を計算して PaymentIntent を作成します。
2. 画面側で、その金額がカートの合計と一致することを確認してから決済を実行します。
3. 決済が成功した場合にだけ、注文を保存します。
4. 注文確認メールを送信します。送信に失敗しても、注文は取り消されません。

### 管理画面（`admin.html`）

`public.users.role` が `admin` のユーザーだけがログインできます。

| 分類 | メニュー | 内容 |
|---|---|---|
| 分析 | ダッシュボード | 本日・今月の売上、注文数、会員数、客単価、新規 / リピーター、期間を指定した売上サマリーと商品別の内訳、最新の注文、在庫アラート、未発送注文の通知 |
| 運用 | 注文管理 | 一覧、発送状況による絞り込み、詳細の表示、未発送 / 発送済みの切り替え |
| 運用 | お問い合わせ | 一覧、未読 / 既読の切り替え、詳細の表示、削除 |
| 運用 | 応募者管理 | 一覧、未読 / 既読の切り替え、詳細の表示、削除 |
| 運用 | 顧客管理 | 顧客の追加・編集・削除、注文履歴と購入総額の表示、メールマガジン登録者の一覧と削除 |
| 運用 | 会員管理 | 会員の権限（管理者 / 会員）の変更 |
| コンテンツ | 商品管理 | 商品の追加・編集・削除、カテゴリの追加・削除、商品詳細ページの文面と画像の編集 |
| コンテンツ | 人気商品管理 | トップページに表示する商品と順位（最大 3 件） |
| コンテンツ | 店舗情報管理 | 店舗の追加・編集・削除。主店舗は削除できません |
| コンテンツ | NEWS 管理 / JOURNAL 管理 | 記事の追加・編集・削除 |
| コンテンツ | FAQ 管理 | 項目の追加・編集・削除、表示順の入れ替え |
| コンテンツ | 採用情報管理 | リード文と本文、応募フォームの希望職種 |
| コンテンツ | TOPICS 管理 | カードの追加・編集・削除 |
| 設定 | 設定 | トップページの画像と文章、SNS リンク |

画像は、ブラウザ側で縮小して JPEG に変換してから、Supabase Storage の `product-images` または `site-images` にアップロードします。

## 注意事項

### 未実装の機能

画面に表示されますが、動作しないものです。

- マイページの「配送先」「お支払い方法」タブは、未登録である旨の文言だけを表示します。登録や変更はできません。
- マイページの「パスワードを変更する」ボタン、メールマガジン受信設定のスイッチ、注文履歴の「詳細を見る」ボタンは、処理が割り当てられていません。
- 商品詳細ページの SNS シェアボタンは、リンク先が設定されていません。
- プライバシーポリシーと特定商取引法に基づく表示は、管理画面から編集できません。内容を変更するには、Supabase の `privacy_policy` / `legal_notice` テーブルを直接更新します。

### 動作上の制限

- 注文が確定しても、商品の在庫数は減りません。在庫数は管理画面の商品管理で更新します。
- Stripe の公開可能キー（`STRIPE_PUBLISHABLE_KEY`）が未設定の状態では、カード決済はデモ用の入力欄で動作します。入力値の形式を確認するだけで課金は行わず、注文は `payment_status = demo` で保存されます。
- Supabase から読み込めなかった場合に表示される `localStorage` のデータは、端末とブラウザごとに独立しています。

### セキュリティ

- `supabase-client.js` の anon キーは、ブラウザに公開される前提のキーです。データは RLS ポリシーで保護しているため、`supabase_full_policies_satsuma_noir.sql` を必ず適用してください。
- テストアカウントを作成する SQL は、パスワードがファイルに記載されています。本番環境では実行しないでください。
