'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigationSections = [
  {
    label: 'Operación',
    items: [
      { href: '/dashboard', label: 'Panel principal' },
      { href: '/orders', label: 'Pedidos y cobros' },
      { href: '/customers', label: 'Clientes' },
      { href: '/prescriptions', label: 'Recetas' },
      { href: '/production', label: 'Producción' },
      { href: '/cashbox', label: 'Caja y cierres' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/catalog', label: 'Catálogo y precios' },
      { href: '/team', label: 'Equipo' },
      { href: '/organizations', label: 'Organizaciones' },
    ],
  },
]

export function MainNavigation({ allowedHrefs, onNavigate }: { allowedHrefs: string[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  const canCreateSale = allowedHrefs.includes('/sales')
  const visibleSections = navigationSections
    .map((section) => ({ ...section, items: section.items.filter(({ href }) => allowedHrefs.includes(href)) }))
    .filter(({ items }) => items.length)

  return (
    <nav aria-label="Navegación principal" className="mt-8">
      {canCreateSale ? (
        <Link
          href="/sales"
          onClick={onNavigate}
          aria-current={pathname === '/sales' ? 'page' : undefined}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
            pathname === '/sales'
              ? 'bg-[#35C2A8] text-[#07322F]'
              : 'bg-[#0D7A72] text-white hover:bg-[#168E82]'
          }`}
        >
          <span aria-hidden="true" className="text-xl leading-none">+</span>
          Nueva venta
        </Link>
      ) : null}
      {visibleSections.map((section, sectionIndex) => <div key={section.label} className={sectionIndex === 0 && canCreateSale ? 'pt-6' : sectionIndex ? 'pt-6' : ''}>
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4D7A74]">{section.label}</p>
        {section.items.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          return <Link key={href} href={href} onClick={onNavigate} aria-current={isActive ? 'page' : undefined} className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition first:mt-0 ${isActive ? 'bg-[#10463F] font-semibold text-[#D8F5EF]' : 'font-medium text-[#A7CFC9] hover:bg-[#10463F] hover:text-[#D8F5EF]'}`}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${isActive ? 'bg-[#35C2A8]' : 'border border-[#6F9C96]'}`} />
            {label}
          </Link>
        })}
      </div>)}
    </nav>
  )
}
