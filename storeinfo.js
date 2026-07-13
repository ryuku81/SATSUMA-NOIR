// ============================================================
//  Data Access Layer — StoreStore（複数店舗対応）
//  ------------------------------------------------------------
//  店舗情報を「店舗の配列」として保存・取得する層。
//  店舗オブジェクト: { id, name, lead, openDate, hours, address, mapImage, ...store detail fields }
//    hours は改行で複数行（公開側で <br> に変換）。
//    mapImage は空なら HTML 既定の地図画像を使う。
//
//  公開側:
//    - store-terukuni.html（照国本店）は「主店舗 = id 1」を表示。
//    - store-detail.html?id=N は任意の店舗を表示（汎用ページ）。
//
//  ※ 現状は localStorage 保存（この端末・ブラウザ内）。
//    サーバー共有にする場合は Supabase 等に差し替え可能。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_stores";
  const SEED_VERSION = "1";
  const VERSION_KEY = "satsuma_stores_version";
  const PRIMARY_ID = 1; // 照国本店（store-terukuni.html が参照する主店舗）
  const DEFAULT_REGULAR_ITEMS = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
  const STORE_DEFAULTS = {
    heroImage1: "images/terukuni-store.jpg",
    heroImage2: "images/noir-tablette.png",
    detailImage: "images/terukuni-store.jpg",
    limitedName: "焼きたて NOIR BAKED CHEESECAKE",
    limitedDesc: "店内で焼き上げた、出来立てのひとくちチーズケーキ「NOIR BAKED CHEESECAKE」をご用意。毎週 金曜日・土曜日・日曜日 13:00 の焼き上がりです。",
    limitedImage: "images/baked-cheesecake.png",
    limitedProduct: "Original",
    limitedPrice: "¥459/個（税込）",
    regularBrand: "SATSUMA NOIR",
    regularDesc: "温度によって変化する味わいと香りを楽しめる、レストランデザートのようなチーズケーキ。",
    regularItems: DEFAULT_REGULAR_ITEMS,
  };

  const SEED = [
    {
      id: 1,
      name: "照国本店",
      lead:
        "照国神社のほど近く、静かな路地にひっそりと佇む工房兼ショップ。もちろん、店頭でのご購入もいただけますが、ここではエスプレッソやお茶とともに、焼きたて・解凍したての一皿をその場で味わえる小さなカフェスペースを設えています。職人がひとつひとつ手仕事で仕上げる“熟成冷凍”チーズケーキを、いちばんの食べごろでお楽しみいただける場所です。",
      openDate: "2025年4月1日（火）",
      hours:
        "11:00〜19:00\n※カフェ営業時間\n平日 11:30〜18:30（L.O.18:00）\n土日 11:00〜18:30（L.O.18:00）\n※店頭販売は売り切れ次第終了となります",
      address: "〒892-0841 鹿児島県鹿児島市照国町14-15",
      mapImage: "",
      ...STORE_DEFAULTS,
    },
  ];

  function normalizeStore(store) {
    const regularItems = Array.isArray(store.regularItems)
      ? store.regularItems
      : STORE_DEFAULTS.regularItems;
    const next = { ...STORE_DEFAULTS, ...store, regularItems };
    Object.keys(STORE_DEFAULTS).forEach((key) => {
      if (key !== "regularItems" && next[key] === "") next[key] = STORE_DEFAULTS[key];
    });
    return next;
  }

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
      return Array.isArray(data) && data.length ? data.map(normalizeStore) : JSON.parse(JSON.stringify(SEED));
    } catch {
      return JSON.parse(JSON.stringify(SEED));
    }
  }
  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  function nextId(list) {
    return list.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
  }

  const fromRow = (s) => ({
    id: s.id,
    name: s.name,
    lead: s.lead,
    openDate: s.open_date,
    hours: s.hours,
    address: s.address,
    mapImage: s.map_image,
    heroImage1: s.hero_image1,
    heroImage2: s.hero_image2,
    detailImage: s.detail_image,
    limitedName: s.limited_name,
    limitedDesc: s.limited_desc,
    limitedImage: s.limited_image,
    limitedProduct: s.limited_product,
    limitedPrice: s.limited_price,
    regularBrand: s.regular_brand,
    regularDesc: s.regular_desc,
    regularItems: Array.isArray(s.regular_items) ? s.regular_items : [],
  });
  const toRow = (data) => ({
    name: data.name || "",
    lead: data.lead || "",
    open_date: data.openDate || "",
    hours: data.hours || "",
    address: data.address || "",
    map_image: data.mapImage || "",
    hero_image1: data.heroImage1 || "",
    hero_image2: data.heroImage2 || "",
    detail_image: data.detailImage || "",
    limited_name: data.limitedName || "",
    limited_desc: data.limitedDesc || "",
    limited_image: data.limitedImage || "",
    limited_product: data.limitedProduct || "",
    limited_price: data.limitedPrice || "",
    regular_brand: data.regularBrand || "",
    regular_desc: data.regularDesc || "",
    regular_items: Array.isArray(data.regularItems) ? data.regularItems : [],
  });

  const StoreStore = {
    PRIMARY_ID,
    async getAll() {
      if (global.sb) {
        const { data, error } = await global.sb
          .from("stores")
          .select("*")
          .order("id", { ascending: true });
        if (!error) return (data || []).map(fromRow).map(normalizeStore);
        console.error("[StoreStore] Supabase の取得に失敗しました:", error);
      }
      return read();
    },
    async findById(id) {
      if (global.sb) {
        const { data, error } = await global.sb
          .from("stores")
          .select("*")
          .eq("id", Number(id))
          .maybeSingle();
        if (!error) return data ? normalizeStore(fromRow(data)) : null;
        console.error("[StoreStore] Supabase の取得に失敗しました:", error);
      }
      return read().find((s) => Number(s.id) === Number(id)) || null;
    },
    async create(data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("stores")
          .insert(toRow(data))
          .select("*")
          .single();
        if (error) throw error;
        return normalizeStore(fromRow(row));
      }
      const list = read();
      const item = {
        id: nextId(list),
        name: data.name || "",
        lead: data.lead || "",
        openDate: data.openDate || "",
        hours: data.hours || "",
        address: data.address || "",
        mapImage: data.mapImage || "",
        heroImage1: data.heroImage1 || "",
        heroImage2: data.heroImage2 || "",
        detailImage: data.detailImage || "",
        limitedName: data.limitedName || "",
        limitedDesc: data.limitedDesc || "",
        limitedImage: data.limitedImage || "",
        limitedProduct: data.limitedProduct || "",
        limitedPrice: data.limitedPrice || "",
        regularBrand: data.regularBrand || "",
        regularDesc: data.regularDesc || "",
        regularItems: Array.isArray(data.regularItems) ? data.regularItems : [],
      };
      write([...list, normalizeStore(item)]);
      return normalizeStore(item);
    },
    async update(id, data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("stores")
          .update(toRow(data))
          .eq("id", Number(id))
          .select("*")
          .single();
        if (error) throw error;
        return normalizeStore(fromRow(row));
      }
      const list = read();
      const target = Number(id);
      const next = list.map((s) => (Number(s.id) === target ? normalizeStore({ ...s, ...data, id: target }) : s));
      write(next);
      return next.find((s) => Number(s.id) === target) || null;
    },
    async remove(id) {
      if (global.sb) {
        const { error } = await global.sb.from("stores").delete().eq("id", Number(id));
        if (error) throw error;
        return;
      }
      const target = Number(id);
      write(read().filter((s) => Number(s.id) !== target));
    },
  };

  global.StoreStore = StoreStore;

  // ------------------------------------------------------------
  //  公開反映
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const yen = (n) => "¥" + Number(n || 0).toLocaleString("ja-JP");
  const MULTILINE = new Set(["hours"]);

  async function resolveRegularItems(items) {
    const list = Array.isArray(items) ? items : [];
    if (!global.ProductStore) return list;
    try {
      const products = await ProductStore.findAll();
      const byId = new Map(products.map((p) => [Number(p.id), p]));
      return list
        .map((item) => {
          const id = Number(item.id || item.productId);
          if (!id) return item;
          const p = byId.get(id);
          if (!p) return null;
          return {
            id,
            name: p.name,
            price: yen(p.price),
            image: p.img || "images/basque-cheesecake.png",
            href: `product.html?id=${id}`,
          };
        })
        .filter(Boolean);
    } catch (error) {
      console.error("[StoreStore] 定番商品の解決に失敗しました:", error);
      return list;
    }
  }

  // store-terukuni.html（主店舗）: data-store="key" / data-store-img="map" に反映
  async function renderStorePrimary() {
    const textEls = document.querySelectorAll("[data-store]");
    const mapEl = document.querySelector("[data-store-img='map']");
    const storeDetail = document.getElementById("storeDetail");
    const storeLimited = document.getElementById("storeLimited");
    const regularRow = document.getElementById("storeRegularRow");
    if (!textEls.length && !mapEl && !storeDetail && !storeLimited && !regularRow) return;

    const s = (await StoreStore.findById(PRIMARY_ID)) || (await StoreStore.getAll())[0];
    if (!s) return;
    textEls.forEach((el) => {
      const key = el.dataset.store;
      const val = s[key];
      if (typeof val !== "string") return;
      if (MULTILINE.has(key)) el.innerHTML = escapeHtml(val).replace(/\n/g, "<br />");
      else el.textContent = val;
    });
    if (mapEl && s.mapImage) mapEl.src = s.mapImage;

    const heroImages = document.querySelectorAll(".store-hero__img");
    if (heroImages[0] && s.heroImage1) heroImages[0].src = s.heroImage1;
    if (heroImages[1] && s.heroImage2) heroImages[1].src = s.heroImage2;

    const detailImg = document.querySelector(".store-detail__media img");
    if (detailImg && s.detailImage) {
      detailImg.src = s.detailImage;
      detailImg.alt = `${s.name}の店舗写真`;
    }

    const limitedName = document.querySelector(".store-limited__name");
    const limitedDesc = document.querySelector(".store-limited__desc");
    const limitedImg = document.querySelector(".store-limited__media img");
    const limitedProduct = document.querySelector(".store-limited__product");
    const limitedPrice = document.querySelector(".store-limited__price");
    if (limitedName) limitedName.textContent = s.limitedName;
    if (limitedDesc) limitedDesc.textContent = s.limitedDesc;
    if (limitedImg && s.limitedImage) {
      limitedImg.src = s.limitedImage;
      limitedImg.alt = s.limitedName;
    }
    if (limitedProduct) limitedProduct.textContent = s.limitedProduct;
    if (limitedPrice) limitedPrice.textContent = s.limitedPrice;

    const regularBrand = document.querySelector(".store-regular__brand");
    const regularDesc = document.querySelector(".store-regular__desc");
    if (regularBrand) regularBrand.textContent = s.regularBrand;
    if (regularDesc) regularDesc.textContent = s.regularDesc;
    if (regularRow) {
      const regularItems = await resolveRegularItems(s.regularItems);
      regularRow.innerHTML = regularItems
        .map((item) => `
          <a class="reg-card" href="${escapeHtml(item.href || "item.html")}">
            <div class="reg-card__media"><img src="${escapeHtml(item.image || "images/basque-cheesecake.png")}" alt="${escapeHtml(item.name || "")}" loading="lazy" /></div>
            <p class="reg-card__name">${escapeHtml(item.name || "")}</p>
            <p class="reg-card__price">${escapeHtml(item.price || "")}</p>
          </a>`)
        .join("");
    }
  }

  // store-detail.html?id=N（汎用店舗ページ）
  async function renderStoreDetail() {
    const root = document.getElementById("storeDetailGeneric");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id");
    const s = id != null ? await StoreStore.findById(id) : null;

    if (!s) {
      root.innerHTML = `
        <h1 class="store-detail__name">店舗</h1>
        <p class="cart-page__empty" style="text-align:center;">お探しの店舗が見つかりませんでした。</p>
        <div class="section-more" style="text-align:center;"><a href="index.html" class="btn btn--ghost">トップへもどる</a></div>`;
      return;
    }

    document.title = `${s.name} — SATSUMA NOIR`;
    const regularItems = await resolveRegularItems(s.regularItems);
    const rows = [
      s.openDate ? ["開店日", escapeHtml(s.openDate)] : null,
      s.hours ? ["時間", escapeHtml(s.hours).replace(/\n/g, "<br />")] : null,
      s.address ? ["住所", escapeHtml(s.address)] : null,
    ].filter(Boolean);

    root.innerHTML = `
      <h1 class="store-detail__name">${escapeHtml(s.name)}</h1>
      ${s.lead ? `<p class="store-detail__lead">${escapeHtml(s.lead)}</p>` : ""}
      ${s.detailImage ? `<figure class="store-detail__media"><img src="${escapeHtml(s.detailImage)}" alt="${escapeHtml(s.name)}の店舗写真" loading="lazy" /></figure>` : ""}
      <section class="store-limited" id="storeLimited">
        <div class="section-head store-limited__head">
          <h2 class="section-head__title">店舗限定商品</h2>
        </div>
        <div class="store-limited__divider"></div>
        <div class="store-limited__item">
          <h3 class="store-limited__name">${escapeHtml(s.limitedName)}</h3>
          <p class="store-limited__desc">${escapeHtml(s.limitedDesc)}</p>
          <div class="store-limited__card">
            <div class="store-limited__media">
              <img src="${escapeHtml(s.limitedImage)}" alt="${escapeHtml(s.limitedName)}" loading="lazy" />
            </div>
            <p class="store-limited__product">${escapeHtml(s.limitedProduct)}</p>
            <p class="store-limited__price">${escapeHtml(s.limitedPrice)}</p>
          </div>
        </div>
      </section>
      <section class="store-regular" id="storeRegular">
        <div class="section-head store-regular__head">
          <h2 class="section-head__title">定番商品・その他商品</h2>
        </div>
        <div class="store-regular__divider"></div>
        <h3 class="store-regular__brand">${escapeHtml(s.regularBrand)}</h3>
        <p class="store-regular__desc">${escapeHtml(s.regularDesc)}</p>
        <div class="store-regular__viewport">
          <div class="store-regular__row">
            ${regularItems
              .map((item) => `
                <a class="reg-card" href="${escapeHtml(item.href || "item.html")}">
                  <div class="reg-card__media"><img src="${escapeHtml(item.image || "images/basque-cheesecake.png")}" alt="${escapeHtml(item.name || "")}" loading="lazy" /></div>
                  <p class="reg-card__name">${escapeHtml(item.name || "")}</p>
                  <p class="reg-card__price">${escapeHtml(item.price || "")}</p>
                </a>`)
              .join("")}
          </div>
        </div>
      </section>
      <section class="store-info" style="padding-top:1rem;">
        <dl class="store-info__list">
          ${rows
            .map(
              ([label, value]) => `
            <div class="store-info__row">
              <dt class="store-info__label">${label}</dt>
              <dd class="store-info__value">${value}</dd>
            </div>`
            )
            .join("")}
        </dl>
        ${s.mapImage ? `<div class="store-info__map"><img src="${escapeHtml(s.mapImage)}" alt="${escapeHtml(s.name)}の地図" loading="lazy" /></div>` : ""}
      </section>
      <div class="section-more" style="text-align:center;margin-top:2rem;"><a href="index.html" class="btn btn--ghost">トップへもどる</a></div>`;
  }

  // index.html（ABOUT画面）の店舗情報セクション
  async function renderStoreCards() {
    const listEl = document.querySelector("#store .store__list");
    if (!listEl) return;
    const stores = await StoreStore.getAll();
    if (!stores.length) {
      listEl.innerHTML = `<p class="cart-page__empty" style="text-align:center;">店舗情報は準備中です。</p>`;
      return;
    }

    listEl.innerHTML = stores
      .map((s, i) => {
        const primary = Number(s.id) === PRIMARY_ID || i === 0;
        const href = primary ? "store-terukuni.html" : `store-detail.html?id=${encodeURIComponent(s.id)}`;
        const img = s.detailImage || s.heroImage1 || "images/terukuni-store.jpg";
        return `
      <a class="store-card" href="${href}">
        <div class="store-card__media">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(s.name)}" loading="lazy" />
        </div>
        <div class="store-card__body">
          <h3 class="store-card__name">${escapeHtml(s.name)}</h3>
          <div class="store-card__tags">
            ${primary ? `<span class="store-tag store-tag--flag">旗艦店</span>` : ""}
            <span class="store-tag">店舗</span>
          </div>
          <p class="store-card__address">${escapeHtml(s.address || "")}</p>
        </div>
        <span class="store-card__arrow" aria-hidden="true">›</span>
      </a>`;
      })
      .join("");
  }

  function renderStorePages() {
    renderStoreCards();
    renderStorePrimary();
    renderStoreDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderStorePages);
  } else {
    renderStorePages();
  }
})(window);
