type NotificationPayload = {
  type?: "inquiry" | "applicant";
  name?: string;
  kana?: string;
  email?: string;
  phone?: string;
  position?: string;
  message?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function required(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function buildNotification(payload: NotificationPayload) {
  if (payload.type === "inquiry") {
    const subject = "【SATSUMA NOIR】新しいお問い合わせ";
    const text = `新しいお問い合わせが届きました。

お名前: ${payload.name || ""}
メール: ${payload.email || ""}

お問い合わせ内容:
${payload.message || ""}`;
    return { subject, text, html: `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.7;">${escapeHtml(text)}</pre>` };
  }

  const subject = "【SATSUMA NOIR】新しい採用応募";
  const text = `新しい採用応募が届きました。

お名前: ${payload.name || ""}
フリガナ: ${payload.kana || ""}
メール: ${payload.email || ""}
電話番号: ${payload.phone || ""}
希望職種: ${payload.position || ""}

メッセージ:
${payload.message || "なし"}`;
  return { subject, text, html: `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1.7;">${escapeHtml(text)}</pre>` };
}

async function sendEmail(params: { to: string; subject: string; text: string; html: string; replyTo?: string }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") || "SATSUMA NOIR <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[send-admin-notification] RESEND_API_KEY is not configured.");
    return { skipped: true };
  }

  const body: Record<string, unknown> = {
    from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  };
  if (params.replyTo) body.reply_to = params.replyTo;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend error ${response.status}: ${errorBody}`);
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
    const payload = await req.json() as NotificationPayload;
    if (payload.type !== "inquiry" && payload.type !== "applicant") {
      return new Response(JSON.stringify({ error: "Invalid notification type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!required(payload.name) || !required(payload.email)) {
      return new Response(JSON.stringify({ error: "name and email are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (payload.type === "inquiry" && !required(payload.message)) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (payload.type === "applicant" && !required(payload.position)) {
      return new Response(JSON.stringify({ error: "position is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminEmail =
      payload.type === "inquiry"
        ? Deno.env.get("ADMIN_CONTACT_EMAIL") || Deno.env.get("ADMIN_ORDER_EMAIL")
        : Deno.env.get("ADMIN_RECRUIT_EMAIL") || Deno.env.get("ADMIN_CONTACT_EMAIL") || Deno.env.get("ADMIN_ORDER_EMAIL");

    if (!adminEmail) {
      console.warn("[send-admin-notification] Admin email is not configured.");
      return new Response(JSON.stringify({ ok: true, sent: false, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notification = buildNotification(payload);
    const result = await sendEmail({
      to: adminEmail,
      ...notification,
      replyTo: payload.email,
    });
    const sent = !("skipped" in result);

    return new Response(JSON.stringify({ ok: true, sent, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[send-admin-notification] unexpected error:", error);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
