import { LoginForm } from '@/features/auth/components'

type LoginPageProps = {
  searchParams: Promise<{
    next?: string
    notice?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, notice } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
            Vision Studio
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Bienvenido
          </h1>
          <p className="mt-2 text-slate-600">
            Accede con la cuenta creada por el administrador de tu óptica.
          </p>
        </div>

        {notice === 'managed' ? (
          <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            El registro no es público. Solicita acceso al administrador de Vision Studio.
          </p>
        ) : null}

        <LoginForm next={next} />
      </div>
    </div>
  )
}
