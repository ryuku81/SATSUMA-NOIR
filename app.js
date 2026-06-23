// ============================================================
//  SATSUMA NOIR — shared site script (multi-page)
// ============================================================

// ---------- Product data ----------
// 商品データの正は store.js（ProductStore）が持つ。
// ここでは起動時にストアから読み込んでキャッシュする。
let PRODUCTS = [];

const RANKING_IDS = [7, 3, 1]; // 人気順 TOP3

const yen = (n) => "¥" + n.toLocaleString("ja-JP");

// SVG icons
const ICON_SEARCH = `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="1.5"/></svg>`;
const ICON_CART = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 3.5h2l1.9 10.2a1.2 1.2 0 0 0 1.18.98h8.32a1.2 1.2 0 0 0 1.18-.95L18.8 7H6"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="16.5" cy="19.5" r="1.4"/></svg>`;
const ICON_CART_SM = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l1.6 9a1 1 0 0 0 1 .82h8a1 1 0 0 0 1-.8L19 7H6"/><circle cx="9" cy="19" r="1.2"/><circle cx="16" cy="19" r="1.2"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="20" height="20"><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="1.5"/><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="1.5"/></svg>`;
const ICON_HEART_HDR = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5 4.4 13a4.6 4.6 0 0 1 6.5-6.5l1.1 1.1 1.1-1.1A4.6 4.6 0 0 1 19.6 13z"/></svg>`;
const ICON_SUN = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>`;
const ICON_MOON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.2A8 8 0 1 1 9.8 3.5a6.3 6.3 0 0 0 10.7 10.7z"/></svg>`;

// ---------- Theme (dark / light) ----------
const THEME_KEY = "satsuma-theme";
function getStoredTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
}
function applyTheme(theme) {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}
// チラつきを抑えるため、ヘッダー構築より前に適用しておく。
applyTheme(getStoredTheme() === "light" ? "light" : "dark");

// ---------- Navigation ----------
const NAV_LINKS = [
  { label: "ABOUT", href: "index.html", sub: "ブランドについて" },
  { label: "ITEM", href: "item.html", sub: "商品について" },
  { label: "NEWS", href: "news.html", sub: "ニュース" },
];

function currentPage() {
  const file = location.pathname.split("/").pop();
  return file === "" ? "index.html" : file;
}

// ============================================================
//  Shared chrome (header / footer / cart / auth modal)
// ============================================================
function buildChrome() {
  const page = currentPage();

  const navLinks = NAV_LINKS.map(
    (l) =>
      `<a href="${l.href}" class="nav__link${l.href === page ? " is-current" : ""}"><span class="nav__en">${l.label}</span>${l.sub ? `<span class="nav__sub">${l.sub}</span>` : ""}</a>`
  ).join("");

  // Header
  const header = document.createElement("header");
  header.className = "header";
  header.id = "header";
  header.innerHTML = `
    <div class="header__inner">
      <button class="nav-toggle" id="navToggle" aria-label="メニュー"><span></span><span></span><span></span></button>
      <nav class="nav" id="nav">
        ${navLinks}
        <a class="nav__login" href="login.html">LOGIN</a>
      </nav>
      <a href="index.html" class="brand">SATSUMA NOIR</a>
      <div class="header__actions">
        <button class="icon-btn theme-toggle" id="themeToggle" type="button" aria-label="ダーク／ライト切替"><span class="theme-toggle__sun">${ICON_SUN}</span><span class="theme-toggle__moon">${ICON_MOON}</span></button>
        <a class="icon-btn wish-btn" href="wishlist.html" aria-label="気になるリスト" hidden>${ICON_HEART_HDR}</a>
        <a class="icon-btn cart-btn" href="cart.html" aria-label="カート">${ICON_CART}<span class="cart-count" id="cartCount">0</span></a>
        <a class="login-btn" href="login.html">LOGIN</a>
      </div>
    </div>`;
  document.body.prepend(header);

  // Nav scrim
  const navOverlay = document.createElement("div");
  navOverlay.className = "nav-overlay";
  navOverlay.id = "navOverlay";
  header.after(navOverlay);

  // Footer
  const footer = document.createElement("footer");
  footer.className = "footer";
  footer.innerHTML = `
    <nav class="footer__links">
      <a href="faq.html">FAQ</a>
      <a href="privacy.html">プライバシーポリシー</a>
      <a href="tokushoho.html">特定商取引法に基づく表示</a>
      <a href="recruit.html">採用情報</a>
      <a href="contact.html">お問い合わせ</a>
    </nav>
    <div class="footer__social">
      <a href="#" aria-label="X" class="footer__social-icon" data-social="x">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a href="#" aria-label="Instagram" class="footer__social-icon" data-social="instagram">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>
      </a>
    </div>
    <p class="footer__copy">© 2026 SATSUMA NOIR. All rights reserved.</p>`;
  document.body.appendChild(footer);
  applySocialLinks(footer);

  // Toast
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.id = "toast";
  document.body.appendChild(toast);

  // 下層ページではヘッダーに背景を付ける
  if (page !== "index.html") header.classList.add("is-scrolled");

  // ログイン状態に応じて LOGIN / LOGOUT 表示
  applyAuthButtons();
}

// 設定（SettingsStore）からメインビジュアル等の画像を反映。
// 未設定なら HTML 既定の画像のまま。
function applySiteImages() {
  if (typeof SettingsStore === "undefined") return;
  SettingsStore.get()
    .then((settings) => {
      const map = {
        hero: settings.heroImage,
        statement: settings.statementImage,
        howto1: settings.howtoImage1,
        howto2: settings.howtoImage2,
        howto3: settings.howtoImage3,
      };
      Object.entries(map).forEach(([key, src]) => {
        if (!src) return;
        const el = document.querySelector(`[data-site-img="${key}"]`);
        if (el) el.src = src;
      });
    })
    .catch((err) => console.error("サイト画像の読み込みに失敗しました:", err));
}

// 設定（SettingsStore）からトップページ各所の文章を反映。
// data-site-text="KEY" を持つ要素に、設定値を反映する。
// 下の MULTILINE のキーは改行を <br> に変換して表示する。
const SITE_TEXT_MULTILINE = new Set([
  "heroConceptBody",
  "statementBody",
  "howtoTitle",
  "howtoRecommendText",
]);
function applySiteText() {
  if (typeof SettingsStore === "undefined") return;
  const els = document.querySelectorAll("[data-site-text]");
  if (!els.length) return;
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  SettingsStore.get()
    .then((settings) => {
      els.forEach((el) => {
        const key = el.dataset.siteText;
        const val = settings[key];
        if (typeof val !== "string") return;
        if (SITE_TEXT_MULTILINE.has(key)) {
          el.innerHTML = escapeHtml(val).replace(/\n/g, "<br />");
        } else {
          el.textContent = val;
        }
      });
    })
    .catch((err) => console.error("文章の読み込みに失敗しました:", err));
}

