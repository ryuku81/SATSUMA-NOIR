// ============================================================
//  Supabase Auth Client
//  ------------------------------------------------------------
//  Supabaseクライアント。Auth と各データStoreで共有する。
// ============================================================
(function (global) {
  const SUPABASE_URL = "https://cbnmhyzebooqkbqyzptm.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNibm1oeXplYm9vcWticXl6cHRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTI4NDAsImV4cCI6MjA5ODk2ODg0MH0.9xvqsZZnsSvU6sni2Jo9hTIVgrsGDXfGyPCGTeQK_pk";

  global.SUPABASE_URL = SUPABASE_URL;

  if (!global.supabase || typeof global.supabase.createClient !== "function") {
    console.error("[supabase-client] supabase-js が読み込まれていません。");
    global.supabaseAuthClient = null;
    global.sb = null;
    return;
  }

  const client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  global.supabaseAuthClient = client;
  global.sb = client;
})(window);
