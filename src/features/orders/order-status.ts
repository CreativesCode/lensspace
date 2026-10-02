import type { Tone } from '@/shared/ui'

import type { Order } from './types'

export const isFinished = (order: Pick<Order, 'commercialStatus'>) => ['delivered', 'closed'].includes(order.commercialStatus)

// Overall inbox status, highest priority first (docs/design/Pedidos y cobros v2.dc.html):
// delivered/closed → incident → paid → partial → pending payment.
export function orderStatus(order: Pick<Order, 'commercialStatus' | 'paymentStatus' | 'balanceCup' | 'hasOpenIncident'>): { tone: Tone; label: string } {
  if (order.commercialStatus === 'delivered') return { tone: 'neutral', label: 'Entregado' }
  if (order.commercialStatus === 'closed') return { tone: 'neutral', label: 'Cerrado' }
  if (order.hasOpenIncident) return { tone: 'danger', label: 'Incidencia' }
  if (order.balanceCup <= 0) return { tone: 'success', label: 'Pagado · por entregar' }
  if (order.paymentStatus === 'partial') return { tone: 'warning', label: 'Pago parcial' }
  return { tone: 'progress', label: 'Pendiente de pago' }
}

export const paymentStatusLabels: Record<string, string> = { unpaid: 'Sin pagos todavía', partial: 'Pago parcial', paid: 'Pagado completamente' }

const timelineKinds: Record<string, { tag: string; tone: Tone }> = {
  order_created: { tag: 'Venta', tone: 'neutral' },
  confirmation: { tag: 'Venta', tone: 'neutral' },
  payment: { tag: 'Pago', tone: 'success' },
  production: { tag: 'Producción', tone: 'progress' },
  incident: { tag: 'Incidencia', tone: 'danger' },
  notification: { tag: 'WhatsApp', tone: 'progress' },
  delivery: { tag: 'Entrega', tone: 'neutral' },
}

export const timelineKind = (kind: string) => timelineKinds[kind] ?? { tag: 'Evento', tone: 'neutral' as Tone }
