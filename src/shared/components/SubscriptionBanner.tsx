'use client'

import { CalendarClock, Lock, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'

export type SubscriptionNotice = {
  organizationId: number
  organizationName: string
  canOperate: boolean
  isOwner: boolean
  isPending: boolean
  subscriptionStatus: string | null
  expiresOn: string | null
  daysLeft: number | null
  graceEndsOn: string | null
  adminName: string | null
  adminPhone: string | null
}

// Owners are reminded from 2 days before the expiry until the last grace day (the
// organization keeps operating 5 days after expiry; product owner, 2026-10-11).
const WARN_DAYS = 2
// Date-only values (YYYY-MM-DD): format in UTC so Havana time never shifts the day.
const dayFormat = new Intl.DateTimeFormat('es-CU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const formatDay = (isoDay: string) => dayFormat.format(new Date(`${isoDay}T00:00:00Z`)).replace('.', '')
const dayAfter = (isoDay: string) => new Date(Date.parse(`${isoDay}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Havana' })
const dismissKey = (organizationId: number) => `lensspace:subscription-notice:${organizationId}`

// Dismissed reminders live in localStorage (per viewer, per day); the server snapshot
// is null so reminders only render on the client, without a hydration mismatch.
const listeners = new Set<() => void>()
function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => { listeners.delete(listener); window.removeEventListener('storage', listener) }
}
function readDismissed(ids: number[]) {
  const today = todayKey()
  return ids.filter((id) => { try { return window.localStorage.getItem(dismissKey(id)) === today } catch { return false } }).join(',')
}

function contact(notice: SubscriptionNotice) {
  return notice.adminPhone ? `Contacta a ${notice.adminName ?? 'LensSpace'} al ${notice.adminPhone}.` : 'Contacta a LensSpace.'
}

function blockedReason(notice: SubscriptionNotice) {
  if (!notice.isOwner) return ''
  if (notice.subscriptionStatus === 'suspended') return ': la suscripción está suspendida'
  if (notice.expiresOn && notice.daysLeft !== null && notice.daysLeft < 0) return `: la suscripción venció el ${formatDay(notice.expiresOn)}`
  return ''
}

function warningText(notice: SubscriptionNotice) {
  const what = notice.subscriptionStatus === 'trial' ? 'La prueba' : 'La suscripción'
  const days = notice.daysLeft ?? 0
  const blockedOn = notice.graceEndsOn ? formatDay(dayAfter(notice.graceEndsOn)) : ''
  if (days > 0) return `${what} de ${notice.organizationName} vence ${days === 1 ? 'mañana' : `en ${days} días`} (${formatDay(notice.expiresOn ?? '')}). Realiza el pago. ${contact(notice)}`
  if (days === 0) return `${what} de ${notice.organizationName} vence hoy. Tienes hasta el ${formatDay(notice.graceEndsOn ?? '')} para pagar; el ${blockedOn} pasará a solo lectura. ${contact(notice)}`
  return `${what} de ${notice.organizationName} venció el ${formatDay(notice.expiresOn ?? '')}. Si no pagas, el ${blockedOn} pasará a solo lectura. ${contact(notice)}`
}

// QA-40: read-only organizations are explained instead of failing on save. Payment
// reminders show once a day: closing one hides it until the next day.
export function SubscriptionBanner({ notices }: { notices: SubscriptionNotice[] }) {
  const ids = notices.map(({ organizationId }) => organizationId)
  const snapshot = useSyncExternalStore(subscribe, () => readDismissed(ids), () => null)
  const dismissed = snapshot === null ? null : snapshot.split(',').filter(Boolean).map(Number)

  function dismiss(organizationId: number) {
    try { window.localStorage.setItem(dismissKey(organizationId), todayKey()) } catch { /* storage unavailable: stays visible */ }
    listeners.forEach((listener) => listener())
  }

  const blocked = notices.filter((notice) => !notice.canOperate)
  const expiring = notices.filter((notice) => notice.canOperate && notice.isOwner && notice.daysLeft !== null && notice.daysLeft <= WARN_DAYS
    && dismissed !== null && !dismissed.includes(notice.organizationId))
  if (!blocked.length && !expiring.length) return null
  return (
    <div className="flex flex-col">
      {blocked.map((notice) => (
        <div key={`blocked-${notice.organizationId}`} role="status" className={`flex items-start justify-center gap-2 px-4 py-2.5 text-center text-[13px] font-semibold ${notice.isPending ? 'bg-amber-soft text-amber-deep' : 'bg-coral-tint text-coral-deep'}`}>
          <Lock aria-hidden="true" size={16} className="mt-px shrink-0" />
          {notice.isPending ? <span>
            {notice.organizationName} está en preparación: empezará a funcionar cuando se firme el contrato y se registre el primer pago. Mientras tanto puedes consultar, pero no registrar ventas, cobros ni cambios.{' '}
            {notice.isOwner ? contact(notice) : 'Consulta con el dueño de la óptica.'}
          </span> : <span>
            {notice.organizationName} está en solo lectura{blockedReason(notice)}. Puedes consultar, pero no registrar ventas, cobros ni cambios.{' '}
            {notice.isOwner ? `Para volver a trabajar, paga. ${contact(notice)}` : 'Consulta con el dueño de la óptica.'}
          </span>}
        </div>
      ))}
      {expiring.map((notice) => (
        <div key={`expiring-${notice.organizationId}`} role="status" className="flex items-start justify-center gap-2 bg-amber-soft px-4 py-2.5 text-center text-[13px] font-semibold text-amber-deep">
          <CalendarClock aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span>{warningText(notice)}</span>
          <button type="button" onClick={() => dismiss(notice.organizationId)} aria-label="Cerrar aviso hasta mañana" title="Cerrar hasta mañana" className="-my-1 grid size-7 shrink-0 place-items-center rounded-control hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
