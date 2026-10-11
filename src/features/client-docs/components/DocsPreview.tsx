'use client'

import { Lightbulb, TriangleAlert } from 'lucide-react'

import { parseDocBlocks, type DocBlock } from '../generators/docBlocks'
import type { DocSection } from '../generators/types'
import { DocText } from './DocText'

/* eslint-disable @next/next/no-img-element -- manual images can be edited to arbitrary local paths */

const uiLabel = 'rounded-md border border-line-focus bg-action-tint px-1.5 py-px text-[0.93em] font-semibold text-ink [box-decoration-break:clone]'
const body = 'text-[15px] leading-6 text-text [&_strong]:font-semibold [&_strong]:text-ink'

function Block({ block }: { block: DocBlock }) {
  if (block.kind === 'title') return <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">{block.text}</h2>
  if (block.kind === 'heading') return <h3 className="mt-4 border-l-[3px] border-mint pl-3 font-display text-[17px] font-semibold text-ink">{block.text}</h3>
  if (block.kind === 'image') return <figure className="my-2 overflow-hidden rounded-card border border-line"><img src={block.src} alt={block.alt} className="w-full" /><figcaption className="bg-canvas px-4 py-2 text-[13px] text-text-muted">{block.alt}</figcaption></figure>
  if (block.kind === 'steps') return <ol className="flex flex-col gap-2.5">{block.items.map((item, index) => <li key={index} className={`flex gap-3 ${body}`}><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-action text-xs font-bold text-white">{index + 1}</span><span className="min-w-0"><span className="sr-only">Paso {index + 1}: </span><DocText text={item} uiClassName={uiLabel} /></span></li>)}</ol>
  if (block.kind === 'bullets') return <ul className="flex flex-col gap-2">{block.items.map((item, index) => <li key={index} className={`flex gap-3 ${body}`}><span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-mint" /><span className="min-w-0"><DocText text={item} uiClassName={uiLabel} /></span></li>)}</ul>
  if (block.kind === 'note') {
    const warning = block.tone === 'warning'
    const Icon = warning ? TriangleAlert : Lightbulb
    return <aside className={`flex gap-3 rounded-card border px-4 py-3 text-[15px] leading-6 ${warning ? 'border-amber-line bg-amber-soft text-amber-strong' : 'border-line-focus bg-action-tint text-ink'}`}>
      <Icon aria-hidden="true" size={18} className={`mt-[3px] shrink-0 ${warning ? 'text-amber-dot' : 'text-action'}`} />
      <p className="min-w-0">{block.lead ? <strong className="font-semibold">{block.lead}: </strong> : null}<DocText text={block.text} uiClassName={uiLabel} /></p>
    </aside>
  }
  return <p className={body}><DocText text={block.text} uiClassName={uiLabel} /></p>
}

export function DocsPreview({ section }: { section: DocSection }) {
  return <article className="min-h-[620px] rounded-card border border-line-card bg-surface p-5 shadow-e1 sm:p-8">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">{section.title}</p>
    <div className="mt-4 flex flex-col gap-3">{parseDocBlocks(section.content).map((block, index) => <Block key={index} block={block} />)}</div>
  </article>
}
