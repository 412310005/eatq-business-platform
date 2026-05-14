'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ClientRow } from '@/lib/constants'

const REMOVE_REASONS = ['店家主動終止', '使用率太低主動放棄', '店家倒閉/歇業', '轉為付費方案（正面）', '其他']

export default function TrackerPage() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [renewTarget, setRenewTarget] = useState<ClientRow | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ClientRow | null>(null)
  const [renewQty, setRenewQty] = useState(0)
  const [renewPrice, setRenewPrice] = useState(0)
  const [removeReason, setRemoveReason] = useState('')
  const [removeNote, setRemoveNote] = useState('')

  async function load() {
    const { data } = await supabase.from('clients').select('*, businesses(name)').order('created_at', { ascending: false })
    setClients((data ?? []) as ClientRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openRenew(c: ClientRow) {
    setRenewQty(c.sticker_given)
    setRenewPrice(c.sticker_price)
    setRenewTarget(c)
  }

  async function confirmRenew() {
    if (!renewTarget) return
    const now = new Date()
    const time = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
    await Promise.all([
      supabase.from('clients').update({ sticker_given: renewQty, sticker_price: renewPrice, sticker_used: 0, contract_progress: 0 }).eq('id', renewTarget.id),
      supabase.from('changelogs').insert({
        business_name: renewTarget.businesses?.name ?? '',
        field: '合約狀態',
        old_value: '試用中',
        new_value: '已續約',
        changed_by: '林○○',
        changed_at: time,
        type: '續約',
        reason: '續約成功，更新方案',
        note: `貼紙 ${renewQty}張 × $${renewPrice}，交易金額 $${(renewQty * renewPrice).toLocaleString()}`,
      }),
    ])
    setRenewTarget(null)
    load()
  }

  async function confirmRemove() {
    if (!removeTarget) return
    const now = new Date()
    const time = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
    await Promise.all([
      supabase.from('clients').update({ status: 'churned' }).eq('id', removeTarget.id),
      supabase.from('changelogs').insert({
        business_name: removeTarget.businesses?.name ?? '',
        field: '合約狀態',
        old_value: '試用中',
        new_value: '已終止',
        changed_by: '林○○',
        changed_at: time,
        type: '終止',
        reason: removeReason || '未填寫',
        note: removeNote,
      }),
    ])
    setRemoveTarget(null)
    setRemoveReason('')
    setRemoveNote('')
    load()
  }

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  const active = clients.filter(c => c.status !== 'churned')
  const warns = active.filter(c => c.sticker_given > 0 && Math.round(c.sticker_used / c.sticker_given * 100) < 30)

  return (
    <>
      {/* Remove Modal */}
      {removeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 360 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>終止合約 — {removeTarget.businesses?.name}</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>請填寫終止原因，將記錄至異動紀錄</div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>終止原因</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
              {REMOVE_REASONS.map(r => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, padding: '6px 8px', border: '1px solid #E8E5DE', borderRadius: 6 }}>
                  <input type="radio" name="reason" value={r} onChange={() => setRemoveReason(r)} /> {r}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>備註（選填）</div>
            <textarea
              value={removeNote}
              onChange={e => setRemoveNote(e.target.value)}
              placeholder="補充說明..."
              style={{ width: '100%', padding: '7px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, height: 70, resize: 'none', boxSizing: 'border-box', color: '#2C2C2A', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setRemoveTarget(null)} style={{ flex: 1, padding: 8, background: 'white', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>取消</button>
              <button onClick={confirmRemove} style={{ flex: 1, padding: 8, background: '#A32D2D', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>確認終止</button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {renewTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 24, width: 400 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>準備續約 — {renewTarget.businesses?.name}</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>確認方案並更新合約內容</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>訂閱方案</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', border: '1px solid #97C459', borderRadius: 7, background: '#EAF3DE', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><input type="checkbox" defaultChecked /> <span style={{ fontSize: 12, fontWeight: 600 }}>🟠 剩食貼紙系統</span></div>
                <span style={{ fontSize: 11, color: '#3B6D11' }}>${renewPrice}/張</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', border: '1px solid #E8E5DE', borderRadius: 7, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><input type="checkbox" /> <span style={{ fontSize: 12 }}>🟣 訂位系統</span></div>
                <span style={{ fontSize: 11, color: '#aaa', background: '#F1EFE8', padding: '1px 7px', borderRadius: 5 }}>即將推出</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', border: '1px solid #E8E5DE', borderRadius: 7, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><input type="checkbox" /> <span style={{ fontSize: 12 }}>🔵 點餐系統</span></div>
                <span style={{ fontSize: 11, color: '#aaa', background: '#F1EFE8', padding: '1px 7px', borderRadius: 5 }}>即將推出</span>
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>貼紙數量</div>
                <input type="number" value={renewQty} onChange={e => setRenewQty(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '6px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', color: '#2C2C2A', outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>貼紙定價（元/張）</div>
                <input type="number" value={renewPrice} onChange={e => setRenewPrice(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '6px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', color: '#2C2C2A', outline: 'none' }} />
              </div>
            </div>
            <div style={{ background: '#F8F5EF', borderRadius: 7, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>本次交易金額試算</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#C8841A' }}>$ {(renewQty * renewPrice).toLocaleString()} 元</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{renewQty}張 × ${renewPrice} = ${(renewQty * renewPrice).toLocaleString()}（不含未來 SaaS 月費）</div>
            </div>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>重新簽 MOU</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, marginBottom: 14 }}>
              <input type="checkbox" /> 需要重新拍照上傳 MOU 合約
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRenewTarget(null)} style={{ flex: 1, padding: 8, background: 'white', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>取消</button>
              <button onClick={confirmRenew} style={{ flex: 1, padding: 8, background: '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✅ 確認續約</button>
            </div>
          </div>
        </div>
      )}

      {/* Client list */}
      <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>📋 正式客戶 — 試用追蹤</div>
          <button style={{ padding: '4px 9px', border: '1px solid #D3D1C7', borderRadius: 5, background: 'white', fontSize: 10, cursor: 'pointer' }}>↓ 匯出</button>
        </div>

        {active.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
            <div style={{ fontWeight: 600, marginBottom: 5 }}>尚無正式客戶</div>
            <div style={{ fontSize: 11 }}>在欲開發名單簽 MOU 後，客戶會出現在這裡</div>
          </div>
        )}

        {active.map(c => {
          const rate = c.sticker_given > 0 ? Math.round(c.sticker_used / c.sticker_given * 100) : 0
          const rc = rate >= 60 ? '#3B6D11' : rate >= 30 ? '#C8841A' : '#A32D2D'
          const stickerTotal = c.sticker_given * c.sticker_price
          const prog = c.contract_progress
          const repFirst = (c.rep_name || c.businesses?.name || '?')[0]
          return (
            <div key={c.id} style={{ padding: '11px 14px', borderBottom: '1px solid #F8F6F2' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FAC775', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#2C2C2A' }}>
                    {repFirst}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.businesses?.name ?? '未知客戶'}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{c.rep_name || '業主'} · {c.contract_start} → {c.contract_end ?? '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: prog > 85 ? '#FCEBEB' : '#EAF3DE', color: prog > 85 ? '#A32D2D' : '#3B6D11' }}>
                    {prog > 85 ? '⚠ 即將到期' : '試用中'}
                  </span>
                  <button onClick={() => openRenew(c)} style={{ padding: '4px 9px', background: '#EAF3DE', color: '#3B6D11', border: '1px solid #97C459', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>🔄 準備續約</button>
                  <button onClick={() => setRemoveTarget(c)} style={{ padding: '4px 9px', background: '#FCEBEB', color: '#A32D2D', border: '1px solid #F09595', borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>✕ 終止合約</button>
                </div>
              </div>

              <div style={{ height: 4, background: '#F0EDE6', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${prog}%`, background: prog > 85 ? '#A32D2D' : '#C8841A' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ background: '#F8F5EF', borderRadius: 6, padding: '7px 9px' }}>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>貼紙 發放/使用</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{c.sticker_given} / <span style={{ color: rc }}>{c.sticker_used}</span> 張</div>
                  <div style={{ height: 4, background: '#F0EDE6', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', width: `${rate}%`, background: rc }} />
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: rc, marginTop: 2 }}>使用率 {rate}%{rate < 30 ? ' · ⚠ 需售後教育' : ''}</div>
                </div>
                <div style={{ background: '#F8F5EF', borderRadius: 6, padding: '7px 9px' }}>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>交易金額</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#C8841A' }}>${stickerTotal.toLocaleString()}</div>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{c.sticker_given}張 × ${c.sticker_price}</div>
                </div>
                <div style={{ background: '#F8F5EF', borderRadius: 6, padding: '7px 9px' }}>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>訂閱方案</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#3B6D11' }}>🟠 貼紙系統</div>
                  <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>🟣 訂位 <span style={{ background: '#F1EFE8', padding: '1px 4px', borderRadius: 3 }}>即將推出</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: '#888' }}>聯繫：</span>
                {c.contact_phone && <a href={`tel:${c.contact_phone}`} style={{ fontSize: 10, color: '#185FA5', textDecoration: 'none', padding: '2px 7px', border: '1px solid #B5D4F4', borderRadius: 5, background: '#E6F1FB' }}>📞 {c.contact_phone}</a>}
                {c.contact_email && <a href={`mailto:${c.contact_email}`} style={{ fontSize: 10, color: '#185FA5', textDecoration: 'none', padding: '2px 7px', border: '1px solid #B5D4F4', borderRadius: 5, background: '#E6F1FB' }}>✉️ {c.contact_email}</a>}
                {c.contact_line && <span style={{ fontSize: 10, color: '#3B6D11', padding: '2px 7px', border: '1px solid #97C459', borderRadius: 5, background: '#EAF3DE', cursor: 'pointer' }}>💬 LINE: {c.contact_line}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {warns.length > 0 && (
        <div style={{ background: '#FCEBEB', borderRadius: 7, padding: '10px 13px', fontSize: 11, color: '#A32D2D', marginTop: 10 }}>
          ⚠ {warns.map(c => `${c.businesses?.name ?? ''} 使用率 ${Math.round(c.sticker_used / c.sticker_given * 100)}%，建議安排售後拜訪。`).join(' ')}
        </div>
      )}
    </>
  )
}
