import { getCurrentUser } from '@/lib/supabase/current-user'
import { redirect } from 'next/navigation'

import { CustomerWorkspace } from '@/features/customers/components'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/supabase/database.types'
import { PageContainer, PageHeader } from '@/shared/ui'

export default async function CustomersPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { data: membershipData } = await supabase
    .from('organization_memberships')
    .select('organization_id, branch_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .in('role', ['owner', 'seller'])

  const memberships = (membershipData ?? []) as Pick<
    Tables<'organization_memberships'>,
    'organization_id' | 'branch_id' | 'role'
  >[]
  const organizationIds = [...new Set(memberships.map(({ organization_id }) => organization_id))]

  const [{ data: organizationData }, { data: branchData }] = organizationIds.length
    ? await Promise.all([
        supabase.from('organizations').select('id, name').in('id', organizationIds),
        supabase.from('branches').select('id, organization_id, name').in('organization_id', organizationIds).eq('is_active', true),
      ])
    : [{ data: [] }, { data: [] }]

  const organizations = (organizationData ?? []) as Pick<Tables<'organizations'>, 'id' | 'name'>[]
  const branches = (branchData ?? []) as Pick<Tables<'branches'>, 'id' | 'organization_id' | 'name'>[]
  const writable = new Map<number, boolean>()
  await Promise.all(
    organizationIds.map(async (organizationId) => {
      const { data } = await supabase.rpc('current_user_can_operate_organization', {
        target_organization_id: organizationId,
        required_module_key: 'optical_sales',
      } as never)
      writable.set(organizationId, Boolean(data))
    }),
  )

  const scopes = memberships.flatMap((membership) => {
    const organization = organizations.find(({ id }) => id === membership.organization_id)
    const availableBranches = membership.role === 'owner'
      ? branches.filter(({ organization_id }) => organization_id === membership.organization_id)
      : branches.filter(({ id }) => id === membership.branch_id)

    return availableBranches.map((branch) => ({
      organizationId: membership.organization_id,
      organizationName: organization?.name ?? 'Organización',
      branchId: branch.id,
      branchName: branch.name,
      canWrite: writable.get(membership.organization_id) ?? false,
    }))
  })

  const uniqueScopes = [...new Map(scopes.map((scope) => [`${scope.organizationId}:${scope.branchId}`, scope])).values()]

  return (
    <PageContainer>
      <PageHeader eyebrow="Ventas ópticas" title="Clientes" description="Busca por nombre o teléfono, reutiliza fichas existentes y registra nuevos clientes." />
      <CustomerWorkspace scopes={uniqueScopes} />
    </PageContainer>
  )
}
