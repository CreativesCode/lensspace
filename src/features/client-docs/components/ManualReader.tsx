'use client'

import { ArrowLeft, ArrowRight, Download } from 'lucide-react'
import { useMemo, useState } from 'react'

import { FormSelect } from '@/shared/components'
import { Button, ButtonLink, Card, Field, PageContainer, PageHeader, SegmentedControl } from '@/shared/ui'

import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience } from '../generators/types'
import { DocsPreview } from './DocsPreview'
import { DocsSectionNav } from './DocsSectionNav'

// QA-64: read-only manual for every role, one section per page, plus PDF download.
export function ManualReader({ input, audiences }: { input: ClientDocsInput; audiences: ManualAudience[] }) {
  const [audience, setAudience] = useState<ManualAudience>(audiences[0])
  const [selectedId, setSelectedId] = useState('overview')
  const docs = useMemo(() => generateClientDocs(input, audience), [input, audience])
  const index = Math.max(0, docs.sections.findIndex((section) => section.id === selectedId))
  const selected = docs.sections[index]
  const previous = docs.sections[index - 1]
  const next = docs.sections[index + 1]
  const go = (id: string) => { setSelectedId(id); window.scrollTo({ top: 0 }) }
  const pdf = () => window.open(`/manual/print?audience=${audience}`, '_blank', 'noopener,noreferrer')

  return <div className="min-h-screen bg-canvas">
    <PageContainer>
      <PageHeader
        eyebrow="Centro de ayuda"
        title="Manual de LensSpace"
        description="Consulta cómo hacer cada tarea en el sistema o descarga el manual completo en PDF."
        actions={<>
          <ButtonLink href="/dashboard" variant="inverse" icon={ArrowLeft}>Volver al panel</ButtonLink>
          <Button variant="mint" icon={Download} onClick={pdf}>Descargar PDF</Button>
        </>}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <Card padded={false} className="hidden p-2 lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
          <DocsSectionNav sections={docs.sections} selectedSectionId={selected.id} onSelectSection={go} />
        </Card>
        <div className="flex min-w-0 flex-col gap-3">
          {audiences.length > 1 || docs.sections.length > 1 ? <Card className="flex flex-col gap-4 lg:hidden">
            {audiences.length > 1 ? <SegmentedControl<ManualAudience> label="Manual" value={audience} onChange={(value) => { setAudience(value); setSelectedId('overview') }} options={[{ value: 'worker', label: 'Operativo' }, { value: 'admin', label: 'Administración' }]} /> : null}
            <Field label="Sección"><FormSelect ariaLabel="Sección" value={selected.id} onValueChange={go} options={docs.sections.map((section) => ({ value: section.id, label: section.title }))} /></Field>
          </Card> : null}
          {audiences.length > 1 ? <div className="hidden justify-end lg:flex">
            <SegmentedControl<ManualAudience> label="Manual" value={audience} onChange={(value) => { setAudience(value); setSelectedId('overview') }} options={[{ value: 'worker', label: 'Personal operativo' }, { value: 'admin', label: 'Administración' }]} />
          </div> : null}
          <DocsPreview section={selected} />
          <div className="flex flex-wrap justify-between gap-2">
            {previous ? <Button variant="ghost" icon={ArrowLeft} onClick={() => go(previous.id)}>{previous.title}</Button> : <span />}
            {next ? <Button variant="secondary" onClick={() => go(next.id)}>{next.title} <ArrowRight aria-hidden="true" size={16} /></Button> : null}
          </div>
        </div>
      </div>
    </PageContainer>
  </div>
}
