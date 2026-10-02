import { isFinished } from './order-status'
import type { Order } from './types'

// Shared by the orders header and the dashboard so both show the same figures.
// Inputs come from list_accessible_orders, so RLS already scopes them per role.
export function orderKpis(orders: Pick<Order, 'commercialStatus' | 'balanceCup' | 'paidTodayCup'>[]) {
  const active = orders.filter((order) => !isFinished(order))
  return {
    activeCount: active.length,
    balanceDue: active.reduce((sum, order) => sum + Number(order.balanceCup), 0),
    readyToDeliver: active.filter((order) => order.balanceCup <= 0).length,
    withBalance: active.filter((order) => order.balanceCup > 0).length,
    collectedToday: orders.reduce((sum, order) => sum + Number(order.paidTodayCup), 0),
  }
}
