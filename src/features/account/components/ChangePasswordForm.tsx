'use client'

import { KeyRound } from 'lucide-react'
import { useMemo, useState, useTransition, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { PasswordInput } from '@/shared/components'
import { isNetworkError, offlineMessage } from '@/shared/lib/friendly-error'
import { Alert, Button, Card, CardHeader, Field, Toast } from '@/shared/ui'

type AuthFailure = { code?: string; status?: number; message?: string }

function passwordError(error: AuthFailure) {
  if (isNetworkError(error)) return offlineMessage
  if (error.code === 'invalid_credentials') return 'La contraseña actual no es correcta.'
  if (error.code === 'same_password') return 'La nueva contraseña debe ser distinta de la actual.'
  if (error.code === 'weak_password') return 'La nueva contraseña es demasiado débil o aparece en filtraciones conocidas. Usa una más larga y única.'
  if (error.status === 429 || error.code?.includes('rate_limit')) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  return 'No pudimos cambiar la contraseña. Inténtalo nuevamente.'
}

// QA-62: the current password is re-checked first, so an unattended open session
// cannot be used to take over the account.
export function ChangePasswordForm({ email }: { email: string | null }) {
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [pending, startTransition] = useTransition()

  function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const current = String(form.get('currentPassword') ?? '')
    const next = String(form.get('newPassword') ?? '')
    const confirmation = String(form.get('newPasswordConfirmation') ?? '')
    if (!current) return setError('Escribe tu contraseña actual.')
    if (next.length < 10) return setError('La nueva contraseña debe tener al menos 10 caracteres.')
    if (next !== confirmation) return setError('Las contraseñas nuevas no coinciden.')
    if (next === current) return setError('La nueva contraseña debe ser distinta de la actual.')
    if (!email) return setError('Tu cuenta no tiene correo; pide ayuda al administrador.')
    startTransition(async () => {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current })
      if (verifyError) return setError(passwordError(verifyError))
      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) return setError(passwordError(updateError))
      setError('')
      formElement.reset()
      setToast('Contraseña actualizada. Úsala la próxima vez que entres.')
    })
  }

  return <Card className="flex flex-col gap-4">
    <CardHeader title="Cambiar contraseña" />
    <form onSubmit={change} className="flex flex-col gap-4" noValidate>
      {/* Lets password managers pair the new password with the account. */}
      <input type="email" name="username" value={email ?? ''} autoComplete="username" readOnly hidden />
      <Field label="Contraseña actual"><PasswordInput name="currentPassword" autoComplete="current-password" required /></Field>
      <Field label="Nueva contraseña" help="Mínimo 10 caracteres."><PasswordInput name="newPassword" minLength={10} autoComplete="new-password" required /></Field>
      <Field label="Repite la nueva contraseña"><PasswordInput name="newPasswordConfirmation" minLength={10} autoComplete="new-password" required /></Field>
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      <div className="flex justify-end"><Button type="submit" variant="secondary" icon={KeyRound} disabled={pending} className="w-full sm:w-auto">{pending ? 'Cambiando…' : 'Cambiar contraseña'}</Button></div>
    </form>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </Card>
}
