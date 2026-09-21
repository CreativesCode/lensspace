'use client'

import Link from 'next/link'
import { Filter, Plus, RotateCcw, X } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormSelect, OperationalFilters } from '@/shared/components'

type Incident = { id: number; description: string; costResponsibility: string; openedAt: string; reworkJobId: number | null }
type IncidentResponsibility = 'organization' | 'lens_provider' | 'mounting_provider' | 'customer'
type PrescriptionSnapshot = {
  prescription_date?: string | null
  prescriber_name?: string | null
  right_sphere?: number | null
  right_cylinder?: number | null
  right_axis?: number | null
  right_addition?: number | null
  right_prism?: number | null
  right_prism_base?: string | null
  left_sphere?: number | null
  left_cylinder?: number | null
  left_axis?: number | null
  left_addition?: number | null
  left_prism?: number | null
  left_prism_base?: string | null
  pupillary_distance_total?: number | null
  right_pupillary_distance?: number | null
  left_pupillary_distance?: number | null
  right_height?: number | null
  left_height?: number | null
}
export type ProductionJob = { id: number; orderId: number; orderNumber: string; customerName?: string | null; jobType: 'lens' | 'mounting'; providerId: string; providerName: string; status: string; snapshot: { items?: { name: string }[]; prescription?: PrescriptionSnapshot | null }; originalJobId: number | null; assignedAt: string; incidents: Incident[] }
export type AssignmentOrder = { id: number; organizationId: number; orderNumber: string; customerName?: string | null }
export type Provider = { id: string; organizationId: number; name: string; role: 'lens_provider' | 'mounting_provider' }

const statusLabels: Record<string, string> = {
  pending: 'Pendiente de iniciar · Cristalero o montador',
  ready_to_send: 'Listo para entregar al proveedor · Óptica',
  dispatched: 'Entregado al proveedor · Óptica',
  in_production: 'En fabricación · Cristalero',
  in_mounting: 'En montaje · Montador',
  completed: 'Trabajo listo · Cristalero o montador',
  received: 'Recibido por la óptica',
  reviewed: 'Revisado por la óptica',
  incident: 'Con incidencia',
}

function productionStatusLabel(status: string, jobType?: ProductionJob['jobType']) {
  if (status === 'pending' && jobType) return `Pendiente de iniciar · ${jobType === 'lens' ? 'Cristalero' : 'Montador'}`
  if (status === 'completed' && jobType) return `${jobType === 'lens' ? 'Cristales' : 'Montaje'} listo · ${jobType === 'lens' ? 'Cristalero' : 'Montador'}`
  return statusLabels[status] ?? status
}
function nextTransition(job: ProductionJob, opticalActor: boolean) {
  const opticalTransitions: Record<string, { target: string; label: string }> = job.jobType === 'lens'
    ? { pending: { target: 'ready_to_send', label: 'Marcar listo para enviar' }, ready_to_send: { target: 'dispatched', label: 'Marcar enviado' }, completed: { target: 'received', label: 'Marcar recibido' } }
    : { pending: { target: 'ready_to_send', label: 'Marcar listo para enviar' }, ready_to_send: { target: 'dispatched', label: 'Marcar enviado' }, completed: { target: 'received', label: 'Marcar recibido' }, received: { target: 'reviewed', label: 'Marcar revisado' } }
  const providerTransitions: Record<string, { target: string; label: string }> = job.jobType === 'lens'
    ? { pending: { target: 'in_production', label: 'Iniciar fabricación' }, dispatched: { target: 'in_production', label: 'Iniciar fabricación' }, in_production: { target: 'completed', label: 'Marcar trabajo listo' } }
    : { pending: { target: 'in_mounting', label: 'Iniciar montaje' }, dispatched: { target: 'in_mounting', label: 'Iniciar montaje' }, in_mounting: { target: 'completed', label: 'Marcar trabajo listo' } }
  return (opticalActor ? opticalTransitions : providerTransitions)[job.status]
}

