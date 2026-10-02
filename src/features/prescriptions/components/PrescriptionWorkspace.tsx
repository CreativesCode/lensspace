'use client'

import { Download, FileText, Save, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'
import { Alert, Button, ButtonLink, Card, EmptyState, Field, Input } from '@/shared/ui'
import { friendlyPrescriptionError, prescriptionAttachmentError, prescriptionFileExtension, prescriptionRevisionValues, validatePrescriptionForm } from '../prescription-validation'
import { PrescriptionFormFields } from './PrescriptionFormFields'

type AccessScope = {
  organizationId: number
  branchId: number
  canWrite: boolean
}

type CustomerOption = Pick<
  Tables<'customers'>,
  'id' | 'organization_id' | 'branch_id' | 'full_name'
> & {
  customer_phones: Pick<Tables<'customer_phones'>, 'phone_number'>[]
}

type PrescriptionFile = Pick<
  Tables<'prescription_files'>,
  'id' | 'revision_id' | 'file_name' | 'storage_path' | 'mime_type' | 'byte_size'
>

type PrescriptionRevision = Tables<'prescription_revisions'> & {
  prescription_files: PrescriptionFile[]
}

type PrescriptionRecord = Pick<
  Tables<'prescriptions'>,
  'id' | 'organization_id' | 'branch_id' | 'customer_id' | 'created_at'
> & { prescription_revisions: PrescriptionRevision[] }

type RevisionResult = {
  prescriptionId: number
  revisionId: number
  revisionNumber: number
}

function formatOptical(value: number | null) {
  if (value === null) return '—'
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
}

export function PrescriptionWorkspace({
  scopes,
  customers,
}: {
  scopes: AccessScope[]
  customers: CustomerOption[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? 0)
  const [records, setRecords] = useState<PrescriptionRecord[]>([])
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<number | null>(null)
  const [mode, setMode] = useState<'new' | 'revision'>('new')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const customer = customers.find(({ id }) => id === customerId)
  const scope = customer
    ? scopes.find(
        ({ organizationId, branchId }) =>
          organizationId === customer.organization_id && branchId === customer.branch_id,
      )
    : undefined

  async function loadPrescriptions(targetCustomerId: number) {
    if (!targetCustomerId) {
      setRecords([])
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('prescriptions')
      .select(
        'id, organization_id, branch_id, customer_id, created_at, prescription_revisions(*, prescription_files(id, revision_id, file_name, storage_path, mime_type, byte_size))',
      )
      .eq('customer_id', targetCustomerId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('No se pudo cargar el historial de recetas.')
      setRecords([])
    } else {
      const nextRecords = (data ?? []) as PrescriptionRecord[]
      nextRecords.forEach((record) =>
        record.prescription_revisions.sort(
          (left, right) => right.revision_number - left.revision_number,
        ),
      )
      setRecords(nextRecords)
      setSelectedPrescriptionId(nextRecords[0]?.id ?? null)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!customerId) return
    const timer = window.setTimeout(() => void loadPrescriptions(customerId), 0)
    return () => window.clearTimeout(timer)
    // The selected customer is the only trigger; the Supabase client is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  async function saveRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!customer || !scope?.canWrite) {
      setMessage('La organización está en modo de solo lectura.')
      return
    }
    if (mode === 'revision' && !selectedPrescriptionId) {
      setMessage('Selecciona una receta para registrar la corrección.')
      return
    }

    setSaving(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const validationError = validatePrescriptionForm(form)
    if (validationError) {
      setMessage(validationError)
      setSaving(false)
      return
    }
    const attachment = form.get('attachment')
    const attachmentError = prescriptionAttachmentError(attachment)
    if (attachmentError) {
      setMessage(attachmentError)
      setSaving(false)
      return
    }

    const { data, error } = await supabase.rpc('create_prescription_revision', {
      target_organization_id: customer.organization_id,
      target_branch_id: customer.branch_id,
      target_customer_id: customer.id,
      target_prescription_id: mode === 'revision' ? selectedPrescriptionId : null,
      ...prescriptionRevisionValues(form),
      revision_change_reason: String(form.get('changeReason') ?? ''),
    } as never)

    if (error) {
      setMessage(friendlyPrescriptionError(error.message))
      setSaving(false)
      return
    }

    const revision = data as unknown as RevisionResult
    let attachmentFailed = false
    if (attachment instanceof File && attachment.size) {
      const path = `${customer.organization_id}/${customer.branch_id}/${revision.prescriptionId}/${revision.revisionId}/${crypto.randomUUID()}.${prescriptionFileExtension(attachment)}`
      const { error: uploadError } = await supabase.storage
        .from('prescription-originals')
        .upload(path, attachment, { contentType: attachment.type, upsert: false })

      if (uploadError) {
        attachmentFailed = true
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        const { error: metadataError } = await supabase.from('prescription_files').insert({
          organization_id: customer.organization_id,
          branch_id: customer.branch_id,
          prescription_id: revision.prescriptionId,
          revision_id: revision.revisionId,
          storage_path: path,
          file_name: attachment.name,
          mime_type: attachment.type,
          byte_size: attachment.size,
          uploaded_by: user!.id,
        } as never)
        if (metadataError) {
          attachmentFailed = true
          await supabase.storage.from('prescription-originals').remove([path])
        }
      }
    }

    event.currentTarget.reset()
    setSelectedPrescriptionId(revision.prescriptionId)
    setMode('revision')
    await loadPrescriptions(customer.id)
    setMessage(
      attachmentFailed
        ? `Revisión ${revision.revisionNumber} guardada, pero el adjunto no pudo almacenarse.`
        : `Revisión ${revision.revisionNumber} guardada correctamente.`,
    )
    setSaving(false)
  }

  async function downloadFile(file: PrescriptionFile) {
    setMessage(null)
    const { data, error } = await supabase.storage
      .from('prescription-originals')
      .download(file.storage_path)
    if (error) {
      setMessage('No se pudo descargar el archivo privado.')
      return
    }
    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.file_name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (!customers.length) {
    return <EmptyState icon={Users} title="Sin clientes todavía" description="Primero registra un cliente accesible desde la sección Clientes." action={<ButtonLink href="/customers" icon={UserPlus}>Ir a Clientes</ButtonLink>} />
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="grid gap-[18px] md:grid-cols-2">
          <Field label="Cliente">
            <FormSelect ariaLabel="Cliente" value={String(customerId)} onValueChange={(value) => { setCustomerId(Number(value)); setMode('new'); setMessage(null) }} options={customers.map((option) => ({ value: String(option.id), label: `${option.full_name} · ${option.customer_phones[0]?.phone_number ?? 'sin teléfono'}` }))} />
          </Field>
          <Field label="Receta existente">
            <FormSelect ariaLabel="Receta existente" value={String(selectedPrescriptionId ?? '')} disabled={!records.length} onValueChange={(value) => { setSelectedPrescriptionId(Number(value)); setMode('revision') }} options={!records.length ? [{ value: '', label: 'Sin recetas previas' }] : records.map((record) => ({ value: String(record.id), label: `Receta #${record.id} · ${record.prescription_revisions.length} revisión(es)` }))} />
          </Field>
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form key={`${customerId}:${mode}:${selectedPrescriptionId ?? 'new'}`} onSubmit={saveRevision} noValidate>
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[17px] font-semibold text-ink">{mode === 'new' ? 'Nueva receta' : 'Nueva revisión inmutable'}</h2>
                <p className="mt-1 text-[13px] text-text-muted">El original se preserva; cada corrección registra autor y fecha.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={mode === 'new' ? 'primary' : 'secondary'} aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Nueva receta</Button>
                <Button size="sm" variant={mode === 'revision' ? 'primary' : 'secondary'} aria-pressed={mode === 'revision'} disabled={!records.length} onClick={() => setMode('revision')}>Corregir</Button>
              </div>
            </div>

            {!scope?.canWrite ? <Alert tone="warning">La organización está en modo de solo lectura.</Alert> : null}
            {mode === 'revision' ? <Field label="Motivo de la corrección"><Input name="changeReason" required maxLength={300} /></Field> : null}

            <PrescriptionFormFields />
            {message ? <Alert tone="info">{message}</Alert> : null}
            <div>
              <Button type="submit" icon={Save} disabled={saving || !scope?.canWrite} className="w-full sm:w-auto">{saving ? 'Guardando…' : mode === 'new' ? 'Guardar receta' : 'Guardar nueva revisión'}</Button>
            </div>
          </Card>
        </form>

        <aside className="flex flex-col gap-3 xl:sticky xl:top-6">
          <h2 className="font-display text-[17px] font-semibold text-ink">Historial preservado</h2>
          {loading ? <p className="text-sm text-text-muted">Cargando…</p> : null}
          {!loading && !records.length ? <EmptyState icon={FileText} title="Sin recetas" description="Este cliente aún no tiene recetas." /> : null}
          {records.map((record) => (
            <Card key={record.id} padded={false} className="p-4">
              <h3 className="font-display text-[15px] font-semibold text-ink">Receta #{record.id}</h3>
              <div className="mt-3 flex flex-col gap-3">
                {record.prescription_revisions.map((revision) => (
                  <div key={revision.id} className="border-l-2 border-mint pl-3">
                    <div className="flex justify-between gap-2"><p className="text-sm font-semibold text-ink">Revisión {revision.revision_number}</p><time className="text-[13px] text-text-muted">{revision.prescription_date}</time></div>
                    <p className="mt-1 font-display text-[13px] tabular-nums text-[#4A5B58]">OD {formatOptical(revision.right_sphere)} / {formatOptical(revision.right_cylinder)} · OI {formatOptical(revision.left_sphere)} / {formatOptical(revision.left_cylinder)}</p>
                    {revision.change_reason ? <p className="mt-1 text-[13px] text-amber-ink">{revision.change_reason}</p> : null}
                    {revision.prescription_files.map((file) => <Button key={file.id} variant="ghost" size="sm" icon={Download} onClick={() => void downloadFile(file)} className="-ml-3 mt-1">{file.file_name}</Button>)}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </aside>
      </div>
    </div>
  )
}
