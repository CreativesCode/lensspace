import { redirect } from 'next/navigation'
import { SalesWorkspace } from '@/features/sales/components'
import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { PageContainer, PageHeader } from '@/shared/ui'

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawMemberships } = await supabase.from('organization_memberships').select('organization_id, branch_id, role').eq('user_id', user.id).eq('status', 'active').in('role', ['owner', 'seller'])
  const memberships = (rawMemberships ?? []) as Pick<Tables<'organization_memberships'>, 'organization_id' | 'branch_id' | 'role'>[]
  const organizationIds = [...new Set(memberships.map((entry) => entry.organization_id))]
  const empty = Promise.resolve({ data: [] })
  const [{ data: organizationData }, { data: branchData }, { data: itemData }, { data: overrideData }] = await Promise.all([
    organizationIds.length ? supabase.from('organizations').select('id, name').in('id', organizationIds) : empty,
    organizationIds.length ? supabase.from('branches').select('id, organization_id, name').in('organization_id', organizationIds).eq('is_active', true) : empty,
    organizationIds.length ? supabase.from('catalog_items').select('id, organization_id, category, name, sale_price, currency').eq('is_active', true).order('category').order('name') : empty,
    organizationIds.length ? supabase.from('catalog_item_overrides').select('organization_id, catalog_item_id, sale_price, currency, is_enabled').in('organization_id', organizationIds) : empty,
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
  // Only the latest customers; the picker searches the rest on demand and loads
  // prescriptions for the selected customer (QA-12).
  const { data: customerData } = branchIds.length
    ? await supabase.from('customers').select('id, organization_id, branch_id, full_name').in('branch_id', branchIds).is('archived_at', null).order('updated_at', { ascending: false }).limit(10)
    : { data: [] }
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
  type ItemRow = { id: number; organization_id: number | null; category: string; name: string; sale_price: number; currency: string }
  type OverrideRow = { organization_id: number; catalog_item_id: number; sale_price: number | null; currency: string | null; is_enabled: boolean | null }
  const overrides = (overrideData ?? []) as unknown as OverrideRow[]
  // Base items are priced per organization (same rule as calculate_catalog_price):
  // apply each óptica's override and drop the items it disabled.
  const items = ((itemData ?? []) as unknown as ItemRow[]).flatMap((entry) => (entry.organization_id === null ? organizationIds : [entry.organization_id]).flatMap((organizationId) => {
    const override = overrides.find((row) => row.organization_id === organizationId && row.catalog_item_id === entry.id)
    if (override?.is_enabled === false) return []
    return [{ id: entry.id, organizationId, name: entry.name, category: entry.category, price: Number(override?.sale_price ?? entry.sale_price), currency: override?.currency ?? entry.currency }]
  }))
  return <PageContainer>
    <PageHeader eyebrow="Ventas ópticas" title="Nueva venta" description="Cliente, receta, configuración y aceptación en un flujo trazable." />
    <SalesWorkspace organizations={organizations}
      recentCustomers={((customerData ?? []) as unknown as CustomerRow[]).map((entry) => ({ id: entry.id, organizationId: entry.organization_id, branchId: entry.branch_id, name: entry.full_name }))}
      items={items} />
  </PageContainer>
}
