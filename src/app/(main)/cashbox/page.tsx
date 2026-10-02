import { redirect } from 'next/navigation'
import { CashboxWorkspace, type Cashbox } from '@/features/cashbox/components'
import { createClient } from '@/lib/supabase/server'
import { PageContainer, PageHeader } from '@/shared/ui'

export default async function CashboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase.rpc('list_accessible_cashboxes', { target_branch_id: null, target_business_date: null, target_seller_id: null } as never)
  const cashboxes = error ? [] : data as unknown as Cashbox[]
  return <PageContainer><PageHeader variant="featured" eyebrow="Control de efectivo" title="Caja y cierres" description="Revisa cobros por vendedor, sucursal y moneda sin perder los movimientos posteriores al cierre." /><CashboxWorkspace initialCashboxes={cashboxes} currentUserId={user.id} /></PageContainer>
}
