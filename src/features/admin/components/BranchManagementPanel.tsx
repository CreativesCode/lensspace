'use client'

import { Plus, Power, Star } from 'lucide-react'
import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Badge, Button, CardHeader, Field, Input, Textarea } from '@/shared/ui'

type Branch = { id: number; name: string; code: string; is_active: boolean; is_primary: boolean }
type Props = {
  organizationId: number
  branches: Branch[]
  multiBranchEnabled: boolean
  // 1 + extra branches of the signed contract (the server enforces the same rule).
  branchLimit: number
  // Extra branches of a draft contract: they count only once its signed copy is uploaded.
  draftExtraBranches: number | null
  onChanged: (message: string) => void
}
type Action = { kind: 'create' } | { kind: 'edit' | 'toggle' | 'primary'; branch: Branch }

const actionTitles = { create: 'Nueva sucursal', edit: 'Editar sucursal', toggle: '', primary: 'Hacer principal' }

// Only the platform admin creates and changes branches (product owner, 2026-10-10).
export function BranchManagementPanel({ organizationId, branches, multiBranchEnabled, branchLimit, draftExtraBranches, onChanged }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [action, setAction] = useState<Action | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const activeCount = branches.filter(({ is_active }) => is_active).length
  const canCreate = multiBranchEnabled && activeCount < branchLimit

  function open(next: Action) {
    setError('')
    setAction(next)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '')
    const code = String(form.get('code') ?? '')
    const reason = String(form.get('reason') ?? '')
    startTransition(async () => {
      const { error: rpcError } = action.kind === 'create'
        ? await supabase.rpc('create_branch', { target_organization_id: organizationId, branch_name: name, branch_code: code, change_reason: reason } as never)
        : action.kind === 'edit'
          ? await supabase.rpc('update_branch', { target_branch_id: action.branch.id, branch_name: name, branch_code: code, change_reason: reason } as never)
          : action.kind === 'toggle'
            ? await supabase.rpc('set_branch_active', { target_branch_id: action.branch.id, target_active: !action.branch.is_active, change_reason: reason } as never)
            : await supabase.rpc('set_primary_branch', { target_branch_id: action.branch.id, change_reason: reason } as never)
      if (rpcError) return setError(friendlyError(rpcError, 'No pudimos guardar el cambio de la sucursal.'))
      setAction(null)
      onChanged(action.kind === 'create' ? 'Sucursal creada.' : action.kind === 'edit' ? 'Sucursal actualizada.'
        : action.kind === 'primary' ? 'Sucursal principal cambiada.' : action.branch.is_active ? 'Sucursal desactivada.' : 'Sucursal reactivada.')
    })
  }

  const title = action ? (action.kind === 'toggle' ? (action.branch.is_active ? 'Desactivar sucursal' : 'Reactivar sucursal') : actionTitles[action.kind]) : ''
  const editing = action?.kind === 'edit' ? action.branch : null

  return <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <CardHeader title="Sucursales" />
      <Button size="sm" variant="secondary" icon={Plus} onClick={() => open({ kind: 'create' })} disabled={pending || !canCreate}>Nueva sucursal</Button>
    </div>
    <p className="text-[13px] text-text-muted">
      {activeCount} de {branchLimit} activas según el contrato firmado.
      {!multiBranchEnabled ? ' Activa el módulo Multisucursal para crear más; sin él, solo la principal opera y las demás quedan en solo lectura.' : ''}
      {multiBranchEnabled && !canCreate
        ? draftExtraBranches !== null && 1 + draftExtraBranches > branchLimit
          ? ` El borrador del contrato incluye ${draftExtraBranches} sucursal(es) extra: cuentan cuando subas el contrato firmado.`
          : ' Para otra sucursal, prepara un contrato con más sucursales extra y sube el firmado.'
        : ''}
    </p>

    <ul className="flex flex-col gap-2">
      {branches.map((branch) => <li key={branch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line px-3 py-2">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ink">{branch.name}</span>
          <span className="text-text-muted">{branch.code}</span>
          {branch.is_primary ? <Badge tone="progress">Principal</Badge> : null}
          {!branch.is_active ? <Badge tone="neutral">Inactiva</Badge> : null}
        </span>
        <span className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={() => open({ kind: 'edit', branch })} disabled={pending}>Editar</Button>
          {branch.is_active && !branch.is_primary ? <Button size="sm" variant="ghost" icon={Star} onClick={() => open({ kind: 'primary', branch })} disabled={pending}>Hacer principal</Button> : null}
          {!branch.is_primary ? <Button size="sm" variant={branch.is_active ? 'danger' : 'secondary'} icon={Power} onClick={() => open({ kind: 'toggle', branch })} disabled={pending}>{branch.is_active ? 'Desactivar' : 'Reactivar'}</Button> : null}
        </span>
      </li>)}
    </ul>

    {action ? <form key={`${action.kind}-${'branch' in action ? action.branch.id : 'new'}`} onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-line p-4">
      <p className="font-display text-[15px] font-semibold text-ink">{title}{'branch' in action ? `: ${action.branch.name}` : ''}</p>
      {action.kind === 'create' || action.kind === 'edit' ? <div className="grid min-w-0 gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="Nombre"><Input name="name" required maxLength={120} defaultValue={editing?.name ?? ''} /></Field>
        <Field label="Código" help="Letras y números, p. ej. CEN."><Input name="code" required maxLength={16} pattern="[A-Za-z0-9_\-]{1,16}" defaultValue={editing?.code ?? ''} /></Field>
      </div> : null}
      {action.kind === 'toggle' && action.branch.is_active ? <p className="text-[13px] text-text-muted">Sus datos quedan en solo lectura. No se puede desactivar con pedidos sin entregar, cobros sin cerrar en caja o vendedores asignados.</p> : null}
      <Field label="Motivo" help="Queda registrado en la auditoría."><Textarea name="reason" required minLength={10} maxLength={500} rows={2} /></Field>
      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => setAction(null)} disabled={pending}>Cancelar</Button>
        <Button type="submit" variant="ink" disabled={pending}>{pending ? 'Guardando…' : 'Confirmar'}</Button>
      </div>
    </form> : null}
  </div>
}
