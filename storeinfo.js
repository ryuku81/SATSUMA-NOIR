// ============================================================
//  Data Access Layer — StoreStore（複数店舗対応）
//  ------------------------------------------------------------
//  店舗情報を「店舗の配列」として保存・取得する層。
//  店舗オブジェクト: { id, name, lead, openDate, hours, address, mapImage }
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
    },
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
      return Array.isArray(data) && data.length ? data : JSON.parse(JSON.stringify(SEED));
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
  });
  const toRow = (data) => ({
    name: data.name || "",
    lead: data.lead || "",
    open_date: data.openDate || "",
    hours: data.hours || "",
    address: data.address || "",
    map_image: data.mapImage || "",
  });

  const StoreStore = {
    PRIMARY_ID,
    async getAll() {
      if (global.sb) {
        const { data, error } = await global.sb
          .from("stores")
          .select("id, name, lead, open_date, hours, address, map_image, is_primary")
          .order("id", { ascending: true });
        if (!error) return (data || []).map(fromRow);
        console.error("[StoreStore] Supabase の取得に失敗しました:", error);
      }
      return read();
    },
    async findById(id) {
      if (global.sb) {
        const { data, error } = await global.sb
          .from("stores")
          .select("id, name, lead, open_date, hours, address, map_image, is_primary")
          .eq("id", Number(id))
          .maybeSingle();
        if (!error) return data ? fromRow(data) : null;
        console.error("[StoreStore] Supabase の取得に失敗しました:", error);
      }
      return read().find((s) => Number(s.id) === Number(id)) || null;
    },
    async create(data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("stores")
          .insert(toRow(data))
          .select("id, name, lead, open_date, hours, address, map_image, is_primary")
          .single();
        if (error) throw error;
        return fromRow(row);
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
      };
      write([...list, item]);
      return item;
    },
    async update(id, data) {
      if (global.sb) {
        const { data: row, error } = await global.sb
          .from("stores")
          .update(toRow(data))
          .eq("id", Number(id))
          .select("id, name, lead, open_date, hours, address, map_image, is_primary")
          .single();
        if (error) throw error;
        return fromRow(row);
      }
      const list = read();
      const target = Number(id);
      const next = list.map((s) => (Number(s.id) === target ? { ...s, ...data, id: target } : s));
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
  const MULTILINE = new Set(["hours"]);

  // store-terukuni.html（主店舗）: data-store="key" / data-store-img="map" に反映
  async function renderStorePrimary() {
    const textEls = document.querySelectorAll("[data-store]");
    const mapEl = document.querySelector("[data-store-img='map']");
    if (!textEls.length && !mapEl) return;

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
    const rows = [
      s.openDate ? ["開店日", escapeHtml(s.openDate)] : null,
      s.hours ? ["時間", escapeHtml(s.hours).replace(/\n/g, "<br />")] : null,
      s.address ? ["住所", escapeHtml(s.address)] : null,
    ].filter(Boolean);

    root.innerHTML = `
      <h1 class="store-detail__name">${escapeHtml(s.name)}</h1>
      ${s.lead ? `<p class="store-detail__lead">${escapeHtml(s.lead)}</p>` : ""}
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

  function renderStorePages() {
    renderStorePrimary();
    renderStoreDetail();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderStorePages);
  } else {
    renderStorePages();
  }
})(window);
