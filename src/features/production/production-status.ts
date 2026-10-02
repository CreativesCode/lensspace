import type { Tone } from '@/shared/ui'

export const statusLabels: Record<string, string> = {
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

// Business status → Badge tone (guide: neutral, progress, success, warning, danger).
const statusTones: Record<string, Tone> = {
  pending: 'neutral',
  ready_to_send: 'progress',
  dispatched: 'progress',
  in_production: 'progress',
  in_mounting: 'progress',
  completed: 'success',
  received: 'success',
  reviewed: 'neutral',
  incident: 'danger',
}

export const statusTone = (status: string): Tone => statusTones[status] ?? 'neutral'

export const responsibilityLabels: Record<string, string> = {
  organization: 'Óptica / organización',
  lens_provider: 'Cristalero / laboratorio',
  mounting_provider: 'Montador',
  customer: 'Cliente',
}

export function productionStatusLabel(status: string, jobType?: 'lens' | 'mounting') {
  if (status === 'pending' && jobType) return `Pendiente de iniciar · ${jobType === 'lens' ? 'Cristalero' : 'Montador'}`
  if (status === 'completed' && jobType) return `${jobType === 'lens' ? 'Cristales' : 'Montaje'} listo · ${jobType === 'lens' ? 'Cristalero' : 'Montador'}`
  return statusLabels[status] ?? status
}
