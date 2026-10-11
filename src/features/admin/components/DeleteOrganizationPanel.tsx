'use client'

import { Trash2 } from 'lucide-react'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Button, CardHeader, Field, Input, Textarea } from '@/shared/ui'

type Props = { organizationId: number; organizationName: string; hasActivity: boolean; onDeleted: (message: string) => void }

// Only an organization without activity can be deleted; one with history is archived
// (product owner, 2026-10-11). The server re-checks every condition.
export function DeleteOrganizationPanel({ organizationId, organizationName, hasActivity, onDeleted }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '')
    startTransition(async () => {
      const { error: deleteError } = await supabase.rpc('delete_empty_organization', { target_organization_id: organizationId, confirm_name: confirmName, change_reason: reason } as never)
      if (deleteError) return setError(friendlyError(deleteError, 'No pudimos eliminar la organización.'))
      onDeleted(`${organizationName} eliminada.`)
    })
  }

  return <div className="flex flex-col gap-3">
    <CardHeader title="Eliminar organización" />
    {hasActivity
      ? <p className="text-[13px] text-text-muted">Tiene actividad registrada (clientes, pedidos o cobros), así que no se puede eliminar. Si deja de usar LensSpace, ponla como «Archivada»: nadie de la óptica podrá entrar, los datos se guardan y puedes restaurarla.</p>
      : <p className="text-[13px] text-text-muted">Sin actividad registrada: se puede eliminar del todo (por ejemplo, si se creó por error o se fue durante la prueba sin usarla). No se puede deshacer. La cuenta del dueño no se borra.</p>}
    {!hasActivity && !open ? <div><Button size="sm" variant="danger" icon={Trash2} onClick={() => { setError(''); setOpen(true) }}>Eliminar organización</Button></div> : null}
    {!hasActivity && open ? <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-coral-line p-4">
      <Field label={`Escribe «${organizationName}» para confirmar`}><Input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} autoComplete="off" required /></Field>
      <Field label="Motivo" help="Queda registrado en la auditoría de la plataforma."><Textarea name="reason" required minLength={10} maxLength={500} rows={2} /></Field>
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
        <Button size="sm" type="submit" variant="danger" disabled={pending || confirmName.trim() !== organizationName}>{pending ? 'Eliminando…' : 'Eliminar definitivamente'}</Button>
      </div>
    </form> : null}
  </div>
}
