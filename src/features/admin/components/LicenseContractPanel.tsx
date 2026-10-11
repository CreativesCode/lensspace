'use client'

import { Ban, Download, FileSignature, FileText, Gift, Pencil, Plus, Upload } from 'lucide-react'
import { useMemo, useRef, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Badge, Button, ButtonLink, CardHeader, Field, Textarea } from '@/shared/ui'
import { formatBusinessDate } from '@/shared/utils/dates'
import { newRequestId } from '@/shared/utils/request-id'

import { billingPeriodLabels, formatUsd, type LicenseBillingPeriod, type LicensePlan, planLabels } from '../license-pricing'
import { LicenseContractForm } from './LicenseContractForm'

type Contract = Tables<'license_contracts'>
type Props = {
  organization: { id: number; name: string; owners: { display_name: string }[]; modules: { module_key: string; is_enabled: boolean }[]; contracts: Contract[]; referrals: Contract[] }
  organizationNames: { id: number; name: string }[]
  onChanged: (message: string) => void
}

const statusLabels: Record<string, string> = { draft: 'Borrador', signed: 'Firmado', superseded: 'Reemplazado', cancelled: 'Anulado' }
const statusTones = { draft: 'progress', signed: 'success', superseded: 'neutral', cancelled: 'danger' } as const
const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const showDate = (isoDate: string) => formatBusinessDate(`${isoDate}T12:00:00`)

