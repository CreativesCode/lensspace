'use client'

import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FormSelect } from '@/shared/components'
import { OrganizationOnboardingForm } from './OrganizationOnboardingForm'

const modules = [
  ['optical_sales', 'Ventas ópticas'], ['cashbox', 'Caja'], ['production', 'Producción'],
  ['whatsapp', 'WhatsApp'], ['analytics', 'Analítica'], ['multi_branch', 'Multisucursal'],
] as const

const organizationStatusLabels: Record<string, string> = {
  active: 'Activa',
  suspended: 'Suspendida',
  archived: 'Archivada',
}

export type PlatformOrganization = {
  id: number; name: string; order_prefix: string; status: string
  branches: { id: number; name: string; is_active: boolean }[]
  owners: { display_name: string }[]
  subscription?: { status: string; amount: number; currency: string; billing_period: string; starts_on: string; expires_on: string }
  modules: { module_key: string; is_enabled: boolean }[]
  usage?: { customers: number; orders: number; members: number; openProductionJobs: number; notificationAttempts: number; lastActivityAt: string | null }
  supportSession?: { id: number; reason: string; started_at: string; expires_at: string }
}

const field = 'w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'

export function PlatformAdminWorkspace({ organizations }: { organizations: PlatformOrganization[] }) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [openId, setOpenId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const filteredOrganizations = organizations.filter((organization) => {
    const term = query.trim().toLocaleLowerCase('es')
    const matchesQuery = !term || [organization.name, organization.order_prefix, ...organization.owners.map(({ display_name }) => display_name)].some((value) => value.toLocaleLowerCase('es').includes(term))
    return matchesQuery && (statusFilter === 'all' || organization.status === statusFilter)
  })

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setOpenId(null); setCreateOpen(false) }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  function save(event: FormEvent<HTMLFormElement>, organizationId: number) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const selectedModules = modules.filter(([key]) => form.get(key) === 'on').map(([key]) => key)
    startTransition(async () => {
      const { error } = await supabase.rpc('update_platform_organization', {
        target_organization_id: organizationId,
        target_organization_status: String(form.get('organizationStatus')),
        target_subscription_status: String(form.get('subscriptionStatus')),
        target_amount: Number(form.get('amount')),
        target_currency: String(form.get('currency')),
        target_billing_period: String(form.get('billingPeriod')),
        target_starts_on: String(form.get('startsOn')),
        target_expires_on: String(form.get('expiresOn')),
        target_module_keys: selectedModules,
        change_reason: String(form.get('reason')),
      } as never)
      if (error) return setMessage(error.message)
      setMessage('Contrato y controles operativos actualizados con auditoría.')
      router.refresh()
    })
  }

  function startSupport(event: FormEvent<HTMLFormElement>, organizationId: number) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const { error } = await supabase.rpc('begin_platform_support_session', {
        target_organization_id: organizationId,
        support_reason: String(form.get('supportReason')),
        duration_minutes: Number(form.get('duration')),
      } as never)
      if (error) return setMessage(error.message)
      setMessage('Sesión de asistencia iniciada y auditada.')
      router.refresh()
    })
  }

  function endSupport(sessionId: number) {
    startTransition(async () => {
      const { error } = await supabase.rpc('end_platform_support_session', { target_session_id: sessionId } as never)
      if (error) return setMessage(error.message)
      setMessage('Sesión de asistencia cerrada.')
      router.refresh()
    })
  }

  return <section className="mt-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Control de plataforma</p><h2 className="mt-1 font-display text-xl font-bold text-[#07322F]">Directorio de organizaciones</h2></div><button type="button" onClick={() => setCreateOpen(true)} className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white">+ Nueva organización</button></div>
    <div className="mt-5 grid gap-3 rounded-[10px] border border-[#E3EFED] bg-white p-4 sm:grid-cols-[1fr_220px_auto]"><input value={query} onChange={(event) => setQuery(event.target.value)} className={field} type="search" placeholder="Buscar por nombre, prefijo o propietario" aria-label="Buscar organizaciones" /><FormSelect ariaLabel="Filtrar por estado" value={statusFilter} onValueChange={setStatusFilter} options={[{ value: 'all', label: 'Todos los estados' }, { value: 'active', label: 'Activas' }, { value: 'suspended', label: 'Suspendidas' }, { value: 'archived', label: 'Archivadas' }]} /><span className="self-center text-sm font-semibold text-[#0D7A72]">{filteredOrganizations.length} de {organizations.length}</span></div>
    <div className="mt-4 space-y-3">{filteredOrganizations.map(organization => {
      const subscription = organization.subscription
      const isOpen = openId === organization.id
      return <article key={organization.id} className="overflow-hidden rounded-[10px] border border-[#E3EFED] bg-white">
        <button type="button" onClick={() => setOpenId(organization.id)} className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left hover:bg-[#F7FBFA]">
          <div><span className="font-display text-lg font-bold text-[#07322F]">{organization.name}</span><p className="mt-1 text-xs text-[#74857F]">{organization.order_prefix} · {organization.owners.map(owner => owner.display_name).join(', ') || 'Sin propietario'} · {organization.branches.length} sucursal(es)</p></div>
          <div className="flex items-center gap-2"><span className={`rounded px-2 py-1 text-[11px] font-semibold ${organization.status === 'active' ? 'bg-[#D9F5EE] text-[#07655C]' : 'bg-[#FFF0EB] text-[#C23C1C]'}`}>{organizationStatusLabels[organization.status] ?? 'Estado desconocido'}</span><span className="text-sm font-semibold text-[#0D7A72]">Ver detalles</span></div>
        </button>
        <div className="grid grid-cols-2 gap-px border-y border-[#EEF5F4] bg-[#EEF5F4] sm:grid-cols-3 lg:grid-cols-6">{[
          ['Clientes', organization.usage?.customers ?? 0], ['Pedidos', organization.usage?.orders ?? 0], ['Miembros', organization.usage?.members ?? 0], ['Producción abierta', organization.usage?.openProductionJobs ?? 0], ['Mensajes', organization.usage?.notificationAttempts ?? 0], ['Última actividad', organization.usage?.lastActivityAt ? new Date(organization.usage.lastActivityAt).toLocaleDateString('es-CU') : '—'],
        ].map(([label, value]) => <div key={label} className="bg-[#FBFEFD] p-3"><p className="text-[11px] text-[#74857F]">{label}</p><p className="mt-1 font-display text-sm font-bold text-[#07322F]">{value}</p></div>)}</div>
        {isOpen ? <div role="dialog" aria-modal="true" aria-labelledby={`organization-${organization.id}-title`} className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#07322F]/60 p-3 sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenId(null) }}><div className="max-h-[90vh] min-w-0 w-full max-w-6xl overflow-x-hidden overflow-y-auto rounded-[12px] bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E3EFED] bg-white p-5"><div className="min-w-0"><p className="truncate text-xs text-[#74857F]">{organization.order_prefix} · ID {organization.id}</p><h2 id={`organization-${organization.id}-title`} className="truncate font-display text-xl font-bold text-[#07322F]">{organization.name}</h2></div><button type="button" onClick={() => setOpenId(null)} className="rounded-lg border border-[#DCECEA] px-3 py-2 text-sm font-semibold text-[#07322F]">Cerrar</button></div><div className="grid min-w-0 gap-6 p-4 sm:p-5 xl:grid-cols-[2fr_1fr]">
          <form onSubmit={event => save(event, organization.id)} className="min-w-0 space-y-4"><h3 className="font-display font-semibold text-[#07322F]">Contrato y operación</h3><div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"><FormSelect name="organizationStatus" ariaLabel="Estado de la organización" defaultValue={organization.status} options={[{ value: 'active', label: 'Organización activa' }, { value: 'suspended', label: 'Suspendida' }, { value: 'archived', label: 'Archivada' }]} /><FormSelect name="subscriptionStatus" ariaLabel="Estado de la suscripción" defaultValue={subscription?.status} options={[{ value: 'trial', label: 'Prueba' }, { value: 'active', label: 'Activa' }, { value: 'expired', label: 'Vencida' }, { value: 'suspended', label: 'Suspendida' }]} /><input aria-label="Importe" name="amount" type="number" min="0" step="0.01" defaultValue={subscription?.amount ?? 0} className={field} /><input aria-label="Moneda" name="currency" pattern="[A-Za-z]{3}" defaultValue={subscription?.currency ?? 'USD'} className={field} /><FormSelect name="billingPeriod" ariaLabel="Periodicidad" defaultValue={subscription?.billing_period ?? 'monthly'} options={[{ value: 'monthly', label: 'Mensual' }, { value: 'quarterly', label: 'Trimestral' }, { value: 'semiannual', label: 'Semestral' }, { value: 'annual', label: 'Anual' }, { value: 'custom', label: 'Personalizada' }]} /><input aria-label="Inicio" name="startsOn" type="date" defaultValue={subscription?.starts_on} className={field} /><input aria-label="Vencimiento" name="expiresOn" type="date" defaultValue={subscription?.expires_on} className={field} /></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-[#EEF5F4] p-3 text-sm text-[#4A5B58]"><input type="checkbox" name={key} defaultChecked={organization.modules.some(module => module.module_key === key && module.is_enabled)} />{label}</label>)}</div>
            <textarea name="reason" minLength={10} maxLength={500} required placeholder="Motivo auditado del cambio" className={field} /><button disabled={pending} className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Guardar cambios</button>
          </form>
          <div><h3 className="font-display font-semibold text-[#07322F]">Asistencia auditada</h3>{organization.supportSession ? <div className="mt-3 rounded-lg bg-[#FFF6F2] p-4 text-sm text-[#7A3A26]"><p className="font-semibold">Sesión activa hasta {new Date(organization.supportSession.expires_at).toLocaleTimeString('es-CU')}</p><p className="mt-1 text-xs">{organization.supportSession.reason}</p><button type="button" disabled={pending} onClick={() => endSupport(organization.supportSession!.id)} className="mt-3 font-semibold underline">Cerrar asistencia</button></div> : <form onSubmit={event => startSupport(event, organization.id)} className="mt-3 space-y-3"><textarea name="supportReason" minLength={10} maxLength={500} required placeholder="Motivo y alcance de la asistencia" className={field} /><FormSelect name="duration" ariaLabel="Duración de la asistencia" defaultValue="30" options={[{ value: '15', label: '15 minutos' }, { value: '30', label: '30 minutos' }, { value: '60', label: '1 hora' }, { value: '120', label: '2 horas' }]} /><button disabled={pending} className="w-full rounded-[7px] border border-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-[#0D7A72] disabled:opacity-50">Iniciar asistencia</button></form>}<a href="/catalog" className="mt-4 block text-sm font-semibold text-[#0D7A72] underline">Administrar catálogo base</a></div>
        </div></div></div> : null}
      </article>
    })}</div>
    {!filteredOrganizations.length ? <p className="mt-4 rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-center text-sm text-[#74857F]">No hay organizaciones que coincidan con los filtros.</p> : null}
    {createOpen ? <div role="dialog" aria-modal="true" aria-labelledby="create-organization-title" className="fixed inset-0 z-50 grid place-items-center bg-[#07322F]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false) }}><div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[12px] bg-[#F7FBFA] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E3EFED] bg-white p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0D7A72]">Alta de tenant</p><h2 id="create-organization-title" className="font-display text-xl font-bold text-[#07322F]">Nueva organización</h2></div><button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-[#DCECEA] px-3 py-2 text-sm font-semibold text-[#07322F]">Cerrar</button></div><div className="p-5"><OrganizationOnboardingForm onCreated={() => setCreateOpen(false)} /></div></div></div> : null}
    {message ? <p role="status" className="mt-4 rounded-lg bg-[#F0FBF9] px-4 py-3 text-sm text-[#0D7A72]">{message}</p> : null}
  </section>
}
