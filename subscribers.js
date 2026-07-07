// ============================================================
//  Data Access Layer — SubscriberStore
//  ------------------------------------------------------------
//  メールマガジン登録者の保存・取得を担う層。
//  登録者の形: { id, email, createdAt: ISO文字列 }
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_subscribers";

  const daysAgoISO = (days, h = 10, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // 初期データ（デモ用サンプル）
  function buildSeed() {
    return [
      { id: 1, email: "hanako.suzuki@example.com", createdAt: daysAgoISO(3, 13, 10) },
      { id: 2, email: "taro.tanaka@example.com", createdAt: daysAgoISO(1, 9, 42) },
    ];
  }

  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const seed = buildSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : buildSeed();
    } catch {
      return buildSeed();
    }
  }
  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  function nextId(list) {
    return list.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
  }

  const SubscriberStore = {
    // 新しい順（登録日時の降順）
    async findAll() {
      if (global.sb) {
        const { data, error } = await global.sb
          .from("subscribers")
          .select("id, email, created_at")
          .order("created_at", { ascending: false });
        if (!error) return (data || []).map((s) => ({ id: s.id, email: s.email, createdAt: s.created_at }));
        console.error("[SubscriberStore] Supabase の取得に失敗しました:", error);
      }
      return read()
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    // 新規登録。同じメールが既にあれば追加しない（既存を返す）。
    async create(email) {
      const list = read();
      const mail = String(email || "").trim();
      if (!mail) throw new Error("メールアドレスが空です");
      if (global.sb) {
        const { error } = await global.sb
          .from("subscribers")
          .insert({ email: mail });
        if (!error) return { id: Date.now(), email: mail, createdAt: new Date().toISOString() };
        if (error.code !== "23505") throw error;
      }
      const exists = list.find((s) => s.email.toLowerCase() === mail.toLowerCase());
      if (exists) return exists;
      const sub = { id: nextId(list), email: mail, createdAt: new Date().toISOString() };
      write([...list, sub]);
      return sub;
    },

    async remove(id) {
      if (global.sb) {
        const { error } = await global.sb.from("subscribers").delete().eq("id", Number(id));
        if (error) throw error;
        return;
      }
      const target = Number(id);
      write(read().filter((s) => s.id !== target));
    },

    async count() {
      if (global.sb) {
        const { count, error } = await global.sb.from("subscribers").select("id", { count: "exact", head: true });
        if (!error) return count || 0;
      }
      return read().length;
    },

    async resetToSeed() {
      const seed = buildSeed();
      write(seed);
      return seed;
    },
  };

  global.SubscriberStore = SubscriberStore;
})(window);
