import { redirect } from 'next/navigation'
import { OrderPaymentsWorkspace } from '@/features/orders/components'
import type { Order } from '@/features/orders/types'
import { FINISHED_ORDERS_DAYS } from '@/features/orders/format'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'
import { PageContainer } from '@/shared/ui'
import { daysAgoIn } from '@/shared/utils/dates'

export default async function OrdersPage({ searchParams }: PageProps<'/orders'>) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const query = await searchParams
  const customerFilter = typeof query.cliente === 'string' ? query.cliente : ''
  const parsedCustomerId = typeof query.clienteId === 'string' ? Number(query.clienteId) : Number.NaN
  const customerId = Number.isSafeInteger(parsedCustomerId) && parsedCustomerId > 0 ? parsedCustomerId : undefined
  const fullHistory = Boolean(customerId || customerFilter)
  const { data, error } = fullHistory
    ? await supabase.rpc('list_accessible_orders')
    : await supabase.rpc('list_accessible_orders', { finished_since: daysAgoIn(FINISHED_ORDERS_DAYS) } as never)
  const orders = error ? [] : data as unknown as Order[]
  return (
    <PageContainer>
      <OrderPaymentsWorkspace initialOrders={orders} initialCustomerFilter={customerFilter} initialCustomerId={customerId} />
    </PageContainer>
  )
}
