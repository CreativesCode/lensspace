'use client'

import { Mail } from 'lucide-react'
import { useActionState } from 'react'

import { requestPasswordReset, type ResetRequestState } from '../actions'
import { Alert, Button, Field, Input } from '@/shared/ui'

const initialState: ResetRequestState = { error: null, sent: false }

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState)

  if (state.sent) {
    return <Alert tone="success" role="status">Si el correo tiene una cuenta en LensSpace, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.</Alert>
  }

  return (
    <form action={formAction} className="flex flex-col gap-[18px]" noValidate>
      <Field label="Correo electrónico">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} required />
      </Field>
      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}
      <Button type="submit" size="lg" icon={Mail} block disabled={pending}>
        {pending ? 'Enviando…' : 'Enviar enlace'}
      </Button>
    </form>
  )
}
