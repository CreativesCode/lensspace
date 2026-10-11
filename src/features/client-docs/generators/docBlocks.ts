// Small Markdown subset shared by the web reader and the PDF, so both draw the manual
// the same way: `# ` / `## ` headings, images, numbered steps, `- ` bullets, `> ` notes,
// **bold** and «UI labels». Everything stays valid Markdown for the .md download.

export type DocInline = { kind: 'text' | 'strong' | 'ui'; text: string }
export type DocNoteTone = 'tip' | 'warning'
export type DocBlock =
  | { kind: 'title'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'steps'; items: string[] }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'note'; tone: DocNoteTone; lead?: string; text: string }

const imageLine = /^!\[(.*?)\]\((.+?)\)$/
const stepLine = /^\d+\.\s+(.*)$/
// A note may open with one of these words; the first three paint it as a warning.
const noteLead = /^(Ojo|Importante|Cuidado|Consejo|Nota|Ejemplo):\s*(.*)$/i
const warningLead = /^(ojo|importante|cuidado)$/i

export function parseDocBlocks(content: string): DocBlock[] {
  const blocks: DocBlock[] = []
  let list: { kind: 'steps' | 'bullets'; items: string[] } | null = null
  const addItem = (kind: 'steps' | 'bullets', item: string) => {
    if (list?.kind !== kind) { list = { kind, items: [] }; blocks.push(list) }
    list.items.push(item)
  }
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    const step = line.match(stepLine)
    if (step) { addItem('steps', step[1]); continue }
    if (line.startsWith('- ')) { addItem('bullets', line.slice(2)); continue }
    list = null
    if (!line) continue
    const image = line.match(imageLine)
    if (image) blocks.push({ kind: 'image', alt: image[1], src: image[2] })
    else if (line.startsWith('# ')) blocks.push({ kind: 'title', text: line.slice(2) })
    else if (line.startsWith('## ')) blocks.push({ kind: 'heading', text: line.slice(3) })
    else if (line.startsWith('> ')) {
      const lead = line.slice(2).match(noteLead)
      blocks.push(lead
        ? { kind: 'note', tone: warningLead.test(lead[1]) ? 'warning' : 'tip', lead: lead[1], text: lead[2] }
        : { kind: 'note', tone: 'tip', text: line.slice(2) })
    } else blocks.push({ kind: 'paragraph', text: line })
  }
  return blocks
}

export function parseInline(text: string): DocInline[] {
  return text.split(/(\*\*[^*]+\*\*|«[^»]+»)/).filter(Boolean).map((part): DocInline =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? { kind: 'strong', text: part.slice(2, -2) }
      : part.startsWith('«') && part.endsWith('»') ? { kind: 'ui', text: part.slice(1, -1) }
        : { kind: 'text', text: part })
}
