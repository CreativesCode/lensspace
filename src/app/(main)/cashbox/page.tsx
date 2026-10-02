import { getCurrentUser } from '@/lib/supabase/current-user'
import { redirect } from 'next/navigation'
import { CashboxWorkspace, type Cashbox } from '@/features/cashbox/components'
import { createClient } from '@/lib/supabase/server'
import { PageContainer } from '@/shared/ui'

export default async function CashboxPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase.rpc('list_accessible_cashboxes', { target_branch_id: null, target_business_date: null, target_seller_id: null } as never)
  const cashboxes = error ? [] : data as unknown as Cashbox[]
  return <PageContainer><CashboxWorkspace initialCashboxes={cashboxes} currentUserId={user.id} /></PageContainer>
}
