'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/dashboard/map',       label: '🗺 商家地圖' },
  { href: '/dashboard/ai',        label: '🧠 AI 痛點診斷' },
  { href: '/dashboard/email',     label: '✉️ 推銷信生成' },
  { href: '/dashboard/pipeline',  label: '🎯 欲開發名單' },
  { href: '/dashboard/tracker',   label: '📋 客戶追蹤' },
  { href: '/dashboard/changelog', label: '📁 異動紀錄' },
]

const TITLES: Record<string, string> = {
  '/dashboard/map':       '商家地圖搜尋',
  '/dashboard/ai':        'AI 痛點診斷',
  '/dashboard/email':     '推銷信生成器',
  '/dashboard/pipeline':  '欲開發名單',
  '/dashboard/tracker':   '客戶追蹤系統',
  '/dashboard/changelog': '異動紀錄',
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function globalSearch(q: string) {
    setSearchQ(q)
    if (!q || q.length < 1) { setShowDropdown(false); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const [{ data: bizData }, { data: pipeData }, { data: clientData }] = await Promise.all([
        supabase.from('businesses').select('id, name').ilike('name', `%${q}%`).limit(5),
        supabase.from('pipeline').select('id, businesses(name)').limit(10),
        supabase.from('clients').select('id, businesses(name)').limit(10),
      ])
      const results: SearchResult[] = []
      ;(bizData ?? []).forEach((b: any) => results.push({ name: b.name, page: 'ai', id: b.id, type: '潛在客戶' }))
      ;(pipeData ?? []).forEach((p: any) => {
        const name = p.businesses?.name ?? ''
        if (name.includes(q)) results.push({ name, page: 'pipeline', id: p.id, type: '欲開發' })
      })
      ;(clientData ?? []).forEach((c: any) => {
        const name = c.businesses?.name ?? ''
        if (name.includes(q)) results.push({ name, page: 'tracker', id: c.id, type: '正式客戶' })
      })
      setSearchResults(results)
      setShowDropdown(true)
    }, 200)
  }

  function jumpTo(page: string, id: string) {
    setShowDropdown(false)
    setSearchQ('')
    if (page === 'ai') router.push(`/dashboard/ai?id=${id}`)
    else router.push(`/dashboard/${page}`)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8F5EF', fontFamily: 'sans-serif', fontSize: 13, color: '#2C2C2A' }}>
      {/* Sidebar */}
      <div style={{ width: 155, background: '#2C2C2A', display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: '100vh' }}>
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#FAC775' }}>EatQ</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>業務開發系統</div>
        </div>
        <nav style={{ padding: '6px 0', flex: 1 }}>
          {NAV.map(item => {
            const on = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  fontSize: 11,
                  color: on ? '#FAC775' : 'rgba(255,255,255,.5)',
                  background: on ? 'rgba(250,199,117,.1)' : 'transparent',
                  borderLeft: `2px solid ${on ? '#FAC775' : 'transparent'}`,
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#FAC775', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#2C2C2A' }}>林</div>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>林業務員</div>
              <div onClick={() => router.push('/')} style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', cursor: 'pointer' }}>登出</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar */}
        <div style={{ background: 'white', borderBottom: '1px solid #E8E5DE', padding: '0 14px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'relative' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{TITLES[base] ?? 'Dashboard'}</div>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <input
                value={searchQ}
                onChange={e => globalSearch(e.target.value)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onFocus={() => searchQ && setShowDropdown(true)}
                style={{ padding: '5px 10px', border: '1px solid #D3D1C7', borderRadius: 6, fontSize: 11, width: 160, color: '#2C2C2A', outline: 'none' }}
                placeholder="🔍 搜尋店家..."
              />
              {showDropdown && (
                <div style={{ position: 'absolute', top: 32, right: 0, background: 'white', border: '1px solid #E8E5DE', borderRadius: 7, width: 200, zIndex: 999, boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                  {searchResults.length === 0
                    ? <div style={{ padding: 10, fontSize: 11, color: '#888' }}>找不到相關店家</div>
                    : searchResults.map((r, i) => (
                      <div
                        key={i}
                        onMouseDown={() => jumpTo(r.page, r.id)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F8F6F2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseOver={e => (e.currentTarget.style.background = '#FAEEDA')}
                        onMouseOut={e => (e.currentTarget.style.background = 'white')}
                      >
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{r.name}</span>
                        <span style={{ fontSize: 9, color: '#888', background: '#F1EFE8', padding: '1px 6px', borderRadius: 5 }}>{r.type}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            <span style={{ background: '#FAEEDA', color: '#854F0B', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>推廣期免費</span>
            <span
              onClick={() => setLoc(v => !v)}
              style={{ background: loc ? '#EAF3DE' : '#F1EFE8', color: loc ? '#3B6D11' : '#888', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, cursor: 'pointer' }}
            >📍{loc ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 13, overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
