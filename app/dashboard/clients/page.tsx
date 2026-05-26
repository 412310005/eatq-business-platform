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

  if (loading) return <div className="loading-text">載入中...</div>

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="toast">{toast}</div>
      )}

      {/* Archive confirm modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--red)',
              marginBottom: 10,
              letterSpacing: '-0.02em',
            }}>
              移除客戶？
            </div>
            <div style={{
              fontSize: 12,
              color: 'var(--t2)',
              lineHeight: 1.7,
              marginBottom: 20,
            }}>
              這不會刪除資料，只會封存「{deleteTarget.store_name}」，並從客戶追蹤頁隱藏。
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn"
                disabled={savingId === deleteTarget.id}
                style={{ flex: 1, background: 'var(--red)', color: 'white' }}
                onClick={() => { void confirmArchiveCustomer() }}
              >
                {savingId === deleteTarget.id ? '移除中...' : '確認移除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="page-header">
        <span className="page-meta">客戶追蹤 · {customers.length} 家</span>
      </div>

      {/* Error */}
      {error && (
        <div className="alert-error" style={{ marginBottom: 14 }}>
          無法讀取客戶：{error}
        </div>
      )}

      {/* Empty state */}
      {customers.length === 0 && !error && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>
            尚無正式客戶
          </div>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>
            在欲開發名單完成轉換後，客戶會出現在這裡
          </div>
        </div>
      )}

      {/* Customer cards */}
      {customers.map(customer => {
        const cardDraft = editingId === customer.id ? draft : null
        const editing = cardDraft !== null
        const contractEnd = cardDraft ? cardDraft.contract_ends_at : customer.contract_ends_at
        const expired = isExpired(contractEnd)
        const expiringSoon = !expired && isExpiringSoon(contractEnd)
        const statusOptions = getAllowedCustomerStatusOptions(customer.customer_status)

        return (
          <div key={customer.id} className="card" style={{ padding: '16px 18px', marginBottom: 12 }}>

            {/* Card top */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 14,
            }}>
              <div>
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--t1)',
                  letterSpacing: '-0.02em',
                  marginBottom: 3,
                }}>
                  {customer.store_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                  {customer.address || '—'}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexShrink: 0 }}>
                {expired && (
                  <span className="badge badge-red">已到期</span>
                )}
                {expiringSoon && (
                  <span className="badge badge-amber">即將到期</span>
                )}
                <span className="badge badge-green">
                  {CUSTOMER_STATUS_LABEL[customer.customer_status]}
                </span>
                {!editing && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => startEdit(customer)}
                  >
                    編輯
                  </button>
                )}
                {!editing && (
                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{
                      background: 'transparent',
                      color: 'var(--red)',
                      border: '1px solid rgba(163,45,45,0.25)',
                    }}
                    onClick={() => setDeleteTarget(customer)}
                  >
                    刪除
                  </button>
                )}
              </div>
            </div>

            {/* BD info section */}
            <div className="card-inner" style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--t3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 8,
              }}>
                BD 協作資訊
              </div>

              {cardDraft ? (
                <div className="form-grid-5">
                  <input
                    value={cardDraft.bd_owner}
                    onChange={e => setDraftField('bd_owner', e.target.value)}
                    placeholder="BD 負責人"
                    className="input"
                    style={{ fontSize: 11 }}
                  />
                  <input
                    value={cardDraft.contact_name}
                    onChange={e => setDraftField('contact_name', e.target.value)}
                    placeholder="聯絡人"
                    className="input"
                    style={{ fontSize: 11 }}
                  />
                  <input
                    value={cardDraft.phone}
                    onChange={e => setDraftField('phone', e.target.value)}
                    placeholder="電話"
                    className="input"
                    style={{ fontSize: 11 }}
                  />
                  <input
                    value={cardDraft.line_id}
                    onChange={e => setDraftField('line_id', e.target.value)}
                    placeholder="LINE ID"
                    className="input"
                    style={{ fontSize: 11 }}
                  />
                  <select
                    value={cardDraft.customer_status}
                    onChange={e => setDraftField('customer_status', e.target.value as CustomerStatus)}
                    className="select-field"
                    style={{ fontSize: 11 }}
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{CUSTOMER_STATUS_LABEL[status]}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{
                  fontSize: 11,
                  color: 'var(--t2)',
                  lineHeight: 1.7,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '2px 12px',
                }}>
                  <span>BD：<strong style={{ color: 'var(--t1)', fontWeight: 500 }}>{customer.bd_owner || '—'}</strong></span>
                  <span>聯絡人：<strong style={{ color: 'var(--t1)', fontWeight: 500 }}>{customer.contact_name || '—'}</strong></span>
                  <span>電話：<strong style={{ color: 'var(--t1)', fontWeight: 500 }}>{customer.phone || '—'}</strong></span>
                  <span>LINE：<strong style={{ color: 'var(--t1)', fontWeight: 500 }}>{customer.line_id || '—'}</strong></span>
                </div>
              )}
            </div>

            {/* Deal + Contract row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div className="card-inner">
                <div style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'var(--t3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  交易金額
                </div>
                {cardDraft ? (
                  <input
                    type="number"
                    min={0}
                    value={cardDraft.deal_amount}
                    onChange={e => setDraftField('deal_amount', e.target.value)}
                    className="input"
                    style={{ fontSize: 12 }}
                  />
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                    ${Number(customer.deal_amount ?? 0).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="card-inner">
                <div style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'var(--t3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  合約日期
                </div>
                {cardDraft ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <input
                      type="date"
                      value={cardDraft.contract_started_at}
                      onChange={e => setDraftField('contract_started_at', e.target.value)}
                      className="input"
                      style={{ fontSize: 11 }}
                    />
                    <input
                      type="date"
                      value={cardDraft.contract_ends_at}
                      onChange={e => setDraftField('contract_ends_at', e.target.value)}
                      className="input"
                      style={{ fontSize: 11 }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                    {customer.contract_started_at || '—'}
                    <span style={{ color: 'var(--t3)', margin: '0 4px' }}>→</span>
                    {customer.contract_ends_at || '—'}
                  </div>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="card-inner" style={{ marginBottom: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: 'var(--t3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}>最後追蹤</div>
                  <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                    {formatFollowUpTime(customer.leads?.last_follow_up_at)}
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: 'var(--t3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: 4,
                  }}>最後異動</div>
                  <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                    {formatFollowUpTime(latestLogTimes[customer.id])}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--t3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 5,
              }}>備註</div>
              {cardDraft ? (
                <textarea
                  value={cardDraft.notes}
                  onChange={e => setDraftField('notes', e.target.value)}
                  rows={3}
                  className="textarea-field"
                />
              ) : (
                <div className="card-inner" style={{ minHeight: 36, fontSize: 12, color: customer.notes ? 'var(--t1)' : 'var(--t3)' }}>
                  {customer.notes || '—'}
                </div>
              )}
            </div>

            {/* Save / Cancel */}
            {editing && (
              <div style={{
                display: 'flex',
                gap: 8,
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px solid var(--border)',
              }}>
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ flex: 1 }}
                  disabled={savingId === customer.id}
                  onClick={() => saveEdit(customer)}
                >
                  {savingId === customer.id ? '儲存中…' : '儲存'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  disabled={savingId === customer.id}
                  onClick={cancelEdit}
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
