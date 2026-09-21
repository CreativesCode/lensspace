'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormSelect, OperationalFilters } from '@/shared/components'
import { friendlyPaymentError } from '../payment-errors'

type Order = { id: number; orderNumber: string; customerId: number; customerName: string; commercialStatus: string; paymentStatus: string; totalCup: number; createdAt: string }
type Payment = { id: number; amount: number; currency: string; appliedRate: number; equivalentCup: number; receivedAt: string; isPostClose: boolean }
type Summary = { orderId: number; orderNumber: string; totalCup: number; paidCup: number; balanceCup: number; paymentStatus: string; commercialStatus: string; saleRate: number | null; payments: Payment[] }
type TimelineEvent = { id: string; kind: string; title: string; detail: string; actorName: string; occurredAt: string }

const inputClass = 'w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'
const paymentStatusLabels: Record<string, string> = { unpaid: 'Pendiente', partial: 'Parcial', paid: 'Pagado' }
const commercialStatusLabels: Record<string, string> = { accepted: 'Aceptado', delivered: 'Entregado', closed: 'Cerrado' }
const statusLabel = (labels: Record<string, string>, status: string) => labels[status] ?? status.replaceAll('_', ' ')
const primaryOrderStatus = (order: Pick<Order, 'commercialStatus' | 'paymentStatus'>) =>
  ['delivered', 'closed'].includes(order.commercialStatus)
    ? statusLabel(commercialStatusLabels, order.commercialStatus)
    : statusLabel(paymentStatusLabels, order.paymentStatus)

