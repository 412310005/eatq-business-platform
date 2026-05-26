'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { BusinessRow } from '@/lib/constants'
import {
  type OsmPlace,
  OVERPASS_FETCH_RADIUS_M,
  AREA_RADII_KM,
  AREA_MIN_COUNT,
  logOsmPlacesClientDebug,
  summarizeOsmPlaces,
} from '@/lib/overpass'
import { buildOsmAiUrl } from '@/lib/osmAiNavigation'
import { getOsmCategoryLabel, resolveOsmPlaceDisplayName } from '@/lib/osmDisplayName'
import { addLeadFromOsm, leadStatusLabel, type LeadRow } from '@/lib/leads'
import { MAP_PAGE_BUILD } from '@/lib/mapPageBuild'
import { OsmPlaceCard, OSM_CARD_UI_REV } from './OsmPlaceCard'

type OsmPlaceWithDist = OsmPlace & { distanceKm: number }

type DuplicateLeadPrompt = {
  place: OsmPlaceWithDist
  displayName: string
  existingLead: LeadRow
}

if (typeof window !== 'undefined') {
  console.log('[areaSearch] MapPage module loaded', MAP_PAGE_BUILD, OSM_CARD_UI_REV)
}

function formatDistKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}

function formatFollowUpTime(value: string | null | undefined): string {
  if (!value) return '尚無追蹤紀錄'
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return '尚無追蹤紀錄'
  return time.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pickPlacesInRadius(
  places: OsmPlace[],
  center: [number, number],
  radiiKm: readonly number[] = AREA_RADII_KM,
  minCount = AREA_MIN_COUNT,
): { items: OsmPlaceWithDist[]; radiusKm: number } {
  const maxKm = radiiKm[radiiKm.length - 1]
  let chosenKm = maxKm
  let picked: OsmPlace[] = []

  for (const km of radiiKm) {
    const inRadius = places.filter(p => haversine(center, [p.lat, p.lng]) <= km)
    console.log('[areaSearch] 半徑篩選', { km, count: inRadius.length, minCount })
    if (inRadius.length >= minCount) {
      chosenKm = km
      picked = inRadius
      break
    }
    chosenKm = km
    picked = inRadius
  }

  const items = picked
    .map(p => ({ ...p, distanceKm: haversine(center, [p.lat, p.lng]) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)

  console.log('[areaSearch] chosen radius', `${chosenKm}km`)
  console.log('[areaSearch] filtered count', items.length)

  return { items, radiusKm: chosenKm }
}

/** 右側列表資料來源（單一 state，避免 listMode 與 places 不同步） */
type ListPanelState = {
  source: 'idle' | 'osm'
  osmPlaces: OsmPlaceWithDist[]
  osmRadiusKm: number | null
}

const OSM_MAP_SESSION_KEY = 'eatq_map_osm_session'

type OsmMapSession = {
  osmPlaces: OsmPlaceWithDist[]
  osmRadiusKm: number
  mapCenter: [number, number]
  listMode: 'osm'
  searchMsg?: string
}

function saveOsmMapSession(data: OsmMapSession, source: string) {
  try {
    sessionStorage.setItem(OSM_MAP_SESSION_KEY, JSON.stringify(data))
    console.log('[map] save osm session', {
      source,
      places: data.osmPlaces.length,
      osmRadiusKm: data.osmRadiusKm,
      mapCenter: data.mapCenter,
      listMode: data.listMode,
    })
  } catch (err) {
    console.warn('[map] save osm session failed', err)
  }
}

function clearOsmMapSession() {
  try {
    sessionStorage.removeItem(OSM_MAP_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

function readOsmMapSession(): OsmMapSession | null {
  try {
    const raw = sessionStorage.getItem(OSM_MAP_SESSION_KEY)
    if (!raw) {
      console.log('[map] read osm session: empty')
      return null
    }
    const data = JSON.parse(raw) as OsmMapSession
    if (data.listMode !== 'osm') {
      console.log('[map] read osm session: invalid listMode', data.listMode)
      return null
    }
    if (!Array.isArray(data.osmPlaces) || data.osmPlaces.length === 0) {
      console.log('[map] read osm session: no places', { len: data.osmPlaces?.length })
      return null
    }
    if (typeof data.osmRadiusKm !== 'number') {
      console.log('[map] read osm session: invalid radius', data.osmRadiusKm)
      return null
    }
    const mc = data.mapCenter
    if (!Array.isArray(mc) || mc.length !== 2 || !Number.isFinite(mc[0]) || !Number.isFinite(mc[1])) {
      console.log('[map] read osm session: invalid mapCenter', mc)
      return null
    }
    return data
  } catch (err) {
    console.warn('[map] read osm session: parse error', err)
    return null
  }
}

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => {
    console.log('[areaDebug] LeafletMap dynamic loading placeholder')
    return (
    <div style={{ position: 'absolute', inset: 0, background: '#F0EDE6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>
      🗺 載入地圖中...
    </div>
    )
  },
})

const CAT_ICON: Record<string, string> = {
  restaurant: '🍱', cafe: '☕', night_market: '🍢', bar: '🍺', bakery: '🥐',
}
function getIcon(cat: string) { return CAT_ICON[cat] ?? '🏪' }

type LocStatus = 'idle' | 'requesting' | 'ok' | 'denied' | 'unavailable'

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function MapPageContent() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [locEnabled, setLocEnabled] = useState(true)
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null)
  const [locStatus, setLocStatus] = useState<LocStatus>('idle')
  const [stats, setStats] = useState({ customers: 0, leads: 0 })
  const [geoAddress, setGeoAddress] = useState<string | null>(null)
  const [searchAddr, setSearchAddr] = useState('')
  const [searchLoc, setSearchLoc] = useState<[number, number] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)
  const mapCenterRef = useRef<[number, number] | null>(null)
  /** 地址搜尋 / 地圖視野 / 區域搜尋共用的中心（與 pin、flyTo 對齊） */
  const currentSearchCenterRef = useRef<[number, number] | null>(null)
  const [showAreaSearchBtn, setShowAreaSearchBtn] = useState(false)
  const [areaSearching, setAreaSearching] = useState(false)
  const [listPanel, setListPanel] = useState<ListPanelState>({
    source: 'idle',
    osmPlaces: [],
    osmRadiusKm: null,
  })
  const listPanelRef = useRef(listPanel)
  const searchMsgRef = useRef<string | null>(null)
  const lastAreaSearchCenterRef = useRef<[number, number] | null>(null)
  const pendingSessionMapFlyRef = useRef<[number, number] | null>(null)
  const [leadAddingOsmId, setLeadAddingOsmId] = useState<string | null>(null)
  const [leadToast, setLeadToast] = useState<string | null>(null)
  const [leadToastVariant, setLeadToastVariant] = useState<'success' | 'warning' | 'error'>('success')
  const [duplicateLeadPrompt, setDuplicateLeadPrompt] = useState<DuplicateLeadPrompt | null>(null)

  const toast = {
    success: (msg: string) => {
      setLeadToastVariant('success')
      setLeadToast(msg)
      window.setTimeout(() => setLeadToast(null), 2800)
    },
    warning: (msg: string) => {
      setLeadToastVariant('warning')
      setLeadToast(msg)
      window.setTimeout(() => setLeadToast(null), 2800)
    },
    error: (msg: string) => {
      setLeadToastVariant('error')
      setLeadToast(msg)
      window.setTimeout(() => setLeadToast(null), 3500)
    },
  }

  useEffect(() => {
    listPanelRef.current = listPanel
  }, [listPanel])

  useEffect(() => {
    searchMsgRef.current = searchMsg
  }, [searchMsg])

  const AREA_SEARCH_MOVE_KM = 0.2

  const persistOsmSession = useCallback((source: string) => {
    const panel = listPanelRef.current
    if (panel.source !== 'osm' || panel.osmPlaces.length === 0 || panel.osmRadiusKm == null) {
      console.log('[map] skip save osm session', { source, listMode: panel.source, places: panel.osmPlaces.length })
      return
    }
    const center = mapCenterRef.current ?? lastAreaSearchCenterRef.current
    if (!center) {
      console.warn('[map] skip save osm session: no map center', { source })
      return
    }
    saveOsmMapSession({
      osmPlaces: panel.osmPlaces,
      osmRadiusKm: panel.osmRadiusKm,
      mapCenter: center,
      listMode: 'osm',
      searchMsg: searchMsgRef.current ?? undefined,
    }, source)
  }, [])

  const applyListPanel = useCallback((next: ListPanelState, reason: string) => {
    console.log(`[map] setListMode(${next.source})`, {
      reason,
      osmPlaces: next.osmPlaces.length,
      osmRadiusKm: next.osmRadiusKm,
    })
    setListPanel(next)
  }, [])

  const goToOsmDiagnosis = useCallback((place: OsmPlaceWithDist) => {
    try {
      persistOsmSession('beforeAiNav')
      const resolved = resolveOsmPlaceDisplayName(place)
      console.log('[osmPlace] before build url', {
        osmId: place.osmId,
        rawName: resolved.rawName,
        displayName: resolved.displayName,
        parsedRoad: resolved.parsedRoad,
        categoryLabel: resolved.categoryLabel,
        rule: resolved.rule,
        roadSource: resolved.roadSource,
      })
      const displayName = resolved.displayName
      const url = buildOsmAiUrl(place, displayName)
      console.log('[osmPlace] push url', url)
      router.push(url)
      console.log('[osmPlace] after push')
    } catch (err) {
      console.error('[osmPlace] push failed', err)
    }
  }, [router, persistOsmSession])

  const handleAddLeadFromOsm = useCallback(async (place: OsmPlaceWithDist) => {
    if (leadAddingOsmId) return
    const { displayName } = resolveOsmPlaceDisplayName(place)
    setLeadAddingOsmId(place.osmId)
    const { ok, duplicate, lead, error } = await addLeadFromOsm(place, displayName)
    setLeadAddingOsmId(null)
    if (error) {
      toast.error(error)
    } else if (duplicate && lead) {
      setDuplicateLeadPrompt({ place, displayName, existingLead: lead })
    } else if (ok) {
      toast.success('已加入欲開發名單')
    }
  }, [leadAddingOsmId])

  const forceAddDuplicateLead = useCallback(async () => {
    if (!duplicateLeadPrompt || leadAddingOsmId) return
    const { place, displayName } = duplicateLeadPrompt
    setLeadAddingOsmId(place.osmId)
    const { ok, error } = await addLeadFromOsm(place, displayName, { force: true })
    setLeadAddingOsmId(null)
    setDuplicateLeadPrompt(null)
    if (error) {
      toast.error(error)
    } else if (ok) {
      toast.success('已加入欲開發名單')
    }
  }, [duplicateLeadPrompt, leadAddingOsmId])

  const syncMapCenters = useCallback((loc: [number, number], source: string) => {
    currentSearchCenterRef.current = loc
    mapCenterRef.current = loc
    setMapCenter(loc)
    console.log('[mapSync] centers updated', { source, lat: loc[0], lng: loc[1] })
  }, [])

  const listMode = listPanel.source

  useEffect(() => {
    console.log('[map] MapPageContent mounted', { MAP_PAGE_BUILD, listMode: listPanelRef.current.source })
    const session = readOsmMapSession()
    if (!session) return

    applyListPanel({
      source: 'osm',
      osmPlaces: session.osmPlaces,
      osmRadiusKm: session.osmRadiusKm,
    }, 'mount-session')
    currentSearchCenterRef.current = session.mapCenter
    mapCenterRef.current = session.mapCenter
    setMapCenter(session.mapCenter)
    lastAreaSearchCenterRef.current = session.mapCenter
    setShowAreaSearchBtn(false)
    if (session.searchMsg) setSearchMsg(session.searchMsg)
    pendingSessionMapFlyRef.current = session.mapCenter
    console.log('[map] applied osm list from session on mount', { places: session.osmPlaces.length })

    return () => {
      console.log('[map] MapPageContent unmounted', { listMode: listPanelRef.current.source })
    }
  }, [applyListPanel])

  useEffect(() => {
    const target = pendingSessionMapFlyRef.current
    if (!target) return

    let tries = 0
    const timer = window.setInterval(() => {
      const map = (window as typeof window & { __eatq_map?: { setView: (c: [number, number], z: number) => void } }).__eatq_map
      if (map?.setView) {
        map.setView(target, 14)
        pendingSessionMapFlyRef.current = null
        window.clearInterval(timer)
        return
      }
      if (++tries >= 50) window.clearInterval(timer)
    }, 100)

    return () => window.clearInterval(timer)
  }, [listPanel.source, listPanel.osmPlaces.length])

  const onMapCenterChange = useCallback((center: { lat: number; lng: number }) => {
    const next: [number, number] = [center.lat, center.lng]
    syncMapCenters(next, 'mapViewport')
    console.log('[areaDebug] onMapCenterChange called', { lat: next[0], lng: next[1] })
    const last = lastAreaSearchCenterRef.current
    const show = last === null || haversine(next, last) >= AREA_SEARCH_MOVE_KM
    console.log('[areaDebug] setShowAreaSearchBtn', { show, lastSearch: last })
    setShowAreaSearchBtn(show)
  }, [syncMapCenters])

  const runAreaOverpassSearch = useCallback(async () => {
    console.log('[areaSearch] v4 handler start', MAP_PAGE_BUILD, { areaSearching })

    // 區域搜尋永遠以地圖當下視野中心為準
    const map = (window as typeof window & { __eatq_map?: { getCenter: () => { lat: number; lng: number } } }).__eatq_map
    if (!map?.getCenter) {
      console.warn('[areaSearch] 無法取得地圖實例，請拖動地圖後再試')
      return
    }
    const c = map.getCenter()
    const center: [number, number] = [c.lat, c.lng]
    syncMapCenters(center, 'areaSearchViewport')
    console.log('[areaSearch] center from __eatq_map.getCenter()', center)
    if (areaSearching) return

    const [lat, lng] = center
    console.warn('[areaSearch] 按鈕點擊 → 即將呼叫 /api/overpass', { lat, lng, build: MAP_PAGE_BUILD })
    setAreaSearching(true)
    try {
      const res = await fetch('/api/overpass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radiusM: OVERPASS_FETCH_RADIUS_M }),
      })
      const data = await res.json()
      console.warn('[areaSearch] API 回應', {
        build: MAP_PAGE_BUILD,
        status: res.status,
        ok: res.ok,
        count: data.count,
        placesLen: data.places?.length,
        apiDebug: data._debug,
      })
      if (!res.ok) {
        console.error('[areaSearch] API 失敗', data)
        return
      }
      const allPlaces = (data.places ?? []) as OsmPlace[]
      const clientStats = summarizeOsmPlaces(allPlaces)
      console.warn('[EATQ] overpass api-response stats (browser)', clientStats)
      if (!data._debug?.after) {
        console.error('[EATQ] API 缺少 _debug.after → server 仍是舊版 /api/overpass')
      } else {
        console.warn('[EATQ] osm enrich stats', data._debug.enrichStats)
        console.warn('[EATQ] osm before/after', {
          before: data._debug.before,
          after: data._debug.after,
        })
      }
      logOsmPlacesClientDebug(allPlaces, 'api-response')
      const { items, radiusKm } = pickPlacesInRadius(allPlaces, [lat, lng])
      logOsmPlacesClientDebug(items, 'after-radius-filter')
      const searchMsg = `已找到 ${items.length} 家店家，顯示 ${radiusKm}km 內（OpenStreetMap）`
      applyListPanel({
        source: 'osm',
        osmPlaces: items,
        osmRadiusKm: radiusKm,
      }, 'areaSearch')
      setSearchMsg(searchMsg)
      saveOsmMapSession({
        osmPlaces: items,
        osmRadiusKm: radiusKm,
        mapCenter: center,
        listMode: 'osm',
        searchMsg,
      }, 'areaSearch')
      console.log('[areaSearch] listMode:', 'osm')
      console.log('[areaSearch] chosen radius', `${radiusKm}km`)
      console.log('[areaSearch] filtered count', items.length)
      console.log('[areaSearch] render source:', 'osm-overpass')
      console.log('[areaSearch] 前 5 筆:', items.slice(0, 5))
      lastAreaSearchCenterRef.current = center
      setShowAreaSearchBtn(false)
    } catch (err) {
      console.error('[areaSearch] 請求失敗', err)
    } finally {
      setAreaSearching(false)
    }
  }, [areaSearching, syncMapCenters, applyListPanel])

  useEffect(() => {
    const w = window as typeof window & { __eatq_areaSearch?: () => void }
    w.__eatq_areaSearch = () => { void runAreaOverpassSearch() }
    return () => { delete w.__eatq_areaSearch }
  }, [runAreaOverpassSearch])

  // Load Supabase data
  useEffect(() => {
    async function load() {
      const [{ count: customerCount }, { count: leadCount }] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_deleted', false),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('is_deleted', false).neq('status', 'won').neq('status', 'customer').neq('status', 'converted'),
      ])
      setStats({ customers: customerCount ?? 0, leads: leadCount ?? 0 })
      setLoading(false)
    }
    load()
  }, [])

  // Initial geolocation
  useEffect(() => {
    if (!locEnabled) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocStatus('unavailable'); return
    }
    setLocStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLoc([pos.coords.latitude, pos.coords.longitude]); setLocStatus('ok') },
      err => { console.warn('Geolocation:', err.message); setLocStatus('denied') },
      { timeout: 8000, maximumAge: 60000 }
    )
  }, [locEnabled])

  // Re-trigger when re-enabled
  useEffect(() => {
    if (!locEnabled || locStatus !== 'idle') return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocStatus('unavailable'); return
    }
    setLocStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLoc([pos.coords.latitude, pos.coords.longitude]); setLocStatus('ok') },
      err => { console.warn('Geolocation:', err.message); setLocStatus('denied') },
      { timeout: 8000, maximumAge: 60000 }
    )
  }, [locStatus, locEnabled])

  // Reverse geocoding
  useEffect(() => {
    if (!userLoc || locStatus !== 'ok') return
    setGeoAddress(null)
    fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${userLoc[0]}&lon=${userLoc[1]}&format=json&accept-language=zh-TW`,
      { headers: { 'User-Agent': 'EatQ-CRM/1.0' } }
    )
      .then(r => r.json())
      .then(d => {
        const addr = d.display_name
        if (addr) setGeoAddress(addr.split(',').slice(0, 2).join('').trim())
      })
      .catch(() => {})
  }, [userLoc, locStatus])

  function toggleLoc() {
    if (locEnabled) {
      setLocEnabled(false); setUserLoc(null); setLocStatus('idle'); setGeoAddress(null)
    } else {
      setLocEnabled(true); setLocStatus('idle'); setSearchLoc(null); setSearchAddr('')
    }
  }

  async function doSearch() {
    const q = searchAddr.trim()
    if (!q) return
    console.log('[doSearch] query:', q)
    setSearching(true)
    setSearchMsg(null)
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=zh-TW`,
        { headers: { 'User-Agent': 'EatQ-CRM/1.0' } }
      )
      const d = await r.json()
      console.log('[doSearch] Nominatim result:', d)

      if (!d.length) {
        setSearchMsg('找不到該地址，請嘗試更具體的地址')
        setSearching(false)
        return
      }

      const loc: [number, number] = [parseFloat(d[0].lat), parseFloat(d[0].lon)]
      console.log('[doSearch] coord:', loc)

      setSearchLoc(loc)
      syncMapCenters(loc, 'addressSearch')
      lastAreaSearchCenterRef.current = loc
      setShowAreaSearchBtn(false)
      setSearchMsg('已找到位置，正在搜尋附近餐飲商家…')

      const [lat, lng] = loc
      console.warn('[doSearch] 即將呼叫 /api/overpass', { lat, lng, build: MAP_PAGE_BUILD })
      const overpassRes = await fetch('/api/overpass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radiusM: OVERPASS_FETCH_RADIUS_M }),
      })
      const overpassData = await overpassRes.json()
      console.warn('[doSearch] Overpass API 回應', {
        build: MAP_PAGE_BUILD,
        status: overpassRes.status,
        ok: overpassRes.ok,
        count: overpassData.count,
        placesLen: overpassData.places?.length,
        apiDebug: overpassData._debug,
      })
      if (!overpassRes.ok) {
        console.error('[doSearch] Overpass API 失敗', overpassData)
        setSearchMsg('搜尋附近店家失敗，請稍後再試')
        setSearching(false)
        return
      }

      const allPlaces = (overpassData.places ?? []) as OsmPlace[]
      logOsmPlacesClientDebug(allPlaces, 'address-search-api-response')
      const { items, radiusKm } = pickPlacesInRadius(allPlaces, loc)
      logOsmPlacesClientDebug(items, 'address-search-after-radius-filter')
      const msg = `已找到 ${items.length} 家店家，顯示 ${radiusKm}km 內（OpenStreetMap）`

      applyListPanel({
        source: 'osm',
        osmPlaces: items,
        osmRadiusKm: radiusKm,
      }, 'addressSearch')
      setSearchMsg(msg)
      saveOsmMapSession({
        osmPlaces: items,
        osmRadiusKm: radiusKm,
        mapCenter: loc,
        listMode: 'osm',
        searchMsg: msg,
      }, 'addressSearch')
      console.log('[doSearch] listMode:', 'osm')
      console.log('[doSearch] render source:', 'osm-overpass')
    } catch (err) {
      console.error('[doSearch] error:', err)
      setSearchMsg('搜尋失敗，請稍後再試')
    }
    setSearching(false)
  }

  // ── Derived: right panel source（不再 fallback 到 DB / demo list） ─────
  const listSource = listMode
  const showInitialEmptyState = listSource === 'idle' && listPanel.osmPlaces.length === 0 && !areaSearching && !searching
  const listCount = listSource === 'osm' ? listPanel.osmPlaces.length : 0
  const mapPins: BusinessRow[] = []

  useEffect(() => {
    console.log('[areaSearch] render source', {
      listMode: listSource,
      placesLength: listPanel.osmPlaces.length,
      currentRadius: listSource === 'osm' ? listPanel.osmRadiusKm : null,
      renderSource: listSource === 'osm' ? 'osm-overpass' : 'idle',
    })
  }, [listSource, listPanel.osmPlaces.length, listPanel.osmRadiusKm])

  // ── Status bar text ────────────────────────────────────────────────────
  const statusBarBg = (locStatus === 'ok' || locStatus === 'requesting') ? '#E6F1FB' : '#F1EFE8'
  const statusBarColor = (locStatus === 'ok' || locStatus === 'requesting') ? '#0C447C' : '#5F5E5A'
  const statusText =
    listSource === 'osm' && listPanel.osmRadiusKm != null
      ? (searchAddr.trim()
          ? `🗺 ${searchAddr} · ${listPanel.osmRadiusKm}km 內 · OpenStreetMap（${listCount} 家）`
          : `🗺 區域搜尋 · ${listPanel.osmRadiusKm}km 內 · OpenStreetMap（${listCount} 家）`)
      : searching
        ? '🔍 正在搜尋附近餐飲商家…'
        : searchLoc
          ? `🔍 搜尋結果：${searchAddr}`
          : locStatus === 'requesting' ? '📍 定位中...' :
            locStatus === 'ok' ? `📍 ${geoAddress ?? '已取得定位'}` :
            locStatus === 'denied' ? '📌 定位被拒絕，可輸入地址搜尋' :
            locStatus === 'unavailable' ? '📌 不支援定位，請輸入地址搜尋' :
            locEnabled ? '📍 台南市附近' : '📌 請輸入地址搜尋'

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    // height: calc(100vh - 44px topbar - 1px border - 26px content padding)
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 71px)' }}>
      {leadToast && (
        <div style={{
          position: 'fixed', top: 56, right: 16, zIndex: 9999,
          background: leadToastVariant === 'warning' ? '#C8841A' : leadToastVariant === 'success' ? '#3B6D11' : '#A32D2D',
          color: 'white', padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
        }}>
          {leadToast}
        </div>
      )}

      {duplicateLeadPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(44,44,42,.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setDuplicateLeadPrompt(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              background: 'white',
              borderRadius: 10,
              border: '1.5px solid #E8E5DE',
              boxShadow: '0 20px 60px rgba(0,0,0,.22)',
              padding: 18,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: '#C8841A', marginBottom: 8 }}>
              ⚠ 此店家可能已在開發中
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#2C2C2A', marginBottom: 4 }}>
              {duplicateLeadPrompt.displayName}
            </div>
            <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.7, marginBottom: 12 }}>
              此店家已由 <b>{duplicateLeadPrompt.existingLead.owner_name || '未指定BD'}</b> 加入欲開發名單。請先查看紀錄，避免 BD 重複開發。
            </div>
            <div style={{ background: '#FAF8F2', border: '1px solid #F0EDE6', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: '6px 10px', fontSize: 11, lineHeight: 1.6 }}>
                <div style={{ color: '#888' }}>BD負責人</div>
                <div style={{ fontWeight: 700 }}>{duplicateLeadPrompt.existingLead.owner_name || '未指定BD'}</div>
                <div style={{ color: '#888' }}>最後追蹤</div>
                <div>{formatFollowUpTime(duplicateLeadPrompt.existingLead.last_follow_up_at)}</div>
                <div style={{ color: '#888' }}>開發狀態</div>
                <div>{leadStatusLabel(duplicateLeadPrompt.existingLead.status)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/pipeline?leadId=${duplicateLeadPrompt.existingLead.id}`)}
                style={{ flex: 1, border: '1px solid #D3D1C7', borderRadius: 7, padding: '9px 12px', background: 'white', color: '#2C2C2A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                查看紀錄
              </button>
              <button
                type="button"
                onClick={() => { void forceAddDuplicateLead() }}
                disabled={leadAddingOsmId === duplicateLeadPrompt.place.osmId}
                style={{ flex: 1, border: 'none', borderRadius: 7, padding: '9px 12px', background: '#C8841A', color: 'white', fontSize: 12, fontWeight: 800, cursor: leadAddingOsmId === duplicateLeadPrompt.place.osmId ? 'wait' : 'pointer' }}
              >
                {leadAddingOsmId === duplicateLeadPrompt.place.osmId ? '加入中…' : '仍要加入'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDuplicateLeadPrompt(null)}
              style={{ marginTop: 10, width: '100%', border: 'none', background: 'transparent', color: '#888', fontSize: 11, cursor: 'pointer' }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 10, flexShrink: 0 }}>
        {[
          { l: '欲開發名單', v: String(stats.leads), d: 'Supabase leads', c: '#185FA5' },
          { l: '正式客戶', v: String(stats.customers), d: 'Supabase customers', c: '#3B6D11' },
          { l: '本次搜尋', v: String(listCount), d: listSource === 'osm' ? 'OSM 店家' : '尚未搜尋', c: '#C8841A' },
          { l: '協作提醒', v: '查重', d: '避免 BD 重複開發', c: '#A32D2D' },
        ].map(s => (
          <div key={s.l} style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 3 }}>{s.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{s.v}</div>
            <div style={{ fontSize: 9, color: s.c, marginTop: 2 }}>{s.d}</div>
          </div>
        ))}
      </div>

      {/* Map + List — flex:1 fills remaining height */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>

        {/* ── Left: Map panel ── */}
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, isolation: 'isolate' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            🗺 地圖（{locEnabled ? '即時定位' : '手動搜尋'}）
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 12px', minHeight: 0 }}>

            {/* Status bar */}
            <div style={{ background: statusBarBg, borderRadius: 6, padding: '5px 9px', fontSize: 10, color: statusBarColor, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 6 }}>{statusText}</span>
              <span onClick={toggleLoc} style={{ cursor: 'pointer', fontWeight: 600, color: '#185FA5', flexShrink: 0 }}>
                {locEnabled ? '關閉' : '開啟'}
              </span>
            </div>

            {/* Address search — always visible */}
            <div style={{ flexShrink: 0, marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  ref={searchInputRef}
                  value={searchAddr}
                  onChange={e => setSearchAddr(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSearch()}
                  placeholder="搜尋地址，例如：台南市中西區赤崁樓"
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, color: '#2C2C2A', outline: 'none' }}
                />
                <button
                  onClick={doSearch}
                  disabled={searching}
                  style={{ padding: '5px 12px', background: searching ? '#aaa' : '#185FA5', color: 'white', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: searching ? 'not-allowed' : 'pointer' }}
                >
                  {searching ? '搜尋中...' : '搜尋'}
                </button>
                {searchLoc && (
                  <button
                    onClick={() => {
                      setSearchLoc(null)
                      setSearchAddr('')
                      setSearchMsg(null)
                      applyListPanel({ source: 'idle', osmPlaces: [], osmRadiusKm: null }, 'clearSearch')
                      clearOsmMapSession()
                      const viewport = (window as typeof window & { __eatq_map?: { getCenter: () => { lat: number; lng: number } } }).__eatq_map?.getCenter?.()
                      if (viewport) syncMapCenters([viewport.lat, viewport.lng], 'clearSearchViewport')
                    }}
                    style={{ padding: '5px 8px', background: '#F0EDE6', color: '#888', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 10, cursor: 'pointer' }}
                  >✕</button>
                )}
              </div>
              {searchMsg && (
                <div style={{ fontSize: 10, color: searchMsg.startsWith('找不到') || searchMsg.startsWith('搜尋失敗') ? '#A32D2D' : '#3B6D11', marginTop: 4 }}>
                  {searchMsg}
                </div>
              )}
            </div>

            {/* Map container — position:relative so LeafletMap fills with absolute inset:0 */}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              {showAreaSearchBtn && (
                <button
                  type="button"
                  onClick={() => { void runAreaOverpassSearch() }}
                  disabled={areaSearching}
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    padding: '6px 14px',
                    background: 'white',
                    color: '#2C2C2A',
                    border: '1px solid #D3D1C7',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: areaSearching ? 'not-allowed' : 'pointer',
                    opacity: areaSearching ? 0.7 : 1,
                    boxShadow: '0 2px 10px rgba(0,0,0,.12)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {areaSearching ? '搜尋中…' : '🔍 搜尋此區域店家'}
                </button>
              )}
              <LeafletMap
                businesses={mapPins}
                onPinClick={id => router.push(`/dashboard/ai?id=${id}`)}
                userLoc={userLoc}
                searchLoc={searchLoc}
                onMapCenterChange={onMapCenterChange}
                key="eatq-leaflet-map"
              />
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, flexShrink: 0 }}>
              {['🟠 待開發', '🔵 欲開發', '🟢 試用中', '⚫ 冷客'].map(l => (
                <span key={l} style={{ fontSize: 9, color: '#888' }}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Business list ── */}
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 2 }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>
              🏪 潛在客戶列表 ({listCount})
              <span style={{ fontSize: 8, color: '#C8841A', marginLeft: 4, fontWeight: 700 }}>
                {MAP_PAGE_BUILD}·{OSM_CARD_UI_REV}·{listSource}
              </span>
              {listSource === 'osm' && listPanel.osmRadiusKm != null && (
                <span style={{ fontSize: 9, color: '#185FA5', marginLeft: 5, fontWeight: 400 }}>
                  {listPanel.osmRadiusKm}km 內 · OpenStreetMap
                </span>
              )}
            </div>
            {showInitialEmptyState ? (
              <span style={{ fontSize: 9, color: '#888' }}>尚未搜尋</span>
            ) : (
              <span style={{ fontSize: 9, color: '#888' }}>區域搜尋</span>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', minHeight: 0, position: 'relative', zIndex: 1 }}>
            {showInitialEmptyState && (
              <div style={{
                minHeight: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '24px 8px',
                boxSizing: 'border-box',
              }}>
                <div style={{ maxWidth: 340 }}>
                  <div style={{ fontSize: 34, marginBottom: 12 }}>🗺️</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2C2C2A', marginBottom: 8 }}>
                    開始搜尋潛在商家
                  </div>
                  <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.8, marginBottom: 14 }}>
                    <div>1. 在左側輸入地點</div>
                    <div>2. 移動地圖</div>
                    <div>3. 點擊「搜尋此區域店家」</div>
                  </div>
                  <div style={{
                    background: '#FAF8F2',
                    border: '1px solid #E8E5DE',
                    borderRadius: 8,
                    padding: '10px 12px',
                    textAlign: 'left',
                    fontSize: 10,
                    color: '#5F5E5A',
                    lineHeight: 1.8,
                  }}>
                    <div style={{ fontWeight: 700, color: '#3B6D11', marginBottom: 4 }}>EatQ 將自動：</div>
                    <div>• 搜尋附近餐飲商家</div>
                    <div>• AI 分析 Google 評論</div>
                    <div>• 判斷可能痛點</div>
                    <div>• 建立欲開發名單</div>
                  </div>
                </div>
              </div>
            )}
            {!showInitialEmptyState && searching && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: 11 }}>
                正在搜尋附近餐飲商家…
              </div>
            )}
            {listSource === 'osm' && listPanel.osmPlaces.length === 0 && !areaSearching && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#888', fontSize: 11 }}>
                此區域找不到商家
              </div>
            )}

            {listPanel.osmPlaces.length > 0 && listPanel.osmPlaces.map(p => {
              const { displayName } = resolveOsmPlaceDisplayName(p)
              const adding = leadAddingOsmId === p.osmId
              const cat = p.category === 'cafe' ? 'cafe' : p.category === 'bakery' ? 'bakery' : 'restaurant'
              return (
                <OsmPlaceCard
                  key={p.osmId}
                  osmId={p.osmId}
                  displayName={displayName}
                  categoryLabel={getOsmCategoryLabel(p.category)}
                  address={p.address ?? ''}
                  distanceLabel={formatDistKm(p.distanceKm)}
                  icon={getIcon(cat)}
                  adding={adding}
                  onOpenDiagnosis={() => goToOsmDiagnosis(p)}
                  onAddLead={() => { void handleAddLeadFromOsm(p) }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function MapPageRemountGate() {
  const remountKey = useSearchParams().get('r') ?? '0'
  return <MapPageContent key={remountKey} />
}

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ color: '#888', fontSize: 12 }}>載入地圖…</div>}>
      <MapPageRemountGate />
    </Suspense>
  )
}
