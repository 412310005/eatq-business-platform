/** 商家地圖為核心工作台：避開 Router Cache / bfcache 還原舊 React snapshot */

export function mapUrlWithRemount(): string {
  return `/dashboard/map?r=${Date.now()}`
}

/** 強制重新載入 map route（sessionStorage 會保留） */
export function hardNavigateToMap(reason: string) {
  const url = mapUrlWithRemount()
  console.log('[map-nav] hardNavigateToMap', { reason, url })
  window.location.assign(url)
}

function shouldBustMap(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard/map')
}

function bustMapFromHistory(reason: string) {
  if (!shouldBustMap()) return
  const url = new URL(window.location.href)
  url.searchParams.set('r', String(Date.now()))
  console.log('[map-nav] bustMapFromHistory', { reason, persisted: true, to: url.pathname + url.search })
  window.location.replace(url.toString())
}

if (typeof window !== 'undefined') {
  const w = window as Window & { __eatq_mapHardNav?: boolean }
  if (!w.__eatq_mapHardNav) {
    w.__eatq_mapHardNav = true

    window.addEventListener('pageshow', (e: PageTransitionEvent) => {
      console.log('[map-nav] pageshow fired', { persisted: e.persisted, path: window.location.pathname })
      if (e.persisted && shouldBustMap()) {
        bustMapFromHistory('pageshow-bfcache')
      }
    })

    window.addEventListener('popstate', () => {
      console.log('[map-nav] popstate fired', { path: window.location.pathname })
      if (!shouldBustMap()) return
      queueMicrotask(() => {
        if (!shouldBustMap()) return
        const url = new URL(window.location.href)
        if (!url.searchParams.has('r')) {
          bustMapFromHistory('popstate-no-r')
        }
      })
    })

    console.log('[map-nav] module listeners attached')
  }
}
