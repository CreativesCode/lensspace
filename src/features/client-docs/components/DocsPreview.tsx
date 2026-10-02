'use client'

import type { DocSection } from '../generators/types'

/* eslint-disable @next/next/no-img-element -- manual images can be edited to arbitrary local paths */

const imageLine = /^!\[(.*?)\]\((.+?)\)$/
export function DocsPreview({ section }: { section: DocSection }) {
  return <article className="min-h-[620px] rounded-card border border-line-card bg-surface p-5 shadow-e1 sm:p-8">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">{section.title}</p>
    <div className="mt-4 flex flex-col gap-2">{section.content.split('\n').map((raw, index) => {
      const line = raw.trim(); if (!line) return <div key={index} className="h-2" />
      const image = line.match(imageLine); if (image) return <figure key={index} className="my-5 overflow-hidden rounded-card border border-line"><img src={image[2]} alt={image[1]} className="w-full" /><figcaption className="bg-canvas px-4 py-2 text-[13px] text-text-muted">{image[1]}</figcaption></figure>
      if (line.startsWith('# ')) return <h2 key={index} className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">{line.slice(2)}</h2>
      if (line.startsWith('## ')) return <h3 key={index} className="pt-4 font-display text-[17px] font-semibold text-ink">{line.slice(3)}</h3>
      if (line.startsWith('- ')) return <div key={index} className="flex gap-3 text-[15px] leading-6 text-text"><span className="font-bold text-action">•</span><span>{line.slice(2)}</span></div>
      const ordered = line.match(/^(\d+)\.\s+(.*)$/); if (ordered) return <div key={index} className="flex gap-3 text-[15px] leading-6 text-text"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-action-soft text-xs font-bold text-action">{ordered[1]}</span><span>{ordered[2]}</span></div>
      return <p key={index} className="text-[15px] leading-6 text-text">{line}</p>
    })}</div>
  </article>
}
