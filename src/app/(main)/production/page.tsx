import { redirect } from 'next/navigation'
import { ProductionWorkspace, type AssignmentOrder, type ProductionJob, type Provider } from '@/features/production/components'
import { createClient } from '@/lib/supabase/server'

export default async function ProductionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [{ data: jobData }, { data: orderData }, { data: membershipData }] = await Promise.all([
    supabase.rpc('list_accessible_production_jobs'),
    supabase.from('orders').select('id, organization_id, order_number').order('created_at', { ascending: false }),
    supabase.from('organization_memberships').select('organization_id, user_id, role').in('role', ['lens_provider', 'mounting_provider']).eq('status', 'active'),
  ])
  const memberships = (membershipData ?? []) as { organization_id: number; user_id: string; role: 'lens_provider' | 'mounting_provider' }[]
  const providerIds = [...new Set(memberships.map((membership) => membership.user_id))]
  const { data: profileData } = providerIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', providerIds) : { data: [] }
  const profiles = (profileData ?? []) as { user_id: string; display_name: string }[]
  const providers: Provider[] = memberships.map((membership) => ({ id: membership.user_id, organizationId: membership.organization_id, role: membership.role, name: profiles.find((profile) => profile.user_id === membership.user_id)?.display_name ?? 'Proveedor' }))
  const orders: AssignmentOrder[] = ((orderData ?? []) as { id: number; organization_id: number; order_number: string }[]).map((order) => ({ id: order.id, organizationId: order.organization_id, orderNumber: order.order_number }))
  return <section className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Taller y proveedores</p><h1 className="mt-2 font-display text-3xl font-bold text-[#07322F]">Producción</h1><p className="mb-6 mt-2 text-sm text-[#74857F]">Cada proveedor ve únicamente los trabajos asignados, sin precios ni pagos.</p><ProductionWorkspace initialJobs={(jobData ?? []) as unknown as ProductionJob[]} orders={orders} providers={providers} /></section>
}
