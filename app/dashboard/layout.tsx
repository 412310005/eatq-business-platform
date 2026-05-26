'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { DEMO_AUTH_STORAGE_KEY } from '@/lib/demoAuth'
import '@/lib/mapHardNav'
import { hardNavigateToMap, mapUrlWithRemount } from '@/lib/mapHardNav'

const WORKFLOW_NAV = [
  { href: '/dashboard/map',       label: '🗺', text: '商家地圖' },
  { href: '/dashboard/pipeline',  label: '🎯', text: '欲開發名單' },
  { href: '/dashboard/clients',   label: '📋', text: '客戶追蹤' },
  { href: '/dashboard/changelog', label: '📁', text: '異動紀錄' },
]

const TOOL_NAV = [
  { href: '/dashboard/ai',    label: '📝', text: 'BD 手動觀察' },
  { href: '/dashboard/email', label: '✉️', text: '推銷信生成' },
]

const TITLES: Record<string, string> = {
  '/dashboard/map':          '商家地圖搜尋',
  '/dashboard/ai':           'BD 手動觀察',
  '/dashboard/ai-diagnosis': '已停用的 AI 診斷',
  '/dashboard/email':        '推銷信生成器',
  '/dashboard/pipeline':     '欲開發名單',
  '/dashboard/clients':      '客戶追蹤',
  '/dashboard/tracker':      '客戶追蹤系統',
  '/dashboard/changelog':    '異動紀錄',
}

