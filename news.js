// ============================================================
//  Data Access Layer — NewsStore
//  ------------------------------------------------------------
//  お知らせ（NEWS）の保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  記事オブジェクトの形:
//    { id, date: "YYYY-MM-DD", cat, title, url, body, image }
//  公開ページ・管理画面とも、日付の新しい順に並べて表示する。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_news";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "1";
  const VERSION_KEY = "satsuma_news_version";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = [
    { id: 1, date: "2026-06-05", cat: "INFO", title: "「熟成冷凍チーズケーキ」数量限定で再入荷しました。", url: "#", body: "", image: "" },
    { id: 2, date: "2026-05-20", cat: "ITEM", title: "新作「オペラ」がコレクションに登場しました。", url: "#", body: "", image: "" },
    { id: 3, date: "2026-05-01", cat: "GIFT", title: "季節限定ギフトボックスの受付を開始しました。", url: "#", body: "", image: "" },
    { id: 4, date: "2026-04-15", cat: "INFO", title: "大型連休期間中の配送スケジュールについて。", url: "#", body: "", image: "" },
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
      return Array.isArray(data) ? data.map((n) => ({ body: "", image: "", ...n })) : [...SEED];
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

  // ---- Supabase 読み込み（未接続・エラー時は localStorage にフォールバック）----
  async function fetchFromSupabase() {
    if (!global.sb) return null;
    const { data, error } = await global.sb
      .from("news")
      .select("id, date, cat, title, url, body, image")
      .order("date", { ascending: false });
    if (error) {
      console.error("[NewsStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return data || [];
  }

  // ---- 公開 API（async = 将来のバックエンドと同じ形）----
  const NewsStore = {
    async findAll() {
      const remote = await fetchFromSupabase();
      return remote !== null ? remote : read().slice().sort(byDateDesc);
    },

    async findById(id) {
      if (global.sb) {
        const { data, error } = await global.sb
          .from("news")
          .select("id, date, cat, title, url, body, image")
          .eq("id", Number(id))
          .maybeSingle();
        if (!error) return data || null;
        console.error("[NewsStore] Supabase の取得に失敗しました:", error);
      }
      return read().find((n) => n.id === Number(id)) || null;
    },

    async create(data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("news")
          .insert({ date: data.date, cat: data.cat, title: data.title, url: data.url, body: data.body || "", image: data.image || "" })
          .select("id, date, cat, title, url, body, image")
          .single();
        if (error) {
          console.error("[NewsStore] NEWS の追加に失敗しました:", error);
          throw error;
        }
        return row;
      }
      const list = read();
      const item = { date: data.date, cat: data.cat, title: data.title, url: data.url, body: data.body || "", image: data.image || "", id: nextId(list) };
      write([...list, item]);
      return item;
    },

    async update(id, data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("news")
          .update({ date: data.date, cat: data.cat, title: data.title, url: data.url, body: data.body || "", image: data.image || "" })
          .eq("id", Number(id))
          .select("id, date, cat, title, url, body, image")
          .single();
        if (error) {
          console.error("[NewsStore] NEWS の更新に失敗しました:", error);
          throw error;
        }
        return row;
      }
      const list = read();
      const target = Number(id);
      const next = list.map((n) =>
        n.id === target ? { ...n, date: data.date, cat: data.cat, title: data.title, url: data.url, body: data.body || "", image: data.image || "", id: target } : n
      );
      write(next);
      return next.find((n) => n.id === target) || null;
    },

    async remove(id) {
      if (global.sb) {
        const { error } = await global.sb.from("news").delete().eq("id", Number(id));
        if (error) {
          console.error("[NewsStore] NEWS の削除に失敗しました:", error);
          throw error;
        }
        return;
      }
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
        return `
        <li class="news-item">
          <a href="news-detail.html?id=${encodeURIComponent(n.id)}">
            <span class="news-item__date">${escapeHtml(dotDate(n.date))}</span>
            <span class="news-item__cat">${escapeHtml(n.cat)}</span>
            <span class="news-item__title">${escapeHtml(n.title)}</span>
          </a>
        </li>`;
      })
      .join("");
  }

  // ------------------------------------------------------------
  //  お知らせ詳細ページ（news-detail.html）の描画
  //  #newsDetail が存在するページでのみ動作する。
  //  本文・画像が未設定の既存ニュースは、従来の既定本文と既定画像で表示する。
  // ------------------------------------------------------------
  const NEWS_IMAGES = [
    "images/noir-tablette.png",
    "images/truffle-collection.png",
    "images/gateau-chocolat.png",
    "images/basque-cheesecake.png",
  ];
  function newsImageFor(n) {
    return NEWS_IMAGES[(Number(n.id) || 0) % NEWS_IMAGES.length];
  }

  function defaultBodyFor(title) {
    const displayTitle = String(title || "").replace(/^「(.+)」$/, "$1");
    return [
      `平素より SATSUMA NOIR をご愛顧いただき、誠にありがとうございます。このたび、「${displayTitle}」につきまして、お客様へご案内申し上げます。`,
      "独自の“熟成冷凍”加工により、解凍後がいちばんの食べごろとなるよう、ひとつひとつ手仕事で丁寧に仕上げております。素材本来の風味を引き出すため、配合や焼き加減のわずかな差にもこだわり、地道で地味な作業を一日一日積み重ねてまいりました。室温で1時間ほど解凍していただくと、外側はしっとり、中心はとろりとほどけるような口どけに変わります。小分けにカットして、その日に食べる分だけ解凍し、残りは冷凍庫で保存いただくのがおすすめです。毎日のティータイムや、一日の終わりのほっとするひとときに、少しずつお楽しみいただけます。",
      "数に限りがございますので、なくなり次第終了とさせていただきます。ご注文の状況によってはお届けまでお時間をいただく場合がございますが、できる限り食べごろの状態でお手元に届くよう、発送のタイミングまで一つひとつ心を込めて管理しております。商品の保存方法やお召し上がり方について、また配送日のご指定など、ご不明な点がございましたら、お問い合わせフォームよりお気軽にご連絡ください。スタッフ一同、心を込めてご対応いたします。これからも、静かで深い甘さとともに、皆さまの週末に小さな贅沢をお届けできるよう努めてまいります。今後とも SATSUMA NOIR をどうぞよろしくお願いいたします。",
    ];
  }

  function bodyParagraphsFor(n, title) {
    const raw = String(n.body || "").trim();
    const paragraphs = raw ? raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) : defaultBodyFor(title);
    return paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  }

  async function renderNewsDetail() {
    const root = document.getElementById("newsDetail");
    if (!root) return;

    const id = Number(new URLSearchParams(location.search).get("id"));
    const n = await NewsStore.findById(id);

    if (!n) {
      root.innerHTML = `
        <div class="section-head">
          <h2 class="section-head__title">NEWS</h2>
        </div>
        <p class="cart-page__empty">お探しのお知らせが見つかりませんでした。</p>
        <div class="section-more"><a href="news.html" class="btn btn--ghost">お知らせ一覧へ</a></div>`;
      return;
    }

    const title = escapeHtml(n.title);
    const img = n.image || newsImageFor(n);

    root.innerHTML = `
      <div class="section-head">
        <h2 class="section-head__title">NEWS</h2>
      </div>
      <div class="news-article__meta">
        <span class="news-article__date">${escapeHtml(dotDate(n.date))}</span>
        <span class="news-article__cat">${escapeHtml(n.cat)}</span>
      </div>
      <h1 class="news-article__title">${title}</h1>

      <div class="news-article__body">
        <figure class="news-article__figure">
          <img class="news-article__img" src="${escapeHtml(img)}" alt="${title}" loading="lazy" />
        </figure>

        ${bodyParagraphsFor(n, n.title)}
      </div>

      <div class="section-more"><a href="news.html" class="btn btn--ghost">お知らせ一覧へ</a></div>`;
  }

  function renderNewsPages() {
    renderPublicNews();
    renderNewsDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderNewsPages);
  } else {
    renderNewsPages();
  }
})(window);
