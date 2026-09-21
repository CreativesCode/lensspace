'use client'

import { Filter, RotateCcw, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

export function FilterPanel({ title, eyebrow, activeFilterCount, resultCount, onClear, children }: { title: string; eyebrow: string; activeFilterCount: number; resultCount: number; onClear: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <>
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir filtros" title="Filtros" className="relative grid h-11 w-11 place-items-center rounded-[7px] border border-[#9BCDC6] bg-white text-[#0D7A72] hover:bg-[#F0FBF9]">
        <Filter aria-hidden="true" size={19} />
        {activeFilterCount ? <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#C23C1C] px-1 text-[10px] font-bold text-white">{activeFilterCount}</span> : null}
      </button>
      {activeFilterCount ? <button type="button" onClick={onClear} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-[#DCECEA] bg-white px-3 py-2.5 text-sm font-semibold text-[#4A5B58]"><RotateCcw aria-hidden="true" size={16} />Limpiar</button> : null}
    </div>
    {open ? <div role="dialog" aria-modal="true" aria-labelledby={`filter-dialog-${title}`} className="fixed inset-0 z-50 grid place-items-center bg-[#07322F]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[12px] bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#E3EFED] p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0D7A72]">{eyebrow}</p><h2 id={`filter-dialog-${title}`} className="mt-1 font-display text-xl font-bold text-[#07322F]">{title}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar diálogo" className="grid h-10 w-10 place-items-center rounded-lg border border-[#DCECEA] text-[#07322F]"><X aria-hidden="true" size={20} /></button></header>
        <div className="p-5">{children}<p className="mt-4 text-xs text-[#74857F]">{resultCount} resultado{resultCount === 1 ? '' : 's'}</p><div className="mt-5 flex justify-end gap-3 border-t border-[#EEF5F4] pt-4">{activeFilterCount ? <button type="button" onClick={onClear} className="inline-flex items-center gap-2 rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58]"><RotateCcw aria-hidden="true" size={16} />Limpiar</button> : null}<button type="button" onClick={() => setOpen(false)} className="rounded-[7px] bg-[#07322F] px-5 py-2.5 text-sm font-semibold text-white">Ver resultados</button></div></div>
      </div>
    </div> : null}
  </>
}
