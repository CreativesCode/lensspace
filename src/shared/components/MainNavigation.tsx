'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigationItems = [
  { href: '/dashboard', label: 'Panel principal' },
  { href: '/organizations', label: 'Organizaciones' },
  { href: '/prescriptions', label: 'Recetas' },
  { href: '/catalog', label: 'Catálogo y precios' },
  { href: '/cashbox', label: 'Caja y cierres' },
  { href: '/orders', label: 'Pedidos y cobros' },
  { href: '/production', label: 'Producción' },
  { href: '/sales', label: 'Nueva venta' },
  { href: '/customers', label: 'Clientes' },
]

export function MainNavigation({ allowedHrefs, onNavigate }: { allowedHrefs: string[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  const visibleItems = navigationItems.filter(({ href }) => allowedHrefs.includes(href))

  return (
    <nav aria-label="Navegación principal" className="mt-10">
      <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4D7A74]">
        Operación
      </p>
      {visibleItems.map(({ href, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition first:mt-0 ${
              isActive
                ? 'bg-[#10463F] font-semibold text-[#D8F5EF]'
                : 'font-medium text-[#A7CFC9] hover:bg-[#10463F] hover:text-[#D8F5EF]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                isActive ? 'bg-[#35C2A8]' : 'border border-[#6F9C96]'
              }`}
            />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
