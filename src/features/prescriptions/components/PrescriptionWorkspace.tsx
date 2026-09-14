'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'

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

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function optionalNumber(form: FormData, name: string) {
  const value = String(form.get(name) ?? '').trim()
  return value ? Number(value) : null
}

function formatOptical(value: number | null) {
  if (value === null) return '—'
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
}

function fileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName) return fromName
  return file.type === 'application/pdf' ? 'pdf' : 'bin'
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
    const attachment = form.get('attachment')
    if (attachment instanceof File && attachment.size) {
      if (!allowedTypes.has(attachment.type) || attachment.size > 10 * 1024 * 1024) {
        setMessage('El adjunto debe ser JPEG, PNG, WebP o PDF y no superar 10 MB.')
        setSaving(false)
        return
      }
    }

    const { data, error } = await supabase.rpc('create_prescription_revision', {
      target_organization_id: customer.organization_id,
      target_branch_id: customer.branch_id,
      target_customer_id: customer.id,
      target_prescription_id: mode === 'revision' ? selectedPrescriptionId : null,
      revision_prescription_date: String(form.get('prescriptionDate')),
      revision_prescriber_name: String(form.get('prescriberName') ?? ''),
      revision_right_sphere: optionalNumber(form, 'rightSphere'),
      revision_right_cylinder: optionalNumber(form, 'rightCylinder'),
      revision_right_axis: optionalNumber(form, 'rightAxis'),
      revision_right_addition: optionalNumber(form, 'rightAddition'),
      revision_right_prism: optionalNumber(form, 'rightPrism'),
      revision_right_prism_base: String(form.get('rightPrismBase') ?? ''),
      revision_left_sphere: optionalNumber(form, 'leftSphere'),
      revision_left_cylinder: optionalNumber(form, 'leftCylinder'),
      revision_left_axis: optionalNumber(form, 'leftAxis'),
      revision_left_addition: optionalNumber(form, 'leftAddition'),
      revision_left_prism: optionalNumber(form, 'leftPrism'),
      revision_left_prism_base: String(form.get('leftPrismBase') ?? ''),
      revision_pupillary_distance_total: optionalNumber(form, 'pupillaryDistanceTotal'),
      revision_right_pupillary_distance: optionalNumber(form, 'rightPupillaryDistance'),
      revision_left_pupillary_distance: optionalNumber(form, 'leftPupillaryDistance'),
      revision_right_height: optionalNumber(form, 'rightHeight'),
      revision_left_height: optionalNumber(form, 'leftHeight'),
      revision_notes: String(form.get('notes') ?? ''),
      revision_change_reason: String(form.get('changeReason') ?? ''),
    } as never)

    if (error) {
      setMessage(error.message || 'No se pudo guardar la receta.')
      setSaving(false)
      return
    }

    const revision = data as unknown as RevisionResult
    let attachmentFailed = false
    if (attachment instanceof File && attachment.size) {
      const path = `${customer.organization_id}/${customer.branch_id}/${revision.prescriptionId}/${revision.revisionId}/${crypto.randomUUID()}.${fileExtension(attachment)}`
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
        <form key={`${customerId}:${mode}:${selectedPrescriptionId ?? 'new'}`} onSubmit={saveRevision} className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)]">
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

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[650px] border-collapse">
              <thead><tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[#74857F]"><th className="p-2" /><th className="p-2">Esfera</th><th className="p-2">Cilindro</th><th className="p-2">Eje</th><th className="p-2">Adición</th><th className="p-2">DP</th><th className="p-2">Altura</th></tr></thead>
              <tbody>
                {(['right', 'left'] as const).map((eye) => (
                  <tr key={eye}>
                    <th className="p-2 font-display text-sm text-[#07322F]">{eye === 'right' ? 'OD' : 'OI'}</th>
                    <td className="p-2"><input aria-label={`${eye} esfera`} className={fieldClass.replace('mt-1 ', '')} name={`${eye}Sphere`} type="number" min="-40" max="40" step="0.25" /></td>
                    <td className="p-2"><input aria-label={`${eye} cilindro`} className={fieldClass.replace('mt-1 ', '')} name={`${eye}Cylinder`} type="number" min="-20" max="20" step="0.25" /></td>
                    <td className="p-2"><input aria-label={`${eye} eje`} className={fieldClass.replace('mt-1 ', '')} name={`${eye}Axis`} type="number" min="0" max="180" step="1" /></td>
                    <td className="p-2"><input aria-label={`${eye} adición`} className={fieldClass.replace('mt-1 ', '')} name={`${eye}Addition`} type="number" min="0" max="8" step="0.25" /></td>
                    <td className="p-2"><input aria-label={`${eye} distancia pupilar`} className={fieldClass.replace('mt-1 ', '')} name={`${eye}PupillaryDistance`} type="number" min="15" max="50" step="0.5" /></td>
                    <td className="p-2"><input aria-label={`${eye} altura`} className={fieldClass.replace('mt-1 ', '')} name={`${eye}Height`} type="number" min="0" max="60" step="0.5" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-medium text-[#4A5B58]">DP conjunta<input className={fieldClass} name="pupillaryDistanceTotal" type="number" min="30" max="90" step="0.5" /></label>
            {(['right', 'left'] as const).map((eye) => (
              <div key={eye} className="grid grid-cols-2 gap-2">
                <label className="text-xs font-medium text-[#4A5B58]">Prisma {eye === 'right' ? 'OD' : 'OI'}<input className={fieldClass} name={`${eye}Prism`} type="number" min="0" max="20" step="0.25" /></label>
                <label className="text-xs font-medium text-[#4A5B58]">Base<FormSelect className="mt-1" name={`${eye}PrismBase`} ariaLabel={`Base del prisma ${eye === 'right' ? 'OD' : 'OI'}`} options={[{ value: '', label: 'Sin base' }, { value: 'up', label: 'Arriba' }, { value: 'down', label: 'Abajo' }, { value: 'in', label: 'Interna' }, { value: 'out', label: 'Externa' }]} /></label>
              </div>
            ))}
            <label className="text-xs font-medium text-[#4A5B58]">Fecha de la receta<input className={fieldClass} name="prescriptionDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="text-xs font-medium text-[#4A5B58] md:col-span-2">Médico u optometrista<input className={fieldClass} name="prescriberName" minLength={2} maxLength={160} /></label>
            <label className="text-xs font-medium text-[#4A5B58] md:col-span-2 lg:col-span-3">Observaciones<textarea className={fieldClass} name="notes" rows={3} /></label>
          </div>

          <label className="mt-5 block rounded-lg border border-dashed border-[#B9DFD9] bg-[#F7FDFC] p-4 text-sm text-[#4A5B58]">
            Original privado <span className="text-xs text-[#74857F]">(opcional, máx. 10 MB)</span>
            <input className="mt-2 block w-full text-xs" name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
          </label>
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
