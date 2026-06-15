// ============================================================
//  Data Access Layer — InquiryStore
//  ------------------------------------------------------------
//  お問い合わせ（CONTACTフォーム）の保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  お問い合わせオブジェクトの形:
//    { id, name, email, message, createdAt: ISO文字列, status: "new" | "read" }
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_inquiries";

  const daysAgoISO = (days, h = 10, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // 初期データ（デモ用サンプル）。空でも動くが、管理画面の表示確認のため数件入れておく。
  function buildSeed() {
    return [
      { id: 1, name: "鈴木 花子", email: "hanako.suzuki@example.com", message: "ギフト包装に対応していますか？のし紙はつけられますか？", createdAt: daysAgoISO(2, 14, 23), status: "new" },
      { id: 2, name: "田中 太郎", email: "taro.tanaka@example.com", message: "先日購入したバスクチーズケーキがとても美味しかったです。法人向けのまとめ買いは可能でしょうか。", createdAt: daysAgoISO(1, 9, 5), status: "new" },
      { id: 3, name: "佐藤 美咲", email: "misaki.sato@example.com", message: "アレルギー情報について詳しく知りたいです。乳・卵以外のアレルゲンはありますか？", createdAt: daysAgoISO(5, 18, 40), status: "read" },
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
    return list.reduce((max, i) => Math.max(max, Number(i.id) || 0), 0) + 1;
  }

  const InquiryStore = {
    // 新しい順（受信日時の降順）で返す
    async findAll() {
      return read()
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async findById(id) {
      return read().find((i) => i.id === Number(id)) ?? null;
    },

    // フォームからの新規受信。status は "new" 固定。
    async create(data) {
      const list = read();
      const inquiry = {
        name: data.name,
        email: data.email,
        message: data.message,
        createdAt: new Date().toISOString(),
        status: "new",
        id: nextId(list),
      };
      write([...list, inquiry]);
      return inquiry;
    },

    async updateStatus(id, status) {
      const list = read();
      const target = Number(id);
      write(list.map((i) => (i.id === target ? { ...i, status } : i)));
      return read().find((i) => i.id === target) ?? null;
    },

    async remove(id) {
      const target = Number(id);
      write(read().filter((i) => i.id !== target));
    },

    // 未読件数（サイドバーのバッジ用）
    async countNew() {
      return read().filter((i) => i.status === "new").length;
    },

    async resetToSeed() {
      const seed = buildSeed();
      write(seed);
      return seed;
    },
  };

  global.InquiryStore = InquiryStore;
})(window);