export function OrderPaymentsWorkspace({ initialOrders, initialCustomerFilter = '', initialCustomerId }: { initialOrders: Order[]; initialCustomerFilter?: string; initialCustomerId?: number }) {
  const supabase = useMemo(() => createClient(), [])
  const [orders, setOrders] = useState(initialOrders)
  const [selectedId, setSelectedId] = useState(initialOrders[0]?.id ?? 0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [currency, setCurrency] = useState('CUP')
  const [message, setMessage] = useState('')
  const [customerFilter, setCustomerFilter] = useState(initialCustomerFilter)
  const customerIdFilter = customerFilter === initialCustomerFilter ? initialCustomerId : undefined
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [pending, startTransition] = useTransition()

  async function refresh(orderId: number) {
    const [summaryResult, historyResult] = await Promise.all([
      supabase.rpc('get_order_payment_summary', { target_order_id: orderId } as never),
      supabase.rpc('get_order_timeline', { target_order_id: orderId } as never),
    ])
    if (summaryResult.error) throw summaryResult.error
    const next = summaryResult.data as unknown as Summary
    setSummary(next)
    if (!historyResult.error) setTimeline(historyResult.data as unknown as TimelineEvent[])
    return next
  }

  function load(orderId: number) {
    setSelectedId(orderId); setMessage('')
    startTransition(async () => {
      try {
        await refresh(orderId)
      } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir el pedido.') }
    })
  }

  function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    startTransition(async () => {
      const { error } = await supabase.rpc('register_cash_payment', { target_order_id: selectedId, payment_amount: Number(form.get('amount')), payment_currency: currency, payment_applied_rate: currency === 'USD' ? Number(form.get('rate')) : 1, payment_notes: String(form.get('notes') ?? '') } as never)
      if (error) return setMessage(friendlyPaymentError(error))
      try {
        const next = await refresh(selectedId)
        setOrders(current => current.map(order => order.id === selectedId ? { ...order, paymentStatus: next.paymentStatus } : order))
        formElement.reset(); setMessage('Pago en efectivo registrado.')
      } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el pedido.') }
    })
  }

  function deliver() {
    startTransition(async () => {
      const { error } = await supabase.rpc('mark_order_delivered', { target_order_id: selectedId } as never)
      if (error) return setMessage(error.message)
      try {
        await refresh(selectedId)
        setOrders(current => current.map(order => order.id === selectedId ? { ...order, commercialStatus: 'delivered' } : order))
        setMessage('Pedido marcado como entregado.')
      } catch (refreshError) { setMessage(refreshError instanceof Error ? refreshError.message : 'No se pudo actualizar el pedido.') }
    })
  }

  if (!orders.length) return <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">Todavía no tienes pedidos aceptados.</p>
  const displayedTimeline = [...timeline].reverse()
  const filteredOrders = orders.filter((order) => {
    const customerTerm = customerFilter.trim().toLocaleLowerCase('es')
    const orderDate = order.createdAt.slice(0, 10)
    const matchesStatus = statusFilter === 'all'
      || (['delivered', 'closed'].includes(statusFilter) ? order.commercialStatus === statusFilter : !['delivered', 'closed'].includes(order.commercialStatus) && order.paymentStatus === statusFilter)
    return (!customerIdFilter || order.customerId === customerIdFilter)
      && (!customerTerm || order.customerName.toLocaleLowerCase('es').includes(customerTerm))
      && matchesStatus
      && (!dateFrom || orderDate >= dateFrom)
      && (!dateTo || orderDate <= dateTo)
  })
  const orderStatusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'unpaid', label: 'Pendiente de pago' },
    { value: 'partial', label: 'Pago parcial' },
    { value: 'paid', label: 'Pagado' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'closed', label: 'Cerrado' },
  ]
  return <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
    <section className={`${summary ? 'hidden xl:block' : 'block'} space-y-3`}><OperationalFilters query={customerFilter} onQueryChange={setCustomerFilter} queryPlaceholder="Nombre del cliente" status={statusFilter} onStatusChange={setStatusFilter} statusOptions={orderStatusOptions} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClear={() => { setCustomerFilter(''); setStatusFilter('all'); setDateFrom(''); setDateTo('') }} resultCount={filteredOrders.length} /><div className="rounded-[10px] border border-[#E3EFED] bg-white p-4"><h2 className="px-2 font-display text-lg font-semibold text-[#07322F]">Bandeja de pedidos</h2><div className="mt-3 max-h-[65vh] space-y-2 overflow-y-auto pr-1">{filteredOrders.map(order => <button key={order.id} onClick={() => load(order.id)} className={`w-full rounded-lg border p-4 text-left ${selectedId === order.id ? 'border-[#0D7A72] bg-[#F0FBF9]' : 'border-[#E3EFED]'}`}><span className="flex items-center justify-between gap-3"><strong className="font-display text-sm text-[#07322F]">{order.orderNumber}</strong><span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${order.commercialStatus === 'delivered' || order.commercialStatus === 'closed' || order.paymentStatus === 'paid' ? 'bg-[#D9F5EE] text-[#07655C]' : 'bg-[#FFF0EB] text-[#C23C1C]'}`}>{primaryOrderStatus(order)}</span></span><span className="mt-1 block text-sm text-[#4A5B58]">{order.customerName}</span><span className="mt-2 block text-xs text-[#74857F]">{Number(order.totalCup).toLocaleString('es-CU')} CUP · {statusLabel(commercialStatusLabels, order.commercialStatus)} · {new Date(order.createdAt).toLocaleDateString('es-CU')}</span></button>)}{!filteredOrders.length ? <p className="rounded-lg border border-dashed border-[#DCECEA] p-5 text-sm text-[#74857F]">No hay pedidos que coincidan con los filtros.</p> : null}</div></div></section>
    <section className={`${summary ? 'block' : 'hidden xl:block'} rounded-[10px] border border-[#E3EFED] bg-white p-5`}>{summary ? <div className="space-y-5">
      <button type="button" onClick={() => { setSummary(null); setTimeline([]); setMessage('') }} className="inline-flex items-center gap-2 rounded-[7px] border border-[#DCECEA] px-3 py-2 text-sm font-semibold text-[#0D7A72] xl:hidden">← Volver a pedidos</button>
      <div><p className="text-xs uppercase tracking-wide text-[#74857F]">{summary.orderNumber} · {statusLabel(commercialStatusLabels, summary.commercialStatus)}</p><h2 className="mt-1 font-display text-2xl font-bold text-[#07322F]">Saldo {Number(summary.balanceCup).toLocaleString('es-CU')} CUP</h2><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E3EFED]"><span className="block h-full bg-[#35C2A8]" style={{ width: `${summary.totalCup ? Math.min(100, summary.paidCup / summary.totalCup * 100) : 100}%` }} /></div><p className="mt-2 text-xs text-[#74857F]">Cobrado {Number(summary.paidCup).toLocaleString('es-CU')} de {Number(summary.totalCup).toLocaleString('es-CU')} CUP equivalentes · {statusLabel(paymentStatusLabels, summary.paymentStatus)}</p></div>
      {summary.balanceCup > 0 ? <form onSubmit={registerPayment} className="grid gap-3 rounded-lg bg-[#F7FBFA] p-4 md:grid-cols-2"><h3 className="font-display font-semibold text-[#07322F] md:col-span-2">Registrar efectivo</h3><input className={inputClass} name="amount" type="number" min="0.01" step="0.01" placeholder="Importe" required /><FormSelect ariaLabel="Moneda del pago" value={currency} onValueChange={setCurrency} options={[{ value: 'CUP', label: 'CUP' }, { value: 'USD', label: 'USD' }]} />{currency === 'USD' ? <label className="text-xs font-semibold text-[#4A5B58]">Tasa aplicada<input className={`${inputClass} mt-1`} name="rate" type="number" min="0.01" step="0.01" defaultValue={summary.saleRate ?? 420} required /></label> : null}<input className={inputClass} name="notes" maxLength={500} placeholder="Nota opcional" /><button disabled={pending} className="rounded-[8px] bg-[#0D7A72] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Registrar pago</button></form> : <p className="rounded-lg bg-[#E2F4F1] p-4 text-sm font-semibold text-[#07655C]">{summary.commercialStatus === 'delivered' ? 'Pedido entregado y pagado completamente.' : 'Pago completado. El pedido está listo para continuar.'}</p>}
      <div><h3 className="font-display font-semibold text-[#07322F]">Pagos</h3><div className="mt-2 divide-y divide-[#EEF5F4]">{summary.payments.map(payment => <div key={payment.id} className="flex justify-between gap-3 py-3 text-sm"><span className="text-[#4A5B58]">{Number(payment.amount).toLocaleString('es-CU')} {payment.currency}{payment.currency === 'USD' ? ` × ${payment.appliedRate}` : ''}{payment.isPostClose ? <small className="ml-2 rounded bg-[#E2F4F1] px-2 py-1 font-bold text-[#0D7A72]">POSTERIOR AL CIERRE</small> : null}</span><strong className="shrink-0 text-[#07322F]">{Number(payment.equivalentCup).toLocaleString('es-CU')} CUP</strong></div>)}</div></div>
      <p className="rounded-lg border border-[#DCECEA] bg-[#F7FBFA] p-4 text-sm text-[#4A5B58]">Las notificaciones de confirmación, pedido listo, pago recibido y entrega se envían automáticamente al WhatsApp autorizado del cliente. Cada resultado queda registrado en este historial.</p>
      <div><h3 className="font-display font-semibold text-[#07322F]">Historial completo</h3><p className="mt-1 text-xs text-[#74857F]">Más reciente primero</p><ol className="mt-3">{displayedTimeline.map((item, index) => <li key={item.id} className="flex gap-3"><div className="flex flex-col items-center"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.kind === 'incident' ? 'bg-[#FF6B4A]' : 'bg-[#0D7A72]'}`} />{index < displayedTimeline.length - 1 ? <span className="min-h-10 w-px flex-1 bg-[#DCECEA]" /> : null}</div><div className="pb-4"><p className="text-sm font-semibold text-[#07322F]">{item.title}</p><p className="text-xs text-[#4A5B58]">{item.detail}</p><p className="mt-1 text-[11px] text-[#74857F]">{new Date(item.occurredAt).toLocaleString('es-CU')} · {item.actorName}</p></div></li>)}</ol></div>
      {summary.commercialStatus === 'accepted' ? <button type="button" onClick={deliver} disabled={pending || summary.balanceCup > 0} className="w-full rounded-[8px] bg-[#07322F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Marcar como entregado</button> : null}{message ? <p role="status" className="text-sm text-[#4A5B58]">{message}</p> : null}
    </div> : <div className="grid min-h-64 place-items-center text-sm text-[#74857F]"><button type="button" className="rounded-lg border border-[#DCECEA] px-4 py-3" onClick={() => load(selectedId)}>Abrir detalle del pedido</button></div>}</section>
  </div>
}
