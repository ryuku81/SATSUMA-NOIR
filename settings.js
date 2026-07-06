// ============================================================
//  Data Access Layer — SettingsStore
//  ------------------------------------------------------------
//  サイト設定（画像・各セクションの文章・SNSリンク等）の保存・取得層。
//  Supabase の site_settings（id=1 の1行）を正とし、未接続・エラー時は
//  localStorage にフォールバックする（他ストアと同じ方針）。
//
//  注意:
//    - site_settings の列はスネークケース。アプリ内はキャメルケース。
//      → COLUMN_MAP で相互変換する。
//    - COLUMN_MAP に無いキーは列が無いため localStorage のみで保持される。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_settings";
  const ROW_ID = 1; // site_settings は単一行（id=1）で運用

  const DEFAULTS = {
    instagramUrl: "",
    xUrl: "",
    noteUrl: "",
    // メインビジュアル画像（空なら HTML 既定の画像を使う）
    heroImage: "",
    statementImage: "",
    // HOW TO EAT セクションの3枚（空なら HTML 既定の画像を使う）
    howtoImage1: "",
    howtoImage2: "",
    howtoImage3: "",
    // About セクションの背景画像（空なら HTML 既定の画像を使う）
    aboutImage: "",
    // About セクションの文章（トップページ）。改行で段落が分かれる。
    aboutHeading: "SOUL CAKE SHOPへようこそ",
    aboutBody:
      "2018年、九州初のバスクチーズケーキ専門店として創業。\n独自製法”熟成冷凍”加工にて『解凍後がいちばんの食べごろ』となるように製造しています。全国各地のお客様に愛され続けるモノ作りに取り組んでいます。2025年、原点回帰による”目が届く範囲”のみで運営します。",

    // メインビジュアル右下のコンセプト文
    heroConceptLabel: "CONCEPT：WEEKEND_BASQUE",
    heroConceptHead: "『ひと口食べた瞬間、週末気分に』",
    heroConceptBody:
      "その瞬間のためだけに地道なモノ作りをしていると言っても過言ではありません。品質と味をトコトン大切にひとつひとつ地道で地味な作業を繰り返しています。",

    // ステートメント（RANKINGの上）。本文は改行で行が分かれる。
    statementHead: "いつもの一日を、特別な週末に。",
    statementBody:
      "濃厚なのに、すっと溶ける。\nひと口ごとに広がる、深い余韻。\n素材と静かに向き合い、手仕事で仕上げた一皿を。\nあなたの週末に、ささやかな贅沢を。",

    // HOW TO EAT セクション。見出し・本文は改行で行が分かれる。
    howtoEyebrow: "お召し上がり方",
    howtoTitle: "熟成冷凍チーズケーキの\nお召し上がり方",
    howtoRecommendLabel: "STAFF RECOMMEND",
    howtoRecommendText:
      "スタッフおすすめは、室温で1時間解凍したら小分けにカットし、食べる分だけ解凍し、残りは冷凍庫へ♪\n毎日のご褒美に少しずつお楽しみ頂けます。",
  };

  // アプリ(キャメル) ↔ site_settings 列(スネーク) の対応。
  const COLUMN_MAP = {
    instagramUrl: "instagram_url",
    xUrl: "x_url",
    noteUrl: "note_url",
    heroImage: "hero_image",
    statementImage: "statement_image",
    howtoImage1: "howto_image1",
    howtoImage2: "howto_image2",
    howtoImage3: "howto_image3",
    aboutHeading: "about_heading",
    aboutBody: "about_body",
    heroConceptLabel: "hero_concept_label",
    heroConceptHead: "hero_concept_head",
    heroConceptBody: "hero_concept_body",
    statementHead: "statement_head",
    statementBody: "statement_body",
    howtoEyebrow: "howto_eyebrow",
    howtoTitle: "howto_title",
    howtoRecommendLabel: "howto_recommend_label",
    howtoRecommendText: "howto_recommend_text",
  };

  // ---- 永続化（localStorage：フォールバック兼SNS等ローカル専用キーの保持）----
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

  // site_settings の行(スネーク) → アプリ設定(キャメル) の部分オブジェクト
  function fromRow(row) {
    const out = {};
    for (const [camel, snake] of Object.entries(COLUMN_MAP)) {
      if (row[snake] != null) out[camel] = row[snake];
    }
    return out;
  }
  // アプリ設定(キャメル) → site_settings へ送る行(スネーク)。列がある項目のみ。
  function toRow(settings) {
    const row = {};
    for (const [camel, snake] of Object.entries(COLUMN_MAP)) {
      if (settings[camel] !== undefined) row[snake] = settings[camel];
    }
    return row;
  }

  // ---- Supabase 連携（未接続・エラー時は null/false を返してフォールバック）----
  async function fetchFromSupabase() {
    if (!global.sb) return null;
    const { data, error } = await global.sb
      .from("site_settings")
      .select("*")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) {
      console.error("[SettingsStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return data ? fromRow(data) : null;
  }
  async function saveToSupabase(settings) {
    if (!global.sb) return false;
    const { error } = await global.sb
      .from("site_settings")
      .update(toRow(settings))
      .eq("id", ROW_ID);
    if (error) {
      console.error("[SettingsStore] Supabase への保存に失敗しました:", error);
      return false;
    }
    return true;
  }

  // ページ内で get() が複数回呼ばれても 1 回のフェッチで済むよう Promise をキャッシュ
  let cached = null;
  async function load() {
    const remote = await fetchFromSupabase(); // 共通列のみ（SNS等は含まない）
    const local = read();                     // SNS 等ローカル専用キーを補完
    return remote ? { ...DEFAULTS, ...local, ...remote } : local;
  }

  const SettingsStore = {
    async get() {
      if (!cached) cached = load();
      return cached;
    },

    async update(data) {
      const next = { ...read(), ...data };
      write(next);                  // localStorage へミラー（フォールバック／SNS保持）
      await saveToSupabase(next);   // site_settings の列を更新
      cached = Promise.resolve(next); // キャッシュも即時更新
      return next;
    },
  };

  global.SettingsStore = SettingsStore;
})(window);
