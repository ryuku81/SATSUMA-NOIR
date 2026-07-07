// ============================================================
//  Admin controller
//  ------------------------------------------------------------
//  データ操作は ProductStore（store.js）経由のみ。
//  バックエンド導入時は store.js と、下の AdminAuth を
//  本物の認証に差し替えるだけで動く。
// ============================================================

// ---- 管理者認証（バックエンド認証 + role=admin で認可）----
//  auth.js（window.Auth）を利用。ログイン後に role が admin か検証し、
//  admin でなければサインアウトして拒否する。
const AdminAuth = {
  // ログイン済みかつ管理者か
  async isAuthed() {
    if (!window.Auth) return false;
    return await Auth.isAdmin();
  },
  // メール＋パスワードでログインし、管理者権限を検証
  async login(email, password) {
    if (!window.Auth) return false;
    const { error } = await Auth.signIn({ email, password });
    if (error) return false;
    if (!(await Auth.isAdmin())) {
      await Auth.signOut(); // 一般会員は管理画面に入れない
      return false;
    }
    return true;
  },
  async logout() {
    if (window.Auth) await Auth.signOut();
  },
};

const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// ------------------------------------------------------------
//  要素参照
// ------------------------------------------------------------
const gate = document.getElementById("adminGate");
const panel = document.getElementById("adminPanel");
const loginForm = document.getElementById("adminLoginForm");
const passwordInput = document.getElementById("adminPassword");
const loginError = document.getElementById("adminError");
const logoutBtn = document.getElementById("adminLogout");

const rows = document.getElementById("productRows");
const addBtn = document.getElementById("addProductBtn");

const modal = document.getElementById("productModal");
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const form = document.getElementById("productForm");
const cancelBtn = document.getElementById("cancelBtn");
const catSelect = document.getElementById("fieldCat");

const F = {
  id: document.getElementById("fieldId"),
  name: document.getElementById("fieldName"),
  cat: document.getElementById("fieldCat"),
  price: document.getElementById("fieldPrice"),
  stock: document.getElementById("fieldStock"),
  tag: document.getElementById("fieldTag"),
  img: document.getElementById("fieldImg"),
  desc: document.getElementById("fieldDesc"),
  featureHead: document.getElementById("fieldFeatureHead"),
  featureBody: document.getElementById("fieldFeatureBody"),
  featureImage: document.getElementById("fieldFeatureImg"),
  specSize: document.getElementById("fieldSpecSize"),
  specExpiry: document.getElementById("fieldSpecExpiry"),
  specIngredients: document.getElementById("fieldSpecIngredients"),
  notes: document.getElementById("fieldNotes"),
};

const tabs = document.querySelectorAll(".admin__tab");
const views = document.querySelectorAll(".admin__view");

// ------------------------------------------------------------
//  認証フロー
// ------------------------------------------------------------
function showGate() {
  gate.hidden = false;
  panel.hidden = true;
}
function showPanel() {
  gate.hidden = true;
  panel.hidden = false;
  renderDashboard();
  renderTable();
  updateInquiryBadge();
  updateApplicantBadge();
}

// ------------------------------------------------------------
//  タブ切り替え
// ------------------------------------------------------------
const TAB_TITLES = { dashboard: "ダッシュボード", orders: "注文管理", customers: "顧客管理", members: "会員管理", products: "商品管理", bestseller: "人気商品管理", store: "店舗情報管理", inquiries: "お問い合わせ", news: "NEWS管理", journal: "JOURNAL管理", faq: "FAQ管理", recruit: "採用情報管理", applicants: "応募者管理", topics: "TOPICS管理", settings: "設定" };
function switchTab(name) {
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  views.forEach((v) => (v.hidden = v.dataset.view !== name));
  const title = document.getElementById("adminPageTitle");
  if (title) title.textContent = TAB_TITLES[name] || "";
  if (name === "dashboard") renderDashboard();
  if (name === "orders") renderOrders();
  if (name === "customers") { renderCustomers(); renderSubscribers(); }
  if (name === "members") renderMembers();
  if (name === "inquiries") renderInquiries();
  if (name === "news") renderNews();
  if (name === "journal") renderJournal();
  if (name === "faq") renderFaqs();
  if (name === "recruit") renderRecruit();
  if (name === "applicants") renderApplicants();
  if (name === "topics") renderTopics();
  if (name === "bestseller") renderBestseller();
  if (name === "store") renderStore();
  if (name === "settings") renderSettings();
}
tabs.forEach((t) => t.addEventListener("click", () => {
  switchTab(t.dataset.tab);
  closeAdminMenu();
}));

// ------------------------------------------------------------
//  ハンバーガーメニュー（モバイルのサイドバー開閉）
// ------------------------------------------------------------
const adminSidebar = document.querySelector(".admin__sidebar");
const adminMenuToggle = document.getElementById("adminMenuToggle");
const adminMenuOverlay = document.getElementById("adminMenuOverlay");
function openAdminMenu() {
  adminSidebar.classList.add("is-open");
  adminMenuOverlay.hidden = false;
}
function closeAdminMenu() {
  adminSidebar.classList.remove("is-open");
  adminMenuOverlay.hidden = true;
}
adminMenuToggle.addEventListener("click", () => {
  if (adminSidebar.classList.contains("is-open")) closeAdminMenu();
  else openAdminMenu();
});
adminMenuOverlay.addEventListener("click", closeAdminMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && adminSidebar.classList.contains("is-open")) closeAdminMenu();
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value.trim();
  const ok = await AdminAuth.login(email, passwordInput.value);
  if (ok) {
    loginError.hidden = true;
    passwordInput.value = "";
    showPanel();
  } else {
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await AdminAuth.logout();
  showGate();
});

// ------------------------------------------------------------
//  在庫表示ヘルパー
// ------------------------------------------------------------
function stockCell(stock) {
  const n = Number(stock) || 0;
  if (n === 0) return `<span class="stock-pill stock-pill--out">在庫切れ</span>`;
  if (n <= ProductStore.LOW_STOCK_THRESHOLD)
    return `<span class="stock-pill stock-pill--low">残り${n}</span>`;
  return `<span class="stock-pill">${n}</span>`;
}

