import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'

import type { PlatformOrganization } from './components/PlatformAdminWorkspace'

type Client = Awaited<ReturnType<typeof createClient>>

export async function loadPlatformOrganizations(supabase: Client): Promise<PlatformOrganization[]> {
  const [{ data: organizations }, { data: branches }, { data: subscriptions }, { data: entitlements }, { data: owners }, { data: usage }, { data: support }] = await Promise.all([
    supabase.from('organizations').select('id, name, order_prefix, status, created_at').order('created_at', { ascending: false }),
    supabase.from('branches').select('id, organization_id, name, is_active'),
    supabase.from('subscriptions').select('organization_id, status, expires_on, starts_on, amount, currency, billing_period'),
    supabase.from('organization_modules').select('organization_id, module_key, is_enabled'),
    supabase.from('organization_memberships').select('organization_id, user_id').eq('role', 'owner').eq('status', 'active'),
    supabase.rpc('get_platform_usage'),
    supabase.from('platform_support_sessions').select('id, organization_id, reason, started_at, expires_at').is('ended_at', null).gt('expires_at', new Date().toISOString()),
  ])
  const ownerRows = (owners ?? []) as Pick<Tables<'organization_memberships'>, 'organization_id' | 'user_id'>[]
  const ownerIds = [...new Set(ownerRows.map(({ user_id }) => user_id))]
  const { data: profiles } = ownerIds.length ? await supabase.from('profiles').select('user_id, display_name').in('user_id', ownerIds) : { data: [] }
  const profileRows = (profiles ?? []) as Pick<Tables<'profiles'>, 'user_id' | 'display_name'>[]
  const usageRows = (usage ?? []) as unknown as NonNullable<PlatformOrganization['usage'] & { organizationId: number }>[]
  const supportRows = (support ?? []) as NonNullable<PlatformOrganization['supportSession'] & { organization_id: number }>[]

  return ((organizations ?? []) as Pick<Tables<'organizations'>, 'id' | 'name' | 'order_prefix' | 'status'>[]).map((organization) => ({
    ...organization,
    branches: ((branches ?? []) as Pick<Tables<'branches'>, 'id' | 'organization_id' | 'name' | 'is_active'>[]).filter((row) => row.organization_id === organization.id).map(({ id, name, is_active }) => ({ id, name, is_active })),
    subscription: ((subscriptions ?? []) as Pick<Tables<'subscriptions'>, 'organization_id' | 'status' | 'amount' | 'currency' | 'billing_period' | 'starts_on' | 'expires_on'>[]).find((row) => row.organization_id === organization.id),
    modules: ((entitlements ?? []) as Pick<Tables<'organization_modules'>, 'organization_id' | 'module_key' | 'is_enabled'>[]).filter((row) => row.organization_id === organization.id),
    owners: ownerRows.filter((row) => row.organization_id === organization.id).map((row) => profileRows.find((profile) => profile.user_id === row.user_id)).filter((profile): profile is NonNullable<typeof profile> => Boolean(profile)).map(({ display_name }) => ({ display_name })),
    usage: usageRows.find((row) => row.organizationId === organization.id),
    supportSession: supportRows.find((row) => row.organization_id === organization.id),
  }))
}
