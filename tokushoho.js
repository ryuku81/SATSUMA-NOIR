// ============================================================
//  Data Access Layer — TokushohoStore
//  ------------------------------------------------------------
//  特定商取引法に基づく表示の保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  データの形:
//    { lead, rows: [{ term, value }], date }
//  rows の並び順がそのまま表示順。value は改行可（<br>で表示）。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_tokushoho";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "1";
  const VERSION_KEY = "satsuma_tokushoho_version";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = {
    lead: "特定商取引に関する法律第11条に基づき、以下のとおり表示します。",
    rows: [
      { term: "販売事業者", value: "SATSUMA NOIR" },
      { term: "運営責任者", value: "（担当者名）" },
      { term: "所在地", value: "（郵便番号・住所）" },
      { term: "電話番号", value: "（電話番号）\n受付時間：平日 10:00〜17:00" },
      { term: "メールアドレス", value: "（メールアドレス）" },
      { term: "販売価格", value: "各商品ページに記載の価格（税込）" },
      { term: "商品代金以外の必要料金", value: "送料、決済手数料（各商品ページ・注文確認画面に記載）" },
      { term: "お支払い方法", value: "クレジットカード決済、各種オンライン決済" },
      { term: "お支払い時期", value: "ご注文確定時にお支払いが確定します。" },
      { term: "商品の引渡し時期", value: "ご注文・ご入金確認後、5営業日以内に冷凍便にて発送します。" },
      { term: "返品・交換について", value: "食品という商品の性質上、お客様都合による返品・交換はお受けできません。商品に不備があった場合は、商品到着後7日以内にお問い合わせください。" },
    ],
    date: "最終更新日：2025年1月1日",
  };

  // ---- 永続化（この層だけが localStorage を知っている）----
  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const version = localStorage.getItem(VERSION_KEY);
    // 未保存、またはシードのバージョンが変わったら再シード
    if (raw === null || version !== SEED_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      localStorage.setItem(VERSION_KEY, SEED_VERSION);
      return JSON.parse(JSON.stringify(SEED));
    }
    try {
      const data = JSON.parse(raw);
      return {
        lead: typeof data.lead === "string" ? data.lead : SEED.lead,
        rows: Array.isArray(data.rows) ? data.rows : [...SEED.rows],
        date: typeof data.date === "string" ? data.date : SEED.date,
      };
    } catch {
      return JSON.parse(JSON.stringify(SEED));
    }
  }
  function write(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ---- 公開 API（async = 将来のバックエンドと同じ形）----
  // ---- Supabase 読み込み（未接続・エラー時は localStorage にフォールバック）----
  async function fetchFromSupabase() {
    if (!global.sb) return null;
    const { data, error } = await global.sb
      .from("legal_notice")
      .select("lead, rows, date")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[TokushohoStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return data || null;
  }

  const TokushohoStore = {
    async get() {
      const remote = await fetchFromSupabase();
      return remote !== null ? remote : read();
    },

    async update(data) {
      const next = { ...read(), ...data };
      if (global.sb) {
        const { error } = await global.sb.from("legal_notice").update(next).eq("id", 1);
        if (error) throw error;
      }
      write(next);
      return next;
    },

    // 開発用: シード状態に戻す
    async resetToSeed() {
      const fresh = JSON.parse(JSON.stringify(SEED));
      write(fresh);
      return fresh;
    },
  };

  global.TokushohoStore = TokushohoStore;

  // ------------------------------------------------------------
  //  公開ページ（tokushoho.html）の描画
  //  #tokushohoContent が存在するページでのみ動作する。
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // URL・メール・内部リンク（◯◯.html）をリンク化する。
  // ※ 先にエスケープ済みの文字列にのみ適用するので安全。
  function linkify(escaped) {
    return escaped
      .replace(/(https?:\/\/[^\s<）)]+)/g, '<a class="legal__link" href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<a class="legal__link" href="mailto:$1">$1</a>')
      .replace(/\b([\w-]+\.html)\b/g, '<a class="legal__link" href="$1">$1</a>');
  }

  // 改行は <br> に。2行目以降は控えめな注記スタイルで表示。
  function valueHtml(value) {
    const lines = String(value ?? "").split("\n");
    return lines
      .map((line, i) =>
        i === 0
          ? linkify(escapeHtml(line))
          : `<span class="legal-table__note">${linkify(escapeHtml(line))}</span>`
      )
      .join("<br />");
  }

  async function renderPublicTokushoho() {
    const el = document.getElementById("tokushohoContent");
    if (!el) return;
    const data = await TokushohoStore.get();
    const rowsHtml = (data.rows || [])
      .map(
        (r) => `
      <div class="legal-table__row">
        <dt class="legal-table__th">${escapeHtml(r.term)}</dt>
        <dd class="legal-table__td">${valueHtml(r.value)}</dd>
      </div>`
      )
      .join("");
    el.innerHTML = `
      <p class="legal__lead">${escapeHtml(data.lead)}</p>
      <dl class="legal-table">${rowsHtml}</dl>
      ${data.date ? `<p class="legal__date">${escapeHtml(data.date)}</p>` : ""}`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPublicTokushoho);
  } else {
    renderPublicTokushoho();
  }
})(window);