const fmtDateTime = (iso) => {
  const d = new Date(iso);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ------------------------------------------------------------
//  ダッシュボード
// ------------------------------------------------------------
// 管理画面アクセント＝オレンジ（白基調に合わせた配色）
const GOLD = "#ec6a1a";
const GOLD_SOFT = "#c0530c";
// 売上内訳ドーナツの配色（オレンジを軸に調和する暖色の多色＋その他はグレー）
const DONUT_COLORS = ["#e0641a", "#c79235", "#a85d4e", "rgba(0,0,0,0.13)"];

// 日付ヘルパー
const ymd = (d) => {
  const x = new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};
const isSameDay = (a, b) => ymd(a) === ymd(b);
const isSameMonth = (a, b) => {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth();
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const pct = (cur, prev) => {
  if (!prev) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
};
const signPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

// ---- 棒グラフ（売上サマリー）----
function barChart(entries) {
  // entries: [{ date: Date, value: number }]
  if (!entries.length) return `<p class="dash-list__empty">データがありません。</p>`;
  const max = Math.max(...entries.map((e) => e.value), 1);
  let maxIdx = 0;
  entries.forEach((e, i) => { if (e.value > entries[maxIdx].value) maxIdx = i; });
  const n = entries.length;
  // x 軸ラベルは概ね 5 等分で表示
  const labelEvery = Math.max(1, Math.round(n / 6));
  const bars = entries
    .map((e, i) => {
      const hp = Math.max(2, (e.value / max) * 100);
      const hot = i === maxIdx && e.value > 0;
      const d = new Date(e.date);
      const tip = `${d.getMonth() + 1}/${d.getDate()} ・ ${yen(e.value)}`;
      const showLabel = i % labelEvery === 0 || i === n - 1;
      const label = showLabel ? `${d.getMonth() + 1}/${d.getDate()}` : "";
      return `<div class="dash-bar${hot ? " is-hot" : ""}" title="${tip}">
        <div class="dash-bar__fill" style="height:${hp}%"></div>
        <span class="dash-bar__x">${label}</span>
      </div>`;
    })
    .join("");
  return `<div class="dash-bars">${bars}</div>`;
}

// ---- ドーナツ（売上内訳）----
function donutChart(segments, total) {
  const r = 46, cx = 60, cy = 60, sw = 16;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const safeTotal = total || 1;
  const arcs = segments
    .map((s, i) => {
      const len = (s.value / safeTotal) * c;
      const arc = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
        stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return arc;
    })
    .join("");
  return `<svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="${sw}"/>
    ${arcs}
    <text x="${cx}" y="56" text-anchor="middle" class="dash-donut__cap">合計</text>
    <text x="${cx}" y="74" text-anchor="middle" class="dash-donut__total">${yen(total)}</text>
  </svg>`;
}

// 期間ごとの開始/終了/前期間を返す
function resolvePeriod(key) {
  const now = new Date();
  if (key === "custom") {
    const fromEl = document.getElementById("salesFrom");
    const toEl = document.getElementById("salesTo");
    // 既定（未入力時）は当月初〜今日
    let from = fromEl.value ? new Date(`${fromEl.value}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
    let to = toEl.value ? new Date(`${toEl.value}T23:59:59.999`) : new Date(now);
    // 開始が終了より後なら入れ替える
    if (from > to) { const t = from; from = new Date(to); from.setHours(0, 0, 0, 0); to = new Date(t); to.setHours(23, 59, 59, 999); }
    // 前期間：同じ日数だけ手前の窓
    const spanDays = Math.max(1, Math.round((to - from) / 86400000) + 1);
    const prevEnd = addDays(from, -1); prevEnd.setHours(23, 59, 59, 999);
    const prevStart = addDays(prevEnd, -(spanDays - 1)); prevStart.setHours(0, 0, 0, 0);
    const fmt = (d) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    return { start: from, end: to, prevStart, prevEnd, label: `（${fmt(from)}〜${fmt(to)}）` };
  }
  if (key === "lastMonth") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
    return { start, end, prevStart, prevEnd, label: "（先月）" };
  }
  if (key === "last30") {
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const start = addDays(end, -29); start.setHours(0, 0, 0, 0);
    const prevEnd = addDays(start, -1); prevEnd.setHours(23, 59, 59, 999);
    const prevStart = addDays(prevEnd, -29); prevStart.setHours(0, 0, 0, 0);
    return { start, end, prevStart, prevEnd, label: "（直近30日）" };
  }
  // thisMonth（既定）
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end, prevStart, prevEnd, label: "（今月）" };
}

const sumTotals = (orders) => orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
const inRange = (orders, start, end) =>
  orders.filter((o) => { const t = new Date(o.createdAt); return t >= start && t <= end; });

// ダッシュ全体で使い回すデータ
let dashOrders = [];
let dashCustomers = [];

// 売上サマリー＆内訳を選択中の期間（カレンダー指定）で描画
function renderSalesSummary() {
  const { start, end, prevStart, prevEnd, label } = resolvePeriod("custom");

  const cur = inRange(dashOrders, start, end);
  const prev = inRange(dashOrders, prevStart, prevEnd);
  const curTotal = sumTotals(cur);
  const prevTotal = sumTotals(prev);

  document.getElementById("kpiSummaryValue").textContent = yen(curTotal);
  const deltaEl = document.getElementById("kpiSummaryDelta");
  const dp = pct(curTotal, prevTotal);
  deltaEl.textContent = `前期比 ${signPct(dp)}`;
  deltaEl.className = "dash-summary__delta " + (dp >= 0 ? "is-up" : "is-down");

  // 日別の棒グラフ
  const byDay = {};
  cur.forEach((o) => { const k = ymd(o.createdAt); byDay[k] = (byDay[k] || 0) + (Number(o.total) || 0); });
  const entries = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    entries.push({ date: new Date(d), value: byDay[ymd(d)] || 0 });
  }
  document.getElementById("salesChart").innerHTML = barChart(entries);

  // 売上内訳（商品別 上位3＋その他）
  document.getElementById("breakdownPeriodLabel").textContent = label;
  const rev = {};
  cur.forEach((o) => (o.items || []).forEach((it) => {
    const amt = (Number(it.price) || 0) * (Number(it.qty) || 0);
    rev[it.name] = (rev[it.name] || 0) + amt;
  }));
  const ranked = Object.entries(rev).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const top = ranked.slice(0, 3);
  const restVal = ranked.slice(3).reduce((s, x) => s + x.value, 0);
  const segs = top.map((t, i) => ({ ...t, color: DONUT_COLORS[i] }));
  if (restVal > 0) segs.push({ name: "その他", value: restVal, color: DONUT_COLORS[3] });
  const total = segs.reduce((s, x) => s + x.value, 0);

  document.getElementById("breakdownDonut").innerHTML = total > 0
    ? donutChart(segs, total)
    : `<p class="dash-list__empty">データがありません。</p>`;
  document.getElementById("breakdownLegend").innerHTML = total > 0
    ? segs.map((s) => `
        <li class="dash-legend__item">
          <span class="dash-legend__dot" style="background:${s.color}"></span>
          <span class="dash-legend__name">${escapeHtml(s.name)}</span>
          <span class="dash-legend__val">${yen(s.value)}<span class="dash-legend__pct">${Math.round((s.value / total) * 100)}%</span></span>
        </li>`).join("")
    : "";
}

// 売上サマリーの期間（カレンダー指定）
const salesFromEl = document.getElementById("salesFrom");
const salesToEl = document.getElementById("salesTo");

// 既定値：当月初〜今日
(function initSalesDateRange() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  if (!salesFromEl.value) salesFromEl.value = `${now.getFullYear()}-${p(now.getMonth() + 1)}-01`;
  if (!salesToEl.value) salesToEl.value = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
})();

salesFromEl.addEventListener("change", renderSalesSummary);
salesToEl.addEventListener("change", renderSalesSummary);

async function renderDashboard() {
  const [alerts, orders, customers] = await Promise.all([
    ProductStore.findStockAlerts(),
    OrderStore.findAll(),
    CustomerStore.findAll().catch(() => []),
  ]);
  dashOrders = orders;
  dashCustomers = customers;

  const now = new Date();
  const yesterday = addDays(now, -1);

  // --- KPI: 本日の売上（前日比）---
  const todaySales = sumTotals(orders.filter((o) => isSameDay(o.createdAt, now)));
  const ydaySales = sumTotals(orders.filter((o) => isSameDay(o.createdAt, yesterday)));
  document.getElementById("kpiTodaySales").textContent = yen(todaySales);
  setDelta("kpiTodaySalesDelta", `前日比 ${signPct(pct(todaySales, ydaySales))}`, pct(todaySales, ydaySales) >= 0);

  // --- KPI: 今月の売上（前月比）---
  const thisMonthSales = sumTotals(orders.filter((o) => isSameMonth(o.createdAt, now)));
  const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastMonthSales = sumTotals(orders.filter((o) => isSameMonth(o.createdAt, lastMonthRef)));
  document.getElementById("kpiMonthSales").textContent = yen(thisMonthSales);
  setDelta("kpiMonthSalesDelta", `前月比 ${signPct(pct(thisMonthSales, lastMonthSales))}`, pct(thisMonthSales, lastMonthSales) >= 0);

  // --- KPI: 本日の注文数（前日比）---
  const todayCount = orders.filter((o) => isSameDay(o.createdAt, now)).length;
  const ydayCount = orders.filter((o) => isSameDay(o.createdAt, yesterday)).length;
  document.getElementById("kpiTodayOrders").textContent = `${todayCount}件`;
  setDelta("kpiTodayOrdersDelta", `前日比 ${todayCount - ydayCount >= 0 ? "+" : ""}${todayCount - ydayCount}件`, todayCount - ydayCount >= 0);

  // --- KPI: 会員数（今月の新規）---
  const newThisMonth = customers.filter((c) => c.createdAt && isSameMonth(c.createdAt, now)).length;
  document.getElementById("kpiMembers").textContent = `${customers.length}人`;
  setDelta("kpiMembersDelta", `今月 +${newThisMonth}人`, true);

  // --- 要対応バナー（未発送の注文）---
  const unshipped = orders.filter((o) => o.status === "unshipped");
  const nowMs = now.getTime();
  const overdue = unshipped.filter((o) => nowMs - new Date(o.createdAt).getTime() > 48 * 3600 * 1000).length;
  const action = document.getElementById("dashAction");
  if (unshipped.length === 0) {
    action.className = "dash-action is-clear";
    action.innerHTML = `
      <span class="dash-action__icon">✓</span>
      <span class="dash-action__text">未発送の注文はありません。すべて発送済みです。</span>`;
  } else {
    action.className = "dash-action is-warn";
    action.innerHTML = `
      <span class="dash-action__icon">!</span>
      <span class="dash-action__text"><strong>${unshipped.length}件</strong> の未発送注文があります${overdue ? `（うち <strong>${overdue}件</strong> は受注から48時間以上経過）` : ""}。冷凍商品のため、早めの発送をおすすめします。</span>
      <button class="btn btn--primary btn--sm" type="button" data-goto-tab="orders">注文管理へ</button>`;
  }

  // --- 客単価（今月）---
  const monthOrders = orders.filter((o) => isSameMonth(o.createdAt, now));
  const aov = monthOrders.length ? Math.round(thisMonthSales / monthOrders.length) : 0;
  document.getElementById("kpiAov").textContent = yen(aov);
  document.getElementById("kpiAovNote").textContent = `今月 ${monthOrders.length} 件の注文`;

  // --- 新規 / リピーター（今月の購入者）---
  // 顧客ごとの初回購入日（全期間）を求め、今月の購入者を新規/リピーターに分類
  const firstOrderAt = {};
  orders.forEach((o) => {
    const t = new Date(o.createdAt).getTime();
    if (firstOrderAt[o.customer] === undefined || t < firstOrderAt[o.customer]) firstOrderAt[o.customer] = t;
  });
  const buyersThisMonth = [...new Set(monthOrders.map((o) => o.customer))];
  let newBuyers = 0, repeatBuyers = 0;
  buyersThisMonth.forEach((name) => {
    isSameMonth(firstOrderAt[name], now) ? newBuyers++ : repeatBuyers++;
  });
  const repeatRate = buyersThisMonth.length ? Math.round((repeatBuyers / buyersThisMonth.length) * 100) : 0;
  document.getElementById("kpiNewBuyers").textContent = newBuyers;
  document.getElementById("kpiRepeatBuyers").textContent = repeatBuyers;
  document.getElementById("kpiRepeatRate").textContent = `${repeatRate}%`;

  // --- 売上サマリー＆内訳 ---
  renderSalesSummary();

  // --- 最新の注文（直近5件）---
  const latest = orders
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  const latestRows = document.getElementById("latestOrdersRows");
  latestRows.innerHTML = latest.length === 0
    ? `<tr><td colspan="5" class="admin-table__empty">注文はまだありません。</td></tr>`
    : latest.map((o) => `
        <tr>
          <td data-label="注文ID">#${o.id}</td>
          <td class="admin-nowrap" data-label="注文日時">${fmtDateTime(o.createdAt)}</td>
          <td data-label="顧客名">${escapeHtml(o.customer)}</td>
          <td data-label="合計金額">${yen(o.total)}</td>
          <td data-label="ステータス">${statusBadge(o.status)}</td>
        </tr>`).join("");

  // --- 在庫アラート ---
  const stockList = document.getElementById("stockAlertList");
  stockList.innerHTML = alerts.length === 0
    ? `<p class="dash-list__empty">在庫切れ・残りわずかの商品はありません。</p>`
    : alerts.map((p) => `
        <div class="dash-stock">
          <span class="dash-stock__thumb">${
            p.img
              ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" loading="lazy" />`
              : `<span class="dash-stock__glyph">${escapeHtml(p.glyph || "🍰")}</span>`
          }</span>
          <span class="dash-stock__name">${escapeHtml(p.name)}</span>
          <span class="dash-stock__count">現在在庫 ${Number(p.stock) || 0}個</span>
          <span>${stockCell(p.stock)}</span>
        </div>`).join("");
}

// 小ヘルパー：差分テキストの色分け
function setDelta(id, text, up) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = "kpi-card__delta " + (up ? "is-up" : "is-down");
}

// ダッシュボードの「〜へ」リンクで対象タブへ移動
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-goto-tab]");
  if (!btn) return;
  switchTab(btn.dataset.gotoTab);
});

// ------------------------------------------------------------
//  注文管理
// ------------------------------------------------------------
const ORDER_STATUS = {
  unshipped: { label: "未発送", cls: "status-pill--warn" },
  shipped: { label: "発送済み", cls: "status-pill--ok" },
};
const statusBadge = (s) => {
  const v = ORDER_STATUS[s] || { label: s, cls: "" };
  return `<span class="status-pill ${v.cls}">${v.label}</span>`;
};
const itemsSummary = (items = []) => {
  if (items.length === 0) return "—";
  const first = items[0];
  const head = `${escapeHtml(first.name)} ×${first.qty}`;
  return items.length > 1 ? `${head} 他${items.length - 1}点` : head;
};

let orderFilterStatus = "all";
const orderRows = document.getElementById("orderRows");

async function renderOrders() {
  const all = await OrderStore.findAll();
  const list = orderFilterStatus === "all" ? all : all.filter((o) => o.status === orderFilterStatus);

  if (list.length === 0) {
    orderRows.innerHTML = `<tr><td colspan="7" class="admin-table__empty">該当する注文はありません。</td></tr>`;
    return;
  }
  orderRows.innerHTML = list
    .map(
      (o) => `
    <tr>
      <td data-label="注文ID">#${o.id}</td>
      <td data-label="日時">${fmtDateTime(o.createdAt)}</td>
      <td data-label="顧客">${escapeHtml(o.customer)}</td>
      <td data-label="商品">${itemsSummary(o.items)}</td>
      <td data-label="合計">${yen(o.total)}</td>
      <td data-label="ステータス">${statusBadge(o.status)}</td>
      <td class="admin-table__ops"><button class="admin-op" data-detail="${o.id}">詳細</button></td>
    </tr>`
    )
    .join("");
}

// ステータス絞り込み
document.getElementById("orderFilter").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-filter__btn");
  if (!btn) return;
  document.querySelectorAll(".order-filter__btn").forEach((b) => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  orderFilterStatus = btn.dataset.status;
  renderOrders();
});

// 行の「詳細」→ 注文詳細モーダル
orderRows.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-detail]");
  if (!btn) return;
  const order = await OrderStore.findById(btn.dataset.detail);
  if (order) openOrderModal(order);
});

// ---- 注文詳細モーダル ----
const orderModal = document.getElementById("orderModal");
const orderToggleBtn = document.getElementById("orderToggleBtn");

function openOrderModal(order) {
  document.getElementById("orderModalTitle").textContent = `注文 #${order.id}`;
  const rowsHtml = (order.items || [])
    .map(
      (it) => `
    <div class="order-line">
      <span class="order-line__name">${escapeHtml(it.name)}</span>
      <span class="order-line__qty">×${it.qty}</span>
      <span class="order-line__price">${yen(it.price * it.qty)}</span>
    </div>`
    )
    .join("");
  document.getElementById("orderDetail").innerHTML = `
    <dl class="order-meta">
      <div><dt>顧客</dt><dd>${escapeHtml(order.customer)}</dd></div>
      <div><dt>お届け先</dt><dd>${order.address ? escapeHtml(order.address) : "—"}</dd></div>
      <div><dt>注文日時</dt><dd>${fmtDateTime(order.createdAt)}</dd></div>
      <div><dt>ステータス</dt><dd>${statusBadge(order.status)}</dd></div>
    </dl>
    <div class="order-lines">${rowsHtml}</div>
    <div class="order-total"><span>合計</span><span>${yen(order.total)}</span></div>`;

  orderToggleBtn.textContent = order.status === "unshipped" ? "発送済みにする" : "未発送に戻す";
  orderToggleBtn.dataset.id = order.id;
  orderToggleBtn.dataset.next = order.status === "unshipped" ? "shipped" : "unshipped";
  orderModal.hidden = false;
}
function closeOrderModal() {
  orderModal.hidden = true;
}

orderToggleBtn.addEventListener("click", async () => {
  await OrderStore.updateStatus(orderToggleBtn.dataset.id, orderToggleBtn.dataset.next);
  showToast("ステータスを更新しました。");
  closeOrderModal();
  renderOrders();
  renderDashboard();
});
document.getElementById("orderCloseBtn").addEventListener("click", closeOrderModal);
document.getElementById("orderModalOverlay").addEventListener("click", closeOrderModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !orderModal.hidden) closeOrderModal();
});

// ------------------------------------------------------------
//  顧客管理
// ------------------------------------------------------------
const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

// 注文を顧客名でグルーピングして集計（将来は customerId で関連付け）
async function getOrdersByCustomer() {
  const orders = await OrderStore.findAll();
  return orders.reduce((map, o) => {
    (map[o.customer] = map[o.customer] || []).push(o);
    return map;
  }, {});
}

const customerRows = document.getElementById("customerRows");

async function renderCustomers() {
  const [customers, byCustomer] = await Promise.all([
    CustomerStore.findAll(),
    getOrdersByCustomer(),
  ]);

  if (customers.length === 0) {
    customerRows.innerHTML = `<tr><td colspan="7" class="admin-table__empty">顧客がいません。「＋ 顧客を追加」から登録してください。</td></tr>`;
    return;
  }
  customerRows.innerHTML = customers
    .map((c) => {
      const count = (byCustomer[c.name] || []).length;
      return `
    <tr>
      <td data-label="ID">${c.id}</td>
      <td class="admin-nowrap" data-label="名前">${escapeHtml(c.name)}</td>
      <td data-label="メール">${escapeHtml(c.email)}</td>
      <td data-label="電話番号">${c.phone ? escapeHtml(c.phone) : "—"}</td>
      <td data-label="登録日">${fmtDate(c.createdAt)}</td>
      <td data-label="注文数">${count > 0 ? `<span class="count-pill">${count}</span>` : "—"}</td>
      <td class="admin-table__ops">
        <button class="admin-op" data-cdetail="${c.id}">詳細</button>
        <button class="admin-op" data-cedit="${c.id}">編集</button>
        <button class="admin-op admin-op--danger" data-cdel="${c.id}">削除</button>
      </td>
    </tr>`;
    })
    .join("");
}

// ---- 追加/編集モーダル ----
const customerModal = document.getElementById("customerModal");
const customerForm = document.getElementById("customerForm");
const CF = {
  id: document.getElementById("cFieldId"),
  name: document.getElementById("cFieldName"),
  email: document.getElementById("cFieldEmail"),
  phone: document.getElementById("cFieldPhone"),
};

function openCustomerModal(customer) {
  document.getElementById("customerModalTitle").textContent = customer ? "顧客を編集" : "顧客を追加";
  CF.id.value = customer?.id ?? "";
  CF.name.value = customer?.name ?? "";
  CF.email.value = customer?.email ?? "";
  CF.phone.value = customer?.phone ?? "";
  customerModal.hidden = false;
}
function closeCustomerModal() {
  customerModal.hidden = true;
  customerForm.reset();
}

document.getElementById("addCustomerBtn").addEventListener("click", () => openCustomerModal(null));
document.getElementById("customerCancelBtn").addEventListener("click", closeCustomerModal);
document.getElementById("customerModalOverlay").addEventListener("click", closeCustomerModal);

customerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: CF.name.value.trim(),
    email: CF.email.value.trim(),
    phone: CF.phone.value.trim(),
  };
  if (!data.name || !data.email) {
    showToast("名前とメールアドレスは必須です。");
    return;
  }
  try {
    const id = CF.id.value;
    if (id) {
      await CustomerStore.update(id, data);
      showToast("顧客を更新しました。");
    } else {
      await CustomerStore.create(data);
      showToast("顧客を追加しました。");
    }
    closeCustomerModal();
    renderCustomers();
  } catch (err) {
    console.error("顧客の保存に失敗しました:", err);
    showToast(err && err.code === "23505" ? "このメールアドレスは既に登録されています。" : "保存に失敗しました。");
  }
});

