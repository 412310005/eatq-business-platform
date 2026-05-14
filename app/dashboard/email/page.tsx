'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DIRS, buildEmailBody, buildScript, type BusinessRow, type DirKey, type Review } from '@/lib/constants'

const CHANNEL_TABS = [
  { id: 'email', label: 'Email' },
  { id: 'line',  label: 'LINE' },
  { id: 'ig',    label: 'IG/FB' },
  { id: 'call',  label: '電話腳本' },
]

function EmailContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [biz, setBiz] = useState<BusinessRow | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [dirs, setDirs] = useState<Record<DirKey, boolean>>({ food: false, queue: false, digital: false, pay: false })
  const [tab, setTab] = useState('email')
  const [contact, setContact] = useState('')

  useEffect(() => {
    const id = params.get('id')
    if (id) {
      supabase.from('businesses').select('*, reviews(*)').eq('id', id).single().then(({ data }) => {
        if (data) {
          const b = data as BusinessRow
          setBiz(b)
          setReviews((b.reviews ?? []) as Review[])
        }
      })
    }
    try {
      const stored = sessionStorage.getItem('eatq_dirs')
      if (stored) setDirs(JSON.parse(stored))
    } catch {}
  }, [params])

  const activeDirs = (Object.keys(dirs) as DirKey[]).filter(k => dirs[k])

  function getPreviewHtml(): string {
    if (!biz) return ''
    if (tab === 'email') return buildEmailBody(biz.name, reviews, dirs, '林○○')
    if (tab === 'line') {
      const lines = activeDirs.length > 0
        ? activeDirs.map(k => '✅ ' + DIRS[k].pitch).join('<br>')
        : '✅ 我們可以幫您提升店面營運效率'
      return `您好，我是 EatQ 業務林○○ 👋<br><br>${lines}<br><br>📱 掃條碼就能開始，完全不增加人力<br>🎁 推廣期免費試用一年<br><br>方便撥空聊聊嗎？🙏`
    }
    if (tab === 'ig') {
      const lines = activeDirs.length > 0
        ? '我們的系統可以幫您：<br>' + activeDirs.map(k => '▸ ' + DIRS[k].pitch).join('<br>')
        : '想跟您分享一個提升營運效率的好方法！'
      return `👋 您好！我是 EatQ 的林○○<br><br>${lines}<br><br>目前推廣期完全免費試用一年，有興趣了解嗎？ 🙌`
    }
    return buildScript(biz.name, reviews, dirs, '林○○')
  }

  async function addToPipeline() {
    if (!biz) return
    const { data: existing } = await supabase.from('pipeline').select('id').eq('business_id', biz.id).single()
    if (existing) {
      alert(`⚠️ ${biz.name} 已在欲開發名單中！`)
      router.push('/dashboard/pipeline')
      return
    }
    await supabase.from('pipeline').insert({
      business_id: biz.id,
      status: 'prospect',
      assigned_to: '00000000-0000-0000-0000-000000000000',
      priority: 'medium',
      estimated_value: 0,
      notes: '',
      contact_name: contact,
      contact_phone: '',
      contact_line: '',
      said: false,
      sent: false,
      other_user: '',
      dirs,
    })
    router.push('/dashboard/pipeline')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {/* Left */}
      <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', fontSize: 11, fontWeight: 600 }}>✉️ 推銷信生成器</div>
        <div style={{ padding: '10px 12px' }}>
          {activeDirs.length > 0 ? (
            <div style={{ background: '#EAF3DE', borderRadius: 6, padding: '7px 9px', marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: '#3B6D11', fontWeight: 700, marginBottom: 3 }}>✅ 已選擇推銷方向</div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {activeDirs.map(k => (
                  <span key={k} style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: DIRS[k].bg, color: DIRS[k].tc }}>{DIRS[k].label}</span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: '#FEF9EE', borderRadius: 6, padding: '7px 9px', marginBottom: 8, fontSize: 10, color: '#633806' }}>
              💡 <span onClick={() => router.back()} style={{ color: '#C8841A', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}>返回診斷頁勾選推銷方向</span>，信件內容更精準
            </div>
          )}

          {/* Channel tabs */}
          <div style={{ display: 'flex', gap: 3, background: '#F0EDE6', borderRadius: 6, padding: 3, marginBottom: 10 }}>
            {CHANNEL_TABS.map(t => (
              <div
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: 4, borderRadius: 4, background: tab === t.id ? 'white' : 'transparent', textAlign: 'center', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: tab === t.id ? '#2C2C2A' : '#888' }}
              >
                {t.label}
              </div>
            ))}
          </div>

          {/* Target + contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>目標店家</div>
              <input
                value={biz?.name ?? ''}
                readOnly
                style={{ width: '100%', padding: '5px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box', color: '#2C2C2A', background: '#F8F5EF' }}
              />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>接洽人員</div>
              <input
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="老闆稱謂"
                style={{ width: '100%', padding: '5px 8px', border: '1px solid #D3D1C7', borderRadius: 5, fontSize: 11, boxSizing: 'border-box', color: '#2C2C2A', outline: 'none' }}
              />
            </div>
          </div>

          <button
            onClick={addToPipeline}
            style={{ width: '100%', padding: 8, background: '#C8841A', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >生成並加入欲開發名單 →</button>
        </div>
      </div>

      {/* Right: Preview */}
      <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0EDE6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, fontWeight: 600 }}>👁 預覽</div>
          <button
            onClick={() => {
              const text = biz ? getPreviewHtml().replace(/<br>/g, '\n').replace(/<[^>]+>/g, '') : ''
              navigator.clipboard.writeText(text)
            }}
            style={{ padding: '3px 8px', border: '1px solid #D3D1C7', borderRadius: 5, background: 'white', fontSize: 10, cursor: 'pointer' }}
          >複製</button>
        </div>
        <div style={{ padding: '10px 12px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {!biz ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: 11 }}>← 請先從 AI 診斷頁進入</div>
          ) : (
            <>
              {tab === 'email' && (
                <div style={{ fontSize: 10, color: '#888', marginBottom: 5 }}>主旨：給{biz.name}老闆的一封信</div>
              )}
              <div
                style={{ background: '#F8F5EF', border: '1px solid #E8E5DE', borderRadius: 6, padding: 10, fontSize: 11, lineHeight: 1.9, color: '#5F5E5A' }}
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />
            </>
          )}
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
