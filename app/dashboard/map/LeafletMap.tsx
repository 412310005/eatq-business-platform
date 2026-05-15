'use client'

import { useEffect, useRef, useState } from 'react'
import type { BusinessRow } from '@/lib/constants'
import { getScore } from '@/lib/constants'

const TAINAN: [number, number] = [22.9999, 120.2269]

const CAT_ICON: Record<string, string> = {
  restaurant: '🍱', cafe: '☕', night_market: '🍢', bar: '🍺', bakery: '🥐',
}
function getIcon(cat: string) { return CAT_ICON[cat] ?? '🏪' }

interface Props {
  businesses: BusinessRow[]
  onPinClick: (id: string) => void
  userLoc: [number, number] | null
  searchLoc?: [number, number] | null
}

export default function LeafletMap({ businesses, onPinClick, userLoc, searchLoc }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)   // position:absolute wrapper
  const mapRef = useRef<HTMLDivElement>(null)          // Leaflet attaches here
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const searchMarkerRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  // ── Init map (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    // Use a ref-based generation counter so cleanup can cancel async callbacks
    // even across the StrictMode double-invoke cycle
    const initId = Date.now() + Math.random()
    ;(mapRef.current as any).__eatq_initId = initId

    import('leaflet').then(Lmod => {
      if (!mapRef.current || mapInstanceRef.current) return
      // If a newer init has started (cleanup ran + re-mount), abort this one
      if ((mapRef.current as any).__eatq_initId !== initId) return

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

      // Clear any stale Leaflet attachment (HMR or incomplete cleanup)
      const existingId = (mapRef.current as any)._leaflet_id
      console.log('[LeafletMap v2] init, _leaflet_id=', existingId, 'initId match=', (mapRef.current as any).__eatq_initId === initId)
      if (existingId) {
        delete (mapRef.current as any)._leaflet_id
        console.log('[LeafletMap v2] cleared stale _leaflet_id')
      }

      let map: any
      try {
        map = L.map(mapRef.current!, {
          zoomControl: true,
          scrollWheelZoom: true,
          attributionControl: false,
        }).setView(TAINAN, 13)
      } catch (e: any) {
        console.warn('[LeafletMap v2] L.map() failed:', e.message)
        return
      }

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      L.control.attribution({ prefix: '© <a href="https://osm.org">OSM</a>' }).addTo(map)

      ;(window as any).__eatq_goto = (id: string) => onPinClick(id)
      mapInstanceRef.current = map
      setReady(true)

      requestAnimationFrame(() => { map.invalidateSize(false) })
    })

    return () => {
      // Invalidate any pending init callback for this DOM node
      if (mapRef.current) {
        (mapRef.current as any).__eatq_initId = null
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
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
        map.flyTo(userLoc, 14, { duration: 1 })
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
        map.flyTo(TAINAN, 13, { duration: 1 })
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
        map.flyTo(searchLoc, 15, { duration: 1 })
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
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, background: '#F0EDE6', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>
          🗺 載入地圖中...
        </div>
      )}
    </div>
  )
}
