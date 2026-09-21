'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormSelect } from '@/shared/components'

type ManagedRole = 'seller' | 'lens_provider' | 'mounting_provider'
type TeamMember = { id: number; displayName: string; role: string; status: string; branchId: number | null; branchName: string | null }
type Branch = { id: number; name: string }
const roleLabels: Record<string, string> = { owner: 'Propietario', seller: 'Vendedor', lens_provider: 'Cristalero/laboratorio', mounting_provider: 'Montador' }
const statusLabels: Record<string, string> = { active: 'Activo', inactive: 'Inactivo', invited: 'Invitado' }

export function OrganizationTeamManager({ organizationId, organizationName, branches, members, canManage }: { organizationId: number; organizationName: string; branches: Branch[]; members: TeamMember[]; canManage: boolean }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [role, setRole] = useState<ManagedRole>('seller')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editingBranchId, setEditingBranchId] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inviteButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!inviteOpen && !editingMember) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setInviteOpen(false); setEditingMember(null) } }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', closeOnEscape) }
  }, [inviteOpen, editingMember])

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage(null)
    const form = event.currentTarget
    const data = new FormData(form)
    const { error } = await supabase.functions.invoke('invite-organization-member', { body: { organizationId, branchId: role === 'seller' ? Number(data.get('branchId')) : null, role, displayName: data.get('displayName'), email: data.get('email') } })
    if (error) {
      let text = 'No se pudo procesar la invitación.'
      if (error.context instanceof Response) { const body = await error.context.json().catch(() => null) as { error?: string } | null; text = body?.error ?? text }
      setMessage(text); setPending(false); return
    }
    form.reset(); setRole('seller'); setMessage('Invitación procesada correctamente.'); setInviteOpen(false); router.refresh(); setPending(false); inviteButtonRef.current?.focus()
  }

  async function manageMember(member: TeamMember, nextStatus: 'active' | 'inactive', nextBranchId: number | null) {
    setPending(true); setMessage(null)
    const { error } = await supabase.rpc('manage_organization_member', { target_membership_id: member.id, target_status: nextStatus, target_branch_id: nextBranchId } as never)
    if (error) { setMessage(error.message || 'No se pudo actualizar el miembro.'); setPending(false); return }
    setMessage('Miembro actualizado correctamente.'); setEditingMember(null); router.refresh(); setPending(false)
  }

  function openMember(member: TeamMember) { setEditingMember(member); setEditingBranchId(String(member.branchId ?? '')); setMessage(null) }
  const field = 'mt-1 w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'

  return <section className="mt-8 rounded-[10px] border border-[#E3EFED] bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-xl font-semibold text-[#07322F]">Equipo de {organizationName}</h2><p className="mt-1 text-sm text-[#74857F]">{members.length} miembro{members.length === 1 ? '' : 's'}</p></div><button ref={inviteButtonRef} type="button" disabled={!canManage} onClick={() => { setMessage(null); setInviteOpen(true) }} className="rounded-[7px] bg-[#0D7A72] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Invitar miembro</button></div>
    {!canManage ? <p className="mt-4 rounded-lg bg-[#FFF6E8] px-4 py-3 text-sm text-[#7A5526]">La organización está en modo de solo lectura. Renueva o reactiva la suscripción para modificar el equipo.</p> : null}
    {message ? <p role="status" className="mt-4 text-sm text-[#4A5B58]">{message}</p> : null}
    <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-[#DCECEA] text-[#74857F]"><tr><th className="px-3 py-3 font-medium">Nombre</th><th className="px-3 py-3 font-medium">Rol</th><th className="px-3 py-3 font-medium">Sucursal</th><th className="px-3 py-3 font-medium">Estado</th><th className="px-3 py-3 font-medium">Acciones</th></tr></thead><tbody>{members.map((member) => <tr key={member.id} className="border-b border-[#EEF5F4]"><td className="px-3 py-4 font-medium text-[#07322F]">{member.displayName}</td><td className="px-3 py-4 text-[#4A5B58]">{roleLabels[member.role] ?? 'Rol desconocido'}</td><td className="px-3 py-4 text-[#4A5B58]">{member.branchName ?? 'Todas'}</td><td className="px-3 py-4"><span className="rounded-full bg-[#E2F4F1] px-2.5 py-1 text-xs font-semibold text-[#0D7A72]">{statusLabels[member.status] ?? 'Desconocido'}</span></td><td className="px-3 py-4">{member.role === 'owner' ? <span className="text-xs text-[#9AA9A6]">No editable</span> : <button type="button" disabled={!canManage} onClick={() => openMember(member)} className="rounded-[7px] border border-[#9BCDC6] px-3 py-2 text-sm font-semibold text-[#0D7A72] disabled:opacity-50">Gestionar</button>}</td></tr>)}</tbody></table></div>

    {inviteOpen ? <Dialog title="Invitar miembro" eyebrow={organizationName} onClose={() => { setInviteOpen(false); inviteButtonRef.current?.focus() }}><form onSubmit={inviteMember} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#4A5B58]">Nombre<input className={field} name="displayName" required autoFocus /></label><label className="text-sm font-semibold text-[#4A5B58]">Correo<input className={field} name="email" type="email" required /></label><label className="text-sm font-semibold text-[#4A5B58]">Rol<FormSelect className="mt-1" ariaLabel="Rol" value={role} menuPlacement="top" onValueChange={(value) => setRole(value as ManagedRole)} options={[{ value: 'seller', label: 'Vendedor' }, { value: 'lens_provider', label: 'Cristalero/laboratorio' }, { value: 'mounting_provider', label: 'Montador' }]} /></label>{role === 'seller' ? <label className="text-sm font-semibold text-[#4A5B58]">Sucursal<FormSelect className="mt-1" name="branchId" ariaLabel="Sucursal" required options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))} /></label> : null}<DialogActions pending={pending} onCancel={() => setInviteOpen(false)} submitLabel="Enviar invitación" /></form></Dialog> : null}

    {editingMember ? <Dialog title={`Gestionar a ${editingMember.displayName}`} eyebrow={roleLabels[editingMember.role] ?? 'Miembro'} onClose={() => setEditingMember(null)}><div className="space-y-4">{editingMember.role === 'seller' ? <label className="block text-sm font-semibold text-[#4A5B58]">Sucursal<FormSelect className="mt-1" ariaLabel={`Sucursal de ${editingMember.displayName}`} value={editingBranchId} onValueChange={setEditingBranchId} options={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))} /></label> : <p className="text-sm text-[#4A5B58]">Este proveedor no necesita una sucursal asignada.</p>}<div className="flex flex-wrap justify-end gap-3 border-t border-[#EEF5F4] pt-4"><button type="button" onClick={() => setEditingMember(null)} className="rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58]">Cancelar</button>{editingMember.role === 'seller' ? <button type="button" disabled={pending || !editingBranchId} onClick={() => void manageMember(editingMember, editingMember.status === 'inactive' ? 'inactive' : 'active', Number(editingBranchId))} className="rounded-[7px] bg-[#07322F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Guardar cambios</button> : null}<button type="button" disabled={pending} onClick={() => void manageMember(editingMember, editingMember.status === 'inactive' ? 'active' : 'inactive', editingMember.branchId)} className="rounded-[7px] border border-[#C96A52] px-4 py-2.5 text-sm font-semibold text-[#A34732] disabled:opacity-50">{editingMember.status === 'inactive' ? 'Reactivar acceso' : 'Desactivar acceso'}</button></div></div></Dialog> : null}
  </section>
}

function Dialog({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="team-dialog-title" className="fixed inset-0 z-50 grid place-items-center bg-[#07322F]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-[12px] bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-[#E3EFED] p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0D7A72]">{eyebrow}</p><h2 id="team-dialog-title" className="mt-1 font-display text-xl font-bold text-[#07322F]">{title}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="grid h-10 w-10 place-items-center rounded-lg border border-[#DCECEA] text-xl text-[#07322F]">×</button></div><div className="p-5">{children}</div></div></div>
}

function DialogActions({ pending, onCancel, submitLabel }: { pending: boolean; onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-3 border-t border-[#EEF5F4] pt-4 sm:col-span-2"><button type="button" onClick={onCancel} className="rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58]">Cancelar</button><button disabled={pending} className="rounded-[7px] bg-[#07322F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Procesando…' : submitLabel}</button></div>
}
