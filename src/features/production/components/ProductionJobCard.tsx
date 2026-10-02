'use client'

import { ChevronDown, RefreshCcw, TriangleAlert } from 'lucide-react'

import { Badge, Button, Card } from '@/shared/ui'

import { productionStatusLabel, responsibilityLabels, statusTone } from '../production-status'
import type { PrescriptionSnapshot, ProductionJob } from './ProductionWorkspace'

type ProductionJobCardProps = {
  job: ProductionJob
  showCustomer: boolean
  transitionLabel?: string
  pending: boolean
  onTransition: () => void
  onReportIncident: () => void
  onCreateRework: (incidentId: number) => void
}

export function ProductionJobCard({ job, showCustomer, transitionLabel, pending, onTransition, onReportIncident, onCreateRework }: ProductionJobCardProps) {
  const hasIncident = job.status === 'incident'
  return (
    <Card tone={hasIncident ? 'danger' : 'default'} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <strong className="font-display text-[15px] text-ink">{job.orderNumber}</strong>
        <Badge tone={statusTone(job.status)}>{productionStatusLabel(job.status, job.jobType)}</Badge>
      </div>
      <div>
        {showCustomer && job.customerName ? <p className="text-[15px] font-semibold text-ink">{job.customerName}</p> : null}
        <p className="mt-0.5 text-[13px] text-text-muted">{job.jobType === 'lens' ? 'Cristales' : 'Montaje'} · {job.providerName} · {new Date(job.assignedAt).toLocaleDateString('es-CU')}</p>
      </div>
      <p className="text-sm leading-6 text-[#4A5B58]">{job.snapshot.items?.map((item) => item.name).join(' · ') || 'Configuración preservada en la asignación.'}</p>
      <PrescriptionDetails prescription={job.snapshot.prescription} />
      {job.incidents.map((incident) => (
        <div key={incident.id} className="flex flex-col gap-2 rounded-[12px] border border-[#FFD9CD] bg-[#FFF6F2] px-4 py-3 text-sm text-[#7A3A26]">
          <p className="flex gap-2"><TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-coral-ink" />{incident.description}</p>
          <p className="font-semibold">Costo: {responsibilityLabels[incident.costResponsibility] ?? incident.costResponsibility}</p>
          {!incident.reworkJobId ? (
            <div><Button variant="attention" size="sm" icon={RefreshCcw} disabled={pending} onClick={() => onCreateRework(incident.id)}>Aceptar repetición</Button></div>
          ) : <p>Repetición vinculada</p>}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-2 pt-1 sm:flex-row">
        {transitionLabel ? <Button disabled={pending} onClick={onTransition} className="sm:flex-1">{transitionLabel}</Button> : null}
        {!hasIncident ? <Button variant="danger" icon={TriangleAlert} disabled={pending} onClick={onReportIncident}>Incidencia</Button> : null}
      </div>
    </Card>
  )
}

const prismBaseLabels: Record<string, string> = { up: 'Arriba', down: 'Abajo', in: 'Interna', out: 'Externa' }
const prescriptionValue = (value: number | null | undefined, suffix = '') => value === null || value === undefined ? '—' : `${Number(value).toLocaleString('es-CU', { maximumFractionDigits: 2 })}${suffix}`

// One block per eye (3 columns on mobile) instead of a wide table.
function PrescriptionDetails({ prescription }: { prescription?: PrescriptionSnapshot | null }) {
  if (!prescription) return <p className="rounded-control border border-dashed border-line px-3 py-2.5 text-[13px] text-text-muted">Este trabajo no tiene una receta asociada.</p>
  const eyes = [
    { label: 'OD', values: [['Esfera', prescriptionValue(prescription.right_sphere)], ['Cilindro', prescriptionValue(prescription.right_cylinder)], ['Eje', prescriptionValue(prescription.right_axis, '°')], ['Adición', prescriptionValue(prescription.right_addition)], ['DP', prescriptionValue(prescription.right_pupillary_distance, ' mm')], ['Altura', prescriptionValue(prescription.right_height, ' mm')]] },
    { label: 'OI', values: [['Esfera', prescriptionValue(prescription.left_sphere)], ['Cilindro', prescriptionValue(prescription.left_cylinder)], ['Eje', prescriptionValue(prescription.left_axis, '°')], ['Adición', prescriptionValue(prescription.left_addition)], ['DP', prescriptionValue(prescription.left_pupillary_distance, ' mm')], ['Altura', prescriptionValue(prescription.left_height, ' mm')]] },
  ]
  return (
    <details className="group rounded-control border border-[#B9DFD9] bg-[#F7FDFC]">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3.5 text-sm font-semibold text-action">
        Ver receta de fabricación
        <ChevronDown aria-hidden="true" size={16} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-3.5 py-3">
        {eyes.map((eye) => (
          <div key={eye.label}>
            <p className="mb-1.5 font-display text-xs font-bold text-ink">{eye.label}</p>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 md:grid-cols-6">
              {eye.values.map(([label, value]) => <div key={label}><dt className="text-[12px] text-text-muted">{label}</dt><dd className="font-display text-sm font-semibold tabular-nums text-ink">{value}</dd></div>)}
            </dl>
          </div>
        ))}
        <div className="grid gap-1.5 border-t border-line pt-3 text-[13px] text-[#4A5B58] sm:grid-cols-2">
          <p><strong className="text-ink">DP conjunta:</strong> {prescriptionValue(prescription.pupillary_distance_total, ' mm')}</p>
          <p><strong className="text-ink">Fecha:</strong> {prescription.prescription_date ?? '—'}</p>
          <p><strong className="text-ink">Prisma OD:</strong> {prescriptionValue(prescription.right_prism)} {prescription.right_prism_base ? `· ${prismBaseLabels[prescription.right_prism_base] ?? prescription.right_prism_base}` : ''}</p>
          <p><strong className="text-ink">Prisma OI:</strong> {prescriptionValue(prescription.left_prism)} {prescription.left_prism_base ? `· ${prismBaseLabels[prescription.left_prism_base] ?? prescription.left_prism_base}` : ''}</p>
          {prescription.prescriber_name ? <p className="sm:col-span-2"><strong className="text-ink">Médico u optometrista:</strong> {prescription.prescriber_name}</p> : null}
        </div>
      </div>
    </details>
  )
}
