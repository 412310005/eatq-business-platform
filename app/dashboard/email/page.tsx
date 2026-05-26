'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getLeadById, updateLead } from '@/lib/leads'
import {
  generateMockPitch,
  parseStoredPitch,
  serializePitch,
  categoryLabel,
  formatAiSummaryWithDirection,
  parsePitchDirectionFromSummary,
  displayAiSummaryText,
  PITCH_DIRECTIONS,
  type PitchContent,
  type PitchDirectionId,
} from '@/lib/pitchGenerator'

const CHANNEL_TABS = [
  { id: 'email', label: 'Email' },
  { id: 'line', label: 'LINE' },
  { id: 'ig', label: 'IG/FB' },
  { id: 'call', label: '電話腳本' },
] as const

type ChannelId = (typeof CHANNEL_TABS)[number]['id']

const EMPTY_PITCH: PitchContent = {
  email: '',
  line: '',
  ig: '',
  call: '',
  directionId: 'food_waste',
  directionLabel: '剩食變收入',
}

function EmailContent() {
  const router = useRouter()
  const params = useSearchParams()
  const leadId = params.get('leadId')?.trim() ?? ''

  const [loading, setLoading] = useState(Boolean(leadId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState('restaurant')
  const [analysisNotes, setAnalysisNotes] = useState('')
  const [selectedDirection, setSelectedDirection] = useState<PitchDirectionId | null>(null)
  const [tab, setTab] = useState<ChannelId>('email')
  const [pitch, setPitch] = useState<PitchContent>(EMPTY_PITCH)
  const [previewReady, setPreviewReady] = useState(false)
  const [savedToDb, setSavedToDb] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [toastColor, setToastColor] = useState('#3B6D11')

  useEffect(() => {
    if (!leadId) {
      setLoadError('請從欲開發名單點選「推銷信」進入')
      setLoading(false)
      return
    }
    setLoading(true)
    getLeadById(leadId).then(({ lead, error }) => {
      setLoading(false)
      if (error) {
        setLoadError(error)
        return
      }
      if (!lead) {
        setLoadError('找不到此筆欲開發名單')
        return
      }
      setStoreName(lead.store_name)
      setAddress(lead.address ?? '')
      setCategory(lead.category ?? 'restaurant')
      setAnalysisNotes(displayAiSummaryText(lead.ai_summary))
      const dir = parsePitchDirectionFromSummary(lead.ai_summary)
      setSelectedDirection(dir)

      const existing = parseStoredPitch(lead.pitch_email)
      if (existing) {
        setPitch(existing)
        setPreviewReady(true)
        setSavedToDb(true)
        if (!dir) setSelectedDirection(existing.directionId)
      }
    })
  }, [leadId])

  function showToast(msg: string, color = '#3B6D11') {
    setToastColor(color)
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  function handleAiGenerate() {
    if (!storeName.trim()) return
    if (!selectedDirection) {
      alert('請先選擇推銷方向')
      return
    }
    const content = generateMockPitch(
      storeName.trim(),
      category,
      selectedDirection,
      analysisNotes || null,
    )
    setPitch(content)
    setPreviewReady(true)
    setSavedToDb(false)
    showToast('已生成預覽（尚未儲存至資料庫）', '#C8841A')
  }

  async function handleSavePitch() {
    if (!leadId || saving) return
    if (!selectedDirection) {
      alert('請先選擇推銷方向')
      return
    }
    if (!previewReady) {
      alert('請先按「AI 生成推銷信」產生預覽')
      return
    }
    const payload = {
      ...pitch,
      directionId: selectedDirection,
      directionLabel: PITCH_DIRECTIONS.find(d => d.id === selectedDirection)!.label,
    }
    const hasContent = [payload.email, payload.line, payload.ig, payload.call].some(t => t.trim())
    if (!hasContent) {
      alert('推銷信內容為空，請重新生成')
      return
    }

    setSaving(true)
    const pitchErr = await updateLead(leadId, {
      pitch_email: serializePitch(payload),
      ai_summary: formatAiSummaryWithDirection(selectedDirection, analysisNotes),
    })
    setSaving(false)

    if (pitchErr) {
      alert(`儲存失敗：${pitchErr}`)
      console.error('[email] save pitch failed', pitchErr)
      return
    }

    setSavedToDb(true)
    showToast('已儲存至 Supabase')
    router.push('/dashboard/pipeline?saved=1')
  }

  function updateChannelText(channel: ChannelId, value: string) {
    setPitch(p => ({ ...p, [channel]: value }))
    setSavedToDb(false)
  }

  const previewText = pitch[tab] ?? ''

  if (loading) {
    return <div style={{ color: '#888', fontSize: 12 }}>載入店家資料…</div>
  }

  if (loadError && !storeName) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888', fontSize: 12 }}>
        <div style={{ marginBottom: 10 }}>{loadError}</div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/pipeline')}
          style={{ padding: '8px 14px', background: '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
        >
          回到欲開發名單
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 56, right: 16, zIndex: 9999,
          background: toastColor, color: 'white', padding: '10px 18px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,.15)',
        }}>
          {toast}
        </div>
      )}

      <div style={{ fontSize: 9, color: '#888', marginBottom: 8, letterSpacing: .3 }}>
        流程：選方向 → 生成預覽 → 儲存後才寫入 Supabase
        {previewReady && !savedToDb && (
          <span style={{ marginLeft: 8, color: '#C8841A', fontWeight: 700 }}>· 預覽中，尚未儲存</span>
        )}
        {savedToDb && <span style={{ marginLeft: 8, color: '#3B6D11', fontWeight: 700 }}>· 已儲存</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600 }}>
            ✉️ 推銷信 · AI 工作流
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ background: '#F8F5EF', borderRadius: 6, padding: '8px 10px', marginBottom: 10, fontSize: 10, lineHeight: 1.55, color: '#5F5E5A' }}>
              <div style={{ fontWeight: 700, color: '#2C2C2A', marginBottom: 4 }}>{storeName}</div>
              <div>📍 {address || '—'} · {categoryLabel(category)}</div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>店家名稱（可修改）</div>
              <input
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 6 }}>
                推銷方向 {selectedDirection ? '' : '（必選）'}
              </div>
              {!selectedDirection && (
                <div style={{ fontSize: 10, color: '#633806', background: '#FEF9EE', padding: '6px 8px', borderRadius: 5, marginBottom: 6 }}>
                  尚未選擇推銷方向
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {PITCH_DIRECTIONS.map(d => {
                  const on = selectedDirection === d.id
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedDirection(d.id)
                        setPreviewReady(false)
                        setSavedToDb(false)
                      }}
                      style={{
                        padding: '5px 9px',
                        fontSize: 9,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: `1px solid ${on ? '#C8841A' : '#D3D1C7'}`,
                        background: on ? '#FAEEDA' : 'white',
                        color: on ? '#854F0B' : '#5F5E5A',
                        cursor: 'pointer',
                      }}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 3, background: '#F0EDE6', borderRadius: 6, padding: 3, marginBottom: 10 }}>
              {CHANNEL_TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1, padding: 5, borderRadius: 4, border: 'none',
                    background: tab === t.id ? 'white' : 'transparent',
                    fontSize: 9, fontWeight: 600, cursor: 'pointer',
                    color: tab === t.id ? '#2C2C2A' : '#888',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={!storeName.trim() || !selectedDirection}
              style={{
                width: '100%', padding: 9, marginBottom: 6,
                background: storeName.trim() && selectedDirection ? '#C8841A' : '#D3D1C7',
                color: 'white', border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 600,
                cursor: storeName.trim() && selectedDirection ? 'pointer' : 'not-allowed',
              }}
            >
              ✨ AI 生成推銷信（僅預覽）
            </button>

            <button
              type="button"
              onClick={handleSavePitch}
              disabled={saving || !previewReady}
              style={{
                width: '100%', padding: 9,
                background: saving ? '#97C459' : previewReady ? '#3B6D11' : '#D3D1C7',
                color: 'white', border: 'none', borderRadius: 6,
                fontSize: 12, fontWeight: 600,
                cursor: saving || !previewReady ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? '儲存中…' : '儲存推銷信 → Supabase'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/dashboard/pipeline')}
              style={{
                width: '100%', marginTop: 6, padding: 6, background: 'transparent',
                border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 10, color: '#888', cursor: 'pointer',
              }}
            >
              返回欲開發名單
            </button>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600 }}>
              {tab === 'email' && '📧 正式完整'}
              {tab === 'line' && '💬 短句口語'}
              {tab === 'ig' && '📱 社群輕鬆'}
              {tab === 'call' && '📞 電話話術'}
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(previewText)}
              disabled={!previewText.trim()}
              style={{ padding: '3px 8px', border: '1px solid #D3D1C7', borderRadius: 5, background: 'white', fontSize: 10, cursor: previewText.trim() ? 'pointer' : 'not-allowed' }}
            >
              複製
            </button>
          </div>
          <div style={{ padding: '10px 12px', flex: 1 }}>
            {!previewReady ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: 11, lineHeight: 1.7 }}>
                1. 選擇推銷方向<br />
                2. 按「AI 生成推銷信」<br />
                3. 確認後按「儲存推銷信」
              </div>
            ) : (
              <textarea
                value={previewText}
                onChange={e => updateChannelText(tab, e.target.value)}
                rows={18}
                style={{
                  width: '100%', minHeight: 280, padding: 10,
                  border: '1px solid #E8E5DE', borderRadius: 6,
                  fontSize: 11, lineHeight: 1.75, resize: 'vertical',
                  boxSizing: 'border-box', fontFamily: 'inherit', color: '#2C2C2A',
                  background: '#FAF8F2',
                }}
              />
            )}
            <div style={{ fontSize: 9, color: '#aaa', marginTop: 6 }}>
              Mock AI · `generateMockPitch()` · 之後替換 OpenAI
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EmailPage() {
  return (
    <Suspense fallback={<div style={{ color: '#888', fontSize: 12 }}>載入中...</div>}>
      <EmailContent />
    </Suspense>
  )
}
