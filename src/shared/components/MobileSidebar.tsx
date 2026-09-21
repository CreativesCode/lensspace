'use client'

import { useEffect, useRef, useState } from 'react'

import { signOut } from '@/features/auth/actions'
import { MainNavigation } from './MainNavigation'
import { LensSpaceLogo } from './LensSpaceLogo'

export function MobileSidebar({ allowedHrefs, email }: { allowedHrefs: string[]; email: string }) {
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
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="mobile-sidebar" aria-label="Abrir menú principal" className="grid h-11 w-11 place-items-center rounded-lg border border-[#DCECEA] text-[#07322F]">
        <span aria-hidden="true" className="space-y-1.5"><span className="block h-0.5 w-5 bg-current" /><span className="block h-0.5 w-5 bg-current" /><span className="block h-0.5 w-5 bg-current" /></span>
      </button>
      {open ? <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú principal">
        <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#07322F]/60" />
        <aside id="mobile-sidebar" className="relative flex h-full w-[min(86vw,320px)] flex-col bg-slate-950 px-4 py-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4 px-1"><LensSpaceLogo inverse subtitle="Gestión óptica" /><button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú principal" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#2B5E58] text-2xl text-[#D8F5EF]">×</button></div>
          <MainNavigation allowedHrefs={allowedHrefs} onNavigate={() => setOpen(false)} />
          <div className="mt-auto border-t border-[#10463F] pt-4"><p className="truncate text-sm font-semibold text-[#E6F5F3]">{email}</p><p className="mt-1 text-xs text-[#6F9C96]">Sesión activa</p><form action={signOut}><button type="submit" className="mt-4 w-full rounded-lg border border-[#2B5E58] px-4 py-3 text-sm font-medium text-[#A7CFC9]">Cerrar sesión</button></form></div>
        </aside>
      </div> : null}
    </>
  )
}
