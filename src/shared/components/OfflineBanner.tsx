'use client'

import { WifiOff } from 'lucide-react'
import { useOffline } from 'next/offline'

// `useOffline` also turns true when a navigation or prefetch fails, which is more
// reliable than navigator.onLine on Wi-Fi without upstream internet.
export function OfflineBanner() {
  const isOffline = useOffline()
  if (!isOffline) return null
  return (
    <div role="status" className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-coral-tint px-4 py-2 text-center text-[13px] font-semibold text-coral-deep">
      <WifiOff aria-hidden="true" size={16} className="shrink-0" />
      Sin conexión: lo que ves sigue aquí y reintentaremos al volver la señal.
    </div>
  )
}
