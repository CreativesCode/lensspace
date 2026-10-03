'use client'

import { ArrowLeft, Download, FileText, RotateCcw, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormSelect } from '@/shared/components'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Button, ButtonLink, Card, Field, PageContainer, PageHeader, SegmentedControl, Toast } from '@/shared/ui'
import { formatBusinessDate } from '@/shared/utils/dates'
import { generateClientDocs } from '../generators/generateClientDocs'
import type { ClientDocsInput, ManualAudience } from '../generators/types'
import { docsToMarkdown, downloadTextFile } from '../services/exportDocs'
import { DocsPreview } from './DocsPreview'
import { DocsSectionNav } from './DocsSectionNav'
import { ManualEditor } from './editor/ManualEditor'

const safeName = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// QA-64: superadmin-only editor. 'Guardar manual' publishes the content every role
// reads (RLS allows writes only to the platform admin); the PDF prints the saved text.
export function ClientDocsGenerator({ initialInput, savedAt }: { initialInput: ClientDocsInput; savedAt: string | null }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [saved, setSaved] = useState(initialInput)
  const [input, setInput] = useState<ClientDocsInput>(initialInput)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [pending, startTransition] = useTransition()
  const dirty = input !== saved
  const [audience, setAudience] = useState<ManualAudience>('worker')
  const [selectedId, setSelectedId] = useState('overview')
  const docs = useMemo(() => generateClientDocs(input, audience), [input, audience])
  const selected = docs.sections.find((section) => section.id === selectedId) ?? docs.sections[0]
  const setVariant = (value: ManualAudience) => { setAudience(value); setSelectedId('overview') }
  const markdown = () => downloadTextFile(`manual-${audience}-es-${safeName(input.appName)}.md`, docsToMarkdown(docs))
  const pdf = () => window.open(`/manual/print?audience=${audience}`, '_blank', 'noopener,noreferrer')
  const save = () => startTransition(async () => {
    const { error: saveError } = await supabase.from('manual_documents').upsert({ key: 'main', content: input } as never)
    if (saveError) return setError(friendlyError(saveError, 'No pudimos guardar el manual.'))
    setError(''); setSaved(input); setToast('Manual publicado: todos los roles ya ven esta versión.'); router.refresh()
  })
  return <div className="min-h-screen bg-canvas">
    <PageContainer>
      <PageHeader
        eyebrow="Centro de documentación"
        title="Manual de LensSpace"
        description={`Solo tú editas el manual; el resto de roles lo lee y descarga en PDF. ${savedAt ? `Última publicación: ${formatBusinessDate(savedAt)}.` : 'Aún no se ha publicado: todos ven el contenido inicial.'}`}
        actions={<>
          <ButtonLink href="/dashboard" variant="inverse" icon={ArrowLeft}>Volver al panel</ButtonLink>
          <Button variant="inverse" icon={RotateCcw} disabled={!dirty || pending} onClick={() => { setInput(saved); setSelectedId('overview') }}>Descartar cambios</Button>
          <Button variant="inverse" icon={FileText} onClick={markdown}>Markdown</Button>
          <Button variant="inverse" icon={Download} onClick={pdf} title={dirty ? 'El PDF usa la versión publicada; guarda para incluir tus cambios.' : undefined}>Descargar PDF</Button>
          <Button variant="mint" icon={Save} disabled={(!dirty && savedAt !== null) || pending} onClick={save}>{pending ? 'Guardando…' : 'Guardar manual'}</Button>
        </>}
      />
      {error ? <Alert tone="danger" role="alert" className="mb-4">{error}</Alert> : null}
      {dirty ? <Alert tone="warning" className="mb-4">Tienes cambios sin publicar. Los demás roles siguen viendo la versión guardada.</Alert> : null}
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
    <Toast message={toast} onDismiss={() => setToast('')} />
  </div>
}