// 設定（SettingsStore）から About セクションの文章を反映（トップページ）。
// data-site-about="head" / "body" を持つ要素がある場合のみ。
function applyAboutText() {
  if (typeof SettingsStore === "undefined") return;
  const headEl = document.querySelector('[data-site-about="head"]');
  const bodyEl = document.querySelector('[data-site-about="body"]');
  if (!headEl && !bodyEl) return;
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  SettingsStore.get()
    .then((settings) => {
      if (headEl && typeof settings.aboutHeading === "string") {
        headEl.textContent = settings.aboutHeading;
      }
      if (bodyEl && typeof settings.aboutBody === "string") {
        // 改行で段落を分け、各行を <p class="about__body"> に
        bodyEl.innerHTML = settings.aboutBody
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => `<p class="about__body">${escapeHtml(line)}</p>`)
          .join("");
      }
    })
    .catch((err) => console.error("About文章の読み込みに失敗しました:", err));
}

// 設定（SettingsStore）から SNS リンクをフッターに反映。
// 未設定のものは href="#" のまま残す。
function applySocialLinks(footer) {
  if (typeof SettingsStore === "undefined") return;
  const map = { instagram: "instagramUrl", x: "xUrl", note: "noteUrl" };
  SettingsStore.get()
    .then((settings) => {
      Object.entries(map).forEach(([key, field]) => {
        const url = (settings[field] || "").trim();
        const link = footer.querySelector(`[data-social="${key}"]`);
        if (link && url) {
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
      });
    })
    .catch((err) => console.error("SNSリンクの読み込みに失敗しました:", err));
}

// ============================================================
//  Reveal on scroll
// ============================================================
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.15 }
);

function observeCards() {
  document.querySelectorAll(".card").forEach((c, i) => {
    c.style.transitionDelay = `${(i % 4) * 0.08}s`;
    io.observe(c);
  });
}

// ============================================================
//  Product grid (ITEM page)
// ============================================================
function cardHtml(p) {
  return `
    <article class="card is-clickable" data-id="${p.id}" data-href="product.html?id=${p.id}">
      <div class="card__media">
        ${p.img ? `<img class="card__img" src="${p.img}" alt="${p.name}" loading="lazy" />` : `<span class="card__glyph">${p.glyph}</span>`}
      </div>
      <div class="card__body">
        <div class="card__head">
          <h3 class="card__name">${p.name}</h3>
          ${p.tag ? `<span class="card__tag">${p.tag}</span>` : ""}
        </div>
        <div class="card__foot">
          <span class="card__price">${yen(p.price)}</span>
          <button class="card__add" data-add="${p.id}" aria-label="カートに追加">${ICON_CART_SM}</button>
        </div>
      </div>
    </article>`;
}

// カテゴリのフィルタボタンを CategoryStore から描画（ITEM ページ）
function renderFilters() {
  const filters = document.getElementById("filters");
  if (!filters || typeof CategoryStore === "undefined") return;
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const cats = CategoryStore.listSync();
  filters.innerHTML =
    `<button class="filter is-active" data-filter="all">ALL</button>` +
    cats
      .map((c) => `<button class="filter" data-filter="${esc(c.value)}">${esc(c.label)}</button>`)
      .join("");
}

function renderProducts(filter = "all") {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  const list = filter === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === filter);
  grid.innerHTML = list.map(cardHtml).join("");
  observeCards();
}

// ============================================================
//  Ranking (HOME page)
// ============================================================
// TOP3 を返す。RANKING_IDS の商品が削除されていたら、
// ランキング外の商品で繰り上げ補充して常に3枠埋める。
function getRankingProducts(count = 3) {
  const ranked = RANKING_IDS
    .map((id) => PRODUCTS.find((x) => x.id === id))
    .filter(Boolean);
  const usedIds = new Set(ranked.map((p) => p.id));
  const fillers = PRODUCTS.filter((p) => !usedIds.has(p.id));
  return [...ranked, ...fillers].slice(0, count);
}

function renderRanking() {
  const row = document.getElementById("rankingRow");
  if (!row) return;
  row.innerHTML = getRankingProducts().map((p) => {
    const media = p.img
      ? `<img src="${p.img}" alt="${p.name}" loading="lazy" />`
      : `<span class="rank-row__glyph">${p.glyph}</span>`;
    return `
    <article class="rank-row is-clickable" data-id="${p.id}" data-href="product.html?id=${p.id}">
      <div class="rank-row__media">
        ${media}
      </div>
      <div class="rank-row__info">
        ${p.catLabel ? `<p class="rank-row__cat">${p.catLabel}</p>` : ""}
        <h3 class="rank-row__name">${p.name}</h3>
        ${p.desc ? `<p class="rank-row__desc">${p.desc}</p>` : ""}
        <p class="rank-row__price">${yen(p.price)}</p>
        <button class="rank-row__add" data-add="${p.id}">カートに追加</button>
      </div>
    </article>`;
  }).join("");
}

// ============================================================
//  Product detail (PRODUCT page / product.html)
// ============================================================
// 商品ごとの固定の詳細文（アレルゲン・賞味期限など）。
// 個別指定がなければ、SATSUMA NOIR 共通のスイーツ向け既定値を使う。
const PDP_DEFAULTS = {
  allergen: "卵・乳成分・小麦（一部に大豆を含む）",
  shelflife:
    "冷凍で約30日。解凍後は冷蔵で2日以内にお召し上がりください。一度解凍したものの再冷凍はお避けください。",
  seller: "SATSUMA NOIR（株式会社サツマノワール）／鹿児島県",
};

// 商品紹介の本文を、商品データから SATSUMA NOIR の文脈で組み立てる。
function pdpIntro(p) {
  const base =
    p.desc ||
    "素材と静かに向き合い、ひとつひとつ手仕事で仕上げました。";
  return `${base}<br />独自の“熟成冷凍”加工で、解凍後がいちばんの食べごろになるように製造しています。室温で1時間ほど解凍し、小分けにカットして、食べる分だけお楽しみください。残りは冷凍庫へ。毎日のご褒美に、少しずつ。`;
}

