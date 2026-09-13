'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const modules = [
  ['optical_sales', 'Ventas ópticas'], ['cashbox', 'Caja'], ['production', 'Producción'],
  ['whatsapp', 'WhatsApp'], ['analytics', 'Analítica'], ['multi_branch', 'Multisucursal'],
] as const

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
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

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
    <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Control de plataforma</p><h2 className="mt-1 font-display text-xl font-bold text-[#07322F]">Organizaciones y uso</h2></div><span className="rounded bg-[#E2F4F1] px-3 py-1 text-sm font-semibold text-[#0D7A72]">{organizations.length}</span></div>
    <div className="mt-4 space-y-4">{organizations.map(organization => {
      const subscription = organization.subscription
      const isOpen = openId === organization.id
      return <article key={organization.id} className="overflow-hidden rounded-[10px] border border-[#E3EFED] bg-white">
        <button type="button" onClick={() => setOpenId(isOpen ? null : organization.id)} className="flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left">
          <div><span className="font-display text-lg font-bold text-[#07322F]">{organization.name}</span><p className="mt-1 text-xs text-[#74857F]">{organization.order_prefix} · {organization.owners.map(owner => owner.display_name).join(', ') || 'Sin propietario'} · {organization.branches.length} sucursal(es)</p></div>
          <div className="flex items-center gap-2"><span className={`rounded px-2 py-1 text-[11px] font-semibold ${organization.status === 'active' ? 'bg-[#D9F5EE] text-[#07655C]' : 'bg-[#FFF0EB] text-[#C23C1C]'}`}>{organization.status}</span><span className="text-sm text-[#0D7A72]">{isOpen ? 'Cerrar' : 'Administrar'}</span></div>
        </button>
        <div className="grid grid-cols-2 gap-px border-y border-[#EEF5F4] bg-[#EEF5F4] sm:grid-cols-3 lg:grid-cols-6">{[
          ['Clientes', organization.usage?.customers ?? 0], ['Pedidos', organization.usage?.orders ?? 0], ['Miembros', organization.usage?.members ?? 0], ['Producción abierta', organization.usage?.openProductionJobs ?? 0], ['Mensajes', organization.usage?.notificationAttempts ?? 0], ['Última actividad', organization.usage?.lastActivityAt ? new Date(organization.usage.lastActivityAt).toLocaleDateString('es-CU') : '—'],
        ].map(([label, value]) => <div key={label} className="bg-[#FBFEFD] p-3"><p className="text-[11px] text-[#74857F]">{label}</p><p className="mt-1 font-display text-sm font-bold text-[#07322F]">{value}</p></div>)}</div>
        {isOpen ? <div className="grid gap-6 p-5 xl:grid-cols-[2fr_1fr]">
          <form onSubmit={event => save(event, organization.id)} className="space-y-4"><h3 className="font-display font-semibold text-[#07322F]">Contrato y operación</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><select name="organizationStatus" defaultValue={organization.status} className={field}><option value="active">Organización activa</option><option value="suspended">Suspendida</option><option value="archived">Archivada</option></select><select name="subscriptionStatus" defaultValue={subscription?.status} className={field}><option value="trial">Prueba</option><option value="active">Activa</option><option value="expired">Vencida</option><option value="suspended">Suspendida</option></select><input aria-label="Importe" name="amount" type="number" min="0" step="0.01" defaultValue={subscription?.amount ?? 0} className={field} /><input aria-label="Moneda" name="currency" pattern="[A-Za-z]{3}" defaultValue={subscription?.currency ?? 'USD'} className={field} /><select name="billingPeriod" defaultValue={subscription?.billing_period ?? 'monthly'} className={field}><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="annual">Anual</option><option value="custom">Personalizada</option></select><input aria-label="Inicio" name="startsOn" type="date" defaultValue={subscription?.starts_on} className={field} /><input aria-label="Vencimiento" name="expiresOn" type="date" defaultValue={subscription?.expires_on} className={field} /></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-[#EEF5F4] p-3 text-sm text-[#4A5B58]"><input type="checkbox" name={key} defaultChecked={organization.modules.some(module => module.module_key === key && module.is_enabled)} />{label}</label>)}</div>
            <textarea name="reason" minLength={10} maxLength={500} required placeholder="Motivo auditado del cambio" className={field} /><button disabled={pending} className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Guardar cambios</button>
          </form>
          <div><h3 className="font-display font-semibold text-[#07322F]">Asistencia auditada</h3>{organization.supportSession ? <div className="mt-3 rounded-lg bg-[#FFF6F2] p-4 text-sm text-[#7A3A26]"><p className="font-semibold">Sesión activa hasta {new Date(organization.supportSession.expires_at).toLocaleTimeString('es-CU')}</p><p className="mt-1 text-xs">{organization.supportSession.reason}</p><button type="button" disabled={pending} onClick={() => endSupport(organization.supportSession!.id)} className="mt-3 font-semibold underline">Cerrar asistencia</button></div> : <form onSubmit={event => startSupport(event, organization.id)} className="mt-3 space-y-3"><textarea name="supportReason" minLength={10} maxLength={500} required placeholder="Motivo y alcance de la asistencia" className={field} /><select name="duration" defaultValue="30" className={field}><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">1 hora</option><option value="120">2 horas</option></select><button disabled={pending} className="w-full rounded-[7px] border border-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-[#0D7A72] disabled:opacity-50">Iniciar asistencia</button></form>}<a href="/catalog" className="mt-4 block text-sm font-semibold text-[#0D7A72] underline">Administrar catálogo base</a></div>
        </div> : null}
      </article>
    })}</div>
    {message ? <p role="status" className="mt-4 rounded-lg bg-[#F0FBF9] px-4 py-3 text-sm text-[#0D7A72]">{message}</p> : null}
  </section>
}
