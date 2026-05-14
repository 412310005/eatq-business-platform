'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CATS, DIRS, getCatCounts, getScore, buildScript, type BusinessRow, type DirKey, type CatId } from '@/lib/constants'

function AIContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [biz, setBiz] = useState<BusinessRow | null>(null)
  const [noise, setNoise] = useState(true)
  const [dirs, setDirs] = useState<Record<DirKey, boolean>>({ food: false, queue: false, digital: false, pay: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = params.get('id')
    supabase.from('businesses').select('*, reviews(*)').then(({ data }) => {
      const list = (data ?? []) as BusinessRow[]
      if (id) {
        const found = list.find(b => b.id === id)
        setBiz(found ?? list[0] ?? null)
      } else {
        setBiz(list[0] ?? null)
      }
      setLoading(false)
    })
    setDirs({ food: false, queue: false, digital: false, pay: false })
  }, [params])

  function goEmail() {
    if (!biz) return
    sessionStorage.setItem('eatq_dirs', JSON.stringify(dirs))
    router.push(`/dashboard/email?id=${biz.id}`)
  }

  async function addToPipeline() {
    if (!biz) return
    const { data: existing } = await supabase.from('pipeline').select('id').eq('business_id', biz.id).single()
    if (existing) {
      alert(`⚠️ ${biz.name} 已在欲開發名單中！`)
      router.push('/dashboard/pipeline')
      return
    }
    await supabase.from('pipeline').insert({
      business_id: biz.id,
      status: 'prospect',
      assigned_to: '00000000-0000-0000-0000-000000000000',
      priority: 'medium',
      estimated_value: 0,
      notes: '',
      contact_name: '',
      contact_phone: '',
      contact_line: '',
      said: false,
      sent: false,
      other_user: '',
      dirs,
    })
    router.push('/dashboard/pipeline')
  }

  const reviews = biz?.reviews ?? []
  const counts = getCatCounts(reviews)
  const score = getScore(reviews)
  const activeDirs = (Object.keys(dirs) as DirKey[]).filter(k => dirs[k])

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {/* Left: reviews */}
      <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>
            🧠 AI 分析 — <span style={{ color: '#C8841A' }}>{biz?.name ?? '—'}</span>
          </div>
          <label style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <input type="checkbox" checked={noise} onChange={e => setNoise(e.target.checked)} /> 隱藏一般評論
          </label>
        </div>
        <div style={{ padding: '10px 12px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {!biz ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#888', fontSize: 11 }}>尚無商家資料</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {CATS.map(c => counts[c.id as CatId] > 0 && (
                  <span key={c.id} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: c.bg, color: c.tc }}>{c.label} {counts[c.id as CatId]}則</span>
                ))}
              </div>
              {CATS.map(c => {
                const rs = reviews.filter(r => r.category === c.id)
                if (rs.length === 0) return null
                if (c.id === 'none' && noise) return null
                return (
                  <div key={c.id}>
                    <div style={{ fontSize: 9, color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, margin: '6px 0 3px' }}>{c.label}</div>
                    {rs.map(r => (
                      <div key={r.id} style={{ padding: '7px 9px', borderLeft: `3px solid ${c.color}`, background: c.bg, borderRadius: '0 6px 6px 0', marginBottom: 4, fontSize: 11, lineHeight: 1.5, color: '#2C2C2A' }}>{r.text}</div>
                    ))}
                  </div>
                )
              })}
              {reviews.length === 0 && <div style={{ color: '#888', fontSize: 11, fontStyle: 'italic' }}>此商家尚無評論資料</div>}
              <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
                <button onClick={goEmail} style={{ flex: 1, padding: 7, background: '#C8841A', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✉️ 去推銷信</button>
                <button onClick={addToPipeline} style={{ flex: 1, padding: 7, background: '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🎯 加入欲開發</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right: diagnosis + direction selector */}
      <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600 }}>📊 診斷評分 · 選擇推銷方向</div>
        <div style={{ padding: '10px 12px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {!biz ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 11 }}>← 請先從地圖選擇商家</div>
          ) : (
            <>
              <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>勾選推銷方向（可多選）</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 10 }}>
                {(Object.keys(DIRS) as DirKey[]).map(k => {
                  const d = DIRS[k]
                  const on = dirs[k]
                  const catCount = counts[k as CatId] ?? 0
                  return (
                    <div
                      key={k}
                      onClick={() => setDirs(prev => ({ ...prev, [k]: !prev[k] }))}
                      style={{ padding: '7px 9px', border: `2px solid ${on ? d.color : '#E8E5DE'}`, borderRadius: 7, background: on ? d.bg : 'white', cursor: 'pointer', display: 'flex', alignItems: 'start', gap: 6 }}
                    >
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${on ? d.color : '#D3D1C7'}`, background: on ? d.color : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        {on && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: on ? d.tc : '#888' }}>{d.label}</div>
                        {catCount > 0
                          ? <div style={{ fontSize: 9, color: on ? d.tc : '#aaa' }}>偵測到 {catCount} 則</div>
                          : <div style={{ fontSize: 9, color: '#ccc' }}>尚未偵測</div>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Score bars */}
              {([
                ['剩食相關度', counts.food > 0 ? Math.min(95, counts.food * 35) : 10, '#C8841A'],
                ['排隊/出餐', counts.queue > 0 ? 75 : 15, '#185FA5'],
                ['數位化需求', counts.digital > 0 ? 70 : 20, '#534AB7'],
                ['EatQ 現在契合度', score, '#3B6D11'],
              ] as [string, number, string][]).map(([label, val, color]) => (
                <div key={label} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: '#5F5E5A' }}>{label}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color }}>{val}%</span>
                  </div>
                  <div style={{ height: 4, background: '#F0EDE6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${val}%`, background: color }} />
                  </div>
                </div>
              ))}

              <div style={{ height: 1, background: '#F0EDE6', margin: '8px 0' }} />
              <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 5 }}>建議電話開場</div>
              <div
                style={{ background: '#FFFDF9', border: '1px solid #FAC775', borderRadius: 6, padding: 9, fontSize: 11, lineHeight: 1.7, color: '#2C2C2A', fontStyle: 'italic' }}
                dangerouslySetInnerHTML={{ __html: buildScript(biz.name, reviews, dirs, '林○○') }}
              />
              {activeDirs.length > 0
                ? <button onClick={goEmail} style={{ width: '100%', marginTop: 8, padding: 7, background: '#C8841A', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✉️ 用勾選方向生成推銷信 →</button>
                : <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 6 }}>↑ 先勾選推銷方向再生成</div>
              }
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AIPage() {
  return (
    <Suspense fallback={<div style={{ color: '#888', fontSize: 12 }}>載入中...</div>}>
      <AIContent />
    </Suspense>
  )
}
