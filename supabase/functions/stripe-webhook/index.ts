import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseStripeSignature(header: string) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) || "";
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  return { timestamp, signatures };
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifySignature(rawBody: string, signatureHeader: string, secret: string) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || !signatures.length) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = toHex(digest);
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

async function updateOrderPaymentStatus(paymentIntentId: string, paymentStatus: "paid" | "failed") {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY is not configured.");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: paymentStatus })
    .eq("payment_intent_id", paymentIntentId);
  if (error) {
    console.error("[stripe-webhook] order update failed:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, 501);
  }

  const signatureHeader = req.headers.get("Stripe-Signature") || "";
  const rawBody = await req.text();
  const verified = await verifySignature(rawBody, signatureHeader, webhookSecret);
  if (!verified) {
    return json({ error: "Invalid signature" }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const paymentIntentId = event?.data?.object?.id;
  if (event.type === "payment_intent.succeeded" && paymentIntentId) {
    await updateOrderPaymentStatus(paymentIntentId, "paid");
  }
  if (event.type === "payment_intent.payment_failed" && paymentIntentId) {
    await updateOrderPaymentStatus(paymentIntentId, "failed");
  }

  return json({ received: true });
});
