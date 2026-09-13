import { redirect } from 'next/navigation'

import { UpdatePasswordForm } from '@/features/auth/components'
import { createClient } from '@/lib/supabase/server'
import { VisionStudioLogo } from '@/shared/components'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <VisionStudioLogo subtitle="Activación de cuenta" />
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
          Acceso seguro
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-slate-950">
          Crea tu contraseña
        </h1>
        <p className="mb-8 mt-2 text-slate-600">
          Termina de activar tu cuenta para entrar a la óptica.
        </p>
        <UpdatePasswordForm />
      </div>
    </main>
  )
}
