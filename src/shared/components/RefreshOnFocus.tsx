'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const AWAY_MS = 60_000

// QA-26/QA-27: without polling or Realtime (bandwidth), re-render the current route
// when the user comes back after at least a minute, when the connection returns and
// on back/forward (which otherwise restores a stale snapshot). Each refresh costs the
// same as one link navigation.
export function RefreshOnFocus() {
  const router = useRouter()

  useEffect(() => {
    let hiddenAt = 0
    const refresh = () => router.refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) refresh()
    }
    // Let the router restore the history entry first, then refresh that route.
    const onPopState = () => window.setTimeout(refresh, 0)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', refresh)
    window.addEventListener('popstate', onPopState)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', refresh)
      window.removeEventListener('popstate', onPopState)
    }
  }, [router])

  return null
}
