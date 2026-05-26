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

  if (loading) {
    return <div className="loading-text">載入中...</div>
  }

  return (
    <div>
      {/* Save banner */}
      {saveBanner && (
        <div className="alert-success" style={{ marginBottom: 14 }}>
          ✅ 推銷信已儲存，狀態已更新
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="alert-error" style={{ marginBottom: 14 }}>
          無法讀取名單：{loadError}
        </div>
      )}

      {/* Header row */}
      <div className="page-header">
        <span className="page-meta">欲開發名單 · {leads.length} 家</span>
        <button
          type="button"
          className={`btn ${showForm ? 'btn-outline' : 'btn-success'} btn-sm`}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? '收起' : '＋ 手動新增'}
        </button>
      </div>

      {/* Manual add form */}
      {showForm && (
        <form
          onSubmit={submitManual}
          className="card"
          style={{
            padding: '16px 18px',
            marginBottom: 14,
            borderColor: 'rgba(59,109,17,0.25)',
          }}
        >
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 12,
            color: 'var(--green)',
            letterSpacing: '-0.01em',
          }}>
            手動新增店家
          </div>

          <div className="form-grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label className="field-label">店家名稱 *</label>
              <input
                required
                value={form.store_name}
                onChange={e => setForm(f => ({ ...f, store_name: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="field-label">BD 負責人</label>
              <input
                value={form.owner_name}
                onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
                placeholder="例如：Evan"
                className="input"
              />
            </div>
          </div>

          <div className="form-grid-2" style={{ marginBottom: 10 }}>
            <div>
              <label className="field-label">類別</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="select-field"
              >
                <option value="restaurant">餐廳</option>
                <option value="cafe">咖啡廳</option>
                <option value="bakery">烘焙</option>
                <option value="bar">酒吧</option>
                <option value="night_market">夜市</option>
              </select>
            </div>
            <div>
              <label className="field-label">地址</label>
              <input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="input"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !form.store_name.trim()}
            className="btn btn-success btn-sm"
          >
            {saving ? '新增中...' : '加入欲開發名單'}
          </button>
        </form>
      )}

      {/* Empty state */}
      {leads.length === 0 && !loadError && (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>
            尚無欲開發名單
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            從地圖搜尋商家，或手動新增開始開發
          </div>
        </div>
      )}

      {/* Lead cards */}
      {leads.map(lead => {
        const highlighted = highlightLeadId === lead.id

        return (
          <div
            key={lead.id}
            className="card"
            style={{
              padding: '16px 18px',
              marginBottom: 12,
              borderColor: highlighted ? 'var(--gold)' : undefined,
              boxShadow: highlighted
                ? '0 0 0 2px rgba(200,132,26,0.2), var(--sh-sm)'
                : undefined,
            }}
          >
            {/* Card header */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 14,
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                <span style={{
                  fontSize: 22,
                  flexShrink: 0,
                  lineHeight: 1,
                  marginTop: 1,
                }}>{getIcon(lead.category)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--t1)',
                    letterSpacing: '-0.02em',
                    marginBottom: 3,
                  }}>{lead.store_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 2 }}>
                    {lead.address || '—'}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'var(--blue)',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <span>{LEAD_SOURCE_LABEL[lead.source as LeadSource]}</span>
                    <span style={{ color: 'var(--t3)' }}>·</span>
                    <span style={{ color: 'var(--t3)' }}>
                      {new Date(lead.created_at).toLocaleDateString('zh-TW')}
                    </span>
                  </div>
                </div>
              </div>

              <select
                value={normalizeLeadStatus(lead.status)}
                onChange={e => setStatus(lead.id, e.target.value as LeadStatus)}
                className="select-field"
                style={{ width: 'auto', fontSize: 11, fontWeight: 600, flexShrink: 0 }}
              >
                {LEAD_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* BD fields */}
            <div className="form-grid-4" style={{ marginBottom: 12 }}>
              {[
                { label: 'BD 負責人', field: 'owner_name' as const, placeholder: '未指定' },
                { label: '聯絡人',    field: 'contact_name' as const, placeholder: '接洽人' },
                { label: '電話',      field: 'phone' as const, placeholder: '電話' },
                { label: 'LINE',      field: 'line_id' as const, placeholder: 'LINE ID' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="field-label">{label}</label>
                  <input
                    defaultValue={lead[field] ?? ''}
                    placeholder={placeholder}
                    className="input"
                    onBlur={e => {
                      if (e.target.value !== (lead[field] ?? ''))
                        saveLeadPatch(lead.id, { [field]: e.target.value.trim() })
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 14 }}>
              <label className="field-label">備註</label>
              <textarea
                defaultValue={lead.notes ?? ''}
                onBlur={e => {
                  if (e.target.value !== (lead.notes ?? ''))
                    saveLeadPatch(lead.id, { notes: e.target.value })
                }}
                rows={2}
                className="textarea-field"
              />
            </div>

            {/* Card footer */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => router.push(`/dashboard/email?leadId=${lead.id}`)}
                >
                  ✉️ 推銷信
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => signMou(lead)}
                >
                  簽 MOU →
                </button>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 10 }}
                onClick={() => removeLead(lead.id, lead.store_name)}
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
    <Suspense fallback={<div className="loading-text">載入中...</div>}>
      <PipelineContent />
    </Suspense>
  )
}
