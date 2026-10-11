'use client'

import { BadgeDollarSign } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Button, Field, Textarea } from '@/shared/ui'
import { formatBusinessDate, todayIn } from '@/shared/utils/dates'

import { addMonthsIso, billingPeriodLabels, formatUsd, type LicenseBillingPeriod, nextPaymentPreview, SUBSCRIPTION_GRACE_DAYS } from '../license-pricing'

type Subscription = { status: string; amount: number; currency: string; billing_period: string; expires_on: string }
type Props = { organizationId: number; subscription?: Subscription; signedContract?: Tables<'license_contracts'>; onChanged: (message: string) => void }

const showDate = (isoDate: string) => formatBusinessDate(`${isoDate}T12:00:00`)
type NoticeRow = { kind: string; status: string; createdAt: string; failureCode: string | null }
const noticeLabels: Record<string, string> = {
  owner_reminder: 'Recordatorio al dueño', owner_due: 'Vence hoy (dueño)', owner_grace: 'Margen de pago (dueño)',
  owner_blocked: 'Bloqueo (dueño)', admin_due: 'Vence hoy (a ti)', admin_blocked: 'Bloqueo (a ti)',
}

// The free trial is granted only at onboarding; afterwards the organization pays or
// leaves. Paid periods are charged from the signed contract (product owner, 2026-10-11).
export function SubscriptionActions({ organizationId, subscription, signedContract, onChanged }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [notices, setNotices] = useState<NoticeRow[]>([])
  const today = todayIn()
  useEffect(() => {
    let cancelled = false
    supabase.rpc('list_subscription_notices', { target_organization_id: organizationId } as never)
      .then(({ data }) => { if (!cancelled) setNotices((data ?? []) as unknown as NoticeRow[]) })
    return () => { cancelled = true }
  }, [organizationId, supabase])
  if (!subscription) return null

  const expired = subscription.expires_on < today
  const graceEndsOn = addMonthsIso(subscription.expires_on, 0, false, SUBSCRIPTION_GRACE_DAYS)
  const inGrace = expired && graceEndsOn >= today && (subscription.status === 'trial' || subscription.status === 'active')
  const paidRunning = subscription.status === 'active' && !expired
  const preview = signedContract ? nextPaymentPreview(signedContract, subscription, today) : null
  const graceDaysCharged = preview && preview.coveredFrom < today ? Math.round((Date.parse(today) - Date.parse(preview.coveredFrom)) / 86_400_000) : 0
  const summary = subscription.status === 'suspended' ? 'Suspendida: la óptica no puede operar.'
    : subscription.status === 'pending' ? 'En preparación: la óptica no opera hasta que firmes el contrato y registres el primer pago, que empieza a contar ese día.'
    : inGrace ? `${subscription.status === 'trial' ? 'La prueba' : 'El periodo pagado'} venció el ${showDate(subscription.expires_on)}. Está en margen de pago: si no paga, se bloquea el ${showDate(addMonthsIso(graceEndsOn, 0, false, 1))}.`
    : subscription.status === 'trial' && !expired ? `Prueba gratis hasta el ${showDate(subscription.expires_on)}.`
      : paidRunning ? `Pagada hasta el ${showDate(subscription.expires_on)} · ${formatUsd(subscription.amount, subscription.currency)} ${billingPeriodLabels[subscription.billing_period as LicenseBillingPeriod]?.toLowerCase() ?? ''}.`
        : `Vencida desde el ${showDate(subscription.expires_on)}: la óptica está en solo lectura hasta que registres un pago.`

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const note = String(form.get('note') ?? '').trim()
    startTransition(async () => {
      const { error: rpcError } = await supabase.rpc('record_subscription_payment', { target_organization_id: organizationId, payment_note: note || 'Pago registrado' } as never)
      if (rpcError) return setError(friendlyError(rpcError, 'No pudimos registrar el pago.'))
      setPaying(false)
      setError('')
      onChanged('Pago registrado: la suscripción está activa.')
    })
  }

  return <div className="flex flex-col gap-3 rounded-card border border-line bg-canvas p-4">
    <p className="text-sm text-ink">{summary}</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ink" icon={BadgeDollarSign} onClick={() => { setError(''); setPaying(true) }} disabled={pending || !signedContract || subscription.status === 'suspended'}>Registrar pago</Button>
    </div>
    {!signedContract ? <p className="text-[12px] text-text-muted">Para cobrar, sube primero el contrato firmado: el importe sale de él.</p> : null}
    {notices.length ? <details className="text-[13px]">
      <summary className="cursor-pointer text-text-muted">Avisos de WhatsApp enviados ({notices.length})</summary>
      <ul className="mt-2 flex flex-col gap-1">
        {notices.map((notice, index) => <li key={index} className="flex flex-wrap gap-x-2">
          <span className="text-ink">{noticeLabels[notice.kind] ?? notice.kind}</span>
          <span className="text-text-muted">{formatBusinessDate(notice.createdAt)}</span>
          <span className={notice.status === 'sent' ? 'text-action' : notice.status === 'failed' ? 'text-coral-deep' : 'text-text-muted'}>
            {notice.status === 'sent' ? 'enviado' : notice.status === 'failed' ? (notice.failureCode === 'missing_recipient' ? 'sin teléfono' : 'no confirmado') : 'en cola'}
          </span>
        </li>)}
      </ul>
    </details> : null}

    {paying ? <form onSubmit={submit} className="flex flex-col gap-3">
      {preview ? <Alert tone="info" title={`Se cobra ${formatUsd(preview.amount, signedContract?.currency)}`}>
        Cubre del {showDate(preview.coveredFrom)} al {showDate(preview.expiresOn)}. La suscripción queda activa.
        {graceDaysCharged ? ` Empieza ${graceDaysCharged} día(s) antes de hoy: son los días de margen que la óptica ya usó.` : ''}
      </Alert> : null}
      <Field label="Nota del pago" optional help="Queda registrado en la auditoría.">
        <Textarea name="note" rows={2} maxLength={500} placeholder="Efectivo, transferencia, referencia…" />
      </Field>
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setPaying(false)} disabled={pending}>Cancelar</Button>
        <Button size="sm" type="submit" variant="ink" disabled={pending}>{pending ? 'Guardando…' : 'Confirmar'}</Button>
      </div>
    </form> : null}
  </div>
}
