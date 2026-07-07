# 注文確認メールの設定

このプロジェクトでは、注文完了後に Supabase Edge Function `send-order-confirmation` を呼び出してメールを送信します。

## 必要なSecrets

Supabase Edge Functionに以下のSecretsを設定してください。

```bash
supabase secrets set RESEND_API_KEY="re_xxxxxxxxx"
supabase secrets set MAIL_FROM="SATSUMA NOIR <orders@your-domain.example>"
supabase secrets set ADMIN_ORDER_EMAIL="admin@your-domain.example"
supabase secrets set ADMIN_CONTACT_EMAIL="contact-admin@your-domain.example"
supabase secrets set ADMIN_RECRUIT_EMAIL="recruit-admin@your-domain.example"
```

- `RESEND_API_KEY`: ResendのAPIキー。未設定の場合、注文は完了しますがメールは送信されません。
- `MAIL_FROM`: 送信元メールアドレス。独自ドメインをResend側で認証してから使ってください。
- `ADMIN_ORDER_EMAIL`: 新規注文通知を受け取る管理者メールアドレス。未設定の場合、注文者への確認メールのみ送信します。
- `ADMIN_CONTACT_EMAIL`: お問い合わせ通知を受け取る管理者メールアドレス。未設定の場合は `ADMIN_ORDER_EMAIL` を使います。
- `ADMIN_RECRUIT_EMAIL`: 採用応募通知を受け取る管理者メールアドレス。未設定の場合は `ADMIN_CONTACT_EMAIL`、それも無ければ `ADMIN_ORDER_EMAIL` を使います。

## デプロイ

```bash
supabase functions deploy send-order-confirmation --project-ref cbnmhyzebooqkbqyzptm
supabase functions deploy send-admin-notification --project-ref cbnmhyzebooqkbqyzptm
```

## 動作

1. checkout画面で注文を作成します。
2. `orders` テーブルに保存された注文IDを使って `send-order-confirmation` を呼びます。
3. Edge Function側でログインユーザーのJWTを使い、RLSを通して本人の注文だけを読み取ります。
4. 注文者へ注文確認メールを送信します。
5. `ADMIN_ORDER_EMAIL` が設定されていれば管理者へ新規注文通知も送信します。

メール送信に失敗しても、注文保存自体は取り消しません。画面には「確認メールは送信準備中です」と表示されます。

## お問い合わせ・応募通知

お問い合わせフォーム送信後と採用応募フォーム送信後に、Supabase Edge Function `send-admin-notification` を呼び出します。

- お問い合わせは `ADMIN_CONTACT_EMAIL` に送信します。
- 採用応募は `ADMIN_RECRUIT_EMAIL` に送信します。
- Resend未設定、または管理者メール未設定の場合でも、フォーム内容の保存自体は成功扱いです。