// ------------------------------------------------------------
//  会員管理（バックエンド認証ユーザーの role 変更）
//  新しいバックエンド接続後にユーザー一覧を取得し、admin/member を切り替える。
// ------------------------------------------------------------
const memberRows = document.getElementById("memberRows");

async function renderMembers() {
  if (!memberRows) return;
  if (!window.Auth) {
    memberRows.innerHTML = `<tr><td colspan="5" class="admin-table__empty">バックエンド認証APIは未接続です。</td></tr>`;
    return;
  }
  const [{ data: rows, error }, me] = await Promise.all([Auth.listUsers(), Auth.getUser()]);
  if (error) {
    console.error("会員の取得に失敗しました:", error);
    memberRows.innerHTML = `<tr><td colspan="5" class="admin-table__empty">取得に失敗しました。</td></tr>`;
    return;
  }
  const list = rows || [];
  if (list.length === 0) {
    memberRows.innerHTML = `<tr><td colspan="5" class="admin-table__empty">会員がいません。</td></tr>`;
    return;
  }
  const myId = me ? me.id : null;
  memberRows.innerHTML = list
    .map((m) => {
      const isSelf = m.auth_user_id === myId;
      const badge = m.role === "admin" ? `<span class="admin-badge">管理者</span>` : `<span class="count-pill">会員</span>`;
      const next = m.role === "admin" ? "member" : "admin";
      const label = m.role === "admin" ? "会員に戻す" : "管理者にする";
      const action = isSelf
        ? `自分（あなた）`
        : `<button class="admin-op" data-mrole="${m.id}" data-next="${next}">${label}</button>`;
      return `
    <tr>
      <td class="admin-nowrap" data-label="メール">${escapeHtml(m.email || "")}</td>
      <td data-label="名前">${m.name ? escapeHtml(m.name) : "—"}</td>
      <td data-label="権限">${badge}</td>
      <td data-label="登録日">${fmtDate(m.created_at)}</td>
      <td class="admin-table__ops">${action}</td>
    </tr>`;
    })
    .join("");
}

if (memberRows) {
  memberRows.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-mrole]");
    if (!btn) return;
    const next = btn.dataset.next;
    const { error } = await Auth.updateUserRole(btn.dataset.mrole, next);
    if (error) {
      console.error("権限の変更に失敗しました:", error);
      showToast("権限の変更に失敗しました。");
      return;
    }
    showToast(next === "admin" ? "管理者に変更しました。" : "会員に変更しました。");
    renderMembers();
  });
}

// ---- 詳細モーダル（注文履歴つき）----
const customerDetailModal = document.getElementById("customerDetailModal");

async function openCustomerDetail(customer) {
  const byCustomer = await getOrdersByCustomer();
  const orders = byCustomer[customer.name] || [];
  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  document.getElementById("customerDetailTitle").textContent = customer.name;
  const ordersHtml =
    orders.length === 0
      ? `<p class="dash-list__empty">注文履歴はありません。</p>`
      : orders
          .map(
            (o) => `
      <div class="dash-row">
        <span class="dash-row__main">#${o.id}</span>
        <span class="dash-row__meta">${fmtDateTime(o.createdAt)} ・ ${statusBadge(o.status)}</span>
        <span class="order-line__price">${yen(o.total)}</span>
      </div>`
          )
          .join("");

  document.getElementById("customerDetail").innerHTML = `
    <dl class="order-meta">
      <div><dt>メール</dt><dd>${escapeHtml(customer.email)}</dd></div>
      <div><dt>電話</dt><dd>${customer.phone ? escapeHtml(customer.phone) : "—"}</dd></div>
      <div><dt>登録日</dt><dd>${fmtDate(customer.createdAt)}</dd></div>
      <div><dt>注文数</dt><dd>${orders.length} 件</dd></div>
      <div><dt>購入総額</dt><dd>${yen(totalSpent)}</dd></div>
    </dl>
    <h4 class="customer-detail__subtitle">注文履歴</h4>
    <div class="order-lines">${ordersHtml}</div>`;

  document.getElementById("customerEditBtn").dataset.id = customer.id;
  customerDetailModal.hidden = false;
}
function closeCustomerDetail() {
  customerDetailModal.hidden = true;
}
document.getElementById("customerDetailCloseBtn").addEventListener("click", closeCustomerDetail);
document.getElementById("customerDetailOverlay").addEventListener("click", closeCustomerDetail);
document.getElementById("customerEditBtn").addEventListener("click", async () => {
  const customer = await CustomerStore.findById(document.getElementById("customerEditBtn").dataset.id);
  if (customer) {
    closeCustomerDetail();
    openCustomerModal(customer);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!customerModal.hidden) closeCustomerModal();
  if (!customerDetailModal.hidden) closeCustomerDetail();
});

// ---- 行内の 詳細 / 編集 / 削除 ----
customerRows.addEventListener("click", async (e) => {
  const detailBtn = e.target.closest("[data-cdetail]");
  const editBtn = e.target.closest("[data-cedit]");
  const delBtn = e.target.closest("[data-cdel]");

  if (detailBtn) {
    const c = await CustomerStore.findById(detailBtn.dataset.cdetail);
    if (c) openCustomerDetail(c);
  }
  if (editBtn) {
    const c = await CustomerStore.findById(editBtn.dataset.cedit);
    if (c) openCustomerModal(c);
  }
  if (delBtn) {
    const c = await CustomerStore.findById(delBtn.dataset.cdel);
    if (c && confirm(`「${c.name}」を削除しますか？`)) {
      await CustomerStore.remove(c.id);
      showToast("顧客を削除しました。");
      renderCustomers();
    }
  }
});

// ------------------------------------------------------------
//  メールマガジン登録者（顧客管理タブ内）
// ------------------------------------------------------------
const subscriberRows = document.getElementById("subscriberRows");

