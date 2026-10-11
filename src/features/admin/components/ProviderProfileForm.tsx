'use client'

import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Button, Field, Input, Textarea } from '@/shared/ui'

export type ProviderProfile = Tables<'platform_provider_profile'>

// Provider (platform owner) legal data printed on every contract proforma.
export function ProviderProfileForm({ profile, onSaved }: { profile: ProviderProfile | null; onSaved: (message: string) => void }) {
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '').trim() || null
    startTransition(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { error: saveError } = await supabase.from('platform_provider_profile').upsert({
        id: true, legal_name: text('legalName') ?? '', identification: text('identification'), address: text('address'),
        phone: text('phone'), email: text('email'), payment_instructions: text('paymentInstructions'), updated_by: session?.user.id ?? null,
      } as never)
      if (saveError) return setError(friendlyError(saveError, 'No pudimos guardar los datos del proveedor.'))
      setError('')
      onSaved('Datos del proveedor guardados. Las próximas proformas los usarán.')
    })
  }

  return <form onSubmit={save} className="flex flex-col gap-4">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Field label="Nombre legal o del negocio"><Input name="legalName" required minLength={2} maxLength={200} defaultValue={profile?.legal_name ?? ''} /></Field>
      <Field label="Carné o NIT" optional><Input name="identification" maxLength={60} defaultValue={profile?.identification ?? ''} /></Field>
      <Field label="Teléfono" optional><Input name="phone" type="tel" maxLength={40} defaultValue={profile?.phone ?? ''} /></Field>
      <Field label="Correo" optional><Input name="email" type="email" maxLength={200} defaultValue={profile?.email ?? ''} /></Field>
    </div>
    <Field label="Dirección" optional><Input name="address" maxLength={300} defaultValue={profile?.address ?? ''} /></Field>
    <Field label="Cómo pagar" optional help="Sale en la cláusula de pago: efectivo, transferencia, Zelle…"><Textarea name="paymentInstructions" maxLength={1000} rows={3} defaultValue={profile?.payment_instructions ?? ''} /></Field>
    {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
    <div className="flex justify-end"><Button type="submit" variant="ink" disabled={pending}>{pending ? 'Guardando…' : 'Guardar datos'}</Button></div>
  </form>
}
