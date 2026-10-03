'use client'

import { Hash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Button, Card, CardHeader, Dialog, Field, Input, Toast } from '@/shared/ui'

// QA-50 (BUSINESS_LOGIC 'Numeración de pedidos'): the owner may change the prefix
// until the first order exists. The DB trigger enforces the lock; this is the UI.
export function OrderPrefixSetting({ organizationId, organizationName, orderPrefix, locked, canManage }: { organizationId: number; organizationName: string; orderPrefix: string; locked: boolean; canManage: boolean }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(orderPrefix)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const prefix = value.trim().toUpperCase()
    if (!/^[A-Z0-9]{3,8}$/.test(prefix)) return setError('Usa de 3 a 8 letras o números, sin espacios ni acentos.')
    setPending(true); setError(null)
    const { error: updateError } = await supabase.from('organizations').update({ order_prefix: prefix } as never).eq('id', organizationId)
    setPending(false)
    if (updateError) {
      if (updateError.code === '23505') return setError('Ese prefijo ya lo usa otra organización. Prueba con otro.')
      if (updateError.code === '23514') return setError('El prefijo ya no puede cambiar: la organización tiene pedidos.')
      return setError(friendlyError(updateError, 'No pudimos guardar el prefijo.'))
    }
    setOpen(false); setToast(`Prefijo actualizado: los pedidos serán ${prefix}-AÑO-000001.`); router.refresh()
  }

  return <Card className="flex flex-wrap items-center justify-between gap-3">
    <CardHeader title="Prefijo de pedidos" meta={locked ? `${orderPrefix} · fijo desde el primer pedido` : `${orderPrefix} · puedes cambiarlo hasta el primer pedido`} className="flex-1" />
    {!locked && canManage ? <Button variant="secondary" icon={Hash} onClick={() => { setValue(orderPrefix); setError(null); setOpen(true) }}>Cambiar prefijo</Button> : null}
    <Dialog
      open={open}
      onClose={() => { if (!pending) setOpen(false) }}
      eyebrow={organizationName}
      title="Prefijo de pedidos"
      icon={Hash}
      size="sm"
      footer={<>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
        <Button type="submit" form={`order-prefix-${organizationId}`} disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </>}
    >
      <form id={`order-prefix-${organizationId}`} onSubmit={save} className="flex flex-col gap-4" noValidate>
        <Field label="Prefijo" help={`Ejemplo de número: ${(value.trim().toUpperCase() || orderPrefix)}-${new Date().getFullYear()}-000001`}>
          <Input value={value} onChange={(event) => setValue(event.target.value.toUpperCase())} maxLength={8} autoCapitalize="characters" autoComplete="off" />
        </Field>
        {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      </form>
    </Dialog>
    {toast ? <Toast message={toast} onDismiss={() => setToast('')} /> : null}
  </Card>
}
