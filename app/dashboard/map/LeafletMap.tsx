'use client'

import { useEffect, useRef, useState } from 'react'
import type { BusinessRow } from '@/lib/constants'
import { getScore } from '@/lib/constants'

const TAINAN: [number, number] = [22.9999, 120.2269]
const MAP_BUILD = 'v3-area-debug'

const CAT_ICON: Record<string, string> = {
  restaurant: '🍱', cafe: '☕', night_market: '🍢', bar: '🍺', bakery: '🥐',
}
function getIcon(cat: string) { return CAT_ICON[cat] ?? '🏪' }

interface Props {
  businesses: BusinessRow[]
  onPinClick: (id: string) => void
  userLoc: [number, number] | null
  searchLoc?: [number, number] | null
  onMapCenterChange?: (center: { lat: number; lng: number }) => void
}

export default function LeafletMap({ businesses, onPinClick, userLoc, searchLoc, onMapCenterChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)   // position:absolute wrapper
  const mapRef = useRef<HTMLDivElement>(null)          // Leaflet attaches here
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const searchMarkerRef = useRef<any>(null)
  const programmaticPanRef = useRef(0)
  const lastFlownRef = useRef<string | null>(null)
  const onMapCenterChangeRef = useRef(onMapCenterChange)
  const viewportHandlersRef = useRef<{ onMoveEnd: () => void; onDragEnd: () => void; onZoomEnd: () => void } | null>(null)
  const [ready, setReady] = useState(false)

  console.log('[areaDebug] LeafletMap render', { build: MAP_BUILD, ready, hasMapInstance: !!mapInstanceRef.current })

  useEffect(() => {
    onMapCenterChangeRef.current = onMapCenterChange
    console.log('[areaDebug] LeafletMap callback ref updated', { build: MAP_BUILD, hasCallback: !!onMapCenterChange })
  }, [onMapCenterChange])

  function beginProgrammaticPan(map: any) {
    programmaticPanRef.current += 1
    console.log('[areaDebug] beginProgrammaticPan', { panCount: programmaticPanRef.current })
    map.once('moveend', () => {
      programmaticPanRef.current = Math.max(0, programmaticPanRef.current - 1)
      console.log('[areaDebug] programmaticPan moveend done', { panCount: programmaticPanRef.current })
      // moveend 監聽可能在 pan 計數歸零前觸發而被擋下，flyTo 結束後強制同步一次
      reportMapCenter(map, 'programmaticPan-done')
    })
    setTimeout(() => {
      if (programmaticPanRef.current > 0) {
        console.warn('[areaDebug] programmaticPan timeout reset', { was: programmaticPanRef.current })
        programmaticPanRef.current = 0
      }
    }, 2500)
  }

  function attachViewportListeners(map: any) {
    const mapId = map?._leaflet_id
    const onMoveEnd = () => {
      console.log('[areaDebug] moveend fired', { mapId, build: MAP_BUILD })
      reportMapCenter(map, 'moveend')
    }
    const onDragEnd = () => {
      console.log('[areaDebug] dragend fired', { mapId, build: MAP_BUILD })
      reportMapCenter(map, 'dragend')
    }
    const onZoomEnd = () => {
      console.log('[areaDebug] zoomend fired', { mapId, build: MAP_BUILD })
      reportMapCenter(map, 'zoomend')
    }
    map.on('moveend', onMoveEnd)
    map.on('dragend', onDragEnd)
    map.on('zoomend', onZoomEnd)
    console.log('[areaDebug] listener attached OK', {
      mapId,
      build: MAP_BUILD,
      isCurrentInstance: mapInstanceRef.current === map,
      listensMoveend: typeof map.listens === 'function' ? map.listens('moveend') : 'n/a',
    })
    return { onMoveEnd, onDragEnd, onZoomEnd }
  }

  function reportMapCenter(map: any, source: string) {
    const c = map.getCenter()
    const blocked = programmaticPanRef.current > 0
    console.log('[areaDebug] reportMapCenter', { source, blocked, panCount: programmaticPanRef.current, lat: c.lat, lng: c.lng, hasCallback: !!onMapCenterChangeRef.current })
    if (blocked) return
    if (!onMapCenterChangeRef.current) {
      console.warn('[areaDebug] onMapCenterChange ref is missing — callback not passed to LeafletMap')
      return
    }
    onMapCenterChangeRef.current({ lat: c.lat, lng: c.lng })
  }

  // ── Init map (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[areaDebug] init effect start', { build: MAP_BUILD, hasMapRef: !!mapRef.current, hasMapInstance: !!mapInstanceRef.current })
    if (!mapRef.current) {
      console.warn('[areaDebug] map init skipped: no mapRef')
      return
    }
    // Use a ref-based generation counter so cleanup can cancel async callbacks
    // even across the StrictMode double-invoke cycle
    const initId = Date.now() + Math.random()
    const el = mapRef.current
    ;(el as any).__eatq_initId = initId

    import('leaflet').then(Lmod => {
      console.log('[areaDebug] leaflet import done', { initId, domInitId: (el as any).__eatq_initId, mapRefLive: mapRef.current === el })
      if (!mapRef.current || mapRef.current !== el) {
        console.warn('[areaDebug] then aborted: mapRef gone or replaced')
        return
      }
      if ((el as any).__eatq_initId !== initId) {
        console.warn('[areaDebug] then aborted: stale initId', { initId, domInitId: (el as any).__eatq_initId })
        return
      }

      const L = Lmod.default ?? Lmod

      if (!document.querySelector('link[data-leaflet]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.setAttribute('data-leaflet', '1')
        document.head.appendChild(link)
      }

      if (!document.querySelector('style[data-eatq-pulse]')) {
        const style = document.createElement('style')
        style.setAttribute('data-eatq-pulse', '1')
        style.textContent = `
          @keyframes eatq-pulse {
            0%   { transform:scale(1); opacity:.7; }
            100% { transform:scale(3.5); opacity:0; }
          }
          .eatq-ring { position:absolute; inset:-8px; border-radius:50%;
            background:rgba(24,95,165,.35); animation:eatq-pulse 2s ease-out infinite; }
          .eatq-ring2 { position:absolute; inset:-4px; border-radius:50%;
            background:rgba(24,95,165,.2); animation:eatq-pulse 2s ease-out .6s infinite; }
        `
        document.head.appendChild(style)
      }

      // _leaflet_id is undefined BEFORE L.map() — that is normal
      const beforeId = (el as any)._leaflet_id
      console.log('[areaDebug] before L.map', { _leaflet_id: beforeId, initId })

      let map: any
      try {
        if (beforeId != null) {
          console.log('[areaDebug] clearing stale _leaflet_id on el', { beforeId })
          delete (el as any)._leaflet_id
        }
        map = L.map(el, {
          zoomControl: true,
          scrollWheelZoom: true,
          dragging: true,
          attributionControl: false,
        }).setView(TAINAN, 13)
        console.log('[areaDebug] L.map OK', {
          mapId: map._leaflet_id,
          center: map.getCenter(),
          isSameAsRef: mapInstanceRef.current === map,
        })
      } catch (e: any) {
        console.error('[areaDebug] L.map FAILED', e?.message ?? e)
        return
      }

      try {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
        L.control.attribution({ prefix: '© <a href="https://osm.org">OSM</a>' }).addTo(map)
        map.dragging?.enable()
        console.log('[areaDebug] tiles + dragging OK', { dragging: !!map.dragging?.enabled() })
      } catch (e: any) {
        console.error('[areaDebug] tileLayer FAILED', e?.message ?? e)
        map.remove()
        return
      }

      mapInstanceRef.current = map
      ;(window as any).__eatq_map = map
      ;(window as any).__eatq_goto = (id: string) => onPinClick(id)

      const handlers = attachViewportListeners(map)
      viewportHandlersRef.current = handlers

      setReady(true)
      console.log('[areaDebug] setReady(true)', { mapId: map._leaflet_id })

      requestAnimationFrame(() => { map.invalidateSize(false) })
    }).catch(err => {
      console.error('[areaDebug] leaflet import FAILED', err)
    })

    return () => {
      console.log('[areaDebug] init effect cleanup', { build: MAP_BUILD })
      ;(el as any).__eatq_initId = null
      const map = mapInstanceRef.current
      if (map && viewportHandlersRef.current) {
        map.off('moveend', viewportHandlersRef.current.onMoveEnd)
        map.off('dragend', viewportHandlersRef.current.onDragEnd)
        map.off('zoomend', viewportHandlersRef.current.onZoomEnd)
        viewportHandlersRef.current = null
      }
      if (map) {
        map.remove()
        mapInstanceRef.current = null
        if ((window as any).__eatq_map === map) (window as any).__eatq_map = null
      }
      setReady(false)
    }
  }, [])

  // ── ResizeObserver → keep map sized correctly ─────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current
    const el = containerRef.current
    if (!map || !el || !ready) return

    const ro = new ResizeObserver(() => { map.invalidateSize(false) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready])

  // ── Business markers ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !ready) return

    import('leaflet').then(Lmod => {
      const L = Lmod.default ?? Lmod
      markersRef.current.forEach(m => map.removeLayer(m))
      markersRef.current = []

      businesses.forEach(b => {
        const score = getScore(b.reviews ?? [])
        const bg = score >= 60 ? '#3B6D11' : score >= 30 ? '#C8841A' : '#888780'
        const emoji = getIcon(b.category)

        const icon = L.divIcon({
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer">${emoji}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })

        const marker = L.marker([b.lat, b.lng], { icon }).addTo(map)
        marker.bindPopup(
          `<div style="font-family:sans-serif;min-width:150px;font-size:12px">
            <div style="font-weight:700;margin-bottom:3px">${b.name}</div>
            <div style="color:#888;font-size:10px;margin-bottom:4px">📍 ${b.address}</div>
            <div style="font-size:10px;margin-bottom:8px">⭐${b.google_rating ?? '—'} · 相關度 ${score}%</div>
            <button onclick="window.__eatq_goto('${b.id}')" style="width:100%;padding:5px 0;background:#C8841A;color:white;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">🧠 AI 診斷 →</button>
          </div>`,
          { maxWidth: 200 }
        )
        marker.on('click', () => setTimeout(() => onPinClick(b.id), 10))
        markersRef.current.push(marker)
      })
    })
  }, [businesses, ready])

  // ── User location (pulsing blue) ──────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !ready) return

    import('leaflet').then(Lmod => {
      const L = Lmod.default ?? Lmod
      if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null }

      if (userLoc) {
        const flyKey = `user:${userLoc[0]},${userLoc[1]}`
        if (lastFlownRef.current !== flyKey) {
          lastFlownRef.current = flyKey
          beginProgrammaticPan(map)
          map.flyTo(userLoc, 14, { duration: 1 })
        }
        const pulse = L.divIcon({
          html: `<div style="position:relative;width:20px;height:20px">
            <div class="eatq-ring"></div><div class="eatq-ring2"></div>
            <div style="position:absolute;inset:0;border-radius:50%;background:#185FA5;border:3px solid white;box-shadow:0 2px 8px rgba(24,95,165,.5)"></div>
          </div>`,
          className: '', iconSize: [20, 20], iconAnchor: [10, 10],
        })
        const m = L.marker(userLoc, { icon: pulse }).addTo(map)
        m.bindPopup('您目前的位置')
        userMarkerRef.current = m
      } else if (!searchLoc) {
        const flyKey = 'tainan'
        if (lastFlownRef.current !== flyKey) {
          lastFlownRef.current = flyKey
          beginProgrammaticPan(map)
          map.flyTo(TAINAN, 13, { duration: 1 })
        }
      }
    })
  }, [userLoc, ready])

  // ── Search result (red pin) ───────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !ready) return

    import('leaflet').then(Lmod => {
      const L = Lmod.default ?? Lmod
      if (searchMarkerRef.current) { map.removeLayer(searchMarkerRef.current); searchMarkerRef.current = null }

      if (searchLoc) {
        const flyKey = `search:${searchLoc[0]},${searchLoc[1]}`
        if (lastFlownRef.current !== flyKey) {
          lastFlownRef.current = flyKey
          beginProgrammaticPan(map)
          map.flyTo(searchLoc, 15, { duration: 1 })
        }
        const redPin = L.divIcon({
          html: `<div style="position:relative;width:24px;height:24px">
            <div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#D32F2F;border:3px solid white;box-shadow:0 2px 8px rgba(211,47,47,.5);transform:rotate(-45deg)"></div>
          </div>`,
          className: '', iconSize: [24, 24], iconAnchor: [12, 24],
        })
        const m = L.marker(searchLoc, { icon: redPin }).addTo(map)
        m.bindPopup('搜尋位置')
        searchMarkerRef.current = m
      }
    })
  }, [searchLoc, ready])

  return (
    // position:absolute inset:0 fills the nearest position:relative ancestor
    // (the wrapper div in page.tsx with flex:1 position:relative minHeight:0)
    // This avoids height:100% on a flex child, which Chrome sometimes resolves to 0
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 7, overflow: 'hidden' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
      </div>
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, background: '#F0EDE6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>
          🗺 載入地圖中...
        </div>
      )}
    </div>
  )
}
