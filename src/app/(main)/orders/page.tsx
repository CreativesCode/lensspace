import { redirect } from 'next/navigation'
import { OrderPaymentsWorkspace } from '@/features/orders/components'
import { createClient } from '@/lib/supabase/server'

type Order = { id: number; orderNumber: string; customerName: string; commercialStatus: string; paymentStatus: string; totalCup: number; createdAt: string }

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase.rpc('list_accessible_orders')
  const orders = error ? [] : data as unknown as Order[]
  return <section className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Operación comercial</p><h1 className="mt-2 font-display text-3xl font-bold text-[#07322F]">Pedidos y cobros</h1><p className="mb-6 mt-2 text-sm text-[#74857F]">Registra efectivo, controla el saldo y entrega solo cuando el pedido esté pagado.</p><OrderPaymentsWorkspace initialOrders={orders} /></section>
}
