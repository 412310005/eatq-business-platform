'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChangelogRow } from '@/lib/constants'

export default function ChangelogPage() {
  const [logs, setLogs] = useState<ChangelogRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('changelogs')
      .select('*')
      .order('changed_at', { ascending: false })
      .then(({ data }) => {
        setLogs((data ?? []) as ChangelogRow[])
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ color: '#888', fontSize: 12 }}>載入中...</div>

  if (logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📁</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 5 }}>尚無異動紀錄</div>
        <div style={{ fontSize: 11 }}>終止合約或續約時，紀錄將自動出現在這裡</div>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600 }}>
        📁 商家異動紀錄 — 共 {logs.length} 筆
      </div>
      {logs.map(log => {
        const isRemove = log.type === '終止'
        return (
          <div key={log.id} style={{ padding: '11px 14px', borderBottom: '1px solid #F8F6F2', display: 'flex', alignItems: 'start', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: isRemove ? '#FCEBEB' : '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
              {isRemove ? '✕' : '🔄'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{log.business_name}</div>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 8, background: isRemove ? '#FCEBEB' : '#EAF3DE', color: isRemove ? '#A32D2D' : '#3B6D11' }}>
                  {log.type}
                </span>
              </div>
              {log.reason && <div style={{ fontSize: 11, color: '#5F5E5A', marginBottom: 2 }}>原因：{log.reason}</div>}
              {log.note && <div style={{ fontSize: 10, color: '#888' }}>備註：{log.note}</div>}
              <div style={{ fontSize: 9, color: '#aaa', marginTop: 3 }}>
                {log.changed_at} · 記錄人：林○○
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
