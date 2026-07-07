# Stripe決済の設定

Stripe決済の土台は実装済みです。APIキーを入れるまでは、既存のデモカード入力にフォールバックします。

## フロント側

[app.js](app.js) の `STRIPE_PUBLISHABLE_KEY` にStripeの公開可能キーを設定してください。

```js
const STRIPE_PUBLISHABLE_KEY = "pk_test_xxxxxxxxx";
```

## Supabase Secrets

Supabase Edge Functionに以下を設定してください。

```bash
supabase secrets set STRIPE_SECRET_KEY="sk_test_xxxxxxxxx"
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxx"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="xxxxxxxxx"
```

- `STRIPE_SECRET_KEY`: PaymentIntent作成に使います。
- `STRIPE_WEBHOOK_SECRET`: Stripe Webhook署名検証に使います。
- `SUPABASE_SERVICE_ROLE_KEY`: Webhookから注文の `payment_status` を更新するために使います。

## Edge Functions

```bash
supabase functions deploy create-payment-intent --project-ref cbnmhyzebooqkbqyzptm
supabase functions deploy stripe-webhook --project-ref cbnmhyzebooqkbqyzptm --no-verify-jwt
```

## Stripe Webhook URL

Stripe DashboardでWebhook endpointを作成し、URLに以下を設定してください。

```text
https://cbnmhyzebooqkbqyzptm.functions.supabase.co/stripe-webhook
```

監視するイベント:

```text
payment_intent.succeeded
payment_intent.payment_failed
```

## 動作

1. checkout画面でカード決済を選択します。
2. `create-payment-intent` がSupabase上の商品価格から合計金額を再計算し、Stripe PaymentIntentを作成します。
3. フロントで `stripe.confirmCardPayment()` を実行します。
4. 決済成功後だけ `orders` に注文を保存します。
5. 注文には `payment_status = paid` と `payment_intent_id` が保存されます。
6. Stripe Webhookは後続イベントを受け取り、該当注文の `payment_status` を更新できます。
