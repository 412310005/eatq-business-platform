'use client'

import { useEffect, useState } from 'react'
import { CUSTOMER_STATUS_LABEL, type CustomerStatus } from '@/lib/customers'
import { getCustomerLogs, type CustomerLogRow } from '@/lib/customerLogs'

const ACTION_LABEL: Record<CustomerLogRow['action_type'], string> = {
  customer_created: '建立客戶',
  status_changed:   '狀態變更',
  customer_deleted: '刪除客戶',
}

const ACTION_STYLE: Record<CustomerLogRow['action_type'], { bg: string; color: string; icon: string }> = {
  customer_created: { bg: 'var(--green-bg)', color: 'var(--green)',  icon: '＋' },
  status_changed:   { bg: 'var(--blue-bg)',  color: 'var(--blue)',   icon: '↔' },
  customer_deleted: { bg: 'var(--red-bg)',   color: 'var(--red)',    icon: '✕' },
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

  if (loading) return <div className="loading-text">載入中...</div>

  if (error) {
    return (
      <div className="alert-error">
        無法讀取異動紀錄：{error}
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📁</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>
          尚無異動紀錄
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)' }}>
          建立客戶、狀態修改、刪除客戶時，紀錄會出現在這裡
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <span className="page-meta">異動紀錄 · {logs.length} 筆</span>
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {logs.map((log, idx) => {
          const style = ACTION_STYLE[log.action_type]
          const isLast = idx === logs.length - 1

          return (
            <div
              key={log.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 18px',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
              }}
            >
              {/* Avatar icon */}
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: style.bg,
                color: style.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {style.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                  flexWrap: 'wrap',
                }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--t1)',
                    letterSpacing: '-0.01em',
                  }}>
                    {log.customers?.store_name ?? '未知客戶'}
                  </div>
                  <span className={`badge badge-${
                    log.action_type === 'customer_created' ? 'green' :
                    log.action_type === 'status_changed'   ? 'blue' : 'red'
                  }`}>
                    {ACTION_LABEL[log.action_type]}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 3 }}>
                  {changeText(log)}
                </div>

                {log.note && (
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 3 }}>
                    備註：{log.note}
                  </div>
                )}

                <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.02em' }}>
                  {formatDateTime(log.created_at)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
