// ============================================================
//  Data Access Layer — SettingsStore
//  ------------------------------------------------------------
//  サイト設定（SNSリンク等）の保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  設定オブジェクトの形:
//    { instagramUrl, xUrl, noteUrl }
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_settings";

  const DEFAULTS = {
    instagramUrl: "",
    xUrl: "",
    noteUrl: "",
    // メインビジュアル画像（空なら HTML 既定の画像を使う）
    heroImage: "",
    statementImage: "",
  };

  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULTS };
    try {
      const data = JSON.parse(raw);
      return { ...DEFAULTS, ...(data && typeof data === "object" ? data : {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }
  function write(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  const SettingsStore = {
    async get() {
      return read();
    },

    async update(data) {
      const next = { ...read(), ...data };
      write(next);
      return next;
    },
  };

  global.SettingsStore = SettingsStore;
})(window);
