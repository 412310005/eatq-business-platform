# EatQ CRM — TODO

> 依 [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) 整理。  
> 對照 prototype：`eatq-deploy/index - 複製.html`

## 狀態標記說明

| 標記 | 意義 |
|------|------|
| **Proto** | prototype 已存在（UI 或邏輯） |
| **CRM** | eatq-crm 已完成 |
| **待做** | 尚未實作（或僅 stub / 兩邊皆無） |

同一項目可同時標 **Proto + CRM**（已移植完成），或 **Proto + 待做**（prototype 有但 CRM 未完成），或僅 **待做**（全新功能）。

---

## 1. 已完成

### 核心模組與 UI 結構

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 登入頁 UI（帳密、角色切換） | ✅ | ✅ | 無真實驗證 |
| Dashboard Sidebar（6 模組導航） | ✅ | ✅ | |
| Dashboard 頂欄（標題、搜尋、badge） | ✅ | ✅ | |
| 推廣期免費 badge | ✅ | ✅ | |
| 使用者區塊 + 登出 | ✅ | ✅ | |
| 6 頁路由架構（map / ai / email / pipeline / tracker / changelog） | ✅ | ✅ | CRM 用 URL 路由 |

### 商家地圖

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 潛在客戶列表 | ✅ | ✅ | |
| 相關度評分與進度條 | ✅ | ✅ | `getScore()` |
| 評論分類標籤（food/queue/digital/pay） | ✅ | ✅ | |
| 過濾低相關（noise filter） | ✅ | ✅ | 閾值 30% |
| 點選店家 → AI 診斷 | ✅ | ✅ | |
| KPI：試用中 / 欲開發（即時 count） | ✅ | ✅ | |
| 互動式地圖（Leaflet + OSM） | — | ✅ | **CRM 超越 prototype** |
| Browser Geolocation | ✅ | ✅ | prototype 僅 toggle 文字 |
| Nominatim 反查地址 | — | ✅ | **CRM 新增** |
| 地址搜尋 + 半徑擴展（1→3 km） | — | ✅ | **CRM 新增** |
| 距離排序（haversine） | — | ✅ | **CRM 新增** |
| Pin 依相關度著色 | ✅ | ✅ | |

### AI 痛點診斷

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 評論依 category 分組顯示 | ✅ | ✅ | |
| 隱藏一般評論（noise） | ✅ | ✅ | |
| 四種推銷方向勾選（DIRS） | ✅ | ✅ | |
| 診斷評分條（剩食/排隊/數位/契合度） | ✅ | ✅ | rule-based |
| 電話開場腳本生成 | ✅ | ✅ | `buildScript()` |
| 「去推銷信」 | ✅ | ✅ | |
| 「加入欲開發」 | ✅ | ✅ | 寫入 Supabase |

### 推銷信生成

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 渠道 tab（Email / LINE / IG / 電話） | ✅ | ✅ | |
| 依推銷方向動態生成文案 | ✅ | ✅ | `buildEmailBody()` |
| 未選方向時提示回診斷 | ✅ | ✅ | |
| 店家 / 接洽人欄位 | ✅ | ✅ | |
| 即時預覽 | ✅ | ✅ | |
| 「生成並加入欲開發」 | ✅ | ✅ | |

### 欲開發名單（Pipeline）

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 卡片列表（依拜訪日排序） | ✅ | ✅ | |
| 打招呼 / 寄信 進度勾選 | ✅ | ✅ | `said` / `sent` |
| 預計拜訪日 | ✅ | ✅ | |
| 接洽人 / 電話 / LINE 欄位 | ✅ | ✅ | |
| 重複加入阻擋 | ✅ | ✅ | |
| 業務衝突警告（other_user） | ✅ | ✅ | |
| 內部留言板 | ✅ | ✅ | CRM 持久化至 `pipeline_messages` |
| 刪除 pipeline 項目 | ✅ | ✅ | |
| 簽 MOU → 移入客戶追蹤 | ✅ | ✅ | CRM 會 insert `clients` |
| 「＋ 從地圖新增」 | ✅ | ✅ | |

### 客戶追蹤（Tracker）

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 試用中客戶列表 | ✅ | ✅ | |
| 合約期間與進度條 | ✅ | ✅ | |
| 貼紙發放 / 使用 / 使用率 | ✅ | ✅ | |
| 交易金額試算 | ✅ | ✅ | |
| 訂閱方案顯示（貼紙系統） | ✅ | ✅ | |
| 聯絡方式（電話 / Email / LINE） | ✅ | ✅ | |
| 準備續約 Modal | ✅ | ✅ | |
| 終止合約 Modal（原因 + 備註） | ✅ | ✅ | |
| 低使用率警示（< 30%） | ✅ | ✅ | |
| 即將到期警示（prog > 85%） | ✅ | ✅ | |

