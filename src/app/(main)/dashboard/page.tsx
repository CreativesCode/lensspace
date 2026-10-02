import { Building, Factory, Plus } from 'lucide-react'

import { PlatformAdminDashboard } from '@/features/admin/components'
import { OwnerAnalyticsDashboard } from '@/features/analytics/components'
import { MemberAccessCard, OwnerAccessCard } from '@/features/dashboard/components/AccessCards'
import { formatAmount } from '@/features/orders/format'
import { orderKpis } from '@/features/orders/order-kpis'
import type { Order } from '@/features/orders/types'
import { loadOwnedOrganizations } from '@/features/team/load-owned-organizations'
import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { ButtonLink, EmptyState, PageContainer, PageHeader, StatCard } from '@/shared/ui'

export default async function DashboardPage() {
  const defaultTo = new Date().toISOString().slice(0, 10)
  const fromDate = new Date()
  fromDate.setUTCDate(fromDate.getUTCDate() - 29)
  const defaultFrom = fromDate.toISOString().slice(0, 10)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: isPlatformAdmin }, { data: profile }] = await Promise.all([
    supabase.rpc('current_user_is_platform_admin'),
    user ? supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const displayName = (profile as Pick<Tables<'profiles'>, 'display_name'> | null)?.display_name ?? user?.email?.split('@')[0] ?? ''
  const greeting = `${greetingFor(new Date())}, ${displayName.split(' ')[0]}`

  if (isPlatformAdmin) {
    const organizations = await loadOrganizations(supabase)
    return (
      <PageContainer>
        <PageHeader
          variant="featured"
          eyebrow={`Plataforma LensSpace · ${todayLabel()}`}
          title={greeting}
          description="Panorama operativo y crecimiento de LensSpace."
          actions={<ButtonLink href="/organizations" variant="mint" icon={Building}>Ver organizaciones</ButtonLink>}
        />
        <PlatformAdminDashboard organizations={organizations} />
      </PageContainer>
    )
  }

  const ownedOrganizations = await loadOwnedOrganizations(supabase)
  const memberAccess = ownedOrganizations.length ? [] : await loadMemberAccess(supabase)
  const ownedModules = ownedOrganizations.length ? await loadEnabledModules(supabase, ownedOrganizations.map(({ id }) => id)) : []
  const canSell = ownedModules.includes('optical_sales') || memberAccess.some((access) => access.roles.includes('seller') && access.modules.includes('optical_sales'))
  const hasCashbox = ownedModules.includes('cashbox') || memberAccess.some((access) => access.roles.includes('seller') && access.modules.includes('cashbox'))
  const isProvider = memberAccess.some((access) => access.roles.some((role) => role === 'lens_provider' || role === 'mounting_provider') && access.modules.includes('production'))
  const organizationNames = [...ownedOrganizations, ...memberAccess].map(({ name }) => name)
  const scope = organizationNames.length === 1 ? organizationNames[0] : organizationNames.length > 1 ? `${organizationNames.length} organizaciones` : 'LensSpace'

  const { data: orderData } = canSell ? await supabase.rpc('list_accessible_orders') : { data: null }
  const kpis = canSell ? orderKpis((orderData ?? []) as unknown as Order[]) : null
  const description = kpis
    ? `${plural(kpis.readyToDeliver, 'pedido pagado listo', 'pedidos pagados listos')} para entregar y ${kpis.withBalance} con saldo pendiente.`
    : isProvider ? 'Revisa y actualiza los trabajos que te asignaron.' : 'Tu actividad, accesos directos y estado operativo en un solo lugar.'

  return (
    <PageContainer>
      <PageHeader
        variant="featured"
        eyebrow={`${scope} · ${todayLabel()}`}
        title={greeting}
        description={description}
        actions={<>
          {hasCashbox ? <ButtonLink href="/cashbox" variant="inverse">Ver caja</ButtonLink> : null}
          {canSell ? <ButtonLink href="/sales" variant="mint" icon={Plus}>Nueva venta</ButtonLink> : null}
          {isProvider && !canSell ? <ButtonLink href="/production" variant="mint" icon={Factory}>Ver trabajos asignados</ButtonLink> : null}
        </>}
        stats={kpis ? <>
          <StatCard surface="ink" label="Pedidos activos" value={kpis.activeCount} />
          <StatCard surface="ink" label="Cobrado hoy" value={formatAmount(kpis.collectedToday)} unit="CUP" />
          <StatCard surface="ink" tone="positive" label="Listos para entregar" value={kpis.readyToDeliver} />
          <StatCard surface="ink" tone="attention" label="Saldo por cobrar" value={formatAmount(kpis.balanceDue)} unit="CUP" />
        </> : undefined}
      />
      {ownedOrganizations.length ? (
        ownedOrganizations.map((organization) => (
          <div key={organization.id} className="flex flex-col gap-5">
            {organization.analyticsEnabled ? <OwnerAnalyticsDashboard
              organizationId={organization.id}
              branches={organization.branches}
              sellers={organization.members
                .filter((member) => member.role === 'seller' && member.status === 'active')
                .map((member) => ({ id: member.userId, name: member.displayName, branchId: member.branchId }))}
              defaultFrom={defaultFrom}
              defaultTo={defaultTo}
            /> : null}
            <OwnerAccessCard
              organizationName={organization.name}
              links={[
                { href: '/orders', label: 'Pedidos y cobros' },
                { href: '/team', label: 'Administrar equipo' },
                { href: '/catalog', label: 'Catálogo y precios' },
              ]}
            />
          </div>
        ))
      ) : memberAccess.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {memberAccess.map((organization) => <MemberAccessCard key={organization.id} organization={organization} links={dashboardLinks(organization.roles, organization.modules)} />)}
        </div>
      ) : (
        <EmptyState icon={Building} title="Sin organización activa" description="Tu cuenta no administra ni pertenece a una organización activa." />
      )}
    </PageContainer>
  )
}

