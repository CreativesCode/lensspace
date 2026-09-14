import Link from 'next/link'

import type { PlatformOrganization } from './PlatformAdminWorkspace'

export function PlatformAdminDashboard({ organizations }: { organizations: PlatformOrganization[] }) {
  const total = organizations.length
  const active = organizations.filter(({ status }) => status === 'active').length
  const trials = organizations.filter(({ subscription }) => subscription?.status === 'trial').length
  const customers = organizations.reduce((sum, item) => sum + (item.usage?.customers ?? 0), 0)
  const orders = organizations.reduce((sum, item) => sum + (item.usage?.orders ?? 0), 0)
  const members = organizations.reduce((sum, item) => sum + (item.usage?.members ?? 0), 0)
  const openJobs = organizations.reduce((sum, item) => sum + (item.usage?.openProductionJobs ?? 0), 0)
  const metrics = [
    ['Organizaciones', total, `${active} activas`],
    ['Clientes', customers, 'en toda la plataforma'],
    ['Pedidos', orders, 'históricos'],
    ['Usuarios', members, 'miembros activos'],
    ['Producción abierta', openJobs, 'trabajos en curso'],
    ['En prueba', trials, 'suscripciones trial'],
  ]

  return (
    <div className="mt-7 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(([label, value, detail]) => <article key={label} className="rounded-[10px] border border-[#E3EFED] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#74857F]">{label}</p><p className="mt-2 font-display text-3xl font-bold text-[#07322F]">{value}</p><p className="mt-1 text-xs text-[#74857F]">{detail}</p></article>)}
      </div>
      <section className="rounded-[10px] border border-[#E3EFED] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEF5F4] p-5"><div><h2 className="font-display text-lg font-semibold text-[#07322F]">Actividad de organizaciones</h2><p className="mt-1 text-sm text-[#74857F]">Las ópticas con actividad más reciente.</p></div><Link href="/organizations" className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white">Gestionar organizaciones</Link></div>
        <div className="divide-y divide-[#EEF5F4]">{organizations.slice(0, 6).map((organization) => <div key={organization.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-semibold text-[#07322F]">{organization.name}</p><p className="text-xs text-[#74857F]">{organization.order_prefix} · {organization.owners.map(({ display_name }) => display_name).join(', ') || 'Sin propietario'}</p></div><span className="text-sm text-[#4A5B58]">{organization.usage?.orders ?? 0} pedidos</span><span className="text-xs text-[#74857F]">{organization.usage?.lastActivityAt ? new Date(organization.usage.lastActivityAt).toLocaleDateString('es-CU') : 'Sin actividad'}</span></div>)}</div>
        {!organizations.length ? <p className="p-6 text-sm text-[#74857F]">Aún no hay organizaciones. Créala desde el área de organizaciones.</p> : null}
      </section>
    </div>
  )
}