type SearchResult = { name: string; page: string; id: string; type: string }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const base = '/' + pathname.split('/').slice(1, 3).join('/')

  const [loc, setLoc] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (localStorage.getItem(DEMO_AUTH_STORAGE_KEY) !== '1') {
      router.replace('/')
      return
    }
    setAuthChecked(true)
  }, [router])

  async function globalSearch(q: string) {
    setSearchQ(q)
    if (!q || q.length < 1) { setShowDropdown(false); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const [{ data: leadData }, { data: clientData }] = await Promise.all([
        supabase.from('leads').select('id, store_name').eq('is_deleted', false).ilike('store_name', `%${q}%`).limit(8),
        supabase.from('customers').select('id, store_name').eq('is_deleted', false).ilike('store_name', `%${q}%`).limit(8),
      ])
      const results: SearchResult[] = []
      ;(leadData ?? []).forEach((p: { id: string; store_name: string }) => {
        results.push({ name: p.store_name, page: 'pipeline', id: p.id, type: '欲開發' })
      })
      ;(clientData ?? []).forEach((c: { id: string; store_name: string }) => {
        results.push({ name: c.store_name, page: 'clients', id: c.id, type: '正式客戶' })
      })
      setSearchResults(results)
      setShowDropdown(true)
    }, 200)
  }

  function jumpTo(page: string, id: string) {
    setShowDropdown(false)
    setSearchQ('')
    router.push(`/dashboard/${page}`)
  }

  function openMapWorkbench(e: React.MouseEvent) {
    e.preventDefault()
    if (pathname.startsWith('/dashboard/map')) {
      console.log('[map-nav] sidebar map: refresh same route')
      router.refresh()
      router.replace(mapUrlWithRemount())
      return
    }
    hardNavigateToMap('sidebar')
  }

  function logout() {
    localStorage.removeItem(DEMO_AUTH_STORAGE_KEY)
    router.push('/')
  }

  if (!authChecked) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
      fontFamily: "var(--font-inter), var(--font-noto), 'Inter', 'Noto Sans TC', ui-sans-serif, system-ui, sans-serif",
      fontSize: 13,
      color: 'var(--t1)',
    }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <div style={{
        width: 188,
        background: 'var(--sb-bg)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        height: '100vh',
        overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{
          padding: '18px 16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--gold-light)',
            letterSpacing: '-0.03em',
          }}>EatQ</div>
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.28)',
            marginTop: 2,
            letterSpacing: '0.05em',
            fontWeight: 400,
          }}>業務開發系統</div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '8px 0', flex: 1 }}>

          {/* Workflow section label */}
          <div style={{
            padding: '8px 16px 5px',
            fontSize: 9,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.22)',
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
          }}>
            Workflow
          </div>

          {WORKFLOW_NAV.map(item => {
            const on = pathname.startsWith(item.href)
            if (item.href === '/dashboard/map') {
              return (
                <a
                  key={item.href}
                  href={mapUrlWithRemount()}
                  onClick={openMapWorkbench}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: on ? 600 : 400,
                    color: on ? 'var(--sb-active)' : 'var(--sb-text)',
                    background: on ? 'rgba(250,199,117,0.10)' : 'transparent',
                    borderLeft: `2px solid ${on ? 'var(--sb-active)' : 'transparent'}`,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.13s ease',
                    letterSpacing: '-0.01em',
                  }}
                >
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{item.label}</span>
                  {item.text}
                </a>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: on ? 600 : 400,
                  color: on ? 'var(--sb-active)' : 'var(--sb-text)',
                  background: on ? 'rgba(250,199,117,0.10)' : 'transparent',
                  borderLeft: `2px solid ${on ? 'var(--sb-active)' : 'transparent'}`,
                  textDecoration: 'none',
                  transition: 'all 0.13s ease',
                  letterSpacing: '-0.01em',
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0 }}>{item.label}</span>
                {item.text}
              </Link>
            )
          })}

          {/* Tools divider */}
          <div style={{
            height: 1,
            background: 'rgba(255,255,255,0.06)',
            margin: '8px 16px 6px',
          }} />

          {/* Tools section label */}
          <div style={{
            padding: '2px 16px 5px',
            fontSize: 9,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.18)',
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
          }}>
            Tools
          </div>

          {TOOL_NAV.map(item => {
            const on = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '7px 16px',
                  fontSize: 12,
                  fontWeight: on ? 600 : 400,
                  color: on ? 'rgba(250,199,117,0.85)' : 'rgba(255,255,255,0.32)',
                  background: on ? 'rgba(250,199,117,0.07)' : 'transparent',
                  borderLeft: `2px solid ${on ? 'rgba(250,199,117,0.6)' : 'transparent'}`,
                  textDecoration: 'none',
                  transition: 'all 0.13s ease',
                  letterSpacing: '-0.01em',
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0 }}>{item.label}</span>
                {item.text}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(250,199,117,0.18)',
              border: '1px solid rgba(250,199,117,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--sb-active)',
              flexShrink: 0,
            }}>林</div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500, letterSpacing: '-0.01em' }}>林業務員</div>
              <div
                onClick={logout}
                style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', cursor: 'pointer', marginTop: 1, letterSpacing: '0.02em' }}
              >
                登出
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topbar */}
        <div style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '0 20px',
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          position: 'relative',
        }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--t1)',
            letterSpacing: '-0.02em',
          }}>
            {TITLES[base] ?? 'Dashboard'}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                value={searchQ}
                onChange={e => globalSearch(e.target.value)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onFocus={() => searchQ && setShowDropdown(true)}
                style={{
                  padding: '5px 12px 5px 32px',
                  border: '1px solid var(--border-2)',
                  borderRadius: 'var(--r-f)',
                  fontSize: 12,
                  width: 176,
                  color: 'var(--t1)',
                  background: 'var(--bg-2)',
                  outline: 'none',
                  transition: 'border-color 0.13s ease, box-shadow 0.13s ease',
                }}
                placeholder="搜尋店家..."
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.20)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
              />
              <div style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 13,
                color: 'var(--t3)',
                pointerEvents: 'none',
              }}>
                🔍
              </div>
              {showDropdown && (
                <div style={{
                  position: 'absolute',
                  top: 36,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r)',
                  width: 220,
                  zIndex: 999,
                  boxShadow: 'var(--sh-md)',
                  overflow: 'hidden',
                }}>
                  {searchResults.length === 0
                    ? <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--t3)' }}>找不到相關店家</div>
                    : searchResults.map((r, i) => (
                      <div
                        key={i}
                        onMouseDown={() => jumpTo(r.page, r.id)}
                        style={{
                          padding: '9px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{r.name}</span>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: 'var(--t3)',
                          background: 'var(--bg-2)',
                          padding: '2px 7px',
                          borderRadius: 'var(--r-f)',
                        }}>{r.type}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Free badge */}
            <span style={{
              background: 'var(--gold-bg)',
              color: 'var(--gold)',
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--r-f)',
              letterSpacing: '0.03em',
            }}>
              推廣期免費
            </span>

            {/* Location toggle */}
            <span
              onClick={() => setLoc(v => !v)}
              style={{
                background: loc ? 'var(--green-bg)' : 'var(--bg-2)',
                color: loc ? 'var(--green)' : 'var(--t3)',
                fontSize: 9,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 'var(--r-f)',
                cursor: 'pointer',
                letterSpacing: '0.03em',
                transition: 'background 0.13s, color 0.13s',
              }}
            >
              📍 {loc ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
