// ============================================================
//  Supabase クライアント（共有）
//  ------------------------------------------------------------
//  プロジェクト全体で使い回す Supabase クライアントを 1 つだけ
//  生成し、window.sb として公開する。
//
//  使い方（各 HTML で、この前に CDN の supabase-js を読み込むこと）:
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//    <script src="supabase-client.js"></script>
//  以降、任意のスクリプトから window.sb で参照できる:
//    const { data, error } = await sb.from("faqs").select("*");
//
//  注意:
//    - ここに書いてよいのは anon public キーのみ。
//      service_role / secret キーは絶対にフロントに置かない。
//    - 公開しても安全なのは RLS（行レベルセキュリティ）で
//      許可した操作だけに制限しているため。
// ============================================================
(function (global) {
  // Supabase プロジェクト設定（satsuma-noir-min）
  const SUPABASE_URL = "https://mqtyghsdqeosavuoxapz.supabase.co";
  // anon public キー（公開可・フロント用）
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xdHlnaHNkcWVvc2F2dW94YXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjY3OTQsImV4cCI6MjA5NzE0Mjc5NH0.tjzFMb2kI8Bbcvlc9SNHklL5qFaZwPAj5qYXSrX8Lcw";

  // CDN の supabase-js が先に読み込まれているか確認
  if (!global.supabase || typeof global.supabase.createClient !== "function") {
    console.error(
      "[supabase-client] supabase-js が読み込まれていません。" +
        "この <script> の前に CDN を読み込んでください:\n" +
        '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    );
    return;
  }

  // クライアントは 1 度だけ生成して共有する
  global.sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 参照用に設定値も公開（任意）
  global.SUPABASE_URL = SUPABASE_URL;
})(window);
