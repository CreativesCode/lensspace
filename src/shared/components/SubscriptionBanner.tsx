import { CalendarClock, Lock } from 'lucide-react'


export type SubscriptionNotice = {
  organizationId: number
  organizationName: string
  canOperate: boolean
  isOwner: boolean
  subscriptionStatus: string | null
  expiresOn: string | null
  daysLeft: number | null
}

const WARN_DAYS = 5
// Date-only values (YYYY-MM-DD): format in UTC so Havana time never shifts the day.
const dayFormat = new Intl.DateTimeFormat('es-CU', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const formatDay = (isoDay: string) => dayFormat.format(new Date(`${isoDay}T00:00:00Z`)).replace('.', '')

function blockedReason(notice: SubscriptionNotice) {
  if (!notice.isOwner) return ''
  if (notice.expiresOn && notice.daysLeft !== null && notice.daysLeft < 0) return `: la suscripción venció el ${formatDay(notice.expiresOn)}`
  if (notice.subscriptionStatus === 'suspended') return ': la suscripción está suspendida'
  return ''
}

// QA-40: read-only organizations are explained instead of failing on save, and owners
// get a heads-up before the trial or subscription ends.
export function SubscriptionBanner({ notices }: { notices: SubscriptionNotice[] }) {
  const blocked = notices.filter((notice) => !notice.canOperate)
  const expiring = notices.filter((notice) => notice.canOperate && notice.isOwner && notice.daysLeft !== null && notice.daysLeft <= WARN_DAYS)
  if (!blocked.length && !expiring.length) return null
  return (
    <div className="flex flex-col">
      {blocked.map((notice) => (
        <div key={`blocked-${notice.organizationId}`} role="status" className="flex items-start justify-center gap-2 bg-coral-tint px-4 py-2.5 text-center text-[13px] font-semibold text-coral-deep">
          <Lock aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span>
            {notice.organizationName} está en solo lectura{blockedReason(notice)}. Puedes consultar, pero no registrar ventas, cobros ni cambios.{' '}
            {notice.isOwner ? 'Contacta a LensSpace para renovar.' : 'Consulta con el dueño de la óptica.'}
          </span>
        </div>
      ))}
      {expiring.map((notice) => (
        <div key={`expiring-${notice.organizationId}`} role="status" className="flex items-start justify-center gap-2 bg-amber-soft px-4 py-2.5 text-center text-[13px] font-semibold text-amber-deep">
          <CalendarClock aria-hidden="true" size={16} className="mt-px shrink-0" />
          <span>
            {notice.subscriptionStatus === 'trial' ? 'La prueba' : 'La suscripción'} de {notice.organizationName} vence {notice.daysLeft === 0 ? 'hoy' : notice.daysLeft === 1 ? 'mañana' : `en ${notice.daysLeft} días`} ({formatDay(notice.expiresOn ?? '')}). Contacta a LensSpace para renovar.
          </span>
        </div>
      ))}
    </div>
  )
}
