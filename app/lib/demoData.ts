// DEMOモード用のテストデータ

export const DEMO_EXPENSES = [
  {
    id: 9991,
    store_name: 'スターバックス',
    amount: 1200,
    purchase_date: '2024-02-14',
    created_at: '2024-02-14T10:00:00',
    paid_by: 'あなた',
    category: 'eatout',
    reactions: { 'パートナー': 'heart' },
    comments: [{ id: 'c1', user: 'パートナー', text: 'ごちそうさま！美味しかった☕️', timestamp: '2024-02-14T10:05:00' }],
    receipt_url: null,
    is_excluded: true,
    is_settled: false,
  },
  {
    id: 9992,
    store_name: 'ライフ（スーパー）',
    amount: 3500,
    purchase_date: '2024-02-13',
    created_at: '2024-02-13T18:30:00',
    paid_by: 'パートナー',
    category: 'food',
    reactions: { 'あなた': 'good' },
    comments: [],
    receipt_url: null,
    is_excluded: false,
    is_settled: false,
  },
  {
    id: 9993,
    store_name: 'Amazon（洗剤など）',
    amount: 2400,
    purchase_date: '2024-02-10',
    created_at: '2024-02-10T09:00:00',
    paid_by: 'あなた',
    category: 'daily',
    reactions: {},
    comments: [],
    receipt_url: null,
    is_excluded: false,
    is_settled: false,
  },
  {
    id: 9994,
    store_name: '電気代（1月分）',
    amount: 8500,
    purchase_date: '2024-02-05',
    created_at: '2024-02-05T00:00:00',
    paid_by: 'パートナー',
    category: 'electricity',
    reactions: { 'あなた': 'please' },
    comments: [{ id: 'c2', user: 'あなた', text: '暖房使いすぎたかも…ありがとう！', timestamp: '2024-02-05T12:00:00' }],
    receipt_url: null,
    is_excluded: false,
    is_settled: false,
  },
  {
    id: 9995,
    store_name: 'ウーバーイーツ',
    amount: 4200,
    purchase_date: '2024-02-01',
    created_at: '2024-02-01T19:00:00',
    paid_by: 'あなた',
    category: 'eatout',
    reactions: { 'パートナー': 'party' },
    comments: [],
    receipt_url: null,
    is_excluded: false,
    is_settled: false,
  },
];

export const DEMO_STATUS = {
  is_paid: true,
  is_received: false
};

export const DEMO_TRIPS = [
  {
    id: 8801,
    name: '京都 紅葉旅行',
    start_date: '2024-11-22',
    end_date: '2024-11-24',
    is_paid: false,
    is_received: false,
    budget: 120000,
    created_at: '2024-11-01T10:00:00',
  },
  {
    id: 8802,
    name: '箱根 温泉',
    start_date: '2024-08-10',
    end_date: '2024-08-11',
    is_paid: true,
    is_received: true,
    budget: 40000,
    created_at: '2024-07-20T10:00:00',
  },
];

export const DEMO_TRIP_EXPENSES = [
  { id: 7701, trip_id: 8801, store_name: '新幹線（往復）', amount: 56000, purchase_date: '2024-11-22', paid_date: '2024-10-01', paid_by: 'あなた', category: 'transport', receipt_url: null, is_excluded: false, is_settled: true, created_at: '2024-11-22T08:00:00' },
  { id: 7702, trip_id: 8801, store_name: '町家ステイ', amount: 42000, purchase_date: '2024-11-22', paid_date: '2024-08-15', paid_by: 'パートナー', category: 'lodging', receipt_url: null, is_excluded: false, is_settled: true, created_at: '2024-11-22T15:00:00' },
  { id: 7703, trip_id: 8801, store_name: '湯豆腐 ランチ', amount: 6800, purchase_date: '2024-11-23', paid_date: null, paid_by: 'パートナー', category: 'eatout', receipt_url: null, is_excluded: false, is_settled: false, created_at: '2024-11-23T12:30:00' },
  { id: 7704, trip_id: 8801, store_name: '清水寺 拝観料', amount: 1000, purchase_date: '2024-11-23', paid_date: null, paid_by: 'あなた', category: 'hobby', receipt_url: null, is_excluded: false, is_settled: false, created_at: '2024-11-23T10:00:00' },
  { id: 7705, trip_id: 8801, store_name: '八ツ橋', amount: 2400, purchase_date: '2024-11-24', paid_date: null, paid_by: 'あなた', category: 'souvenir', receipt_url: null, is_excluded: true, is_settled: false, created_at: '2024-11-24T14:00:00' },
  { id: 7711, trip_id: 8802, store_name: 'ロマンスカー', amount: 9000, purchase_date: '2024-08-10', paid_date: null, paid_by: 'あなた', category: 'transport', receipt_url: null, is_excluded: false, is_settled: false, created_at: '2024-08-10T09:00:00' },
  { id: 7712, trip_id: 8802, store_name: '温泉旅館', amount: 38000, purchase_date: '2024-08-10', paid_date: null, paid_by: 'パートナー', category: 'lodging', receipt_url: null, is_excluded: false, is_settled: false, created_at: '2024-08-10T15:00:00' },
];
// 個人の支出（デモでは「あなた」の分だけ）
export const DEMO_PERSONAL_EXPENSES = [
  { id: 6601, owner: 'あなた', store_name: 'ユニクロ', amount: 3990, purchase_date: '2024-02-18', category: 'fashion', receipt_url: null, created_at: '2024-02-18T15:00:00' },
  { id: 6602, owner: 'あなた', store_name: 'Steam（ゲーム）', amount: 2800, purchase_date: '2024-02-12', category: 'hobby', receipt_url: null, created_at: '2024-02-12T22:00:00' },
  { id: 6603, owner: 'あなた', store_name: '会社近くのランチ', amount: 980, purchase_date: '2024-02-09', category: 'eatout', receipt_url: null, created_at: '2024-02-09T12:30:00' },
  { id: 6604, owner: 'あなた', store_name: '美容院', amount: 5500, purchase_date: '2024-02-03', category: 'fashion', receipt_url: null, created_at: '2024-02-03T11:00:00' },
  // 2月の給与明細から記録した控除（給与天引き）
  { id: 6605, owner: 'あなた', store_name: '厚生年金保険料（2月給与）', amount: 25620, purchase_date: '2024-02-25', category: 'social_insurance', receipt_url: null, created_at: '2024-02-25T09:00:00', income_id: 4401 },
  { id: 6606, owner: 'あなた', store_name: '健康保険料（2月給与）', amount: 13860, purchase_date: '2024-02-25', category: 'social_insurance', receipt_url: null, created_at: '2024-02-25T09:00:00', income_id: 4401 },
  { id: 6607, owner: 'あなた', store_name: '住民税（2月給与）', amount: 15400, purchase_date: '2024-02-25', category: 'tax', receipt_url: null, created_at: '2024-02-25T09:00:00', income_id: 4401 },
  { id: 6608, owner: 'あなた', store_name: '所得税（2月給与）', amount: 6640, purchase_date: '2024-02-25', category: 'tax', receipt_url: null, created_at: '2024-02-25T09:00:00', income_id: 4401 },
];

