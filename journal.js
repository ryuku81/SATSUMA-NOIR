// ============================================================
//  Data Access Layer — JournalStore
//  ------------------------------------------------------------
//  ジャーナル（JOURNAL / 読みもの）の保存・取得を担う層。
//  他ストア（NewsStore など）と同じ async API。
//
//  記事オブジェクトの形:
//    { id, date: "YYYY-MM-DD", cat, title, image, body }
//  一覧・管理画面とも、日付の新しい順に並べて表示する。
//
//  永続化方針:
//    Supabase の "journals" テーブルを優先して使う。
//    テーブル未作成・RLS 不許可など失敗した場合は、
//    自動的に localStorage にフォールバックする
//    （テーブルが無くても管理画面がそのまま動く）。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_journal";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "1";
  const VERSION_KEY = "satsuma_journal_version";
  const COLS = "id, date, cat, title, image, body";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = [
    { id: 1, date: "2026-06-10", cat: "Store", title: "照国本店、はじまりの話。“目が届く範囲”で、ひとつひとつ手仕事で。", image: "images/terukuni-store.jpg", body: "" },
    { id: 2, date: "2026-05-29", cat: "Craft", title: "熟成冷凍という選択。解凍後がいちばんの食べごろになる理由。", image: "images/basque-cheesecake.png", body: "" },
    { id: 3, date: "2026-05-18", cat: "Philosophy", title: "週末のための、深い甘さ。SATSUMA NOIR が大切にしていること。", image: "images/noir-tablette.png", body: "" },
    { id: 4, date: "2026-05-07", cat: "Recipe", title: "口どけを設計する。空気を含ませた、やわらかなスフレのこと。", image: "images/souffle-cheesecake.png", body: "" },
    { id: 5, date: "2026-04-26", cat: "Season's Plate", title: "コーヒーと余韻。大人のためのティラミスの、静かな楽しみ方。", image: "images/italian-tiramisu.png", body: "" },
    { id: 6, date: "2026-04-15", cat: "Store", title: "甘酸っぱさを重ねて。ベリーレアチーズに込めた、春の華やぎ。", image: "images/berry-rare-cheesecake.png", body: "" },
    { id: 7, date: "2026-04-04", cat: "Craft", title: "湯せん焼きという手間。しっとり濃密なニューヨークの王道。", image: "images/newyork-cheesecake.png", body: "" },
    { id: 8, date: "2026-03-24", cat: "Philosophy", title: "黒ごまという深み。和の素材が描く、もうひとつのNOIR。", image: "images/kurogoma-financier.png", body: "" },
    { id: 9, date: "2026-03-13", cat: "Recipe", title: "ガトーショコラの夜。ひと口で満たされる、濃い甘さの設計。", image: "images/gateau-chocolat.png", body: "" },
  ];

  // 日付の新しい順（同日は id の大きい順）でソート
  const byDateDesc = (a, b) => {
    const d = String(b.date).localeCompare(String(a.date));
    return d !== 0 ? d : (Number(b.id) || 0) - (Number(a.id) || 0);
  };

  // ---- 永続化（localStorage フォールバック）----
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

  // Supabase が使えるか（一度失敗したら以降は localStorage を使う）
  let supabaseUsable = null; // null=未判定 / true / false
  function markSupabaseDown(error) {
    supabaseUsable = false;
    console.warn(
      "[JournalStore] Supabase が利用できないため localStorage を使用します。" +
        "（Supabase に journals テーブルを作成すると、サーバー側で共有保存されます）",
      error
    );
  }

  // ---- 公開 API（async）----
  const JournalStore = {
    async findAll() {
      if (global.sb && supabaseUsable !== false) {
        const { data, error } = await global.sb
          .from("journals")
          .select(COLS)
          .order("date", { ascending: false });
        if (!error) {
          supabaseUsable = true;
          return (data || []).slice().sort(byDateDesc);
        }
        markSupabaseDown(error);
      }
      return read().slice().sort(byDateDesc);
    },

    async findById(id) {
      if (global.sb && supabaseUsable !== false) {
        const { data, error } = await global.sb
          .from("journals")
          .select(COLS)
          .eq("id", Number(id))
          .maybeSingle();
        if (!error) {
          supabaseUsable = true;
          return data || null;
        }
        markSupabaseDown(error);
      }
      return read().find((n) => Number(n.id) === Number(id)) || null;
    },

    async create(data) {
      const payload = {
        date: data.date,
        cat: data.cat,
        title: data.title,
        image: data.image || "",
        body: data.body || "",
      };
      if (global.sb && supabaseUsable !== false) {
        const { data: row, error } = await global.sb
          .from("journals")
          .insert(payload)
          .select(COLS)
          .single();
        if (!error) {
          supabaseUsable = true;
          return row;
        }
        markSupabaseDown(error);
      }
      const list = read();
      const item = { ...payload, id: nextId(list) };
      write([...list, item]);
      return item;
    },

    async update(id, data) {
      const payload = {
        date: data.date,
        cat: data.cat,
        title: data.title,
        image: data.image || "",
        body: data.body || "",
      };
      if (global.sb && supabaseUsable !== false) {
        const { data: row, error } = await global.sb
          .from("journals")
          .update(payload)
          .eq("id", Number(id))
          .select(COLS)
          .single();
        if (!error) {
          supabaseUsable = true;
          return row;
        }
        markSupabaseDown(error);
      }
      const list = read();
      const target = Number(id);
      const next = list.map((n) => (Number(n.id) === target ? { ...n, ...payload, id: target } : n));
      write(next);
      return next.find((n) => Number(n.id) === target) || null;
    },

    async remove(id) {
      if (global.sb && supabaseUsable !== false) {
        const { error } = await global.sb.from("journals").delete().eq("id", Number(id));
        if (!error) {
          supabaseUsable = true;
          return;
        }
        markSupabaseDown(error);
      }
      const target = Number(id);
      write(read().filter((n) => Number(n.id) !== target));
    },

    async resetToSeed() {
      write(SEED);
      return [...SEED];
    },
  };

  global.JournalStore = JournalStore;

  // ------------------------------------------------------------
  //  共通ヘルパー
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  // "YYYY-MM-DD" / ISO文字列 → "YYYY.MM.DD"
  const dateParts = (d) => {
    const [y = "", m = "", day = ""] = String(d ?? "").slice(0, 10).split("-");
    return { y, m, d: day };
  };
  const dotDate = (d) => {
    const p = dateParts(d);
    return [p.y, p.m, p.d].filter(Boolean).join(".");
  };
  const WD = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const weekdayFor = (d) => {
    const p = dateParts(d);
    const y = Number(p.y);
    const m = Number(p.m);
    const day = Number(p.d);
    if (!y || !m || !day) return "";
    return WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()] || "";
  };

  const PLACEHOLDER_IMG = "images/basque-cheesecake.png";
  const imgOf = (p) => (p.image && p.image.trim() ? p.image : PLACEHOLDER_IMG);

  // ------------------------------------------------------------
  //  ジャーナル一覧（journal.html）の描画 + ページ送り
  //  #journalList が存在するページでのみ動作する。
  // ------------------------------------------------------------
  async function renderPublicJournal() {
    const list = document.getElementById("journalList");
    if (!list) return;

    const feature = document.querySelector(".journal-feature");
    const info = document.getElementById("journalInfo");
    const prev = document.getElementById("journalPrev");
    const next = document.getElementById("journalNext");

    const POSTS = await JournalStore.findAll();
    if (POSTS.length === 0) {
      if (feature) feature.hidden = true;
      list.innerHTML = `<p class="cart-page__empty">ジャーナル記事はありません。</p>`;
      if (info) info.textContent = "0/0";
      if (prev) prev.disabled = true;
      if (next) next.disabled = true;
      return;
    }

    if (feature) {
      const featureImages = POSTS.slice(0, 3).map(imgOf);
      while (featureImages.length < 3) featureImages.push(imgOf(POSTS[0]));
      feature.innerHTML = `
        <div class="journal-feature__media journal-feature__media--triptych">
          ${featureImages
            .slice(0, 3)
            .map((src) => `<img class="journal-feature__shot" src="${escapeHtml(src)}" alt="" loading="eager" />`)
            .join("")}
          <span class="journal-feature__label">SATSUMA NOIR</span>
        </div>`;
    }

    const timelinePosts = POSTS;
    const PER_PAGE = 6;
    const totalPages = Math.max(1, Math.ceil(timelinePosts.length / PER_PAGE));
    let page = 1;

    function render() {
      const start = (page - 1) * PER_PAGE;
      const slice = timelinePosts.slice(start, start + PER_PAGE);
      list.innerHTML = slice
        .map((p) => {
          const { y, m, d } = dateParts(p.date);
          const wd = weekdayFor(p.date);
          return `
          <a class="jtl" href="journal-detail.html?id=${encodeURIComponent(p.id)}">
            <div class="jtl__when"><span class="jtl__ym">${escapeHtml([y, m, d].filter(Boolean).join("."))}</span><span class="jtl__d">${escapeHtml(wd)}</span></div>
            <div class="jtl__card">
              <div class="jtl__media"><img src="${escapeHtml(imgOf(p))}" alt="" loading="lazy" /></div>
              <div><span class="jtl__cat">${escapeHtml(p.cat || "")}</span><h3 class="jtl__title">${escapeHtml(p.title)}</h3></div>
            </div>
          </a>`;
        })
        .join("") || `<p class="cart-page__empty">ほかの記事はありません。</p>`;
      if (info) info.textContent = page + "/" + totalPages;
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= totalPages;
    }

    function go(p) {
      page = Math.min(totalPages, Math.max(1, p));
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    if (prev) prev.addEventListener("click", () => go(page - 1));
    if (next) next.addEventListener("click", () => go(page + 1));
    render();
  }

  // ------------------------------------------------------------
  //  ジャーナル詳細（journal-detail.html）の描画
  //  ?id 付きでアクセスされたときのみ、#journalDetail を差し替える。
  //  id が無ければ既存の静的コンテンツをそのまま表示する。
  // ------------------------------------------------------------
  function bodyToHtml(body) {
    return String(body || "")
      .split(/\n{1,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p class="journal-block__text">${escapeHtml(p)}</p>`)
      .join("\n");
  }

  function defaultBodyHtml(title) {
    const t = escapeHtml(title);
    return `
      <p class="journal-block__text">${t}——。SATSUMA NOIR が大切にしているのは、派手さではなく深さです。素材と静かに向き合い、ひとつひとつ手仕事で仕上げる。その姿勢は、原点回帰を経た照国本店でも変わることはありません。</p>
      <p class="journal-block__text">独自の“熟成冷凍”は、いちばんの食べごろをお客様の手元まで届けるための私たちなりの答えです。室温で1時間ほど解凍すると、固く眠っていた香りがゆっくりとほどけ、乳の甘さと余韻が深くなっていきます。小分けにカットして、その日に食べる分だけをお楽しみください。</p>
      <p class="journal-block__text">週末のひととき、明日へ向かう前の静かな時間に。あなたの暮らしのささやかな余白に、この一皿がそっと寄り添えますように。</p>`;
  }

  async function renderJournalDetail() {
    const root = document.getElementById("journalDetail");
    if (!root) return;
    const idParam = new URLSearchParams(location.search).get("id");
    if (!idParam) return; // id 無し → 静的コンテンツのまま

    const n = await JournalStore.findById(idParam);
    if (!n) {
      root.innerHTML = `
        <header class="journal__head">
          <p class="journal__brand">SATSUMA NOIR</p>
          <h1 class="journal__title">JOURNAL</h1>
        </header>
        <p class="cart-page__empty" style="text-align:center;">お探しの記事が見つかりませんでした。</p>
        <div class="section-more" style="text-align:center;"><a href="journal.html" class="btn btn--ghost">ジャーナル一覧へ</a></div>`;
      return;
    }

    const title = escapeHtml(n.title);
    const img = escapeHtml(imgOf(n));
    const dateStr = escapeHtml(dotDate(n.date));
    const cat = escapeHtml(n.cat || "JOURNAL");
    const bodyHtml = n.body && n.body.trim() ? bodyToHtml(n.body) : defaultBodyHtml(n.title);

    document.title = `${n.title} — JOURNAL — SATSUMA NOIR`;

    root.innerHTML = `
      <header class="journal__head">
        <p class="journal__brand">SATSUMA NOIR</p>
        <h1 class="journal__title">JOURNAL</h1>
      </header>

      <article class="journal-article">
        <div class="journal-detail__hero">
          <img src="${img}" alt="${title}" loading="eager" />
          <div class="journal-detail__hero-label">SATSUMA NOIR<br />JOURNAL</div>
          <span class="journal-detail__no">No.${escapeHtml(String(n.id))}</span>
        </div>

        <time class="journal-detail__date">${dateStr}</time>
        <h2 class="journal-detail__title">${title}</h2>

        <hr class="journal-detail__divider" />

        <div class="journal-detail__body">
          <p><span class="jtl__cat" style="display:inline-block;margin-bottom:0.6rem;">${cat}</span></p>
          ${bodyHtml}
        </div>

        <div class="section-more" style="text-align:center;margin-top:3rem;">
          <a href="journal.html" class="btn btn--ghost">ジャーナル一覧へ</a>
        </div>
      </article>`;
  }

  function renderJournalPages() {
    renderPublicJournal();
    renderJournalDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderJournalPages);
  } else {
    renderJournalPages();
  }
})(window);