async function renderSubscribers() {
  if (!subscriberRows) return;
  const list = await SubscriberStore.findAll();
  if (list.length === 0) {
    subscriberRows.innerHTML = `<tr><td colspan="3" class="admin-table__empty">登録者はいません。</td></tr>`;
    return;
  }
  subscriberRows.innerHTML = list
    .map(
      (s) => `
    <tr>
      <td data-label="メールアドレス">${escapeHtml(s.email)}</td>
      <td data-label="登録日時">${fmtDateTime(s.createdAt)}</td>
      <td class="admin-table__ops">
        <button class="admin-op admin-op--danger" data-subdel="${s.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");
}

if (subscriberRows) {
  subscriberRows.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-subdel]");
    if (!del) return;
    if (!confirm("この登録者を削除しますか？")) return;
    await SubscriberStore.remove(del.dataset.subdel);
    showToast("登録者を削除しました。");
    renderSubscribers();
  });
}

// ------------------------------------------------------------
//  お問い合わせ
// ------------------------------------------------------------
const inquiryRows = document.getElementById("inquiryRows");
const inquiryModal = document.getElementById("inquiryModal");
const inquiryToggleBtn = document.getElementById("inquiryToggleBtn");
const inquiryDeleteBtn = document.getElementById("inquiryDeleteBtn");

const INQUIRY_STATUS = {
  new: { label: "未読", cls: "status-pill--warn" },
  read: { label: "既読", cls: "status-pill--ok" },
};
const inquiryBadge = (s) => {
  const v = INQUIRY_STATUS[s] || { label: s, cls: "" };
  return `<span class="status-pill ${v.cls}">${v.label}</span>`;
};
// 一覧用：クリックで未読⇄既読を切り替えられるボタン（「詳細」と同じデザイン）
const inquiryStatusButton = (i) => {
  const v = INQUIRY_STATUS[i.status] || { label: i.status, cls: "" };
  return `<button type="button" class="admin-op" data-itoggle="${i.id}" data-cur="${i.status}" title="クリックで未読／既読を切り替え">${v.label}</button>`;
};

let inquiryFilterStatus = "all";

// サイドバーの未読バッジを更新
async function updateInquiryBadge() {
  const badge = document.getElementById("inquiryBadge");
  if (!badge) return;
  const n = await InquiryStore.countNew();
  badge.textContent = n;
  badge.hidden = n === 0;
}

async function renderInquiries() {
  const all = await InquiryStore.findAll();
  const list = inquiryFilterStatus === "all" ? all : all.filter((i) => i.status === inquiryFilterStatus);

  if (list.length === 0) {
    inquiryRows.innerHTML = `<tr><td colspan="6" class="admin-table__empty">該当するお問い合わせはありません。</td></tr>`;
    return;
  }
  inquiryRows.innerHTML = list
    .map(
      (i) => `
    <tr${i.status === "new" ? ' class="is-unread"' : ""}>
      <td data-label="受信日時">${fmtDateTime(i.createdAt)}</td>
      <td class="admin-nowrap" data-label="お名前">${escapeHtml(i.name)}</td>
      <td data-label="メール">${escapeHtml(i.email)}</td>
      <td data-label="内容">${escapeHtml(truncate(i.message, 40))}</td>
      <td data-label="状態">${inquiryStatusButton(i)}</td>
      <td class="admin-table__ops"><button class="admin-op" data-idetail="${i.id}">詳細</button></td>
    </tr>`
    )
    .join("");
}

// ステータス絞り込み
document.getElementById("inquiryFilter").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-filter__btn");
  if (!btn) return;
  document.querySelectorAll("#inquiryFilter .order-filter__btn").forEach((b) => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  inquiryFilterStatus = btn.dataset.status;
  renderInquiries();
});

// 状態バッジ → クリックで未読⇄既読を切り替え
inquiryRows.addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-itoggle]");
  if (toggleBtn) {
    const next = toggleBtn.dataset.cur === "read" ? "new" : "read";
    await InquiryStore.updateStatus(toggleBtn.dataset.itoggle, next);
    showToast(next === "read" ? "既読にしました。" : "未読に戻しました。");
    updateInquiryBadge();
    renderInquiries();
    return;
  }
});

// 行の「詳細」→ 詳細モーダル（開いたら既読にする）
inquiryRows.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-idetail]");
  if (!btn) return;
  let inquiry = await InquiryStore.findById(btn.dataset.idetail);
  if (!inquiry) return;
  if (inquiry.status === "new") {
    inquiry = await InquiryStore.updateStatus(inquiry.id, "read");
    updateInquiryBadge();
  }
  openInquiryModal(inquiry);
  renderInquiries();
});

function openInquiryModal(inquiry) {
  document.getElementById("inquiryModalTitle").textContent = `${inquiry.name} さんからのお問い合わせ`;
  const subject = encodeURIComponent("【SATSUMA NOIR】お問い合わせありがとうございます");
  document.getElementById("inquiryDetail").innerHTML = `
    <dl class="order-meta">
      <div><dt>お名前</dt><dd>${escapeHtml(inquiry.name)}</dd></div>
      <div><dt>メール</dt><dd><a class="legal__link" href="mailto:${escapeHtml(inquiry.email)}?subject=${subject}">${escapeHtml(inquiry.email)}</a></dd></div>
      <div><dt>受信日時</dt><dd>${fmtDateTime(inquiry.createdAt)}</dd></div>
      <div><dt>状態</dt><dd>${inquiryBadge(inquiry.status)}</dd></div>
    </dl>
    <div class="inquiry-message">${escapeHtml(inquiry.message)}</div>`;

  inquiryToggleBtn.textContent = inquiry.status === "read" ? "未読に戻す" : "既読にする";
  inquiryToggleBtn.dataset.id = inquiry.id;
  inquiryToggleBtn.dataset.next = inquiry.status === "read" ? "new" : "read";
  inquiryDeleteBtn.dataset.id = inquiry.id;
  inquiryModal.hidden = false;
}
function closeInquiryModal() {
  inquiryModal.hidden = true;
}

inquiryToggleBtn.addEventListener("click", async () => {
  await InquiryStore.updateStatus(inquiryToggleBtn.dataset.id, inquiryToggleBtn.dataset.next);
  const updated = await InquiryStore.findById(inquiryToggleBtn.dataset.id);
  if (updated) openInquiryModal(updated);
  updateInquiryBadge();
  renderInquiries();
});

inquiryDeleteBtn.addEventListener("click", async () => {
  const inquiry = await InquiryStore.findById(inquiryDeleteBtn.dataset.id);
  if (inquiry && confirm(`「${inquiry.name}」さんのお問い合わせを削除しますか？`)) {
    await InquiryStore.remove(inquiry.id);
    showToast("お問い合わせを削除しました。");
    closeInquiryModal();
    updateInquiryBadge();
    renderInquiries();
  }
});

document.getElementById("inquiryCloseBtn").addEventListener("click", closeInquiryModal);
document.getElementById("inquiryModalOverlay").addEventListener("click", closeInquiryModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !inquiryModal.hidden) closeInquiryModal();
});

// ------------------------------------------------------------
//  NEWS管理
// ------------------------------------------------------------
const newsRows = document.getElementById("newsRows");
const newsModal = document.getElementById("newsModal");
const newsForm = document.getElementById("newsForm");
const NF = {
  id: document.getElementById("newsFieldId"),
  date: document.getElementById("newsFieldDate"),
  cat: document.getElementById("newsFieldCat"),
  title: document.getElementById("newsFieldTitle"),
  url: document.getElementById("newsFieldUrl"),
};

const dotDate = (d) => String(d ?? "").replace(/-/g, ".");

async function renderNews() {
  const items = await NewsStore.findAll();
  if (items.length === 0) {
    newsRows.innerHTML = `<tr><td colspan="5" class="admin-table__empty">お知らせがありません。「＋ お知らせを追加」から登録してください。</td></tr>`;
    return;
  }
  newsRows.innerHTML = items
    .map(
      (n) => `
    <tr>
      <td class="admin-nowrap" data-label="日付">${escapeHtml(dotDate(n.date))}</td>
      <td data-label="カテゴリ">${n.cat ? `<span class="admin-badge">${escapeHtml(n.cat)}</span>` : "—"}</td>
      <td data-label="タイトル">${escapeHtml(n.title)}</td>
      <td data-label="リンク">${n.url && n.url !== "#" ? escapeHtml(truncate(n.url, 28)) : "—"}</td>
      <td class="admin-table__ops">
        <button class="admin-op" data-nedit="${n.id}">編集</button>
        <button class="admin-op admin-op--danger" data-ndel="${n.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");
}

function openNewsModal(item) {
  document.getElementById("newsModalTitle").textContent = item ? "お知らせを編集" : "お知らせを追加";
  NF.id.value = item?.id ?? "";
  NF.date.value = item?.date ?? "";
  NF.cat.value = item?.cat ?? "";
  NF.title.value = item?.title ?? "";
  NF.url.value = item && item.url && item.url !== "#" ? item.url : "";
  newsModal.hidden = false;
}
function closeNewsModal() {
  newsModal.hidden = true;
  newsForm.reset();
}

document.getElementById("addNewsBtn").addEventListener("click", () => openNewsModal(null));
document.getElementById("newsCancelBtn").addEventListener("click", closeNewsModal);
document.getElementById("newsModalOverlay").addEventListener("click", closeNewsModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !newsModal.hidden) closeNewsModal();
});

newsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    date: NF.date.value,
    cat: NF.cat.value.trim(),
    title: NF.title.value.trim(),
    url: NF.url.value.trim() || "#",
  };
  if (!data.date || !data.cat || !data.title) {
    showToast("日付・カテゴリ・タイトルは必須です。");
    return;
  }
  try {
    const id = NF.id.value;
    if (id) {
      await NewsStore.update(id, data);
      showToast("お知らせを更新しました。");
    } else {
      await NewsStore.create(data);
      showToast("お知らせを追加しました。");
    }
    closeNewsModal();
    renderNews();
  } catch (err) {
    console.error("お知らせの保存に失敗しました:", err);
    showToast("保存に失敗しました。");
  }
});

newsRows.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-nedit]");
  const delBtn = e.target.closest("[data-ndel]");

  if (editBtn) {
    const item = await NewsStore.findById(editBtn.dataset.nedit);
    if (item) openNewsModal(item);
  }
  if (delBtn) {
    const item = await NewsStore.findById(delBtn.dataset.ndel);
    if (item && confirm(`「${item.title}」を削除しますか？`)) {
      await NewsStore.remove(item.id);
      showToast("お知らせを削除しました。");
      renderNews();
    }
  }
});

// ------------------------------------------------------------
//  JOURNAL管理
// ------------------------------------------------------------
const journalRows = document.getElementById("journalRows");
const journalModal = document.getElementById("journalModal");
const journalForm = document.getElementById("journalForm");
const JF = {
  id: document.getElementById("journalFieldId"),
  date: document.getElementById("journalFieldDate"),
  cat: document.getElementById("journalFieldCat"),
  title: document.getElementById("journalFieldTitle"),
  image: document.getElementById("journalFieldImage"),
  body: document.getElementById("journalFieldBody"),
};

