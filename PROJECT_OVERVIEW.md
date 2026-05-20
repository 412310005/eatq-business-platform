# EatQ CRM — 專案總覽

> 內部業務開發系統，協助 EatQ 業務員在台南地區推廣「剩食貼紙」產品。  
> 本文件整理自 prototype（`eatq-deploy/index - 複製.html`）分析與目前 eatq-crm 實作對照。

---

## 1. 專案目的

**EatQ 業務開發系統**是一套 B2B 業務 CRM，核心目標是：

- 從 **Google 評論** 中找出餐飲店家的營運痛點（剩食、出餐、數位化、付款）
- 將痛點轉化為 **個人化推銷方向** 與 **多渠道 outreach 文案**
- 追蹤從 **潛在客戶 → 欲開發 → 簽 MOU 試用 → 續約/終止** 的完整業務漏斗
- 支援業務員以 **地圖 + 定位** 優先開發附近高相關店家

產品主軸為 **剩食貼紙系統**（掃條碼處理剩食、零人力），推廣期提供一年免費試用。

---

## 2. 目前功能

| 模組 | 路由 | 狀態 | 說明 |
|------|------|------|------|
| 登入 | `/` | ✅ UI 完成 | 帳密欄位 + 業務員/主管切換，**無真實驗證** |
| 商家地圖 | `/dashboard/map` | ✅ | Leaflet 地圖、定位、地址搜尋、潛在客戶列表 |
| AI 痛點診斷 | `/dashboard/ai?id=` | ✅ | 評論分類、推銷方向、電話腳本（rule-based，非 LLM） |
| 推銷信生成 | `/dashboard/email?id=` | ✅ | Email / LINE / IG / 電話腳本預覽 |
| 欲開發名單 | `/dashboard/pipeline` | ✅ | 開發前 pipeline、進度勾選、衝突留言板 |
| 客戶追蹤 | `/dashboard/tracker` | ✅ | 試用客戶、貼紙使用率、續約/終止 |
| 異動紀錄 | `/dashboard/changelog` | ✅ | 續約、終止合約 audit log |
| 全域搜尋 | Dashboard 頂欄 | ✅ | 跨 businesses / pipeline / clients 搜尋 |

**尚未實作或僅 UI stub：**

- 真實身份驗證（Supabase Auth）
- 主管 vs 業務員權限差異
- 推銷渠道實際發送（Email/LINE/IG/FB/電話標籤）
- MOU 照片上傳
- 客戶資料匯出
- 訂位/點餐系統（續約 modal 標示「即將推出」）
- Next.js API routes（目前直接 client-side 寫 Supabase）

---

## 3. 使用者流程

```
登入 → 商家地圖 → 點選店家 → AI 痛點診斷
                                    ↓
                          勾選推銷方向（可多選）
                                    ↓
                    ┌───────────────┴───────────────┐
                    ↓                               ↓
              推銷信生成                      加入欲開發名單
                    ↓                               ↓
              生成並加入 ──────────────────→ 欲開發名單
                                                    ↓
                              填聯絡方式、勾選進度、設拜訪日
                                                    ↓
                                              簽 MOU
                                                    ↓
                                              客戶追蹤
                                                    ↓
                                    ┌───────────────┴───────────────┐
                                    ↓                               ↓
                              準備續約                        終止合約
                                    ↓                               ↓
                              異動紀錄 ←──────────────────────────┘
```

**典型業務員路徑：**

1. 登入後進入地圖，依定位或地址搜尋附近店家
2. 點地圖 pin 或列表項目，進入 AI 診斷頁
3. 檢視評論痛點，勾選 1–4 個推銷方向
4. 生成推銷信或電話腳本，加入欲開發名單
5. 在 pipeline 更新「打招呼 / 寄信」、聯絡資訊、預計拜訪日
6. 現場簽 MOU 後移入客戶追蹤
7. 監控貼紙使用率，到期前續約或終止並寫入異動紀錄

---

## 4. 技術架構

```
┌─────────────────────────────────────────────────────────┐
│  Frontend — Next.js 16 (App Router) + React 19          │
│  - Client Components（'use client'）                    │
│  - Inline styles（無 shadcn / 獨立 components 資料夾）   │
│  - Tailwind 4（已安裝，頁面主要用 inline style）         │
└──────────────────────────┬──────────────────────────────┘
                           │ @supabase/supabase-js（browser）
┌──────────────────────────▼──────────────────────────────┐
│  Supabase — PostgreSQL +（規劃中）Auth / Storage         │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  External APIs                                          │
│  - OpenStreetMap / Nominatim（地理編碼、反查地址）       │
│  - Leaflet + react-leaflet（地圖渲染）                   │
└─────────────────────────────────────────────────────────┘
```

