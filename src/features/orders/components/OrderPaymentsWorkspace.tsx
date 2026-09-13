'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

type Order = { id: number; orderNumber: string; customerName: string; commercialStatus: string; paymentStatus: string; totalCup: number; createdAt: string }
type Payment = { id: number; amount: number; currency: string; appliedRate: number; equivalentCup: number; receivedAt: string }
type Summary = { orderId: number; orderNumber: string; totalCup: number; paidCup: number; balanceCup: number; paymentStatus: string; commercialStatus: string; saleRate: number | null; payments: Payment[] }

export function OrderPaymentsWorkspace({ initialOrders }: { initialOrders: Order[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [orders, setOrders] = useState(initialOrders)
  const [selectedId, setSelectedId] = useState(initialOrders[0]?.id ?? 0)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [currency, setCurrency] = useState('CUP')
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const inputClass = 'w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'

  function load(orderId: number) {
    setSelectedId(orderId); setMessage('')
    startTransition(async () => {
      const { data, error } = await supabase.rpc('get_order_payment_summary', { target_order_id: orderId } as never)
      if (error) return setMessage(error.message)
      setSummary(data as unknown as Summary)
    })
  }

  function registerPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const amount = Number(form.get('amount'))
    const appliedRate = currency === 'USD' ? Number(form.get('rate')) : 1
    startTransition(async () => {
      const { error } = await supabase.rpc('register_cash_payment', { target_order_id: selectedId, payment_amount: amount, payment_currency: currency, payment_applied_rate: appliedRate, payment_notes: String(form.get('notes') ?? '') } as never)
      if (error) return setMessage(error.message)
      const { data, error: refreshError } = await supabase.rpc('get_order_payment_summary', { target_order_id: selectedId } as never)
      if (refreshError) return setMessage(refreshError.message)
      const next = data as unknown as Summary; setSummary(next); setMessage('Pago en efectivo registrado.')
      setOrders((current) => current.map((order) => order.id === selectedId ? { ...order, paymentStatus: next.paymentStatus } : order))
      formElement.reset()
    })
  }

  function deliver() {
    if (!selectedId) return
    startTransition(async () => {
      const { error } = await supabase.rpc('mark_order_delivered', { target_order_id: selectedId } as never)
      if (error) return setMessage(error.message)
      const { data } = await supabase.rpc('get_order_payment_summary', { target_order_id: selectedId } as never)
      const next = data as unknown as Summary; setSummary(next); setMessage('Pedido marcado como entregado.')
      setOrders((current) => current.map((order) => order.id === selectedId ? { ...order, commercialStatus: 'delivered' } : order))
    })
  }

  if (!orders.length) return <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">Todavía no tienes pedidos aceptados.</p>
  return <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_1fr]">
    <section className="rounded-[10px] border border-[#E3EFED] bg-white p-4"><h2 className="px-2 font-display text-lg font-semibold text-[#07322F]">Bandeja de pedidos</h2><div className="mt-3 space-y-2">{orders.map((order) => <button key={order.id} onClick={() => load(order.id)} className={`w-full rounded-lg border p-4 text-left ${selectedId === order.id ? 'border-[#0D7A72] bg-[#F0FBF9]' : 'border-[#E3EFED]'}`}><span className="flex items-center justify-between gap-3"><strong className="font-display text-sm text-[#07322F]">{order.orderNumber}</strong><span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${order.paymentStatus === 'paid' ? 'bg-[#D9F5EE] text-[#07655C]' : 'bg-[#FFF0EB] text-[#C23C1C]'}`}>{order.paymentStatus}</span></span><span className="mt-1 block text-sm text-[#4A5B58]">{order.customerName}</span><span className="mt-2 block text-xs text-[#74857F]">{Number(order.totalCup).toLocaleString('es-CU')} CUP · {order.commercialStatus}</span></button>)}</div></section>
    <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5">{summary ? <div className="space-y-5"><div><p className="text-xs uppercase tracking-wide text-[#74857F]">{summary.orderNumber}</p><h2 className="mt-1 font-display text-2xl font-bold text-[#07322F]">Saldo {Number(summary.balanceCup).toLocaleString('es-CU')} CUP</h2><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E3EFED]"><span className="block h-full bg-[#35C2A8]" style={{ width: `${summary.totalCup ? Math.min(100, summary.paidCup / summary.totalCup * 100) : 100}%` }} /></div><p className="mt-2 text-xs text-[#74857F]">Cobrado {Number(summary.paidCup).toLocaleString('es-CU')} de {Number(summary.totalCup).toLocaleString('es-CU')} CUP equivalentes</p></div>
      <form onSubmit={registerPayment} className="grid gap-3 rounded-lg bg-[#F7FBFA] p-4 md:grid-cols-2"><h3 className="font-display font-semibold text-[#07322F] md:col-span-2">Registrar efectivo</h3><input className={inputClass} name="amount" type="number" min="0.01" step="0.01" placeholder="Importe" required /><select className={inputClass} value={currency} onChange={(event) => setCurrency(event.target.value)}><option>CUP</option><option>USD</option></select>{currency === 'USD' ? <label className="text-xs font-semibold text-[#4A5B58]">Tasa aplicada<input className={`${inputClass} mt-1`} name="rate" type="number" min="0.0001" step="0.0001" defaultValue={summary.saleRate ?? 420} required /></label> : null}<input className={inputClass} name="notes" maxLength={500} placeholder="Nota opcional" /><button disabled={pending || summary.balanceCup <= 0} className="rounded-[8px] bg-[#0D7A72] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Registrar pago</button></form>
      <div><h3 className="font-display font-semibold text-[#07322F]">Pagos</h3><div className="mt-2 divide-y divide-[#EEF5F4]">{summary.payments.map((payment) => <div key={payment.id} className="flex justify-between py-3 text-sm"><span className="text-[#4A5B58]">{Number(payment.amount).toLocaleString('es-CU')} {payment.currency}{payment.currency === 'USD' ? ` × ${payment.appliedRate}` : ''}</span><strong className="text-[#07322F]">{Number(payment.equivalentCup).toLocaleString('es-CU')} CUP</strong></div>)}</div></div>
      <button type="button" onClick={deliver} disabled={pending || summary.balanceCup > 0 || summary.commercialStatus !== 'accepted'} className="w-full rounded-[8px] bg-[#07322F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Marcar como entregado</button>{message ? <p role="status" className="text-sm text-[#4A5B58]">{message}</p> : null}</div> : <div className="grid min-h-64 place-items-center text-sm text-[#74857F]"><button type="button" className="rounded-lg border border-[#DCECEA] px-4 py-3" onClick={() => load(selectedId)}>Abrir detalle del pedido</button></div>}</section>
  </div>
}
