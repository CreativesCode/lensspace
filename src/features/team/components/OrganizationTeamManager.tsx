'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { FormSelect } from '@/shared/components'

type ManagedRole = 'seller' | 'lens_provider' | 'mounting_provider'
type TeamMember = {
  id: number
  displayName: string
  role: string
  status: string
  branchId: number | null
  branchName: string | null
}
type Branch = { id: number; name: string }

export function OrganizationTeamManager({
  organizationId,
  organizationName,
  branches,
  members,
  canManage,
}: {
  organizationId: number
  organizationName: string
  branches: Branch[]
  members: TeamMember[]
  canManage: boolean
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [role, setRole] = useState<ManagedRole>('seller')
  const [pending, setPending] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    const form = event.currentTarget
    const data = new FormData(form)
    const { error } = await supabase.functions.invoke(
      'invite-organization-member',
      {
        body: {
          organizationId,
          branchId: role === 'seller' ? Number(data.get('branchId')) : null,
          role,
          displayName: data.get('displayName'),
          email: data.get('email'),
        },
      },
    )

    if (error) {
      let text = 'No se pudo procesar la invitación.'
      if (error.context instanceof Response) {
        const body = (await error.context.json().catch(() => null)) as
          | { error?: string }
          | null
        text = body?.error ?? text
      }
      setMessage(text)
      setPending(false)
      return
    }

    form.reset()
    setRole('seller')
    setMessage('Invitación procesada correctamente.')
    router.refresh()
    setPending(false)
  }

  async function manageMember(
    member: TeamMember,
    nextStatus: 'active' | 'inactive',
    nextBranchId: number | null,
  ) {
    if (
      nextStatus === 'inactive' &&
      !window.confirm(`¿Desactivar el acceso de ${member.displayName}?`)
    ) {
      return
    }

    setPendingMemberId(member.id)
    setMessage(null)

    const { error } = await supabase.rpc('manage_organization_member', {
      target_membership_id: member.id,
      target_status: nextStatus,
      target_branch_id: nextBranchId,
    } as never)

    if (error) {
      setMessage(error.message || 'No se pudo actualizar el miembro.')
      setPendingMemberId(null)
      return
    }

    setMessage('Miembro actualizado correctamente.')
    router.refresh()
    setPendingMemberId(null)
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-100'

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">
        Equipo de {organizationName}
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Rol</th>
              <th className="px-3 py-2 font-medium">Sucursal</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-slate-100">
                <td className="px-3 py-3 font-medium text-slate-800">
                  {member.displayName}
                </td>
                <td className="px-3 py-3 text-slate-600">{member.role}</td>
                <td className="px-3 py-3 text-slate-600">
                  {member.branchName ?? 'Todas'}
                </td>
                <td className="px-3 py-3 text-slate-600">{member.status}</td>
                <td className="px-3 py-3">
                  {member.role === 'owner' ? (
                    <span className="text-xs text-slate-400">No editable</span>
                  ) : (
                    <div className="flex min-w-56 flex-wrap items-center gap-2">
                      {member.role === 'seller' ? (
                        <FormSelect
                          ariaLabel={`Sucursal de ${member.displayName}`}
                          className="min-w-40"
                          value={String(member.branchId ?? '')}
                          disabled={
                            !canManage ||
                            member.status === 'invited' ||
                            pendingMemberId === member.id
                          }
                          onValueChange={(value) =>
                            void manageMember(
                              member,
                              member.status === 'inactive' ? 'inactive' : 'active',
                              Number(value),
                            )
                          }
                          options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
                        />
                      ) : null}
                      <button
                        type="button"
                        disabled={!canManage || pendingMemberId === member.id}
                        onClick={() =>
                          void manageMember(
                            member,
                            member.status === 'inactive' ? 'active' : 'inactive',
                            member.branchId,
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pendingMemberId === member.id
                          ? 'Guardando…'
                          : member.status === 'inactive'
                            ? 'Reactivar'
                            : 'Desactivar'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={inviteMember} className="mt-6 grid gap-4 md:grid-cols-2">
        {!canManage ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 md:col-span-2">
            La organización está en modo de solo lectura. Renueva o reactiva la
            suscripción para modificar el equipo.
          </p>
        ) : null}
        <label className="text-sm font-medium text-slate-700">
          Nombre
          <input className={inputClass} name="displayName" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Correo
          <input className={inputClass} name="email" type="email" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Rol
          <FormSelect className="mt-1" ariaLabel="Rol" value={role} onValueChange={(value) => setRole(value as ManagedRole)} options={[{ value: 'seller', label: 'Vendedor' }, { value: 'lens_provider', label: 'Cristalero/laboratorio' }, { value: 'mounting_provider', label: 'Montador' }]} />
        </label>
        {role === 'seller' ? (
          <label className="text-sm font-medium text-slate-700">
            Sucursal
            <FormSelect className="mt-1" name="branchId" ariaLabel="Sucursal" required options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))} />
          </label>
        ) : null}
        {message ? (
          <p role="status" className="text-sm text-slate-600 md:col-span-2">
            {message}
          </p>
        ) : null}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={
              pending ||
              !canManage ||
              (role === 'seller' && branches.length === 0)
            }
            className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Procesando…' : 'Invitar miembro'}
          </button>
        </div>
      </form>
    </section>
  )
}
