import { PlatformAdminDashboard } from '@/features/admin/components'
import { OwnerAnalyticsDashboard } from '@/features/analytics/components'
import { loadOwnedOrganizations } from '@/features/team/load-owned-organizations'
import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const defaultTo = new Date().toISOString().slice(0, 10)
  const fromDate = new Date()
  fromDate.setUTCDate(fromDate.getUTCDate() - 29)
  const defaultFrom = fromDate.toISOString().slice(0, 10)
  const supabase = await createClient()
  const { data: isPlatformAdmin } = await supabase.rpc(
    'current_user_is_platform_admin',
  )
  const organizations = isPlatformAdmin
    ? await loadOrganizations(supabase)
    : []
  const ownedOrganizations = isPlatformAdmin
    ? []
    : await loadOwnedOrganizations(supabase)
  const memberAccess =
    isPlatformAdmin || ownedOrganizations.length
      ? []
      : await loadMemberAccess(supabase)

  return (
    <section className="mx-auto max-w-7xl px-5 py-7 md:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
        Panel principal
      </p>
      <h1 className="mt-2 font-display text-[26px] font-bold tracking-[-0.02em] text-slate-950">
        {isPlatformAdmin ? 'Administración de organizaciones' : 'Vision Studio'}
      </h1>
      {isPlatformAdmin ? (
        <><p className="mt-3 max-w-2xl text-slate-600">Panorama operativo y crecimiento de Vision Studio.</p><PlatformAdminDashboard organizations={organizations} /></>
      ) : (
        <>
          <p className="mt-4 max-w-2xl text-slate-600">
            Tu actividad, accesos directos y estado operativo en un solo lugar.
          </p>
          {ownedOrganizations.length ? (
            ownedOrganizations.map((organization) => (
              <div key={organization.id} className="mt-4 space-y-4">
                {organization.analyticsEnabled ? <OwnerAnalyticsDashboard
                  organizationId={organization.id}
                  branches={organization.branches}
                  sellers={organization.members
                    .filter((member) => member.role === 'seller' && member.status === 'active')
                    .map((member) => ({ id: member.userId, name: member.displayName, branchId: member.branchId }))}
                  defaultFrom={defaultFrom}
                  defaultTo={defaultTo}
                /> : null}
                <DashboardCard
                  organizationName={organization.name}
                  role="Propietario"
                  branch="Todas las sucursales"
                  links={[
                    { href: '/sales', label: 'Nueva venta' },
                    { href: '/orders', label: 'Pedidos y cobros' },
                    { href: '/team', label: 'Administrar equipo' },
                    { href: '/catalog', label: 'Catálogo y precios' },
                  ]}
                />
              </div>
            ))
          ) : memberAccess.length ? (
            <MemberAccessList access={memberAccess} />
          ) : (
            <p className="mt-8 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Tu cuenta no administra una organización activa.
            </p>
          )}
        </>
      )}
    </section>
  )
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

type MemberAccess = Awaited<ReturnType<typeof loadMemberAccess>>[number]

const roleLabels: Record<string, string> = {
  seller: 'Vendedor',
  lens_provider: 'Cristalero/laboratorio',
  mounting_provider: 'Montador',
}

const moduleLabels: Record<string, string> = {
  optical_sales: 'Ventas ópticas',
  cashbox: 'Caja',
  production: 'Producción',
  whatsapp: 'WhatsApp',
  analytics: 'Analítica',
  multi_branch: 'Multisucursal',
}

function MemberAccessList({ access }: { access: MemberAccess[] }) {
  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-2">
      {access.map((organization) => (
        <article
          key={organization.id}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                {organization.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {organization.order_prefix}
              </p>
            </div>
            <span
              className={
                organization.canOperate
                  ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
                  : 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'
              }
            >
              {organization.canOperate ? 'Operativa' : 'Solo lectura'}
            </span>
          </div>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">Rol</dt>
              <dd className="font-medium text-slate-800">
                {organization.roles
                  .map((role) => roleLabels[role] ?? role)
                  .join(', ')}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Sucursal</dt>
              <dd className="font-medium text-slate-800">
                {organization.branches.join(', ') || 'Acceso externo asignado'}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <p className="text-sm text-slate-500">Módulos disponibles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {organization.modules.map((moduleKey) => (
                <span
                  key={moduleKey}
                  className="rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700"
                >
                  {moduleLabels[moduleKey] ?? moduleKey}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {dashboardLinks(organization.roles, organization.modules).map((link) => (
              <a key={link.href} href={link.href} className="rounded-[7px] bg-[#07322F] px-4 py-2.5 text-sm font-semibold text-white">
                {link.label}
              </a>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}

function dashboardLinks(roles: string[], modules: string[]) {
  const links: { href: string; label: string }[] = []
  if (roles.includes('seller') && modules.includes('optical_sales')) {
    links.push({ href: '/sales', label: 'Nueva venta' }, { href: '/orders', label: 'Ver pedidos' }, { href: '/customers', label: 'Buscar clientes' })
  }
  if (roles.includes('seller') && modules.includes('cashbox')) links.push({ href: '/cashbox', label: 'Mi caja' })
  if (roles.some((role) => role === 'lens_provider' || role === 'mounting_provider') && modules.includes('production')) {
    links.push({ href: '/production', label: 'Ver trabajos asignados' })
  }
  return links
}

function DashboardCard({ organizationName, role, branch, links }: { organizationName: string; role: string; branch: string; links: { href: string; label: string }[] }) {
  return <article className="rounded-[10px] border border-[#E3EFED] bg-white p-6 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0D7A72]">{role}</p>
    <h2 className="mt-2 font-display text-xl font-bold text-[#07322F]">{organizationName}</h2>
    <p className="mt-1 text-sm text-[#74857F]">{branch}</p>
    <div className="mt-5 flex flex-wrap gap-2">{links.map((link) => <a key={link.href} href={link.href} className="rounded-[7px] bg-[#07322F] px-4 py-2.5 text-sm font-semibold text-white">{link.label}</a>)}</div>
  </article>
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

type OrganizationSummary = Awaited<ReturnType<typeof loadOrganizations>>[number]

export function OrganizationList({
  organizations,
}: {
  organizations: OrganizationSummary[]
}) {
  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-950">Organizaciones</h2>
        <span className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700">
          {organizations.length}
        </span>
      </div>

      {organizations.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {organizations.map((organization) => (
            <article
              key={organization.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    {organization.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {organization.order_prefix} · ID {organization.id}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700">
                  {organization.status}
                </span>
              </div>

              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Propietario</dt>
                  <dd className="font-medium text-slate-800">
                    {organization.owners.map(({ display_name }) => display_name).join(', ') ||
                      'Sin propietario'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Sucursales</dt>
                  <dd className="font-medium text-slate-800">
                    {organization.branches.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Suscripción</dt>
                  <dd className="font-medium text-slate-800">
                    {organization.subscription?.status ?? 'Sin configurar'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vencimiento</dt>
                  <dd className="font-medium text-slate-800">
                    {organization.subscription?.expires_on ?? '—'}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700">
                  Núcleo
                </span>
                {organization.modules.map(({ module_key }) => (
                  <span
                    key={module_key}
                    className="rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700"
                  >
                    {module_key}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          Todavía no hay organizaciones.
        </p>
      )}
    </div>
  )
}
