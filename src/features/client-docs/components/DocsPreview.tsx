'use client'

import type { DocSection } from '../generators/types'

/* eslint-disable @next/next/no-img-element -- manual images can be edited to arbitrary local paths */

const imageLine = /^!\[(.*?)\]\((.+?)\)$/
export function DocsPreview({ section }: { section: DocSection }) {
  return <article className="min-h-[620px] rounded-[10px] border border-[#DCECEA] bg-white p-5 shadow-sm sm:p-8">
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0D7A72]">{section.title}</p>
    <div className="mt-4 space-y-2">{section.content.split('\n').map((raw, index) => {
      const line = raw.trim(); if (!line) return <div key={index} className="h-2" />
      const image = line.match(imageLine); if (image) return <figure key={index} className="my-5 overflow-hidden rounded-[10px] border border-[#DCECEA]"><img src={image[2]} alt={image[1]} className="w-full" /><figcaption className="bg-[#F7FBFA] px-4 py-2 text-xs text-[#74857F]">{image[1]}</figcaption></figure>
      if (line.startsWith('# ')) return <h2 key={index} className="font-display text-2xl font-bold tracking-tight text-[#07322F]">{line.slice(2)}</h2>
      if (line.startsWith('## ')) return <h3 key={index} className="pt-4 font-display text-base font-semibold text-[#07322F]">{line.slice(3)}</h3>
      if (line.startsWith('- ')) return <div key={index} className="flex gap-3 text-sm leading-6 text-[#4A5B58]"><span className="font-bold text-[#0D7A72]">•</span><span>{line.slice(2)}</span></div>
      const ordered = line.match(/^(\d+)\.\s+(.*)$/); if (ordered) return <div key={index} className="flex gap-3 text-sm leading-6 text-[#4A5B58]"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#E2F4F1] text-xs font-bold text-[#0D7A72]">{ordered[1]}</span><span>{ordered[2]}</span></div>
      return <p key={index} className="text-sm leading-6 text-[#4A5B58]">{line}</p>
    })}</div>
  </article>
}
