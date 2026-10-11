import { getCurrentUser } from '@/lib/supabase/current-user'
import { redirect } from 'next/navigation'

import { PlatformAdminWorkspace } from '@/features/admin/components'
import { loadPlatformOrganizations } from '@/features/admin/load-platform-organizations'
import { createClient } from '@/lib/supabase/server'
import { PageContainer, PageHeader } from '@/shared/ui'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const { data: isPlatformAdmin } = await supabase.rpc('current_user_is_platform_admin')
  if (!isPlatformAdmin) redirect('/dashboard')
  const [organizations, { data: providerProfile }] = await Promise.all([
    loadPlatformOrganizations(supabase),
    supabase.from('platform_provider_profile').select('*').maybeSingle(),
  ])

  return <PageContainer><PageHeader eyebrow="Administración de plataforma" title="Organizaciones" description="Busca, revisa y administra ópticas sin cargar todos sus formularios a la vez." /><PlatformAdminWorkspace organizations={organizations} providerProfile={providerProfile} /></PageContainer>
}
