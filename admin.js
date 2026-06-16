// ============================================================
//  Admin controller
//  ------------------------------------------------------------
//  データ操作は ProductStore（store.js）経由のみ。
//  バックエンド導入時は store.js と、下の AdminAuth を
//  本物の認証に差し替えるだけで動く。
// ============================================================

// ---- 管理者認証（Supabase Auth ＋ role=admin で認可）----
//  auth.js（window.Auth）を利用。ログイン後に profiles.role が admin か検証し、
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
const TAB_TITLES = { dashboard: "ダッシュボード", orders: "注文管理", customers: "顧客管理", members: "会員管理", products: "商品管理", inquiries: "お問い合わせ", news: "NEWS管理", faq: "FAQ管理", privacy: "プライバシーポリシー", tokushoho: "特定商取引法に基づく表示", recruit: "採用情報管理", applicants: "応募者管理", settings: "設定" };
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
  if (name === "faq") renderFaqs();
  if (name === "privacy") renderPrivacy();
  if (name === "tokushoho") renderTokushoho();
  if (name === "recruit") renderRecruit();
  if (name === "applicants") renderApplicants();
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
const salesFrom = document.getElementById("salesFrom");
const salesTo = document.getElementById("salesTo");

const todayStr = () => {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// 売上カードを指定された日付範囲で更新
async function renderSalesCard() {
  // 初回は当月初〜今日を既定にする
  if (!salesFrom.value && !salesTo.value) {
    salesTo.value = todayStr();
    const d = new Date();
    salesFrom.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const { sales, count } = await OrderStore.getSalesByDateRange(salesFrom.value, salesTo.value);
  document.getElementById("statSales").textContent = yen(sales);
  document.getElementById("statSalesSub").textContent = `${count} 件`;
}

salesFrom.addEventListener("change", renderSalesCard);
salesTo.addEventListener("change", renderSalesCard);

async function renderDashboard() {
  const [stats, alerts, orders] = await Promise.all([
    OrderStore.getDashboardStats(),
    ProductStore.findStockAlerts(),
    OrderStore.findAll(),
  ]);

  // 売上カード（期間選択に対応）
  renderSalesCard();

  // 統計カード
  document.getElementById("statUnshipped").textContent = stats.unshippedCount;
  document.getElementById("statAlerts").textContent = alerts.length;
  document.getElementById("alertCard").classList.toggle("is-warn", alerts.length > 0);

  // 在庫アラート一覧
  const stockList = document.getElementById("stockAlertList");
  if (alerts.length === 0) {
    stockList.innerHTML = `<p class="dash-list__empty">在庫切れ・残りわずかの商品はありません。</p>`;
  } else {
    stockList.innerHTML = alerts
      .map(
        (p) => `
      <div class="dash-row">
        <span class="dash-row__main">${escapeHtml(p.name)}</span>
        <span>${stockCell(p.stock)}</span>
      </div>`
      )
      .join("");
  }

  // 未発送の注文一覧
  const unshipped = orders.filter((o) => o.status === "unshipped");
  const list = document.getElementById("unshippedList");
  if (unshipped.length === 0) {
    list.innerHTML = `<p class="dash-list__empty">未発送の注文はありません。</p>`;
  } else {
    list.innerHTML = unshipped
      .map(
        (o) => `
      <div class="dash-row">
        <span class="dash-row__main">#${o.id} ${escapeHtml(o.customer)}</span>
        <span class="dash-row__meta">${fmtDateTime(o.createdAt)} ・ ${yen(o.total)}</span>
        <button class="admin-op" data-ship="${o.id}">発送済みにする</button>
      </div>`
      )
      .join("");
  }
}

// 未発送注文の「発送済みにする」
document.getElementById("unshippedList").addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-ship]");
  if (!btn) return;
  if (!confirm(`注文 #${btn.dataset.ship} を発送済みにしますか？`)) return;
  await OrderStore.updateStatus(btn.dataset.ship, "shipped");
  showToast("発送済みにしました。");
  renderDashboard();
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
//  会員管理（Supabase Auth ユーザーの role 変更）
//  profiles を一覧し、admin/member を切り替える。
//  RLS の「Profiles admin all」により管理者のみ更新可。
// ------------------------------------------------------------
const memberRows = document.getElementById("memberRows");

async function renderMembers() {
  if (!memberRows) return;
  if (!window.sb) {
    memberRows.innerHTML = `<tr><td colspan="5" class="admin-table__empty">Supabase に接続していません。</td></tr>`;
    return;
  }
  const [{ data: rows, error }, me] = await Promise.all([
    sb.from("profiles").select("id, email, name, role, created_at").order("created_at", { ascending: false }),
    window.Auth ? Auth.getUser() : Promise.resolve(null),
  ]);
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
      const isSelf = m.id === myId;
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
    const { error } = await sb.from("profiles").update({ role: next }).eq("id", btn.dataset.mrole);
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
//  プライバシーポリシー管理
// ------------------------------------------------------------
const privacyForm = document.getElementById("privacyForm");
const privacyLead = document.getElementById("privacyLead");
const privacyDate = document.getElementById("privacyDate");
const privacyBlocksEl = document.getElementById("privacyBlocks");

// 編集中の項目（{ heading, text }）。再描画でも入力内容を保つため状態として持つ。
let privacyBlocksState = [];

function renderPrivacyBlocks() {
  if (privacyBlocksState.length === 0) {
    privacyBlocksEl.innerHTML = `<p class="dash-list__empty">項目がありません。「＋ 項目を追加」から追加してください。</p>`;
    return;
  }
  privacyBlocksEl.innerHTML = privacyBlocksState
    .map(
      (b, i) => `
    <div class="privacy-block">
      <div class="privacy-block__head">
        <span class="privacy-block__num">${i + 1}</span>
        <div class="privacy-block__ops">
          <button type="button" class="admin-op faq-order__btn" data-pup="${i}" ${i === 0 ? "disabled" : ""} aria-label="上へ">↑</button>
          <button type="button" class="admin-op faq-order__btn" data-pdown="${i}" ${i === privacyBlocksState.length - 1 ? "disabled" : ""} aria-label="下へ">↓</button>
          <button type="button" class="admin-op admin-op--danger" data-pdel="${i}">削除</button>
        </div>
      </div>
      <label class="field"><span>見出し</span><input type="text" class="privacy-block__heading" value="${escapeHtml(b.heading)}" /></label>
      <label class="field"><span>本文</span><textarea class="privacy-block__text" rows="3">${escapeHtml(b.text)}</textarea></label>
    </div>`
    )
    .join("");
}

// DOM 上の入力内容を状態へ取り込む（追加/削除/並べ替え/保存の前に呼ぶ）
function syncPrivacyBlocksFromDOM() {
  privacyBlocksState = Array.from(privacyBlocksEl.querySelectorAll(".privacy-block")).map((el) => ({
    heading: el.querySelector(".privacy-block__heading").value,
    text: el.querySelector(".privacy-block__text").value,
  }));
}

async function renderPrivacy() {
  const policy = await PrivacyStore.get();
  privacyLead.value = policy.lead || "";
  privacyDate.value = policy.date || "";
  privacyBlocksState = (policy.blocks || []).map((b) => ({ heading: b.heading || "", text: b.text || "" }));
  renderPrivacyBlocks();
}

document.getElementById("addPrivacyBlockBtn").addEventListener("click", () => {
  syncPrivacyBlocksFromDOM();
  privacyBlocksState.push({ heading: "", text: "" });
  renderPrivacyBlocks();
});

privacyBlocksEl.addEventListener("click", (e) => {
  const upBtn = e.target.closest("[data-pup]");
  const downBtn = e.target.closest("[data-pdown]");
  const delBtn = e.target.closest("[data-pdel]");
  if (!upBtn && !downBtn && !delBtn) return;

  syncPrivacyBlocksFromDOM();
  if (upBtn) {
    const i = Number(upBtn.dataset.pup);
    [privacyBlocksState[i - 1], privacyBlocksState[i]] = [privacyBlocksState[i], privacyBlocksState[i - 1]];
  }
  if (downBtn) {
    const i = Number(downBtn.dataset.pdown);
    [privacyBlocksState[i + 1], privacyBlocksState[i]] = [privacyBlocksState[i], privacyBlocksState[i + 1]];
  }
  if (delBtn) {
    privacyBlocksState.splice(Number(delBtn.dataset.pdel), 1);
  }
  renderPrivacyBlocks();
});

document.getElementById("privacyDiscardBtn").addEventListener("click", async () => {
  if (!confirm("編集中の変更を破棄して、最後に保存した内容に戻しますか？")) return;
  await renderPrivacy();
  showToast("変更を破棄しました。");
});

privacyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  syncPrivacyBlocksFromDOM();
  const blocks = privacyBlocksState
    .map((b) => ({ heading: b.heading.trim(), text: b.text.trim() }))
    .filter((b) => b.heading || b.text);
  try {
    await PrivacyStore.update({
      lead: privacyLead.value.trim(),
      blocks,
      date: privacyDate.value.trim(),
    });
    privacyBlocksState = blocks;
    renderPrivacyBlocks();
    showToast("プライバシーポリシーを保存しました。");
  } catch (err) {
    console.error("プライバシーポリシーの保存に失敗しました:", err);
    showToast("保存に失敗しました。");
  }
});