| 項目 | 技術 |
|------|------|
| 框架 | Next.js 16.2.6（Turbopack dev） |
| UI | React 19、Inline CSS |
| 地圖 | Leaflet 1.9、react-leaflet 5 |
| 資料庫 | Supabase JS 2.x |
| 語言 | TypeScript 5 |
| 共用邏輯 | `lib/constants.ts`（DIRS、CATS、評分、文案生成） |

**目錄結構（精簡）：**

```
app/
  page.tsx                 # 登入
  dashboard/
    layout.tsx             # Sidebar + 頂欄 + 全域搜尋
    map/page.tsx           # 商家地圖
    map/LeafletMap.tsx     # 地圖元件（dynamic import, no SSR）
    ai/page.tsx            # AI 痛點診斷
    email/page.tsx         # 推銷信生成
    pipeline/page.tsx      # 欲開發名單
    tracker/page.tsx       # 客戶追蹤
    changelog/page.tsx     # 異動紀錄
lib/
  constants.ts             # 型別、常數、文案 helper
  supabase.ts              # Supabase client
  types.ts                 # 舊版 CRM 型別（未使用）
  data.ts                  # Mock 資料（未使用）
```

---

## 5. 重要頁面

### 登入 `/`

- 帳號、密碼欄位（裝飾用）
- 業務員 / 主管角色切換（目前無功能差異）
- 點「登入」→ 導向 `/dashboard/map`

### Dashboard Layout `/dashboard/*`

- 左側 Sidebar：6 個模組導航
- 頂欄：頁面標題、全域搜尋、推廣期免費 badge、定位 ON/OFF（**layout 層 state，未連動 map 頁**）
- 使用者區塊：林業務員 + 登出（回 `/`）

### 商家地圖 `/dashboard/map`

- 4 張 KPI 卡片（部分為靜態 UI）
- Leaflet 地圖 + 商家 pin（依相關度著色）
- 潛在客戶列表（相關度、評論分類標籤）
- 定位、地址搜尋、低相關過濾

### AI 痛點診斷 `/dashboard/ai?id={businessId}`

- 左：評論依 category 分組顯示
- 右：推銷方向勾選、診斷評分條、電話開場腳本
- CTA：去推銷信、加入欲開發

### 推銷信生成 `/dashboard/email?id={businessId}`

- 左：渠道 tab（Email/LINE/IG/電話）、店家/接洽人欄位
- 右：即時預覽 + 複製按鈕
- CTA：生成並加入欲開發名單

### 欲開發名單 `/dashboard/pipeline`

- 卡片列表（依拜訪日排序）
- 進度：打招呼 ✓、寄信 ✓、預計拜訪日
- 聯絡欄位、渠道標籤、簽 MOU
- 業務衝突時：紅框 + 內部留言板

### 客戶追蹤 `/dashboard/tracker`

- 試用中客戶列表
- 貼紙發放/使用、合約進度、交易金額
- 續約 Modal、終止 Modal
- 低使用率（<30%）警示

### 異動紀錄 `/dashboard/changelog`

- 續約、終止合約的時間軸紀錄

---

## 6. Supabase 用途

所有 CRM 資料持久化於 Supabase PostgreSQL，由 browser 端 `@supabase/supabase-js` 直接讀寫。

**環境變數（`.env.local`）：**

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_SERVICE_KEY=...   # 優先使用（繞過 RLS）
# 或
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> ⚠️ 目前使用 service role key 於 client 端，適合內部 prototype；正式環境應改 Server Actions + RLS。

**資料表（由程式推斷，schema 不在 repo 內）：**

| 表名 | 用途 |
|------|------|
| `businesses` | 餐飲店家（名稱、地址、經緯度、評分、tags 等） |
| `reviews` | 顧客評論片段（`category`: food/queue/digital/pay/none） |
| `pipeline` | 欲開發名單（聯絡資訊、said/sent、visit_date、dirs、other_user） |
| `pipeline_messages` | 業務衝突時的內部留言 |
| `clients` | 已簽 MOU 的試用客戶（貼紙、合約、status） |
| `changelogs` | 續約/終止 audit trail |

**主要 CRUD 流程：**

- Map / AI / Email：讀 `businesses` + `reviews`
- 加入欲開發：insert `pipeline`
- 簽 MOU：insert `clients` + delete `pipeline`
- 續約/終止：update `clients` + insert `changelogs`
- 全域搜尋：query `businesses`、`pipeline`、`clients`

---

## 7. 地圖功能

地圖頁（`/dashboard/map`）超越 prototype 的靜態假地圖，為完整互動實作。

