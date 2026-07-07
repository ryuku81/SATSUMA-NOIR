// ============================================================
//  Data Access Layer — OrderStore
//  ------------------------------------------------------------
//  注文データの正・集計を担う層。ProductStore と同じく
//  async API なので、後で fetch(API) に差し替え可能。
//
//  注文オブジェクトの形:
//    {
//      id: number,
//      authUserId: string | null,
//      customer: string,
//      items: [{ id, name, price, qty }],
//      total: number,
//      status: "unshipped" | "shipped",
//      createdAt: ISO文字列,
//    }
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_orders";
  // シードを変更したらバンプする（既存データを再シード）
  const SEED_VERSION = "2";
  const VERSION_KEY = "satsuma_orders_version";

  // 日付ヘルパー（ブラウザ実行なので Date を使用）
  const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const daysAgoISO = (days, hour = 12) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  // 初期データ（シード）。今日・昨日・数日前の注文を混在させ、
  // 「今日の売上」「未発送」が意味を持つようにしてある。
  function buildSeed() {
    return [
      { id: 1001, customer: "鈴木 花子", items: [{ id: 1, name: "バスクチーズケーキ", price: 2600, qty: 2 }, { id: 7, name: "ベイクドチーズケーキ", price: 2000, qty: 1 }], total: 7200, status: "unshipped", createdAt: daysAgoISO(0, 9) },
      { id: 1002, customer: "田中 太郎", items: [{ id: 5, name: "ベリーレアチーズケーキ", price: 2800, qty: 1 }], total: 2800, status: "unshipped", createdAt: daysAgoISO(0, 11) },
      { id: 1003, customer: "佐藤 美咲", items: [{ id: 3, name: "イタリアンティラミス", price: 3200, qty: 1 }, { id: 4, name: "レアチーズケーキ", price: 2200, qty: 2 }], total: 7600, status: "unshipped", createdAt: daysAgoISO(0, 14) },
      { id: 1004, customer: "山本 健一", items: [{ id: 8, name: "スフレチーズケーキ", price: 2300, qty: 1 }], total: 2300, status: "shipped", createdAt: daysAgoISO(1, 10) },
      { id: 1005, customer: "中村 由美", items: [{ id: 6, name: "ニューヨークチーズケーキ", price: 3000, qty: 3 }], total: 9000, status: "unshipped", createdAt: daysAgoISO(1, 16) },
      { id: 1006, customer: "小林 大輔", items: [{ id: 2, name: "バスクチーズタルト", price: 2400, qty: 1 }, { id: 1, name: "バスクチーズケーキ", price: 2600, qty: 1 }], total: 5000, status: "shipped", createdAt: daysAgoISO(3, 13) },
    ];
  }

  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const version = localStorage.getItem(VERSION_KEY);
    // 未保存、またはシードのバージョンが変わったら再シード
    if (raw === null || version !== SEED_VERSION) {
      const seed = buildSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      localStorage.setItem(VERSION_KEY, SEED_VERSION);
      return seed;
    }
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : buildSeed();
    } catch {
      return buildSeed();
    }
  }
  function write(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }
  function nextId(list) {
    return list.reduce((max, o) => Math.max(max, Number(o.id) || 0), 1000) + 1;
  }

  // ---- Supabase 連携（未接続・エラー時は localStorage にフォールバック）----
  //  テーブル列 created_at をアプリ内部の createdAt に変換する。
  const mapRow = (o) => ({
    id: o.id,
    authUserId: o.auth_user_id || null,
    customer: o.customer,
    email: o.email,
    address: o.address,
    note: o.note,
    items: Array.isArray(o.items) ? o.items : [],
    total: o.total,
    status: o.status,
    payment: o.payment,
    paymentStatus: o.payment_status || "",
    paymentIntentId: o.payment_intent_id || "",
    createdAt: o.created_at,
  });

  const ORDER_COLUMNS = "id, auth_user_id, customer, email, address, note, items, total, status, payment, payment_status, payment_intent_id, created_at";
  const LEGACY_ORDER_COLUMNS = "id, customer, email, address, note, items, total, status, payment, created_at";

  async function fetchAllFromSupabase() {
    if (!global.sb) return null;
    let result = await global.sb
      .from("orders")
      .select(ORDER_COLUMNS)
      .order("created_at", { ascending: false });
    if (result.error && result.error.code === "42703") {
      result = await global.sb
        .from("orders")
        .select(LEGACY_ORDER_COLUMNS)
        .order("created_at", { ascending: false });
    }
    const { data, error } = result;
    if (error) {
      console.error("[OrderStore] Supabase の取得に失敗しました:", error);
      return null;
    }
    return (data || []).map(mapRow);
  }

  // 集計用：Supabase 優先で注文一覧を取得（無ければ localStorage）
  async function loadList() {
    const remote = await fetchAllFromSupabase();
    return remote !== null ? remote : read();
  }

  const OrderStore = {
    async findAll() {
      const remote = await fetchAllFromSupabase();
      return remote !== null
        ? remote
        : read().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async findById(id) {
      if (global.sb) {
        let result = await global.sb
          .from("orders")
          .select(ORDER_COLUMNS)
          .eq("id", Number(id))
          .maybeSingle();
        if (result.error && result.error.code === "42703") {
          result = await global.sb
            .from("orders")
            .select(LEGACY_ORDER_COLUMNS)
            .eq("id", Number(id))
            .maybeSingle();
        }
        const { data, error } = result;
        if (!error) return data ? mapRow(data) : null;
        console.error("[OrderStore] Supabase の取得に失敗しました:", error);
        // エラー時のみ localStorage にフォールバック
      }
      return read().find((o) => o.id === Number(id)) ?? null;
    },

    async create(data) {
      if (global.sb) {
        let result = await global.sb.rpc("create_order", {
          p_customer: data.customer,
          p_email: data.email || "",
          p_address: data.address || "",
          p_note: data.note || "",
          p_items: data.items || [],
          p_total: data.total,
          p_payment: data.payment || "",
          p_auth_user_id: data.authUserId || null,
          p_payment_status: data.paymentStatus || "pending",
          p_payment_intent_id: data.paymentIntentId || "",
        });
        if (result.error && (result.error.code === "PGRST202" || result.error.code === "42883")) {
          result = await global.sb.rpc("create_order", {
            p_customer: data.customer,
            p_email: data.email || "",
            p_address: data.address || "",
            p_note: data.note || "",
            p_items: data.items || [],
            p_total: data.total,
            p_payment: data.payment || "",
            p_auth_user_id: data.authUserId || null,
          });
        }
        if (result.error && (result.error.code === "PGRST202" || result.error.code === "42883")) {
          result = await global.sb.rpc("create_order", {
            p_customer: data.customer,
            p_email: data.email || "",
            p_address: data.address || "",
            p_note: data.note || "",
            p_items: data.items || [],
            p_total: data.total,
            p_payment: data.payment || "",
          });
        }
        const { data: newId, error } = result;
        if (error) {
          console.error("[OrderStore] 注文の保存に失敗しました:", error);
          throw error;
        }
        return {
          id: newId,
          authUserId: data.authUserId || null,
          customer: data.customer,
          email: data.email || "",
          address: data.address || "",
          note: data.note || "",
          items: data.items || [],
          total: data.total,
          status: "unshipped",
          payment: data.payment || "",
          paymentStatus: data.paymentStatus || "pending",
          paymentIntentId: data.paymentIntentId || "",
          createdAt: new Date().toISOString(),
        };
      }
      const list = read();
      const order = {
        status: "unshipped",
        createdAt: new Date().toISOString(),
        ...data,
        id: nextId(list),
      };
      write([...list, order]);
      return order;
    },

    async updateStatus(id, status) {
      if (global.sb) {
        const { error } = await global.sb.from("orders").update({ status }).eq("id", Number(id));
        if (error) {
          console.error("[OrderStore] ステータス更新に失敗しました:", error);
          return null;
        }
        return await this.findById(id);
      }
      const list = read();
      const target = Number(id);
      write(list.map((o) => (o.id === target ? { ...o, status } : o)));
      return read().find((o) => o.id === target) ?? null;
    },

    // 任意の日付範囲で集計（from / to は "YYYY-MM-DD"、両端含む。空欄は無制限）
    async getSalesByDateRange(from, to) {
      const list = await loadList();
      const start = from ? new Date(`${from}T00:00:00`) : null;
      const end = to ? new Date(`${to}T23:59:59.999`) : null;

      const filtered = list.filter((o) => {
        const t = new Date(o.createdAt);
        if (start && t < start) return false;
        if (end && t > end) return false;
        return true;
      });

      return {
        sales: filtered.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
        count: filtered.length,
      };
    },

    // ダッシュボード集計（後でサーバ側の集計APIに置き換え可能）
    async getDashboardStats() {
      const list = await loadList();
      const today = startOfToday().getTime();

      const todaysOrders = list.filter((o) => new Date(o.createdAt).getTime() >= today);
      const todaysSales = todaysOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const unshippedCount = list.filter((o) => o.status === "unshipped").length;

      return {
        todaysSales,
        todaysOrderCount: todaysOrders.length,
        unshippedCount,
      };
    },

    async resetToSeed() {
      const seed = buildSeed();
      write(seed);
      return seed;
    },
  };

  global.OrderStore = OrderStore;
})(window);
