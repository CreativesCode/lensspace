'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

import { createClient } from '@/lib/supabase/client'

type Counts = Record<string, number>
type NavigationCounters = { ordersWithBalance: number; activeProductionJobs: number }

// Sidebar counters (QA-24). The layout renders them, but layouts do not re-render on
// soft navigation, so after the user's own mutations the counters refresh through one
// tiny RPC instead of reloading the page. A fresh server render resets them.
let liveCounts: Counts | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let inFlight: Promise<void> | null = null
export function refreshNavigationCounters() {
  inFlight ??= (async () => {
    try {
      const { data, error } = await createClient().rpc('get_navigation_counters')
      if (error || !data) return
      const counters = data as unknown as NavigationCounters
      liveCounts = { '/orders': Number(counters.ordersWithBalance ?? 0), '/production': Number(counters.activeProductionJobs ?? 0) }
      emit()
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

export function useNavigationCounts(serverCounts: Counts) {
  // A new server render (refresh or full load) hands new props and is fresher than
  // any local value. A menu that mounts later (mobile drawer) must not reset the store.
  const previous = useRef(serverCounts)
  useEffect(() => {
    if (previous.current === serverCounts) return
    previous.current = serverCounts
    liveCounts = null
    emit()
  }, [serverCounts])
  return useSyncExternalStore(subscribe, () => liveCounts, () => null) ?? serverCounts
}
