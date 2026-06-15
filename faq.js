// ============================================================
//  Data Access Layer — FaqStore
//  ------------------------------------------------------------
//  FAQ（よくあるご質問）の保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  FAQ項目の形: { id, q, a }  （q=質問, a=回答）
//  配列の並び順がそのまま表示順になる。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_faqs";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "1";
  const VERSION_KEY = "satsuma_faqs_version";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = [
    { id: 1, q: "解凍後はどのくらい日持ちしますか？", a: "解凍後は冷蔵庫で2〜3日を目安にお召し上がりください。小分けにカットし、食べる分だけ解凍して残りは冷凍庫で保存いただくのがおすすめです。" },
    { id: 2, q: "おすすめの食べごろを教えてください。", a: "独自の”熟成冷凍”製法により、解凍後がいちばんの食べごろです。室温で1時間ほど解凍してからお楽しみください。" },
    { id: 3, q: "配送はどのように届きますか？", a: "商品は冷凍便にてお届けします。到着後はすぐに冷凍庫で保管いただき、お召し上がりになる分だけ解凍してください。" },
    { id: 4, q: "ギフト包装には対応していますか？", a: "はい、ギフト包装に対応しております。ご注文時の備考欄にご希望をご記入いただくか、お問い合わせよりご相談ください。" },
    { id: 5, q: "アレルギー情報はどこで確認できますか？", a: "各商品ページに原材料・アレルギー情報を記載しています。ご不明な点はお問い合わせよりお気軽にご連絡ください。" },
  ];

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
      return Array.isArray(data) ? data : [...SEED];
    } catch {
      return [...SEED];
    }
  }
  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  function nextId(list) {
    return list.reduce((max, f) => Math.max(max, Number(f.id) || 0), 0) + 1;
  }

  // ---- 公開 API（async = 将来のバックエンドと同じ形）----
  const FaqStore = {
    async findAll() {
      return read();
    },

    async findById(id) {
      return read().find((f) => f.id === Number(id)) || null;
    },

    async create(data) {
      const list = read();
      const faq = { q: data.q, a: data.a, id: nextId(list) };
      write([...list, faq]);
      return faq;
    },

    async update(id, data) {
      const list = read();
      const target = Number(id);
      const next = list.map((f) => (f.id === target ? { ...f, q: data.q, a: data.a, id: target } : f));
      write(next);
      return next.find((f) => f.id === target) || null;
    },

    async remove(id) {
      const target = Number(id);
      write(read().filter((f) => f.id !== target));
    },

    // 表示順の入れ替え（dir: -1 で上へ, +1 で下へ）
    async move(id, dir) {
      const list = read();
      const i = list.findIndex((f) => f.id === Number(id));
      const j = i + dir;
      if (i === -1 || j < 0 || j >= list.length) return list;
      [list[i], list[j]] = [list[j], list[i]];
      write(list);
      return list;
    },

    // 開発用: シード状態に戻す
    async resetToSeed() {
      write(SEED);
      return [...SEED];
    },
  };

  global.FaqStore = FaqStore;

  // ------------------------------------------------------------
  //  公開ページ（faq.html）の描画
  //  #faqList が存在するページでのみ動作する。
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  async function renderPublicFaq() {
    const listEl = document.getElementById("faqList");
    if (!listEl) return;
    const faqs = await FaqStore.findAll();
    if (faqs.length === 0) {
      listEl.innerHTML = `<p class="faq__lead">準備中です。</p>`;
      return;
    }
    listEl.innerHTML = faqs
      .map(
        (f) => `
        <details class="faq__item">
          <summary class="faq__q">${escapeHtml(f.q)}</summary>
          <div class="faq__a">${escapeHtml(f.a)}</div>
        </details>`
      )
      .join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPublicFaq);
  } else {
    renderPublicFaq();
  }
})(window);
