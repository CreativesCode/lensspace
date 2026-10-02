import { redirect } from 'next/navigation'

import { AuthCard, UpdatePasswordForm } from '@/features/auth/components'
import { createClient } from '@/lib/supabase/server'

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 sm:px-6 sm:py-12">
      <AuthCard
        eyebrow="Acceso seguro"
        title="Crea tu contraseña"
        description="Elige tu contraseña para entrar a la óptica."
        logoSubtitle="Activación de cuenta"
      >
        <UpdatePasswordForm />
      </AuthCard>
    </main>
  )
}
