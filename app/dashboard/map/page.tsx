'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { CATS, getScore, getCatCounts, type BusinessRow, type CatId } from '@/lib/constants'

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'absolute', inset: 0, background: '#F0EDE6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>
      🗺 載入地圖中...
    </div>
  ),
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

export default function MapPage() {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [noise, setNoise] = useState(true)
  const [locEnabled, setLocEnabled] = useState(true)
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null)
  const [locStatus, setLocStatus] = useState<LocStatus>('idle')
  const [stats, setStats] = useState({ clients: 0, pipeline: 0 })
  const [geoAddress, setGeoAddress] = useState<string | null>(null)
  const [searchAddr, setSearchAddr] = useState('')
  const [searchLoc, setSearchLoc] = useState<[number, number] | null>(null)
  const [searchRadius, setSearchRadius] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load Supabase data
  useEffect(() => {
    async function load() {
      const [{ data: biz, error }, { count: clientCount }, { count: pipeCount }] = await Promise.all([
        supabase.from('businesses').select('*, reviews(*)'),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('pipeline').select('*', { count: 'exact', head: true }),
      ])
      if (error) console.error('Supabase error:', error)
      setBusinesses((biz ?? []) as BusinessRow[])
      setStats({ clients: clientCount ?? 0, pipeline: pipeCount ?? 0 })
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
      setLocEnabled(true); setLocStatus('idle'); setSearchLoc(null); setSearchAddr(''); setSearchRadius(null)
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

      // Expand radius until we find nearby businesses: 1 → 1.5 → 2 → 3 km
      const RADII = [1, 1.5, 2, 3]
      let chosenRadius = RADII[RADII.length - 1]
      for (const r of RADII) {
        const nearby = businesses.filter(b => haversine(loc, [b.lat, b.lng]) <= r)
        console.log(`[doSearch] radius ${r}km → ${nearby.length} businesses`)
        if (nearby.length > 0) { chosenRadius = r; break }
      }

      setSearchLoc(loc)
      setSearchRadius(chosenRadius)
      setSearchMsg(`已找到位置，顯示 ${chosenRadius}km 內商家`)
    } catch (err) {
      console.error('[doSearch] error:', err)
      setSearchMsg('搜尋失敗，請稍後再試')
    }
    setSearching(false)
  }

  // ── Derived: shown businesses ──────────────────────────────────────────
  const center = searchLoc ?? userLoc
  const filtered = noise ? businesses.filter(b => getScore(b.reviews ?? []) >= 30) : businesses

  // Sort by distance if we have a center
  const sorted = center
    ? [...filtered].sort((a, b) => haversine(center, [a.lat, a.lng]) - haversine(center, [b.lat, b.lng]))
    : filtered

  // Filter by radius only when search was done
  const shown = (searchLoc && searchRadius !== null)
    ? (() => {
        const inRadius = sorted.filter(b => haversine(searchLoc, [b.lat, b.lng]) <= searchRadius)
        return inRadius.length > 0 ? inRadius : sorted  // fallback to all sorted
      })()
    : sorted

  // ── Status bar text ────────────────────────────────────────────────────
  const statusBarBg = (locStatus === 'ok' || locStatus === 'requesting') ? '#E6F1FB' : '#F1EFE8'
  const statusBarColor = (locStatus === 'ok' || locStatus === 'requesting') ? '#0C447C' : '#5F5E5A'
  const statusText =
    searchLoc ? `🔍 搜尋結果：${searchAddr} · ${searchRadius}km 內` :
    locStatus === 'requesting' ? '📍 定位中...' :
    locStatus === 'ok' ? `📍 ${geoAddress ?? '已取得定位'}` :
    locStatus === 'denied' ? '📌 定位被拒絕，可輸入地址搜尋' :
    locStatus === 'unavailable' ? '📌 不支援定位，請輸入地址搜尋' :
    locEnabled ? '📍 台南市附近' : '📌 請輸入地址搜尋'

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    // height: calc(100vh - 44px topbar - 1px border - 26px content padding)
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 71px)' }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 10, flexShrink: 0 }}>
        {[
          { l: '本月新增', v: '23',                   d: '↑ +8',   c: '#3B6D11' },
          { l: '試用中',   v: String(stats.clients),  d: '正式客戶', c: '#C8841A' },
          { l: '欲開發',   v: String(stats.pipeline), d: '追蹤中',  c: '#185FA5' },
          { l: '剩食減少', v: '2.4噸',               d: '環境指標', c: '#3B6D11' },
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
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                    onClick={() => { setSearchLoc(null); setSearchAddr(''); setSearchRadius(null); setSearchMsg(null) }}
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
              <LeafletMap
                businesses={shown}
                onPinClick={id => router.push(`/dashboard/ai?id=${id}`)}
                userLoc={userLoc}
                searchLoc={searchLoc}
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
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>
              🏪 潛在客戶列表 ({shown.length})
              {searchLoc && searchRadius !== null && (
                <span style={{ fontSize: 9, color: '#185FA5', marginLeft: 5, fontWeight: 400 }}>
                  {searchRadius}km 內 · 依距離排序
                </span>
              )}
              {!searchLoc && center && (
                <span style={{ fontSize: 9, color: '#3B6D11', marginLeft: 5, fontWeight: 400 }}>依距離排序</span>
              )}
            </div>
            <label style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="checkbox" checked={noise} onChange={e => setNoise(e.target.checked)} /> 過濾低相關
            </label>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', minHeight: 0 }}>
            {businesses.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#A32D2D', fontSize: 11 }}>
                ⚠ 無法讀取商家資料，請確認 Supabase 連線
              </div>
            )}
            {shown.length === 0 && businesses.length > 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#888', fontSize: 11 }}>
                {searchLoc ? `搜尋範圍（${searchRadius}km）內無符合商家` : '所有商家相關度偏低（低於 30%）'}
              </div>
            )}

            {shown.map(b => {
              const score = getScore(b.reviews ?? [])
              const counts = getCatCounts(b.reviews ?? [])
              const sc = score >= 60 ? '#3B6D11' : score >= 30 ? '#C8841A' : '#A32D2D'
              const dist = center ? haversine(center, [b.lat, b.lng]) : null
              return (
                <div
                  key={b.id}
                  onClick={() => router.push(`/dashboard/ai?id=${b.id}`)}
                  style={{ display: 'flex', alignItems: 'start', gap: 8, padding: '8px 9px', border: '1px solid #F0EDE6', borderRadius: 7, cursor: 'pointer', marginBottom: 5, background: 'white' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#FAEEDA')}
                  onMouseOut={e => (e.currentTarget.style.background = 'white')}
                >
                  <span style={{ fontSize: 18, marginTop: 2 }}>{getIcon(b.category)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</div>
                      {dist !== null && (
                        <span style={{ fontSize: 9, color: '#185FA5', flexShrink: 0, marginLeft: 4, fontWeight: 600 }}>
                          {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>
                      📍{b.address} · ⭐{b.google_rating}({b.review_count ?? 0}則)
                    </div>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                      {CATS.filter(c => c.id !== 'none' && counts[c.id as CatId] > 0).map(c => (
                        <span key={c.id} style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: c.bg, color: c.tc }}>
                          {c.label} {counts[c.id as CatId]}則
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: '#888' }}>相關度</span>
                      <div style={{ flex: 1, height: 3, background: '#F0EDE6', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${score}%`, background: sc }} />
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sc }}>{score}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {noise && shown.length > 0 && !searchLoc && (
              <div style={{ fontSize: 9, color: '#888', textAlign: 'center', paddingBottom: 4 }}>低相關商家已隱藏</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
