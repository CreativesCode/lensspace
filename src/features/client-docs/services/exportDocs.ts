import type { GeneratedClientDocs } from '../generators/types'

export function docsToMarkdown(docs: GeneratedClientDocs) {
  const header = `# ${docs.title}\n\n${docs.subtitle}\n\nGenerado: ${new Date(docs.generatedAt).toLocaleString('es-CU')}\n`
  return `${header}${docs.sections.map((section) => `\n\n---\n\n${section.content.trim()}`).join('')}\n`
}

export function downloadTextFile(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