// Cuba is the launch market; greetings and dates follow Havana time.
const TIME_ZONE = 'America/Havana'

function greetingFor(date: Date) {
  const hour = Number(new Intl.DateTimeFormat('es-CU', { hour: 'numeric', hourCycle: 'h23', timeZone: TIME_ZONE }).format(date))
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function todayLabel() {
  const label = new Intl.DateTimeFormat('es-CU', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TIME_ZONE }).format(new Date()).replace('.', '').replace(',', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const plural = (count: number, singular: string, many: string) => `${count} ${count === 1 ? singular : many}`

async function loadEnabledModules(supabase: SupabaseServerClient, organizationIds: number[]) {
  const { data } = await supabase.from('organization_modules').select('module_key').in('organization_id', organizationIds).eq('is_enabled', true)
  return ((data ?? []) as Pick<Tables<'organization_modules'>, 'module_key'>[]).map(({ module_key }) => module_key)
}

async function loadMemberAccess(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: membershipData } = await supabase
    .from('organization_memberships')
    .select('organization_id, branch_id, role, status')
    .eq('user_id', user.id)
    .eq('status', 'active')

  const memberships = (membershipData ?? []) as Pick<
    Tables<'organization_memberships'>,
    'organization_id' | 'branch_id' | 'role' | 'status'
  >[]
  const organizationIds = [
    ...new Set(memberships.map(({ organization_id }) => organization_id)),
  ]
  if (!organizationIds.length) return []

  const { data: organizationData } = await supabase
    .from('organizations')
    .select('id, name, order_prefix, status')
    .in('id', organizationIds)
  const { data: branchData } = await supabase
    .from('branches')
    .select('id, organization_id, name')
    .in('organization_id', organizationIds)
  const { data: entitlementData } = await supabase
    .from('organization_modules')
    .select('organization_id, module_key, is_enabled')
    .in('organization_id', organizationIds)
    .eq('is_enabled', true)

  const organizations = (organizationData ?? []) as Pick<
    Tables<'organizations'>,
    'id' | 'name' | 'order_prefix' | 'status'
  >[]
  const branches = (branchData ?? []) as Pick<
    Tables<'branches'>,
    'id' | 'organization_id' | 'name'
  >[]
  const entitlements = (entitlementData ?? []) as Pick<
    Tables<'organization_modules'>,
    'organization_id' | 'module_key' | 'is_enabled'
  >[]

  const access = []
  for (const organization of organizations) {
    const { data: canOperate } = await supabase.rpc(
      'current_user_can_operate_organization',
      {
        target_organization_id: organization.id,
        required_module_key: 'core',
      } as never,
    )
    const organizationMemberships = memberships.filter(
      (membership) => membership.organization_id === organization.id,
    )

    access.push({
      ...organization,
      canOperate: Boolean(canOperate),
      roles: organizationMemberships.map(({ role }) => role),
      branches: organizationMemberships
        .map((membership) =>
          branches.find((branch) => branch.id === membership.branch_id),
        )
        .filter((branch): branch is NonNullable<typeof branch> => Boolean(branch))
        .map(({ name }) => name),
      modules: entitlements
        .filter(
          (entitlement) => entitlement.organization_id === organization.id,
        )
        .map(({ module_key }) => module_key),
    })
  }

  return access
}

function dashboardLinks(roles: string[], modules: string[]) {
  const links: { href: string; label: string }[] = []
  if (roles.includes('seller') && modules.includes('optical_sales')) {
    links.push({ href: '/orders', label: 'Ver pedidos' }, { href: '/customers', label: 'Buscar clientes' })
  }
  if (roles.includes('seller') && modules.includes('cashbox')) links.push({ href: '/cashbox', label: 'Mi caja' })
  if (roles.some((role) => role === 'lens_provider' || role === 'mounting_provider') && modules.includes('production')) {
    links.push({ href: '/production', label: 'Ver trabajos asignados' })
  }
  return links
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function loadOrganizations(supabase: SupabaseServerClient) {
  const { data: organizations } = await supabase
    .from('organizations')
    .select('id, name, order_prefix, status, created_at')
    .order('created_at', { ascending: false })
  const { data: branches } = await supabase
    .from('branches')
    .select('id, organization_id, name, is_active')
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('organization_id, status, expires_on, starts_on, amount, currency, billing_period')
  const { data: entitlements } = await supabase
    .from('organization_modules')
    .select('organization_id, module_key, is_enabled')
  const { data: ownerMemberships } = await supabase
    .from('organization_memberships')
    .select('organization_id, user_id')
    .eq('role', 'owner')
    .eq('status', 'active')
  const { data: usageData } = await supabase.rpc('get_platform_usage')
  const { data: supportData } = await supabase
    .from('platform_support_sessions')
    .select('id, organization_id, reason, started_at, expires_at')
    .is('ended_at', null)
    .gt('expires_at', new Date().toISOString())

  const membershipRows = (ownerMemberships ?? []) as Pick<
    Tables<'organization_memberships'>,
    'organization_id' | 'user_id'
  >[]
  const ownerIds = [...new Set(membershipRows.map(({ user_id }) => user_id))]
  const { data: ownerProfiles } = ownerIds.length
    ? await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', ownerIds)
    : { data: [] }

  const organizationRows = (organizations ?? []) as Pick<
    Tables<'organizations'>,
    'id' | 'name' | 'order_prefix' | 'status' | 'created_at'
  >[]
  const branchRows = (branches ?? []) as Pick<
    Tables<'branches'>,
    'id' | 'organization_id' | 'name' | 'is_active'
  >[]
  const subscriptionRows = (subscriptions ?? []) as Pick<
    Tables<'subscriptions'>,
    'organization_id' | 'status' | 'expires_on' | 'starts_on' | 'amount' | 'currency' | 'billing_period'
  >[]
  const entitlementRows = (entitlements ?? []) as Pick<
    Tables<'organization_modules'>,
    'organization_id' | 'module_key' | 'is_enabled'
  >[]
  const profileRows = (ownerProfiles ?? []) as Pick<
    Tables<'profiles'>,
    'user_id' | 'display_name'
  >[]
  const usageRows = (usageData ?? []) as unknown as {
    organizationId: number; customers: number; orders: number; members: number
    openProductionJobs: number; notificationAttempts: number; lastActivityAt: string | null
  }[]
  const supportRows = (supportData ?? []) as {
    id: number; organization_id: number; reason: string; started_at: string; expires_at: string
  }[]

  return organizationRows.map((organization) => ({
    ...organization,
    branches: branchRows.filter(
      (branch) => branch.organization_id === organization.id,
    ),
    subscription: subscriptionRows.find(
      (subscription) => subscription.organization_id === organization.id,
    ),
    modules: entitlementRows.filter(
      (entitlement) =>
        entitlement.organization_id === organization.id &&
        entitlement.is_enabled,
    ),
    owners: membershipRows
      .filter(
        (membership) => membership.organization_id === organization.id,
      )
      .map((membership) =>
        profileRows.find(
          (profile) => profile.user_id === membership.user_id,
        ),
      )
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile)),
    usage: usageRows.find((usage) => usage.organizationId === organization.id),
    supportSession: supportRows.find((session) => session.organization_id === organization.id),
  }))
}
