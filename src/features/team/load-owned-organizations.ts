import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function loadOwnedOrganizations(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: ownerMembershipData } = await supabase.from('organization_memberships').select('organization_id').eq('user_id', user.id).eq('role', 'owner').eq('status', 'active')
  const ownerMemberships = (ownerMembershipData ?? []) as Pick<Tables<'organization_memberships'>, 'organization_id'>[]
  const organizationIds = ownerMemberships.map(({ organization_id }) => organization_id)
  if (!organizationIds.length) return []

  const [{ data: organizationData }, { data: branchData }, { data: membershipData }, { data: analyticsData }] = await Promise.all([
    supabase.from('organizations').select('id, name').in('id', organizationIds),
    supabase.from('branches').select('id, organization_id, name').in('organization_id', organizationIds).eq('is_active', true),
    supabase.from('organization_memberships').select('id, organization_id, user_id, branch_id, role, status').in('organization_id', organizationIds),
    supabase.from('organization_modules').select('organization_id').in('organization_id', organizationIds).eq('module_key', 'analytics').eq('is_enabled', true),
  ])

  const memberships = (membershipData ?? []) as Pick<Tables<'organization_memberships'>, 'id' | 'organization_id' | 'user_id' | 'branch_id' | 'role' | 'status'>[]
  const memberIds = [...new Set(memberships.map(({ user_id }) => user_id))]
  const { data: profileData } = memberIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', memberIds) : { data: [] }
  const organizations = (organizationData ?? []) as Pick<Tables<'organizations'>, 'id' | 'name'>[]
  const branches = (branchData ?? []) as Pick<Tables<'branches'>, 'id' | 'organization_id' | 'name'>[]
  const profiles = (profileData ?? []) as Pick<Tables<'profiles'>, 'user_id' | 'display_name'>[]
  const analytics = (analyticsData ?? []) as Pick<Tables<'organization_modules'>, 'organization_id'>[]

  return Promise.all(organizations.map(async (organization) => {
    const { data: canManage } = await supabase.rpc('current_user_can_manage_organization', { target_organization_id: organization.id } as never)
    return {
      ...organization,
      analyticsEnabled: analytics.some((entry) => entry.organization_id === organization.id),
      canManage: Boolean(canManage),
      branches: branches.filter((branch) => branch.organization_id === organization.id).map(({ id, name }) => ({ id, name })),
      members: memberships.filter((membership) => membership.organization_id === organization.id).map((membership) => ({
        id: membership.id, userId: membership.user_id,
        displayName: profiles.find((profile) => profile.user_id === membership.user_id)?.display_name ?? 'Usuario',
        role: membership.role, status: membership.status, branchId: membership.branch_id,
        branchName: branches.find((branch) => branch.id === membership.branch_id)?.name ?? null,
      })),
    }
  }))
}
