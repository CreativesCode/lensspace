import { redirect } from 'next/navigation'

import { PlatformAdminWorkspace } from '@/features/admin/components'
import { loadPlatformOrganizations } from '@/features/admin/load-platform-organizations'
import { createClient } from '@/lib/supabase/server'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: isPlatformAdmin } = await supabase.rpc('current_user_is_platform_admin')
  if (!isPlatformAdmin) redirect('/dashboard')
  const organizations = await loadPlatformOrganizations(supabase)

  return <section className="mx-auto max-w-7xl px-5 py-7 md:px-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Administración de plataforma</p><h1 className="mt-2 font-display text-3xl font-bold text-[#07322F]">Organizaciones</h1><p className="mt-2 text-sm text-[#74857F]">Busca, revisa y administra ópticas sin cargar todos sus formularios a la vez.</p><PlatformAdminWorkspace organizations={organizations} /></section>
}