// ------------------------------------------------------------
//  特定商取引法に基づく表示 管理
// ------------------------------------------------------------
const tokushohoForm = document.getElementById("tokushohoForm");
const tokushohoLead = document.getElementById("tokushohoLead");
const tokushohoDate = document.getElementById("tokushohoDate");
const tokushohoRowsEl = document.getElementById("tokushohoRows");

// 編集中の項目（{ term, value }）。再描画でも入力内容を保つため状態として持つ。
let tokushohoRowsState = [];

function renderTokushohoRows() {
  if (tokushohoRowsState.length === 0) {
    tokushohoRowsEl.innerHTML = `<p class="dash-list__empty">項目がありません。「＋ 項目を追加」から追加してください。</p>`;
    return;
  }
  tokushohoRowsEl.innerHTML = tokushohoRowsState
    .map(
      (r, i) => `
    <div class="privacy-block">
      <div class="privacy-block__head">
        <span class="privacy-block__num">${i + 1}</span>
        <div class="privacy-block__ops">
          <button type="button" class="admin-op faq-order__btn" data-tup="${i}" ${i === 0 ? "disabled" : ""} aria-label="上へ">↑</button>
          <button type="button" class="admin-op faq-order__btn" data-tdown="${i}" ${i === tokushohoRowsState.length - 1 ? "disabled" : ""} aria-label="下へ">↓</button>
          <button type="button" class="admin-op admin-op--danger" data-tdel="${i}">削除</button>
        </div>
      </div>
      <label class="field"><span>項目名</span><input type="text" class="tokusho-row__term" value="${escapeHtml(r.term)}" /></label>
      <label class="field"><span>内容（改行可）</span><textarea class="tokusho-row__value" rows="2">${escapeHtml(r.value)}</textarea></label>
    </div>`
    )
    .join("");
}