### 異動紀錄

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 續約 / 終止紀錄列表 | ✅ | ✅ | |
| 自動寫入（續約、終止時） | ✅ | ✅ | CRM 寫入 Supabase |
| 空狀態提示 | ✅ | ✅ | |

### 全域搜尋

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 頂欄搜尋店家 | ✅ | ✅ | |
| 跨潛在 / 欲開發 / 正式客戶 | ✅ | ✅ | CRM 查 Supabase |
| 點選結果跳轉對應頁 | ✅ | ✅ | |

### 資料層

| 項目 | Proto | CRM | 備註 |
|------|:-----:|:---:|:-----|
| 推銷方向常數（DIRS） | ✅ | ✅ | `lib/constants.ts` |
| 評論分類常數（CATS） | ✅ | ✅ | |
| Supabase 持久化（businesses / reviews / pipeline / clients / changelogs） | — | ✅ | **CRM 新增** |
| Pipeline 留言持久化 | ✅ | ✅ | prototype 為 memory |

---

## 2. 高優先級（近期）

> 影響日常可用性、資料安全，或 prototype 已有 UI 但兩邊皆未接好。

| 項目 | Proto | CRM | 待做 | 說明 |
|------|:-----:|:---:|:----:|------|
| 推銷信「複製」按鈕功能 | ✅ UI | ✅ UI | ⬜ | 接入 Clipboard API |
| Layout 定位 toggle 與 Map 頁連動 | ✅ UI | ⚠️ 分離 | ⬜ | 頂欄 📍 ON/OFF 目前不控制 map geolocation |
| Supabase schema migration 納入 repo | — | — | ⬜ | 方便 onboarding 與版控 |
| `.env.local` 範例文件（`.env.example`） | — | — | ⬜ | 不含真實 key |
| 登入後預設路由一致化 | ✅ map | ⚠️ | ⬜ | `/dashboard` redirect 至 pipeline，登入卻去 map |
| 全域搜尋：pipeline / tracker 結果帶 id 跳轉 | ✅ | ⚠️ 部分 | ⬜ | CRM 跳頁但未 scroll/highlight 特定項目 |
| 靜態 KPI 改接真實資料 | ✅ 靜態 | ✅ 靜態 | ⬜ | 「本月新增 23」「剩食減少 2.4噸」 |
| 推銷渠道 deep link（mailto / tel） | ✅ UI | ✅ UI | ⬜ | pipeline 發送標籤目前無 action |

---

## 3. 中優先級

> 正式化、安全加固、業務效率提升。

| 項目 | Proto | CRM | 待做 | 說明 |
|------|:-----:|:---:|:----:|------|
| Supabase Auth 真實登入 | — | — | ⬜ | 取代 mock 登入 |
| Row Level Security（RLS） | — | — | ⬜ | 業務員資料隔離 |
| Server Actions / API routes 取代 client 直寫 DB | — | — | ⬜ | 移除 browser 端 service role |
| 業務員 / 主管權限差異 | ✅ UI | ✅ UI | ⬜ | 角色選了但無功能差異 |
| 客戶資料匯出（CSV / Excel） | ✅ UI | ✅ UI | ⬜ | tracker「↓ 匯出」 |
| MOU 拍照上傳 | ✅ 模擬 | ✅ 模擬 | ⬜ | Supabase Storage |
| 續約 Modal「重新簽 MOU」checkbox | ✅ | 待確認 | ⬜ | prototype 有，需對照 CRM |
| Pipeline 留言 Email 真實通知 | ✅ 假 toast | ✅ 假 toast | ⬜ | Resend / SendGrid |
| AI / Email 改 dynamic route `[id]` | — | — | ⬜ | `/dashboard/ai/[id]` |
| 抽出共用 UI 元件 | — | — | ⬜ | Sidebar、Modal、Card |
| 合約到期提醒（prog > 85%）主動通知 | ✅ 視覺 | ✅ 視覺 | ⬜ | 目前僅 badge，無 push/email |
| 低貼紙使用率主動通知 | ✅ 視覺 | ✅ 視覺 | ⬜ | 目前僅頁面警示區塊 |
| 冷客 / 店家 status 在地圖區分 | ✅ cold | 待確認 | ⬜ | prototype 灰色 pin（幸福咖啡廳） |

---

## 4. 未來功能

