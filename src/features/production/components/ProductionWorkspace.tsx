'use client'

import { Factory, Plus, RotateCcw, SearchX, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { FormEvent, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormSelect, OperationalFilters } from '@/shared/components'
import { Alert, Button, ButtonLink, Dialog, EmptyState, Field, IconButton, PageHeader, SegmentedControl, StatCard, Textarea } from '@/shared/ui'

import { productionStatusLabel, responsibilityLabels, statusLabels } from '../production-status'
import { ProductionJobCard } from './ProductionJobCard'

type Incident = { id: number; description: string; costResponsibility: string; openedAt: string; reworkJobId: number | null }
type IncidentResponsibility = 'organization' | 'lens_provider' | 'mounting_provider' | 'customer'
export type PrescriptionSnapshot = {
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
export type Provider = { id: string; organizationId: number; name: string; role: 'lens_provider' | 'mounting_provider' | 'in_house' }
type JobAction = { target: string; label: string }

// Optical actors (owner/seller) may also record the provider's steps: directly on
// their own in-house jobs, or "en nombre del proveedor" on someone else's.
function jobActions(job: ProductionJob, opticalActor: boolean, currentUserId: string): { primary?: JobAction; secondary?: JobAction } {
  const opticalTransitions: Record<string, { target: string; label: string }> = job.jobType === 'lens'
    ? { pending: { target: 'ready_to_send', label: 'Marcar listo para enviar' }, ready_to_send: { target: 'dispatched', label: 'Marcar enviado' }, completed: { target: 'received', label: 'Marcar recibido' } }
    : { pending: { target: 'ready_to_send', label: 'Marcar listo para enviar' }, ready_to_send: { target: 'dispatched', label: 'Marcar enviado' }, completed: { target: 'received', label: 'Marcar recibido' }, received: { target: 'reviewed', label: 'Marcar revisado' } }
  const providerTransitions: Record<string, { target: string; label: string }> = job.jobType === 'lens'
    ? { pending: { target: 'in_production', label: 'Iniciar fabricación' }, dispatched: { target: 'in_production', label: 'Iniciar fabricación' }, in_production: { target: 'completed', label: 'Marcar trabajo listo' } }
    : { pending: { target: 'in_mounting', label: 'Iniciar montaje' }, dispatched: { target: 'in_mounting', label: 'Iniciar montaje' }, in_mounting: { target: 'completed', label: 'Marcar trabajo listo' } }
  const optical = opticalTransitions[job.status]
  const provider = providerTransitions[job.status]
  if (!opticalActor) return { primary: provider }
  if (job.providerId === currentUserId) return { primary: provider ?? optical }
  const onBehalf = provider ? { ...provider, label: `${provider.label} (en nombre del proveedor)` } : undefined
  return optical ? { primary: optical, secondary: onBehalf } : { primary: onBehalf }
}

export function ProductionWorkspace({ initialJobs, orders, providers, currentUserId, canAssignProduction }: { initialJobs: ProductionJob[]; orders: AssignmentOrder[]; providers: Provider[]; currentUserId: string; canAssignProduction: boolean }) {
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

  // Returns false instead of throwing: the mutation already committed, so a failed
  // reload (weak signal) must not take the page down.
  async function refreshJobs() {
    const { data, error } = await supabase.rpc('list_accessible_production_jobs')
    if (error) return false
    setJobs((data as unknown as ProductionJob[]).map((job) => ({ ...job, customerName: orders.find((order) => order.id === job.orderId)?.customerName ?? null })))
    return true
  }
  const savedMessage = (fresh: boolean, message: string) => fresh ? message : `${message} No pudimos actualizar la lista; recarga cuando vuelva la señal.`

  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const { error } = await supabase.rpc('assign_production_job', { target_order_id: Number(form.get('orderId')), job_type: jobType, provider_id: effectiveProviderId } as never)
      if (error) return setAssignmentError(error.message)
      const fresh = await refreshJobs(); setAssignmentOpen(false); setSelectedProviderId(''); setAssignmentError(''); setMessage(savedMessage(fresh, 'Trabajo asignado correctamente.'))
    })
  }

  function transitionProduction(job: ProductionJob, transition: JobAction) {
    startTransition(async () => {
      const { error } = await supabase.rpc('transition_production_job', { target_job_id: job.id, target_status: transition.target, notes: null } as never)
      if (error) return setMessage(error.message)
      const fresh = await refreshJobs(); setMessage(savedMessage(fresh, `Estado actualizado a ${productionStatusLabel(transition.target, job.jobType)}.`))
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
      const fresh = await refreshJobs()
      setIncidentJob(null)
      setMessage(savedMessage(fresh, 'Incidencia registrada sin alterar el historial anterior.'))
    })
  }

  function createRework(incidentId: number) {
    startTransition(async () => {
      const { error } = await supabase.rpc('create_production_rework', { target_incident_id: incidentId } as never)
      if (error) return setMessage(error.message)
      const fresh = await refreshJobs(); setMessage(savedMessage(fresh, 'Repetición creada y vinculada al trabajo original.'))
    })
  }

  const selectedOrder = orders.find((order) => order.id === selectedOrderId)
  const matchingProviders = providers.filter((provider) => provider.organizationId === selectedOrder?.organizationId && (provider.role === 'in_house' || provider.role === (jobType === 'lens' ? 'lens_provider' : 'mounting_provider')))
  const effectiveProviderId = selectedProviderId || (matchingProviders.length === 1 ? matchingProviders[0].id : '')
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
  const activeJobs = jobs.filter((job) => !['received', 'reviewed'].includes(job.status))
  const header = (
    <PageHeader
      eyebrow="Taller y proveedores"
      title="Producción"
      description="Cada proveedor ve únicamente los trabajos asignados, sin precios ni pagos."
      actions={canAssignProduction && orders.length ? <Button variant="mint" icon={Plus} onClick={() => { setAssignmentError(''); setAssignmentOpen(true) }}>Asignar trabajo</Button> : undefined}
      stats={jobs.length ? <>
        <StatCard surface="ink" label="Trabajos activos" value={activeJobs.length} />
        <StatCard surface="ink" label="En fabricación o montaje" value={jobs.filter((job) => ['in_production', 'in_mounting'].includes(job.status)).length} />
        <StatCard surface="ink" tone="positive" label="Listos" value={jobs.filter((job) => job.status === 'completed').length} />
        <StatCard surface="ink" tone={jobs.some((job) => job.status === 'incident') ? 'attention' : 'default'} label="Con incidencia" value={jobs.filter((job) => job.status === 'incident').length} />
      </> : undefined}
    />
  )

  return <div className="flex flex-col gap-5">
    {header}
    {canAssignProduction && !orders.length ? (
      <Alert tone="info" title="Para asignar producción necesitas un pedido confirmado.">
        Crea una venta y confirma la cotización; después regresa aquí.
        <span className="mt-3 block"><ButtonLink href="/sales" icon={Plus} size="sm">Nueva venta</ButtonLink></span>
      </Alert>
    ) : null}
    {jobs.length ? (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">{filteredJobs.length === 1 ? '1 trabajo' : `${filteredJobs.length} trabajos`}</p>
        <div className="flex items-center gap-2">
          {activeFilterCount ? <Button variant="ghost" size="sm" icon={RotateCcw} onClick={clearFilters}>Limpiar</Button> : null}
          <IconButton icon={SlidersHorizontal} label="Abrir filtros" count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
        </div>
      </div>
    ) : null}
    <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {filteredJobs.map((job) => {
        const { primary, secondary } = jobActions(job, canAssignProduction, currentUserId)
        return <ProductionJobCard key={job.id} job={job} showCustomer={canAssignProduction} transitionLabel={primary?.label} secondaryTransitionLabel={secondary?.label} pending={pending} onTransition={() => primary && transitionProduction(job, primary)} onSecondaryTransition={() => secondary && transitionProduction(job, secondary)} onReportIncident={() => openIncidentDialog(job)} onCreateRework={createRework} />
      })}
    </div>
    {!jobs.length ? <EmptyState icon={Factory} title="Sin trabajos asignados" description={canAssignProduction ? 'Cuando completes los requisitos anteriores y pulses “Asignar trabajo”, aparecerán aquí.' : 'Aún no tienes trabajos de producción asignados.'} /> : null}
    {jobs.length > 0 && !filteredJobs.length ? <EmptyState icon={SearchX} title="Sin trabajos con estos filtros" action={<Button variant="ghost" onClick={clearFilters}>Limpiar filtros</Button>} /> : null}
    {message ? <Alert tone="info">{message}</Alert> : null}

    <Dialog
      open={assignmentOpen}
      onClose={() => { if (!pending) setAssignmentOpen(false) }}
      eyebrow="Nuevo trabajo"
      title="Asignar producción"
      description="Selecciona el pedido, el trabajo requerido y el proveedor responsable."
      size="md"
      footer={<>
        <Button variant="ghost" onClick={() => setAssignmentOpen(false)} disabled={pending}>Cancelar</Button>
        <Button type="submit" form="production-assign" icon={Plus} disabled={pending || !effectiveProviderId}>{pending ? 'Asignando…' : 'Asignar trabajo'}</Button>
      </>}
    >
      <form id="production-assign" onSubmit={assign} className="flex flex-col gap-4">
        <Field label="Pedido"><FormSelect name="orderId" ariaLabel="Pedido" value={String(selectedOrderId)} onValueChange={(value) => { setSelectedOrderId(Number(value)); setSelectedProviderId('') }} options={orders.map((order) => ({ value: String(order.id), label: order.orderNumber }))} /></Field>
        <Field as="div" label="Tipo de trabajo"><SegmentedControl label="Tipo de trabajo" value={jobType} onChange={(value) => { setJobType(value); setSelectedProviderId('') }} options={[{ value: 'lens', label: 'Cristales' }, { value: 'mounting', label: 'Montaje' }]} /></Field>
        <Field label="Proveedor"><FormSelect name="providerId" ariaLabel="Proveedor" required value={effectiveProviderId} onValueChange={setSelectedProviderId} options={[{ value: '', label: matchingProviders.length ? 'Selecciona proveedor' : `No hay ${jobType === 'lens' ? 'cristaleros' : 'montadores'} activos` }, ...matchingProviders.map((provider) => ({ value: provider.id, label: provider.name }))]} /></Field>
        {assignmentError ? <Alert tone="danger" role="alert">{assignmentError}</Alert> : null}
      </form>
    </Dialog>

    <Dialog
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      eyebrow="Producción"
      title="Filtrar trabajos"
      size="md"
      footer={<>
        {activeFilterCount ? <Button variant="ghost" icon={RotateCcw} onClick={clearFilters} className="mr-auto">Limpiar todo</Button> : null}
        <Button onClick={() => setFiltersOpen(false)}>Ver {filteredJobs.length === 1 ? '1 trabajo' : `${filteredJobs.length} trabajos`}</Button>
      </>}
    >
      <OperationalFilters embedded showClear={false} query={customerFilter} onQueryChange={setCustomerFilter} showQuery={canAssignProduction} status={statusFilter} onStatusChange={setStatusFilter} statusOptions={productionStatusOptions} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClear={clearFilters} resultCount={filteredJobs.length} />
    </Dialog>

    <Dialog
      open={Boolean(incidentJob)}
      onClose={() => { if (!pending) setIncidentJob(null) }}
      eyebrow={incidentJob ? `${incidentJob.orderNumber} · ${incidentJob.jobType === 'lens' ? 'Cristales' : 'Montaje'}` : undefined}
      title="Registrar incidencia"
      icon={TriangleAlert}
      tone="danger"
      size="md"
      footer={<>
        <Button variant="ghost" onClick={() => setIncidentJob(null)} disabled={pending}>Cancelar</Button>
        <Button type="submit" form="production-incident" variant="attention" icon={TriangleAlert} disabled={pending}>{pending ? 'Registrando…' : 'Registrar incidencia'}</Button>
      </>}
    >
      <form id="production-incident" onSubmit={reportIncident} className="flex flex-col gap-4" noValidate>
        <Field label="Descripción"><Textarea name="description" minLength={5} maxLength={1000} required rows={4} placeholder="Describe qué ocurrió y cualquier detalle útil…" /></Field>
        <Field label="Responsable del costo"><FormSelect ariaLabel="Responsable del costo" menuPlacement="top" value={incidentResponsibility} onValueChange={(value) => setIncidentResponsibility(value as IncidentResponsibility)} options={Object.entries(responsibilityLabels).map(([value, label]) => ({ value, label }))} /></Field>
        {incidentError ? <Alert tone="danger" role="alert">{incidentError}</Alert> : null}
      </form>
    </Dialog>
  </div>
}
