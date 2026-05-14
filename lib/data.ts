import type { Business, Lead, ChangeLog, EmailTemplate, Contact, Interaction } from './types'

export const MOCK_BUSINESSES: Business[] = [
  {
    id: 'b001',
    name: '老饕私廚',
    category: 'restaurant',
    address: '忠孝東路四段 205 號',
    district: '大安區',
    city: '台北市',
    phone: '02-2771-8899',
    email: 'laotao@example.com',
    googleRating: 3.8,
    reviewCount: 142,
    hasApp: false,
    hasOnlineOrdering: false,
    hasLoyaltyProgram: false,
    employeeCount: 8,
    painPoints: ['no_online_presence', 'manual_ordering', 'no_loyalty_program'],
    lat: 25.0418,
    lng: 121.5491,
    tags: ['台菜', '合菜', '包廂'],
  },
  {
    id: 'b002',
    name: '晨光烘焙',
    category: 'bakery',
    address: '復興南路一段 200 號',
    district: '大安區',
    city: '台北市',
    phone: '02-2700-5566',
    googleRating: 4.2,
    reviewCount: 88,
    hasApp: false,
    hasOnlineOrdering: false,
    hasLoyaltyProgram: false,
    employeeCount: 4,
    painPoints: ['low_foot_traffic', 'food_waste', 'no_loyalty_program'],
    lat: 25.0381,
    lng: 121.5444,
    tags: ['麵包', '早餐', '甜點'],
  },
  {
    id: 'b003',
    name: 'Kopi Lab 咖啡研究室',
    category: 'cafe',
    address: '溫州街 36 號',
    district: '大安區',
    city: '台北市',
    phone: '02-2363-7788',
    email: 'kopi@example.com',
    googleRating: 4.6,
    reviewCount: 310,
    hasApp: false,
    hasOnlineOrdering: true,
    hasLoyaltyProgram: false,
    employeeCount: 5,
    painPoints: ['high_competition', 'no_loyalty_program', 'staff_shortage'],
    lat: 25.0262,
    lng: 121.5323,
    tags: ['精品咖啡', '早午餐', '插座'],
  },
  {
    id: 'b004',
    name: '丸子拉麵',
    category: 'restaurant',
    address: '師大路 39 號',
    district: '大安區',
    city: '台北市',
    phone: '02-2364-4455',
    googleRating: 3.5,
    reviewCount: 67,
    hasApp: false,
    hasOnlineOrdering: false,
    hasLoyaltyProgram: false,
    employeeCount: 6,
    painPoints: ['poor_reviews', 'high_competition', 'manual_ordering'],
    lat: 25.0248,
    lng: 121.5295,
    tags: ['日式', '拉麵', '豚骨'],
  },
  {
    id: 'b005',
    name: '夜貓 Bar & Grill',
    category: 'bar',
    address: '安和路二段 211 號',
    district: '大安區',
    city: '台北市',
    phone: '02-2738-1234',
    email: 'nightcat@example.com',
    googleRating: 4.0,
    reviewCount: 195,
    hasApp: false,
    hasOnlineOrdering: false,
    hasLoyaltyProgram: true,
    employeeCount: 12,
    painPoints: ['low_foot_traffic', 'no_online_presence'],
    lat: 25.0336,
    lng: 121.5481,
    tags: ['調酒', '燒烤', '現場音樂'],
  },
  {
    id: 'b006',
    name: '阿嬤的刈包',
    category: 'night_market',
    address: '羅斯福路三段 316 巷',
    district: '大安區',
    city: '台北市',
    phone: '0912-345-678',
    googleRating: 4.4,
    reviewCount: 523,
    hasApp: false,
    hasOnlineOrdering: false,
    hasLoyaltyProgram: false,
    employeeCount: 2,
    painPoints: ['low_foot_traffic', 'food_waste', 'staff_shortage'],
    lat: 25.0184,
    lng: 121.5335,
    tags: ['刈包', '台灣小吃', '古早味'],
  },
  {
    id: 'b007',
    name: '地中海風情餐廳',
    category: 'restaurant',
    address: '敦化南路一段 161 號',
    district: '大安區',
    city: '台北市',
    phone: '02-2711-9900',
    email: 'mediterranean@example.com',
    googleRating: 4.1,
    reviewCount: 228,
    hasApp: false,
    hasOnlineOrdering: true,
    hasLoyaltyProgram: false,
    employeeCount: 15,
    painPoints: ['no_loyalty_program', 'manual_ordering', 'high_competition'],
    lat: 25.0467,
    lng: 121.5508,
    tags: ['西餐', '義大利麵', '約會'],
  },
  {
    id: 'b008',
    name: '胖虎漢堡',
    category: 'restaurant',
    address: '信義路四段 415 號',
    district: '信義區',
    city: '台北市',
    phone: '02-2729-6677',
    googleRating: 3.9,
    reviewCount: 156,
    hasApp: false,
    hasOnlineOrdering: false,
    hasLoyaltyProgram: false,
    employeeCount: 7,
    painPoints: ['no_online_presence', 'manual_ordering', 'staff_shortage'],
    lat: 25.0338,
    lng: 121.5678,
    tags: ['美式', '漢堡', '薯條'],
  },
]

