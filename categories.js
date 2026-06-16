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

  // ---- Supabase 連携 ----
  //  同期 API（listSync/labelOf）は localStorage キャッシュを参照する。
  //  読み込み時に prime() で Supabase から取得してキャッシュを更新し、
  //  更新完了を 'categories:updated' イベントで通知する（admin が再描画）。
  const fromRows = (rows) => (rows || []).map((c) => ({ value: c.value, label: c.label }));

  async function fetchSorted() {
    const { data, error } = await global.sb
      .from("categories")
      .select("value, label, sort_order")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[CategoryStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return fromRows(data);
  }

  // 起動時：Supabase の内容でキャッシュを更新
  async function prime() {
    if (!global.sb) return;
    const list = await fetchSorted();
    if (list) {
      write(list);
      global.dispatchEvent(new Event("categories:updated"));
    }
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
      if (global.sb) {
        const list = await fetchSorted();
        if (list) {
          write(list);
          return list;
        }
      }
      return read();
    },

    // 新規追加（label を受け取り、value は自動生成）。重複ラベルは null を返す。
    async create(label) {
      const list = read();
      const lbl = String(label || "").trim();
      if (!lbl) throw new Error("カテゴリ名が空です");
      if (list.some((c) => c.label === lbl)) return null;
      const value = uniqueValue(lbl, list);
      if (global.sb) {
        const { data: maxRow } = await global.sb
          .from("categories")
          .select("sort_order")
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextOrder = ((maxRow && maxRow.sort_order) || 0) + 1;
        const { data: row, error } = await global.sb
          .from("categories")
          .insert({ value, label: lbl, sort_order: nextOrder })
          .select("value, label")
          .single();
        if (error) {
          // 23505 = 一意制約（value/label 重複）。重複として null を返す。
          if (error.code === "23505") return null;
          console.error("[CategoryStore] カテゴリの追加に失敗しました:", error);
          throw error;
        }
        write([...list, { value: row.value, label: row.label }]);
        return { value: row.value, label: row.label };
      }
      const cat = { value, label: lbl };
      write([...list, cat]);
      return cat;
    },

    async remove(value) {
      if (global.sb) {
        const { error } = await global.sb.from("categories").delete().eq("value", value);
        if (error) {
          console.error("[CategoryStore] カテゴリの削除に失敗しました:", error);
          throw error;
        }
      }
      write(read().filter((c) => c.value !== value));
    },

    async resetToSeed() {
      write(SEED);
      return [...SEED];
    },
  };

  global.CategoryStore = CategoryStore;

  // 起動時にキャッシュを Supabase で更新（接続時のみ）
  prime();
})(window);
