// ============================================================
//  Data Access Layer — TopicStore
//  ------------------------------------------------------------
//  トップページ TOPICS セクションのカードを保存・取得する層。
//  カードの形: { image, title, desc, url }
//    image … 画像URL or データURL（アップロード時）
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_topics";
  const VERSION_KEY = "satsuma_topics_version";
  const SEED_VERSION = "1";

  const SEED = [
    { image: "images/basque-cheesecake.png", title: "人気No.1「バスクチーズケーキ」数量限定で再入荷", desc: "高温で焼き上げた表面のほろ苦さと、とろける中心。数量限定で再入荷しました。", url: "news.html" },
    { image: "images/italian-tiramisu.png", title: "新作「イタリアンティラミス」がコレクションに登場", desc: "マスカルポーネとエスプレッソが織りなす、大人の余韻をぜひ。", url: "news.html" },
    { image: "images/berry-rare-cheesecake.png", title: "季節限定ギフトボックスの受付を開始しました", desc: "大切な方への贈り物に。華やかな季節限定ボックスをご用意しました。", url: "news.html" },
    { image: "images/newyork-cheesecake.png", title: "大型連休期間中の配送スケジュールについて", desc: "ご注文・お届けの目安をご案内します。詳しくはNEWSをご覧ください。", url: "news.html" },
  ];

  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const version = localStorage.getItem(VERSION_KEY);
    if (raw === null || version !== SEED_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      localStorage.setItem(VERSION_KEY, SEED_VERSION);
      return JSON.parse(JSON.stringify(SEED));
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : JSON.parse(JSON.stringify(SEED));
    } catch {
      return JSON.parse(JSON.stringify(SEED));
    }
  }
  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // ---- Supabase 読み込み（未接続・エラー時は localStorage にフォールバック）----
  //  テーブル列 description をアプリ内部の desc に変換して返す。
  async function fetchFromSupabase() {
    if (!global.sb) return null;
    const { data, error } = await global.sb
      .from("topics")
      .select("image, title, description, url, sort_order")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[TopicStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return (data || []).map((t) => ({ image: t.image, title: t.title, desc: t.description, url: t.url }));
  }

  const TopicStore = {
    async getAll() {
      const remote = await fetchFromSupabase();
      return remote !== null ? remote : read();
    },
    // 編集後の配列をまるごと保存
    async saveAll(list) {
      const clean = (Array.isArray(list) ? list : []).map((t) => ({
        image: t.image || "",
        title: (t.title || "").trim(),
        desc: (t.desc || "").trim(),
        url: (t.url || "").trim() || "#",
      }));
      write(clean);
      return clean;
    },
    async resetToSeed() {
      const fresh = JSON.parse(JSON.stringify(SEED));
      write(fresh);
      return fresh;
    },
  };

  global.TopicStore = TopicStore;

  // ------------------------------------------------------------
  //  公開ページ（index.html）の描画
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  async function renderPublicTopics() {
    const row = document.getElementById("topicsRow");
    if (!row) return;
    const items = await TopicStore.getAll();
    if (items.length === 0) {
      row.innerHTML = "";
      return;
    }
    row.innerHTML = items
      .map((t) => {
        const url = t.url && t.url.trim() ? t.url.trim() : "#";
        const external = /^https?:\/\//.test(url);
        return `
        <a class="topic-card" href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener"' : ""}>
          <img class="topic-card__img" src="${escapeHtml(t.image)}" alt="" loading="lazy" />
          <div class="topic-card__body">
            <h3 class="topic-card__title">${escapeHtml(t.title)}</h3>
            <p class="topic-card__desc">${escapeHtml(t.desc)}</p>
          </div>
        </a>`;
      })
      .join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPublicTopics);
  } else {
    renderPublicTopics();
  }
})(window);