**地圖引擎**

- Leaflet + OpenStreetMap tiles
- 元件 `LeafletMap.tsx` 以 `dynamic import` 載入（`ssr: false`）
- 預設中心：台南 `[22.9999, 120.2269]`

**定位（Geolocation）**

- Browser `navigator.geolocation.getCurrentPosition`
- 成功後以 Nominatim reverse geocode 顯示地址
- 狀態：`idle` → `requesting` → `ok` / `denied` / `unavailable`

**地址搜尋**

- Nominatim forward geocode
- 自動擴大搜尋半徑：1 → 1.5 → 2 → 3 km，直到找到商家
- 結果依 haversine 距離排序

**列表與篩選**

- **過濾低相關**：隱藏評論相關度 < 30% 的店家（`getScore`）
- Pin 顏色依相關度：綠 ≥60%、橙 ≥30%、紅 <30%
- 點 pin 或列表 → 導向 `/dashboard/ai?id={id}`

**KPI 卡片**

- 「試用中」「欲開發」：即時從 Supabase count
- 「本月新增 23」「剩食減少 2.4噸」：靜態 UI（待接真實資料）

---

## 8. Pipeline 功能

**欲開發名單**（`/dashboard/pipeline`）管理簽 MOU 前的開發階段。

**資料來源**

- 從 AI 診斷或推銷信頁「加入欲開發」寫入
- 重複加入同一 `business_id` 會被阻擋

**每張卡片欄位**

| 欄位 | 說明 |
|------|------|
| `said` | 是否已完成打招呼 |
| `sent` | 是否已寄信/訊息 |
| `visit_date` | 預計拜訪日 |
| `contact_name/phone/line` | 接洽資訊 |
| `dirs` | 勾選的推銷方向（JSON） |
| `other_user` | 另一位業務員（衝突標記） |
| `assigned_to` | 負責業務（硬編碼 林○○） |

**業務衝突協調**

- 當 `other_user` 有值：卡片紅框、顯示 ⚠ 警告
- 可展開內部留言板（`pipeline_messages`）
- 送出留言後顯示「已發送 Email 通知」（UI 模擬，未真實寄信）

**簽 MOU**

- Confirm 對話框 → insert `clients`（預設 20 張貼紙 × $50、1 年合約）
- delete 對應 `pipeline` 記錄
- 導向 `/dashboard/tracker`

**其他操作**

- 刪除：從 pipeline 移除
- 發送渠道標籤（Email/LINE/IG/FB/電話）：UI only
- 底部「＋ 從地圖新增」→ 導向 map 頁

---

## 9. Prototype 與目前專案差異

| 項目 | Prototype（HTML SPA） | eatq-crm（Next.js） |
|------|----------------------|---------------------|
| 架構 | 單檔 SPA，`draw()` 重繪 | Next.js App Router 多頁 |
| 資料 | In-memory JS 陣列 | Supabase PostgreSQL |
| 地圖 | CSS 假地圖 + 固定 pin | Leaflet + 真實經緯度 |
| 定位 | Toggle 文字切換 | Browser Geolocation + Nominatim |
| 地址搜尋 | 無 | Nominatim + 半徑擴展 |
| 距離排序 | 無 | haversine 計算 |
| 簽 MOU | 只刪 pipeline，不建 client | 完整 insert clients |
| 留言板 | 記憶體 `msgStore` | Supabase `pipeline_messages` |
| 異動紀錄 | 記憶體 `changelogs` | Supabase `changelogs` |
| 路由 | `S.page` state | URL 路由 + query `?id=` |
| 登入 | Mock | Mock（相同） |
| 複製/匯出/發送 | UI only | UI only（相同） |
| MOU 上傳 | Confirm 模擬 | Confirm 模擬（相同） |

**移植完成度（概估）**

| 類別 | 完成度 |
|------|--------|
| UI/UX 結構 | ~95% |
| 核心 CRM 流程 | ~90% |
| 地圖/搜尋 | 超越 prototype |
| Auth / 權限 / 整合 | ~20% |

**Prototype 原始檔位置：** `eatq-deploy/index - 複製.html`

---

## 10. 如何啟動專案

### 前置需求

- Node.js 18+（建議 20+）
- npm
- Supabase 專案與 `.env.local` 設定

### 步驟

```bash
# 1. 進入專案目錄
cd eatq-crm

# 2. 安裝依賴
npm install

# 3. 建立環境變數（若尚未有）
# 在專案根目錄建立 .env.local，填入 Supabase URL 與 Key

# 4. 啟動開發伺服器
npm run dev
```

