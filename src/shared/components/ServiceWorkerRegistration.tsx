'use client'

import { useEffect } from 'react'

// Registers the offline-fallback worker in production only (dev reloads constantly).
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => undefined)
  }, [])
  return null
}
