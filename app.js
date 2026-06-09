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

// ---------- Navigation ----------
const NAV_LINKS = [
  { label: "ABOUT", href: "index.html" },
  { label: "ITEM", href: "item.html" },
  { label: "NEWS", href: "news.html" },
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
    (l) => `<a href="${l.href}" class="nav__link${l.href === page ? " is-current" : ""}">${l.label}</a>`
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
        <button class="icon-btn" aria-label="検索">${ICON_SEARCH}</button>
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
    <div class="footer__top">
      <div class="footer__brand">
        <a href="index.html" class="brand">SATSUMA NOIR</a>
        <p>夜のように静かで、深い甘さを。</p>
      </div>
      <nav class="footer__links">
        <a href="faq.html">FAQ</a>
        <a href="privacy.html">プライバシーポリシー</a>
        <a href="tokushoho.html">特定商取引法に基づく表示</a>
        <a href="recruit.html">採用情報</a>
        <a href="contact.html">お問い合わせ</a>
      </nav>
    </div>
    <div class="footer__bottom">
      <p>© 2026 SATSUMA NOIR. All rights reserved.</p>
      <div class="footer__social">
        <a href="#" aria-label="Instagram" class="footer__social-icon" data-social="instagram">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>
        </a>
        <a href="#" aria-label="X" class="footer__social-icon" data-social="x">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        <a href="#" aria-label="Note" data-social="note">NOTE</a>
      </div>
    </div>`;
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
      const map = { hero: settings.heroImage, statement: settings.statementImage };
      Object.entries(map).forEach(([key, src]) => {
        if (!src) return;
        const el = document.querySelector(`[data-site-img="${key}"]`);
        if (el) el.src = src;
      });
    })
    .catch((err) => console.error("サイト画像の読み込みに失敗しました:", err));
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
    <article class="card" data-id="${p.id}">
      <div class="card__media">
        ${p.img ? `<img class="card__img" src="${p.img}" alt="${p.name}" loading="lazy" />` : `<span class="card__glyph">${p.glyph}</span>`}
      </div>
      <div class="card__body">
        ${p.tag ? `<span class="card__tag">${p.tag}</span>` : ""}
        <h3 class="card__name">${p.name}</h3>
        <div class="card__foot">
          <span class="card__price">${yen(p.price)}</span>
          <button class="card__add" data-add="${p.id}" aria-label="カートに追加">${ICON_CART_SM}</button>
        </div>
      </div>
    </article>`;
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
  row.innerHTML = getRankingProducts().map((p, i) => {
    const no = String(i + 1).padStart(2, "0");
    return `
    <article class="rank-card" data-id="${p.id}">
      <div class="rank-card__media">
        <span class="rank-card__no">${no}</span>
        ${p.img ? `<img class="card__img" src="${p.img}" alt="${p.name}" loading="lazy" />` : `<span class="rank-card__glyph">${p.glyph}</span>`}
      </div>
      <div class="rank-card__body">
        <h3 class="rank-card__name">${p.name}</h3>
        <div class="rank-card__foot">
          <span class="rank-card__price">${yen(p.price)}</span>
          <button class="card__add" data-add="${p.id}" aria-label="カートに追加">${ICON_CART_SM}</button>
        </div>
      </div>
    </article>`;
  }).join("");
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

function addToCart(id) {
  const line = cart.find((l) => l.id === id);
  if (line) line.qty += 1;
  else cart.push({ id, qty: 1 });
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
      <button class="btn btn--primary btn--full">レジに進む</button>
      <a href="item.html" class="cart-page__continue">買い物を続ける</a>
    </div>`;
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
    const goto = e.target.closest("[data-goto]");
    if (goto) return setAuthTab(goto.dataset.goto);
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
      window.location.href = "index.html";
    }
  });

  // Auth tabs + form submit (login.html)
  document.querySelectorAll(".auth-tab").forEach((t) => t.addEventListener("click", () => setAuthTab(t.dataset.tab)));
  document.querySelectorAll(".auth-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const action = form.dataset.form === "login" ? "ログイン" : "会員登録";

      // ログインはテスト用アカウントと照合（会員登録はデモのまま成功扱い）
      if (form.dataset.form === "login") {
        const email = form.querySelector('input[type="email"]').value.trim();
        const password = form.querySelector('input[type="password"]').value;
        if (email !== TEST_MEMBER.email || password !== TEST_MEMBER.password) {
          alert("メールアドレスまたはパスワードが違います。\n（テスト用: member@test.com / member123）");
          return;
        }
      }

      UserAuth.login();
      form.reset();
      alert(`${action}が完了しました。（デモ）`);
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
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      contactForm.reset();
      alert("お問い合わせを送信しました。（デモ）");
    });
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

// 商品はストアから読み込んでから描画（将来 fetch に変わっても同じ流れ）
ProductStore.findAll()
  .then((products) => {
    PRODUCTS = products;
    renderRanking();
    renderProducts();
    renderCartPage();
  })
  .catch((err) => {
    console.error("商品の読み込みに失敗しました:", err);
  });