const CONTACTS: Contact[] = [
  { id: 'c001', businessId: 'b001', name: '陳老闆', role: '老闆', phone: '0933-111-222', line: 'laotao_chen' },
  { id: 'c002', businessId: 'b002', name: '林小姐', role: '店長', phone: '0955-333-444', email: 'lin@example.com' },
  { id: 'c003', businessId: 'b003', name: 'Kevin Wu', role: '創辦人', phone: '0966-555-666', email: 'kevin@example.com', line: 'kevinwu' },
  { id: 'c004', businessId: 'b004', name: '王師傅', role: '老闆', phone: '0922-777-888' },
  { id: 'c005', businessId: 'b007', name: 'Sophie Lin', role: '行銷經理', phone: '0977-999-000', email: 'sophie@example.com' },
]

const INTERACTIONS: Interaction[] = [
  {
    id: 'i001', leadId: 'l001', type: 'call', date: '2026-05-10',
    summary: '電話介紹 EatQ 平台功能，老闆表示目前最頭痛的是沒有辦法留住回頭客',
    outcome: 'positive', nextAction: '安排線上 Demo', createdBy: '小明',
  },
  {
    id: 'i002', leadId: 'l001', type: 'demo', date: '2026-05-13',
    summary: '進行 30 分鐘線上 Demo，老闆對會員系統功能很感興趣，對價格有疑慮',
    outcome: 'positive', nextAction: '發送報價單', createdBy: '小明',
  },
  {
    id: 'i003', leadId: 'l002', type: 'email', date: '2026-05-08',
    summary: '寄送開發信，介紹烘焙業的智慧庫存管理功能',
    outcome: 'neutral', nextAction: '追蹤是否開信', createdBy: '小華',
  },
  {
    id: 'i004', leadId: 'l003', type: 'meeting', date: '2026-05-12',
    summary: '現場拜訪，Kevin 對聯名活動功能有興趣，希望了解整合行銷方案',
    outcome: 'positive', nextAction: '準備整合行銷提案', createdBy: '小明',
  },
  {
    id: 'i005', leadId: 'l004', type: 'call', date: '2026-05-11',
    summary: '電話初步接觸，王師傅對科技工具持保守態度，需要更多時間說服',
    outcome: 'neutral', nextAction: '兩週後再追蹤', createdBy: '小華',
  },
]

