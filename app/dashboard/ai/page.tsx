'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  buildLeadEmailUrl,
  insertLead,
  type LeadSource,
} from '@/lib/leads'

type ObservationForm = {
  storeName: string
  address: string
  category: string
  storeProblem: string
  painPoint: string
  recommendedDirection: string
  notes: string
}

const EMPTY_FORM: ObservationForm = {
  storeName: '',
  address: '',
  category: 'restaurant',
  storeProblem: '',
  painPoint: '',
  recommendedDirection: '',
  notes: '',
}

function Toast({ msg, color }: { msg: string; color: string }) {
  return (
    <div style={{
      position: 'fixed', top: 56, right: 16, zIndex: 9999,
      background: color, color: 'white',
      padding: '10px 18px', borderRadius: 8, fontSize: 12, fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,.2)',
    }}>
      {msg}
    </div>
  )
}

function formatObservationSummary(form: ObservationForm): string {
  return [
    form.storeProblem.trim() ? `【店家問題】${form.storeProblem.trim()}` : '',
    form.painPoint.trim() ? `【痛點】${form.painPoint.trim()}` : '',
    form.recommendedDirection.trim() ? `【推薦方向】${form.recommendedDirection.trim()}` : '',
    form.notes.trim() ? `【備註】${form.notes.trim()}` : '',
  ].filter(Boolean).join('\n')
}

function AIContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [form, setForm] = useState<ObservationForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null)

  const osmId = params.get('osmId')?.trim() || ''
  const lat = Number(params.get('lat')) || null
  const lng = Number(params.get('lng')) || null
  const source: LeadSource = osmId ? 'osm' : 'manual'

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      storeName: params.get('name')?.trim() || prev.storeName,
      address: params.get('address')?.trim() || prev.address,
      category: params.get('category')?.trim() || prev.category || 'restaurant',
    }))
  }, [params])

  function showToast(msg: string, color = '#3B6D11', ms = 2500) {
    setToast({ msg, color })
    window.setTimeout(() => setToast(null), ms)
  }

  function setField<K extends keyof ObservationForm>(key: K, value: ObservationForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function addToLeads() {
    const storeName = form.storeName.trim()
    if (!storeName || saving) return

    setSaving(true)
    const { lead, error, duplicate } = await insertLead({
      store_name: storeName,
      address: form.address.trim(),
      category: form.category.trim() || 'restaurant',
      source,
      status: 'new',
      owner_name: '',
      contact_name: '',
      phone: '',
      line_id: '',
      last_follow_up_at: new Date().toISOString(),
      ai_summary: formatObservationSummary(form) || null,
      pitch_email: null,
      notes: form.notes.trim(),
      business_id: null,
      osm_id: osmId || null,
      lat,
      lng,
    })
    setSaving(false)

    if (error) {
      showToast(`新增失敗：${error}`, '#A32D2D', 5000)
      return
    }
    if (duplicate && lead) {
      showToast(`此店家已在欲開發名單：${lead.store_name}`, '#C8841A')
      return
    }

    showToast('已加入欲開發名單')
    window.setTimeout(() => router.push('/dashboard/pipeline'), 900)
  }

  function goPitchAssist() {
    const storeName = form.storeName.trim()
    if (!storeName) {
      showToast('請先輸入店家名稱', '#C8841A')
      return
    }

    router.push(buildLeadEmailUrl({
      storeName,
      address: form.address.trim(),
      category: form.category.trim() || 'restaurant',
      aiSummary: formatObservationSummary(form) || null,
      source,
      osmId: osmId || undefined,
      lat: lat ?? undefined,
      lng: lng ?? undefined,
    }))
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} color={toast.color} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 10, height: 'calc(100vh - 71px)' }}>
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EDE6' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>BD 手動觀察</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>
              這裡不是 fake AI dashboard。請記錄 BD 現場或公開資訊觀察，AI 只用於後續推銷信輔助。
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>店家名稱 *</div>
                <input
                  value={form.storeName}
                  onChange={e => setField('storeName', e.target.value)}
                  style={{ width: '100%', padding: '7px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>類別</div>
                <input
                  value={form.category}
                  onChange={e => setField('category', e.target.value)}
                  style={{ width: '100%', padding: '7px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>地址</div>
              <input
                value={form.address}
                onChange={e => setField('address', e.target.value)}
                style={{ width: '100%', padding: '7px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>

            {([
              ['storeProblem', '店家問題', '例：午餐尖峰排隊長、晚餐後剩食明顯、外送平台曝光不足'],
              ['painPoint', '痛點', '例：人力不足、浪費食材、回訪率低、尖峰動線卡住'],
              ['recommendedDirection', '推薦方向', '例：剩食變收入、排隊優化、Google評論、外送導流、會員經營'],
              ['notes', '備註', '例：店長下午較有空、先用 LINE 聯絡、已有競品接觸'],
            ] as [keyof ObservationForm, string, string][]).map(([key, label, placeholder]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#888', marginBottom: 3 }}>{label}</div>
                <textarea
                  value={form[key]}
                  onChange={e => setField(key, e.target.value)}
                  placeholder={placeholder}
                  rows={key === 'notes' ? 3 : 4}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #D3D1C7',
                    borderRadius: 6,
                    fontSize: 12,
                    lineHeight: 1.6,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EDE6' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>觀察摘要</div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>此摘要會帶到推銷信輔助與 lead 紀錄。</div>
          </div>

          <div style={{ flex: 1, padding: '12px 14px', overflowY: 'auto' }}>
            <div style={{ whiteSpace: 'pre-wrap', minHeight: 180, background: '#FAF8F2', border: '1px solid #F0EDE6', borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#5F5E5A', lineHeight: 1.7 }}>
              {formatObservationSummary(form) || '尚未輸入觀察內容'}
            </div>

            <div style={{ marginTop: 12, background: '#E6F1FB', border: '1px solid #B5D4F4', color: '#0C447C', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 1.7 }}>
              產品定位提醒：AI 在這個階段只協助生成 outreach 文案，不主導診斷、不產生假分數、不替代 BD 判斷。
            </div>
          </div>

          <div style={{ borderTop: '1px solid #F0EDE6', padding: '10px 12px', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={goPitchAssist}
              style={{ flex: 1, padding: '9px 12px', background: '#C8841A', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              推銷信輔助
            </button>
            <button
              type="button"
              onClick={addToLeads}
              disabled={saving || !form.storeName.trim()}
              style={{ flex: 1, padding: '9px 12px', background: saving || !form.storeName.trim() ? '#A8B895' : '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saving || !form.storeName.trim() ? 'not-allowed' : 'pointer' }}
            >
              {saving ? '加入中...' : '加入欲開發'}
            </button>
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
