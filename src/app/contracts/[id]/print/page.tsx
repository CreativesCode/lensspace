import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { ContractPrintView } from '@/features/admin/components/ContractPrintView'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'
import { BUSINESS_TIME_ZONE } from '@/shared/utils/dates'

export const metadata: Metadata = { title: 'Contrato de licencia', robots: { index: false, follow: false, nocache: true } }
const today = new Intl.DateTimeFormat('es-CU', { timeZone: BUSINESS_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' })

// Platform admin only: RLS hides contracts and provider data from everyone else.
export default async function ContractPrintPage({ params }: PageProps<'/contracts/[id]/print'>) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=/contracts/${id}/print`)
  const supabase = await createClient()
  const { data: isPlatformAdmin } = await supabase.rpc('current_user_is_platform_admin')
  if (!isPlatformAdmin) redirect('/dashboard')
  const contractId = Number(id)
  if (!Number.isSafeInteger(contractId)) notFound()
  const [{ data: contract }, { data: provider }] = await Promise.all([
    supabase.from('license_contracts').select('*').eq('id', contractId).maybeSingle(),
    supabase.from('platform_provider_profile').select('*').maybeSingle(),
  ])
  if (!contract) notFound()
  return <ContractPrintView contract={contract} provider={provider} today={today.format(new Date())} />
}
