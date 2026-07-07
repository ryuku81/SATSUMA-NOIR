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
    if (global.sb) {
      (async () => {
        const { error: deleteError } = await global.sb.from("bestsellers").delete().neq("rank", 0);
        if (deleteError) throw deleteError;
        for (let i = 0; i < clean.length; i += 1) {
          const { error } = await global.sb.from("bestsellers").insert({ product_id: clean[i], rank: i + 1 });
          if (error) throw error;
        }
      })().catch((err) => console.error("[BestSellerStore] Supabase への保存に失敗しました:", err));
    }
    return clean;
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    return [...DEFAULT_IDS];
  }

  async function prime() {
    if (!global.sb) return;
    const { data, error } = await global.sb
      .from("bestsellers")
      .select("product_id, rank")
      .order("rank", { ascending: true });
    if (error) {
      console.error("[BestSellerStore] Supabase の取得に失敗しました:", error);
      return;
    }
    const ids = (data || []).map((r) => Number(r.product_id)).filter(Boolean);
    if (ids.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX)));
  }

  global.BestSellerStore = { DEFAULT_IDS, MAX, getIds, saveIds, reset, prime };
  prime();
})(window);
