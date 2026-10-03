'use client'

import { Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Button, Card, CardHeader, Field, Input, Toast } from '@/shared/ui'

const phonePattern = /^\+?[\d\s()-]{7,20}$/

// The contact phone signs the WhatsApp notices customers receive from the app's number.
export function ProfileDetailsForm({ userId, email, displayName, phone }: { userId: string; email: string | null; displayName: string; phone: string | null }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [pending, startTransition] = useTransition()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nextName = String(form.get('displayName') ?? '').trim()
    const nextPhone = String(form.get('phone') ?? '').trim()
    if (nextName.length < 2) return setError('Escribe tu nombre (al menos 2 caracteres).')
    if (nextPhone && !phonePattern.test(nextPhone)) return setError('Escribe un teléfono válido, por ejemplo +53 5256 4206.')
    startTransition(async () => {
      const { error: updateError } = await supabase.from('profiles').update({ display_name: nextName, phone: nextPhone || null } as never).eq('user_id', userId)
      if (updateError) return setError(friendlyError(updateError, 'No pudimos guardar tu perfil. Inténtalo nuevamente.'))
      setError('')
      setToast('Datos guardados.')
      // The sidebar name and the WhatsApp signature come from the layout.
      router.refresh()
    })
  }

  return <Card className="flex flex-col gap-4">
    <CardHeader title="Datos personales" />
    <form onSubmit={save} className="flex flex-col gap-4" noValidate>
      <Field label="Nombre"><Input name="displayName" defaultValue={displayName} maxLength={120} autoComplete="name" required /></Field>
      <Field label="Teléfono de contacto" optional help="Aparece en los WhatsApp que reciben tus clientes para que sepan a quién escribir si tienen dudas.">
        <Input name="phone" type="tel" inputMode="tel" defaultValue={phone ?? ''} maxLength={20} autoComplete="tel" placeholder="+53 5256 4206" />
      </Field>
      <Field label="Correo" help="Es tu usuario para entrar. Para cambiarlo, pídelo al administrador de la plataforma.">
        <Input value={email ?? ''} readOnly disabled />
      </Field>
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      <div className="flex justify-end"><Button type="submit" icon={Save} disabled={pending} className="w-full sm:w-auto">{pending ? 'Guardando…' : 'Guardar datos'}</Button></div>
    </form>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </Card>
}
