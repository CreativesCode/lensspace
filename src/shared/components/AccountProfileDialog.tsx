'use client'

import { Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { Alert, Avatar, Button, Dialog, Field, Input } from '@/shared/ui'

import type { ShellIdentity } from './SidebarAccount'

const phonePattern = /^\+?[\d\s()-]{7,20}$/

// The contact phone signs the WhatsApp notices customers receive from the app's number.
export function AccountProfileDialog({ identity }: { identity: ShellIdentity }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const displayName = String(form.get('displayName') ?? '').trim()
    const phone = String(form.get('phone') ?? '').trim()
    if (displayName.length < 2) return setError('Escribe tu nombre.')
    if (phone && !phonePattern.test(phone)) return setError('Escribe un teléfono válido, por ejemplo +53 5256 4206.')
    startTransition(async () => {
      const { error: updateError } = await supabase.from('profiles').update({ display_name: displayName, phone: phone || null } as never).eq('user_id', identity.userId)
      if (updateError) return setError('No pudimos guardar tu perfil. Inténtalo nuevamente.')
      setError('')
      setOpen(false)
      router.refresh()
    })
  }

  return <>
    <button type="button" onClick={() => { setError(''); setOpen(true) }} title="Mi perfil" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint">
      <Avatar name={identity.displayName} size="sm" strong />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-on-ink-text">{identity.displayName}</span>
        <span className="block truncate text-xs text-on-ink-subtle">{identity.roleLabel}</span>
      </span>
    </button>
    <Dialog
      open={open}
      onClose={() => { if (!pending) setOpen(false) }}
      eyebrow={identity.organizationName}
      title="Mi perfil"
      size="sm"
      footer={<>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
        <Button type="submit" form="account-profile" icon={Save} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </>}
    >
      <form id="account-profile" onSubmit={save} className="flex flex-col gap-4" noValidate>
        <Field label="Nombre"><Input name="displayName" defaultValue={identity.displayName} maxLength={120} autoComplete="name" required /></Field>
        <Field label="Teléfono de contacto" optional help="Aparece en los WhatsApp que reciben tus clientes para que sepan a quién escribir si tienen dudas.">
          <Input name="phone" type="tel" inputMode="tel" defaultValue={identity.phone ?? ''} maxLength={20} autoComplete="tel" placeholder="+53 5256 4206" />
        </Field>
        {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      </form>
    </Dialog>
  </>
}
