'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { whatsappManualProvider } from '@/features/notifications/manual-provider'

type Order = { id: number; orderNumber: string; customerName: string; commercialStatus: string; paymentStatus: string; totalCup: number; createdAt: string }
type Payment = { id: number; amount: number; currency: string; appliedRate: number; equivalentCup: number; receivedAt: string; isPostClose: boolean }
type Summary = { orderId: number; orderNumber: string; totalCup: number; paidCup: number; balanceCup: number; paymentStatus: string; commercialStatus: string; saleRate: number | null; payments: Payment[] }
type TimelineEvent = { id: string; kind: string; title: string; detail: string; actorName: string; occurredAt: string }
type Template = { key: string; name: string }
type PreparedNotification = { outcome: 'opened' | 'failed'; recipient?: string; message?: string; failureCode?: string }

const inputClass = 'w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'

export function OrderPaymentsWorkspace({ initialOrders }: { initialOrders: Order[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [orders, setOrders] = useState(initialOrders)
  const [selectedId, setSelectedId] = useState(initialOrders[0]?.id ?? 0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [currency, setCurrency] = useState('CUP')
  const [message, setMessage] = useState('')
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
      const templateResult = await supabase.from('notification_templates').select('key, name').eq('is_active', true).order('name')
      try {
        await refresh(orderId)
        if (!templateResult.error) setTemplates(templateResult.data as Template[])
      } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo abrir el pedido.') }
    })
  }

  function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    startTransition(async () => {
      const { error } = await supabase.rpc('register_cash_payment', { target_order_id: selectedId, payment_amount: Number(form.get('amount')), payment_currency: currency, payment_applied_rate: currency === 'USD' ? Number(form.get('rate')) : 1, payment_notes: String(form.get('notes') ?? '') } as never)
      if (error) return setMessage(error.message)
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

  function prepareNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(async () => {
      const { data, error } = await supabase.rpc('prepare_manual_notification', { target_order_id: selectedId, target_template_key: String(form.get('template')) } as never)
      if (error) return setMessage(error.message)
      const prepared = data as unknown as PreparedNotification
      if (prepared.outcome === 'failed' || !prepared.recipient || !prepared.message) {
        setMessage(prepared.failureCode === 'missing_consent' ? 'El cliente no autorizó mensajería.' : 'No hay un teléfono habilitado para WhatsApp.')
      } else {
        window.open(whatsappManualProvider.buildUrl({ recipient: prepared.recipient, message: prepared.message }), '_blank', 'noopener,noreferrer')
        setMessage('Intento registrado; se abrió WhatsApp para completar el envío manual.')
      }
      try { await refresh(selectedId) } catch { /* The attempt remains recorded. */ }
    })
  }

  if (!orders.length) return <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">Todavía no tienes pedidos aceptados.</p>
  return <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
    <section className="rounded-[10px] border border-[#E3EFED] bg-white p-4"><h2 className="px-2 font-display text-lg font-semibold text-[#07322F]">Bandeja de pedidos</h2><div className="mt-3 space-y-2">{orders.map(order => <button key={order.id} onClick={() => load(order.id)} className={`w-full rounded-lg border p-4 text-left ${selectedId === order.id ? 'border-[#0D7A72] bg-[#F0FBF9]' : 'border-[#E3EFED]'}`}><span className="flex items-center justify-between gap-3"><strong className="font-display text-sm text-[#07322F]">{order.orderNumber}</strong><span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${order.paymentStatus === 'paid' ? 'bg-[#D9F5EE] text-[#07655C]' : 'bg-[#FFF0EB] text-[#C23C1C]'}`}>{order.paymentStatus}</span></span><span className="mt-1 block text-sm text-[#4A5B58]">{order.customerName}</span><span className="mt-2 block text-xs text-[#74857F]">{Number(order.totalCup).toLocaleString('es-CU')} CUP · {order.commercialStatus}</span></button>)}</div></section>
    <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5">{summary ? <div className="space-y-5">
      <div><p className="text-xs uppercase tracking-wide text-[#74857F]">{summary.orderNumber}</p><h2 className="mt-1 font-display text-2xl font-bold text-[#07322F]">Saldo {Number(summary.balanceCup).toLocaleString('es-CU')} CUP</h2><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E3EFED]"><span className="block h-full bg-[#35C2A8]" style={{ width: `${summary.totalCup ? Math.min(100, summary.paidCup / summary.totalCup * 100) : 100}%` }} /></div><p className="mt-2 text-xs text-[#74857F]">Cobrado {Number(summary.paidCup).toLocaleString('es-CU')} de {Number(summary.totalCup).toLocaleString('es-CU')} CUP equivalentes</p></div>
      <form onSubmit={registerPayment} className="grid gap-3 rounded-lg bg-[#F7FBFA] p-4 md:grid-cols-2"><h3 className="font-display font-semibold text-[#07322F] md:col-span-2">Registrar efectivo</h3><input className={inputClass} name="amount" type="number" min="0.01" step="0.01" placeholder="Importe" required /><select className={inputClass} value={currency} onChange={event => setCurrency(event.target.value)}><option>CUP</option><option>USD</option></select>{currency === 'USD' ? <label className="text-xs font-semibold text-[#4A5B58]">Tasa aplicada<input className={`${inputClass} mt-1`} name="rate" type="number" min="0.0001" step="0.0001" defaultValue={summary.saleRate ?? 420} required /></label> : null}<input className={inputClass} name="notes" maxLength={500} placeholder="Nota opcional" /><button disabled={pending || summary.balanceCup <= 0} className="rounded-[8px] bg-[#0D7A72] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Registrar pago</button></form>
      <div><h3 className="font-display font-semibold text-[#07322F]">Pagos</h3><div className="mt-2 divide-y divide-[#EEF5F4]">{summary.payments.map(payment => <div key={payment.id} className="flex justify-between gap-3 py-3 text-sm"><span className="text-[#4A5B58]">{Number(payment.amount).toLocaleString('es-CU')} {payment.currency}{payment.currency === 'USD' ? ` × ${payment.appliedRate}` : ''}{payment.isPostClose ? <small className="ml-2 rounded bg-[#E2F4F1] px-2 py-1 font-bold text-[#0D7A72]">POSTERIOR AL CIERRE</small> : null}</span><strong className="shrink-0 text-[#07322F]">{Number(payment.equivalentCup).toLocaleString('es-CU')} CUP</strong></div>)}</div></div>
      {templates.length ? <form onSubmit={prepareNotification} className="flex flex-col gap-3 rounded-lg border border-[#E3EFED] p-4 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-semibold text-[#4A5B58]">Notificación manual<select name="template" className={`${inputClass} mt-1`}>{templates.map(template => <option key={template.key} value={template.key}>{template.name}</option>)}</select></label><button disabled={pending} className="rounded-[8px] border border-[#0D7A72] px-4 py-3 text-sm font-semibold text-[#0D7A72] disabled:opacity-40">Abrir WhatsApp</button></form> : null}
      <div><h3 className="font-display font-semibold text-[#07322F]">Historial completo</h3><ol className="mt-3">{timeline.map((item, index) => <li key={item.id} className="flex gap-3"><div className="flex flex-col items-center"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.kind === 'incident' ? 'bg-[#FF6B4A]' : 'bg-[#0D7A72]'}`} />{index < timeline.length - 1 ? <span className="min-h-10 w-px flex-1 bg-[#DCECEA]" /> : null}</div><div className="pb-4"><p className="text-sm font-semibold text-[#07322F]">{item.title}</p><p className="text-xs text-[#4A5B58]">{item.detail}</p><p className="mt-1 text-[11px] text-[#74857F]">{new Date(item.occurredAt).toLocaleString('es-CU')} · {item.actorName}</p></div></li>)}</ol></div>
      <button type="button" onClick={deliver} disabled={pending || summary.balanceCup > 0 || summary.commercialStatus !== 'accepted'} className="w-full rounded-[8px] bg-[#07322F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Marcar como entregado</button>{message ? <p role="status" className="text-sm text-[#4A5B58]">{message}</p> : null}
    </div> : <div className="grid min-h-64 place-items-center text-sm text-[#74857F]"><button type="button" className="rounded-lg border border-[#DCECEA] px-4 py-3" onClick={() => load(selectedId)}>Abrir detalle del pedido</button></div>}</section>
  </div>
}