// メイン画像＋他商品の写真を数枚並べたギャラリー（参考デザインのサムネ列を再現）。
function pdpGallery(p) {
  const others = PRODUCTS.filter((x) => x.id !== p.id && x.img).map((x) => x.img);
  const seen = new Set();
  return [p.img, ...others]
    .filter((src) => src && !seen.has(src) && seen.add(src))
    .slice(0, 4);
}

const ICON_HEART = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20.5 4.4 13a4.6 4.6 0 0 1 6.5-6.5l1.1 1.1 1.1-1.1A4.6 4.6 0 0 1 19.6 13z"/></svg>`;

function renderProductDetail() {
  const root = document.getElementById("pdp");
  if (!root) return;

  const id = Number(new URLSearchParams(location.search).get("id"));
  const p = PRODUCTS.find((x) => x.id === id);

  if (!p) {
    root.innerHTML = `
      <div class="pdp__notfound">
        <p class="cart-page__empty">お探しの商品が見つかりませんでした。</p>
        <div class="section-more"><a href="item.html" class="btn btn--ghost">商品一覧へ</a></div>
      </div>`;
    return;
  }

  const stock = Number(p.stock) || 0;
  const soldOut = stock <= 0;
  const low = !soldOut && stock <= ProductStore.LOW_STOCK_THRESHOLD;
  const gallery = pdpGallery(p);

  const thumbs = gallery
    .map(
      (src, i) =>
        `<button class="pdp__thumb${i === 0 ? " is-active" : ""}" data-thumb="${src}" aria-label="画像${i + 1}"><img src="${src}" alt="${p.name} 写真${i + 1}" loading="lazy" /></button>`
    )
    .join("");

  const stockNote = soldOut
    ? `<p class="pdp__stock pdp__stock--out">在庫切れ</p>`
    : low
    ? `<p class="pdp__stock pdp__stock--low">残りわずか（あと${stock}点）</p>`
    : `<p class="pdp__stock">在庫あり</p>`;

  root.innerHTML = `
    <nav class="pdp__crumbs">
      <a href="index.html">HOME</a><span>/</span>
      <a href="item.html">COLLECTION</a><span>/</span>
      <span class="pdp__crumbs-current">${p.name}</span>
    </nav>

    <div class="pdp__main">
      <div class="pdp__gallery">
        <div class="pdp__stage">
          ${p.img ? `<img id="pdpMainImg" src="${p.img}" alt="${p.name}" />` : `<span class="pdp__stage-glyph">${p.glyph || "🍰"}</span>`}
          ${gallery.length > 1 ? `
          <button type="button" class="pdp__nav pdp__nav--prev" id="pdpPrev" aria-label="前の画像">‹</button>
          <button type="button" class="pdp__nav pdp__nav--next" id="pdpNext" aria-label="次の画像">›</button>` : ""}
        </div>
        ${gallery.length > 1 ? `<div class="pdp__thumbs">${thumbs}</div>` : ""}
      </div>

      <div class="pdp__info">
        ${p.catLabel ? `<p class="pdp__cat">${p.catLabel}</p>` : ""}
        <h1 class="pdp__name">${p.name}</h1>
        <div class="pdp__price">
          <span class="pdp__price-num">${yen(p.price)}</span>
          <span class="pdp__tax">税込</span>
        </div>
        ${stockNote}

        <div class="pdp__buy">
          <div class="pdp__qty">
            <span class="pdp__qty-label">数量</span>
            <div class="pdp__stepper" ${soldOut ? "aria-disabled='true'" : ""}>
              <button type="button" class="pdp__step" data-qstep="-1" aria-label="減らす">−</button>
              <span class="pdp__qty-num" id="pdpQty">1</span>
              <button type="button" class="pdp__step" data-qstep="1" aria-label="増やす">＋</button>
            </div>
          </div>
          <button class="btn btn--primary btn--full pdp__add" id="pdpAdd" ${soldOut ? "disabled" : ""}>
            ${ICON_CART_SM}<span>${soldOut ? "在庫切れ" : "カートに入れる"}</span>
          </button>
          <button class="pdp__wish${isWished(p.id) ? " is-active" : ""}" id="pdpWish" type="button">${ICON_HEART}<span>${isWished(p.id) ? "気になるリストに追加済み" : "気になるリストに追加"}</span></button>
        </div>

        <div class="pdp__share">
          <span class="pdp__share-label">SHARE</span>
          <a href="#" class="pdp__share-icon" data-share="x" aria-label="X でシェア">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
          <a href="#" class="pdp__share-icon" data-share="line" aria-label="LINE でシェア">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 3C6.9 3 2.75 6.36 2.75 10.5c0 3.71 3.3 6.82 7.76 7.41.3.06.71.2.82.46.1.24.06.6.03.85l-.13.79c-.04.24-.18.93.82.5 1-.42 5.4-3.18 7.37-5.45 1.36-1.49 2.01-3 2.01-4.56C21.25 6.36 17.1 3 12 3z"/></svg>
          </a>
          <a href="#" class="pdp__share-icon" data-share="facebook" aria-label="Facebook でシェア">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 9h2.5V6H14c-2 0-3.2 1.2-3.2 3.3V11H8.5v3h2.3v7h3v-7h2.4l.4-3h-2.8V9.6c0-.4.2-.6.7-.6z"/></svg>
          </a>
        </div>
      </div>
    </div>

    <section class="pdp__feature">
      <h2 class="pdp__feature-head">解凍したての、いちばん澄んだ甘さを。</h2>
      <div class="pdp__feature-media">
        ${p.img ? `<img src="${p.img}" alt="${p.name}" loading="lazy" />` : `<span class="pdp__feature-glyph">${p.glyph || "🍰"}</span>`}
      </div>
      <p class="pdp__feature-body">室温で1時間ほど解凍すると、外はしっとり、中はとろりとほどける食べごろに。ひと口運べば、濃厚なコクのあとに、すっと澄んだ余韻が広がります。小分けにカットして、食べる分だけ解凍し、残りは冷凍庫へ。慌ただしい毎日の中の、静かなご褒美のひとときに。</p>
    </section>

    <section class="pdp__overview">
      <h2 class="pdp__overview-title">商品概要</h2>
      <dl class="pdp__spec">
        <div class="pdp__spec-row">
          <dt>サイズ</dt>
          <dd>約15cm（4〜6名様分）</dd>
        </div>
        <div class="pdp__spec-row">
          <dt>賞味期限</dt>
          <dd>冷凍（−18℃以下）で約30日<br />※解凍後は冷蔵で2日以内にお召し上がりください<br />※詳しくは商品ラベルの日付をご確認ください</dd>
        </div>
        <div class="pdp__spec-row">
          <dt>原材料</dt>
          <dd>クリームチーズ、生クリーム（国内製造）、卵、グラニュー糖、薄力粉、バター、レモン果汁／（一部に乳成分・卵・小麦・大豆を含む）<br />※仕入れ状況により原材料の一部が変わる場合がありますが、味・品質に影響はありません。</dd>
        </div>
      </dl>

      <div class="pdp__note">
        <h3 class="pdp__note-title">お取り扱いについて</h3>
        <ul class="pdp__note-list">
          <li>本商品は冷凍でのお届けとなります。</li>
          <li>独自の“熟成冷凍”加工により、解凍後がいちばんの食べごろです。室温で1時間ほど解凍してお楽しみください。</li>
          <li>ひとつひとつ手作業で製造しているため、形状や焼き色に個体差がございます。</li>
          <li>表面の濃い焼き色はバスク特有の香ばしさで、品質に問題はございません。安心してお召し上がりください。</li>
        </ul>
      </div>
    </section>

    <div class="section-more"><a href="item.html" class="btn btn--ghost">他の商品を見る</a></div>`;

  // ---- ギャラリー：サムネイル＋矢印ボタンで画像切り替え ----
  if (gallery.length > 1) {
    let gi = 0;
    const mainImg = document.getElementById("pdpMainImg");
    const thumbBtns = Array.from(root.querySelectorAll(".pdp__thumb"));
    const showImage = (i) => {
      gi = (i + gallery.length) % gallery.length; // 端でループ
      if (mainImg) mainImg.src = gallery[gi];
      thumbBtns.forEach((t, idx) => t.classList.toggle("is-active", idx === gi));
    };
    thumbBtns.forEach((btn, idx) => btn.addEventListener("click", () => showImage(idx)));
    document.getElementById("pdpPrev")?.addEventListener("click", () => showImage(gi - 1));
    document.getElementById("pdpNext")?.addEventListener("click", () => showImage(gi + 1));
  }

  if (soldOut) return;

  // ---- 数量ステッパー ----
  let qty = 1;
  const qtyEl = document.getElementById("pdpQty");
  root.querySelectorAll("[data-qstep]").forEach((btn) => {
    btn.addEventListener("click", () => {
      qty = Math.min(Math.max(1, qty + Number(btn.dataset.qstep)), Math.max(1, stock));
      qtyEl.textContent = qty;
    });
  });

  // ---- カートに入れる（数量ぶん） ----
  document.getElementById("pdpAdd").addEventListener("click", () => addToCart(p.id, qty));

  // ---- 気になるリスト ----
  //  未ログイン: リストに保存しつつ、ログイン誘導モーダルを表示。
  //  ログイン済み: 追加／削除をトグルし、ボタン表示を更新。
  const wishBtn = document.getElementById("pdpWish");
  const syncWishBtn = () => {
    const on = isWished(p.id);
    wishBtn.classList.toggle("is-active", on);
    wishBtn.querySelector("span").textContent = on ? "気になるリストに追加済み" : "気になるリストに追加";
  };
  wishBtn.addEventListener("click", () => {
    if (!UserAuth.isLoggedIn()) {
      addToWishlist(p.id);
      openWishModal(p);
      return;
    }
    if (isWished(p.id)) {
      removeFromWishlist(p.id);
      showToast(`「${p.name}」を気になるリストから削除しました`);
    } else {
      addToWishlist(p.id);
      showToast(`「${p.name}」を気になるリストに追加しました`);
    }
    syncWishBtn();
  });
}

