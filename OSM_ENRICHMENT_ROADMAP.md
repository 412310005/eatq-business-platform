# OSM Enrichment Roadmap（Phase Later）

> **狀態：FROZEN（2026-05-20）**  
> 本線已達可交付基線，**暫停進一步 debug / 路名 enrich 投入**。  
> 多數無名店家仍顯示「附近餐廳／附近咖啡店」屬 **OpenStreetMap 資料品質限制**，非 blocker。

---

## 目前已確認正常（Freeze 基線）

| 項目 | 狀態 |
|------|------|
| OSM 區域搜尋（Overpass） | ✅ |
| Map ↔ AI 串接（`/dashboard/ai?name=...`） | ✅ |
| session restore / remount（`v13-osm-enrich`） | ✅ |
| displayName pipeline（`lib/osmDisplayName.ts`） | ✅ |
| 命名 fallback（附近 + 類別） | ✅ |
| 有真實店名時 rule A 直接顯示 | ✅ |

---

## 目前已完成（程式碼）

| 模組 | 路徑 | 說明 |
|------|------|------|
| Overpass place parsing | `lib/overpass.ts` | tags → `road` / `address` / `display_name` |
| displayName 產品化 | `lib/osmDisplayName.ts` | A 真實名 / B 路+類別 / C 區+類別 / D 附近+類別 |
| Category 中文化 | `lib/osmDisplayName.ts` | restaurant→餐廳、cafe→咖啡店… |
| Enrich pipeline | `lib/osmEnrich.ts` | 無 road 時批次增強 |
| Nearest road lookup | `lib/osmEnrich.ts` | Overpass `way[highway][name]` + 200m 匹配 |
| Reverse geocode 框架 | `lib/osmEnrich.ts` | Nominatim reverse（限速、座標快取） |
| API 整合 | `app/api/overpass/route.ts` | `enrichOsmPlaces()` → `_debug.enrichStats` |

---

## 已知限制（非 bug）

Log 常見：

```ts
road: undefined
parsedRoad: null
rule: 'A' | 'D'
```

含意：

- OSM 原始 element **常無** `addr:street` / `addr:full` / `name`
- Enrich 已執行，但區域內 **named highway 稀疏** 或 Nominatim 無法解析出路名
- 產品上接受 **「附近咖啡店」** 作為誠實 fallback，不阻擋主流程

---

## Phase Later（未來再做）

| 優先 | 項目 | 說明 |
|:----:|------|------|
| P1 | Google Places enrich | 店名、地址、評論、營業狀態 |
| P2 | Nominatim cache | Redis / Supabase 快取 reverse 結果，降低延遲 |
| P3 | Nearby landmark naming | 地標 + 類別（「赤崁樓旁咖啡店」） |
| P4 | POI clustering | 同路段店家群組顯示 |
| P5 | Business density scoring | 商圈熱度 / 競爭密度 |
| P6 | Overpass 二段查詢優化 | 關聯 addr 至 building / relation |
| P7 | 離線 enrich 佇列 | 背景 job 補齊路名，不阻塞搜尋 UI |

---

## 相關 build 標記

- Map page：`v13-osm-enrich`
- API：`v13-osm-enrich`（`POST /api/overpass`）

---

## 恢復開發時的檢查清單

1. 看 `_debug.enrichStats`：`enrichedByOverpassRoad` / `enrichedByNominatim` / `stillMissing`
2. 看 Terminal：`[osm enrich] done`
3. 抽 1 筆 `[overpass client] sample` 的 `rawTags` / `road` / `roadSource`
4. 再決定是否投入 Google Places 或加大 Nominatim 配額

---

*與主產品路線分離；下一階段見 `TODO.md` § 下一階段開發優先（2026-05）*
