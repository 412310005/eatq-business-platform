'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PipelineRow, PipelineMessage } from '@/lib/constants'

const CAT_ICON: Record<string, string> = {
  restaurant: '🍱',
  cafe: '☕',
  night_market: '🍢',
  bar: '🍺',
  bakery: '🥐',
}
function getIcon(cat: string) { return CAT_ICON[cat] ?? '🏪' }

export default function PipelinePage() {
  const router = useRouter()
  const [records, setRecords] = useState<PipelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showMsg, setShowMsg] = useState<string | null>(null)
  const [msgInput, setMsgInput] = useState<Record<string, string>>({})
  const [notified, setNotified] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('pipeline')
      .select('*, businesses(name, address, category), pipeline_messages(*)')
      .order('visit_date', { ascending: true, nullsFirst: false })
    setRecords((data ?? []) as PipelineRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleCheck(id: string, field: 'said' | 'sent') {
    const rec = records.find(r => r.id === id)
    if (!rec) return
    await supabase.from('pipeline').update({ [field]: !rec[field] }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: !r[field] } : r))
  }

  async function setVisit(id: string, val: string) {
    await supabase.from('pipeline').update({ visit_date: val || null }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, visit_date: val } : r))
  }

  async function setField(id: string, field: string, val: string) {
    await supabase.from('pipeline').update({ [field]: val }).eq('id', id)
    setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r))
  }

  async function deletePipe(id: string) {
    if (!confirm('確定要從欲開發名單移除？')) return
    await supabase.from('pipeline').delete().eq('id', id)
    setRecords(prev => prev.filter(r => r.id !== id))
  }

  async function mouSign(id: string) {
    const rec = records.find(r => r.id === id)
    if (!rec) return
    if (!confirm(`📷 確認已簽 MOU\n\n確定後「${rec.businesses?.name ?? ''}」將移至客戶追蹤系統。`)) return

    const today = new Date().toISOString().split('T')[0]
    const endDate = new Date()
    endDate.setFullYear(endDate.getFullYear() + 1)

    await supabase.from('clients').insert({
      business_id: rec.business_id,
      lead_id: id,
      contract_start: today,
      contract_end: endDate.toISOString().split('T')[0],
      plan: '剩食貼紙系統',
      monthly_value: 0,
      status: 'active',
      notes: '',
      rep_name: '',
      contact_phone: rec.contact_phone,
      contact_line: rec.contact_line,
      contact_email: '',
      sticker_given: 20,
      sticker_used: 0,
      sticker_price: 50,
      contract_progress: 0,
    })
    await supabase.from('pipeline').delete().eq('id', id)
    router.push('/dashboard/tracker')
  }

  async function sendMsg(id: string) {
    const text = msgInput[id]?.trim()
    if (!text) return
    await supabase.from('pipeline_messages').insert({ pipeline_id: id, from_name: '林○○', message: text })
    setRecords(prev => prev.map(r => r.id === id ? {
      ...r,
      pipeline_messages: [...(r.pipeline_messages ?? []), { id: Date.now().toString(), pipeline_id: id, from_name: '林○○', message: text, created_at: new Date().toISOString() }]
    } : r))
    setMsgInput(prev => ({ ...prev, [id]: '' }))
    const rec = records.find(r => r.id === id)
    if (rec?.other_user) {
      setNotified(id)
      setTimeout(() => setNotified(null), 3000)
    }
  }

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    <div>
      <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>
        按拜訪日期排序 · 共 {records.length} 家
      </div>

      {records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
          <div style={{ fontWeight: 600, marginBottom: 5 }}>尚無欲開發名單</div>
          <div style={{ fontSize: 11 }}>從 AI 診斷頁加入商家</div>
        </div>
      )}

      {records.map(p => {
        const bizName = p.businesses?.name ?? '未知商家'
        const bizAddr = p.businesses?.address ?? ''
        const bizCat = p.businesses?.category ?? ''
        const hasConflict = !!p.other_user
        const msgs = p.pipeline_messages ?? []
        const showMsgPanel = showMsg === p.id

        return (
          <div key={p.id} style={{ background: 'white', border: `1.5px solid ${hasConflict ? '#F09595' : '#E8E5DE'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{getIcon(bizCat)}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{bizName}</div>
                  <div style={{ fontSize: 9, color: '#888' }}>{bizAddr}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {hasConflict && (
                  <>
                    <span style={{ fontSize: 9, fontWeight: 700, background: '#FCEBEB', color: '#A32D2D', padding: '2px 8px', borderRadius: 8 }}>⚠ 林○○ & {p.other_user}</span>
                    <button
                      onClick={() => setShowMsg(showMsgPanel ? null : p.id)}
                      style={{ padding: '4px 8px', background: '#E6F1FB', color: '#0C447C', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                    >💬{msgs.length > 0 ? ` ${msgs.length}` : ''}</button>
                  </>
                )}
                <button
                  onClick={() => deletePipe(p.id)}
                  style={{ padding: '4px 8px', background: '#FCEBEB', color: '#A32D2D', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                >✕ 刪除</button>
              </div>
            </div>

            {/* Message board */}
            {showMsgPanel && (
              <div style={{ background: '#F0F4FF', border: '1px solid #B5D4F4', borderRadius: 7, padding: 9, marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#185FA5', marginBottom: 6 }}>💬 與 {p.other_user} 的內部留言板</div>
                {msgs.length === 0 && <div style={{ fontSize: 10, color: '#888', marginBottom: 6, fontStyle: 'italic' }}>尚無留言</div>}
                {msgs.map(m => {
                  const t = new Date(m.created_at)
                  const time = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0')
                  return (
                    <div key={m.id} style={{ marginBottom: 5, fontSize: 11, background: 'white', borderRadius: 5, padding: '5px 8px' }}>
                      <span style={{ fontWeight: 700, color: '#C8841A' }}>{m.from_name}</span>
                      <span style={{ fontSize: 9, color: '#aaa', marginLeft: 5 }}>{time}</span>
                      <div style={{ marginTop: 2, color: '#2C2C2A' }}>{m.message}</div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  <input
                    value={msgInput[p.id] ?? ''}
                    onChange={e => setMsgInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="輸入留言..."
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, color: '#2C2C2A', outline: 'none' }}
                  />
                  <button
                    onClick={() => sendMsg(p.id)}
                    style={{ padding: '5px 10px', background: '#185FA5', color: 'white', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                  >送出</button>
                </div>
                {notified === p.id && <div style={{ fontSize: 9, color: '#3B6D11', marginTop: 4 }}>✅ 已發送 Email 通知給 {p.other_user}</div>}
              </div>
            )}

            {/* Status checkboxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
              {(['said', 'sent'] as const).map(field => {
                const label = field === 'said' ? '打招呼' : '寄信/訊息'
                const val = p[field]
                return (
                  <div key={field} style={{ border: `1px solid ${val ? '#97C459' : '#D3D1C7'}`, borderRadius: 6, padding: '6px 8px', background: val ? '#EAF3DE' : 'white' }}>
                    <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>{label}</div>
                    <button
                      onClick={() => toggleCheck(p.id, field)}
                      style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', border: 'none', borderRadius: 4, cursor: 'pointer', background: val ? '#3B6D11' : '#F0EDE6', color: val ? 'white' : '#888' }}
                    >{val ? '✓ 已完成' : '○ 未完成'}</button>
                  </div>
                )
              })}
              <div style={{ border: `1px solid ${p.visit_date ? '#97C459' : '#D3D1C7'}`, borderRadius: 6, padding: '6px 8px', background: p.visit_date ? '#EAF3DE' : 'white' }}>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>預計拜訪日</div>
                <input
                  type="date"
                  onChange={e => setVisit(p.id, e.target.value)}
                  defaultValue={p.visit_date ?? ''}
                  style={{ fontSize: 10, border: 'none', background: 'transparent', width: '100%', color: '#2C2C2A', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Contact fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>接洽人員</div>
                <input
                  defaultValue={p.contact_name}
                  onBlur={e => setField(p.id, 'contact_name', e.target.value)}
                  placeholder="王老闆"
                  style={{ width: '100%', padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box', color: '#2C2C2A', outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>電話</div>
                <input
                  defaultValue={p.contact_phone}
                  onBlur={e => setField(p.id, 'contact_phone', e.target.value)}
                  placeholder="0912-000-000"
                  style={{ width: '100%', padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box', color: '#2C2C2A', outline: 'none' }}
                />
              </div>
            </div>

            {/* Footer actions */}
            <div style={{ borderTop: '1px solid #F0EDE6', paddingTop: 8, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 9, color: '#888' }}>發送：</span>
              {['Email', 'LINE', 'IG', 'FB', '電話'].map(c => (
                <span key={c} style={{ padding: '2px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 10, cursor: 'pointer', background: 'white' }}>{c}</span>
              ))}
              <button
                onClick={() => mouSign(p.id)}
                style={{ marginLeft: 'auto', padding: '5px 9px', background: '#3B6D11', color: 'white', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
              >📷 簽MOU →</button>
            </div>
          </div>
        )
      })}

      <div
        onClick={() => router.push('/dashboard/map')}
        style={{ border: '2px dashed #D3D1C7', borderRadius: 8, padding: 12, textAlign: 'center', color: '#888', fontSize: 11, cursor: 'pointer' }}
      >＋ 從地圖新增欲開發商家</div>
    </div>
  )
}
