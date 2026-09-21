import { redirect } from 'next/navigation'
import { SalesWorkspace } from '@/features/sales/components'
import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawMemberships } = await supabase.from('organization_memberships').select('organization_id, branch_id, role').eq('user_id', user.id).eq('status', 'active').in('role', ['owner', 'seller'])
  const memberships = (rawMemberships ?? []) as Pick<Tables<'organization_memberships'>, 'organization_id' | 'branch_id' | 'role'>[]
  const organizationIds = [...new Set(memberships.map((entry) => entry.organization_id))]
  const empty = Promise.resolve({ data: [] })
  const [{ data: organizationData }, { data: branchData }, { data: itemData }] = await Promise.all([
    organizationIds.length ? supabase.from('organizations').select('id, name').in('id', organizationIds) : empty,
    organizationIds.length ? supabase.from('branches').select('id, organization_id, name').in('organization_id', organizationIds).eq('is_active', true) : empty,
    organizationIds.length ? supabase.from('catalog_items').select('id, organization_id, category, name, sale_price, currency').eq('is_active', true).order('category').order('name') : empty,
  ])
  const organizationRows = (organizationData ?? []) as unknown as { id: number; name: string }[]
  const branchRows = (branchData ?? []) as unknown as { id: number; organization_id: number; name: string }[]
  const scopes = memberships.flatMap((membership) => {
    const availableBranches = membership.role === 'owner'
      ? branchRows.filter((branch) => branch.organization_id === membership.organization_id)
      : branchRows.filter((branch) => branch.id === membership.branch_id)
    return availableBranches.map((branch) => ({ organizationId: membership.organization_id, branch }))
  })
  const uniqueScopes = [...new Map(scopes.map((scope) => [`${scope.organizationId}:${scope.branch.id}`, scope])).values()]
  const branchIds = uniqueScopes.map(({ branch }) => branch.id)
  const [{ data: customerData }, { data: revisionData }] = branchIds.length
    ? await Promise.all([
        supabase.from('customers').select('id, organization_id, branch_id, full_name').in('branch_id', branchIds).is('archived_at', null).order('full_name').limit(200),
        supabase.from('prescription_revisions').select('id, organization_id, branch_id, prescription_id, prescription_date, prescriptions(customer_id)').in('branch_id', branchIds).order('created_at', { ascending: false }).limit(200),
      ])
    : [{ data: [] }, { data: [] }]
  const operability = new Map<number, boolean>()
  await Promise.all(organizationIds.map(async (organizationId) => {
    const { data } = await supabase.rpc('current_user_can_operate_organization', { target_organization_id: organizationId, required_module_key: 'optical_sales' } as never)
    operability.set(organizationId, Boolean(data))
  }))
  const organizations = uniqueScopes.map(({ organizationId, branch }) => ({
    id: organizationId,
    name: organizationRows.find((entry) => entry.id === organizationId)?.name ?? 'Organización',
    branchId: branch.id,
    branchName: branch.name,
    canOperate: operability.get(organizationId) ?? false,
    canApproveLargeDiscount: memberships.some((entry) => entry.organization_id === organizationId && entry.role === 'owner'),
  }))
  type CustomerRow = { id: number; organization_id: number; branch_id: number; full_name: string }
  type RevisionRow = { id: number; organization_id: number; branch_id: number; prescription_id: number; prescription_date: string; prescriptions: { customer_id: number } | null }
  type ItemRow = { id: number; organization_id: number | null; category: string; name: string; sale_price: number; currency: string }
  return <section className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Ventas ópticas</p><h1 className="mt-2 font-display text-3xl font-bold text-[#07322F]">Nueva venta · cotización</h1><p className="mb-6 mt-2 text-sm text-[#74857F]">Cliente, receta, configuración y aceptación en un flujo trazable.</p>
    <SalesWorkspace organizations={organizations}
      customers={((customerData ?? []) as unknown as CustomerRow[]).map((entry) => ({ id: entry.id, organizationId: entry.organization_id, branchId: entry.branch_id, name: entry.full_name }))}
      revisions={((revisionData ?? []) as unknown as RevisionRow[]).map((entry) => ({ id: entry.id, organizationId: entry.organization_id, branchId: entry.branch_id, customerId: entry.prescriptions?.customer_id ?? 0, label: `Receta #${entry.prescription_id} · ${entry.prescription_date}` }))}
      items={((itemData ?? []) as unknown as ItemRow[]).map((entry) => ({ id: entry.id, organizationId: entry.organization_id, name: entry.name, category: entry.category, price: Number(entry.sale_price), currency: entry.currency }))} />
  </section>
}
