'use client'

import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { MainNavigation } from './MainNavigation'
import { LensSpaceLogo } from './LensSpaceLogo'
import { SidebarAccount, type ShellIdentity } from './SidebarAccount'

export function MobileSidebar({ allowedHrefs, counts, identity }: { allowedHrefs: string[]; counts?: Record<string, number>; identity: ShellIdentity }) {
  const [open, setOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-sidebar" aria-label="Abrir menú principal" className="grid size-11 place-items-center rounded-control border border-on-ink-stroke text-on-ink-soft transition hover:bg-ink-2">
        <Menu aria-hidden="true" size={20} />
      </button>
      {open ? <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú principal">
        <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute inset-0 bg-[rgba(7,50,47,0.55)]" />
        <aside id="mobile-sidebar" className="relative flex h-full w-[min(86vw,320px)] flex-col overflow-y-auto bg-ink px-3.5 pb-[18px] pt-5 shadow-e3">
          <div className="flex items-start justify-between gap-4 px-1.5">
            <LensSpaceLogo compact inverse subtitle={identity.organizationName} />
            <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú principal" className="grid size-11 shrink-0 place-items-center rounded-control border border-on-ink-stroke text-on-ink-soft">
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <MainNavigation allowedHrefs={allowedHrefs} counts={counts} onNavigate={() => setOpen(false)} />
          <div className="mt-auto pt-[22px]"><SidebarAccount identity={identity} /></div>
        </aside>
      </div> : null}
    </>
  )
}
