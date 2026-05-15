'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CATS, DIRS, getCatCounts, getScore, buildScript, type BusinessRow, type DirKey, type CatId } from '@/lib/constants'

// ── Toast helper ──────────────────────────────────────────────────────────────
function Toast({ msg, color }: { msg: string; color: string }) {
  return (
    <div style={{
      position: 'fixed', top: 56, right: 16, zIndex: 9999,
      background: color, color: 'white',
      padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,.2)',
      animation: 'eatq-fadein .2s ease',
    }}>
      {msg}
      <style>{`@keyframes eatq-fadein{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

function AIContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [biz, setBiz] = useState<BusinessRow | null>(null)
  const [noise, setNoise] = useState(true)
  const [dirs, setDirs] = useState<Record<DirKey, boolean>>({ food: false, queue: false, digital: false, pay: false })
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)

  function showToast(msg: string, color = '#3B6D11', ms = 2500) {
    setToast({ msg, color })
    setTimeout(() => setToast(null), ms)
  }

  // Load initial data
  useEffect(() => {
    const id = params.get('id')
    console.log('[AI] loading, id=', id)
    supabase.from('businesses').select('*, reviews(*)').then(({ data, error }) => {
      if (error) {
        console.error('[AI] supabase error:', error)
        showToast('❌ 載入失敗：' + error.message, '#A32D2D')
      }
      const list = (data ?? []) as BusinessRow[]
      console.log('[AI] loaded', list.length, 'businesses')
      const found = id ? list.find(b => b.id === id) : null
      setBiz(found ?? list[0] ?? null)
      setLoading(false)
    })
    setDirs({ food: false, queue: false, digital: false, pay: false })
  }, [params])

  async function reload() {
    if (!biz || reloading) return
    console.log('[reload] fetching id=', biz.id)
    setReloading(true)
    const { data, error } = await supabase
      .from('businesses')
      .select('*, reviews(*)')
      .eq('id', biz.id)
      .single()
    setReloading(false)
    if (error) {
      console.error('[reload] error:', error)
      showToast('❌ 重新分析失敗：' + error.message, '#A32D2D')
      return
    }
    if (data) {
      setBiz(data as BusinessRow)
      console.log('[reload] updated biz reviews:', (data as BusinessRow).reviews?.length)
      showToast('✅ 已重新分析')
    }
  }

  function goEmail() {
    if (!biz) return
    sessionStorage.setItem('eatq_dirs', JSON.stringify(dirs))
    router.push(`/dashboard/email?id=${biz.id}`)
  }

  async function addToPipeline() {
    if (!biz || adding) return
    console.log('[addToPipeline] start, biz.id=', biz.id)
    setAdding(true)

    // Check duplicate
    const { data: existing, error: checkErr } = await supabase
      .from('pipeline')
      .select('id')
      .eq('business_id', biz.id)
      .maybeSingle()

    if (checkErr) {
      console.error('[addToPipeline] check error:', checkErr)
    }

    if (existing) {
      console.log('[addToPipeline] already exists')
      setAdding(false)
      showToast(`⚠️ ${biz.name} 已在欲開發名單中`, '#C8841A')
      setTimeout(() => router.push('/dashboard/pipeline'), 1200)
      return
    }

    const payload = {
      business_id: biz.id,
      status: 'prospect',
      priority: 'medium',
      estimated_value: 0,
      notes: '',
      assigned_to: '00000000-0000-0000-0000-000000000001',
    }
    console.log('[addToPipeline] inserting:', payload)

    const { error } = await supabase.from('pipeline').insert(payload)
    setAdding(false)

    if (error) {
      console.error('[addToPipeline] insert error:', error)
      showToast(`❌ 新增失敗：${error.message}`, '#A32D2D', 5000)
      return
    }

    console.log('[addToPipeline] success')
    showToast(`✅ ${biz.name} 已加入欲開發名單！`)
    setTimeout(() => router.push('/dashboard/pipeline'), 1500)
  }

  const reviews = biz?.reviews ?? []
  const counts = getCatCounts(reviews)
  const score = getScore(reviews)
  const activeDirs = (Object.keys(dirs) as DirKey[]).filter(k => dirs[k])

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    <>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, height: 'calc(100vh - 71px)' }}>

        {/* ── Left: review panel ── */}
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>
              🧠 AI 分析 — <span style={{ color: '#C8841A' }}>{biz?.name ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={reload}
                disabled={reloading}
                style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #D3D1C7', borderRadius: 5, background: reloading ? '#F8F5EF' : 'white', cursor: reloading ? 'not-allowed' : 'pointer', color: '#5F5E5A' }}
              >
                {reloading ? '分析中...' : '🔄 重新分析'}
              </button>
              <label style={{ fontSize: 10, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                <input type="checkbox" checked={noise} onChange={e => setNoise(e.target.checked)} /> 隱藏一般評論
              </label>
            </div>
          </div>

          {/* Scrollable review area */}
          <div style={{ flex: 1, minHeight: 0, padding: '10px 12px', overflowY: 'auto' }}>
            {!biz ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#888', fontSize: 11 }}>尚無商家資料</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {CATS.map(c => counts[c.id as CatId] > 0 && (
                    <span key={c.id} style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: c.bg, color: c.tc }}>
                      {c.label} {counts[c.id as CatId]}則
                    </span>
                  ))}
                </div>
                {CATS.map(c => {
                  const rs = reviews.filter(r => r.category === c.id)
                  if (rs.length === 0) return null
                  if (c.id === 'none' && noise) return null
                  return (
                    <div key={c.id} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: c.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, margin: '6px 0 4px' }}>{c.label}</div>
                      {rs.map(r => (
                        <div key={r.id} style={{ padding: '8px 10px', borderLeft: `3px solid ${c.color}`, background: c.bg, borderRadius: '0 6px 6px 0', marginBottom: 8, fontSize: 11, lineHeight: 1.65, color: '#2C2C2A' }}>{r.text}</div>
                      ))}
                    </div>
                  )
                })}
                {reviews.length === 0 && <div style={{ color: '#888', fontSize: 11, fontStyle: 'italic' }}>此商家尚無評論資料</div>}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 5, marginTop: 12, paddingTop: 10, borderTop: '1px solid #F0EDE6' }}>
                  <button
                    onClick={goEmail}
                    style={{ flex: 1, padding: 8, background: '#C8841A', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ✉️ 去推銷信
                  </button>
                  <button
                    onClick={addToPipeline}
                    disabled={adding}
                    style={{ flex: 1, padding: 8, background: adding ? '#7DA84E' : '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer' }}
                  >
                    {adding ? '加入中...' : '🎯 加入欲開發'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right: diagnosis panel ── */}
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            📊 診斷評分 · 選擇推銷方向
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: '10px 12px', overflowY: 'auto' }}>
            {!biz ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 11 }}>← 請先從地圖選擇商家</div>
            ) : (
              <>
                <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>勾選推銷方向（可多選）</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 12 }}>
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
                  ['排隊/出餐',   counts.queue > 0 ? 75 : 15, '#185FA5'],
                  ['數位化需求', counts.digital > 0 ? 70 : 20, '#534AB7'],
                  ['EatQ 現在契合度', score, '#3B6D11'],
                ] as [string, number, string][]).map(([label, val, color]) => (
                  <div key={label} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#5F5E5A' }}>{label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color }}>{val}%</span>
                    </div>
                    <div style={{ height: 4, background: '#F0EDE6', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val}%`, background: color }} />
                    </div>
                  </div>
                ))}

                <div style={{ height: 1, background: '#F0EDE6', margin: '10px 0' }} />
                <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>建議電話開場</div>
                <div
                  style={{ background: '#FFFDF9', border: '1px solid #FAC775', borderRadius: 6, padding: '10px 12px', fontSize: 11, lineHeight: 1.75, color: '#2C2C2A', fontStyle: 'italic' }}
                  dangerouslySetInnerHTML={{ __html: buildScript(biz.name, reviews, dirs, '林○○') }}
                />
                {activeDirs.length > 0
                  ? <button onClick={goEmail} style={{ width: '100%', marginTop: 10, padding: 8, background: '#C8841A', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      ✉️ 用勾選方向生成推銷信 →
                    </button>
                  : <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 8 }}>↑ 先勾選推銷方向再生成</div>
                }
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default function AIPage() {
  return (
    <Suspense fallback={<div style={{ color: '#888', fontSize: 12 }}>載入中...</div>}>
      <AIContent />
    </Suspense>
  )
}
