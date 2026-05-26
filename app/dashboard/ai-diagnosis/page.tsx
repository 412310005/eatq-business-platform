'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function DeprecatedAIDiagnosisContent() {
  const router = useRouter()
  const params = useSearchParams()

  function goToManualObservation() {
    const query = params.toString()
    router.push(query ? `/dashboard/ai?${query}` : '/dashboard/ai')
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 8, padding: '20px 22px', maxWidth: 560 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>AI 診斷頁已停用</div>
      <div style={{ fontSize: 12, color: '#5F5E5A', lineHeight: 1.8, marginBottom: 14 }}>
        EatQ 目前產品方向是「多人 BD 協作開發 SaaS」。舊的評論分數、fake AI 診斷與 mock review workflow 已不再是 production path。
      </div>
      <button
        type="button"
        onClick={goToManualObservation}
        style={{ padding: '9px 14px', background: '#3B6D11', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
      >
        前往 BD 手動觀察
      </button>
    </div>
  )
}

export default function AIDiagnosisPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 12, color: '#888' }}>載入中...</div>}>
      <DeprecatedAIDiagnosisContent />
    </Suspense>
  )
}
