import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/features/auth/actions'
import type { Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { MainNavigation, MobileSidebar, VisionStudioLogo } from '@/shared/components'

const commercialHrefs = ['/prescriptions', '/catalog', '/orders', '/sales', '/customers']

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>
}
async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const allowedHrefs = await loadAllowedNavigation(supabase, user.id)
  const canCreateSale = allowedHrefs.includes('/sales')

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden w-[244px] shrink-0 flex-col bg-slate-950 px-4 py-6 md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-1">
          <VisionStudioLogo inverse subtitle="Gestión óptica" />
        </div>
        <MainNavigation allowedHrefs={allowedHrefs} />
        <div className="mt-auto border-t border-[#10463F] pt-4">
          <p className="truncate text-sm font-semibold text-[#E6F5F3]">{user.email}</p>
          <p className="mt-1 text-xs text-[#6F9C96]">Sesión activa</p>
          <form action={signOut}>
            <button type="submit" className="mt-4 w-full rounded-lg border border-[#2B5E58] px-4 py-2 text-sm font-medium text-[#A7CFC9] transition hover:bg-[#10463F]">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:hidden">
          <VisionStudioLogo compact />
          <div className="flex items-center gap-2">
            {canCreateSale ? (
              <Link
                href="/sales"
                aria-label="Crear nueva venta"
                title="Nueva venta"
                className="grid h-11 w-11 place-items-center rounded-lg bg-[#0D7A72] text-2xl font-semibold leading-none text-white shadow-[0_6px_18px_rgba(13,122,114,0.22)] transition hover:bg-[#07322F] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9DFD9]"
              >
                <span aria-hidden="true">+</span>
              </Link>
            ) : null}
            <MobileSidebar allowedHrefs={allowedHrefs} email={user.email ?? 'Usuario'} />
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function loadAllowedNavigation(supabase: SupabaseServerClient, userId: string) {
  const { data: isPlatformAdmin } = await supabase.rpc('current_user_is_platform_admin')
  if (isPlatformAdmin) return ['/dashboard', '/organizations', '/catalog']

  const { data: membershipData } = await supabase
    .from('organization_memberships')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')

  const memberships = (membershipData ?? []) as Pick<
    Tables<'organization_memberships'>,
    'organization_id' | 'role'
  >[]
  const organizationIds = [...new Set(memberships.map(({ organization_id }) => organization_id))]
  if (!organizationIds.length) return ['/dashboard']

  const { data: moduleData } = await supabase
    .from('organization_modules')
    .select('organization_id, module_key')
    .in('organization_id', organizationIds)
    .eq('is_enabled', true)

  const modules = (moduleData ?? []) as Pick<
    Tables<'organization_modules'>,
    'organization_id' | 'module_key'
  >[]
  const hasAccess = (roles: string[], moduleKey: string) =>
    memberships.some((membership) =>
      roles.includes(membership.role) &&
      modules.some((module) =>
        module.organization_id === membership.organization_id && module.module_key === moduleKey,
      ),
    )

  const allowed = ['/dashboard']
  if (memberships.some((membership) => membership.role === 'owner')) allowed.push('/team')
  if (hasAccess(['owner', 'seller'], 'optical_sales')) allowed.push(...commercialHrefs)
  if (hasAccess(['owner', 'seller'], 'cashbox')) allowed.push('/cashbox')
  if (hasAccess(['owner', 'seller', 'lens_provider', 'mounting_provider'], 'production')) {
    allowed.push('/production')
  }

  return allowed
}
