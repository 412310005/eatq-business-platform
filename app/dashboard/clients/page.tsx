'use client'

import { useEffect, useState } from 'react'
import {
  CUSTOMER_STATUS_LABEL,
  archiveCustomer,
  getAllowedCustomerStatusOptions,
  getCustomers,
  updateCustomer,
  type CustomerStatus,
  type CustomerWithLead,
} from '@/lib/customers'
import { getLatestCustomerLogTimes } from '@/lib/customerLogs'

type CustomerDraft = {
  bd_owner: string
  contact_name: string
  phone: string
  line_id: string
  customer_status: CustomerStatus
  deal_amount: string
  contract_started_at: string
  contract_ends_at: string
  notes: string
}

function formatFollowUpTime(value: string | null | undefined): string {
  if (!value) return '尚無追蹤紀錄'
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return '尚無追蹤紀錄'
  return time.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isExpiringSoon(value: string | null | undefined): boolean {
  if (!value) return false
  const end = new Date(`${value}T00:00:00`)
  if (Number.isNaN(end.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in14Days = new Date(today)
  in14Days.setDate(today.getDate() + 14)
  return end.getTime() <= in14Days.getTime()
}

function isExpired(value: string | null | undefined): boolean {
  if (!value) return false
  const end = new Date(`${value}T00:00:00`)
  if (Number.isNaN(end.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end.getTime() < today.getTime()
}

export default function ClientsPage() {
  const [customers, setCustomers] = useState<CustomerWithLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CustomerDraft | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerWithLead | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [latestLogTimes, setLatestLogTimes] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const { customers, error } = await getCustomers()

    if (error) {
      setError(error)
      setCustomers([])
      setLatestLogTimes({})
    } else {
      setError(null)
      setCustomers(customers)
      setLatestLogTimes(await getLatestCustomerLogTimes(customers.map(customer => customer.id)))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  function startEdit(customer: CustomerWithLead) {
    setEditingId(customer.id)
    setDraft({
      bd_owner: customer.bd_owner ?? '',
      contact_name: customer.contact_name ?? '',
      phone: customer.phone ?? '',
      line_id: customer.line_id ?? '',
      customer_status: customer.customer_status,
      deal_amount: String(customer.deal_amount ?? 0),
      contract_started_at: customer.contract_started_at ?? '',
      contract_ends_at: customer.contract_ends_at ?? '',
      notes: customer.notes ?? '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  function setDraftField<K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function saveEdit(customer: CustomerWithLead) {
    if (!draft || savingId) return

    setSavingId(customer.id)
    const err = await updateCustomer(customer.id, {
      bd_owner: draft.bd_owner.trim(),
      contact_name: draft.contact_name.trim(),
      phone: draft.phone.trim(),
      line_id: draft.line_id.trim(),
      customer_status: draft.customer_status,
      deal_amount: Number(draft.deal_amount) || 0,
      contract_started_at: draft.contract_started_at || null,
      contract_ends_at: draft.contract_ends_at || null,
      notes: draft.notes.trim(),
    })
    setSavingId(null)

    if (err) {
      alert(`更新失敗：${err}`)
      return
    }

    cancelEdit()
    await load()
    showToast('客戶資料已更新')
  }

  async function confirmArchiveCustomer() {
    if (!deleteTarget || savingId) return
    setSavingId(deleteTarget.id)
    const err = await archiveCustomer(deleteTarget.id)
    setSavingId(null)

    if (err) {
      alert(`移除失敗：${err}`)
      return
    }

    setDeleteTarget(null)
    await load()
    showToast('客戶已移除')
  }

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', top: 56, right: 16, zIndex: 9999,
          background: '#3B6D11', color: 'white', padding: '10px 18px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
        }}>
          {toast}
        </div>
      )}

      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(44,44,42,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 360, background: 'white', border: '1.5px solid #E8E5DE', borderRadius: 10, padding: 18, boxShadow: '0 20px 60px rgba(0,0,0,.22)' }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: '#A32D2D', marginBottom: 8 }}>移除客戶？</div>
            <div style={{ fontSize: 12, color: '#5F5E5A', lineHeight: 1.7, marginBottom: 14 }}>
              這不會刪除資料，只會封存「{deleteTarget.store_name}」，並從客戶追蹤頁隱藏。
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{ flex: 1, padding: '9px 12px', border: '1px solid #D3D1C7', borderRadius: 6, background: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => { void confirmArchiveCustomer() }}
                disabled={savingId === deleteTarget.id}
                style={{ flex: 1, padding: '9px 12px', border: 'none', borderRadius: 6, background: '#A32D2D', color: 'white', fontSize: 12, fontWeight: 700, cursor: savingId === deleteTarget.id ? 'wait' : 'pointer' }}
              >
                {savingId === deleteTarget.id ? '移除中...' : '確認移除'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>
        客戶追蹤 · 共 {customers.length} 家
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 11, color: '#A32D2D' }}>
          無法讀取客戶：{error}
        </div>
      )}

      {customers.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '42px 0', color: '#888', fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ fontWeight: 700, marginBottom: 5 }}>尚無正式客戶</div>
          <div style={{ fontSize: 11 }}>在欲開發名單完成轉換後，客戶會出現在這裡</div>
        </div>
      )}

      {customers.map(customer => {
        const cardDraft = editingId === customer.id ? draft : null
        const editing = cardDraft !== null
        const contractEnd = cardDraft ? cardDraft.contract_ends_at : customer.contract_ends_at
        const expired = isExpired(contractEnd)
        const expiringSoon = !expired && isExpiringSoon(contractEnd)
        const statusOptions = getAllowedCustomerStatusOptions(customer.customer_status)

        return (
          <div
            key={customer.id}
            style={{
              background: 'white',
              border: '1.5px solid #E8E5DE',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{customer.store_name}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{customer.address || '—'}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                {expired && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#FCEBEB', color: '#A32D2D', padding: '3px 8px', borderRadius: 999 }}>
                    已到期
                  </span>
                )}
                {expiringSoon && (
                  <span style={{ fontSize: 9, fontWeight: 700, background: '#FAEEDA', color: '#854F0B', padding: '3px 8px', borderRadius: 999 }}>
                    即將到期
                  </span>
                )}
                <span style={{ fontSize: 9, fontWeight: 700, background: '#EAF3DE', color: '#3B6D11', padding: '3px 8px', borderRadius: 999 }}>
                  {CUSTOMER_STATUS_LABEL[customer.customer_status]}
                </span>
                {!editing && (
                  <button
                    type="button"
                    onClick={() => startEdit(customer)}
                    style={{ padding: '3px 8px', border: '1px solid #D3D1C7', borderRadius: 5, background: 'white', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                  >
                    編輯
                  </button>
                )}
                {!editing && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(customer)}
                    style={{ padding: '3px 8px', border: '1px solid #F09595', borderRadius: 5, background: 'white', color: '#A32D2D', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
                  >
                    刪除
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: '#F8F5EF', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>BD 協作資訊</div>
              {cardDraft ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 5 }}>
                  <input value={cardDraft.bd_owner} onChange={e => setDraftField('bd_owner', e.target.value)} placeholder="BD負責人" style={{ padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11 }} />
                  <input value={cardDraft.contact_name} onChange={e => setDraftField('contact_name', e.target.value)} placeholder="聯絡人" style={{ padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11 }} />
                  <input value={cardDraft.phone} onChange={e => setDraftField('phone', e.target.value)} placeholder="電話" style={{ padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11 }} />
                  <input value={cardDraft.line_id} onChange={e => setDraftField('line_id', e.target.value)} placeholder="LINE ID" style={{ padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11 }} />
                  <select value={cardDraft.customer_status} onChange={e => setDraftField('customer_status', e.target.value as CustomerStatus)} style={{ padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11 }}>
                    {statusOptions.map(status => <option key={status} value={status}>{CUSTOMER_STATUS_LABEL[status]}</option>)}
                  </select>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#5F5E5A', lineHeight: 1.6 }}>
                  BD：{customer.bd_owner || '—'} · 聯絡人：{customer.contact_name || '—'} · 電話：{customer.phone || '—'} · LINE：{customer.line_id || '—'}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ background: '#FAF8F2', border: '1px solid #F0EDE6', borderRadius: 7, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>交易金額</div>
                {cardDraft ? (
                  <input
                    type="number"
                    min={0}
                    value={cardDraft.deal_amount}
                    onChange={e => setDraftField('deal_amount', e.target.value)}
                    style={{ width: '100%', padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
                  />
                ) : (
                  <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.6 }}>
                    ${Number(customer.deal_amount ?? 0).toLocaleString()}
                  </div>
                )}
              </div>
              <div style={{ background: '#FAF8F2', border: '1px solid #F0EDE6', borderRadius: 7, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>合約日期</div>
                {cardDraft ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    <input type="date" value={cardDraft.contract_started_at} onChange={e => setDraftField('contract_started_at', e.target.value)} style={{ padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11 }} />
                    <input type="date" value={cardDraft.contract_ends_at} onChange={e => setDraftField('contract_ends_at', e.target.value)} style={{ padding: '5px 7px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11 }} />
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.6 }}>
                    {customer.contract_started_at || '—'} → {customer.contract_ends_at || '—'}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#FAF8F2', border: '1px solid #F0EDE6', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>最後追蹤</div>
                  <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.6 }}>
                    {formatFollowUpTime(customer.leads?.last_follow_up_at)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>最後異動</div>
                  <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.6 }}>
                    {formatFollowUpTime(latestLogTimes[customer.id])}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>備註</div>
              {cardDraft ? (
                <textarea
                  value={cardDraft.notes}
                  onChange={e => setDraftField('notes', e.target.value)}
                  rows={3}
                  style={{ width: '100%', fontSize: 11, lineHeight: 1.6, background: '#FAF8F2', border: '1px solid #D3D1C7', borderRadius: 7, padding: '8px 10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              ) : (
                <div style={{ fontSize: 11, color: '#5F5E5A', lineHeight: 1.6, background: '#FAF8F2', border: '1px solid #F0EDE6', borderRadius: 7, padding: '8px 10px', minHeight: 20 }}>
                  {customer.notes || '—'}
                </div>
              )}
            </div>

            {editing && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px solid #F0EDE6' }}>
                <button
                  type="button"
                  onClick={() => saveEdit(customer)}
                  disabled={savingId === customer.id}
                  style={{ flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, background: '#3B6D11', color: 'white', fontSize: 11, fontWeight: 700, cursor: savingId === customer.id ? 'wait' : 'pointer' }}
                >
                  {savingId === customer.id ? '儲存中…' : '儲存'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={savingId === customer.id}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #D3D1C7', borderRadius: 6, background: 'white', color: '#5F5E5A', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
