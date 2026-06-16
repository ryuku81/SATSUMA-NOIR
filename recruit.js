// ============================================================
//  Data Access Layer — RecruitStore
//  ------------------------------------------------------------
//  採用情報の保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  データの形:
//    { lead, body, buttonLabel, buttonUrl }
//  lead / body は改行可（<br>で表示）。
//  buttonLabel が空ならボタンは表示されない。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_recruit";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "3";
  const VERSION_KEY = "satsuma_recruit_version";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = {
    lead: "わたしたちと一緒に、\n「週末気分」をつくる仲間を募集しています。",
    body: "パティシエ・販売スタッフ・ECチームなど、さまざまなポジションでお待ちしています。地道なモノ作りに真摯に向き合える方からのご応募をお待ちしています。",
    buttonLabel: "エントリーはこちら",
    buttonUrl: "entry.html",
    // 応募者情報（ENTRY）画面の「希望職種」プルダウンの選択肢
    positions: ["パティシエ", "販売スタッフ", "ECチーム", "その他"],
  };

  // ---- 永続化（この層だけが localStorage を知っている）----
  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const version = localStorage.getItem(VERSION_KEY);
    // 未保存、またはシードのバージョンが変わったら再シード
    if (raw === null || version !== SEED_VERSION) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      localStorage.setItem(VERSION_KEY, SEED_VERSION);
      return { ...SEED };
    }
    try {
      const data = JSON.parse(raw);
      return { ...SEED, ...(data && typeof data === "object" ? data : {}) };
    } catch {
      return { ...SEED };
    }
  }
  function write(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ---- Supabase 読み込み（未接続・エラー時は localStorage にフォールバック）----
  //  テーブル列 button_label / button_url をアプリ内部の buttonLabel / buttonUrl に変換。
  async function fetchFromSupabase() {
    if (!global.sb) return null;
    const { data, error } = await global.sb
      .from("recruit")
      .select("lead, body, positions, button_label, button_url")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[RecruitStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    if (!data) return null;
    return {
      lead: data.lead,
      body: data.body,
      positions: Array.isArray(data.positions) ? data.positions : [],
      buttonLabel: data.button_label,
      buttonUrl: data.button_url,
    };
  }

  // ---- 公開 API（async = 将来のバックエンドと同じ形）----
  const RecruitStore = {
    async get() {
      const remote = await fetchFromSupabase();
      return remote !== null ? { ...SEED, ...remote } : read();
    },

    async update(data) {
      const next = { ...read(), ...data };
      write(next);
      return next;
    },

    // 開発用: シード状態に戻す
    async resetToSeed() {
      const fresh = { ...SEED };
      write(fresh);
      return fresh;
    },
  };

  global.RecruitStore = RecruitStore;

  // ------------------------------------------------------------
  //  公開ページ（recruit.html）の描画
  //  #recruitContent が存在するページでのみ動作する。
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // 改行を <br> に変換（エスケープ済み文字列に適用）
  const nl2br = (escaped) => escaped.replace(/\n/g, "<br />");

  async function renderPublicRecruit() {
    const el = document.getElementById("recruitContent");
    if (!el) return;
    const data = await RecruitStore.get();
    const url = data.buttonUrl && data.buttonUrl.trim() ? data.buttonUrl.trim() : "#";
    const external = /^https?:\/\//.test(url);
    const buttonHtml = data.buttonLabel && data.buttonLabel.trim()
      ? `<a href="${escapeHtml(url)}" class="btn btn--ghost"${external ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(data.buttonLabel)}</a>`
      : "";
    el.innerHTML = `
      <p class="recruit__lead">${nl2br(escapeHtml(data.lead))}</p>
      <p class="recruit__body">${nl2br(escapeHtml(data.body))}</p>
      ${buttonHtml}`;
  }

  // 応募者情報（entry.html）の「希望職種」セレクトを設定から描画
  async function renderEntryPositions() {
    const sel = document.getElementById("entryPosition");
    if (!sel) return;
    const data = await RecruitStore.get();
    const positions = Array.isArray(data.positions) ? data.positions : [];
    sel.innerHTML =
      `<option value="">選択してください</option>` +
      positions
        .filter((p) => p && p.trim())
        .map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`)
        .join("");
  }

  function renderPublic() {
    renderPublicRecruit();
    renderEntryPositions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPublic);
  } else {
    renderPublic();
  }
})(window);
