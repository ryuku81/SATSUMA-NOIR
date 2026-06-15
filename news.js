// ============================================================
//  Data Access Layer — NewsStore
//  ------------------------------------------------------------
//  お知らせ（NEWS）の保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  記事オブジェクトの形:
//    { id, date: "YYYY-MM-DD", cat, title, url }
//  公開ページ・管理画面とも、日付の新しい順に並べて表示する。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_news";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "1";
  const VERSION_KEY = "satsuma_news_version";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = [
    { id: 1, date: "2026-06-05", cat: "INFO", title: "「熟成冷凍チーズケーキ」数量限定で再入荷しました。", url: "#" },
    { id: 2, date: "2026-05-20", cat: "ITEM", title: "新作「オペラ」がコレクションに登場しました。", url: "#" },
    { id: 3, date: "2026-05-01", cat: "GIFT", title: "季節限定ギフトボックスの受付を開始しました。", url: "#" },
    { id: 4, date: "2026-04-15", cat: "INFO", title: "大型連休期間中の配送スケジュールについて。", url: "#" },
  ];

  // 日付の新しい順（同日は id の大きい順）でソート
  const byDateDesc = (a, b) => {
    const d = String(b.date).localeCompare(String(a.date));
    return d !== 0 ? d : (Number(b.id) || 0) - (Number(a.id) || 0);
  };

  // ---- 永続化（この層だけが localStorage を知っている）----
  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const version = localStorage.getItem(VERSION_KEY);
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
    return list.reduce((max, n) => Math.max(max, Number(n.id) || 0), 0) + 1;
  }

  // ---- 公開 API（async = 将来のバックエンドと同じ形）----
  const NewsStore = {
    async findAll() {
      return read().slice().sort(byDateDesc);
    },

    async findById(id) {
      return read().find((n) => n.id === Number(id)) || null;
    },

    async create(data) {
      const list = read();
      const item = { date: data.date, cat: data.cat, title: data.title, url: data.url, id: nextId(list) };
      write([...list, item]);
      return item;
    },

    async update(id, data) {
      const list = read();
      const target = Number(id);
      const next = list.map((n) =>
        n.id === target ? { ...n, date: data.date, cat: data.cat, title: data.title, url: data.url, id: target } : n
      );
      write(next);
      return next.find((n) => n.id === target) || null;
    },

    async remove(id) {
      const target = Number(id);
      write(read().filter((n) => n.id !== target));
    },

    async resetToSeed() {
      write(SEED);
      return [...SEED];
    },
  };

  global.NewsStore = NewsStore;

  // ------------------------------------------------------------
  //  公開ページ（news.html）の描画
  //  #newsList が存在するページでのみ動作する。
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // "YYYY-MM-DD" → "YYYY.MM.DD"（表示用）
  const dotDate = (d) => String(d ?? "").replace(/-/g, ".");

  async function renderPublicNews() {
    const listEl = document.getElementById("newsList");
    if (!listEl) return;
    const items = await NewsStore.findAll();
    if (items.length === 0) {
      listEl.innerHTML = `<li class="news-item"><a><span class="news-item__title">お知らせはありません。</span></a></li>`;
      return;
    }
    listEl.innerHTML = items
      .map((n) => {
        const url = n.url && n.url.trim() ? n.url.trim() : "#";
        const external = /^https?:\/\//.test(url);
        return `
        <li class="news-item">
          <a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener"' : ""}>
            <span class="news-item__date">${escapeHtml(dotDate(n.date))}</span>
            <span class="news-item__cat">${escapeHtml(n.cat)}</span>
            <span class="news-item__title">${escapeHtml(n.title)}</span>
          </a>
        </li>`;
      })
      .join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPublicNews);
  } else {
    renderPublicNews();
  }
})(window);