export const MOCK_LEADS: Lead[] = [
  {
    id: 'l001',
    businessId: 'b001',
    businessName: '老饕私廚',
    businessCategory: 'restaurant',
    status: 'negotiating',
    assignedTo: '小明',
    priority: 'high',
    estimatedValue: 36000,
    nextFollowUp: '2026-05-16',
    notes: '老闆非常重視回頭客，對會員功能最感興趣。報價分兩個方案：基礎版 $1,800/月 及進階版 $3,000/月。',
    createdAt: '2026-05-05',
    updatedAt: '2026-05-13',
    contacts: [CONTACTS[0]],
    interactions: [INTERACTIONS[0], INTERACTIONS[1]],
  },
  {
    id: 'l002',
    businessId: 'b002',
    businessName: '晨光烘焙',
    businessCategory: 'bakery',
    status: 'contacted',
    assignedTo: '小華',
    priority: 'medium',
    estimatedValue: 21600,
    nextFollowUp: '2026-05-17',
    notes: '已發開發信，著重食材浪費和庫存管理的解決方案。',
    createdAt: '2026-05-06',
    updatedAt: '2026-05-08',
    contacts: [CONTACTS[1]],
    interactions: [INTERACTIONS[2]],
  },
  {
    id: 'l003',
    businessId: 'b003',
    businessName: 'Kopi Lab 咖啡研究室',
    businessCategory: 'cafe',
    status: 'interested',
    assignedTo: '小明',
    priority: 'high',
    estimatedValue: 43200,
    nextFollowUp: '2026-05-15',
    notes: 'Kevin 是科技業出身，對數據分析功能很有感。競爭對手也在評估中，需要盡快提出差異化。',
    createdAt: '2026-05-07',
    updatedAt: '2026-05-12',
    contacts: [CONTACTS[2]],
    interactions: [INTERACTIONS[3]],
  },
  {
    id: 'l004',
    businessId: 'b004',
    businessName: '丸子拉麵',
    businessCategory: 'restaurant',
    status: 'contacted',
    assignedTo: '小華',
    priority: 'low',
    estimatedValue: 21600,
    nextFollowUp: '2026-05-25',
    notes: '傳統老闆，對數位化工具接受度低。需要耐心溝通，可以先推基礎方案。',
    createdAt: '2026-05-09',
    updatedAt: '2026-05-11',
    contacts: [CONTACTS[3]],
    interactions: [INTERACTIONS[4]],
  },
  {
    id: 'l005',
    businessId: 'b007',
    businessName: '地中海風情餐廳',
    businessCategory: 'restaurant',
    status: 'prospect',
    assignedTo: '小明',
    priority: 'medium',
    estimatedValue: 54000,
    nextFollowUp: '2026-05-19',
    notes: '規模較大，有 15 名員工。行銷預算充足，適合推進階版。Sophie 是主要聯絡窗口。',
    createdAt: '2026-05-12',
    updatedAt: '2026-05-12',
    contacts: [CONTACTS[4]],
    interactions: [],
  },
  {
    id: 'l006',
    businessId: 'b005',
    businessName: '夜貓 Bar & Grill',
    businessCategory: 'bar',
    status: 'closed_won',
    assignedTo: '小華',
    priority: 'high',
    estimatedValue: 36000,
    nextFollowUp: undefined,
    notes: '已成交！進階版方案，月費 $3,000。預計 6/1 上線。',
    createdAt: '2026-04-20',
    updatedAt: '2026-05-10',
    contacts: [],
    interactions: [],
  },
]

