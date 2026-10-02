'use client'

import { Factory, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import { FormSelect } from '@/shared/components'
import { friendlyError } from '@/shared/lib/friendly-error'
import { refreshNavigationCounters } from '@/shared/lib/navigation-counters'
import { Alert, Badge, Button } from '@/shared/ui'

import { productionStatusLabel, statusTone } from '../production-status'

type JobType = 'lens' | 'mounting'
type CurrentJob = { id: number; jobType: JobType; status: string; providerId: string }
type Assignee = { id: string; name: string; roles: string[] }
export type ProductionReadiness = { hasJobs: boolean; ready: boolean }

const jobLabels: Record<JobType, string> = { lens: 'Cristales', mounting: 'Montaje' }
const providerRole: Record<JobType, string> = { lens: 'lens_provider', mounting: 'mounting_provider' }
const finished = (status: string) => status === 'received' || status === 'reviewed'

// Production state and assignment from the order itself (QA-13/QA-14): the seller
// sends the work without leaving the sale, and delivery can warn when it is unfinished.
export function OrderProductionPanel({ orderId, canAssign, onReadinessChange }: { orderId: number; canAssign: boolean; onReadinessChange?: (readiness: ProductionReadiness) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [jobs, setJobs] = useState<CurrentJob[] | null>(null)
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [choice, setChoice] = useState<Record<JobType, string>>({ lens: '', mounting: '' })
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  // One RPC (QA-35) instead of 4 requests in 3 sequential stages.
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_order_production_panel', { target_order_id: orderId } as never)
    if (error || !data) return setMessage('No pudimos cargar la producción de este pedido.')
    const panel = data as unknown as { jobs: (CurrentJob & { providerName: string })[]; assignees: Assignee[] }
    setNames(Object.fromEntries([...panel.assignees.map((assignee) => [assignee.id, assignee.name]), ...panel.jobs.map((job) => [job.providerId, job.providerName])]))
    setAssignees(panel.assignees)
    setJobs(panel.jobs)
  }, [orderId, supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (!jobs) return
    onReadinessChange?.({ hasJobs: jobs.length > 0, ready: jobs.length > 0 && jobs.every((job) => finished(job.status)) })
  }, [jobs, onReadinessChange])

  function optionsFor(jobType: JobType) {
    return assignees
      .filter((assignee) => assignee.roles.includes(providerRole[jobType]) || assignee.roles.includes('in_house'))
      .map((assignee) => ({ value: assignee.id, label: assignee.roles.includes('in_house') ? `${assignee.name} (taller propio)` : assignee.name }))
  }

  function assign(jobType: JobType, providerId: string) {
    startTransition(async () => {
      const { error } = await supabase.rpc('assign_production_job', { target_order_id: orderId, job_type: jobType, provider_id: providerId } as never)
      if (error) return setMessage(friendlyError(error, 'No pudimos enviar el trabajo.'))
      setMessage(`${jobLabels[jobType]} enviados a ${names[providerId] ?? 'producción'}.`)
      void refreshNavigationCounters()
      await load()
    })
  }

  if (!jobs) return <p className="text-sm text-text-muted">{message || 'Cargando producción…'}</p>
  const ready = jobs.length > 0 && jobs.every((job) => finished(job.status))
  const missing = (['lens', 'mounting'] as JobType[]).filter((jobType) => !jobs.some((job) => job.jobType === jobType))

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-card px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><Factory aria-hidden="true" size={17} className="text-action" />Producción</h3>
        {ready ? <Badge tone="success">Listo para recoger</Badge> : null}
      </div>
      {jobs.map((job) => (
        <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-text-secondary"><strong className="text-ink">{jobLabels[job.jobType]}</strong> · {names[job.providerId] ?? 'Proveedor'}</span>
          <Badge tone={statusTone(job.status)}>{productionStatusLabel(job.status, job.jobType)}</Badge>
        </div>
      ))}
      {canAssign ? missing.map((jobType) => {
        const options = optionsFor(jobType)
        const selectedId = choice[jobType] || (options.length === 1 ? options[0].value : '')
        return (
          <div key={jobType} className="flex flex-col gap-2 border-t border-line-soft pt-3 sm:flex-row sm:items-center">
            <span className="shrink-0 text-sm font-semibold text-ink sm:w-24">{jobLabels[jobType]}</span>
            <div className="min-w-0 flex-1">
              <FormSelect ariaLabel={`Responsable de ${jobLabels[jobType].toLowerCase()}`} value={selectedId} onValueChange={(value) => setChoice((current) => ({ ...current, [jobType]: value }))} options={[{ value: '', label: options.length ? 'Selecciona responsable' : 'Sin responsables activos' }, ...options]} />
            </div>
            <Button size="sm" icon={Send} disabled={pending || !selectedId} onClick={() => assign(jobType, selectedId)}>{pending ? 'Enviando…' : 'Enviar'}</Button>
          </div>
        )
      }) : null}
      {!jobs.length && !canAssign ? <p className="text-sm text-text-muted">Aún no se ha enviado a producción.</p> : null}
      {message ? <Alert tone="info">{message}</Alert> : null}
    </div>
  )
}
