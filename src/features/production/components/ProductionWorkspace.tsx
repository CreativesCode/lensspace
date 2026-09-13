'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

type Incident = { id: number; description: string; costResponsibility: string; openedAt: string; reworkJobId: number | null }
export type ProductionJob = { id: number; orderId: number; orderNumber: string; jobType: 'lens' | 'mounting'; providerId: string; providerName: string; status: string; snapshot: { items?: { name: string }[] }; originalJobId: number | null; assignedAt: string; incidents: Incident[] }
export type AssignmentOrder = { id: number; organizationId: number; orderNumber: string }
export type Provider = { id: string; organizationId: number; name: string; role: 'lens_provider' | 'mounting_provider' }

const statusLabels: Record<string, string> = { pending: 'Pendiente', ready_to_send: 'Listo para enviar', dispatched: 'Enviado', in_production: 'En fabricación', in_mounting: 'En montaje', completed: 'Terminado', received: 'Recibido', reviewed: 'Revisado', incident: 'Incidencia' }
const nextStatus: Record<string, Record<string, string>> = {
  lens: { pending: 'ready_to_send', ready_to_send: 'dispatched', dispatched: 'in_production', in_production: 'completed', completed: 'received' },
  mounting: { pending: 'ready_to_send', ready_to_send: 'dispatched', dispatched: 'in_mounting', in_mounting: 'completed', completed: 'received', received: 'reviewed' },
}

export function ProductionWorkspace({ initialJobs, orders, providers }: { initialJobs: ProductionJob[]; orders: AssignmentOrder[]; providers: Provider[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [jobs, setJobs] = useState(initialJobs)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [jobType, setJobType] = useState<'lens' | 'mounting'>('lens')
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? 0)

  async function refreshJobs() {
    const { data, error } = await supabase.rpc('list_accessible_production_jobs')
    if (error) throw error
    setJobs(data as unknown as ProductionJob[])
  }

  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const { error } = await supabase.rpc('assign_production_job', { target_order_id: Number(form.get('orderId')), job_type: jobType, provider_id: String(form.get('providerId')) } as never)
      if (error) return setMessage(error.message)
      await refreshJobs(); setMessage('Trabajo asignado correctamente.')
    })
  }

  function transition(job: ProductionJob) {
    const target = nextStatus[job.jobType]?.[job.status]
    if (!target) return
    startTransition(async () => {
      const { error } = await supabase.rpc('transition_production_job', { target_job_id: job.id, target_status: target, notes: null } as never)
      if (error) return setMessage(error.message)
      await refreshJobs(); setMessage(`Estado actualizado a ${statusLabels[target]}.`)
    })
  }

  function reportIncident(job: ProductionJob) {
    const description = window.prompt('Describe la incidencia (mínimo 5 caracteres):')
    if (!description) return
    const responsibility = window.prompt('Responsable del costo: organization, lens_provider, mounting_provider o customer', job.jobType === 'lens' ? 'lens_provider' : 'mounting_provider')
    if (!responsibility) return
    startTransition(async () => {
      const { error } = await supabase.rpc('report_production_incident', { target_job_id: job.id, description, cost_responsibility: responsibility } as never)
      if (error) return setMessage(error.message)
      await refreshJobs(); setMessage('Incidencia registrada sin alterar el historial anterior.')
    })
  }

  function createRework(incidentId: number) {
    startTransition(async () => {
      const { error } = await supabase.rpc('create_production_rework', { target_incident_id: incidentId } as never)
      if (error) return setMessage(error.message)
      await refreshJobs(); setMessage('Repetición creada y vinculada al trabajo original.')
    })
  }

  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const matchingProviders = providers.filter((provider) => provider.organizationId === selectedOrder?.organizationId && provider.role === (jobType === 'lens' ? 'lens_provider' : 'mounting_provider'))
  return <div className="space-y-6">
    {orders.length && providers.length ? <form onSubmit={assign} className="grid gap-3 rounded-[10px] border border-[#E3EFED] bg-white p-5 md:grid-cols-4"><h2 className="font-display text-lg font-semibold text-[#07322F] md:col-span-4">Asignar producción</h2><select name="orderId" required value={selectedOrderId} onChange={(event) => setSelectedOrderId(Number(event.target.value))} className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F]">{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}</select><select value={jobType} onChange={(event) => setJobType(event.target.value as 'lens' | 'mounting')} className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F]"><option value="lens">Cristales</option><option value="mounting">Montaje</option></select><select name="providerId" required className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F]"><option value="">Selecciona proveedor</option>{matchingProviders.map((provider) => <option key={`${provider.organizationId}:${provider.id}`} value={provider.id}>{provider.name}</option>)}</select><button disabled={pending || !matchingProviders.length} className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Asignar trabajo</button></form> : null}
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{jobs.map((job) => <article key={job.id} className={`rounded-[10px] border bg-white p-5 ${job.status === 'incident' ? 'border-[#FFD9CD]' : 'border-[#E3EFED]'}`}><div className="flex items-center justify-between gap-3"><strong className="font-display text-sm text-[#07322F]">{job.orderNumber}</strong><span className={`rounded px-2 py-1 text-[11px] font-semibold ${job.status === 'incident' ? 'bg-[#FFE8E1] text-[#C23C1C]' : 'bg-[#D9F5EE] text-[#07655C]'}`}>{statusLabels[job.status] ?? job.status}</span></div><p className="mt-1 text-xs text-[#74857F]">{job.jobType === 'lens' ? 'Cristales' : 'Montaje'} · {job.providerName}</p><p className="mt-3 text-sm leading-6 text-[#4A5B58]">{job.snapshot.items?.map((item) => item.name).join(' · ') || 'Configuración preservada en la asignación.'}</p>{job.incidents.map((incident) => <div key={incident.id} className="mt-3 rounded-lg bg-[#FFF6F2] p-3 text-xs leading-5 text-[#7A3A26]"><p>{incident.description}</p><p className="mt-1 font-semibold">Costo: {incident.costResponsibility}</p>{!incident.reworkJobId ? <button type="button" disabled={pending} onClick={() => createRework(incident.id)} className="mt-2 font-semibold text-[#C23C1C] underline">Aceptar repetición</button> : <p className="mt-1">Repetición vinculada</p>}</div>)}<div className="mt-4 flex gap-2">{nextStatus[job.jobType]?.[job.status] ? <button type="button" disabled={pending} onClick={() => transition(job)} className="flex-1 rounded-[7px] bg-[#0D7A72] px-3 py-2.5 text-xs font-semibold text-white">Marcar {statusLabels[nextStatus[job.jobType][job.status]].toLowerCase()}</button> : null}{job.status !== 'incident' ? <button type="button" disabled={pending} onClick={() => reportIncident(job)} className="rounded-[7px] border border-[#FFD9CD] bg-[#FFF6F2] px-3 py-2.5 text-xs font-semibold text-[#C23C1C]">Incidencia</button> : null}</div></article>)}</div>
    {!jobs.length ? <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">No hay trabajos de producción accesibles.</p> : null}
    {message ? <p role="status" className="text-sm text-[#4A5B58]">{message}</p> : null}
  </div>
}
