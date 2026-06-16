// ============================================================
//  Supabase Auth ヘルパー（共有）
//  ------------------------------------------------------------
//  window.sb（supabase-client.js）を前提に、認証まわりの
//  共通操作を window.Auth として公開する。
//
//  読み込み順（各 HTML）:
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//    <script src="supabase-client.js"></script>
//    <script src="auth.js"></script>
// ============================================================
(function (global) {
  if (!global.sb) {
    console.error("[auth] supabase-client.js（window.sb）が読み込まれていません。");
    return;
  }

  const Auth = {
    // 会員登録（role は DB トリガーで member 固定。admin は付与できない）
    async signUp({ email, password, name }) {
      return global.sb.auth.signUp({
        email,
        password,
        options: { data: { name: name || "" } },
      });
    },

    // ログイン
    async signIn({ email, password }) {
      return global.sb.auth.signInWithPassword({ email, password });
    },

    async signOut() {
      return global.sb.auth.signOut();
    },

    // 現在のログインユーザー（未ログインなら null）
    async getUser() {
      const { data } = await global.sb.auth.getUser();
      return data ? data.user : null;
    },

    // 自分の role を取得（'admin' | 'member' | null）
    //  profiles は本人分のみ select 可（RLS）。
    async getRole() {
      const user = await this.getUser();
      if (!user) return null;
      const { data, error } = await global.sb
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[auth] role の取得に失敗しました:", error);
        return null;
      }
      return data ? data.role : null;
    },

    async isAdmin() {
      return (await this.getRole()) === "admin";
    },
  };

  global.Auth = Auth;
})(window);
