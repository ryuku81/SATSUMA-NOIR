// ============================================================
//  Supabase Auth Helper
//  ------------------------------------------------------------
//  ログイン・会員登録・管理者判定を window.Auth として公開する。
//  role は public.users.role を参照する。
// ============================================================
(function (global) {
  const client = () => global.supabaseAuthClient;

  const notReady = () => ({
    data: null,
    error: new Error("認証クライアントが初期化されていません。"),
  });

  const Auth = {
    emailRedirectTo(path = "login.html", params = { verified: "1" }) {
      const url = new URL(path, global.location.href);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      return url.href;
    },

    passwordResetRedirectTo() {
      return this.emailRedirectTo("login.html", { reset: "1" });
    },

    async completeRedirect() {
      const sb = client();
      if (!sb) return { data: null, error: null };
      const code = new URLSearchParams(global.location.search).get("code");
      if (!code) return { data: null, error: null };
      return sb.auth.exchangeCodeForSession(code);
    },

    async signUp({ email, password, name }) {
      const sb = client();
      if (!sb) return notReady();
      return sb.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || "" },
          emailRedirectTo: this.emailRedirectTo("login.html", { verified: "1" }),
        },
      });
    },

    async signIn({ email, password }) {
      const sb = client();
      if (!sb) return notReady();
      return sb.auth.signInWithPassword({ email, password });
    },

    async signOut() {
      const sb = client();
      if (!sb) return { error: null };
      return sb.auth.signOut();
    },

    async requestPasswordReset(email) {
      const sb = client();
      if (!sb) return notReady();
      return sb.auth.resetPasswordForEmail(email, {
        redirectTo: this.passwordResetRedirectTo(),
      });
    },

    async updatePassword(password) {
      const sb = client();
      if (!sb) return notReady();
      return sb.auth.updateUser({ password });
    },

    async updateProfileName(name) {
      const sb = client();
      const user = await this.getUser();
      if (!sb || !user) return notReady();
      const authResult = await sb.auth.updateUser({ data: { name } });
      if (authResult.error) return authResult;
      const profileResult = await sb
        .from("users")
        .update({ name })
        .eq("auth_user_id", user.id)
        .select("id, auth_user_id, email, name, role, created_at")
        .single();
      if (profileResult.error) {
        console.warn("[auth] users テーブルへの名前同期に失敗しました:", profileResult.error);
      }
      return authResult;
    },

    async getUser() {
      const sb = client();
      if (!sb) return null;
      const { data } = await sb.auth.getUser();
      return data ? data.user : null;
    },

    async getProfile() {
      const sb = client();
      const user = await this.getUser();
      if (!sb || !user) return null;
      const { data, error } = await sb
        .from("users")
        .select("id, auth_user_id, email, name, role, created_at")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[auth] profile の取得に失敗しました:", error);
        return null;
      }
      return data || null;
    },

    async getRole() {
      const profile = await this.getProfile();
      return profile ? profile.role : null;
    },

    async isAdmin() {
      return (await this.getRole()) === "admin";
    },

    async listUsers() {
      const sb = client();
      if (!sb) return { data: [], error: new Error("認証クライアントが初期化されていません。") };
      return sb
        .from("users")
        .select("id, auth_user_id, email, name, role, created_at")
        .order("created_at", { ascending: false });
    },

    async updateUserRole(id, role) {
      const sb = client();
      if (!sb) return { data: null, error: new Error("認証クライアントが初期化されていません。") };
      return sb
        .from("users")
        .update({ role })
        .eq("id", id)
        .select("id, auth_user_id, email, name, role, created_at")
        .single();
    },
  };

  global.Auth = Auth;
})(window);
