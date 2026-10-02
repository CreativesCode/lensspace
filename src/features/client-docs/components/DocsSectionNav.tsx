'use client'

import { BookOpen, CircleHelp, FileText, KeyRound, ListChecks, ShieldCheck } from 'lucide-react'
import { cx } from '@/shared/ui'
import type { DocSection } from '../generators/types'

const icons = { overview: BookOpen, access: KeyRound, roles: ShieldCheck, module: FileText, workflow: ListChecks, faq: CircleHelp, support: CircleHelp, policy: ShieldCheck }

export function DocsSectionNav({ sections, selectedSectionId, onSelectSection }: { sections: DocSection[]; selectedSectionId: string; onSelectSection: (id: string) => void }) {
  return <nav aria-label="Secciones del manual" className="flex flex-col gap-0.5">
    <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">Contenido</p>
    {sections.map((section) => { const Icon = icons[section.type]; const active = section.id === selectedSectionId; return <button key={section.id} type="button" onClick={() => onSelectSection(section.id)} aria-current={active ? 'true' : undefined} className={cx('flex min-h-10 w-full items-center gap-2 rounded-control px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action', active ? 'bg-action-soft font-semibold text-ink' : 'text-text hover:bg-[#F0FBF9]')}><Icon aria-hidden="true" size={16} className={active ? 'text-action' : 'text-text-muted'} /><span className="truncate">{section.title}</span></button> })}
  </nav>
}
