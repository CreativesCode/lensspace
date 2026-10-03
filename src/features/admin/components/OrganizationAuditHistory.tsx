'use client'

import { useEffect, useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { BUSINESS_TIME_ZONE } from '@/shared/utils/dates'

type AuditRow = { id: number; event_type: string; reason: string | null; occurred_at: string }

const eventLabels: Record<string, string> = {
  'organization.contract_changed': 'Contrato y módulos actualizados',
  'organization.created': 'Organización creada',
  'support.session_started': 'Asistencia iniciada',
  'support.session_ended': 'Asistencia cerrada',
  'membership.invited': 'Miembro invitado',
  'membership.updated': 'Miembro actualizado',
  'membership.invitation_accepted': 'Invitación aceptada',
  'membership.invitation_declined': 'Invitación rechazada',
}

const dateTime = new Intl.DateTimeFormat('es-CU', { timeZone: BUSINESS_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// QA-54: last 20 audit events, loaded only when the detail dialog opens (the list
// page stays light on a weak connection).
export function OrganizationAuditHistory({ organizationId, refreshKey }: { organizationId: number; refreshKey: number }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.from('audit_events').select('id, event_type, reason, occurred_at').eq('organization_id', organizationId).order('occurred_at', { ascending: false }).limit(20)
      .then(({ data, error }) => {
        if (cancelled) return
        setFailed(Boolean(error))
        setRows((data ?? []) as AuditRow[])
      })
    return () => { cancelled = true }
  }, [organizationId, refreshKey, supabase])

  if (failed) return <p className="text-sm text-text-muted">No pudimos cargar el historial. Reabre el detalle cuando vuelva la señal.</p>
  if (!rows) return <p className="text-sm text-text-muted">Cargando historial…</p>
  if (!rows.length) return <p className="text-sm text-text-muted">Sin eventos registrados.</p>
  return <ol className="flex flex-col gap-2.5">
    {rows.map((row) => <li key={row.id} className="border-l-2 border-line pl-3 text-sm">
      <p className="font-semibold text-ink">{eventLabels[row.event_type] ?? row.event_type}</p>
      <p className="text-[12px] text-text-muted">{dateTime.format(new Date(row.occurred_at))}</p>
      {row.reason ? <p className="text-[13px] text-text-secondary [overflow-wrap:anywhere]">{row.reason}</p> : null}
    </li>)}
  </ol>
}
