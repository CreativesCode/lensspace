import { redirect } from 'next/navigation'
import { OrderPaymentsWorkspace } from '@/features/orders/components'
import type { Order } from '@/features/orders/types'
import { createClient } from '@/lib/supabase/server'
import { PageContainer } from '@/shared/ui'

export default async function OrdersPage({ searchParams }: PageProps<'/orders'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const query = await searchParams
  const customerFilter = typeof query.cliente === 'string' ? query.cliente : ''
  const parsedCustomerId = typeof query.clienteId === 'string' ? Number(query.clienteId) : Number.NaN
  const customerId = Number.isSafeInteger(parsedCustomerId) && parsedCustomerId > 0 ? parsedCustomerId : undefined
  const { data, error } = await supabase.rpc('list_accessible_orders')
  const orders = error ? [] : data as unknown as Order[]
  return (
    <PageContainer>
      <OrderPaymentsWorkspace initialOrders={orders} initialCustomerFilter={customerFilter} initialCustomerId={customerId} />
    </PageContainer>
  )
}
