import Link from 'next/link'

import { AuthCard, ForgotPasswordForm } from '@/features/auth/components'

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 sm:px-6 sm:py-12">
      <AuthCard
        eyebrow="Acceso seguro"
        title="Recuperar contraseña"
        description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva."
        logoSubtitle="De la receta a la entrega"
      >
        <ForgotPasswordForm />
        <p className="mt-5 text-center text-sm"><Link href="/login" className="font-semibold text-action hover:underline">Volver a iniciar sesión</Link></p>
      </AuthCard>
    </main>
  )
}
