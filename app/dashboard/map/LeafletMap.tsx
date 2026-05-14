'use client'

import { useEffect, useRef, useState } from 'react'
import type { BusinessRow } from '@/lib/constants'
import { getScore } from '@/lib/constants'

const CAT_ICON: Record<string, string> = {
  restaurant: '🍱', cafe: '☕', night_market: '🍢', bar: '🍺', bakery: '🥐',
}
function getIcon(cat: string) { return CAT_ICON[cat] ?? '🏪' }

interface Props {
  businesses: BusinessRow[]
  onPinClick: (id: string) => void
  userLoc: [number, number] | null
}

export default function LeafletMap({ businesses, onPinClick, userLoc }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then(Lmod => {
      const L = Lmod.default ?? Lmod

      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const center: [number, number] = userLoc ?? [22.9999, 120.2269]
      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: true })
        .setView(center, 13)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      if (userLoc) {
        const pulse = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#185FA5;border:3px solid white;box-shadow:0 0 0 4px rgba(24,95,165,.25)"></div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        L.marker(userLoc, { icon: pulse }).addTo(map).bindPopup('您目前的位置')
      }

      businesses.forEach(b => {
        const score = getScore(b.reviews ?? [])
        const bg = score >= 60 ? '#3B6D11' : score >= 30 ? '#C8841A' : '#888'
        const emoji = getIcon(b.category)
        const icon = L.divIcon({
          html: `<div onclick="" style="width:28px;height:28px;border-radius:50%;background:${bg};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer">${emoji}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
        const marker = L.marker([b.lat, b.lng], { icon }).addTo(map)
        marker.bindPopup(`
          <div style="font-family:sans-serif;min-width:140px">
            <div style="font-size:13px;font-weight:700;margin-bottom:3px">${b.name}</div>
            <div style="font-size:10px;color:#888;margin-bottom:6px">📍 ${b.address}</div>
            <div style="font-size:10px">⭐ ${b.google_rating ?? '—'} · 相關度 ${score}%</div>
            <button onclick="window.__eatq_goto('${b.id}')" style="margin-top:8px;width:100%;padding:5px;background:#C8841A;color:white;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer">🧠 AI 診斷 →</button>
          </div>
        `)
        marker.on('click', () => {
          setTimeout(() => onPinClick(b.id), 10)
        })
      })

      ;(window as any).__eatq_goto = onPinClick
      mapInstanceRef.current = map
      setReady(true)
    })

    return () => {
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapInstanceRef.current || !userLoc) return
    mapInstanceRef.current.setView(userLoc, 14)
  }, [userLoc])

  return (
    <div style={{ position: 'relative', borderRadius: 7, overflow: 'hidden', height: 350 }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      {!ready && (
        <div style={{ position: 'absolute', inset: 0, background: '#F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#888' }}>
          載入地圖中...
        </div>
      )}
    </div>
  )
}
