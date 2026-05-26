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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg)',
      fontFamily: "var(--font-inter), var(--font-noto), 'Inter', 'Noto Sans TC', ui-sans-serif, system-ui, sans-serif",
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-xl)',
        padding: '36px 32px',
        width: 320,
        boxShadow: '0 2px 6px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.08)',
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--gold)',
            letterSpacing: '-0.04em',
            marginBottom: 4,
          }}>
            EatQ
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--t3)',
            fontWeight: 400,
            letterSpacing: '0.04em',
          }}>
            業務開發系統
          </div>
        </div>

        {/* Email */}
        <div style={{ marginBottom: 12 }}>
          <label style={{
            display: 'block',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--t3)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 5,
          }}>帳號</label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-sm)',
              fontSize: 13,
              boxSizing: 'border-box',
              color: 'var(--t1)',
              background: 'var(--bg)',
              outline: 'none',
              transition: 'border-color 0.14s, box-shadow 0.14s',
              fontFamily: 'inherit',
            }}
            placeholder="demo@eatq.tw"
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--gold)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200,132,26,0.12)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border-2)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--t3)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            marginBottom: 5,
          }}>密碼</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleLogin() }}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--r-sm)',
              fontSize: 13,
              boxSizing: 'border-box',
              outline: 'none',
              background: 'var(--bg)',
              transition: 'border-color 0.14s, box-shadow 0.14s',
              fontFamily: 'inherit',
            }}
            placeholder="••••••••"
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--gold)'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(200,132,26,0.12)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border-2)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>

        {/* Role selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {(['sales', 'manager'] as const).map(r => (
            <div
              key={r}
              onClick={() => setRole(r)}
              style={{
                flex: 1,
                padding: '7px 0',
                border: `1px solid ${role === r ? 'var(--gold)' : 'var(--border-2)'}`,
                borderRadius: 'var(--r-sm)',
                background: role === r ? 'var(--gold-bg)' : 'transparent',
                color: role === r ? 'var(--gold-hover)' : 'var(--t3)',
                textAlign: 'center',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                transition: 'all 0.13s ease',
                letterSpacing: '-0.01em',
              }}
            >
              {r === 'sales' ? '業務員' : '主管'}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            color: 'var(--red)',
            fontSize: 12,
            marginBottom: 12,
            padding: '8px 12px',
            background: 'var(--red-bg)',
            borderRadius: 'var(--r-sm)',
          }}>
            {error}
          </div>
        )}

        {/* Login button */}
        <button
          onClick={() => { void handleLogin() }}
          style={{
            width: '100%',
            padding: 11,
            background: submitting ? 'var(--gold-hover)' : 'var(--gold)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--r-sm)',
            fontSize: 13,
            fontWeight: 600,
            cursor: submitting ? 'wait' : 'pointer',
            transition: 'background 0.14s',
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? '登入中...' : '登入'}
        </button>

        {/* Hint */}
        <div style={{
          marginTop: 16,
          background: 'var(--blue-bg)',
          borderRadius: 'var(--r-sm)',
          padding: '9px 12px',
          fontSize: 11,
          color: 'var(--blue)',
          lineHeight: 1.5,
        }}>
          📍 登入後可開啟定位自動推薦附近商家
        </div>
      </div>
    </div>
  )
}