async function renderJournal() {
  const items = await JournalStore.findAll();
  if (items.length === 0) {
    journalRows.innerHTML = `<tr><td colspan="5" class="admin-table__empty">記事がありません。「＋ 記事を追加」から登録してください。</td></tr>`;
    return;
  }
  journalRows.innerHTML = items
    .map(
      (n) => `
    <tr>
      <td class="admin-nowrap" data-label="日付">${escapeHtml(dotDate(n.date))}</td>
      <td data-label="カテゴリ">${n.cat ? `<span class="admin-badge">${escapeHtml(n.cat)}</span>` : "—"}</td>
      <td data-label="画像">${n.image ? `<img src="${escapeHtml(n.image)}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px;display:block;" />` : "—"}</td>
      <td data-label="タイトル">${escapeHtml(n.title)}</td>
      <td class="admin-table__ops">
        <button class="admin-op" data-jedit="${n.id}">編集</button>
        <button class="admin-op admin-op--danger" data-jdel="${n.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");
}

function openJournalModal(item) {
  document.getElementById("journalModalTitle").textContent = item ? "記事を編集" : "記事を追加";
  JF.id.value = item?.id ?? "";
  JF.date.value = item?.date ?? "";
  JF.cat.value = item?.cat ?? "";
  JF.title.value = item?.title ?? "";
  JF.image.value = item?.image ?? "";
  JF.body.value = item?.body ?? "";
  journalModal.hidden = false;
}
function closeJournalModal() {
  journalModal.hidden = true;
  journalForm.reset();
}

document.getElementById("addJournalBtn").addEventListener("click", () => openJournalModal(null));
document.getElementById("journalCancelBtn").addEventListener("click", closeJournalModal);
document.getElementById("journalModalOverlay").addEventListener("click", closeJournalModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !journalModal.hidden) closeJournalModal();
});

journalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    date: JF.date.value,
    cat: JF.cat.value.trim(),
    title: JF.title.value.trim(),
    image: JF.image.value.trim(),
    body: JF.body.value.trim(),
  };
  if (!data.date || !data.cat || !data.title) {
    showToast("日付・カテゴリ・タイトルは必須です。");
    return;
  }
  try {
    const id = JF.id.value;
    if (id) {
      await JournalStore.update(id, data);
      showToast("記事を更新しました。");
    } else {
      await JournalStore.create(data);
      showToast("記事を追加しました。");
    }
    closeJournalModal();
    renderJournal();
  } catch (err) {
    console.error("記事の保存に失敗しました:", err);
    showToast("保存に失敗しました。");
  }
});

journalRows.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-jedit]");
  const delBtn = e.target.closest("[data-jdel]");

  if (editBtn) {
    const item = await JournalStore.findById(editBtn.dataset.jedit);
    if (item) openJournalModal(item);
  }
  if (delBtn) {
    const item = await JournalStore.findById(delBtn.dataset.jdel);
    if (item && confirm(`「${item.title}」を削除しますか？`)) {
      await JournalStore.remove(item.id);
      showToast("記事を削除しました。");
      renderJournal();
    }
  }
});

// ------------------------------------------------------------
//  FAQ管理
// ------------------------------------------------------------
const faqRows = document.getElementById("faqRows");
const faqModal = document.getElementById("faqModal");
const faqForm = document.getElementById("faqForm");
const QF = {
  id: document.getElementById("faqFieldId"),
  q: document.getElementById("faqFieldQ"),
  a: document.getElementById("faqFieldA"),
};

const truncate = (s, n = 60) => {
  const str = String(s ?? "");
  return str.length > n ? str.slice(0, n) + "…" : str;
};

async function renderFaqs() {
  const faqs = await FaqStore.findAll();
  if (faqs.length === 0) {
    faqRows.innerHTML = `<tr><td colspan="4" class="admin-table__empty">FAQがありません。「＋ FAQを追加」から登録してください。</td></tr>`;
    return;
  }
  faqRows.innerHTML = faqs
    .map(
      (f, i) => `
    <tr>
      <td data-label="順">
        <div class="faq-order">
          <button class="admin-op faq-order__btn" data-fup="${f.id}" ${i === 0 ? "disabled" : ""} aria-label="上へ">↑</button>
          <button class="admin-op faq-order__btn" data-fdown="${f.id}" ${i === faqs.length - 1 ? "disabled" : ""} aria-label="下へ">↓</button>
        </div>
      </td>
      <td class="admin-nowrap" data-label="質問">${escapeHtml(f.q)}</td>
      <td data-label="回答">${escapeHtml(truncate(f.a))}</td>
      <td class="admin-table__ops">
        <button class="admin-op" data-fedit="${f.id}">編集</button>
        <button class="admin-op admin-op--danger" data-fdel="${f.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");
}

function openFaqModal(faq) {
  document.getElementById("faqModalTitle").textContent = faq ? "FAQを編集" : "FAQを追加";
  QF.id.value = faq?.id ?? "";
  QF.q.value = faq?.q ?? "";
  QF.a.value = faq?.a ?? "";
  faqModal.hidden = false;
}
function closeFaqModal() {
  faqModal.hidden = true;
  faqForm.reset();
}

document.getElementById("addFaqBtn").addEventListener("click", () => openFaqModal(null));
document.getElementById("faqCancelBtn").addEventListener("click", closeFaqModal);
document.getElementById("faqModalOverlay").addEventListener("click", closeFaqModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !faqModal.hidden) closeFaqModal();
});

faqForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = { q: QF.q.value.trim(), a: QF.a.value.trim() };
  if (!data.q || !data.a) {
    showToast("質問と回答は必須です。");
    return;
  }
  try {
    const id = QF.id.value;
    if (id) {
      await FaqStore.update(id, data);
      showToast("FAQを更新しました。");
    } else {
      await FaqStore.create(data);
      showToast("FAQを追加しました。");
    }
    closeFaqModal();
    renderFaqs();
  } catch (err) {
    console.error("FAQの保存に失敗しました:", err);
    showToast("保存に失敗しました。");
  }
});

faqRows.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-fedit]");
  const delBtn = e.target.closest("[data-fdel]");
  const upBtn = e.target.closest("[data-fup]");
  const downBtn = e.target.closest("[data-fdown]");

  if (editBtn) {
    const faq = await FaqStore.findById(editBtn.dataset.fedit);
    if (faq) openFaqModal(faq);
  }
  if (delBtn) {
    const faq = await FaqStore.findById(delBtn.dataset.fdel);
    if (faq && confirm(`「${faq.q}」を削除しますか？`)) {
      await FaqStore.remove(faq.id);
      showToast("FAQを削除しました。");
      renderFaqs();
    }
  }
  if (upBtn) {
    await FaqStore.move(upBtn.dataset.fup, -1);
    renderFaqs();
  }
  if (downBtn) {
    await FaqStore.move(downBtn.dataset.fdown, +1);
    renderFaqs();
  }
});

// ------------------------------------------------------------
//  採用情報 管理
// ------------------------------------------------------------
const recruitForm = document.getElementById("recruitForm");
const recruitPositionsEl = document.getElementById("recruitPositions");
const RF = {
  lead: document.getElementById("recruitLead"),
  body: document.getElementById("recruitBody"),
};

// 編集中の希望職種（再描画でも入力内容を保つため状態として持つ）
let recruitPositionsState = [];

function renderRecruitPositions() {
  if (recruitPositionsState.length === 0) {
    recruitPositionsEl.innerHTML = `<p class="dash-list__empty">職種がありません。「＋ 職種を追加」から追加してください。</p>`;
    return;
  }
  recruitPositionsEl.innerHTML = recruitPositionsState
    .map(
      (pos, i) => `
    <div class="cat-row">
      <input type="text" class="recruit-position__input" value="${escapeHtml(pos)}" placeholder="職種名" />
      <button type="button" class="admin-op admin-op--danger" data-posdel="${i}">削除</button>
    </div>`
    )
    .join("");
}

// DOM 上の入力内容を状態へ取り込む（追加/削除/保存の前に呼ぶ）
function syncRecruitPositionsFromDOM() {
  recruitPositionsState = Array.from(
    recruitPositionsEl.querySelectorAll(".recruit-position__input")
  ).map((el) => el.value);
}

async function renderRecruit() {
  const data = await RecruitStore.get();
  RF.lead.value = data.lead || "";
  RF.body.value = data.body || "";
  recruitPositionsState = Array.isArray(data.positions) ? data.positions.slice() : [];
  renderRecruitPositions();
}

document.getElementById("addPositionBtn").addEventListener("click", () => {
  syncRecruitPositionsFromDOM();
  recruitPositionsState.push("");
  renderRecruitPositions();
});

recruitPositionsEl.addEventListener("click", (e) => {
  const delBtn = e.target.closest("[data-posdel]");
  if (!delBtn) return;
  syncRecruitPositionsFromDOM();
  recruitPositionsState.splice(Number(delBtn.dataset.posdel), 1);
  renderRecruitPositions();
});

document.getElementById("recruitDiscardBtn").addEventListener("click", async () => {
  if (!confirm("編集中の変更を破棄して、最後に保存した内容に戻しますか？")) return;
  await renderRecruit();
  showToast("変更を破棄しました。");
});

recruitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  syncRecruitPositionsFromDOM();
  const positions = recruitPositionsState.map((p) => p.trim()).filter((p) => p);
  try {
    await RecruitStore.update({
      lead: RF.lead.value.trim(),
      body: RF.body.value.trim(),
      positions,
    });
    recruitPositionsState = positions;
    renderRecruitPositions();
    showToast("採用情報を保存しました。");
  } catch (err) {
    console.error("採用情報の保存に失敗しました:", err);
    showToast("保存に失敗しました。");
  }
});

// ------------------------------------------------------------
//  応募者管理
// ------------------------------------------------------------
const applicantRows = document.getElementById("applicantRows");
const applicantModal = document.getElementById("applicantModal");
const applicantToggleBtn = document.getElementById("applicantToggleBtn");
const applicantDeleteBtn = document.getElementById("applicantDeleteBtn");

let applicantFilterStatus = "all";

async function updateApplicantBadge() {
  const badge = document.getElementById("applicantBadge");
  if (!badge) return;
  const n = await ApplicantStore.countNew();
  badge.textContent = n;
  badge.hidden = n === 0;
}

async function renderApplicants() {
  const all = await ApplicantStore.findAll();
  const list = applicantFilterStatus === "all" ? all : all.filter((a) => a.status === applicantFilterStatus);

  if (list.length === 0) {
    applicantRows.innerHTML = `<tr><td colspan="6" class="admin-table__empty">該当する応募者はいません。</td></tr>`;
    return;
  }
  applicantRows.innerHTML = list
    .map(
      (a) => `
    <tr${a.status === "new" ? ' class="is-unread"' : ""}>
      <td data-label="応募日時">${fmtDateTime(a.createdAt)}</td>
      <td class="admin-nowrap" data-label="お名前">${escapeHtml(a.name)}</td>
      <td data-label="希望職種">${a.position ? `<span class="admin-badge">${escapeHtml(a.position)}</span>` : "—"}</td>
      <td data-label="メール">${escapeHtml(a.email)}</td>
      <td data-label="状態"><button type="button" class="admin-op" data-atoggle="${a.id}" data-cur="${a.status}" title="クリックで未読／既読を切り替え">${(INQUIRY_STATUS[a.status] || { label: a.status }).label}</button></td>
      <td class="admin-table__ops"><button class="admin-op" data-adetail="${a.id}">詳細</button></td>
    </tr>`
    )
    .join("");
}

// ステータス絞り込み
document.getElementById("applicantFilter").addEventListener("click", (e) => {
  const btn = e.target.closest(".order-filter__btn");
  if (!btn) return;
  document.querySelectorAll("#applicantFilter .order-filter__btn").forEach((b) => b.classList.remove("is-active"));
  btn.classList.add("is-active");
  applicantFilterStatus = btn.dataset.status;
  renderApplicants();
});

