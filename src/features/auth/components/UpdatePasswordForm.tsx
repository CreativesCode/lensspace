'use client'

import { KeyRound } from 'lucide-react'
import { useActionState } from 'react'

import { updatePassword, type PasswordState } from '../actions'
import { PasswordInput } from '@/shared/components'
import { Alert, Button, Field } from '@/shared/ui'

const initialState: PasswordState = { error: null }

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState,
  )

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      <Field label="Nueva contraseña" help="Mínimo 10 caracteres.">
        <PasswordInput name="password" minLength={10} autoComplete="new-password" required />
      </Field>
      <Field label="Repite la contraseña">
        <PasswordInput name="passwordConfirmation" minLength={10} autoComplete="new-password" required />
      </Field>
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <Button type="submit" size="lg" icon={KeyRound} block disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  )
}