export function ProductionWorkspace({ initialJobs, orders, providers, canManageTeam, canAssignProduction }: { initialJobs: ProductionJob[]; orders: AssignmentOrder[]; providers: Provider[]; canManageTeam: boolean; canAssignProduction: boolean }) {
  const supabase = useMemo(() => createClient(), [])
  const [jobs, setJobs] = useState(initialJobs)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const [jobType, setJobType] = useState<'lens' | 'mounting'>('lens')
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? 0)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [incidentJob, setIncidentJob] = useState<ProductionJob | null>(null)
  const [incidentResponsibility, setIncidentResponsibility] = useState<IncidentResponsibility>('organization')
  const [incidentError, setIncidentError] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')

  useEffect(() => {
    if (!incidentJob && !assignmentOpen && !filtersOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || pending) return
      setIncidentJob(null)
      setAssignmentOpen(false)
      setFiltersOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [assignmentOpen, filtersOpen, incidentJob, pending])

  async function refreshJobs() {
    const { data, error } = await supabase.rpc('list_accessible_production_jobs')
    if (error) throw error
    setJobs((data as unknown as ProductionJob[]).map((job) => ({ ...job, customerName: orders.find((order) => order.id === job.orderId)?.customerName ?? null })))
  }

  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const { error } = await supabase.rpc('assign_production_job', { target_order_id: Number(form.get('orderId')), job_type: jobType, provider_id: String(form.get('providerId')) } as never)
      if (error) return setAssignmentError(error.message)
      await refreshJobs(); setAssignmentOpen(false); setSelectedProviderId(''); setAssignmentError(''); setMessage('Trabajo asignado correctamente.')
    })
  }

  function transitionProduction(job: ProductionJob) {
    const transition = nextTransition(job, canAssignProduction)
    if (!transition) return
    startTransition(async () => {
      const { error } = await supabase.rpc('transition_production_job', { target_job_id: job.id, target_status: transition.target, notes: null } as never)
      if (error) return setMessage(error.message)
      await refreshJobs(); setMessage(`Estado actualizado a ${productionStatusLabel(transition.target, job.jobType)}.`)
    })
  }

  function openIncidentDialog(job: ProductionJob) {
    setIncidentJob(job)
    setIncidentResponsibility(job.jobType === 'lens' ? 'lens_provider' : 'mounting_provider')
    setIncidentError('')
  }

  function reportIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!incidentJob) return
    const description = String(new FormData(event.currentTarget).get('description') ?? '').trim()
    if (description.length < 5) return setIncidentError('Describe la incidencia con al menos 5 caracteres.')
    if (description.length > 1000) return setIncidentError('La descripción no puede superar los 1000 caracteres.')
    setIncidentError('')
    startTransition(async () => {
      const { error } = await supabase.rpc('report_production_incident', { target_job_id: incidentJob.id, description, cost_responsibility: incidentResponsibility } as never)
      if (error) return setIncidentError(error.message)
      await refreshJobs()
      setIncidentJob(null)
      setMessage('Incidencia registrada sin alterar el historial anterior.')
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
  const filteredJobs = useMemo(() => {
    const customerTerm = customerFilter.trim().toLocaleLowerCase('es')
    return jobs.filter((job) => {
      const assignedDate = job.assignedAt.slice(0, 10)
      return (!customerTerm || job.customerName?.toLocaleLowerCase('es').includes(customerTerm))
        && (statusFilter === 'all' || job.status === statusFilter)
        && (!dateFrom || assignedDate >= dateFrom)
        && (!dateTo || assignedDate <= dateTo)
    })
  }, [customerFilter, dateFrom, dateTo, jobs, statusFilter])
  const productionStatusOptions = [{ value: 'all', label: 'Todos los estados' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]
  const activeFilterCount = Number(Boolean(customerFilter.trim()) && canAssignProduction) + Number(statusFilter !== 'all') + Number(Boolean(dateFrom)) + Number(Boolean(dateTo))
  const clearFilters = () => { setCustomerFilter(''); setStatusFilter('all'); setDateFrom(''); setDateTo('') }
  return <div className="space-y-6">
    {canAssignProduction && !orders.length ? <section className="rounded-[10px] border border-[#B9DFD9] bg-white p-5"><h2 className="font-display text-lg font-semibold text-[#07322F]">Para asignar producción necesitas un pedido confirmado</h2><p className="mt-2 text-sm leading-6 text-[#4A5B58]">Todavía no aparece ningún pedido para seleccionar. Crea una venta y confirma la cotización; después regresa aquí.</p><Link href="/sales" className="mt-4 inline-flex min-h-11 items-center rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white">+ Nueva venta</Link></section> : null}
    {canAssignProduction && !providers.length ? <section className="rounded-[10px] border border-[#F1D5A8] bg-[#FFF9EF] p-5"><h2 className="font-display text-lg font-semibold text-[#07322F]">También falta un proveedor activo</h2><p className="mt-2 text-sm leading-6 text-[#6B5940]">Invita al menos un Cristalero/laboratorio o un Montador desde Equipo. Cuando acepte la invitación y quede activo, aparecerá automáticamente en el selector.</p>{canManageTeam ? <Link href="/team" className="mt-4 inline-flex min-h-11 items-center rounded-[7px] border border-[#D6B97F] bg-white px-4 py-2.5 text-sm font-semibold text-[#6B4E16]">Ir a Equipo</Link> : <p className="mt-3 text-sm font-semibold text-[#6B4E16]">Pídele al propietario que invite al proveedor.</p>}</section> : null}
    {(canAssignProduction && orders.length) || jobs.length ? <div className="flex flex-wrap items-center justify-end gap-2">{canAssignProduction && orders.length ? <button type="button" onClick={() => { setAssignmentError(''); setAssignmentOpen(true) }} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white"><Plus aria-hidden="true" size={18} />Asignar trabajo</button> : null}{jobs.length ? <button type="button" onClick={() => setFiltersOpen(true)} aria-label="Abrir filtros" title="Filtros" className="relative grid h-11 w-11 place-items-center rounded-[7px] border border-[#9BCDC6] bg-white text-[#0D7A72] hover:bg-[#F0FBF9]"><Filter aria-hidden="true" size={19} />{activeFilterCount ? <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#C23C1C] px-1 text-[10px] font-bold text-white">{activeFilterCount}</span> : null}</button> : null}{activeFilterCount ? <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center gap-2 rounded-[7px] border border-[#DCECEA] bg-white px-3 py-2.5 text-sm font-semibold text-[#4A5B58]"><RotateCcw aria-hidden="true" size={16} />Limpiar</button> : null}</div> : null}
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{filteredJobs.map((job) => { const transition = nextTransition(job, canAssignProduction); return <article key={job.id} className={`rounded-[10px] border bg-white p-5 ${job.status === 'incident' ? 'border-[#FFD9CD]' : 'border-[#E3EFED]'}`}><div className="flex items-center justify-between gap-3"><strong className="font-display text-sm text-[#07322F]">{job.orderNumber}</strong><span className={`rounded px-2 py-1 text-[11px] font-semibold ${job.status === 'incident' ? 'bg-[#FFE8E1] text-[#C23C1C]' : 'bg-[#D9F5EE] text-[#07655C]'}`}>{statusLabels[job.status] ?? job.status}</span></div>{canAssignProduction && job.customerName ? <p className="mt-1 text-sm font-semibold text-[#315D58]">{job.customerName}</p> : null}<p className="mt-1 text-xs text-[#74857F]">{job.jobType === 'lens' ? 'Cristales' : 'Montaje'} · {job.providerName} · {new Date(job.assignedAt).toLocaleDateString('es-CU')}</p><p className="mt-3 text-sm leading-6 text-[#4A5B58]">{job.snapshot.items?.map((item) => item.name).join(' · ') || 'Configuración preservada en la asignación.'}</p><PrescriptionDetails prescription={job.snapshot.prescription} />{job.incidents.map((incident) => <div key={incident.id} className="mt-3 rounded-lg bg-[#FFF6F2] p-3 text-xs leading-5 text-[#7A3A26]"><p>{incident.description}</p><p className="mt-1 font-semibold">Costo: {incident.costResponsibility}</p>{!incident.reworkJobId ? <button type="button" disabled={pending} onClick={() => createRework(incident.id)} className="mt-2 font-semibold text-[#C23C1C] underline">Aceptar repetición</button> : <p className="mt-1">Repetición vinculada</p>}</div>)}<div className="mt-4 flex gap-2">{transition ? <button type="button" disabled={pending} onClick={() => transition && transitionProduction(job)} className="flex-1 rounded-[7px] bg-[#0D7A72] px-3 py-2.5 text-xs font-semibold text-white">{transition.label}</button> : null}{job.status !== 'incident' ? <button type="button" disabled={pending} onClick={() => openIncidentDialog(job)} className="rounded-[7px] border border-[#FFD9CD] bg-[#FFF6F2] px-3 py-2.5 text-xs font-semibold text-[#C23C1C]">Incidencia</button> : null}</div></article> })}</div>
    {!jobs.length ? <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">{canAssignProduction ? 'Aún no hay trabajos asignados. Cuando completes los requisitos anteriores y pulses “Asignar trabajo”, aparecerán aquí.' : 'Aún no tienes trabajos de producción asignados.'}</p> : null}
    {jobs.length && !filteredJobs.length ? <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">No hay trabajos que coincidan con los filtros.</p> : null}
    {message ? <p role="status" className="text-sm text-[#4A5B58]">{message}</p> : null}
    {assignmentOpen ? <ProductionDialog title="Asignar producción" eyebrow="Nuevo trabajo" onClose={() => { if (!pending) setAssignmentOpen(false) }}><form onSubmit={assign} className="space-y-4"><p className="text-sm text-[#74857F]">Selecciona el pedido, el trabajo requerido y el proveedor responsable.</p><label className="block text-sm font-semibold text-[#4A5B58]">Pedido<FormSelect className="mt-1" name="orderId" ariaLabel="Pedido" value={String(selectedOrderId)} onValueChange={(value) => { setSelectedOrderId(Number(value)); setSelectedProviderId('') }} options={orders.map((order) => ({ value: String(order.id), label: order.orderNumber }))} /></label><label className="block text-sm font-semibold text-[#4A5B58]">Tipo de trabajo<FormSelect className="mt-1" ariaLabel="Tipo de trabajo" value={jobType} onValueChange={(value) => { setJobType(value as 'lens' | 'mounting'); setSelectedProviderId('') }} options={[{ value: 'lens', label: 'Cristales' }, { value: 'mounting', label: 'Montaje' }]} /></label><label className="block text-sm font-semibold text-[#4A5B58]">Proveedor<FormSelect className="mt-1" name="providerId" ariaLabel="Proveedor" required value={selectedProviderId} onValueChange={setSelectedProviderId} options={[{ value: '', label: matchingProviders.length ? 'Selecciona proveedor' : `No hay ${jobType === 'lens' ? 'cristaleros' : 'montadores'} activos` }, ...matchingProviders.map((provider) => ({ value: provider.id, label: provider.name }))]} /></label>{assignmentError ? <p role="alert" className="rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-3 text-sm text-[#7A3A26]">{assignmentError}</p> : null}<div className="flex justify-end gap-3 border-t border-[#EEF5F4] pt-4"><button type="button" onClick={() => setAssignmentOpen(false)} disabled={pending} className="rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58]">Cancelar</button><button disabled={pending || !selectedProviderId} className="rounded-[7px] bg-[#0D7A72] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Asignando…' : 'Asignar trabajo'}</button></div></form></ProductionDialog> : null}
    {filtersOpen ? <ProductionDialog title="Filtrar trabajos" eyebrow="Producción" onClose={() => setFiltersOpen(false)}><OperationalFilters embedded showClear={false} query={customerFilter} onQueryChange={setCustomerFilter} showQuery={canAssignProduction} status={statusFilter} onStatusChange={setStatusFilter} statusOptions={productionStatusOptions} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClear={clearFilters} resultCount={filteredJobs.length} /><div className="mt-5 flex justify-end gap-3 border-t border-[#EEF5F4] pt-4">{activeFilterCount ? <button type="button" onClick={clearFilters} className="inline-flex items-center gap-2 rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58]"><RotateCcw aria-hidden="true" size={16} />Limpiar</button> : null}<button type="button" onClick={() => setFiltersOpen(false)} className="rounded-[7px] bg-[#07322F] px-5 py-2.5 text-sm font-semibold text-white">Ver resultados</button></div></ProductionDialog> : null}
    {incidentJob ? <IncidentDialog job={incidentJob} responsibility={incidentResponsibility} pending={pending} error={incidentError} onResponsibilityChange={setIncidentResponsibility} onClose={() => { if (!pending) setIncidentJob(null) }} onSubmit={reportIncident} /> : null}
  </div>
}

function ProductionDialog({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <div role="dialog" aria-modal="true" aria-labelledby={`production-dialog-${title}`} className="fixed inset-0 z-50 grid place-items-center bg-[#07322F]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[12px] bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-[#E3EFED] p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0D7A72]">{eyebrow}</p><h2 id={`production-dialog-${title}`} className="mt-1 font-display text-xl font-bold text-[#07322F]">{title}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="grid h-10 w-10 place-items-center rounded-lg border border-[#DCECEA] text-[#07322F]"><X aria-hidden="true" size={20} /></button></header><div className="p-5">{children}</div></div></div>
}

const prismBaseLabels: Record<string, string> = { up: 'Arriba', down: 'Abajo', in: 'Interna', out: 'Externa' }
const prescriptionValue = (value: number | null | undefined, suffix = '') => value === null || value === undefined ? '—' : `${Number(value).toLocaleString('es-CU', { maximumFractionDigits: 2 })}${suffix}`

function PrescriptionDetails({ prescription }: { prescription?: PrescriptionSnapshot | null }) {
  if (!prescription) return <p className="mt-3 rounded-lg border border-dashed border-[#DCECEA] px-3 py-2 text-xs text-[#74857F]">Este trabajo no tiene una receta asociada.</p>
  const eyes = [
    { label: 'OD', sphere: prescription.right_sphere, cylinder: prescription.right_cylinder, axis: prescription.right_axis, addition: prescription.right_addition, pd: prescription.right_pupillary_distance, height: prescription.right_height, prism: prescription.right_prism, base: prescription.right_prism_base },
    { label: 'OI', sphere: prescription.left_sphere, cylinder: prescription.left_cylinder, axis: prescription.left_axis, addition: prescription.left_addition, pd: prescription.left_pupillary_distance, height: prescription.left_height, prism: prescription.left_prism, base: prescription.left_prism_base },
  ]
  return <details className="mt-3 rounded-lg border border-[#B9DFD9] bg-[#F7FDFC] open:pb-3"><summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-[#0D7A72]">Ver receta de fabricación</summary><div className="overflow-x-auto border-t border-[#DCECEA]"><table className="w-full min-w-[560px] text-left text-xs"><thead className="text-[#74857F]"><tr><th className="px-3 py-2">Ojo</th><th className="px-2 py-2">Esfera</th><th className="px-2 py-2">Cilindro</th><th className="px-2 py-2">Eje</th><th className="px-2 py-2">Adición</th><th className="px-2 py-2">DP</th><th className="px-2 py-2">Altura</th></tr></thead><tbody>{eyes.map((eye) => <tr key={eye.label} className="border-t border-[#E3EFED] text-[#07322F]"><th className="px-3 py-2 font-bold">{eye.label}</th><td className="px-2 py-2">{prescriptionValue(eye.sphere)}</td><td className="px-2 py-2">{prescriptionValue(eye.cylinder)}</td><td className="px-2 py-2">{prescriptionValue(eye.axis, '°')}</td><td className="px-2 py-2">{prescriptionValue(eye.addition)}</td><td className="px-2 py-2">{prescriptionValue(eye.pd, ' mm')}</td><td className="px-2 py-2">{prescriptionValue(eye.height, ' mm')}</td></tr>)}</tbody></table></div><div className="grid gap-2 px-3 pt-3 text-xs text-[#4A5B58] sm:grid-cols-2"><p><strong>DP conjunta:</strong> {prescriptionValue(prescription.pupillary_distance_total, ' mm')}</p><p><strong>Fecha:</strong> {prescription.prescription_date ?? '—'}</p><p><strong>Prisma OD:</strong> {prescriptionValue(prescription.right_prism)} {prescription.right_prism_base ? `· ${prismBaseLabels[prescription.right_prism_base] ?? prescription.right_prism_base}` : ''}</p><p><strong>Prisma OI:</strong> {prescriptionValue(prescription.left_prism)} {prescription.left_prism_base ? `· ${prismBaseLabels[prescription.left_prism_base] ?? prescription.left_prism_base}` : ''}</p>{prescription.prescriber_name ? <p className="sm:col-span-2"><strong>Médico u optometrista:</strong> {prescription.prescriber_name}</p> : null}</div></details>
}

function IncidentDialog({ job, responsibility, pending, error, onResponsibilityChange, onClose, onSubmit }: { job: ProductionJob; responsibility: IncidentResponsibility; pending: boolean; error: string; onResponsibilityChange: (value: IncidentResponsibility) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const field = 'mt-1 w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'
  return <div role="dialog" aria-modal="true" aria-labelledby="incident-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-[#07322F]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onClose() }}><div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-[12px] bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-[#E3EFED] p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C23C1C]">{job.orderNumber} · {job.jobType === 'lens' ? 'Cristales' : 'Montaje'}</p><h2 id="incident-dialog-title" className="mt-1 font-display text-xl font-bold text-[#07322F]">Registrar incidencia</h2></div><button type="button" onClick={onClose} disabled={pending} aria-label="Cerrar diálogo" className="grid h-10 w-10 place-items-center rounded-lg border border-[#DCECEA] text-xl text-[#07322F] disabled:opacity-50">×</button></header><form onSubmit={onSubmit} className="space-y-4 p-5" noValidate><label className="block text-sm font-semibold text-[#4A5B58]">Descripción<textarea autoFocus name="description" minLength={5} maxLength={1000} required rows={4} placeholder="Describe qué ocurrió y cualquier detalle útil…" className={`${field} resize-y`} /></label><label className="block text-sm font-semibold text-[#4A5B58]">Responsable del costo<FormSelect className="mt-1" ariaLabel="Responsable del costo" menuPlacement="top" value={responsibility} onValueChange={(value) => onResponsibilityChange(value as IncidentResponsibility)} options={[{ value: 'organization', label: 'Óptica / organización' }, { value: 'lens_provider', label: 'Cristalero / laboratorio' }, { value: 'mounting_provider', label: 'Montador' }, { value: 'customer', label: 'Cliente' }]} /></label>{error ? <p role="alert" className="rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-3 text-sm text-[#7A3A26]">{error}</p> : null}<div className="flex justify-end gap-3 border-t border-[#EEF5F4] pt-4"><button type="button" onClick={onClose} disabled={pending} className="rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58] disabled:opacity-50">Cancelar</button><button disabled={pending} className="rounded-[7px] bg-[#C23C1C] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Registrando…' : 'Registrar incidencia'}</button></div></form></div></div>
}
