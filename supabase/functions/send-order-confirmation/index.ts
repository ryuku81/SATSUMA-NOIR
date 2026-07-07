import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OrderItem = {
  id?: number;
  name?: string;
  price?: number;
  qty?: number;
};

type OrderRow = {
  id: number;
  customer: string;
  email: string;
  address: string;
  note: string;
  items: OrderItem[];
  total: number;
  status: string;
  payment: string;
  created_at: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const yen = (value: number) => `¥${Number(value || 0).toLocaleString("ja-JP")}`;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function orderLinesText(items: OrderItem[]) {
  return items
    .map((item) => {
      const qty = Number(item.qty) || 1;
      const price = Number(item.price) || 0;
      return `・${item.name || "商品"} × ${qty}　${yen(price * qty)}`;
    })
    .join("\n");
}

function orderLinesHtml(items: OrderItem[]) {
  return items
    .map((item) => {
      const qty = Number(item.qty) || 1;
      const price = Number(item.price) || 0;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e6ded2;">${escapeHtml(item.name || "商品")}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e6ded2;text-align:center;">${qty}</td>
        <td style="padding:10px 0;border-bottom:1px solid #e6ded2;text-align:right;">${yen(price * qty)}</td>
      </tr>`;
    })
    .join("");
}

function buildCustomerEmail(order: OrderRow) {
  const subject = `【SATSUMA NOIR】ご注文ありがとうございます（#${order.id}）`;
  const text = `${order.customer} 様

SATSUMA NOIRをご利用いただきありがとうございます。
以下の内容でご注文を承りました。

注文番号: #${order.id}
注文日時: ${formatDate(order.created_at)}
お支払い方法: ${order.payment || "未設定"}

ご注文内容:
${orderLinesText(order.items || [])}

合計: ${yen(order.total)}

お届け先:
${order.address || ""}

備考:
${order.note || "なし"}

発送準備が整い次第、改めてご案内いたします。

SATSUMA NOIR`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#211b16;line-height:1.8;background:#f8f5ef;padding:28px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;padding:28px;border:1px solid #e6ded2;">
        <p>${escapeHtml(order.customer)} 様</p>
        <p>SATSUMA NOIRをご利用いただきありがとうございます。以下の内容でご注文を承りました。</p>
        <table style="width:100%;border-collapse:collapse;margin:22px 0;">
          <tr><td style="color:#7b6b55;">注文番号</td><td style="text-align:right;">#${order.id}</td></tr>
          <tr><td style="color:#7b6b55;">注文日時</td><td style="text-align:right;">${escapeHtml(formatDate(order.created_at))}</td></tr>
          <tr><td style="color:#7b6b55;">お支払い方法</td><td style="text-align:right;">${escapeHtml(order.payment || "未設定")}</td></tr>
        </table>
        <h2 style="font-size:16px;margin:28px 0 8px;">ご注文内容</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px 0;border-bottom:1px solid #cbbda7;text-align:left;">商品</th>
              <th style="padding:8px 0;border-bottom:1px solid #cbbda7;text-align:center;">数量</th>
              <th style="padding:8px 0;border-bottom:1px solid #cbbda7;text-align:right;">小計</th>
            </tr>
          </thead>
          <tbody>${orderLinesHtml(order.items || [])}</tbody>
        </table>
        <p style="font-size:18px;text-align:right;margin:18px 0 28px;"><strong>合計 ${yen(order.total)}</strong></p>
        <h2 style="font-size:16px;margin:24px 0 8px;">お届け先</h2>
        <p style="white-space:pre-wrap;">${escapeHtml(order.address || "")}</p>
        <h2 style="font-size:16px;margin:24px 0 8px;">備考</h2>
        <p style="white-space:pre-wrap;">${escapeHtml(order.note || "なし")}</p>
        <p style="margin-top:28px;">発送準備が整い次第、改めてご案内いたします。</p>
        <p style="margin-top:28px;color:#7b6b55;">SATSUMA NOIR</p>
      </div>
    </div>`;

  return { subject, text, html };
}

function buildAdminEmail(order: OrderRow) {
  const subject = `【SATSUMA NOIR】新規注文 #${order.id}`;
  const text = `新規注文が入りました。

注文番号: #${order.id}
注文日時: ${formatDate(order.created_at)}
顧客: ${order.customer}
メール: ${order.email}
支払い方法: ${order.payment || "未設定"}

ご注文内容:
${orderLinesText(order.items || [])}

合計: ${yen(order.total)}

お届け先:
${order.address || ""}

備考:
${order.note || "なし"}`;

  const html = `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.7;">${escapeHtml(text)}</pre>`;
  return { subject, text, html };
}

async function sendEmail(params: { to: string; subject: string; text: string; html: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") || "SATSUMA NOIR <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[send-order-confirmation] RESEND_API_KEY is not configured.");
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error ${response.status}: ${body}`);
  }
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const { data: order, error } = await supabase
      .from("orders")
      .select("id, customer, email, address, note, items, total, status, payment, created_at")
      .eq("id", Number(orderId))
      .single<OrderRow>();

    if (error) {
      console.error("[send-order-confirmation] order fetch failed:", error);
      return new Response(JSON.stringify({ error: "Order not found or not permitted" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerEmail = buildCustomerEmail(order);
    const adminEmail = Deno.env.get("ADMIN_ORDER_EMAIL");

    const results = await Promise.allSettled([
      sendEmail({ to: order.email, ...customerEmail }),
      adminEmail ? sendEmail({ to: adminEmail, ...buildAdminEmail(order) }) : Promise.resolve({ skipped: true }),
    ]);

    const rejected = results.find((result) => result.status === "rejected");
    if (rejected && rejected.status === "rejected") {
      console.error("[send-order-confirmation] email send failed:", rejected.reason);
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const values = results.map((result) => result.status === "fulfilled" ? result.value : null);
    const sent = values.some((value) => value && !("skipped" in value));

    return new Response(JSON.stringify({ ok: true, sent, results: values }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-order-confirmation] unexpected error:", error);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
