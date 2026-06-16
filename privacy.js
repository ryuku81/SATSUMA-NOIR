// ============================================================
//  Data Access Layer — PrivacyStore
//  ------------------------------------------------------------
//  プライバシーポリシーの保存・取得を担う層。
//  他ストアと同じく async API なので、後で fetch(API) に
//  差し替え可能。
//
//  ポリシーの形:
//    { lead, blocks: [{ heading, text }], date }
//  blocks の並び順がそのまま表示順（番号は自動採番）。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_privacy";
  // SEED を変更したら必ずバンプする。値が変わると既存データを再シードする。
  const SEED_VERSION = "1";
  const VERSION_KEY = "satsuma_privacy_version";

  // 初期データ（シード）。localStorage が空、またはバージョン更新時に投入される。
  const SEED = {
    lead: "SATSUMA NOIR（以下「当店」といいます）は、お客様の個人情報を適切に取り扱うことを社会的責務と考え、以下の方針に基づき個人情報の保護に努めます。",
    blocks: [
      { heading: "個人情報の取得について", text: "当店は、商品のご注文・お問い合わせ・会員登録などの際に、お名前・住所・電話番号・メールアドレスなどの個人情報を、適法かつ公正な手段により取得します。" },
      { heading: "利用目的", text: "取得した個人情報は、商品の発送、ご注文内容の確認、お問い合わせへの対応、各種ご案内の送付など、必要な範囲でのみ利用します。" },
      { heading: "第三者提供", text: "当店は、法令に基づく場合を除き、お客様の同意なく個人情報を第三者に提供することはありません。ただし、商品配送のために配送業者へ必要な情報を提供する場合があります。" },
      { heading: "安全管理", text: "当店は、個人情報への不正アクセス・紛失・破壊・改ざん・漏えいを防止するため、適切な安全管理措置を講じます。" },
      { heading: "開示・訂正・削除", text: "お客様ご本人からの個人情報の開示・訂正・削除のご請求があった場合は、ご本人であることを確認のうえ、速やかに対応いたします。" },
      { heading: "お問い合わせ窓口", text: "本ポリシーに関するお問い合わせは、お問い合わせフォーム（contact.html）よりご連絡ください。" },
    ],
    date: "制定日：2025年1月1日",
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
        blocks: Array.isArray(data.blocks) ? data.blocks : [...SEED.blocks],
        date: typeof data.date === "string" ? data.date : SEED.date,
      };
    } catch {
      return JSON.parse(JSON.stringify(SEED));
    }
  }
  function write(policy) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
  }

  // ---- 公開 API（async = 将来のバックエンドと同じ形）----
  // ---- Supabase 読み込み（未接続・エラー時は localStorage にフォールバック）----
  async function fetchFromSupabase() {
    if (!global.sb) return null;
    const { data, error } = await global.sb
      .from("privacy")
      .select("lead, blocks, date")
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[PrivacyStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return data || null;
  }

  const PrivacyStore = {
    async get() {
      const remote = await fetchFromSupabase();
      return remote !== null ? remote : read();
    },

    async update(data) {
      const next = { ...read(), ...data };
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

  global.PrivacyStore = PrivacyStore;

  // ------------------------------------------------------------
  //  公開ページ（privacy.html）の描画
  //  #privacyContent が存在するページでのみ動作する。
  // ------------------------------------------------------------
  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // 本文中のURL・メール・内部リンク（◯◯.html）をリンク化する。
  // ※ 先にエスケープ済みの文字列にのみ適用するので安全。
  function linkify(escaped) {
    return escaped
      .replace(/(https?:\/\/[^\s<）)]+)/g, '<a class="legal__link" href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/([\w.+-]+@[\w-]+\.[\w.-]+)/g, '<a class="legal__link" href="mailto:$1">$1</a>')
      .replace(/\b([\w-]+\.html)\b/g, '<a class="legal__link" href="$1">$1</a>');
  }

  async function renderPublicPrivacy() {
    const el = document.getElementById("privacyContent");
    if (!el) return;
    const policy = await PrivacyStore.get();
    const blocksHtml = (policy.blocks || [])
      .map(
        (b, i) => `
      <div class="legal__block">
        <h3 class="legal__heading">${i + 1}. ${escapeHtml(b.heading)}</h3>
        <p class="legal__text">${linkify(escapeHtml(b.text))}</p>
      </div>`
      )
      .join("");
    el.innerHTML = `
      <p class="legal__lead">${escapeHtml(policy.lead)}</p>
      ${blocksHtml}
      ${policy.date ? `<p class="legal__date">${escapeHtml(policy.date)}</p>` : ""}`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderPublicPrivacy);
  } else {
    renderPublicPrivacy();
  }
})(window);
