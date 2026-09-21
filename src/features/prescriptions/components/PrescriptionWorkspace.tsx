'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'
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
    return (
      <div className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">
        Primero registra un cliente accesible desde la sección Clientes.
      </div>
    )
  }

  const fieldClass =
    'mt-1 w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 font-display text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:bg-white focus:ring-4 focus:ring-[#E2F4F1]'

  return (
    <div className="space-y-[18px]">
      <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-medium text-[#4A5B58]">
            Cliente
            <FormSelect className="mt-1" ariaLabel="Cliente" value={String(customerId)} onValueChange={(value) => { setCustomerId(Number(value)); setMode('new'); setMessage(null) }} options={customers.map((option) => ({ value: String(option.id), label: `${option.full_name} · ${option.customer_phones[0]?.phone_number ?? 'sin teléfono'}` }))} />
          </label>
          <label className="text-xs font-medium text-[#4A5B58]">
            Receta existente
            <FormSelect className="mt-1" ariaLabel="Receta existente" value={String(selectedPrescriptionId ?? '')} disabled={!records.length} onValueChange={(value) => { setSelectedPrescriptionId(Number(value)); setMode('revision') }} options={!records.length ? [{ value: '', label: 'Sin recetas previas' }] : records.map((record) => ({ value: String(record.id), label: `Receta #${record.id} · ${record.prescription_revisions.length} revisión(es)` }))} />
          </label>
        </div>
      </section>

      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <form key={`${customerId}:${mode}:${selectedPrescriptionId ?? 'new'}`} onSubmit={saveRevision} className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)]" noValidate>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#07322F]">{mode === 'new' ? 'Nueva receta' : 'Nueva revisión inmutable'}</h2>
              <p className="mt-1 text-[13px] text-[#74857F]">El original se preserva; cada corrección registra autor y fecha.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode('new')} className={`rounded-[7px] px-3 py-2 text-xs font-semibold ${mode === 'new' ? 'bg-[#0D7A72] text-white' : 'border border-[#DCECEA] text-[#4A5B58]'}`}>Nueva receta</button>
              <button type="button" disabled={!records.length} onClick={() => setMode('revision')} className={`rounded-[7px] px-3 py-2 text-xs font-semibold disabled:opacity-40 ${mode === 'revision' ? 'bg-[#0D7A72] text-white' : 'border border-[#DCECEA] text-[#4A5B58]'}`}>Corregir</button>
            </div>
          </div>

          {!scope?.canWrite ? <p className="mt-4 rounded-lg bg-[#FFF4E8] px-4 py-3 text-sm text-[#A35A15]">La organización está en modo de solo lectura.</p> : null}
          {mode === 'revision' ? <label className="mt-4 block text-xs font-medium text-[#4A5B58]">Motivo de la corrección<input className={fieldClass} name="changeReason" required maxLength={300} /></label> : null}

          <div className="mt-5 space-y-5"><PrescriptionFormFields fieldClass={fieldClass} /></div>
          <button disabled={saving || !scope?.canWrite} className="mt-5 rounded-[7px] bg-[#0D7A72] px-4 py-2.5 font-display text-sm font-semibold text-white hover:bg-[#07322F] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Guardando…' : mode === 'new' ? 'Guardar receta' : 'Guardar nueva revisión'}</button>
          {message ? <p role="status" className="mt-4 rounded-lg border border-[#DCECEA] px-4 py-3 text-sm text-[#4A5B58]">{message}</p> : null}
        </form>

        <aside className="space-y-3">
          <h2 className="font-display text-[15px] font-semibold text-[#07322F]">Historial preservado</h2>
          {loading ? <p className="text-sm text-[#74857F]">Cargando…</p> : null}
          {!loading && !records.length ? <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-5 text-sm text-[#74857F]">Este cliente aún no tiene recetas.</p> : null}
          {records.map((record) => (
            <article key={record.id} className="rounded-[10px] border border-[#E3EFED] bg-white p-4">
              <h3 className="font-display text-sm font-semibold text-[#07322F]">Receta #{record.id}</h3>
              <div className="mt-3 space-y-3">
                {record.prescription_revisions.map((revision) => (
                  <div key={revision.id} className="border-l-2 border-[#35C2A8] pl-3">
                    <div className="flex justify-between gap-2"><p className="text-sm font-semibold text-[#07322F]">Revisión {revision.revision_number}</p><time className="text-xs text-[#74857F]">{revision.prescription_date}</time></div>
                    <p className="mt-1 font-display text-xs text-[#4A5B58]">OD {formatOptical(revision.right_sphere)} / {formatOptical(revision.right_cylinder)} · OI {formatOptical(revision.left_sphere)} / {formatOptical(revision.left_cylinder)}</p>
                    {revision.change_reason ? <p className="mt-1 text-xs text-[#A35A15]">{revision.change_reason}</p> : null}
                    {revision.prescription_files.map((file) => <button key={file.id} type="button" onClick={() => void downloadFile(file)} className="mt-2 block text-left text-xs font-semibold text-[#0D7A72]">↓ {file.file_name}</button>)}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </aside>
      </div>
    </div>
  )
}