// 状態バッジ → クリックで未読⇄既読
applicantRows.addEventListener("click", async (e) => {
  const toggleBtn = e.target.closest("[data-atoggle]");
  if (toggleBtn) {
    const next = toggleBtn.dataset.cur === "read" ? "new" : "read";
    await ApplicantStore.updateStatus(toggleBtn.dataset.atoggle, next);
    showToast(next === "read" ? "既読にしました。" : "未読に戻しました。");
    updateApplicantBadge();
    renderApplicants();
    return;
  }
});

// 行の「詳細」→ 詳細モーダル（開いたら既読にする）
applicantRows.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-adetail]");
  if (!btn) return;
  let applicant = await ApplicantStore.findById(btn.dataset.adetail);
  if (!applicant) return;
  if (applicant.status === "new") {
    applicant = await ApplicantStore.updateStatus(applicant.id, "read");
    updateApplicantBadge();
  }
  openApplicantModal(applicant);
  renderApplicants();
});

function openApplicantModal(a) {
  document.getElementById("applicantModalTitle").textContent = `${a.name} さんの応募`;
  const subject = encodeURIComponent("【SATSUMA NOIR】ご応募ありがとうございます");
  document.getElementById("applicantDetail").innerHTML = `
    <dl class="order-meta">
      <div><dt>お名前</dt><dd>${escapeHtml(a.name)}${a.kana ? `（${escapeHtml(a.kana)}）` : ""}</dd></div>
      <div><dt>希望職種</dt><dd>${a.position ? escapeHtml(a.position) : "—"}</dd></div>
      <div><dt>メール</dt><dd><a class="legal__link" href="mailto:${escapeHtml(a.email)}?subject=${subject}">${escapeHtml(a.email)}</a></dd></div>
      <div><dt>電話</dt><dd>${a.phone ? escapeHtml(a.phone) : "—"}</dd></div>
      <div><dt>応募日時</dt><dd>${fmtDateTime(a.createdAt)}</dd></div>
      <div><dt>状態</dt><dd>${inquiryBadge(a.status)}</dd></div>
    </dl>`;

  applicantToggleBtn.textContent = a.status === "read" ? "未読に戻す" : "既読にする";
  applicantToggleBtn.dataset.id = a.id;
  applicantToggleBtn.dataset.next = a.status === "read" ? "new" : "read";
  applicantDeleteBtn.dataset.id = a.id;
  applicantModal.hidden = false;
}
function closeApplicantModal() {
  applicantModal.hidden = true;
}

applicantToggleBtn.addEventListener("click", async () => {
  await ApplicantStore.updateStatus(applicantToggleBtn.dataset.id, applicantToggleBtn.dataset.next);
  const updated = await ApplicantStore.findById(applicantToggleBtn.dataset.id);
  if (updated) openApplicantModal(updated);
  updateApplicantBadge();
  renderApplicants();
});

applicantDeleteBtn.addEventListener("click", async () => {
  const a = await ApplicantStore.findById(applicantDeleteBtn.dataset.id);
  if (a && confirm(`「${a.name}」さんの応募を削除しますか？`)) {
    await ApplicantStore.remove(a.id);
    showToast("応募を削除しました。");
    closeApplicantModal();
    updateApplicantBadge();
    renderApplicants();
  }
});

document.getElementById("applicantCloseBtn").addEventListener("click", closeApplicantModal);
document.getElementById("applicantModalOverlay").addEventListener("click", closeApplicantModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !applicantModal.hidden) closeApplicantModal();
});

// ------------------------------------------------------------
//  設定（SNSリンク）
// ------------------------------------------------------------
const settingsForm = document.getElementById("settingsForm");
const SF = {
  instagram: document.getElementById("setInstagram"),
  x: document.getElementById("setX"),
  note: document.getElementById("setNote"),
  aboutHeading: document.getElementById("setAboutHeading"),
  aboutBody: document.getElementById("setAboutBody"),
};

// トップページ各所の文章（id は "txt_" + 設定キー）。
const SITE_TEXT_KEYS = [
  "heroConceptLabel", "heroConceptHead", "heroConceptBody",
  "statementHead", "statementBody",
  "howtoEyebrow", "howtoTitle", "howtoRecommendText",
];

// メインビジュアル画像の編集状態（data URL。空なら既定画像）
const siteImages = { heroImage: "", statementImage: "", howtoImage1: "", howtoImage2: "", howtoImage3: "", aboutImage: "" };

// 画像アップロード欄を 1 セット分セットアップする汎用ヘルパー
function setupImageField(key, previewId, fileId, clearId) {
  const preview = document.getElementById(previewId);
  const fileInput = document.getElementById(fileId);
  const clearBtn = document.getElementById(clearId);

  const render = () => {
    const src = siteImages[key];
    preview.innerHTML = src
      ? `<img src="${src}" alt="プレビュー" />`
      : `<span class="img-upload__empty">初期画像</span>`;
  };

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("画像ファイルを選択してください。");
      return;
    }
    try {
      siteImages[key] = await uploadImageToStorage(file, "site-images", key, 1600, 0.82);
      render();
    } catch (err) {
      console.error("画像の処理に失敗しました:", err);
      showToast("画像の処理に失敗しました。");
    }
  });

  clearBtn.addEventListener("click", () => {
    siteImages[key] = "";
    fileInput.value = "";
    render();
  });

  return render;
}

const renderHeroPreview = setupImageField("heroImage", "heroPreview", "heroFile", "heroClear");
const renderStmtPreview = setupImageField("statementImage", "stmtPreview", "stmtFile", "stmtClear");
const renderHowto1Preview = setupImageField("howtoImage1", "howto1Preview", "howto1File", "howto1Clear");
const renderHowto2Preview = setupImageField("howtoImage2", "howto2Preview", "howto2File", "howto2Clear");
const renderHowto3Preview = setupImageField("howtoImage3", "howto3Preview", "howto3File", "howto3Clear");
const renderAboutPreview = setupImageField("aboutImage", "aboutPreview", "aboutFile", "aboutClear");

async function renderSettings() {
  const settings = await SettingsStore.get();
  SF.instagram.value = settings.instagramUrl || "";
  SF.x.value = settings.xUrl || "";
  SF.note.value = settings.noteUrl || "";
  SF.aboutHeading.value = settings.aboutHeading || "";
  SF.aboutBody.value = settings.aboutBody || "";
  SITE_TEXT_KEYS.forEach((key) => {
    const el = document.getElementById("txt_" + key);
    if (el) el.value = settings[key] || "";
  });
  siteImages.heroImage = settings.heroImage || "";
  siteImages.statementImage = settings.statementImage || "";
  siteImages.howtoImage1 = settings.howtoImage1 || "";
  siteImages.howtoImage2 = settings.howtoImage2 || "";
  siteImages.howtoImage3 = settings.howtoImage3 || "";
  siteImages.aboutImage = settings.aboutImage || "";
  renderHeroPreview();
  renderStmtPreview();
  renderHowto1Preview();
  renderHowto2Preview();
  renderHowto3Preview();
  renderAboutPreview();
}

// ------------------------------------------------------------
//  TOPICS 管理（コンテンツ：独立タブ）
// ------------------------------------------------------------
let topicsState = [];
const topicsEditor = document.getElementById("topicsEditor");

// タブ表示時に読み込んで描画
async function renderTopics() {
  topicsState = await TopicStore.getAll();
  renderTopicsEditor();
}

function renderTopicsEditor() {
  if (!topicsEditor) return;
  if (topicsState.length === 0) {
    topicsEditor.innerHTML = `<p class="dash-list__empty">カードがありません。「＋ カードを追加」から追加してください。</p>`;
    return;
  }
  topicsEditor.innerHTML = topicsState
    .map(
      (t, i) => `
    <div class="topic-edit" data-i="${i}">
      <div class="topic-edit__img">
        <div class="img-upload__preview topic-edit__preview">${
          t.image ? `<img src="${escapeHtml(t.image)}" alt="" />` : `<span class="img-upload__empty">画像なし</span>`
        }</div>
        <label class="img-upload__btn">画像を選択<input type="file" class="topic-edit__file" data-i="${i}" accept="image/*" hidden /></label>
      </div>
      <div class="topic-edit__fields">
        <input type="text" class="topic-edit__title" data-i="${i}" placeholder="タイトル" value="${escapeHtml(t.title)}" />
        <textarea class="topic-edit__desc" data-i="${i}" rows="2" placeholder="説明">${escapeHtml(t.desc)}</textarea>
      </div>
      <button type="button" class="admin-op admin-op--danger topic-edit__del" data-i="${i}">削除</button>
    </div>`
    )
    .join("");
}

// DOM の入力内容を状態へ取り込む（画像は state 側で保持）
function syncTopicsFromDOM() {
  if (!topicsEditor) return;
  topicsEditor.querySelectorAll(".topic-edit").forEach((row) => {
    const i = Number(row.dataset.i);
    if (!topicsState[i]) return;
    topicsState[i].title = row.querySelector(".topic-edit__title").value;
    topicsState[i].desc = row.querySelector(".topic-edit__desc").value;
  });
}

if (topicsEditor) {
  document.getElementById("addTopicBtn").addEventListener("click", () => {
    syncTopicsFromDOM();
    topicsState.push({ image: "", title: "", desc: "", url: "news.html" });
    renderTopicsEditor();
  });

  document.getElementById("saveTopicsBtn").addEventListener("click", async () => {
    try {
      syncTopicsFromDOM();
      await TopicStore.saveAll(topicsState);
      showToast("TOPICS を保存しました。");
    } catch (err) {
      console.error("TOPICS の保存に失敗しました:", err);
      const quota = err && (err.name === "QuotaExceededError" || /quota/i.test(err.message || ""));
      showToast(quota ? "保存容量が上限です。画像サイズを小さくしてください。" : "保存に失敗しました。");
    }
  });

  topicsEditor.addEventListener("click", (e) => {
    const del = e.target.closest(".topic-edit__del");
    if (!del) return;
    syncTopicsFromDOM();
    topicsState.splice(Number(del.dataset.i), 1);
    renderTopicsEditor();
  });

  topicsEditor.addEventListener("change", async (e) => {
    const file = e.target.closest(".topic-edit__file");
    if (!file || !file.files[0]) return;
    if (!file.files[0].type.startsWith("image/")) {
      showToast("画像ファイルを選択してください。");
      return;
    }
    try {
      syncTopicsFromDOM();
      const i = Number(file.dataset.i);
      topicsState[i].image = await compressImage(file.files[0], 1200, 0.82);
      renderTopicsEditor();
    } catch (err) {
      console.error("画像の処理に失敗しました:", err);
      showToast("画像の処理に失敗しました。");
    }
  });
}

// ------------------------------------------------------------
//  人気商品管理（コンテンツ：トップの Best Seller を選ぶ）
// ------------------------------------------------------------
const bestsellerEditor = document.getElementById("bestsellerEditor");
let bestsellerProducts = [];
let bestsellerIds = [];

async function renderBestseller() {
  bestsellerProducts = await ProductStore.findAll();
  // 既存の選択（削除済み商品は除外）
  const valid = new Set(bestsellerProducts.map((p) => p.id));
  bestsellerIds = (window.BestSellerStore ? BestSellerStore.getIds() : [])
    .map(Number)
    .filter((id) => valid.has(id));
  renderBestsellerEditor();
}

