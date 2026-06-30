// ============================================================
//  Data Access Layer — BestSellerStore
//  ------------------------------------------------------------
//  トップページ「Best Seller」に表示する商品の選択・並び順を
//  保存・取得する層。値は商品IDの配列（順位順）。
//
//  ※ 現状は localStorage 保存（この端末・ブラウザ内）。
//    将来サーバー共有にする場合は Supabase 等に差し替え可能。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_bestseller";
  const DEFAULT_IDS = [7, 3, 1]; // 既定の人気順 TOP3
  const MAX = 3;

  function getIds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [...DEFAULT_IDS];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr.map(Number) : [...DEFAULT_IDS];
    } catch {
      return [...DEFAULT_IDS];
    }
  }

  function saveIds(ids) {
    const clean = (Array.isArray(ids) ? ids : []).map(Number).filter((n) => !Number.isNaN(n)).slice(0, MAX);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    return [...DEFAULT_IDS];
  }

  global.BestSellerStore = { DEFAULT_IDS, MAX, getIds, saveIds, reset };
})(window);
