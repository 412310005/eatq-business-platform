'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { buildCustomerFromLead, createCustomer } from '@/lib/customers'
import {
  deleteLead,
  insertLead,
  LEAD_SOURCE_LABEL,
  LEAD_STATUS_OPTIONS,
  normalizeLeadStatus,
  updateLead,
  type LeadRow,
  type LeadSource,
  type LeadStatus,
} from '@/lib/leads'

const CAT_ICON: Record<string, string> = {
  restaurant: '🍱',
  cafe: '☕',
  night_market: '🍢',
  bar: '🍺',
  bakery: '🥐',
  food: '🍱',
}
function getIcon(cat: string) { return CAT_ICON[cat] ?? '🏪' }

const EMPTY_FORM = {
  store_name: '',
  address: '',
  category: 'restaurant',
  owner_name: '',
  notes: '',
}

function PipelineContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveBanner, setSaveBanner] = useState(false)
  const highlightLeadId = searchParams.get('leadId')

  async function load() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .neq('status', 'won')
      .neq('status', 'customer')
      .neq('status', 'converted')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[pipeline] leads load error:', error)
      setLoadError(error.message)
      setLeads([])
    } else {
      setLeads((data ?? []) as LeadRow[])
      setLoadError(null)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (searchParams.get('saved') === '1') {
      setSaveBanner(true)
      load()
      const t = window.setTimeout(() => setSaveBanner(false), 4000)
      return () => window.clearTimeout(t)
    }
  }, [searchParams])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const name = form.store_name.trim()
    if (!name) return
    setSaving(true)
    const { lead, error, duplicate } = await insertLead({
      store_name: name,
      address: form.address.trim(),
      category: form.category,
      source: 'manual',
      status: 'new',
      owner_name: form.owner_name.trim(),
      contact_name: '',
      phone: '',
      line_id: '',
      last_follow_up_at: new Date().toISOString(),
      ai_summary: null,
      pitch_email: null,
      notes: form.notes.trim(),
      business_id: null,
      osm_id: null,
      lat: null,
      lng: null,
    })
    setSaving(false)
    if (error) {
      alert(`新增失敗：${error}`)
      return
    }
    if (duplicate && lead) {
      alert(`「${lead.store_name}」已在欲開發名單中`)
    } else if (lead) {
      setLeads(prev => [lead, ...prev])
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  async function setStatus(id: string, status: LeadStatus) {
    const last_follow_up_at = new Date().toISOString()
    const err = await updateLead(id, { status, last_follow_up_at })
    if (err) { alert(err); return }
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status, last_follow_up_at } : l))
  }

  async function saveLeadPatch(id: string, patch: Parameters<typeof updateLead>[1]) {
    const last_follow_up_at = new Date().toISOString()
    const err = await updateLead(id, { ...patch, last_follow_up_at })
    if (err) { alert(err); return }
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...patch, last_follow_up_at } : l))
  }

  async function removeLead(id: string, name: string) {
    if (!confirm(`確定要從欲開發名單移除「${name}」？`)) return
    const err = await deleteLead(id)
    if (err) { alert(err); return }
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  async function signMou(lead: LeadRow) {
    if (!confirm(`確認「${lead.store_name}」已簽 MOU，並移至客戶追蹤？`)) return

    const { error: customerErr } = await createCustomer(buildCustomerFromLead(lead))
    const alreadyCreated = customerErr?.includes('duplicate key') || customerErr?.includes('customers_lead_id')
    if (customerErr && !alreadyCreated) {
      alert(`建立客戶失敗：${customerErr}\n\n請確認已在 Supabase 執行 scripts/customers-table.sql`)
      return
    }

    const err = await updateLead(lead.id, { status: 'converted', last_follow_up_at: new Date().toISOString() })
    if (err) {
      alert(`客戶已建立，但更新 lead 狀態失敗：${err}`)
      return
    }

    setLeads(prev => prev.filter(l => l.id !== lead.id))
    router.push('/dashboard/clients')
  }

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    <div>
      {saveBanner && (
        <div style={{ background: '#EAF3DE', border: '1px solid #97C459', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#3B6D11', fontWeight: 600 }}>
          ✅ 推銷信已儲存，狀態已更新
        </div>
      )}

      {loadError && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 11, color: '#A32D2D' }}>
          無法讀取名單：{loadError}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .5 }}>
          欲開發名單 · 共 {leads.length} 家
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          style={{ padding: '6px 12px', background: showForm ? '#5F5E5A' : '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          {showForm ? '收起' : '＋ 手動新增店家'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submitManual}
          style={{ background: 'white', border: '1.5px solid #97C459', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: '#3B6D11' }}>手動新增店家</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>店家名稱 *</div>
              <input
                required
                value={form.store_name}
                onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>BD負責人</div>
              <input
                value={form.owner_name}
                onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                placeholder="例如：Evan"
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>類別</div>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
              >
                <option value="restaurant">餐廳</option>
                <option value="cafe">咖啡廳</option>
                <option value="bakery">烘焙</option>
                <option value="bar">酒吧</option>
                <option value="night_market">夜市</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>地址</div>
            <input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !form.store_name.trim()}
            style={{ padding: '8px 16px', background: '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
          >
            加入欲開發名單
          </button>
        </form>
      )}

      {leads.length === 0 && !loadError && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
          <div style={{ fontWeight: 600 }}>尚無欲開發名單</div>
        </div>
      )}

      {leads.map(lead => {
        const highlighted = highlightLeadId === lead.id

        return (
          <div key={lead.id} style={{ background: 'white', border: highlighted ? '2px solid #C8841A' : '1.5px solid #E8E5DE', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 20 }}>{getIcon(lead.category)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{lead.store_name}</div>
                  <div style={{ fontSize: 9, color: '#888' }}>{lead.address || '—'}</div>
                  <div style={{ fontSize: 9, color: '#185FA5', marginTop: 2 }}>
                    {LEAD_SOURCE_LABEL[lead.source as LeadSource]} · {new Date(lead.created_at).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              </div>
              <select
                value={normalizeLeadStatus(lead.status)}
                onChange={e => setStatus(lead.id, e.target.value as LeadStatus)}
                style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', border: '1px solid #D3D1C7', borderRadius: 5, background: '#FAF8F2' }}
              >
                {LEAD_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>BD負責人</div>
                <input
                  defaultValue={lead.owner_name}
                  placeholder="未指定"
                  onBlur={e => { if (e.target.value !== lead.owner_name) saveLeadPatch(lead.id, { owner_name: e.target.value.trim() }) }}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>聯絡人</div>
                <input
                  defaultValue={lead.contact_name}
                  placeholder="接洽人"
                  onBlur={e => { if (e.target.value !== lead.contact_name) saveLeadPatch(lead.id, { contact_name: e.target.value.trim() }) }}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>電話</div>
                <input
                  defaultValue={lead.phone}
                  placeholder="電話"
                  onBlur={e => { if (e.target.value !== lead.phone) saveLeadPatch(lead.id, { phone: e.target.value.trim() }) }}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>LINE</div>
                <input
                  defaultValue={lead.line_id}
                  placeholder="LINE ID"
                  onBlur={e => { if (e.target.value !== lead.line_id) saveLeadPatch(lead.id, { line_id: e.target.value.trim() }) }}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>備註</div>
              <textarea
                defaultValue={lead.notes}
                onBlur={e => { if (e.target.value !== lead.notes) saveLeadPatch(lead.id, { notes: e.target.value }) }}
                rows={2}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ paddingTop: 8, borderTop: '1px solid #F0EDE6' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/email?leadId=${lead.id}`)}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    background: '#C8841A',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  ✉️ 推銷信
                </button>
                <button
                  type="button"
                  onClick={() => signMou(lead)}
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    background: '#3B6D11',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  簽MOU →
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeLead(lead.id, lead.store_name)}
                style={{ marginTop: 6, padding: '4px 8px', background: 'transparent', color: '#A32D2D', border: 'none', fontSize: 9, cursor: 'pointer' }}
              >
                ✕ 從名單移除
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div style={{ color: '#888', fontSize: 12 }}>載入中...</div>}>
      <PipelineContent />
    </Suspense>
  )
}