// サブスク（デモでは「あなた」の分だけ）。支払日はデモを開いた日から何日後かで持つ
export const DEMO_SUBSCRIPTIONS = [
  { id: 5501, owner: 'あなた', name: 'Netflix', amount: 1590, cycle: 'monthly' as const, daysFromToday: 3, category: 'hobby', is_active: true, created_at: '2024-01-01T00:00:00' },
  { id: 5502, owner: 'あなた', name: 'Spotify', amount: 980, cycle: 'monthly' as const, daysFromToday: 12, category: 'hobby', is_active: true, created_at: '2024-01-01T00:00:00' },
  { id: 5503, owner: 'あなた', name: 'iCloud+', amount: 400, cycle: 'monthly' as const, daysFromToday: 20, category: 'digital', is_active: true, created_at: '2024-01-01T00:00:00' },
  { id: 5504, owner: 'あなた', name: 'Amazonプライム', amount: 5900, cycle: 'yearly' as const, daysFromToday: 140, category: 'hobby', is_active: true, created_at: '2024-01-01T00:00:00' },
  { id: 5505, owner: 'あなた', name: 'ジム', amount: 7700, cycle: 'monthly' as const, daysFromToday: 9, category: 'hobby', is_active: false, created_at: '2024-01-01T00:00:00' },
];

// 収入（ふたりの収入と「あなた」の個人の収入）
export const DEMO_INCOMES = [
  { id: 4401, owner: 'あなた', is_shared: false, source: '株式会社サンプル', amount: 280000, received_date: '2024-02-25', category: 'salary', created_at: '2024-02-25T09:00:00' },
  { id: 4402, owner: 'あなた', is_shared: false, source: 'ブログ広告', amount: 12000, received_date: '2024-02-15', category: 'side', created_at: '2024-02-15T09:00:00' },
  { id: 4403, owner: 'パートナー', is_shared: true, source: '児童手当', amount: 20000, received_date: '2024-02-10', category: 'benefit', created_at: '2024-02-10T09:00:00' },
  { id: 4404, owner: 'あなた', is_shared: false, source: '株式会社サンプル', amount: 280000, received_date: '2024-11-25', category: 'salary', created_at: '2024-11-25T09:00:00' },
  { id: 4405, owner: 'パートナー', is_shared: true, source: '結婚祝い', amount: 50000, received_date: '2024-08-03', category: 'gift', created_at: '2024-08-03T09:00:00' },
];

// 月の予算（ふたりの予算と「あなた」の予算）
export const DEMO_BUDGETS = [
  { id: 3301, owner: 'あなた', is_shared: true, category_group: 'total', amount: 20000 },
  { id: 3302, owner: 'あなた', is_shared: true, category_group: 'food', amount: 8000 },
  { id: 3303, owner: 'あなた', is_shared: true, category_group: 'daily', amount: 3000 },
  { id: 3304, owner: 'あなた', is_shared: false, category_group: 'total', amount: 90000 },
  { id: 3305, owner: 'あなた', is_shared: false, category_group: 'fashion', amount: 8000 },
];
