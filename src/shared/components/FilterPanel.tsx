'use client'

import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { Button, Dialog, IconButton } from '@/shared/ui'

export function FilterPanel({ title, eyebrow, activeFilterCount, resultCount, onClear, children }: { title: string; eyebrow: string; activeFilterCount: number; resultCount: number; onClear: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const resultLabel = `${resultCount} resultado${resultCount === 1 ? '' : 's'}`

  return <>
    <div className="flex flex-wrap items-center justify-end gap-2">
      {activeFilterCount ? <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onClear}>Limpiar</Button> : null}
      <IconButton icon={SlidersHorizontal} label="Abrir filtros" count={activeFilterCount} onClick={() => setOpen(true)} />
    </div>
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      eyebrow={eyebrow}
      title={title}
      size="md"
      footer={<>
        {activeFilterCount ? <Button variant="ghost" icon={RotateCcw} onClick={onClear} className="mr-auto">Limpiar todo</Button> : null}
        <Button onClick={() => setOpen(false)}>Ver {resultLabel}</Button>
      </>}
    >
      {children}
    </Dialog>
  </>
}
