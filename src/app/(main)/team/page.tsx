import { redirect } from 'next/navigation'

import { OrganizationTeamManager } from '@/features/team/components'
import { loadOwnedOrganizations } from '@/features/team/load-owned-organizations'
import { createClient } from '@/lib/supabase/server'

export default async function TeamPage() {
  const supabase = await createClient()
  const organizations = await loadOwnedOrganizations(supabase)
  if (!organizations.length) redirect('/dashboard')

  return <section className="mx-auto max-w-7xl px-5 py-7 md:px-7">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Administración</p>
    <h1 className="mt-2 font-display text-[26px] font-bold tracking-[-0.02em] text-[#07322F]">Equipo</h1>
    <p className="mt-3 max-w-2xl text-[#4A5B58]">Consulta los accesos e invita o administra miembros desde diálogos independientes.</p>
    <div className="space-y-6">{organizations.map((organization) => <OrganizationTeamManager key={organization.id} organizationId={organization.id} organizationName={organization.name} branches={organization.branches} members={organization.members} canManage={organization.canManage} />)}</div>
  </section>
}
