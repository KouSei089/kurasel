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
  },
  {
    id: 9994,
    store_name: '電気代（1月分）',
    amount: 8500,
    purchase_date: '2024-02-05',
    created_at: '2024-02-05T00:00:00',
    paid_by: 'パートナー',
    category: 'other',
    reactions: { 'あなた': 'please' },
    comments: [{ id: 'c2', user: 'あなた', text: '暖房使いすぎたかも…ありがとう！', timestamp: '2024-02-05T12:00:00' }],
    receipt_url: null,
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
  },
];

export const DEMO_STATUS = {
  is_paid: true,
  is_received: false
};