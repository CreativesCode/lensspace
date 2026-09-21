'use client'

import { Download, FileText, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience } from '../generators/types'
import { clientDocsInput } from '../schemas/clientDocsInput'
import { docsToMarkdown, downloadTextFile } from '../services/exportDocs'
import { DocsPreview } from './DocsPreview'
import { DocsSectionNav } from './DocsSectionNav'
import { ManualEditor } from './editor/ManualEditor'

const storageKey = 'lensspace-manual-generator-input'
const safeName = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function ClientDocsGenerator() {
  const [input, setInput] = useState<ClientDocsInput>(clientDocsInput)
  const [audience, setAudience] = useState<ManualAudience>('worker')
  const [selectedId, setSelectedId] = useState('overview')
  const docs = useMemo(() => generateClientDocs(input, audience), [input, audience])
  const selected = docs.sections.find((section) => section.id === selectedId) ?? docs.sections[0]
  const setVariant = (value: ManualAudience) => { setAudience(value); setSelectedId('overview') }
  const markdown = () => downloadTextFile(`manual-${audience}-es-${safeName(input.appName)}.md`, docsToMarkdown(docs))
  const pdf = () => { try { localStorage.setItem(storageKey, JSON.stringify({ input, audience })) } catch { /* defaults remain available */ } window.open(`/manual/print?audience=${audience}`, '_blank', 'noopener,noreferrer') }
  return <div className="min-h-screen bg-[#F7FBFA]">
    <header className="border-b border-[#DCECEA] bg-white px-5 py-5 lg:px-8"><div className="mx-auto flex max-w-[1600px] flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D7A72]">Centro de documentación</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[#07322F]">Manual de LensSpace</h1><p className="mt-2 max-w-3xl text-sm text-[#4A5B58]">Edita el contenido, revisa cada sección y exporta una guía operativa o administrativa en Markdown o PDF.</p></div><div className="flex flex-wrap items-center gap-2"><div role="group" aria-label="Audiencia" className="flex rounded-[8px] border border-[#DCECEA] bg-[#F7FBFA] p-1"><button type="button" onClick={() => setVariant('worker')} className={`rounded-[6px] px-3 py-2 text-xs font-semibold ${audience === 'worker' ? 'bg-[#0D7A72] text-white' : 'text-[#4A5B58]'}`}>Personal operativo</button><button type="button" onClick={() => setVariant('admin')} className={`rounded-[6px] px-3 py-2 text-xs font-semibold ${audience === 'admin' ? 'bg-[#0D7A72] text-white' : 'text-[#4A5B58]'}`}>Administración</button></div><button type="button" onClick={() => { setInput(clientDocsInput); setSelectedId('overview') }} className="inline-flex min-h-10 items-center gap-2 rounded-[7px] border border-[#DCECEA] bg-white px-3 text-sm font-semibold text-[#4A5B58]"><RotateCcw size={15} /> Restablecer</button><button type="button" onClick={markdown} className="inline-flex min-h-10 items-center gap-2 rounded-[7px] border border-[#9BCDC6] bg-white px-3 text-sm font-semibold text-[#0D7A72]"><FileText size={15} /> Markdown</button><button type="button" onClick={pdf} className="inline-flex min-h-10 items-center gap-2 rounded-[7px] bg-[#07322F] px-4 text-sm font-semibold text-white"><Download size={15} /> Descargar PDF</button></div></div></header>
    <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:h-[calc(100vh-118px)] lg:grid-cols-[360px_210px_minmax(0,1fr)] lg:overflow-hidden"><section className="flex min-h-[560px] flex-col overflow-hidden rounded-[10px] border border-[#DCECEA] bg-[#F0F7F5]"><div className="border-b border-[#DCECEA] bg-white px-4 py-3"><h2 className="font-display text-sm font-semibold text-[#07322F]">Editor del contenido</h2><p className="mt-1 text-xs text-[#74857F]">Los cambios se reflejan inmediatamente.</p></div><ManualEditor input={input} onChange={setInput} /></section><aside className="hidden overflow-y-auto rounded-[10px] border border-[#DCECEA] bg-white p-2 lg:block"><DocsSectionNav sections={docs.sections} selectedSectionId={selected.id} onSelectSection={setSelectedId} /></aside><section className="min-w-0 overflow-y-auto"><div className="mb-3 rounded-[10px] border border-[#DCECEA] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#74857F]">{docs.subtitle}</p><h2 className="mt-1 font-display text-lg font-bold text-[#07322F]">{docs.title}</h2><label className="mt-3 block text-xs font-semibold text-[#4A5B58] lg:hidden">Sección<select value={selected.id} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 w-full rounded-[7px] border border-[#DCECEA] px-3 py-2 text-sm">{docs.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></div><DocsPreview section={selected} /></section></main>
  </div>
}
