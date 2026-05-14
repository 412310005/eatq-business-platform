'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { CATS, getScore, getCatCounts, type BusinessRow, type CatId } from '@/lib/constants'

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

const CAT_ICON: Record<string, string> = {
  restaurant: '🍱', cafe: '☕', night_market: '🍢', bar: '🍺', bakery: '🥐',
}
function getIcon(cat: string) { return CAT_ICON[cat] ?? '🏪' }

export default function MapPage() {
  const router = useRouter()
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [noise, setNoise] = useState(true)
  const [loc, setLoc] = useState(true)
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null)
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')
  const [stats, setStats] = useState({ clients: 0, pipeline: 0 })

  useEffect(() => {
    async function load() {
      const [{ data: biz }, { count: clientCount }, { count: pipeCount }] = await Promise.all([
        supabase.from('businesses').select('*, reviews(*)'),
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('pipeline').select('*', { count: 'exact', head: true }),
      ])
      setBusinesses((biz ?? []) as BusinessRow[])
      setStats({ clients: clientCount ?? 0, pipeline: pipeCount ?? 0 })
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (loc && locStatus === 'idle') {
      setLocStatus('loading')
      if (!navigator.geolocation) { setLocStatus('denied'); return }
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserLoc([pos.coords.latitude, pos.coords.longitude])
          setLocStatus('ok')
        },
        () => setLocStatus('denied'),
        { timeout: 8000 }
      )
    }
  }, [loc])

  function toggleLoc() {
    if (loc) {
      setLoc(false)
      setUserLoc(null)
      setLocStatus('idle')
    } else {
      setLoc(true)
      setLocStatus('idle')
    }
  }

  const shown = noise ? businesses.filter(b => getScore(b.reviews ?? []) >= 30) : businesses

  const locLabel = locStatus === 'loading' ? '📍 定位中...'
    : locStatus === 'ok' ? `📍 已定位`
    : locStatus === 'denied' ? '📌 定位失敗'
    : loc ? '📍 台南市附近' : '📌 台南市（手動）'

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 12 }}>
        {[
          { l: '本月新增', v: '23', d: '↑ +8', c: '#3B6D11' },
          { l: '試用中', v: String(stats.clients), d: '正式客戶', c: '#C8841A' },
          { l: '欲開發', v: String(stats.pipeline), d: '追蹤中', c: '#185FA5' },
          { l: '剩食減少', v: '2.4噸', d: '環境指標', c: '#3B6D11' },
        ].map(s => (
          <div key={s.l} style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{s.v}</div>
            <div style={{ fontSize: 9, color: s.c, marginTop: 2 }}>{s.d}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Map panel */}
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600 }}>
            🗺 地圖（{loc ? '即時定位' : '手動設定'}）
          </div>
          <div style={{ padding: '10px 12px' }}>
            {/* Location status bar */}
            <div style={{ background: loc && locStatus !== 'denied' ? '#E6F1FB' : '#F1EFE8', borderRadius: 6, padding: '6px 9px', fontSize: 10, color: loc && locStatus !== 'denied' ? '#0C447C' : '#5F5E5A', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{locLabel}</span>
              <span onClick={toggleLoc} style={{ cursor: 'pointer', fontWeight: 600 }}>{loc ? '關閉' : '開啟'}</span>
            </div>

            {/* Real Leaflet map */}
            <LeafletMap
              businesses={shown}
              onPinClick={id => router.push(`/dashboard/ai?id=${id}`)}
              userLoc={userLoc}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {['🟠 待開發', '🔵 欲開發', '🟢 試用中', '⚫ 冷客'].map(l => (
                <span key={l} style={{ fontSize: 9, color: '#888' }}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Business list */}
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>🏪 潛在客戶列表</div>
            <label style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <input type="checkbox" checked={noise} onChange={e => setNoise(e.target.checked)} /> 過濾低相關
            </label>
          </div>
          <div style={{ padding: '10px 12px', maxHeight: 420, overflowY: 'auto' }}>
            {shown.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#888', fontSize: 11 }}>尚無商家資料</div>
            )}
            {shown.map(b => {
              const score = getScore(b.reviews ?? [])
              const counts = getCatCounts(b.reviews ?? [])
              const sc = score >= 60 ? '#3B6D11' : score >= 30 ? '#C8841A' : '#A32D2D'
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
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name}</div>
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
            {noise && shown.length > 0 && (
              <div style={{ fontSize: 9, color: '#888', textAlign: 'center', padding: 2 }}>低相關商家已隱藏</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
