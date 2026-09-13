import { redirect } from 'next/navigation'
import { CashboxWorkspace, type Cashbox } from '@/features/cashbox/components'
import { createClient } from '@/lib/supabase/server'

export default async function CashboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase.rpc('list_accessible_cashboxes', { target_branch_id: null, target_business_date: null, target_seller_id: null } as never)
  const cashboxes = error ? [] : data as unknown as Cashbox[]
  return <section className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Control de efectivo</p><h1 className="mt-2 font-display text-3xl font-bold text-[#07322F]">Caja y cierres</h1><p className="mb-6 mt-2 text-sm text-[#74857F]">Revisa cobros por vendedor, sucursal y moneda sin perder los movimientos posteriores al cierre.</p><CashboxWorkspace initialCashboxes={cashboxes} currentUserId={user.id} /></section>
}
