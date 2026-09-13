import { redirect } from 'next/navigation'

import { UpdatePasswordForm } from '@/features/auth/components'
import { createClient } from '@/lib/supabase/server'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
          Vision Studio
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Crea tu contraseña
        </h1>
        <p className="mb-8 mt-2 text-slate-600">
          Termina de activar tu cuenta para entrar a la óptica.
        </p>
        <UpdatePasswordForm />
      </div>
    </div>
  )
}
