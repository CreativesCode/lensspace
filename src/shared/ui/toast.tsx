'use client'

import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

// Transient confirmation. The parent owns the message; it is cleared after `duration` ms.
export function Toast({ message, onDismiss, duration = 2800 }: { message: string; onDismiss: () => void; duration?: number }) {
  const dismissRef = useRef(onDismiss)
  useEffect(() => { dismissRef.current = onDismiss }, [onDismiss])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => dismissRef.current(), duration)
    return () => window.clearTimeout(timer)
  }, [message, duration])

  if (!message) return null
  return (
    <div role="status" aria-live="polite" className="fixed bottom-[26px] left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-card bg-ink px-[18px] py-3.5 text-on-ink-text shadow-[0_16px_40px_rgba(7,50,47,0.32)]">
      <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-mint text-ink">
        <Check aria-hidden="true" size={13} strokeWidth={3} />
      </span>
      <span className="text-[14.5px]">{message}</span>
    </div>
  )
}