// 未ログインで「気になるリストに追加」したときのモーダル。
// 追加完了を伝えつつ、ログイン／会員登録へ誘導する。
function openWishModal(p) {
  document.getElementById("wishModal")?.remove();

  // ログイン後に元のページ（この商品ページ）へ戻すための redirect 値
  const back = encodeURIComponent(currentPage() + location.search);
  const media = p.img
    ? `<img src="${p.img}" alt="${p.name}" />`
    : `<span class="wish-modal__glyph">${p.glyph || "🍰"}</span>`;

  const modal = document.createElement("div");
  modal.className = "wish-modal";
  modal.id = "wishModal";
  modal.innerHTML = `
    <div class="wish-modal__overlay" data-wish-close></div>
    <div class="wish-modal__panel" role="dialog" aria-modal="true" aria-labelledby="wishModalTitle">
      <button class="wish-modal__close" data-wish-close aria-label="閉じる">${ICON_CLOSE}</button>
      <h2 class="wish-modal__title" id="wishModalTitle">気になるリストに追加しました</h2>
      <div class="wish-modal__media">${media}</div>
      <p class="wish-modal__text">「${p.name}」を気になるリストに追加しました</p>
      <p class="wish-modal__note">※気になるリストを確認するには、ログインが必要です。</p>
      <a class="wish-modal__btn wish-modal__btn--primary" href="login.html?redirect=${back}">ログイン</a>
      <p class="wish-modal__sub">会員登録がまだのお客様はこちら</p>
      <a class="wish-modal__btn wish-modal__btn--ghost" href="login.html?tab=signup&redirect=${back}">会員登録</a>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  const close = () => {
    modal.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  modal.querySelectorAll("[data-wish-close]").forEach((el) => el.addEventListener("click", close));
  document.addEventListener("keydown", onKey);
}

// ============================================================
//  User auth (ログイン状態。※簡易・本番では本物の認証に差し替える)
// ============================================================
// テスト用の会員アカウント（※デモ。本番ではサーバー側で認証する）
const TEST_MEMBER = { email: "member@test.com", password: "member123" };

const USER_AUTH_KEY = "satsuma_user_authed";
const UserAuth = {
  isLoggedIn: () => localStorage.getItem(USER_AUTH_KEY) === "1",
  login: () => localStorage.setItem(USER_AUTH_KEY, "1"),
  logout: () => localStorage.removeItem(USER_AUTH_KEY),
};

// ログイン状態に応じて LOGIN / LOGOUT ボタンの表示を切り替える
function applyAuthButtons() {
  const loggedIn = UserAuth.isLoggedIn();
  document.querySelectorAll(".login-btn, .nav__login").forEach((el) => {
    el.textContent = loggedIn ? "LOGOUT" : "LOGIN";
    if (loggedIn) el.removeAttribute("href");
    else el.setAttribute("href", "login.html");
  });
  // 気になるリストボタンはログイン中だけ表示（カートボタンの左横）
  document.querySelectorAll(".wish-btn").forEach((el) => {
    el.hidden = !loggedIn;
  });
}

// ============================================================
//  Cart (persisted in localStorage)
// ============================================================
const CART_KEY = "satsuma_cart";
let cart = loadCart();

function loadCart() {
  try {
    const data = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// ============================================================
//  Wishlist / 気になるリスト (persisted in localStorage)
// ============================================================
const WISHLIST_KEY = "satsuma_wishlist";
let wishlist = loadWishlist();

function loadWishlist() {
  try {
    const data = JSON.parse(localStorage.getItem(WISHLIST_KEY));
    return Array.isArray(data) ? data.map(Number) : [];
  } catch {
    return [];
  }
}
function saveWishlist() {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
}
function isWished(id) {
  return wishlist.includes(Number(id));
}
function addToWishlist(id) {
  id = Number(id);
  if (!wishlist.includes(id)) wishlist.push(id);
  saveWishlist();
}
function removeFromWishlist(id) {
  id = Number(id);
  wishlist = wishlist.filter((x) => x !== id);
  saveWishlist();
  renderWishlistPage();
}

// 気になるリストページ（wishlist.html）。カートと同じくログイン必須。
function renderWishlistPage() {
  const root = document.getElementById("wishlistPage");
  if (!root) return;

  // 未ログインで直接来た場合はログイン画面へ
  if (!UserAuth.isLoggedIn()) {
    window.location.href = "login.html?redirect=wishlist.html";
    return;
  }

  // 既に削除された商品IDは除外して表示
  const items = wishlist
    .map((id) => PRODUCTS.find((x) => x.id === id))
    .filter(Boolean);

  if (items.length === 0) {
    root.innerHTML = `
      <p class="cart-page__empty">気になるリストはまだ空です。<br />お気に入りのスイーツを見つけてください。</p>
      <div class="section-more"><a href="item.html" class="btn btn--ghost">商品一覧へ</a></div>`;
    return;
  }

  const rows = items
    .map((p) => {
      const media = p.img ? `<img src="${p.img}" alt="${p.name}" />` : `<span>${p.glyph}</span>`;
      const soldOut = (Number(p.stock) || 0) <= 0;
      return `
      <div class="cart-row wish-row">
        <a class="cart-row__media" href="product.html?id=${p.id}" aria-label="${p.name}の詳細">${media}</a>
        <div class="cart-row__info">
          ${p.catLabel ? `<span class="wish-row__cat">${p.catLabel}</span>` : ""}
          <h3 class="cart-row__name"><a href="product.html?id=${p.id}">${p.name}</a></h3>
          <span class="cart-row__price">${yen(p.price)}</span>
        </div>
        <div class="wish-row__actions">
          <button class="btn btn--primary wish-row__cart" data-add="${p.id}" ${soldOut ? "disabled" : ""}>
            ${soldOut ? "在庫切れ" : "カートに入れる"}
          </button>
          <button class="cart-row__remove" data-wishremove="${p.id}" aria-label="気になるリストから削除">削除</button>
        </div>
      </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="cart-page__list">${rows}</div>
    <div class="section-more"><a href="item.html" class="btn btn--ghost">買い物を続ける</a></div>`;
}

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-show"), 2200);
}

function updateCartBadge() {
  const countEl = document.getElementById("cartCount");
  if (!countEl) return;
  const count = cart.reduce((s, l) => s + l.qty, 0);
  countEl.textContent = count;
  countEl.classList.toggle("is-visible", count > 0);
}

function addToCart(id, amount = 1) {
  const qty = Math.max(1, Number(amount) || 1);
  const line = cart.find((l) => l.id === id);
  if (line) line.qty += qty;
  else cart.push({ id, qty });
  saveCart();
  updateCartBadge();
  renderCartPage();
  const p = PRODUCTS.find((x) => x.id === id);
  showToast(`「${p ? p.name : "商品"}」をカートに追加しました`);
}
function changeQty(id, delta) {
  const line = cart.find((l) => l.id === id);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) cart.splice(cart.indexOf(line), 1);
  saveCart();
  updateCartBadge();
  renderCartPage();
}
function removeFromCart(id) {
  const i = cart.findIndex((l) => l.id === id);
  if (i > -1) cart.splice(i, 1);
  saveCart();
  updateCartBadge();
  renderCartPage();
}

// Cart page (cart.html)
function renderCartPage() {
  const root = document.getElementById("cartPage");
  if (!root) return;

  // 未ログインで直接 cart.html に来た場合もログイン画面へ
  if (!UserAuth.isLoggedIn()) {
    window.location.href = "login.html?redirect=cart.html";
    return;
  }

  if (cart.length === 0) {
    root.innerHTML = `
      <p class="cart-page__empty">カートは空です。<br />お好きなスイーツを選んでください。</p>
      <div class="section-more"><a href="item.html" class="btn btn--ghost">商品一覧へ</a></div>`;
    return;
  }

  let total = 0;
  const items = cart
    .map((l) => {
      const p = PRODUCTS.find((x) => x.id === l.id);
      if (!p) return "";
      total += p.price * l.qty;
      const media = p.img ? `<img src="${p.img}" alt="${p.name}" />` : `<span>${p.glyph}</span>`;
      return `
      <div class="cart-row">
        <div class="cart-row__media">${media}</div>
        <div class="cart-row__info">
          <h3 class="cart-row__name">${p.name}</h3>
          <span class="cart-row__price">${yen(p.price)}</span>
        </div>
        <div class="cart-row__qty">
          <button data-qty="${p.id}" data-delta="-1" aria-label="減らす">−</button>
          <span>${l.qty}</span>
          <button data-qty="${p.id}" data-delta="1" aria-label="増やす">+</button>
        </div>
        <div class="cart-row__sub">${yen(p.price * l.qty)}</div>
        <button class="cart-row__remove" data-remove="${p.id}" aria-label="削除">削除</button>
      </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="cart-page__list">${items}</div>
    <div class="cart-page__summary">
      <div class="cart-page__total"><span>合計</span><span>${yen(total)}</span></div>
      <a href="checkout.html" class="btn btn--primary btn--full">レジに進む</a>
      <a href="item.html" class="cart-page__continue">買い物を続ける</a>
    </div>`;
}

// ============================================================
//  Checkout (checkout.html page)
// ============================================================
// ▼ Stripe の「公開可能キー」をここに設定すると、本物の Stripe 決済フォーム
//   （Stripe Elements）になります。例: "pk_test_xxxxxxxx"
//   未設定（空文字）の場合は、デモ用のカード入力欄にフォールバックします。
//   ※ 実際の課金にはサーバー側で PaymentIntent を作成する処理が別途必要です。
const STRIPE_PUBLISHABLE_KEY = "";

// Stripe 関連の状態（checkout ページでのみ使用）
let _stripe = null;
let _stripeCard = null;
let _stripeReady = false;

function stripeKeyConfigured() {
  return typeof window.Stripe === "function" && /^pk_(test|live)_/.test(STRIPE_PUBLISHABLE_KEY);
}

// 決済フォームの初期化（Stripe Elements もしくはデモ入力欄）
function setupCheckoutPayment() {
  const mount = document.getElementById("paymentElement");
  const note = document.getElementById("payNote");
  const cardSection = document.getElementById("cardSection");

  // 支払い方法ラジオの切り替え（カードのときだけカード欄を表示）
  document.querySelectorAll('input[name="payMethod"]').forEach((r) => {
    r.addEventListener("change", () => {
      cardSection.hidden = document.querySelector('input[name="payMethod"]:checked').value !== "card";
    });
  });

  if (stripeKeyConfigured()) {
    // 本物の Stripe Elements
    try {
      _stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
      const elements = _stripe.elements();
      _stripeCard = elements.create("card", {
        style: {
          base: { color: "#f4efe6", fontSize: "16px", "::placeholder": { color: "#8a8275" } },
          invalid: { color: "#e07a7a" },
        },
      });
      _stripeCard.mount("#paymentElement");
      _stripeCard.on("change", (ev) => {
        const cardError = document.getElementById("cardError");
        cardError.hidden = !ev.error;
        cardError.textContent = ev.error ? ev.error.message : "";
      });
      _stripeReady = true;
      note.textContent = "Stripe のテスト環境では、テストカード 4242 4242 4242 4242（任意の将来日付・任意のCVC）が使えます。";
    } catch (err) {
      console.error("Stripe の初期化に失敗しました:", err);
      _stripeReady = false;
    }
  }

  if (!_stripeReady) {
    // デモ用カード入力欄（Stripe 未設定時）
    mount.innerHTML = `
      <div class="demo-card">
        <label class="field"><span>カード番号</span><input type="text" id="demoCardNumber" inputmode="numeric" autocomplete="cc-number" maxlength="19" placeholder="4242 4242 4242 4242" /></label>
        <div class="demo-card__row">
          <label class="field"><span>有効期限 (MM/YY)</span><input type="text" id="demoCardExp" inputmode="numeric" autocomplete="cc-exp" maxlength="5" placeholder="12/29" /></label>
          <label class="field"><span>セキュリティコード</span><input type="text" id="demoCardCvc" inputmode="numeric" autocomplete="cc-csc" maxlength="4" placeholder="123" /></label>
        </div>
      </div>`;
    note.textContent = "※ デモ用の入力欄です。app.js の STRIPE_PUBLISHABLE_KEY に pk_test_… を設定すると、本物の Stripe 決済フォームになります。";
  }
}

// 支払い処理。成功なら { label, brand, last4, method } を返し、失敗なら例外。
async function processPayment(method, name, email) {
  if (method === "cod") {
    return { label: "代金引換（着払い）", method: "cod" };
  }
  // カード払い
  if (_stripeReady) {
    const { paymentMethod, error } = await _stripe.createPaymentMethod({
      type: "card",
      card: _stripeCard,
      billing_details: { name, email },
    });
    if (error) throw new Error(error.message);
    const c = paymentMethod.card || {};
    return { label: `カード（${(c.brand || "card").toUpperCase()} ****${c.last4 || "----"}）`, brand: c.brand, last4: c.last4, method: "card", paymentMethodId: paymentMethod.id };
  }
  // デモ用カード入力のバリデーション
  const num = (document.getElementById("demoCardNumber").value || "").replace(/\s+/g, "");
  const exp = (document.getElementById("demoCardExp").value || "").trim();
  const cvc = (document.getElementById("demoCardCvc").value || "").trim();
  if (!/^\d{12,19}$/.test(num) || !/^\d{2}\/\d{2}$/.test(exp) || !/^\d{3,4}$/.test(cvc)) {
    throw new Error("カード情報を正しくご入力ください。（番号・有効期限 MM/YY・セキュリティコード）");
  }
  return { label: `カード ****${num.slice(-4)}（デモ）`, last4: num.slice(-4), method: "card" };
}

function renderCheckoutPage() {
  const root = document.getElementById("checkoutPage");
  if (!root) return;

  // 未ログインで直接来た場合はログイン画面へ
  if (!UserAuth.isLoggedIn()) {
    window.location.href = "login.html?redirect=checkout.html";
    return;
  }

  if (cart.length === 0) {
    root.innerHTML = `
      <p class="cart-page__empty">カートが空のため、購入手続きに進めません。</p>
      <div class="section-more"><a href="item.html" class="btn btn--ghost">商品一覧へ</a></div>`;
    return;
  }

  let total = 0;
  const rows = cart
    .map((l) => {
      const p = PRODUCTS.find((x) => x.id === l.id);
      if (!p) return "";
      total += p.price * l.qty;
      return `
      <div class="checkout-line">
        <span class="checkout-line__name">${p.name} <span class="checkout-line__qty">× ${l.qty}</span></span>
        <span class="checkout-line__price">${yen(p.price * l.qty)}</span>
      </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="checkout">
      <div class="checkout__col">
        <h3 class="checkout__subtitle">ご注文内容</h3>
        <div class="checkout__items">${rows}</div>
        <div class="cart-page__total"><span>合計</span><span>${yen(total)}</span></div>
      </div>
      <form class="checkout__col checkout__form" id="checkoutForm" novalidate>
        <h3 class="checkout__subtitle">お届け先・お客様情報</h3>
        <label class="field"><span>お名前 *</span><input type="text" id="coName" placeholder="鈴木 花子" required /></label>
        <label class="field"><span>メールアドレス *</span><input type="email" id="coEmail" placeholder="mail@example.com" required /></label>
        <label class="field"><span>お届け先住所 *</span><textarea id="coAddress" rows="3" placeholder="〒000-0000 ○○県○○市…" required></textarea></label>
        <label class="field"><span>備考（任意）</span><textarea id="coNote" rows="2" placeholder="ギフト包装のご希望など"></textarea></label>

        <h3 class="checkout__subtitle">お支払い方法</h3>
        <div class="pay-methods" id="payMethods">
          <label class="pay-method"><input type="radio" name="payMethod" value="card" checked /><span>クレジット / デビットカード</span></label>
          <label class="pay-method"><input type="radio" name="payMethod" value="cod" /><span>代金引換（着払い）</span></label>
        </div>
        <div id="cardSection">
          <div id="paymentElement" class="stripe-card"></div>
          <p class="checkout__error" id="cardError" hidden></p>
          <p class="pay-note" id="payNote"></p>
        </div>

        <p class="checkout__error" id="checkoutError" hidden>必須項目をご入力ください。</p>
        <button type="submit" class="btn btn--primary btn--full" id="placeOrderBtn">注文を確定する</button>
        <a href="cart.html" class="cart-page__continue">カートに戻る</a>
      </form>
    </div>`;

  setupCheckoutPayment();

  document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("coName").value.trim();
    const email = document.getElementById("coEmail").value.trim();
    const address = document.getElementById("coAddress").value.trim();
    const note = document.getElementById("coNote").value.trim();
    const err = document.getElementById("checkoutError");
    const submitBtn = document.getElementById("placeOrderBtn");
    if (!name || !email || !address) {
      err.textContent = "必須項目をご入力ください。";
      err.hidden = false;
      return;
    }
    err.hidden = true;

    const method = document.querySelector('input[name="payMethod"]:checked').value;

    // 支払い処理（Stripe もしくはデモ）
    let payment;
    submitBtn.disabled = true;
    submitBtn.textContent = "処理中…";
    try {
      payment = await processPayment(method, name, email);
    } catch (payErr) {
      err.textContent = payErr.message || "決済情報の確認に失敗しました。";
      err.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "注文を確定する";
      return;
    }

    const items = cart
      .map((l) => {
        const p = PRODUCTS.find((x) => x.id === l.id);
        return p ? { id: p.id, name: p.name, price: p.price, qty: l.qty } : null;
      })
      .filter(Boolean);
    const orderTotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);

    try {
      const order = await OrderStore.create({
        customer: name,
        email,
        address,
        note,
        items,
        total: orderTotal,
        payment: payment.label,
      });
      cart = [];
      saveCart();
      updateCartBadge();
      root.innerHTML = `
        <div class="checkout-done">
          <p class="checkout-done__title">ご注文ありがとうございました。</p>
          <p class="checkout-done__sub">注文番号：#${order.id}<br />お支払い方法：${payment.label}<br />確認メールを ${email} 宛にお送りします。（デモ）</p>
          <div class="section-more"><a href="item.html" class="btn btn--ghost">買い物を続ける</a></div>
        </div>`;
    } catch (e2) {
      console.error("注文の確定に失敗しました:", e2);
      err.textContent = "注文の確定に失敗しました。時間をおいて再度お試しください。";
      err.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "注文を確定する";
    }
  });
}

// ============================================================
//  Auth (login.html page) — tab switching
// ============================================================
function setAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.tab === tab));
  document.querySelectorAll(".auth-form").forEach((f) => f.classList.toggle("is-active", f.dataset.form === tab));
}

// ============================================================
//  Nav drawer
// ============================================================
function openNav() {
  document.getElementById("navToggle").classList.add("is-open");
  document.getElementById("nav").classList.add("is-open");
  document.getElementById("navOverlay").classList.add("is-open");
}
function closeNav() {
  const t = document.getElementById("navToggle");
  if (!t) return;
  t.classList.remove("is-open");
  document.getElementById("nav").classList.remove("is-open");
  document.getElementById("navOverlay").classList.remove("is-open");
}

// ============================================================
//  Wire up events
// ============================================================
function wire() {
  // Global click delegation (add / qty / remove / tab switch)
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) return addToCart(Number(add.dataset.add));
    const qty = e.target.closest("[data-qty]");
    if (qty) return changeQty(Number(qty.dataset.qty), Number(qty.dataset.delta));
    const rm = e.target.closest("[data-remove]");
    if (rm) return removeFromCart(Number(rm.dataset.remove));
    const wishRm = e.target.closest("[data-wishremove]");
    if (wishRm) return removeFromWishlist(Number(wishRm.dataset.wishremove));
    const goto = e.target.closest("[data-goto]");
    if (goto) return setAuthTab(goto.dataset.goto);
    // 商品カード / ベストセラー行クリックで詳細ページへ（カート追加ボタンは上で return 済み）
    const nav = e.target.closest("[data-href]");
    if (nav) {
      window.location.href = nav.dataset.href;
      return;
    }
  });

  // Filters (ITEM page)
  const filters = document.getElementById("filters");
  if (filters) {
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter");
      if (!btn) return;
      filters.querySelectorAll(".filter").forEach((f) => f.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderProducts(btn.dataset.filter);
    });
  }

  // カートボタン: 未ログインならログイン画面へ
  document.addEventListener("click", (e) => {
    const cartBtn = e.target.closest(".cart-btn");
    if (cartBtn && !UserAuth.isLoggedIn()) {
      e.preventDefault();
      window.location.href = "login.html?redirect=cart.html";
    }
  });


  // LOGIN/LOGOUT ボタン: ログイン中はクリックでログアウト
  document.addEventListener("click", (e) => {
    const authBtn = e.target.closest(".login-btn, .nav__login");
    if (authBtn && UserAuth.isLoggedIn()) {
      e.preventDefault();
      UserAuth.logout();
      if (window.Auth) Auth.signOut(); // Supabase セッションも破棄
      window.location.href = "index.html";
    }
  });

  // Auth tabs + form submit (login.html)
  document.querySelectorAll(".auth-tab").forEach((t) => t.addEventListener("click", () => setAuthTab(t.dataset.tab)));
  // ?tab=signup / ?tab=login で初期表示タブを切り替え（モーダルの「会員登録」導線用）
  const initTab = new URLSearchParams(location.search).get("tab");
  if (initTab === "signup" || initTab === "login") setAuthTab(initTab);
  document.querySelectorAll(".auth-form").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const isSignup = form.dataset.form === "signup";
      const action = isSignup ? "会員登録" : "ログイン";

      if (!window.Auth) {
        alert("認証モジュールが読み込まれていません。");
        return;
      }

      const email = form.querySelector('input[type="email"]').value.trim();
      const password = form.querySelector('input[type="password"]').value;

      // Supabase Auth で会員登録／ログイン
      let result;
      if (isSignup) {
        const name = form.querySelector('input[type="text"]').value.trim();
        result = await Auth.signUp({ email, password, name });
      } else {
        result = await Auth.signIn({ email, password });
      }

      if (result.error) {
        const msg = isSignup
          ? "会員登録に失敗しました。" + (result.error.message || "")
          : "メールアドレスまたはパスワードが違います。";
        alert(msg);
        return;
      }

      UserAuth.login(); // ヘッダーの LOGIN/LOGOUT 表示用フラグ
      form.reset();
      alert(`${action}が完了しました。`);
      const redirect = new URLSearchParams(location.search).get("redirect");
      window.location.href = redirect || "index.html";
    });
  });

  // Nav drawer
  const navToggle = document.getElementById("navToggle");
  const nav = document.getElementById("nav");
  navToggle.addEventListener("click", () => {
    nav.classList.contains("is-open") ? closeNav() : openNav();
  });
  document.getElementById("navOverlay").addEventListener("click", closeNav);

  // テーマ切替（ダーク / ライト）
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  // Escape closes nav drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  // Header scroll
  const header = document.getElementById("header");
  const isHome = currentPage() === "index.html";
  window.addEventListener("scroll", () => {
    if (isHome) header.classList.toggle("is-scrolled", window.scrollY > 40);
  });

  // Contact form (CONTACT page)
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("contactName")?.value.trim() || "";
      const email = document.getElementById("contactEmail")?.value.trim() || "";
      const message = document.getElementById("contactMessage")?.value.trim() || "";
      if (!name || !email || !message) return;
      try {
        // 入力内容を保存（管理画面のお問い合わせ一覧で確認できる）
        if (window.InquiryStore) {
          await InquiryStore.create({ name, email, message });
        }
        contactForm.reset();
        alert("お問い合わせを送信しました。");
      } catch (err) {
        console.error("お問い合わせの保存に失敗しました:", err);
        alert("送信に失敗しました。時間をおいて再度お試しください。");
      }
    });
  }

  // Entry form (ENTRY page)
  const entryForm = document.getElementById("entryForm");
  if (entryForm) {
    entryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("entryName")?.value.trim() || "";
      const kana = document.getElementById("entryKana")?.value.trim() || "";
      const email = document.getElementById("entryEmail")?.value.trim() || "";
      const phone = document.getElementById("entryPhone")?.value.trim() || "";
      const position = document.getElementById("entryPosition")?.value || "";
      if (!name || !email || !position) return;
      try {
        // 応募内容を保存（管理画面の応募者管理で確認できる）
        if (window.ApplicantStore) {
          await ApplicantStore.create({ name, kana, email, phone, position });
        }
      } catch (err) {
        console.error("応募の保存に失敗しました:", err);
      }
      const section = document.getElementById("entry");
      section.innerHTML = `
        <div class="section-head"><h2 class="section-head__title">ENTRY</h2></div>
        <p class="contact__lead">ご応募ありがとうございました。<br />内容を確認のうえ、担当者より ${name} 様へご連絡いたします。（デモ）</p>
        <div class="section-more"><a href="index.html" class="btn btn--ghost">トップへ戻る</a></div>`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Mail magazine form
  const mailmagForm = document.getElementById("mailmagForm");
  if (mailmagForm) {
    mailmagForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("mailmagEmail");
      if (!email.value.trim() || !email.checkValidity()) {
        email.focus();
        return;
      }
      try {
        // 登録者を保存（管理画面の顧客管理で確認できる）
        if (window.SubscriberStore) {
          await SubscriberStore.create(email.value.trim());
        }
      } catch (err) {
        console.error("メルマガ登録の保存に失敗しました:", err);
      }
      mailmagForm.reset();
      alert("メールマガジンにご登録いただきありがとうございます。（デモ）");
    });
  }

  // Topics carousel arrows
  //  - 短いクリック : 1カード分スライド（端ではループして反対端へ）
  //  - 長押し       : 連続スクロール。端に来たら反対端へ回り込み、押し続ける限り何周でも回せる
  const topicsRow = document.getElementById("topicsRow");
  if (topicsRow) {
    const step = () => {
      const card = topicsRow.querySelector(".topic-card");
      return card ? card.getBoundingClientRect().width + 26 : 320;
    };
    const maxScroll = () => topicsRow.scrollWidth - topicsRow.clientWidth;

    // クリック1回ぶんの移動（端ではループ）。dir: 1=次へ / -1=前へ
    const stepOnce = (dir) => {
      const max = maxScroll();
      if (dir > 0) {
        if (topicsRow.scrollLeft >= max - 4) topicsRow.scrollTo({ left: 0, behavior: "smooth" });
        else topicsRow.scrollBy({ left: step(), behavior: "smooth" });
      } else {
        if (topicsRow.scrollLeft <= 4) topicsRow.scrollTo({ left: max, behavior: "smooth" });
        else topicsRow.scrollBy({ left: -step(), behavior: "smooth" });
      }
    };

    // 長押し中の連続スクロール（requestAnimationFrame で滑らかに）。
    const SPEED = 8; // 1フレームあたりの移動量(px)
    let rafId = null;
    let holdTimer = null;
    const runScroll = (dir) => {
      const max = maxScroll();
      let next = topicsRow.scrollLeft + dir * SPEED;
      if (next > max) next -= max + 1;        // 末尾を越えたら先頭へ回り込む
      else if (next < 0) next += max + 1;     // 先頭を越えたら末尾へ回り込む
      topicsRow.scrollLeft = next;
      rafId = requestAnimationFrame(() => runScroll(dir));
    };
    const stopHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    };

    const bindArrow = (id, dir) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      // 押した瞬間：少し待ってから連続スクロール開始（短いクリックと区別）
      btn.addEventListener("pointerdown", (e) => {
        if (e.button != null && e.button !== 0) return; // 左ボタン/タッチのみ
        holdTimer = setTimeout(() => { holdTimer = null; runScroll(dir); }, 280);
      });
      // 連続スクロール中に指/ボタンを離す前にクリックが発火しないよう、離したら止める
      btn.addEventListener("pointerup", () => {
        const wasHolding = rafId !== null;
        stopHold();
        if (!wasHolding) stepOnce(dir); // 長押しに至らなかった → 通常クリック扱い
      });
      btn.addEventListener("pointerleave", stopHold);
      btn.addEventListener("pointercancel", stopHold);
      // キーボード操作（Enter/Space）でも1カード分動かせるよう保険
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stepOnce(dir); }
      });
    };
    bindArrow("topicsNext", 1);
    bindArrow("topicsPrev", -1);
  }

  // Section-head reveal
  document.querySelectorAll(".section-head").forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });
}

// ============================================================
//  Init
// ============================================================
buildChrome();
wire();
updateCartBadge();
applySiteImages();
applyAboutText();
applySiteText();

// 商品はストアから読み込んでから描画（将来 fetch に変わっても同じ流れ）
ProductStore.findAll()
  .then((products) => {
    PRODUCTS = products;
    renderRanking();
    renderFilters();
    renderProducts();
    renderProductDetail();
    renderCartPage();
    renderWishlistPage();
    renderCheckoutPage();
  })
  .catch((err) => {
    console.error("商品の読み込みに失敗しました:", err);
  });
