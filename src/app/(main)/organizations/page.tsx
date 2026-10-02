import { redirect } from 'next/navigation'

import { PlatformAdminWorkspace } from '@/features/admin/components'
import { loadPlatformOrganizations } from '@/features/admin/load-platform-organizations'
import { createClient } from '@/lib/supabase/server'
import { PageContainer, PageHeader } from '@/shared/ui'

export default async function OrganizationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: isPlatformAdmin } = await supabase.rpc('current_user_is_platform_admin')
  if (!isPlatformAdmin) redirect('/dashboard')
  const organizations = await loadPlatformOrganizations(supabase)

  return <PageContainer><PageHeader eyebrow="Administración de plataforma" title="Organizaciones" description="Busca, revisa y administra ópticas sin cargar todos sus formularios a la vez." /><PlatformAdminWorkspace organizations={organizations} /></PageContainer>
}