function renderBestsellerEditor() {
  if (!bestsellerEditor) return;
  const MAX = window.BestSellerStore ? BestSellerStore.MAX : 3;
  const byId = (id) => bestsellerProducts.find((p) => p.id === Number(id));

  // 選択済み（順位順）
  const selectedHtml = bestsellerIds.length
    ? bestsellerIds
        .map((id, i) => {
          const p = byId(id);
          if (!p) return "";
          const media = p.img
            ? `<img src="${escapeHtml(p.img)}" alt="" />`
            : `<span class="bestseller-rank__glyph">${escapeHtml(p.glyph || "🍰")}</span>`;
          return `
          <div class="bestseller-rank" data-id="${p.id}">
            <span class="bestseller-rank__no">${i + 1}</span>
            <span class="bestseller-rank__thumb">${media}</span>
            <span class="bestseller-rank__name">${escapeHtml(p.name)}</span>
            <span class="bestseller-rank__ops">
              <button type="button" class="admin-op" data-bs-up="${p.id}" ${i === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="admin-op" data-bs-down="${p.id}" ${i === bestsellerIds.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" class="admin-op admin-op--danger" data-bs-del="${p.id}">外す</button>
            </span>
          </div>`;
        })
        .join("")
    : `<p class="dash-list__empty">まだ選択されていません。下から商品を追加してください（未選択でも空き枠は自動補充されます）。</p>`;

  // 追加用セレクト（未選択の商品）
  const remaining = bestsellerProducts.filter((p) => !bestsellerIds.includes(p.id));
  const canAdd = bestsellerIds.length < MAX && remaining.length > 0;
  const options = remaining.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  const addHtml = canAdd
    ? `<div class="bestseller-add">
         <select class="dash-select" id="bestsellerAddSelect">${options}</select>
         <button type="button" class="btn btn--ghost btn--sm" id="bestsellerAddBtn">＋ 追加</button>
       </div>`
    : bestsellerIds.length >= MAX
      ? `<p class="settings-form__note">最大 ${MAX} 件まで選べます。入れ替えるには、いずれかを「外す」してください。</p>`
      : "";

  bestsellerEditor.innerHTML = `<div class="bestseller-list">${selectedHtml}</div>${addHtml}`;
}

if (bestsellerEditor) {
  bestsellerEditor.addEventListener("click", (e) => {
    const up = e.target.closest("[data-bs-up]");
    const down = e.target.closest("[data-bs-down]");
    const del = e.target.closest("[data-bs-del]");
    const add = e.target.closest("#bestsellerAddBtn");

    if (up) {
      const i = bestsellerIds.indexOf(Number(up.dataset.bsUp));
      if (i > 0) { [bestsellerIds[i - 1], bestsellerIds[i]] = [bestsellerIds[i], bestsellerIds[i - 1]]; renderBestsellerEditor(); }
    } else if (down) {
      const i = bestsellerIds.indexOf(Number(down.dataset.bsDown));
      if (i >= 0 && i < bestsellerIds.length - 1) { [bestsellerIds[i + 1], bestsellerIds[i]] = [bestsellerIds[i], bestsellerIds[i + 1]]; renderBestsellerEditor(); }
    } else if (del) {
      bestsellerIds = bestsellerIds.filter((id) => id !== Number(del.dataset.bsDel));
      renderBestsellerEditor();
    } else if (add) {
      const sel = document.getElementById("bestsellerAddSelect");
      const id = Number(sel && sel.value);
      const MAX = window.BestSellerStore ? BestSellerStore.MAX : 3;
      if (id && !bestsellerIds.includes(id) && bestsellerIds.length < MAX) {
        bestsellerIds.push(id);
        renderBestsellerEditor();
      }
    }
  });

  document.getElementById("saveBestsellerBtn").addEventListener("click", () => {
    try {
      BestSellerStore.saveIds(bestsellerIds);
      showToast("人気商品を保存しました。");
    } catch (err) {
      console.error("人気商品の保存に失敗しました:", err);
      showToast("保存に失敗しました。");
    }
  });
}

// ------------------------------------------------------------
//  店舗情報管理（複数店舗）
// ------------------------------------------------------------
const storeRows = document.getElementById("storeRows");
const storeModal = document.getElementById("storeModal");
const storeForm = document.getElementById("storeForm");
const STF = {
  id: document.getElementById("storeFieldId"),
  name: document.getElementById("storeName"),
  lead: document.getElementById("storeLead"),
  openDate: document.getElementById("storeOpenDate"),
  hours: document.getElementById("storeHours"),
  address: document.getElementById("storeAddress"),
};
let storeMapImage = "";
const storeMapPreview = document.getElementById("storeMapPreview");

function renderStoreMapPreview() {
  if (!storeMapPreview) return;
  storeMapPreview.innerHTML = storeMapImage
    ? `<img src="${storeMapImage}" alt="プレビュー" />`
    : `<span class="img-upload__empty">初期画像</span>`;
}

const firstLine = (s) => String(s || "").split("\n")[0] || "—";

async function renderStore() {
  if (typeof StoreStore === "undefined" || !storeRows) return;
  const stores = await StoreStore.getAll();
  if (stores.length === 0) {
    storeRows.innerHTML = `<tr><td colspan="4" class="admin-table__empty">店舗がありません。「＋ 店舗を追加」から登録してください。</td></tr>`;
    return;
  }
  storeRows.innerHTML = stores
    .map((s) => {
      const primary = Number(s.id) === StoreStore.PRIMARY_ID;
      return `
      <tr>
        <td data-label="店名">${escapeHtml(s.name)}${primary ? ` <span class="admin-badge">主店舗</span>` : ""}</td>
        <td data-label="住所">${escapeHtml(s.address || "—")}</td>
        <td data-label="営業時間">${escapeHtml(truncate(firstLine(s.hours), 18))}</td>
        <td class="admin-table__ops">
          <button class="admin-op" data-sedit="${s.id}">編集</button>
          ${primary ? "" : `<button class="admin-op admin-op--danger" data-sdel="${s.id}">削除</button>`}
        </td>
      </tr>`;
    })
    .join("");
}

function openStoreModal(item) {
  document.getElementById("storeModalTitle").textContent = item ? "店舗を編集" : "店舗を追加";
  STF.id.value = item?.id ?? "";
  STF.name.value = item?.name ?? "";
  STF.lead.value = item?.lead ?? "";
  STF.openDate.value = item?.openDate ?? "";
  STF.hours.value = item?.hours ?? "";
  STF.address.value = item?.address ?? "";
  storeMapImage = item?.mapImage ?? "";
  document.getElementById("storeMapFile").value = "";
  renderStoreMapPreview();
  storeModal.hidden = false;
}
function closeStoreModal() {
  storeModal.hidden = true;
  storeForm.reset();
}

if (storeForm) {
  document.getElementById("addStoreBtn").addEventListener("click", () => openStoreModal(null));
  document.getElementById("storeCancelBtn").addEventListener("click", closeStoreModal);
  document.getElementById("storeModalOverlay").addEventListener("click", closeStoreModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !storeModal.hidden) closeStoreModal();
  });

  const mapFile = document.getElementById("storeMapFile");
  document.getElementById("storeMapClear").addEventListener("click", () => {
    storeMapImage = "";
    mapFile.value = "";
    renderStoreMapPreview();
  });
  mapFile.addEventListener("change", async () => {
    const f = mapFile.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      showToast("画像ファイルを選択してください。");
      return;
    }
    try {
      storeMapImage = await uploadImageToStorage(f, "site-images", "stores", 1400, 0.82);
      renderStoreMapPreview();
    } catch (err) {
      console.error("画像の処理に失敗しました:", err);
      showToast("画像の処理に失敗しました。");
    }
  });

  storeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      name: STF.name.value.trim(),
      lead: STF.lead.value.trim(),
      openDate: STF.openDate.value.trim(),
      hours: STF.hours.value,
      address: STF.address.value.trim(),
      mapImage: storeMapImage,
    };
    if (!data.name) {
      showToast("店名は必須です。");
      return;
    }
    try {
      const id = STF.id.value;
      if (id) {
        await StoreStore.update(id, data);
        showToast("店舗を更新しました。");
      } else {
        await StoreStore.create(data);
        showToast("店舗を追加しました。");
      }
      closeStoreModal();
      renderStore();
    } catch (err) {
      console.error("店舗の保存に失敗しました:", err);
      const quota = err && (err.name === "QuotaExceededError" || /quota/i.test(err.message || ""));
      showToast(quota ? "保存容量が上限です。画像サイズを小さくしてください。" : "保存に失敗しました。");
    }
  });

  storeRows.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-sedit]");
    const delBtn = e.target.closest("[data-sdel]");
    if (editBtn) {
      const item = await StoreStore.findById(editBtn.dataset.sedit);
      if (item) openStoreModal(item);
    }
    if (delBtn) {
      const item = await StoreStore.findById(delBtn.dataset.sdel);
      if (item && confirm(`「${item.name}」を削除しますか？`)) {
        await StoreStore.remove(item.id);
        showToast("店舗を削除しました。");
        renderStore();
      }
    }
  });
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const siteText = {};
    SITE_TEXT_KEYS.forEach((key) => {
      const el = document.getElementById("txt_" + key);
      if (el) siteText[key] = el.value;
    });
    await SettingsStore.update({
      instagramUrl: SF.instagram.value.trim(),
      xUrl: SF.x.value.trim(),
      noteUrl: SF.note.value.trim(),
      heroImage: siteImages.heroImage,
      statementImage: siteImages.statementImage,
      howtoImage1: siteImages.howtoImage1,
      howtoImage2: siteImages.howtoImage2,
      howtoImage3: siteImages.howtoImage3,
      aboutImage: siteImages.aboutImage,
      aboutHeading: SF.aboutHeading.value.trim(),
      aboutBody: SF.aboutBody.value,
      ...siteText,
    });
    showToast("設定を保存しました。");
  } catch (err) {
    console.error("設定の保存に失敗しました:", err);
    const quota = err && (err.name === "QuotaExceededError" || /quota/i.test(err.message || ""));
    showToast(quota ? "保存容量が上限です。画像サイズを小さくしてください。" : "保存に失敗しました。");
  }
});

// ------------------------------------------------------------
//  商品一覧テーブル
// ------------------------------------------------------------
async function renderTable() {
  const products = await ProductStore.findAll();
  if (products.length === 0) {
    rows.innerHTML = `<tr><td colspan="8" class="admin-table__empty">商品がありません。「＋ 商品を追加」から登録してください。</td></tr>`;
    return;
  }
  rows.innerHTML = products
    .map(
      (p) => `
    <tr>
      <td data-label="ID">${p.id}</td>
      <td class="admin-table__thumb" data-label="画像">${
        p.img
          ? `<img src="${escapeHtml(p.img)}" alt="${escapeHtml(p.name)}" />`
          : `<span>${escapeHtml(p.glyph || "—")}</span>`
      }</td>
      <td data-label="商品名">${escapeHtml(p.name)}</td>
      <td data-label="カテゴリ"><span class="admin-badge">${escapeHtml(p.catLabel)}</span></td>
      <td data-label="価格">${yen(p.price)}</td>
      <td data-label="在庫">${stockCell(p.stock)}</td>
      <td data-label="タグ">${p.tag ? `<span class="admin-tag">${escapeHtml(p.tag)}</span>` : "—"}</td>
      <td class="admin-table__ops">
        <button class="admin-op" data-edit="${p.id}">編集</button>
        <button class="admin-op admin-op--danger" data-del="${p.id}">削除</button>
      </td>
    </tr>`
    )
    .join("");
}

