// ============================================================
//  Admin controller
//  ------------------------------------------------------------
//  データ操作は ProductStore（store.js）経由のみ。
//  バックエンド導入時は store.js と、下の AdminAuth を
//  本物の認証に差し替えるだけで動く。
// ============================================================

// ---- 簡易認証（※プレースホルダ。本番では使わないこと）----
// 後でサーバ側のログインAPIに置き換える前提。
const AdminAuth = {
  // デモ用パスワード。実運用ではクライアントに置かない。
  PASSWORD: "admin",
  KEY: "satsuma_admin_authed",

  isAuthed() {
    return sessionStorage.getItem(this.KEY) === "1";
  },
  login(password) {
    if (password === this.PASSWORD) {
      sessionStorage.setItem(this.KEY, "1");
      return true;
    }
    return false;
  },
  logout() {
    sessionStorage.removeItem(this.KEY);
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
  glyph: document.getElementById("fieldGlyph"),
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
}

// ------------------------------------------------------------
//  タブ切り替え
// ------------------------------------------------------------
const TAB_TITLES = { dashboard: "ダッシュボード", orders: "注文管理", customers: "顧客管理", products: "商品管理", settings: "設定" };
function switchTab(name) {
  tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  views.forEach((v) => (v.hidden = v.dataset.view !== name));
  const title = document.getElementById("adminPageTitle");
  if (title) title.textContent = TAB_TITLES[name] || "";
  if (name === "dashboard") renderDashboard();
  if (name === "orders") renderOrders();
  if (name === "customers") renderCustomers();
  if (name === "settings") renderSettings();
}
tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (AdminAuth.login(passwordInput.value)) {
    loginError.hidden = true;
    passwordInput.value = "";
    showPanel();
  } else {
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener("click", () => {
  AdminAuth.logout();
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
    showToast("保存に失敗しました。");
  }
});

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
//  設定（SNSリンク）
// ------------------------------------------------------------
const settingsForm = document.getElementById("settingsForm");
const SF = {
  instagram: document.getElementById("setInstagram"),
  x: document.getElementById("setX"),
  note: document.getElementById("setNote"),
};

// メインビジュアル画像の編集状態（data URL。空なら既定画像）
const siteImages = { heroImage: "", statementImage: "" };

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

async function renderSettings() {
  const settings = await SettingsStore.get();
  SF.instagram.value = settings.instagramUrl || "";
  SF.x.value = settings.xUrl || "";
  SF.note.value = settings.noteUrl || "";
  siteImages.heroImage = settings.heroImage || "";
  siteImages.statementImage = settings.statementImage || "";
  renderHeroPreview();
  renderStmtPreview();
}

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await SettingsStore.update({
      instagramUrl: SF.instagram.value.trim(),
      xUrl: SF.x.value.trim(),
      noteUrl: SF.note.value.trim(),
      heroImage: siteImages.heroImage,
      statementImage: siteImages.statementImage,
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
    (c) => `<option value="${c.value}">${c.label}</option>`
  ).join("");
}

// ------------------------------------------------------------
//  モーダル（追加 / 編集）
// ------------------------------------------------------------
function openModal(product) {
  modalTitle.textContent = product ? "商品を編集" : "商品を追加";
  F.id.value = product?.id ?? "";
  F.name.value = product?.name ?? "";
  F.cat.value = product?.cat ?? ProductStore.CATEGORIES[0].value;
  F.price.value = product?.price ?? "";
  F.stock.value = product?.stock ?? 0;
  F.tag.value = product?.tag ?? "";
  F.glyph.value = product?.glyph ?? "";
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
    glyph: F.glyph.value.trim(),
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
if (AdminAuth.isAuthed()) {
  showPanel();
} else {
  showGate();
}
