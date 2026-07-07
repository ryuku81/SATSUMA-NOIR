// ============================================================
//  Data Access Layer — ProductStore
//  ------------------------------------------------------------
//  画面側はこの ProductStore の async API だけに依存する。
//  バックエンドを足すときは、この内部実装を fetch(API) に
//  差し替えるだけで済む（呼び出し側は無修正）。
//
//  例: 将来の置き換えイメージ
//    async findAll() {
//      const res = await fetch("/api/products");
//      return res.json();
//    }
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_products";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "10";
  const VERSION_KEY = "satsuma_products_version";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = [
    { id: 1, name: "バスクチーズケーキ", cat: "baked", price: 2600, stock: 12, glyph: "🧀", img: "images/basque-cheesecake.png", tag: "人気", desc: "高温で焼き上げた表面のほろ苦さと、とろける中心。" },
    { id: 2, name: "バスクチーズタルト", cat: "special", price: 2400, stock: 8, glyph: "🥧", img: "images/basque-cheese-tart.png", tag: "NEW", desc: "サクサクのタルト生地に、濃厚なバスク生地を重ねて。" },
    { id: 3, name: "イタリアンティラミス", cat: "special", price: 3200, stock: 6, glyph: "🍮", img: "images/italian-tiramisu.png", tag: "", desc: "マスカルポーネとエスプレッソが織りなす大人の余韻。" },
    { id: 4, name: "レアチーズケーキ", cat: "rare", price: 2200, stock: 15, glyph: "🍰", img: "images/rare-cheesecake.png", tag: "", desc: "焼かずに仕上げた、軽やかでなめらかな口どけ。" },
    { id: 5, name: "ベリーレアチーズケーキ", cat: "rare", price: 2800, stock: 0, glyph: "🫐", img: "images/berry-rare-cheesecake.png", tag: "限定", desc: "甘酸っぱいベリーを重ねた、華やかなレアチーズ。" },
    { id: 6, name: "ニューヨークチーズケーキ", cat: "baked", price: 3000, stock: 10, glyph: "🧀", img: "images/newyork-cheesecake.png", tag: "", desc: "湯せん焼きでしっとり濃密。王道のニューヨークスタイル。" },
    { id: 7, name: "ベイクドチーズケーキ", cat: "baked", price: 2000, stock: 20, glyph: "🧀", img: "images/baked-cheesecake.png", tag: "", desc: "クリームチーズの素朴な甘みを、じっくり焼き上げて。" },
    { id: 8, name: "スフレチーズケーキ", cat: "baked", price: 2300, stock: 3, glyph: "☁️", img: "images/souffle-cheesecake.png", tag: "", desc: "ふわっと軽い口あたり。空気を含ませた優しい味わい。" },
  ];

  // 在庫アラートのしきい値（これ以下で「残りわずか」、0で「在庫切れ」）
  const LOW_STOCK_THRESHOLD = 5;

  // cat（内部値）→ 表示ラベル。カテゴリは CategoryStore（categories.js）が正。
  const labelOf = (cat) =>
    global.CategoryStore ? global.CategoryStore.labelOf(cat) : cat ? String(cat).toUpperCase() : "";
  const withLabel = (p) => ({ ...p, catLabel: labelOf(p.cat) });

  // 旧データ（stock 未設定）を補完する移行処理。
  // 既存の8商品はシード値、それ以外は 0 を既定とする。
  function migrate(p) {
    if (p.stock === undefined || p.stock === null) {
      const seeded = SEED.find((s) => s.id === p.id);
      return { ...p, stock: seeded ? seeded.stock : 0 };
    }
    return p;
  }

  // ---- 永続化（この層だけが localStorage を知っている）----
  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const version = localStorage.getItem(VERSION_KEY);
    // 未保存、またはシードのバージョンが変わったら再シード
    if (raw === null || version !== SEED_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      localStorage.setItem(VERSION_KEY, SEED_VERSION);
      return [...SEED];
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data.map(migrate) : [...SEED];
    } catch {
      return [...SEED];
    }
  }
  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  function nextId(list) {
    return list.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0) + 1;
  }

  // ---- Supabase 読み込み（未接続・エラー時は localStorage にフォールバック）----
  //  テーブル列 description をアプリ内部の desc に変換して返す。
  async function fetchFromSupabase() {
    if (!global.sb) return null;
    const { data, error } = await global.sb
      .from("products")
      .select("id, name, category_value, price, stock, tag, image, glyph, description, feature_head, feature_body, feature_image, spec_size, spec_expiry, spec_ingredients, notes, gallery")
      .order("id", { ascending: true });
    if (error) {
      console.error("[ProductStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      cat: p.category_value,
      price: p.price,
      stock: p.stock,
      tag: p.tag,
      img: p.image,
      glyph: p.glyph,
      desc: p.description,
      featureHead: p.feature_head,
      featureBody: p.feature_body,
      featureImage: p.feature_image,
      specSize: p.spec_size,
      specExpiry: p.spec_expiry,
      specIngredients: p.spec_ingredients,
      notes: p.notes,
      gallery: Array.isArray(p.gallery) ? p.gallery : [],
    }));
  }

  const toRow = (data) => ({
    name: data.name,
    category_value: data.cat,
    price: Number(data.price) || 0,
    stock: Number(data.stock) || 0,
    tag: data.tag || "",
    image: data.img || "",
    glyph: data.glyph || "",
    description: data.desc || "",
    feature_head: data.featureHead || "",
    feature_body: data.featureBody || "",
    feature_image: data.featureImage || "",
    spec_size: data.specSize || "",
    spec_expiry: data.specExpiry || "",
    spec_ingredients: data.specIngredients || "",
    notes: data.notes || "",
    gallery: Array.isArray(data.gallery) ? data.gallery : [],
  });

  const fromRow = (p) => withLabel({
    id: p.id,
    name: p.name,
    cat: p.category_value,
    price: p.price,
    stock: p.stock,
    tag: p.tag,
    img: p.image,
    glyph: p.glyph,
    desc: p.description,
    featureHead: p.feature_head,
    featureBody: p.feature_body,
    featureImage: p.feature_image,
    specSize: p.spec_size,
    specExpiry: p.spec_expiry,
    specIngredients: p.spec_ingredients,
    notes: p.notes,
    gallery: Array.isArray(p.gallery) ? p.gallery : [],
  });

  // ---- 公開 API（async = 将来のバックエンドと同じ形）----
  const ProductStore = {
    // カテゴリは CategoryStore（categories.js）から取得（追加・削除に追従）
    get CATEGORIES() {
      return global.CategoryStore ? global.CategoryStore.listSync() : [];
    },

    LOW_STOCK_THRESHOLD,

    async findAll() {
      const remote = await fetchFromSupabase();
      const list = remote !== null ? remote : read();
      return list.map(withLabel);
    },

    // 在庫切れ・残りわずかの商品を返す（ダッシュボードの在庫アラート用）
    async findStockAlerts() {
      const remote = await fetchFromSupabase();
      return (remote !== null ? remote : read())
        .map(withLabel)
        .filter((p) => (Number(p.stock) || 0) <= LOW_STOCK_THRESHOLD)
        .map((p) => ({
          ...p,
          stock: Number(p.stock) || 0,
          level: (Number(p.stock) || 0) === 0 ? "out" : "low",
        }))
        .sort((a, b) => a.stock - b.stock);
    },

    async findById(id) {
      if (global.sb) {
        const { data, error } = await global.sb
          .from("products")
          .select("id, name, category_value, price, stock, tag, image, glyph, description, feature_head, feature_body, feature_image, spec_size, spec_expiry, spec_ingredients, notes, gallery")
          .eq("id", Number(id))
          .maybeSingle();
        if (!error) return data ? fromRow(data) : null;
        console.error("[ProductStore] Supabase の取得に失敗しました:", error);
      }
      const found = read().find((p) => p.id === Number(id));
      return found ? withLabel(found) : null;
    },

    async create(data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("products")
          .insert(toRow(data))
          .select("id, name, category_value, price, stock, tag, image, glyph, description, feature_head, feature_body, feature_image, spec_size, spec_expiry, spec_ingredients, notes, gallery")
          .single();
        if (error) throw error;
        return fromRow(row);
      }
      const list = read();
      const product = { ...data, id: nextId(list) };
      write([...list, product]);
      return withLabel(product);
    },

    async update(id, data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("products")
          .update(toRow(data))
          .eq("id", Number(id))
          .select("id, name, category_value, price, stock, tag, image, glyph, description, feature_head, feature_body, feature_image, spec_size, spec_expiry, spec_ingredients, notes, gallery")
          .single();
        if (error) throw error;
        return fromRow(row);
      }
      const list = read();
      const target = Number(id);
      const next = list.map((p) => (p.id === target ? { ...p, ...data, id: target } : p));
      write(next);
      const updated = next.find((p) => p.id === target);
      return updated ? withLabel(updated) : null;
    },

    async remove(id) {
      if (global.sb) {
        const { error } = await global.sb.from("products").delete().eq("id", Number(id));
        if (error) throw error;
        return;
      }
      const target = Number(id);
      write(read().filter((p) => p.id !== target));
    },

    // 商品詳細ページ用の編集フィールド（管理画面で localStorage に保存）を同期取得。
    //  公開側の PRODUCTS は Supabase 由来のため、ここで上書き用の値だけ取り出す。
    detailOverrides(id) {
      const found = read().find((p) => p.id === Number(id));
      if (!found) return {};
      const out = {};
      ["featureHead", "featureBody", "featureImage", "specSize", "specExpiry", "specIngredients", "notes"].forEach((k) => {
        if (found[k]) out[k] = found[k];
      });
      if (Array.isArray(found.gallery) && found.gallery.length) out.gallery = found.gallery;
      return out;
    },

    // 開発用: シード状態に戻す
    async resetToSeed() {
      write(SEED);
      return SEED.map(withLabel);
    },
  };

  global.ProductStore = ProductStore;
})(window);
