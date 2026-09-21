'use client'

import { BookOpen, CircleHelp, FileText, KeyRound, ListChecks, ShieldCheck } from 'lucide-react'
import type { DocSection } from '../generators/types'

const icons = { overview: BookOpen, access: KeyRound, roles: ShieldCheck, module: FileText, workflow: ListChecks, faq: CircleHelp, support: CircleHelp, policy: ShieldCheck }

export function DocsSectionNav({ sections, selectedSectionId, onSelectSection }: { sections: DocSection[]; selectedSectionId: string; onSelectSection: (id: string) => void }) {
  return <nav aria-label="Secciones del manual" className="space-y-1">
    <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#74857F]">Contenido</p>
    {sections.map((section) => { const Icon = icons[section.type]; const active = section.id === selectedSectionId; return <button key={section.id} type="button" onClick={() => onSelectSection(section.id)} className={`flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-sm transition ${active ? 'bg-[#E2F4F1] font-semibold text-[#07322F]' : 'text-[#4A5B58] hover:bg-[#F0FBF9]'}`}><Icon size={16} className={active ? 'text-[#0D7A72]' : 'text-[#74857F]'} /><span className="truncate">{section.title}</span></button> })}
  </nav>
}
