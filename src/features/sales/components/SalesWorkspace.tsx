'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormSelect } from '@/shared/components'

type Organization = { id: number; name: string; branchId: number; branchName: string; canOperate: boolean }
type Customer = { id: number; organizationId: number; branchId: number; name: string }
type Revision = { id: number; organizationId: number; branchId: number; customerId: number; label: string }
type Item = { id: number; organizationId: number | null; name: string; category: string; price: number; currency: string }
type PriceResult = { lineItems: { name: string; amount: number; currency: string }[]; totals: Record<string, number>; cupEquivalent: number | null; warnings: { message: string }[] }

export function SalesWorkspace({ organizations, customers, revisions, items }: { organizations: Organization[]; customers: Customer[]; revisions: Revision[]; items: Item[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? 0)
  const organization = organizations.find((entry) => entry.id === organizationId)
  const [customerId, setCustomerId] = useState(0)
  const [revisionId, setRevisionId] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [rate, setRate] = useState('420')
  const [quotationId, setQuotationId] = useState<number | null>(null)
  const [preview, setPreview] = useState<PriceResult | null>(null)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const availableCustomers = customers.filter((entry) => entry.organizationId === organizationId && entry.branchId === organization?.branchId)
  const availableRevisions = revisions.filter((entry) => entry.organizationId === organizationId && entry.branchId === organization?.branchId && entry.customerId === customerId)
  const availableItems = items.filter((item) => item.organizationId === null || item.organizationId === organizationId)
  const inputClass = 'w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'

  function resetQuote() { setQuotationId(null); setPreview(null) }
  function toggle(itemId: number) { setSelected((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]); resetQuote() }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!organization || !customerId || !selected.length) return setMessage('Selecciona cliente y al menos un concepto.')
    const notes = String(new FormData(event.currentTarget).get('notes') ?? '')
    startTransition(async () => {
      setMessage('')
      const numericRate = rate ? Number(rate) : null
      const { data: price, error: priceError } = await supabase.rpc('calculate_catalog_price', { target_organization_id: organizationId, selected_item_ids: selected, target_prescription_revision_id: revisionId || null, usd_to_cup_rate: numericRate } as never)
      if (priceError) return setMessage(priceError.message)
      const { data, error } = await supabase.rpc('save_quotation', { target_quotation_id: quotationId, target_organization_id: organizationId, target_branch_id: organization.branchId, target_customer_id: customerId, target_prescription_revision_id: revisionId || null, selected_item_ids: selected, target_usd_to_cup_rate: numericRate, target_notes: notes } as never)
      if (error) return setMessage(error.message)
      setPreview(price as unknown as PriceResult); setQuotationId(Number(data)); setMessage('Cotización guardada. Confirma los importes con el cliente.')
    })
  }

  function accept() {
    if (!quotationId) return
    startTransition(async () => {
      const { data, error } = await supabase.rpc('accept_quotation', { target_quotation_id: quotationId } as never)
      if (error) return setMessage(error.message)
      const result = data as { orderNumber?: string }
      setMessage(`Pedido ${result.orderNumber ?? ''} creado con precios y tasa inmutables.`); setQuotationId(null)
    })
  }

  if (!organizations.length) return <p className="rounded-lg border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">No tienes una sucursal comercial disponible.</p>
  return <form onSubmit={save} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
    <div className="space-y-5">
      <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)]">
        <div className="mb-4 flex gap-2">{[1,2,3,4].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full ${step <= 3 ? 'bg-[#35C2A8]' : 'bg-[#E3EFED]'}`} />)}</div>
        <h2 className="font-display text-lg font-semibold text-[#07322F]">Cliente y receta</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FormSelect ariaLabel="Organización y sucursal" value={String(organizationId)} onValueChange={(value) => { setOrganizationId(Number(value)); setCustomerId(0); setRevisionId(0); resetQuote() }} options={organizations.map((entry) => ({ value: String(entry.id), label: `${entry.name} · ${entry.branchName}` }))} />
          <FormSelect ariaLabel="Cliente" value={String(customerId)} onValueChange={(value) => { setCustomerId(Number(value)); setRevisionId(0); resetQuote() }} options={[{ value: '0', label: 'Selecciona cliente' }, ...availableCustomers.map((entry) => ({ value: String(entry.id), label: entry.name }))]} />
          <FormSelect ariaLabel="Receta asociada" value={String(revisionId)} onValueChange={(value) => { setRevisionId(Number(value)); resetQuote() }} options={[{ value: '0', label: 'Sin receta asociada' }, ...availableRevisions.map((entry) => ({ value: String(entry.id), label: entry.label }))]} />
          <label className="text-xs font-semibold text-[#4A5B58]">Tasa USD → CUP<input className={`${inputClass} mt-1`} value={rate} onChange={(event) => { setRate(event.target.value); resetQuote() }} type="number" min="0.0001" step="0.0001" required /></label>
        </div>
      </section>
      <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5">
        <h2 className="font-display text-lg font-semibold text-[#07322F]">Configuración</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{availableItems.map((item) => { const active = selected.includes(item.id); return <button type="button" key={item.id} onClick={() => toggle(item.id)} className={`rounded-lg border p-4 text-left ${active ? 'border-[#0D7A72] bg-[#F0FBF9]' : 'border-[#E3EFED] bg-white hover:border-[#A7CFC9]'}`}><span className="block text-xs uppercase tracking-wide text-[#74857F]">{item.category.replace('_', ' ')}</span><strong className="mt-1 block font-display text-sm text-[#07322F]">{item.name}</strong><span className="mt-2 block text-sm font-semibold text-[#0D7A72]">{item.price.toLocaleString('es-CU')} {item.currency}</span></button> })}</div>
        <textarea className={`${inputClass} mt-4 min-h-24`} name="notes" maxLength={1000} placeholder="Notas comerciales opcionales" />
      </section>
    </div>
    <aside className="h-fit rounded-[10px] border border-[#E3EFED] bg-white xl:sticky xl:top-6">
      <div className="border-b border-[#EEF5F4] p-5"><h2 className="font-display text-lg font-semibold text-[#07322F]">Cotización</h2><p className="mt-1 text-xs text-[#74857F]">{selected.length} conceptos seleccionados</p></div>
      <div className="space-y-4 p-5">{preview ? <>{preview.lineItems.map((line, index) => <div key={index} className="flex justify-between gap-3 text-sm"><span className="text-[#4A5B58]">{line.name}</span><strong className="whitespace-nowrap text-[#07322F]">{Number(line.amount).toLocaleString('es-CU')} {line.currency}</strong></div>)}<div className="border-t border-dashed border-[#DCECEA] pt-3">{Object.entries(preview.totals).map(([currency,total]) => <p key={currency} className="flex justify-between font-display text-xl font-bold text-[#07322F]"><span>Total</span><span>{Number(total).toLocaleString('es-CU')} {currency}</span></p>)}{preview.cupEquivalent !== null ? <p className="mt-2 text-right text-xs text-[#74857F]">Equivalente: {Number(preview.cupEquivalent).toLocaleString('es-CU')} CUP</p> : null}</div>{preview.warnings.map((warning,index) => <p key={index} className="rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-3 text-xs text-[#7A3A26]">{warning.message}</p>)}</> : <p className="rounded-lg border border-dashed border-[#DCECEA] p-5 text-sm text-[#74857F]">Guarda para obtener el desglose definitivo.</p>}
        <button disabled={pending || !organization?.canOperate} className="w-full rounded-[8px] bg-[#0D7A72] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{quotationId ? 'Actualizar cotización' : 'Guardar cotización'}</button>
        {quotationId ? <button type="button" onClick={accept} disabled={pending} className="w-full rounded-[8px] bg-[#07322F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Cliente acepta · crear pedido</button> : null}
        {message ? <p role="status" className="text-sm text-[#4A5B58]">{message}</p> : null}
      </div>
    </aside>
  </form>
}
