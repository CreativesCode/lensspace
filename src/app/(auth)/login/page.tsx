import { LoginForm } from '@/features/auth/components'
import { VisionStudioLogo } from '@/shared/components'

type LoginPageProps = {
  searchParams: Promise<{ next?: string; notice?: string }>
}
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, notice } = await searchParams

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(320px,0.9fr)_1.1fr]">
      <aside className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <VisionStudioLogo inverse subtitle="De la receta a la entrega" />
        <div className="max-w-md">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#7FB3AC]">
            Gestión óptica integral
          </p>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-[-0.03em]">
            Claridad para cada paso de tu óptica.
          </h2>
          <p className="mt-5 text-base leading-7 text-[#A7CFC9]">
            Clientes, recetas, ventas y producción en un solo flujo.
          </p>
        </div>
        <p className="text-xs text-[#6F9C96]">Vision Studio · Caribe moderno</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-8 lg:hidden">
            <VisionStudioLogo subtitle="De la receta a la entrega" />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Acceso seguro
          </p>
          <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-slate-950">
            Bienvenido
          </h1>
          <p className="mb-8 mt-2 leading-6 text-slate-600">
            Accede con la cuenta creada por el administrador de tu óptica.
          </p>

          {notice === 'managed' ? (
            <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              El registro no es público. Solicita acceso al administrador de Vision Studio.
            </p>
          ) : null}

          <LoginForm next={next} />
        </div>
      </main>
    </div>
  )
}
