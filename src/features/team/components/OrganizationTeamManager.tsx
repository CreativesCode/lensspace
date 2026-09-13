'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'

type ManagedRole = 'seller' | 'lens_provider' | 'mounting_provider'
type TeamMember = {
  id: number
  displayName: string
  role: string
  status: string
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
          <select
            className={inputClass}
            value={role}
            onChange={(event) => setRole(event.target.value as ManagedRole)}
          >
            <option value="seller">Vendedor</option>
            <option value="lens_provider">Cristalero/laboratorio</option>
            <option value="mounting_provider">Montador</option>
          </select>
        </label>
        {role === 'seller' ? (
          <label className="text-sm font-medium text-slate-700">
            Sucursal
            <select className={inputClass} name="branchId" required>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
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
