// ============================================================
//  Data Access Layer — CustomerStore
//  ------------------------------------------------------------
//  顧客データの正・CRUD を担う層。ProductStore / OrderStore と
//  同じく async API なので、後で fetch(API) に差し替え可能。
//
//  顧客オブジェクトの形:
//    { id, name, email, phone, createdAt: ISO文字列 }
//
//  注文との紐付けは現状 name で照合する（注文側に customer 名を
//  保持しているため）。将来バックエンドでは customerId で関連付ける。
// ============================================================
(function (global) {
  const STORAGE_KEY = "satsuma_customers";

  const daysAgoISO = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(10, 0, 0, 0);
    return d.toISOString();
  };

  // 初期データ。注文シードの顧客名と一致させてある（履歴が紐付くように）。
  function buildSeed() {
    return [
      { id: 1, name: "鈴木 花子", email: "hanako.suzuki@example.com", phone: "090-1111-2222", createdAt: daysAgoISO(40) },
      { id: 2, name: "田中 太郎", email: "taro.tanaka@example.com", phone: "090-2222-3333", createdAt: daysAgoISO(30) },
      { id: 3, name: "佐藤 美咲", email: "misaki.sato@example.com", phone: "090-3333-4444", createdAt: daysAgoISO(21) },
      { id: 4, name: "山本 健一", email: "kenichi.yamamoto@example.com", phone: "090-4444-5555", createdAt: daysAgoISO(14) },
      { id: 5, name: "中村 由美", email: "yumi.nakamura@example.com", phone: "090-5555-6666", createdAt: daysAgoISO(7) },
      { id: 6, name: "小林 大輔", email: "daisuke.kobayashi@example.com", phone: "090-6666-7777", createdAt: daysAgoISO(3) },
      { id: 7, name: "高橋 結衣", email: "yui.takahashi@example.com", phone: "090-7777-8888", createdAt: daysAgoISO(1) },
    ];
  }

  function read() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const seed = buildSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
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
    return list.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1;
  }

  const CustomerStore = {
    async findAll() {
      return read()
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    async findById(id) {
      return read().find((c) => c.id === Number(id)) ?? null;
    },

    async create(data) {
      const list = read();
      const customer = { createdAt: new Date().toISOString(), ...data, id: nextId(list) };
      write([...list, customer]);
      return customer;
    },

    async update(id, data) {
      const list = read();
      const target = Number(id);
      write(list.map((c) => (c.id === target ? { ...c, ...data, id: target } : c)));
      return read().find((c) => c.id === target) ?? null;
    },

    async remove(id) {
      const target = Number(id);
      write(read().filter((c) => c.id !== target));
    },

    async resetToSeed() {
      const seed = buildSeed();
      write(seed);
      return seed;
    },
  };

  global.CustomerStore = CustomerStore;
})(window);
