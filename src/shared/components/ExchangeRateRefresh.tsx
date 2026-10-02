'use client'

import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { friendlyError, isNetworkError, offlineMessage } from '@/shared/lib/friendly-error'
import { Button } from '@/shared/ui'
import { todayIn } from '@/shared/utils/dates'

export type BusinessRate = { rate: number; rateDate: string }

const shortDate = (isoDay: string) => isoDay.split('-').reverse().slice(0, 2).join('/')

// One tap brings the day's elTOQUE rate and stores it as the business rate until the
// next tap. elTOQUE is queried at most once per day; later taps reuse that value.
export function ExchangeRateRefresh({ organizationId, current, onRefreshed }: { organizationId: number; current: BusinessRate | null; onRefreshed: (rate: BusinessRate) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const fresh = current?.rateDate === todayIn()

  async function refresh() {
    if (fresh && current) return onRefreshed(current)
    setPending(true)
    setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('refresh-exchange-rate', { body: { organizationId } })
    setPending(false)
    if (invokeError) {
      const body = invokeError.context instanceof Response ? await invokeError.context.json().catch(() => null) as { error?: string } | null : null
      return setError(body?.error ?? (isNetworkError(invokeError) ? offlineMessage : friendlyError(invokeError, 'No pudimos consultar elTOQUE.')))
    }
    const result = data as { rate: number; rateDate: string }
    onRefreshed({ rate: Number(result.rate), rateDate: result.rateDate })
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-text-muted">
      <Button variant="ghost" size="sm" icon={RefreshCw} disabled={pending} onClick={refresh} className="-ml-2">
        {pending ? 'Consultando elTOQUE…' : fresh ? 'Usar tasa de hoy' : 'Actualizar con elTOQUE'}
      </Button>
      <span>{current ? `elTOQUE ${shortDate(current.rateDate)}: ${current.rate} CUP` : 'Sin tasa de elTOQUE guardada'}</span>
      {error ? <span role="alert" className="w-full font-medium text-coral-ink">{error}</span> : null}
    </div>
  )
}
