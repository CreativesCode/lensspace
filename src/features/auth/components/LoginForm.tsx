'use client'

import { LogIn } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'

import { login, type LoginState } from '../actions'
import { PasswordInput } from '@/shared/components'
import { Alert, Button, Field, Input } from '@/shared/ui'

const initialState: LoginState = { error: null }

export function LoginForm({ next = '/dashboard' }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-[18px]">
      <input type="hidden" name="next" value={next} />

      <Field label="Correo electrónico">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
          title="Escribe un correo válido, por ejemplo nombre@dominio.com"
          required
        />
      </Field>

      <Field label="Contraseña">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>

      {state.error ? <Alert tone="danger" role="alert">{state.error}</Alert> : null}

      <Button type="submit" size="lg" icon={LogIn} block disabled={pending}>
        {pending ? 'Entrando…' : 'Iniciar sesión'}
      </Button>
      <p className="text-center text-sm"><Link href="/forgot-password" className="font-semibold text-action hover:underline">¿Olvidaste tu contraseña?</Link></p>
    </form>
  )
}
