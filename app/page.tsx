'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEMO_AUTH_STORAGE_KEY } from '@/lib/demoAuth'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<'sales' | 'manager'>('sales')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin() {
    if (submitting) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/demo-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    setSubmitting(false)

    if (!res.ok) {
      setError('帳號或密碼錯誤')
      return
    }

    localStorage.setItem(DEMO_AUTH_STORAGE_KEY, '1')
    router.push('/dashboard/map')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F8F5EF' }}>
      <div style={{ background: 'white', border: '1px solid #E8E5DE', borderRadius: 12, padding: '28px 24px', width: 300 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#C8841A', marginBottom: 2 }}>EatQ</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 20 }}>業務開發系統</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>帳號</div>
          <input value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '7px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', color: '#2C2C2A', outline: 'none' }} placeholder="salesperson@eatq.tw" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>密碼</div>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void handleLogin() }} style={{ width: '100%', padding: '7px 9px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 12, boxSizing: 'border-box', outline: 'none' }} placeholder="••••••••" />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <div
            onClick={() => setRole('sales')}
            style={{ flex: 1, padding: 7, border: `1px solid ${role === 'sales' ? '#FAC775' : '#D3D1C7'}`, borderRadius: 6, background: role === 'sales' ? '#FAEEDA' : 'white', color: role === 'sales' ? '#854F0B' : '#888', textAlign: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >業務員</div>
          <div
            onClick={() => setRole('manager')}
            style={{ flex: 1, padding: 7, border: `1px solid ${role === 'manager' ? '#FAC775' : '#D3D1C7'}`, borderRadius: 6, background: role === 'manager' ? '#FAEEDA' : 'white', color: role === 'manager' ? '#854F0B' : '#888', textAlign: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >主管</div>
        </div>
        {error && <div style={{ color: '#A32D2D', fontSize: 11, marginBottom: 10 }}>{error}</div>}
        <button
          onClick={() => { void handleLogin() }}
          style={{ width: '100%', padding: 9, background: '#C8841A', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}
        >{submitting ? '登入中...' : '登入'}</button>
        <div style={{ marginTop: 12, background: '#E6F1FB', borderRadius: 6, padding: '8px 10px', fontSize: 10, color: '#0C447C' }}>
          📍 登入後可開啟定位自動推薦附近商家
        </div>
      </div>
    </div>
  )
}