### 可用指令

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式（Turbopack） |
| `npm run build` | 正式建置 |
| `npm run start` | 執行 production build |
| `npm run lint` | ESLint |

### 開啟應用

- 預設：`http://localhost:3000`
- 登入頁：`/`
- 登入後預設進入：`/dashboard/map`
- `/dashboard` 會 redirect 至 `/dashboard/pipeline`

---

## 11. WSL / localhost 注意事項

本專案可在 **Windows 本機** 或 **WSL** 下開發，實際 log 顯示常見情境如下。

### WSL 路徑

專案若放在 Windows 磁碟，WSL 路徑為：

```
/mnt/c/Users/evon9/OneDrive/桌面/eatq-crm
```

OneDrive 同步目錄在 WSL 下 I/O 較慢，**首次 `npm run dev` 可能需要 30–60 秒**。

### Port 衝突

- Next.js 預設使用 **port 3000**
- 若 3000 已被占用，會自動改用 **3001**
- 若出現 `Another next dev server is already running`，表示同專案已有 dev server：

```bash
# 查看並停止舊 process（範例）
kill 610

# 或找出占用 3000 的 process
lsof -i :3000   # Linux/WSL
```

**建議：** 開發前確認只有一個 `npm run dev` 在跑，避免 port 混亂。

### 瀏覽器存取

| 執行環境 | 建議 URL |
|----------|----------|
| Windows 本機跑 dev | `http://localhost:3000` |
| WSL 跑 dev | `http://localhost:3000`（WSL2 通常可從 Windows 瀏覽器直連） |
| Port 被改為 3001 | `http://localhost:3001` |

### Geolocation 在 WSL / localhost

- 地圖定位依賴 **瀏覽器 Geolocation API**
- `localhost` 一般視為 secure context，可請求定位
- WSL 內跑 dev、Windows 瀏覽器開啟時，定位通常可用；若被拒絕，可改用手動地址搜尋
- Layout 頂欄的「📍 ON/OFF」與 Map 頁的定位 toggle **各自獨立**，以 Map 頁為準

### 環境變數

- Next.js 會讀取 `.env.local`（已在 WSL dev log 中確認）
- 修改 `.env.local` 後需 **重啟 dev server**

### Supabase 連線

- Client 端直接連 Supabase，需確保 network 可連外
- WSL 下一般無額外設定；若連線失敗，檢查 URL / Key 與 Supabase 專案狀態

---

## 12. 後續開發建議

### Phase 0 — 整理（短期）

- [ ] 將 Supabase schema migration 納入 repo
- [ ] 統一 layout 定位 toggle 與 map 頁 geolocation
- [ ] 抽出共用 UI 元件（Sidebar、Modal、Card）
- [ ] 移除或標記 deprecated：`lib/data.ts`、`lib/types.ts` mock

### Phase 1 — 核心完備

- [ ] Supabase Auth + RLS（業務員只看自己的 pipeline/clients）
- [ ] Server Actions 取代 browser 直接寫 DB
- [ ] 複製按鈕（Clipboard API）
- [ ] 客戶匯出（CSV/Excel）
- [ ] AI/Email 改 dynamic route：`/dashboard/ai/[id]`

### Phase 2 — 業務自動化

- [ ] MOU 照片上傳（Supabase Storage）
- [ ] 留言 Email 通知（Resend / SendGrid）
- [ ] 渠道 deep link（mailto、tel、LINE）
- [ ] 合約到期提醒（prog > 85%）
- [ ] 低貼紙使用率自動警示（< 30%）

### Phase 3 — 擴展

- [ ] 主管 dashboard（團隊 KPI、衝突總覽）
- [ ] 真實 LLM 評論摘要（取代 rule-based）
- [ ] Google Places API 自動匯入評論
- [ ] 訂位/點餐模組（續約 flow 已預留）
- [ ] 環境指標 dashboard（真實 sticker 聚合）

---

## 附錄：推銷方向與評論分類

**推銷方向（DIRS）**

| Key | 標籤 | 用途 |
|-----|------|------|
| `food` | 🟠 剩食變收入 | 核心產品切入 |
| `queue` | 🔵 出餐壓力 | 尖峰備料痛點 |
| `digital` | 🟣 數位化第一步 | 訂位/QR 轉型 |
| `pay` | 🟡 成本優化 | 食材損耗/付款 |

**評論分類（CATS）**

`food` · `queue` · `digital` · `pay` · `none`（一般評論）

**相關度計分**

```
相關度 = (非 none 評論數 / 總評論數) × 100
```

---

*文件版本：2026-05-20 · 對照 prototype `eatq-deploy/index - 複製.html` 與 eatq-crm 現況*
