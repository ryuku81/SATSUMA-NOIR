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
    // HOW TO EAT セクションの3枚（空なら HTML 既定の画像を使う）
    howtoImage1: "",
    howtoImage2: "",
    howtoImage3: "",
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
    howtoEyebrow: "HOW TO EAT",
    howtoTitle: "熟成冷凍チーズケーキの\nお召し上がり方",
    howtoRecommendLabel: "STAFF RECOMMEND",
    howtoRecommendText:
      "スタッフおすすめは、室温で1時間解凍したら小分けにカットし、食べる分だけ解凍し、残りは冷凍庫へ♪\n毎日のご褒美に少しずつお楽しみ頂けます。",
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