// ------------------------------------------------------------
//  カテゴリ選択肢（ストアの定義から生成）
// ------------------------------------------------------------
function fillCategories() {
  catSelect.innerHTML = ProductStore.CATEGORIES.map(
    (c) => `<option value="${escapeHtml(c.value)}">${escapeHtml(c.label)}</option>`
  ).join("");
}

// ------------------------------------------------------------
//  カテゴリ管理（追加 / 削除）
// ------------------------------------------------------------
const categoryModal = document.getElementById("categoryModal");
const newCategoryInput = document.getElementById("newCategoryLabel");

function renderCategoryList() {
  const cats = ProductStore.CATEGORIES;
  const el = document.getElementById("categoryList");
  if (cats.length === 0) {
    el.innerHTML = `<p class="dash-list__empty">カテゴリがありません。下の欄から追加してください。</p>`;
    return;
  }
  el.innerHTML = cats
    .map(
      (c) => `
    <div class="cat-row">
      <span class="admin-badge">${escapeHtml(c.label)}</span>
      <button type="button" class="admin-op admin-op--danger" data-catdel="${escapeHtml(c.value)}">削除</button>
    </div>`
    )
    .join("");
}

function openCategoryModal() {
  renderCategoryList();
  categoryModal.hidden = false;
}
function closeCategoryModal() {
  categoryModal.hidden = true;
  newCategoryInput.value = "";
}

document.getElementById("manageCategoriesBtn").addEventListener("click", openCategoryModal);
document.getElementById("categoryCloseBtn").addEventListener("click", closeCategoryModal);
document.getElementById("categoryModalOverlay").addEventListener("click", closeCategoryModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !categoryModal.hidden) closeCategoryModal();
});

document.getElementById("addCategoryConfirm").addEventListener("click", async () => {
  const label = newCategoryInput.value.trim();
  if (!label) {
    showToast("カテゴリ名を入力してください。");
    return;
  }
  try {
    const created = await CategoryStore.create(label);
    if (!created) {
      showToast("同じ名前のカテゴリが既にあります。");
      return;
    }
    newCategoryInput.value = "";
    renderCategoryList();
    fillCategories();
    showToast("カテゴリを追加しました。");
  } catch (err) {
    console.error("カテゴリの追加に失敗しました:", err);
    showToast("追加に失敗しました。");
  }
});

// Supabase からカテゴリ取得（prime）が完了したら、UIを最新化する
window.addEventListener("categories:updated", () => {
  fillCategories();
  if (categoryModal && !categoryModal.hidden) renderCategoryList();
});

newCategoryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    document.getElementById("addCategoryConfirm").click();
  }
});

document.getElementById("categoryList").addEventListener("click", async (e) => {
  const delBtn = e.target.closest("[data-catdel]");
  if (!delBtn) return;
  const value = delBtn.dataset.catdel;
  const cat = ProductStore.CATEGORIES.find((c) => c.value === value);
  const name = cat ? cat.label : value;
  const products = await ProductStore.findAll();
  const used = products.filter((p) => p.cat === value).length;
  const msg =
    used > 0
      ? `「${name}」を削除しますか？このカテゴリには商品が ${used} 件あります（商品は残ります）。`
      : `「${name}」を削除しますか？`;
  if (!confirm(msg)) return;
  try {
    await CategoryStore.remove(value);
    renderCategoryList();
    fillCategories();
    renderTable();
    showToast("カテゴリを削除しました。");
  } catch (err) {
    console.error("カテゴリの削除に失敗しました:", err);
    showToast("削除に失敗しました。");
  }
});

// ------------------------------------------------------------
//  モーダル（追加 / 編集）
// ------------------------------------------------------------
function openModal(product) {
  modalTitle.textContent = product ? "商品を編集" : "商品を追加";
  F.id.value = product?.id ?? "";
  F.name.value = product?.name ?? "";
  F.cat.value = product?.cat ?? ProductStore.CATEGORIES[0]?.value ?? "";
  F.price.value = product?.price ?? "";
  F.stock.value = product?.stock ?? 0;
  F.tag.value = product?.tag ?? "";
  F.img.value = product?.img ?? "";
  F.desc.value = product?.desc ?? "";
  F.featureHead.value = product?.featureHead ?? "";
  F.featureBody.value = product?.featureBody ?? "";
  F.featureImage.value = product?.featureImage ?? "";
  F.specSize.value = product?.specSize ?? "";
  F.specExpiry.value = product?.specExpiry ?? "";
  F.specIngredients.value = product?.specIngredients ?? "";
  F.notes.value = product?.notes ?? "";
  productGallery = Array.isArray(product?.gallery) ? [...product.gallery] : [];
  renderImgPreview();
  renderFeatureImgPreview();
  renderGalleryEditor();
  modal.hidden = false;
}
function closeModal() {
  modal.hidden = true;
  form.reset();
}

// ---- 画像アップロード（ブラウザ内で縮小して data URL 化）----
const imgPreview = document.getElementById("imgPreview");
const imgFileInput = document.getElementById("fieldImgFile");
const imgClearBtn = document.getElementById("imgClearBtn");

function renderImgPreview() {
  const src = F.img.value;
  imgPreview.innerHTML = src
    ? `<img src="${src}" alt="プレビュー" />`
    : `<span class="img-upload__empty">画像なし</span>`;
}

// 画像を最大辺 maxSize px に縮小し、JPEG(data URL)へ変換
function compressImage(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("画像の解析に失敗しました"));
      image.onload = () => {
        let { width, height } = image;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [meta, body] = dataUrl.split(",");
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadImageToStorage(file, bucket, folder, maxSize = 1200, quality = 0.82) {
  const dataUrl = await compressImage(file, maxSize, quality);
  if (!window.sb || !sb.storage) return dataUrl;
  const blob = dataUrlToBlob(dataUrl);
  const safeName = String(file.name || "image").replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName.replace(/\.[^.]+$/, "")}.jpg`;
  const { error } = await sb.storage.from(bucket).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

imgFileInput.addEventListener("change", async () => {
  const file = imgFileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("画像ファイルを選択してください。");
    return;
  }
  try {
    F.img.value = await uploadImageToStorage(file, "product-images", "products", 900, 0.82);
    renderImgPreview();
  } catch (err) {
    console.error("画像の処理に失敗しました:", err);
    showToast("画像の処理に失敗しました。");
  }
});

imgClearBtn.addEventListener("click", () => {
  F.img.value = "";
  imgFileInput.value = "";
  renderImgPreview();
});

// ---- 特集セクションの画像（商品詳細ページ用）----
const featureImgPreview = document.getElementById("featureImgPreview");
const featureImgFile = document.getElementById("fieldFeatureImgFile");
const featureImgClear = document.getElementById("featureImgClear");

function renderFeatureImgPreview() {
  if (!featureImgPreview) return;
  const src = F.featureImage.value;
  featureImgPreview.innerHTML = src
    ? `<img src="${src}" alt="プレビュー" />`
    : `<span class="img-upload__empty">メイン画像</span>`;
}

if (featureImgFile) {
  featureImgFile.addEventListener("change", async () => {
    const file = featureImgFile.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("画像ファイルを選択してください。");
      return;
    }
    try {
      F.featureImage.value = await uploadImageToStorage(file, "product-images", "features", 1400, 0.82);
      renderFeatureImgPreview();
    } catch (err) {
      console.error("画像の処理に失敗しました:", err);
      showToast("画像の処理に失敗しました。");
    }
  });
  featureImgClear.addEventListener("click", () => {
    F.featureImage.value = "";
    featureImgFile.value = "";
    renderFeatureImgPreview();
  });
}

// ---- 追加画像ギャラリー（商品詳細ページ用）----
let productGallery = [];
const galleryEditor = document.getElementById("galleryEditor");
const galleryFileInput = document.getElementById("fieldGalleryFile");

function renderGalleryEditor() {
  if (!galleryEditor) return;
  galleryEditor.innerHTML = productGallery.length
    ? productGallery
        .map(
          (src, i) => `
        <div class="gallery-thumb">
          <img src="${src}" alt="追加画像${i + 1}" />
          <button type="button" class="gallery-thumb__del" data-gdel="${i}" aria-label="削除">×</button>
        </div>`
        )
        .join("")
    : `<p class="img-upload__hint">追加画像はありません。</p>`;
}

if (galleryEditor) {
  galleryFileInput.addEventListener("change", async () => {
    const files = Array.from(galleryFileInput.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    try {
      for (const f of files) {
        productGallery.push(await uploadImageToStorage(f, "product-images", "gallery", 1200, 0.82));
      }
      renderGalleryEditor();
    } catch (err) {
      console.error("画像の処理に失敗しました:", err);
      showToast("画像の処理に失敗しました。");
    }
    galleryFileInput.value = "";
  });

  galleryEditor.addEventListener("click", (e) => {
    const del = e.target.closest("[data-gdel]");
    if (!del) return;
    productGallery.splice(Number(del.dataset.gdel), 1);
    renderGalleryEditor();
  });
}

addBtn.addEventListener("click", () => openModal(null));
cancelBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: F.name.value.trim(),
    cat: F.cat.value,
    price: Number(F.price.value),
    stock: Number(F.stock.value),
    tag: F.tag.value.trim(),
    img: F.img.value.trim(),
    desc: F.desc.value.trim(),
    featureHead: F.featureHead.value.trim(),
    featureBody: F.featureBody.value.trim(),
    specSize: F.specSize.value.trim(),
    specExpiry: F.specExpiry.value.trim(),
    specIngredients: F.specIngredients.value.trim(),
    notes: F.notes.value.trim(),
    featureImage: F.featureImage.value.trim(),
    gallery: [...productGallery],
  };
  if (!data.name || Number.isNaN(data.price) || Number.isNaN(data.stock)) {
    showToast("商品名・価格・在庫数は必須です。");
    return;
  }
  try {
    const id = F.id.value;
    if (id) {
      await ProductStore.update(id, data);
      showToast("商品を更新しました。");
    } else {
      await ProductStore.create(data);
      showToast("商品を追加しました。");
    }
    closeModal();
    renderTable();
    renderDashboard();
  } catch (err) {
    console.error("保存に失敗しました:", err);
    const quota = err && (err.name === "QuotaExceededError" || /quota/i.test(err.message || ""));
    showToast(quota ? "保存容量が上限です。画像サイズを小さくしてください。" : "保存に失敗しました。");
  }
});

// ------------------------------------------------------------
//  行内の編集 / 削除
// ------------------------------------------------------------
rows.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit]");
  const delBtn = e.target.closest("[data-del]");

  if (editBtn) {
    const product = await ProductStore.findById(editBtn.dataset.edit);
    if (product) openModal(product);
  }
  if (delBtn) {
    const id = delBtn.dataset.del;
    const product = await ProductStore.findById(id);
    if (product && confirm(`「${product.name}」を削除しますか？`)) {
      await ProductStore.remove(id);
      showToast("商品を削除しました。");
      renderTable();
      renderDashboard();
    }
  }
});

// ------------------------------------------------------------
//  トースト
// ------------------------------------------------------------
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-show"), 2400);
}

// ------------------------------------------------------------
//  Init
// ------------------------------------------------------------
fillCategories();
showGate(); // 認証チェック中はゲートを表示
(async () => {
  if (await AdminAuth.isAuthed()) showPanel();
})();
