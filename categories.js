// ============================================================
//  Data Access Layer — CategoryStore
//  ------------------------------------------------------------
//  商品カテゴリの保存・取得を担う層。
//  他ストアと同じく async API（一部は同期版も提供）。
//  ※ store.js より前に読み込むこと（ProductStore がラベル解決に使う）。
//
//  カテゴリの形: { value, label }
//    value … 内部キー（商品の p.cat と対応）。英数字のスラッグ。
//    label … 画面表示名。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_categories";

  // 既存商品の cat（baked / rare / special）と一致させた初期カテゴリ。
  const SEED = [
    { value: "baked", label: "BAKED" },
    { value: "rare", label: "RARE" },
    { value: "special", label: "SPECIAL" },
  ];

  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      return [...SEED];
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [...SEED];
    } catch {
      return [...SEED];
    }
  }
  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // ラベルから内部キー（スラッグ）を生成。日本語などで空になる場合は "cat"。
  function slugify(label) {
    return String(label || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
  // 既存と重複しない value を作る
  function uniqueValue(label, list) {
    let base = slugify(label) || "cat";
    let value = base;
    let n = 2;
    while (list.some((c) => c.value === value)) {
      value = `${base}-${n}`;
      n += 1;
    }
    return value;
  }

  const CategoryStore = {
    // 同期取得（store.js の withLabel / 公開ページのフィルタ描画で使用）
    listSync() {
      return read();
    },
    labelOf(value) {
      const c = read().find((x) => x.value === value);
      return c ? c.label : value ? String(value).toUpperCase() : "";
    },

    async findAll() {
      return read();
    },

    // 新規追加（label を受け取り、value は自動生成）。重複ラベルは null を返す。
    async create(label) {
      const list = read();
      const lbl = String(label || "").trim();
      if (!lbl) throw new Error("カテゴリ名が空です");
      if (list.some((c) => c.label === lbl)) return null;
      const cat = { value: uniqueValue(lbl, list), label: lbl };
      write([...list, cat]);
      return cat;
    },

    async remove(value) {
      write(read().filter((c) => c.value !== value));
    },

    async resetToSeed() {
      write(SEED);
      return [...SEED];
    },
  };

  global.CategoryStore = CategoryStore;
})(window);
