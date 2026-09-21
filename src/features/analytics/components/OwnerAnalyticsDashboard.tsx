'use client'

import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormSelect } from '@/shared/components'

type Option = { id: number; name: string }
type Seller = { id: string; name: string; branchId: number | null }
type Metrics = {
  orders: { total: number; accepted: number; delivered: number; withIncidents: number }
  salesCup: number; collectionsCup: number; outstandingCup: number
  averageDeliveryHours: number | null; cashDifferenceCup: number
  bySeller: { seller_name: string; order_count: number; sales_cup: number }[]
  providerLoads: { provider_name: string; job_type: string; active_jobs: number }[]
  topItems: { name: string; category: string; quantity: number }[]
}

const money = (value: number) => Number(value ?? 0).toLocaleString('es-CU', { maximumFractionDigits: 2 })

export function OwnerAnalyticsDashboard({ organizationId, branches, sellers, defaultFrom, defaultTo }: { organizationId: number; branches: Option[]; sellers: Seller[]; defaultFrom: string; defaultTo: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function requestMetrics(branchId: number | null, sellerId: string | null, from: string, to: string) {
    startTransition(async () => {
      const { data, error } = await supabase.rpc('get_owner_dashboard', {
        target_organization_id: organizationId,
        target_branch_id: branchId,
        target_seller_id: sellerId,
        date_from: from,
        date_to: to,
      } as never)
      if (error) return setMessage(error.message)
      setMetrics(data as unknown as Metrics)
      setMessage('')
    })
  }

  useEffect(() => {
    requestMetrics(null, null, defaultFrom, defaultTo)
  // The initial query must run once for the server-provided default range.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, defaultFrom, defaultTo])

  function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    requestMetrics(
      form.get('branch') ? Number(form.get('branch')) : null,
      form.get('seller') ? String(form.get('seller')) : null,
      String(form.get('from')),
      String(form.get('to')),
    )
  }

  return <section className="mt-7 rounded-[10px] border border-[#E3EFED] bg-white p-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D7A72]">Analítica</p><h2 className="mt-1 font-display text-xl font-bold text-[#07322F]">Pulso del negocio</h2></div></div>
    <form onSubmit={load} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <FormSelect name="branch" ariaLabel="Sucursal" options={[{ value: '', label: 'Todas las sucursales' }, ...branches.map(x => ({ value: String(x.id), label: x.name }))]} />
      <FormSelect name="seller" ariaLabel="Vendedor" options={[{ value: '', label: 'Todos los vendedores' }, ...sellers.map(x => ({ value: x.id, label: x.name }))]} />
      <input aria-label="Desde" name="from" type="date" defaultValue={defaultFrom} className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm" />
      <input aria-label="Hasta" name="to" type="date" defaultValue={defaultTo} className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm" />
      <button disabled={pending} className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Calculando…' : 'Actualizar métricas'}</button>
    </form>
    {metrics ? <div className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Ventas', `${money(metrics.salesCup)} CUP`], ['Cobros', `${money(metrics.collectionsCup)} CUP`], ['Saldo pendiente', `${money(metrics.outstandingCup)} CUP`], ['Pedidos', String(metrics.orders.total)]
      ].map(([label, value]) => <div key={label} className="rounded-lg bg-[#F0FBF9] p-4"><p className="text-xs text-[#74857F]">{label}</p><p className="mt-1 font-display text-xl font-bold text-[#07322F]">{value}</p></div>)}</div>
      <div className="grid gap-4 lg:grid-cols-3"><MetricList title="Por vendedor" rows={metrics.bySeller.map(x => [x.seller_name, `${money(x.sales_cup)} CUP · ${x.order_count}`])} /><MetricList title="Carga de proveedores" rows={metrics.providerLoads.map(x => [x.provider_name, `${x.active_jobs} · ${x.job_type}`])} /><MetricList title="Productos destacados" rows={metrics.topItems.map(x => [x.name, String(x.quantity)])} /></div>
      <p className="text-xs text-[#74857F]">Incidencias: {metrics.orders.withIncidents} · Diferencia de caja: {money(metrics.cashDifferenceCup)} CUP · Promedio hasta entrega: {metrics.averageDeliveryHours ?? '—'} h</p>
    </div> : <p className="mt-5 text-sm text-[#74857F]">{pending ? 'Cargando indicadores…' : 'No fue posible cargar los indicadores.'}</p>}
    {message ? <p role="status" className="mt-3 text-sm text-[#C23C1C]">{message}</p> : null}
  </section>
}

function MetricList({ title, rows }: { title: string; rows: [string, string][] }) {
  return <div className="rounded-lg border border-[#EEF5F4] p-4"><h3 className="font-display text-sm font-semibold text-[#07322F]">{title}</h3><div className="mt-3 space-y-2">{rows.length ? rows.map(([name, value], index) => <div key={`${name}:${index}`} className="flex justify-between gap-3 text-sm"><span className="truncate text-[#4A5B58]">{name}</span><strong className="shrink-0 text-[#07322F]">{value}</strong></div>) : <p className="text-xs text-[#74857F]">Sin datos en el rango.</p>}</div></div>
}