> Phase 3 擴展，prototype 未完整定義或標示「即將推出」。

| 項目 | Proto | CRM | 待做 | 說明 |
|------|:-----:|:---:|:----:|------|
| 主管 Dashboard（團隊 KPI、衝突總覽） | ✅ 角色 UI | ✅ 角色 UI | ⬜ | |
| 真實 LLM 評論摘要與 pitch | — | — | ⬜ | 取代 rule-based「AI」 |
| Google Places API 自動匯入評論 | — | — | ⬜ | |
| 🟣 訂位系統（續約方案） | ✅ 即將推出 | ✅ 即將推出 | ⬜ | renew modal 已預留 |
| 🔵 點餐系統（續約方案） | ✅ 即將推出 | ✅ 即將推出 | ⬜ | renew modal 已預留 |
| 環境指標 dashboard（剩食減少噸數） | ✅ 靜態 | ✅ 靜態 | ⬜ | 需 sticker 真實聚合 |
| Campaign 行銷活動模組 | — | — | ⬜ | 兩邊皆無 |
| 經典 CRM Leads / Contacts 模型 | — | — | ⬜ | `lib/types.ts` 有定義未使用 |
| 推銷渠道實際發送（LINE / IG / FB API） | ✅ UI | ✅ UI | ⬜ | |
| 行動裝置 RWD 優化 | — | — | ⬜ | 目前偏 desktop |
| Google Maps 整合 | — | — | ⬜ | package 已裝，目前用 Leaflet |

---

## 5. Bug / 技術債

| 項目 | Proto | CRM | 待做 | 嚴重度 | 說明 |
|------|:-----:|:---:|:----:|:------:|------|
| Service role key 暴露於 client | — | ⚠️ | ⬜ | 🔴 高 | `NEXT_PUBLIC_SUPABASE_SERVICE_KEY` 於 browser |
| 無 API 層，所有 CRUD 在 client | — | ⚠️ | ⬜ | 🔴 高 | 無 `app/api/` |
| DB schema 不在 repo | — | ⚠️ | ⬜ | 🟠 中 | 無法 reproducible setup |
| `lib/data.ts` mock 未使用 | — | ⚠️ | ⬜ | 🟢 低 | 死碼 |
| `lib/types.ts` 舊型別未使用 | — | ⚠️ | ⬜ | 🟢 低 | 與 Supabase 型別重複 |
| `@react-google-maps/api` 已安裝未使用 | — | ⚠️ | ⬜ | 🟢 低 | 可移除或啟用 |
| 硬編碼業務員「林○○」 | ✅ | ✅ | ⬜ | 🟠 中 | 多使用者時需改 |
| Prototype 簽 MOU 不建 client 記錄 | ✅ bug | — | — | — | CRM 已修正 |
| WSL + OneDrive 路徑 dev 啟動慢（30–60s） | — | ⚠️ | ⬜ | 🟠 中 | 環境問題，非 code bug |
| Port 3000 衝突 / 重複 dev server | — | ⚠️ | ⬜ | 🟠 中 | 需手動 kill process |
| Tailwind 已裝但頁面全用 inline style | — | ⚠️ | ⬜ | 🟢 低 | 風格不一致 |
| README 仍為 create-next-app 預設 | — | ⚠️ | ⬜ | 🟢 低 | 未指向 PROJECT_OVERVIEW |
| 登入角色（主管）完全無分支邏輯 | ✅ | ✅ | ⬜ | 🟠 中 | UX 誤導 |
| 推銷信複製 / 匯出 / 發送按鈕無 handler | ✅ | ✅ | ⬜ | 🟠 中 | 使用者以為可用 |

---

## 建議執行順序（近期 Sprint）

```
Week 1–2   複製按鈕 · layout/map 定位連動 · .env.example · schema migration
Week 3–4   Supabase Auth + RLS · Server Actions · 移除 client service role
Week 5–6   匯出 · MOU 上傳 · 渠道 deep link · 靜態 KPI 接真實資料
```

---

## 完成度快照

| 類別 | Proto | CRM | 差距 |
|------|:-----:|:---:|:-----|
| UI / UX 結構 | ✅ | ~95% | 複製、匯出、發送 stub |
| 核心 CRM 流程 | ✅ | ~90% | Auth、權限 |
| 地圖 / 搜尋 | 假地圖 | 超越 Proto | — |
| 資料持久化 | memory | Supabase | schema 需入 repo |
| 安全 / 整合 | — | ~20% | Auth、RLS、API 層 |

---

*文件版本：2026-05-20 · 同步自 PROJECT_OVERVIEW.md*