// DOM 上の入力内容を状態へ取り込む（追加/削除/並べ替え/保存の前に呼ぶ）
function syncTokushohoRowsFromDOM() {
  tokushohoRowsState = Array.from(tokushohoRowsEl.querySelectorAll(".privacy-block")).map((el) => ({
    term: el.querySelector(".tokusho-row__term").value,
    value: el.querySelector(".tokusho-row__value").value,
  }));
}

async function renderTokushoho() {
  const data = await TokushohoStore.get();
  tokushohoLead.value = data.lead || "";
  tokushohoDate.value = data.date || "";
  tokushohoRowsState = (data.rows || []).map((r) => ({ term: r.term || "", value: r.value || "" }));
  renderTokushohoRows();
}

document.getElementById("addTokushohoRowBtn").addEventListener("click", () => {
  syncTokushohoRowsFromDOM();
  tokushohoRowsState.push({ term: "", value: "" });
  renderTokushohoRows();
});

tokushohoRowsEl.addEventListener("click", (e) => {
  const upBtn = e.target.closest("[data-tup]");
  const downBtn = e.target.closest("[data-tdown]");
  const delBtn = e.target.closest("[data-tdel]");
  if (!upBtn && !downBtn && !delBtn) return;

  syncTokushohoRowsFromDOM();
  if (upBtn) {
    const i = Number(upBtn.dataset.tup);
    [tokushohoRowsState[i - 1], tokushohoRowsState[i]] = [tokushohoRowsState[i], tokushohoRowsState[i - 1]];
  }
  if (downBtn) {
    const i = Number(downBtn.dataset.tdown);
    [tokushohoRowsState[i + 1], tokushohoRowsState[i]] = [tokushohoRowsState[i], tokushohoRowsState[i + 1]];
  }
  if (delBtn) {
    tokushohoRowsState.splice(Number(delBtn.dataset.tdel), 1);
  }
  renderTokushohoRows();
});

document.getElementById("tokushohoDiscardBtn").addEventListener("click", async () => {
  if (!confirm("編集中の変更を破棄して、最後に保存した内容に戻しますか？")) return;
  await renderTokushoho();
  showToast("変更を破棄しました。");
});

tokushohoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  syncTokushohoRowsFromDOM();
  const rows = tokushohoRowsState
    .map((r) => ({ term: r.term.trim(), value: r.value.trim() }))
    .filter((r) => r.term || r.value);
  try {
    await TokushohoStore.update({
      lead: tokushohoLead.value.trim(),
      rows,
      date: tokushohoDate.value.trim(),
    });
    tokushohoRowsState = rows;
    renderTokushohoRows();
    showToast("特定商取引法の表示を保存しました。");
  } catch (err) {
    console.error("特定商取引法の表示の保存に失敗しました:", err);
    showToast("保存に失敗しました。");
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
const siteImages = { heroImage: "", statementImage: "", howtoImage1: "", howtoImage2: "", howtoImage3: "" };

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
      siteImages[key] = await compressImage(file, 1600, 0.82);
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
  renderHeroPreview();
  renderStmtPreview();
  renderHowto1Preview();
  renderHowto2Preview();
  renderHowto3Preview();
  topicsState = await TopicStore.getAll();
  renderTopicsEditor();
}

// ------------------------------------------------------------
//  TOPICS カード編集（設定タブ内）
// ------------------------------------------------------------
let topicsState = [];
const topicsEditor = document.getElementById("topicsEditor");

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
      aboutHeading: SF.aboutHeading.value.trim(),
      aboutBody: SF.aboutBody.value,
      ...siteText,
    });
    syncTopicsFromDOM();
    await TopicStore.saveAll(topicsState);
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
  renderImgPreview();
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

imgFileInput.addEventListener("change", async () => {
  const file = imgFileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("画像ファイルを選択してください。");
    return;
  }
  try {
    F.img.value = await compressImage(file);
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
