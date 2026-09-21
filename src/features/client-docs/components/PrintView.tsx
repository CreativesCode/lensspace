'use client'

import { useEffect, useMemo, useState } from 'react'
import { LensSpaceLogo } from '@/shared/components'
import { COPY } from '../generators/copy'
import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience } from '../generators/types'
import { clientDocsInput } from '../schemas/clientDocsInput'
import './print.css'

/* eslint-disable @next/next/no-img-element -- manual images can be edited to arbitrary local paths */

const storageKey = 'lensspace-manual-generator-input'
const imageLine = /^!\[(.*?)\]\((.+?)\)$/

function Body({ content }: { content: string }) { const blocks: React.ReactNode[] = []; let list: string[] = []; let ordered = false; const flush = () => { if (!list.length) return; const items = list; const Tag = ordered ? 'ol' : 'ul'; blocks.push(<Tag key={`list-${blocks.length}`}>{items.map((item, index) => <li key={index}>{item}</li>)}</Tag>); list = [] }; content.split('\n').forEach((raw, index) => { const line = raw.trim(); if (!line) { flush(); return } const image = line.match(imageLine); if (image) { flush(); blocks.push(<figure className="print-figure" key={index}><img src={image[2]} alt={image[1]} /><figcaption>{image[1]}</figcaption></figure>); return } if (line.startsWith('# ')) { flush(); blocks.push(<h1 key={index}>{line.slice(2)}</h1>); return } if (line.startsWith('## ')) { flush(); blocks.push(<h2 key={index}>{line.slice(3)}</h2>); return } const number = line.match(/^\d+\.\s+(.*)$/); if (number) { if (!ordered) { flush(); ordered = true } list.push(number[1]); return } if (line.startsWith('- ')) { if (ordered) { flush(); ordered = false } list.push(line.slice(2)); return } flush(); blocks.push(<p key={index}>{line}</p>) }); flush(); return <>{blocks}</> }

export function PrintView({ generatedDateLabel }: { generatedDateLabel: string }) {
  const [input, setInput] = useState<ClientDocsInput>(clientDocsInput); const [audience, setAudience] = useState<ManualAudience>('worker'); const [ready, setReady] = useState(false)
  useEffect(() => { const id = window.setTimeout(() => { try { const raw = localStorage.getItem(storageKey); if (raw) { const parsed = JSON.parse(raw) as { input?: ClientDocsInput; audience?: ManualAudience }; if (parsed.input) setInput(parsed.input); if (parsed.audience) setAudience(parsed.audience) } const query = new URLSearchParams(window.location.search).get('audience'); if (query === 'worker' || query === 'admin') setAudience(query) } catch { /* defaults */ } setReady(true) }, 0); return () => window.clearTimeout(id) }, [])
  const docs = useMemo(() => generateClientDocs(input, audience), [input, audience])
  useEffect(() => { if (!ready) return; const id = window.setTimeout(() => window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print())), 500); return () => window.clearTimeout(id) }, [ready])
  return <><aside className="print-notice" data-no-print><strong>Antes de guardar como PDF</strong><p>En «Más ajustes», desactiva «Encabezados y pies de página» para evitar que el navegador añada su URL y fecha sobre el diseño.</p></aside><div data-print-root data-doc-type={audience === 'admin' ? 'Manual de administración' : 'Manual operativo'}><header className="print-cover"><LensSpaceLogo subtitle="De la receta a la entrega" /><p className="eyebrow">{audience === 'admin' ? 'Manual de administración' : 'Manual operativo'}</p><h1>{docs.title.replace(/^.*?·\s*/, '')}</h1><p>{docs.subtitle}</p><small>Generado el {generatedDateLabel}</small></header><nav className="print-toc"><h2>Índice</h2><ol>{docs.sections.map((section) => <li key={section.id}>{section.title}</li>)}</ol></nav>{docs.sections.map((section) => <section className="print-section" key={section.id}><p className="section-type">{COPY.sectionTypeLabel[section.type]}</p><Body content={section.content} /></section>)}</div></>
}
