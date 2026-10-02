import { Factory, ReceiptText, Tags, Users, UsersRound, Wallet, type LucideIcon } from 'lucide-react'

import { Badge, ButtonLink, Card } from '@/shared/ui'

export type QuickLink = { href: string; label: string }

const linkIcons: Record<string, LucideIcon> = {
  '/orders': ReceiptText,
  '/customers': Users,
  '/cashbox': Wallet,
  '/production': Factory,
  '/team': UsersRound,
  '/catalog': Tags,
}

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

// Guide: one primary per view (the header's "Nueva venta"); shortcuts are secondary buttons.
function QuickLinks({ links }: { links: QuickLink[] }) {
  if (!links.length) return null
  return (
    <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
      {links.map((link) => (
        <ButtonLink key={link.href} href={link.href} variant="secondary" icon={linkIcons[link.href]}>{link.label}</ButtonLink>
      ))}
    </div>
  )
}

export function OwnerAccessCard({ organizationName, links }: { organizationName: string; links: QuickLink[] }) {
  return (
    <Card>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">Propietario · todas las sucursales</p>
      <h2 className="mt-2 font-display text-xl font-bold text-ink">{organizationName}</h2>
      <QuickLinks links={links} />
    </Card>
  )
}

export type MemberAccess = { id: number; name: string; order_prefix: string; canOperate: boolean; roles: string[]; branches: string[]; modules: string[] }

export function MemberAccessCard({ organization, links }: { organization: MemberAccess; links: QuickLink[] }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink">{organization.name}</h2>
          <p className="mt-1 text-sm text-text-muted">{organization.order_prefix}</p>
        </div>
        <Badge tone={organization.canOperate ? 'success' : 'warning'}>{organization.canOperate ? 'Operativa' : 'Solo lectura'}</Badge>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-text-muted">Rol</dt>
          <dd className="font-semibold text-ink">{organization.roles.map((role) => roleLabels[role] ?? role).join(', ')}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-text-muted">Sucursal</dt>
          <dd className="font-semibold text-ink">{organization.branches.join(', ') || 'Acceso externo asignado'}</dd>
        </div>
      </dl>
      <p className="mt-5 text-[13px] text-text-muted">Módulos disponibles</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {organization.modules.map((moduleKey) => <Badge key={moduleKey} tone="neutral" dot={false}>{moduleLabels[moduleKey] ?? moduleKey}</Badge>)}
      </div>
      <QuickLinks links={links} />
    </Card>
  )
}
