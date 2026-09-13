import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signOut } from '@/features/auth/actions'
import { createClient } from '@/lib/supabase/server'
import { VisionStudioLogo } from '@/shared/components'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>
}
async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden w-[244px] shrink-0 flex-col bg-slate-950 px-4 py-6 md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-1">
          <VisionStudioLogo inverse subtitle="Gestión óptica" />
        </div>
        <nav aria-label="Navegación principal" className="mt-10">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4D7A74]">
            Operación
          </p>
          <Link href="/dashboard" className="flex items-center gap-3 rounded-lg bg-[#10463F] px-3 py-2.5 text-sm font-semibold text-[#D8F5EF]">
            <span className="h-2 w-2 rounded-full bg-[#35C2A8]" />
            Panel principal
          </Link>
          <Link href="/prescriptions" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#A7CFC9] transition hover:bg-[#10463F] hover:text-[#D8F5EF]">
            <span className="h-2 w-2 rounded-full border border-[#6F9C96]" />
            Recetas
          </Link>
          <Link href="/catalog" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#A7CFC9] transition hover:bg-[#10463F] hover:text-[#D8F5EF]">
            <span className="h-2 w-2 rounded-full border border-[#6F9C96]" />
            Catálogo y precios
          </Link>
          <Link href="/sales" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#A7CFC9] transition hover:bg-[#10463F] hover:text-[#D8F5EF]">
            <span className="h-2 w-2 rounded-full border border-[#6F9C96]" />
            Nueva venta
          </Link>
          <Link href="/orders" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#A7CFC9] transition hover:bg-[#10463F] hover:text-[#D8F5EF]">
            <span className="h-2 w-2 rounded-full border border-[#6F9C96]" />
            Pedidos y cobros
          </Link>
          <Link href="/sales" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#A7CFC9] transition hover:bg-[#10463F] hover:text-[#D8F5EF]">
            <span className="h-2 w-2 rounded-full border border-[#6F9C96]" />
            Nueva venta
          </Link>
          <Link href="/customers" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#A7CFC9] transition hover:bg-[#10463F] hover:text-[#D8F5EF]">
            <span className="h-2 w-2 rounded-full border border-[#6F9C96]" />
            Clientes
          </Link>
        </nav>
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
          <form action={signOut}>
            <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
              Salir
            </button>
          </form>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
