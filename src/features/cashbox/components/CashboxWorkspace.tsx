'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'

type Closure = { id: number; type: 'primary' | 'complementary'; sequenceNumber: number; expectedAmount: number; declaredAmount: number; differenceAmount: number; closedAt: string }
export type Cashbox = { id: number; branchName: string; sellerId: string; sellerName: string; businessDate: string; currency: 'CUP' | 'USD'; receivedAmount: number; paymentCount: number; pendingPostCloseAmount: number; primaryClosed: boolean; closedExpectedAmount: number; closedDeclaredAmount: number; closedDifferenceAmount: number; closures: Closure[] }
const money = (value: number, currency: string) => `${Number(value).toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`

export function CashboxWorkspace({ initialCashboxes, currentUserId }: { initialCashboxes: Cashbox[]; currentUserId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [cashboxes, setCashboxes] = useState(initialCashboxes)
  const [selectedId, setSelectedId] = useState(initialCashboxes[0]?.id ?? 0)
  const [message, setMessage] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [sellerFilter, setSellerFilter] = useState('')
  const [pending, startTransition] = useTransition()
  const selected = cashboxes.find((cashbox) => cashbox.id === selectedId) ?? null
  const isOwnCashbox = selected?.sellerId === currentUserId
  const visibleCashboxes = cashboxes.filter((cashbox) => (!dateFilter || cashbox.businessDate === dateFilter) && (!branchFilter || cashbox.branchName === branchFilter) && (!sellerFilter || cashbox.sellerId === sellerFilter))
  const branches = [...new Set(cashboxes.map((cashbox) => cashbox.branchName))]
  const sellers = [...new Map(cashboxes.map((cashbox) => [cashbox.sellerId, cashbox.sellerName])).entries()]

  function closeCashbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const form = new FormData(event.currentTarget)
    const closureType = selected.primaryClosed ? 'complementary' : 'primary'
    setMessage('')
    startTransition(async () => {
      const { error } = await supabase.rpc('close_cashbox', { target_cashbox_id: selected.id, closure_type: closureType, declared_amount: Number(form.get('declaredAmount')) } as never)
      if (error) return setMessage(error.message)
      const { data, error: refreshError } = await supabase.rpc('list_accessible_cashboxes', { target_branch_id: null, target_business_date: null, target_seller_id: null } as never)
      if (refreshError) return setMessage(refreshError.message)
      setCashboxes(data as unknown as Cashbox[])
      setMessage(closureType === 'primary' ? 'Cierre principal registrado.' : 'Cierre complementario registrado.')
    })
  }

  if (!cashboxes.length) return <div className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">Aún no hay cobros en cajas accesibles.</div>
  return <div className="grid gap-6 xl:grid-cols-[minmax(300px,410px)_1fr]">
    <section className="rounded-[10px] border border-[#E3EFED] bg-white p-4"><h2 className="px-2 font-display text-lg font-semibold text-[#07322F]">Cajas por día y moneda</h2><div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1"><input aria-label="Filtrar por fecha" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2 text-xs text-[#4A5B58]" /><select aria-label="Filtrar por sucursal" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2 text-xs text-[#4A5B58]"><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch}>{branch}</option>)}</select><select aria-label="Filtrar por vendedor" value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)} className="rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2 text-xs text-[#4A5B58]"><option value="">Todos los vendedores</option>{sellers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div><div className="mt-3 space-y-2">{visibleCashboxes.map((cashbox) => <button key={cashbox.id} type="button" onClick={() => { setSelectedId(cashbox.id); setMessage('') }} className={`w-full rounded-lg border p-4 text-left transition ${selectedId === cashbox.id ? 'border-[#0D7A72] bg-[#F0FBF9]' : 'border-[#E3EFED] hover:border-[#9BCDC6]'}`}><span className="flex items-center justify-between gap-3"><strong className="font-display text-sm text-[#07322F]">{cashbox.sellerName}</strong><span className="rounded bg-[#E2F4F1] px-2 py-1 text-[10px] font-bold text-[#0D7A72]">{cashbox.currency}</span></span><span className="mt-1 block text-sm text-[#4A5B58]">{cashbox.branchName} · {cashbox.businessDate}</span><span className="mt-2 flex justify-between text-xs text-[#74857F]"><span>{cashbox.paymentCount} cobros</span><strong className="text-[#07322F]">{money(cashbox.receivedAmount, cashbox.currency)}</strong></span></button>)}</div></section>
    {selected ? <section className="space-y-5 rounded-[10px] border border-[#E3EFED] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0D7A72]">{selected.branchName} · {selected.businessDate}</p><h2 className="mt-1 font-display text-2xl font-bold text-[#07322F]">Caja {selected.sellerName}</h2></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selected.primaryClosed ? 'bg-[#D9F5EE] text-[#07655C]' : 'bg-[#FFF0EB] text-[#C23C1C]'}`}>{selected.primaryClosed ? 'Cierre principal realizado' : 'Abierta'}</span></div>
      <div className="grid gap-3 sm:grid-cols-3"><Metric label="Cobrado" value={money(selected.receivedAmount, selected.currency)} /><Metric label="Consolidado" value={money(selected.closedExpectedAmount, selected.currency)} /><Metric label="Diferencia" value={money(selected.closedDifferenceAmount, selected.currency)} alert={selected.closedDifferenceAmount !== 0} /></div>
      {selected.closures.length ? <div><h3 className="font-display font-semibold text-[#07322F]">Historial de cierres</h3><div className="mt-2 divide-y divide-[#EEF5F4]">{selected.closures.map((closure) => <div key={closure.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto]"><div><strong className="text-[#07322F]">{closure.type === 'primary' ? 'Cierre principal' : `Complementario ${closure.sequenceNumber}`}</strong><p className="text-xs text-[#74857F]">{new Date(closure.closedAt).toLocaleString('es-CU')}</p></div><div className="text-left sm:text-right"><p className="font-semibold text-[#07322F]">{money(closure.expectedAmount, selected.currency)}</p><p className="text-xs text-[#74857F]">Declarado {money(closure.declaredAmount, selected.currency)}</p></div></div>)}</div></div> : null}
      {isOwnCashbox ? <form onSubmit={closeCashbox} className="rounded-lg bg-[#F7FBFA] p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-52 flex-1 text-xs font-semibold text-[#4A5B58]">Efectivo declarado ({selected.currency})<input name="declaredAmount" type="number" min="0" step="0.01" defaultValue={(selected.primaryClosed ? selected.pendingPostCloseAmount : selected.receivedAmount).toFixed(2)} required className="mt-1 w-full rounded-[7px] border border-[#DCECEA] bg-white px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]" /></label><button disabled={pending || (selected.primaryClosed && selected.pendingPostCloseAmount <= 0)} className="rounded-[7px] bg-[#0D7A72] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{selected.primaryClosed ? 'Generar complementario' : 'Cerrar caja del día'}</button></div>{selected.primaryClosed ? <p className="mt-2 text-xs text-[#74857F]">Pendiente posterior al cierre: {money(selected.pendingPostCloseAmount, selected.currency)}</p> : null}</form> : <p className="rounded-lg bg-[#F7FBFA] p-4 text-sm text-[#4A5B58]">Vista de revisión. Solo el vendedor responsable puede cerrar esta caja.</p>}
      {message ? <p role="status" className="text-sm text-[#4A5B58]">{message}</p> : null}
      <aside className="rounded-lg border border-[#DCECEA] bg-[#FBFEFD] p-4"><h3 className="font-display text-sm font-semibold text-[#07322F]">Cómo funciona tu caja</h3><p className="mt-1 text-sm leading-6 text-[#4A5B58]">Cada moneda se cierra por separado. Los cobros posteriores permanecen disponibles para un cierre complementario sin alterar el principal.</p></aside>
    </section> : null}
  </div>
}

function Metric({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return <div className="rounded-lg border border-[#E3EFED] p-4"><p className="text-xs text-[#74857F]">{label}</p><p className={`mt-1 font-display text-lg font-bold ${alert ? 'text-[#C23C1C]' : 'text-[#07322F]'}`}>{value}</p></div>
}
