'use client'

import { useEffect, useMemo } from 'react'
import { LensSpaceLogo } from '@/shared/components'
import { COPY } from '../generators/copy'
import { parseDocBlocks } from '../generators/docBlocks'
import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience } from '../generators/types'
import { DocText } from './DocText'
import './print.css'

/* eslint-disable @next/next/no-img-element -- manual images can be edited to arbitrary local paths */

const ui = 'doc-ui'

function Body({ content }: { content: string }) {
  return <>{parseDocBlocks(content).map((block, index) => {
    if (block.kind === 'title') return <h1 key={index}>{block.text}</h1>
    if (block.kind === 'heading') return <h2 key={index}>{block.text}</h2>
    if (block.kind === 'image') return <figure className="print-figure" key={index}><img src={block.src} alt={block.alt} /><figcaption>{block.alt}</figcaption></figure>
    if (block.kind === 'steps') return <ol className="print-steps" key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><DocText text={item} uiClassName={ui} /></li>)}</ol>
    if (block.kind === 'bullets') return <ul className="print-bullets" key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><DocText text={item} uiClassName={ui} /></li>)}</ul>
    if (block.kind === 'note') return <aside className={`print-note${block.tone === 'warning' ? ' print-note-warning' : ''}`} key={index}>{block.lead ? <strong>{block.lead}: </strong> : null}<DocText text={block.text} uiClassName={ui} /></aside>
    return <p key={index}><DocText text={block.text} uiClassName={ui} /></p>
  })}</>
}

// QA-64: content and audience come from the server (saved manual), so every role prints
// the same approved text.
export function PrintView({ input, audience, generatedDateLabel }: { input: ClientDocsInput; audience: ManualAudience; generatedDateLabel: string }) {
  const docs = useMemo(() => generateClientDocs(input, audience), [input, audience])
  useEffect(() => { const id = window.setTimeout(() => window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.print())), 500); return () => window.clearTimeout(id) }, [])
  return <><aside className="print-notice" data-no-print><strong>Antes de guardar como PDF</strong><p>En «Más ajustes», quita la marca de «Encabezados y pies de página» para que la dirección y la fecha no salgan impresas encima.</p></aside><div data-print-root data-doc-type={COPY.docType[audience]}><header className="print-cover"><LensSpaceLogo subtitle="De la receta a la entrega" /><p className="eyebrow">{COPY.docType[audience]}</p><h1>{docs.title.replace(/^.*?·\s*/, '')}</h1><p>{docs.subtitle}</p><small>Generado el {generatedDateLabel}</small></header><nav className="print-toc"><h2>Índice</h2><ol>{docs.sections.map((section) => <li key={section.id}><span>{section.title}</span><small>{COPY.sectionTypeLabel[section.type]}</small></li>)}</ol></nav>{docs.sections.map((section, index) => <section className="print-section" key={section.id}><p className="section-type"><span>{String(index + 1).padStart(2, '0')}</span>{COPY.sectionTypeLabel[section.type]}</p><Body content={section.content} /></section>)}</div></>
}
