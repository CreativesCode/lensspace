'use client'

import { Download, FileText, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { FormSelect } from '@/shared/components'
import { Button, Card, Field, PageContainer, PageHeader, SegmentedControl } from '@/shared/ui'
import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience } from '../generators/types'
import { clientDocsInput } from '../schemas/clientDocsInput'
import { docsToMarkdown, downloadTextFile } from '../services/exportDocs'
import { DocsPreview } from './DocsPreview'
import { DocsSectionNav } from './DocsSectionNav'
import { ManualEditor } from './editor/ManualEditor'

const storageKey = 'lensspace-manual-generator-input'
const safeName = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function ClientDocsGenerator() {
  const [input, setInput] = useState<ClientDocsInput>(clientDocsInput)
  const [audience, setAudience] = useState<ManualAudience>('worker')
  const [selectedId, setSelectedId] = useState('overview')
  const docs = useMemo(() => generateClientDocs(input, audience), [input, audience])
  const selected = docs.sections.find((section) => section.id === selectedId) ?? docs.sections[0]
  const setVariant = (value: ManualAudience) => { setAudience(value); setSelectedId('overview') }
  const markdown = () => downloadTextFile(`manual-${audience}-es-${safeName(input.appName)}.md`, docsToMarkdown(docs))
  const pdf = () => { try { localStorage.setItem(storageKey, JSON.stringify({ input, audience })) } catch { /* defaults remain available */ } window.open(`/manual/print?audience=${audience}`, '_blank', 'noopener,noreferrer') }
  return <div className="min-h-screen bg-canvas">
    <PageContainer>
      <PageHeader
        eyebrow="Centro de documentación"
        title="Manual de LensSpace"
        description="Edita el contenido, revisa cada sección y exporta una guía operativa o administrativa en Markdown o PDF."
        actions={<>
          <Button variant="inverse" icon={RotateCcw} onClick={() => { setInput(clientDocsInput); setSelectedId('overview') }}>Restablecer</Button>
          <Button variant="inverse" icon={FileText} onClick={markdown}>Markdown</Button>
          <Button variant="mint" icon={Download} onClick={pdf}>Descargar PDF</Button>
        </>}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[360px_210px_minmax(0,1fr)]">
        <Card padded={false} className="flex flex-col overflow-hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)]">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-display text-[15px] font-semibold text-ink">Editor del contenido</h2>
            <p className="mt-0.5 text-[13px] text-text-muted">Los cambios se reflejan inmediatamente.</p>
          </div>
          <ManualEditor input={input} onChange={setInput} />
        </Card>
        <Card padded={false} className="hidden p-2 lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
          <DocsSectionNav sections={docs.sections} selectedSectionId={selected.id} onSelectSection={setSelectedId} />
        </Card>
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">{docs.subtitle}</p>
                <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">{docs.title}</h2>
              </div>
              <SegmentedControl<ManualAudience> label="Audiencia" value={audience} onChange={setVariant} options={[{ value: 'worker', label: 'Personal operativo' }, { value: 'admin', label: 'Administración' }]} />
            </div>
            <Field label="Sección" className="lg:hidden"><FormSelect ariaLabel="Sección" value={selected.id} onValueChange={setSelectedId} options={docs.sections.map((section) => ({ value: section.id, label: section.title }))} /></Field>
          </Card>
          <DocsPreview section={selected} />
        </div>
      </div>
    </PageContainer>
  </div>
}
