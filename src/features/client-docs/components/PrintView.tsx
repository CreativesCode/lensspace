'use client'

import { useEffect, useMemo } from 'react'
import { LensSpaceLogo } from '@/shared/components'
import { COPY } from '../generators/copy'
import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience } from '../generators/types'
import './print.css'

/* eslint-disable @next/next/no-img-element -- manual images can be edited to arbitrary local paths */

const imageLine = /^!\[(.*?)\]\((.+?)\)$/

function Body({ content }: { content: string }) { const blocks: React.ReactNode[] = []; let list: string[] = []; let ordered = false; const flush = () => { if (!list.length) return; const items = list; const Tag = ordered ? 'ol' : 'ul'; blocks.push(<Tag key={`list-${blocks.length}`}>{items.map((item, index) => <li key={index}>{item}</li>)}</Tag>); list = [] }; content.split('\n').forEach((raw, index) => { const line = raw.trim(); if (!line) { flush(); return } const image = line.match(imageLine); if (image) { flush(); blocks.push(<figure className="print-figure" key={index}><img src={image[2]} alt={image[1]} /><figcaption>{image[1]}</figcaption></figure>); return } if (line.startsWith('# ')) { flush(); blocks.push(<h1 key={index}>{line.slice(2)}</h1>); return } if (line.startsWith('## ')) { flush(); blocks.push(<h2 key={index}>{line.slice(3)}</h2>); return } const number = line.match(/^\d+\.\s+(.*)$/); if (number) { if (!ordered) { flush(); ordered = true } list.push(number[1]); return } if (line.startsWith('- ')) { if (ordered) { flush(); ordered = false } list.push(line.slice(2)); return } flush(); blocks.push(<p key={index}>{line}</p>) }); flush(); return <>{blocks}</> }

// QA-64: content and audience come from the server (saved manual), so every role prints
// the same approved text.
export function PrintView({ input, audience, generatedDateLabel }: { input: ClientDocsInput; audience: ManualAudience; generatedDateLabel: string }) {
  const docs = useMemo(() => generateClientDocs(input, audience), [input, audience])
  useEffect(() => { const id = window.setTimeout(() => window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print())), 500); return () => window.clearTimeout(id) }, [])
  return <><aside className="print-notice" data-no-print><strong>Antes de guardar como PDF</strong><p>En «Más ajustes», quita la marca de «Encabezados y pies de página» para que la dirección y la fecha no salgan impresas encima.</p></aside><div data-print-root data-doc-type={audience === 'admin' ? 'Guía del dueño' : 'Guía del equipo'}><header className="print-cover"><LensSpaceLogo subtitle="De la receta a la entrega" /><p className="eyebrow">{audience === 'admin' ? 'Guía del dueño' : 'Guía del equipo'}</p><h1>{docs.title.replace(/^.*?·\s*/, '')}</h1><p>{docs.subtitle}</p><small>Generado el {generatedDateLabel}</small></header><nav className="print-toc"><h2>Índice</h2><ol>{docs.sections.map((section) => <li key={section.id}>{section.title}</li>)}</ol></nav>{docs.sections.map((section) => <section className="print-section" key={section.id}><p className="section-type">{COPY.sectionTypeLabel[section.type]}</p><Body content={section.content} /></section>)}</div></>
}
