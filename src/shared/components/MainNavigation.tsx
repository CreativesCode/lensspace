'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Building, Factory, FileText, LayoutDashboard, Plus, ReceiptText, Tags, Users, UsersRound, Wallet, type LucideIcon } from 'lucide-react'

import { ButtonLink, cx } from '@/shared/ui'

const navigationSections: { label: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: 'Operación',
    items: [
      { href: '/dashboard', label: 'Panel principal', icon: LayoutDashboard },
      { href: '/orders', label: 'Pedidos y cobros', icon: ReceiptText },
      { href: '/customers', label: 'Clientes', icon: Users },
      { href: '/prescriptions', label: 'Recetas', icon: FileText },
      { href: '/production', label: 'Producción', icon: Factory },
      { href: '/cashbox', label: 'Caja y cierres', icon: Wallet },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/catalog', label: 'Catálogo y precios', icon: Tags },
      { href: '/team', label: 'Equipo', icon: UsersRound },
      { href: '/organizations', label: 'Organizaciones', icon: Building },
      { href: '/manual', label: 'Manual del sistema', icon: BookOpen },
    ],
  },
]

// The active accent bar sits at -14px: containers must keep a 14px (px-3.5) horizontal padding.
export function MainNavigation({ allowedHrefs, onNavigate }: { allowedHrefs: string[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  const canCreateSale = allowedHrefs.includes('/sales')
  const visibleSections = navigationSections
    .map((section) => ({ ...section, items: section.items.filter(({ href }) => allowedHrefs.includes(href)) }))
    .filter(({ items }) => items.length)

  return (
    <nav aria-label="Navegación principal" className="mt-[22px]">
      {canCreateSale ? (
        <ButtonLink href="/sales" onClick={onNavigate} variant="mint" icon={Plus} block aria-current={pathname === '/sales' ? 'page' : undefined}>
          Nueva venta
        </ButtonLink>
      ) : null}
      {visibleSections.map((section, sectionIndex) => (
        <div key={section.label} className={cx('flex flex-col gap-0.5', (sectionIndex > 0 || canCreateSale) && 'pt-[22px]')}>
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7FB3AC]">{section.label}</p>
          {section.items.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cx(
                  'relative flex min-h-[42px] items-center gap-3 rounded-control px-3 text-[14.5px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint',
                  isActive ? 'bg-ink-2 font-semibold text-white' : 'font-medium text-[#A7CFC9] hover:bg-ink-2 hover:text-white',
                )}
              >
                <span aria-hidden="true" className={cx('absolute -left-3.5 bottom-2.5 top-2.5 w-[3px] rounded-r-[3px]', isActive ? 'bg-mint' : 'bg-transparent')} />
                <Icon aria-hidden="true" size={18} className={isActive ? 'text-mint' : 'text-[#7FB3AC]'} />
                <span className="flex-1">{label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
