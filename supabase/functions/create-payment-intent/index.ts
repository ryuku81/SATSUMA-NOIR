import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CartItem = {
  id?: number;
  qty?: number;
};

type ProductRow = {
  id: number;
  name: string;
  price: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeItems(items: unknown): CartItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      id: Number((item as CartItem).id),
      qty: Math.max(1, Number((item as CartItem).qty) || 1),
    }))
    .filter((item) => Number.isInteger(item.id) && item.id > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return json({ error: "STRIPE_SECRET_KEY is not configured" }, 501);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are missing.");
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { items, customerName, customerEmail } = await req.json();
    const normalized = normalizeItems(items);
    if (!normalized.length) {
      return json({ error: "Cart is empty" }, 400);
    }

    const ids = [...new Set(normalized.map((item) => item.id))];
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, price")
      .in("id", ids)
      .returns<ProductRow[]>();

    if (productError) {
      console.error("[create-payment-intent] product fetch failed:", productError);
      return json({ error: "Failed to validate cart" }, 400);
    }

    const productMap = new Map((products || []).map((product) => [Number(product.id), product]));
    let amount = 0;
    const orderItems = normalized.map((item) => {
      const product = productMap.get(item.id as number);
      if (!product) throw new Error(`Invalid product: ${item.id}`);
      amount += Number(product.price) * (Number(item.qty) || 1);
      return {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        qty: Number(item.qty) || 1,
      };
    });

    if (!Number.isInteger(amount) || amount <= 0) {
      return json({ error: "Invalid amount" }, 400);
    }

    const stripeBody = new URLSearchParams();
    stripeBody.set("amount", String(amount));
    stripeBody.set("currency", "jpy");
    stripeBody.set("automatic_payment_methods[enabled]", "true");
    stripeBody.set("description", "SATSUMA NOIR order");
    if (customerEmail) stripeBody.set("receipt_email", String(customerEmail));
    if (customerName) stripeBody.set("metadata[customer_name]", String(customerName));
    if (customerEmail) stripeBody.set("metadata[customer_email]", String(customerEmail));
    stripeBody.set("metadata[item_count]", String(orderItems.length));

    const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeBody,
    });

    const stripeData = await stripeResponse.json();
    if (!stripeResponse.ok) {
      console.error("[create-payment-intent] Stripe error:", stripeData);
      return json({ error: "Failed to create payment intent", detail: stripeData.error?.message }, 502);
    }

    return json({
      clientSecret: stripeData.client_secret,
      paymentIntentId: stripeData.id,
      amount,
      currency: "jpy",
      items: orderItems,
    });
  } catch (error) {
    console.error("[create-payment-intent] unexpected error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
