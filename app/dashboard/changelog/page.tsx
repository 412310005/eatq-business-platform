'use client'

import { useEffect, useState } from 'react'
import { CUSTOMER_STATUS_LABEL, type CustomerStatus } from '@/lib/customers'
import { getCustomerLogs, type CustomerLogRow } from '@/lib/customerLogs'

const ACTION_LABEL: Record<CustomerLogRow['action_type'], string> = {
  customer_created: '建立客戶',
  status_changed: '狀態變更',
  customer_deleted: '刪除客戶',
}

const ACTION_STYLE: Record<CustomerLogRow['action_type'], { bg: string; color: string; icon: string }> = {
  customer_created: { bg: '#EAF3DE', color: '#3B6D11', icon: '＋' },
  status_changed: { bg: '#E6F1FB', color: '#185FA5', icon: '↔' },
  customer_deleted: { bg: '#FCEBEB', color: '#A32D2D', icon: '✕' },
}

function formatDateTime(value: string): string {
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return value
  return time.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: CustomerStatus | null): string {
  return status ? CUSTOMER_STATUS_LABEL[status] ?? status : '—'
}

function changeText(log: CustomerLogRow): string {
  if (log.action_type === 'status_changed') {
    return `${statusLabel(log.old_status)} → ${statusLabel(log.new_status)}`
  }
  if (log.action_type === 'customer_created') {
    return `建立為 ${statusLabel(log.new_status)}`
  }
  return '客戶已封存'
}

export default function ChangelogPage() {
  const [logs, setLogs] = useState<CustomerLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCustomerLogs()
      .then(({ logs, error }) => {
        setLogs(logs)
        setError(error)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  if (error) {
    return (
      <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#A32D2D' }}>
        無法讀取異動紀錄：{error}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>尚無異動紀錄</div>
        <div style={{ fontSize: 11 }}>建立客戶、狀態修改、刪除客戶時，紀錄會出現在這裡</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600 }}>
        📁 商家異動紀錄 — 共 {logs.length} 筆
      </div>
      {logs.map(log => {
        const actionStyle = ACTION_STYLE[log.action_type]
        return (
          <div key={log.id} style={{ padding: '11px 14px', borderBottom: '1px solid #F8F6F2', display: 'flex', alignItems: 'start', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: actionStyle.bg, color: actionStyle.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              {actionStyle.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{log.customers?.store_name ?? '未知客戶'}</div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: actionStyle.bg, color: actionStyle.color }}>
                  {ACTION_LABEL[log.action_type]}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2 }}>{changeText(log)}</div>
              {log.note && <div style={{ fontSize: 10, color: '#888' }}>備註：{log.note}</div>}
              <div style={{ fontSize: 9, color: '#aaa', marginTop: 3 }}>
                {formatDateTime(log.created_at)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