export const MOCK_CHANGELOGS: ChangeLog[] = [
  {
    id: 'cl001', leadId: 'l001', businessName: '老饕私廚',
    field: '狀態', oldValue: '已聯繫', newValue: '洽談中',
    changedBy: '小明', changedAt: '2026-05-13 14:32', note: 'Demo 效果良好，進入報價階段',
  },
  {
    id: 'cl002', leadId: 'l003', businessName: 'Kopi Lab 咖啡研究室',
    field: '狀態', oldValue: '已聯繫', newValue: '有興趣',
    changedBy: '小明', changedAt: '2026-05-12 11:15', note: '現場拜訪後 Kevin 有意願繼續了解',
  },
  {
    id: 'cl003', leadId: 'l006', businessName: '夜貓 Bar & Grill',
    field: '狀態', oldValue: '洽談中', newValue: '已成交',
    changedBy: '小華', changedAt: '2026-05-10 16:45', note: '簽約完成！',
  },
  {
    id: 'cl004', leadId: 'l001', businessName: '老饕私廚',
    field: '負責人', oldValue: '小華', newValue: '小明',
    changedBy: '系統管理員', changedAt: '2026-05-09 09:00', note: '業務重新分配',
  },
  {
    id: 'cl005', leadId: 'l002', businessName: '晨光烘焙',
    field: '優先級', oldValue: '低', newValue: '中',
    changedBy: '小華', changedAt: '2026-05-08 10:20', note: '店長回覆開信，提升優先級',
  },
  {
    id: 'cl006', leadId: 'l005', businessName: '地中海風情餐廳',
    field: '狀態', oldValue: '（新建）', newValue: '待開發',
    changedBy: '小明', changedAt: '2026-05-12 08:30',
  },
]

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'et001',
    name: '線上曝光不足',
    subject: '讓更多客人找到您的餐廳 — EatQ 為您帶來精準曝光',
    targetPainPoints: ['no_online_presence', 'low_foot_traffic'],
    tone: 'friendly',
    body: `您好，{{聯絡人姓名}} 您好，

我是 EatQ 的業務夥伴 {{業務姓名}}，非常欣賞 {{餐廳名稱}} 的用心經營。

在走訪大安區時，我注意到許多用餐客群其實不知道您的存在 — 這實在太可惜了！

EatQ 平台已協助超過 500 家餐廳透過：
✅ 智慧 Google 評論管理
✅ 社群自動化行銷
✅ 在地化精準廣告投放

平均讓餐廳來客數提升 35% 以上。

我想邀請您參加我們這週四（5/15）下午 3 點的線上說明會，完全免費，僅需 30 分鐘。

請問您方便嗎？

敬祝 生意興隆
{{業務姓名}} 敬上
EatQ 業務發展部`,
  },
  {
    id: 'et002',
    name: '無會員機制',
    subject: '讓老客人一直回來 — EatQ 會員留客方案',
    targetPainPoints: ['no_loyalty_program', 'low_foot_traffic'],
    tone: 'formal',
    body: `{{聯絡人姓名}} 您好，

根據餐飲業研究，開發新客的成本是留住舊客的 5-7 倍，但大多數餐廳卻沒有任何會員機制。

EatQ 的智慧會員系統讓您：
✅ 自動累點、兌換，客人都愛用
✅ 生日、節慶自動發送個人化優惠
✅ 精準分析哪些客人即將流失

{{餐廳名稱}} 如果能導入會員機制，保守估計可提升月營收 15-20%。

我可以為您量身規劃一份 ROI 試算報告，完全免費，讓您決策更有依據。

是否方便安排 20 分鐘的電話說明？

{{業務姓名}} 敬上`,
  },
  {
    id: 'et003',
    name: '點餐流程繁瑣',
    subject: '點餐不再讓服務員跑斷腿 — EatQ 智慧點餐解決方案',
    targetPainPoints: ['manual_ordering', 'staff_shortage'],
    tone: 'friendly',
    body: `{{聯絡人姓名}} 您好！

人力成本越來越高，您是否也在為「人不夠用」而煩惱？

EatQ 的 QR Code 智慧點餐系統：
✅ 桌邊掃碼即可點餐，廚房自動出單
✅ 減少 70% 點餐失誤率
✅ 讓服務員專注在高品質服務，而非重複作業

目前已有 {{附近案例餐廳}} 等餐廳導入，平均節省 1.5 個人力成本。

我想帶您的團隊實際體驗看看，有興趣嗎？

EatQ {{業務姓名}}`,
  },
]

export const TEAM_MEMBERS = ['小明', '小華', '系統管理員']