export function LicenseContractPanel({ organization, organizationNames, onChanged }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [editing, setEditing] = useState<Contract | 'new' | null>(null)
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [pending, startTransition] = useTransition()
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<Contract | null>(null)
  const nameOf = (id: number | null) => organizationNames.find((entry) => entry.id === id)?.name ?? '—'
  const visible = organization.contracts.filter(({ status }) => status === 'draft' || status === 'signed')
  const history = organization.contracts.filter(({ status }) => status === 'superseded' || status === 'cancelled')

  function run(action: () => Promise<string | null>, success: string) {
    startTransition(async () => {
      setError('')
      const failure = await action()
      if (failure) return setError(failure)
      onChanged(success)
    })
  }

  function chooseFile(contract: Contract) {
    uploadTarget.current = contract
    fileInput.current?.click()
  }

  function uploadSigned(file: File | undefined) {
    const contract = uploadTarget.current
    if (fileInput.current) fileInput.current.value = ''
    if (!file || !contract) return
    if (!allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) return setError('Sube un PDF o una foto (JPG, PNG o WEBP) de 10 MB como máximo.')
    run(async () => {
      const extension = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]
      const path = `${organization.id}/${contract.id}/${newRequestId()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('license-contracts').upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) return 'No pudimos subir el archivo. Inténtalo de nuevo.'
      const { error: signError } = await supabase.rpc('sign_license_contract', { target_contract_id: contract.id, signed_path: path } as never)
      if (!signError) return null
      await supabase.storage.from('license-contracts').remove([path])
      return friendlyError(signError, 'No pudimos registrar el contrato firmado.')
    }, 'Contrato firmado registrado. El importe de la suscripción quedó actualizado.')
  }

  // The tab opens synchronously (popup blockers) and receives the short-lived URL.
  function openSigned(path: string) {
    const tab = window.open('', '_blank')
    startTransition(async () => {
      const { data, error: urlError } = await supabase.storage.from('license-contracts').createSignedUrl(path, 120)
      if (urlError || !data) { tab?.close(); return setError('No pudimos abrir el contrato firmado.') }
      if (tab) tab.location.href = data.signedUrl
      else window.location.assign(data.signedUrl)
    })
  }

  function cancel(contract: Contract) {
    run(async () => {
      const { error: cancelError } = await supabase.rpc('cancel_license_contract', { target_contract_id: contract.id, cancel_reason: cancelReason } as never)
      if (cancelError) return friendlyError(cancelError, 'No pudimos anular el contrato.')
      setCancelling(null)
      setCancelReason('')
      return null
    }, contract.status === 'draft' ? 'Borrador descartado.' : 'Contrato anulado.')
  }

  function applyCredit(contract: Contract) {
    run(async () => {
      const { data, error: creditError } = await supabase.rpc('apply_referral_credit', { target_contract_id: contract.id } as never)
      if (creditError) return friendlyError(creditError, 'No pudimos aplicar el crédito.')
      const result = data as { days: number; expiresOn: string } | null
      return result ? null : 'No pudimos aplicar el crédito.'
    }, 'Crédito aplicado: el vencimiento de esta óptica se extendió.')
  }

  if (editing) {
    return <div className="flex flex-col gap-4">
      <CardHeader title={editing === 'new' ? 'Preparar contrato' : 'Editar borrador'} />
      <LicenseContractForm
        organizationId={organization.id}
        draft={editing === 'new' ? undefined : editing}
        defaults={{ legalName: organization.name, representative: organization.owners[0]?.display_name ?? '', modules: organization.modules.filter(({ is_enabled }) => is_enabled).map(({ module_key }) => module_key) }}
        referrerOptions={organizationNames.filter(({ id }) => id !== organization.id)}
        onSaved={(message) => { setEditing(null); onChanged(message) }}
        onCancel={() => setEditing(null)}
      />
    </div>
  }

  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <CardHeader title="Contrato de licencia" />
      <Button size="sm" variant="secondary" icon={Plus} onClick={() => setEditing('new')} disabled={pending}>Preparar contrato</Button>
    </div>
    <input ref={fileInput} type="file" accept={allowedTypes.join(',')} className="hidden" onChange={(event) => uploadSigned(event.target.files?.[0])} />

    {!visible.length ? <p className="text-sm text-text-muted">Sin contrato registrado. Prepara uno, descarga la proforma y sube la copia firmada.</p> : null}
    {visible.map((contract) => <div key={contract.id} className="flex flex-col gap-3 rounded-card border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-[15px] font-semibold text-ink">{planLabels[contract.plan as LicensePlan]} · {formatUsd(contract.monthly_amount, contract.currency)} al mes</span>
        <Badge tone={statusTones[contract.status as keyof typeof statusTones]}>{statusLabels[contract.status]}</Badge>
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div><dt className="inline text-text-muted">Cobro: </dt><dd className="inline tabular-nums">{formatUsd(contract.period_amount, contract.currency)} · {billingPeriodLabels[contract.billing_period as LicenseBillingPeriod]}</dd></div>
        <div><dt className="inline text-text-muted">Vigencia: </dt><dd className="inline tabular-nums">{showDate(contract.starts_on)} – {showDate(contract.ends_on)}</dd></div>
        {contract.price_locked_until ? <div className="sm:col-span-2"><dt className="inline text-text-muted">Precio fundador fijo hasta: </dt><dd className="inline tabular-nums">{showDate(contract.price_locked_until)}, después {formatUsd(contract.post_lock_monthly_amount ?? 0, contract.currency)} al mes</dd></div> : null}
        {contract.referred_by_organization_id ? <div className="sm:col-span-2"><dt className="inline text-text-muted">Referida por: </dt><dd className="inline">{nameOf(contract.referred_by_organization_id)}</dd></div> : null}
      </dl>
      <div className="flex flex-wrap gap-2">
        <ButtonLink size="sm" variant="secondary" icon={Download} href={`/contracts/${contract.id}/print`} target="_blank">Descargar proforma</ButtonLink>
        {contract.status === 'draft' ? <>
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(contract)} disabled={pending}>Editar</Button>
          <Button size="sm" variant="ink" icon={Upload} onClick={() => chooseFile(contract)} disabled={pending}>Subir contrato firmado</Button>
        </> : null}
        {contract.signed_file_path ? <Button size="sm" variant="ghost" icon={FileSignature} onClick={() => openSigned(contract.signed_file_path!)} disabled={pending}>Ver firmado</Button> : null}
        <Button size="sm" variant="danger" icon={Ban} onClick={() => { setCancelling(contract.id); setCancelReason('') }} disabled={pending}>{contract.status === 'draft' ? 'Descartar' : 'Anular'}</Button>
      </div>
      {cancelling === contract.id ? <div className="flex flex-col gap-2">
        <Field label={contract.status === 'draft' ? 'Motivo para descartar el borrador' : 'Motivo para anular el contrato'} help="Queda registrado en la auditoría."><Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} minLength={10} maxLength={500} rows={2} /></Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setCancelling(null)} disabled={pending}>Volver</Button>
          <Button size="sm" variant="danger" onClick={() => cancel(contract)} disabled={pending || cancelReason.trim().length < 10}>Confirmar</Button>
        </div>
      </div> : null}
    </div>)}

    {organization.referrals.length ? <>
      <CardHeader title="Ópticas referidas" />
      {organization.referrals.map((contract) => <div key={contract.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span><span className="font-semibold text-ink">{nameOf(contract.organization_id)}</span> <span className="text-text-muted">· {statusLabels[contract.status]}</span></span>
        {contract.referral_credit_applied_on
          ? <Badge tone="success">+{contract.referral_credit_days} días el {showDate(contract.referral_credit_applied_on)}</Badge>
          : contract.status === 'signed' || contract.status === 'superseded'
            ? <Button size="sm" variant="secondary" icon={Gift} onClick={() => applyCredit(contract)} disabled={pending}>Aplicar crédito</Button>
            : <span className="text-text-muted">Pendiente de firma</span>}
      </div>)}
      <p className="text-[12px] text-text-muted">El crédito se aplica cuando la óptica referida pagó su primer periodo: 15 días si esta óptica tiene vigente el precio de socio fundador, 10 días en los demás casos.</p>
    </> : null}

    {history.length ? <details className="text-sm">
      <summary className="cursor-pointer text-text-muted">Contratos anteriores ({history.length})</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {history.map((contract) => <li key={contract.id} className="flex flex-wrap items-center gap-2">
          <FileText aria-hidden="true" size={14} className="text-text-muted" />
          {planLabels[contract.plan as LicensePlan]} · {formatUsd(contract.monthly_amount, contract.currency)} · {showDate(contract.starts_on)} · {statusLabels[contract.status]}
          {contract.signed_file_path ? <button type="button" className="font-semibold text-action" onClick={() => openSigned(contract.signed_file_path!)}>Ver firmado</button> : null}
        </li>)}
      </ul>
    </details> : null}

    {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
  </div>
}
