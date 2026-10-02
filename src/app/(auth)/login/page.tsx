import { AuthCard, LoginForm } from '@/features/auth/components'
import { LensSpaceLogo } from '@/shared/components'
import { Alert } from '@/shared/ui'

type LoginPageProps = {
  searchParams: Promise<{ next?: string; notice?: string }>
}
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, notice } = await searchParams

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <span aria-hidden="true" className="pointer-events-none absolute -right-28 -top-36 size-[420px] rounded-full border border-[#16544C]" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-12 right-10 size-[230px] rounded-full border border-[#16544C]" />
        <div className="relative"><LensSpaceLogo inverse subtitle="De la receta a la entrega" /></div>
        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#7FD8C8]">Gestión óptica integral</p>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-[-0.03em]">
            Claridad para cada paso de tu óptica.
          </h2>
          <p className="mt-5 text-base leading-7 text-[#B9DDD7]">
            Clientes, recetas, ventas y producción en un solo flujo.
          </p>
        </div>
        <p className="relative text-xs text-[#7FB3AC]">LensSpace · Caribe moderno</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-6 sm:py-12">
        <AuthCard
          eyebrow="Acceso seguro"
          title="Bienvenido"
          description="Accede con la cuenta creada por el administrador de tu óptica."
          logoSubtitle="De la receta a la entrega"
          logoClassName="lg:hidden"
        >
          {notice === 'managed' ? (
            <Alert tone="warning" className="mb-5">El registro no es público. Solicita acceso al administrador de LensSpace.</Alert>
          ) : null}
          <LoginForm next={next} />
        </AuthCard>
      </main>
    </div>
  )
}
