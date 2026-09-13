import { OrganizationOnboardingForm } from '@/features/admin/components'
import { OwnerAnalyticsDashboard } from '@/features/analytics/components'
import { OrganizationTeamManager } from '@/features/team/components'
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
        <>
          <p className="mt-4 max-w-2xl text-slate-600">
            Crea la óptica, su primera sucursal, suscripción, módulos y cuenta de
            propietario en una sola operación.
          </p>
          <OrganizationList organizations={organizations} />
          <OrganizationOnboardingForm />
        </>
      ) : (
        <>
          <p className="mt-4 max-w-2xl text-slate-600">
            Administra el equipo autorizado de tu óptica.
          </p>
          {ownedOrganizations.length ? (
            ownedOrganizations.map((organization) => (
              <div key={organization.id}>
                {organization.analyticsEnabled ? <OwnerAnalyticsDashboard
                    organizationId={organization.id}
                    branches={organization.branches}
                    sellers={organization.members
                      .filter((member) => member.role === 'seller' && member.status === 'active')
                      .map((member) => ({ id: member.userId, name: member.displayName, branchId: member.branchId }))}
                    defaultFrom={defaultFrom}
                    defaultTo={defaultTo}
                  /> : null}
                <OrganizationTeamManager
                  organizationId={organization.id}
                  organizationName={organization.name}
                  branches={organization.branches}
                  members={organization.members}
                  canManage={organization.canManage}
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
        </article>
      ))}
    </div>
  )
}

async function loadOwnedOrganizations(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data: ownerMembershipData } = await supabase
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .eq('status', 'active')

  const ownerMemberships = (ownerMembershipData ?? []) as Pick<
    Tables<'organization_memberships'>,
    'organization_id'
  >[]
  const organizationIds = ownerMemberships.map(
    ({ organization_id }) => organization_id,
  )
  if (!organizationIds.length) return []

  const { data: organizationData } = await supabase
    .from('organizations')
    .select('id, name')
    .in('id', organizationIds)
  const { data: branchData } = await supabase
    .from('branches')
    .select('id, organization_id, name')
    .in('organization_id', organizationIds)
    .eq('is_active', true)
  const { data: membershipData } = await supabase
    .from('organization_memberships')
    .select('id, organization_id, user_id, branch_id, role, status')
    .in('organization_id', organizationIds)
  const { data: analyticsData } = await supabase
    .from('organization_modules')
    .select('organization_id')
    .in('organization_id', organizationIds)
    .eq('module_key', 'analytics')
    .eq('is_enabled', true)

  const memberships = (membershipData ?? []) as Pick<
    Tables<'organization_memberships'>,
    'id' | 'organization_id' | 'user_id' | 'branch_id' | 'role' | 'status'
  >[]
  const memberIds = [...new Set(memberships.map(({ user_id }) => user_id))]
  const { data: profileData } = memberIds.length
    ? await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', memberIds)
    : { data: [] }

  const organizations = (organizationData ?? []) as Pick<
    Tables<'organizations'>,
    'id' | 'name'
  >[]
  const branches = (branchData ?? []) as Pick<
    Tables<'branches'>,
    'id' | 'organization_id' | 'name'
  >[]
  const profiles = (profileData ?? []) as Pick<
    Tables<'profiles'>,
    'user_id' | 'display_name'
  >[]

  const result = []
  for (const organization of organizations) {
    const { data: canManage } = await supabase.rpc(
      'current_user_can_manage_organization',
      { target_organization_id: organization.id } as never,
    )
    result.push({
      ...organization,
      analyticsEnabled: ((analyticsData ?? []) as Pick<
        Tables<'organization_modules'>,
        'organization_id'
      >[]).some((entitlement) => entitlement.organization_id === organization.id),
      canManage: Boolean(canManage),
      branches: branches
        .filter((branch) => branch.organization_id === organization.id)
        .map(({ id, name }) => ({ id, name })),
      members: memberships
        .filter(
          (membership) => membership.organization_id === organization.id,
        )
        .map((membership) => ({
          id: membership.id,
          userId: membership.user_id,
          displayName:
            profiles.find((profile) => profile.user_id === membership.user_id)
              ?.display_name ?? 'Usuario',
          role: membership.role,
          status: membership.status,
          branchId: membership.branch_id,
          branchName:
            branches.find((branch) => branch.id === membership.branch_id)?.name ??
            null,
        })),
    })
  }

  return result
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
    .select('organization_id, status, expires_on, amount, currency')
  const { data: entitlements } = await supabase
    .from('organization_modules')
    .select('organization_id, module_key, is_enabled')
  const { data: ownerMemberships } = await supabase
    .from('organization_memberships')
    .select('organization_id, user_id')
    .eq('role', 'owner')
    .eq('status', 'active')

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
    'organization_id' | 'status' | 'expires_on' | 'amount' | 'currency'
  >[]
  const entitlementRows = (entitlements ?? []) as Pick<
    Tables<'organization_modules'>,
    'organization_id' | 'module_key' | 'is_enabled'
  >[]
  const profileRows = (ownerProfiles ?? []) as Pick<
    Tables<'profiles'>,
    'user_id' | 'display_name'
  >[]

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
  }))
}

type OrganizationSummary = Awaited<ReturnType<typeof loadOrganizations>>[number]

function OrganizationList({
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
