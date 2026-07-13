// ============================================================
//  Data Access Layer — TopicStore
//  ------------------------------------------------------------
//  トップページ TOPICS セクションのカードを保存・取得する層。
  //  カードの形: { image, title, desc, url, detailImage, body }
//    image … 画像URL or データURL（アップロード時）
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_topics";
  const VERSION_KEY = "satsuma_topics_version";
  // SEED を変更したら必ずバンプする（既存 localStorage を再シード）。
  const SEED_VERSION = "2";

  // ニュース（お知らせ）と内容が被らないよう、トピックスは
  //  「店舗・食べ方・こだわり・贈り物」など読みもの寄りの訴求にする。
  const SEED = [
    { image: "images/terukuni-store.jpg", title: "照国本店、カフェスペースのご案内", desc: "焼きたて・解凍したての一皿をその場で。エスプレッソやお茶とともにお楽しみいただけます。", url: "#", detailImage: "", body: "" },
    { image: "images/souffle-cheesecake.png", title: "“熟成冷凍”のおいしい解凍ガイド", desc: "室温で約1時間。半解凍とフル解凍で変わる、口どけの違いをご紹介します。", url: "#", detailImage: "", body: "" },
    { image: "images/basque-cheesecake.png", title: "バスクチーズケーキ専門店としてのこだわり", desc: "高温で焼き上げる表面のほろ苦さと、とろける中心。私たちの原点の一台です。", url: "#", detailImage: "", body: "" },
    { image: "images/truffle-collection.png", title: "ご褒美に、トリュフチョコレートの詰め合わせ", desc: "ひと粒に込めた濃密なひととき。大切な方への贈り物にもおすすめです。", url: "#", detailImage: "", body: "" },
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
      return Array.isArray(data) ? data.map((t) => ({ detailImage: "", body: "", ...t })) : JSON.parse(JSON.stringify(SEED));
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
      .select("image, title, description, url, detail_image, body, sort_order")
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[TopicStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return (data || []).map((t) => ({ image: t.image, title: t.title, desc: t.description, url: t.url, detailImage: t.detail_image || "", body: t.body || "" }));
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
        detailImage: t.detailImage || "",
        body: (t.body || "").trim(),
      }));
      if (global.sb) {
        const { error: deleteError } = await global.sb.from("topics").delete().neq("id", 0);
        if (deleteError) throw deleteError;
        if (clean.length) {
          const { error } = await global.sb.from("topics").insert(
            clean.map((t, i) => ({
              image: t.image,
              title: t.title,
              description: t.desc,
              url: t.url,
              detail_image: t.detailImage,
              body: t.body,
              sort_order: i + 1,
            }))
          );
          if (error) throw error;
        }
      }
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

  function bodyToHtml(body) {
    return String(body || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  async function renderPublicTopics() {
    const row = document.getElementById("topicsRow");
    if (!row) return;
    const items = await TopicStore.getAll();
    if (items.length === 0) {
      row.innerHTML = "";
      return;
    }
    row.innerHTML = items
      .map((t, i) => {
        // ニュースを経由せず、直接トピックス詳細へ（配列インデックスを ID に使用）
        return `
        <a class="topic-card" href="topic-detail.html?id=${i}">
          <img class="topic-card__img" src="${escapeHtml(t.image)}" alt="" loading="lazy" />
          <div class="topic-card__body">
            <h3 class="topic-card__title">${escapeHtml(t.title)}</h3>
            <p class="topic-card__desc">${escapeHtml(t.desc)}</p>
          </div>
        </a>`;
      })
      .join("");
  }

  // ------------------------------------------------------------
  //  トピックス詳細（topic-detail.html）の描画
  //  デザインはニュース詳細（news-article 系）と共通。
  //  #topicDetail が存在するページでのみ動作する。
  // ------------------------------------------------------------
  async function renderTopicDetail() {
    const root = document.getElementById("topicDetail");
    if (!root) return;

    const id = Number(new URLSearchParams(location.search).get("id"));
    const items = await TopicStore.getAll();
    const t = Number.isInteger(id) ? items[id] : null;

    if (!t) {
      root.innerHTML = `
        <div class="section-head">
          <h2 class="section-head__title">TOPICS</h2>
        </div>
        <p class="cart-page__empty">お探しのトピックスが見つかりませんでした。</p>
        <div class="section-more"><a href="index.html" class="btn btn--ghost">トップへもどる</a></div>`;
      return;
    }

    const title = escapeHtml(t.title);
    const detailImage = t.detailImage || t.image;
    const detailBody = t.body && t.body.trim()
      ? bodyToHtml(t.body)
      : `
        <p>SATSUMA NOIR では、独自の“熟成冷凍”加工により、解凍後がいちばんの食べごろとなるよう、ひとつひとつ手仕事で丁寧に仕上げております。室温で1時間ほど解凍していただくと、外側はしっとり、中心はとろりとほどけるような口どけに変わります。</p>
        <p>最新のお知らせやご注文については、NEWS ページもあわせてご覧ください。</p>`;
    document.title = `${t.title} — TOPICS — SATSUMA NOIR`;

    root.innerHTML = `
      <div class="section-head">
        <h2 class="section-head__title">TOPICS</h2>
      </div>
      <div class="news-article__meta">
        <span class="news-article__cat">TOPICS</span>
      </div>
      <h1 class="news-article__title">${title}</h1>

      <div class="news-article__body">
        <p>${escapeHtml(t.desc)}</p>

        <figure class="news-article__figure">
          <img class="news-article__img" src="${escapeHtml(detailImage)}" alt="${title}" loading="lazy" />
        </figure>

        ${detailBody}
      </div>

      <div class="section-more"><a href="news.html" class="btn btn--ghost">お知らせ一覧へ</a></div>`;
  }

  function renderTopicsPages() {
    renderPublicTopics();
    renderTopicDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderTopicsPages);
  } else {
    renderTopicsPages();
  }
})(window);
