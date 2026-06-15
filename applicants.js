// ============================================================
//  Data Access Layer — ApplicantStore
//  ------------------------------------------------------------
//  採用エントリー（entry.html）からの応募者情報を保存・取得する層。
//  他ストアと同じく async API。
//
//  応募者オブジェクトの形:
//    { id, name, kana, email, phone, position, message,
//      createdAt: ISO文字列, status: "new" | "read" }
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_applicants";

  const daysAgoISO = (days, h = 10, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  // 初期データ（デモ用サンプル）
  function buildSeed() {
    return [
      { id: 1, name: "山田 桃子", kana: "ヤマダ モモコ", email: "momoko.yamada@example.com", phone: "090-1234-5678", position: "パティシエ", message: "製菓専門学校を卒業後、洋菓子店で3年勤務しました。バスクチーズケーキ作りに挑戦したく応募しました。", createdAt: daysAgoISO(1, 11, 20), status: "new" },
      { id: 2, name: "井上 拓海", kana: "イノウエ タクミ", email: "takumi.inoue@example.com", phone: "080-9876-5432", position: "ECチーム", message: "ECサイトの運営・カスタマーサポートの経験があります。地道なモノ作りに共感し応募しました。", createdAt: daysAgoISO(4, 15, 5), status: "read" },
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
    return list.reduce((max, a) => Math.max(max, Number(a.id) || 0), 0) + 1;
  }

  const ApplicantStore = {
    // 新しい順（応募日時の降順）
    async findAll() {
      return read()
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async findById(id) {
      return read().find((a) => a.id === Number(id)) ?? null;
    },

    // entry フォームからの新規応募。status は "new" 固定。
    async create(data) {
      const list = read();
      const applicant = {
        name: data.name,
        kana: data.kana || "",
        email: data.email,
        phone: data.phone || "",
        position: data.position || "",
        message: data.message || "",
        createdAt: new Date().toISOString(),
        status: "new",
        id: nextId(list),
      };
      write([...list, applicant]);
      return applicant;
    },

    async updateStatus(id, status) {
      const list = read();
      const target = Number(id);
      write(list.map((a) => (a.id === target ? { ...a, status } : a)));
      return read().find((a) => a.id === target) ?? null;
    },

    async remove(id) {
      const target = Number(id);
      write(read().filter((a) => a.id !== target));
    },

    // 未読件数（サイドバーのバッジ用）
    async countNew() {
      return read().filter((a) => a.status === "new").length;
    },

    async resetToSeed() {
      const seed = buildSeed();
      write(seed);
      return seed;
    },
  };

  global.ApplicantStore = ApplicantStore;
})(window);
