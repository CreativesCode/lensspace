'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'

type OrganizationAccess = { id: number; name: string; canManage: boolean; canCalculate: boolean }
type CatalogItem = Tables<'catalog_items'>
type CatalogOverride = Tables<'catalog_item_overrides'>
type GraduationRule = Tables<'graduation_rules'>
type PrescriptionOption = {
  id: number
  organizationId: number
  label: string
}
type PriceLine = {
  kind: string
  itemId?: number
  name: string
  amount: number
  currency: string
}
type PriceWarning = { kind: string; message: string; blocking: boolean }
type PriceResult = {
  lineItems: PriceLine[]
  totals: Record<string, number>
  usdToCupRate: number | null
  cupEquivalent: number | null
  warnings: PriceWarning[]
}

const categoryLabels: Record<string, string> = {
  vision_type: 'Tipo de espejuelo',
  lens_material: 'Material',
  treatment: 'Tratamientos',
  frame: 'Armaduras',
  mounting: 'Montaje',
  adjustment: 'Ajustes',
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat('es-CU', {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value) + ` ${currency}`
}

export function CatalogWorkspace({
  isPlatformAdmin,
  organizations,
  initialItems,
  initialOverrides,
  rules,
  prescriptions,
}: {
  isPlatformAdmin?: boolean
  organizations: OrganizationAccess[]
  initialItems: CatalogItem[]
  initialOverrides: CatalogOverride[]
  rules: GraduationRule[]
  prescriptions: PrescriptionOption[]
}) {
  const supabase = useMemo(() => createClient(), [])
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? 0)
  const [items, setItems] = useState(initialItems)
  const [overrides, setOverrides] = useState(initialOverrides)
  const [selected, setSelected] = useState<number[]>([])
  const [prescriptionRevisionId, setPrescriptionRevisionId] = useState<number | null>(null)
  const [rate, setRate] = useState('420')
  const [result, setResult] = useState<PriceResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)

  const access = organizations.find(({ id }) => id === organizationId)
  const canManage = Boolean(isPlatformAdmin || access?.canManage)
  const visibleItems = items.filter(
    ({ organization_id }) => isPlatformAdmin
      ? organization_id === null
      : organization_id === null || organization_id === organizationId,
  )
  const effectiveItems = visibleItems.map((item) => {
    const override = overrides.find(
      (entry) => entry.organization_id === organizationId && entry.catalog_item_id === item.id,
    )
    return {
      ...item,
      effectiveCost: override?.cost_amount ?? item.cost_amount,
      effectivePrice: override?.sale_price ?? item.sale_price,
      effectiveCurrency: override?.currency ?? item.currency,
      enabled: override?.is_enabled ?? item.is_active,
      customized: Boolean(override),
    }
  })
  const grouped = Object.entries(categoryLabels).map(([key, label]) => ({
    key,
    label,
    items: effectiveItems.filter(({ category }) => category === key),
  })).filter(({ items: groupItems }) => groupItems.length)
  const editingItem = effectiveItems.find(({ id }) => id === editingItemId) ?? null

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setEditingItemId(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  function toggleItem(itemId: number) {
    setSelected((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    )
    setResult(null)
  }

  async function calculate() {
    if (!access?.canCalculate || !selected.length) {
      setMessage('Selecciona al menos un artículo disponible.')
      return
    }
    setPending(true)
    setMessage(null)
    const numericRate = rate.trim() ? Number(rate) : null
    const { data, error } = await supabase.rpc('calculate_catalog_price', {
      target_organization_id: organizationId,
      selected_item_ids: selected,
      target_prescription_revision_id: prescriptionRevisionId,
      usd_to_cup_rate: numericRate,
    } as never)
    if (error) {
      setMessage(error.message || 'No se pudo calcular el precio.')
      setResult(null)
    } else {
      setResult(data as unknown as PriceResult)
    }
    setPending(false)
  }

  async function saveOverride(item: CatalogItem, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    const entry = {
      organization_id: organizationId,
      catalog_item_id: item.id,
      cost_amount: Number(form.get('costAmount')),
      sale_price: Number(form.get('salePrice')),
      currency: String(form.get('currency')).toUpperCase(),
      is_enabled: form.get('isEnabled') === 'on',
      changed_by: user!.id,
      changed_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('catalog_item_overrides').upsert(entry as never)
    if (error) {
      setMessage(error.message || 'No se pudo guardar la personalización.')
    } else {
      setOverrides((current) => [
        ...current.filter(
          (override) =>
            override.organization_id !== organizationId || override.catalog_item_id !== item.id,
        ),
        entry,
      ])
      setResult(null)
      setMessage(`${item.name} actualizado para ${access?.name ?? 'la organización'}.`)
      setEditingItemId(null)
    }
    setPending(false)
  }

  async function saveBaseItem(item: CatalogItem, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isPlatformAdmin) return
    setPending(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
    const changes = {
      cost_amount: Number(form.get('costAmount')),
      sale_price: Number(form.get('salePrice')),
      currency: String(form.get('currency')).toUpperCase(),
      is_active: form.get('isEnabled') === 'on',
    }
    const { error } = await supabase
      .from('catalog_items')
      .update(changes as never)
      .eq('id', item.id)
      .is('organization_id', null)
    if (error) {
      setMessage(error.message || 'No se pudo actualizar el artículo base.')
    } else {
      setItems((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, ...changes } : entry,
      ))
      setMessage(`${item.name} actualizado en el catálogo base.`)
      setEditingItemId(null)
    }
    setPending(false)
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    setPending(true)
    setMessage(null)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const { data: { user } } = await supabase.auth.getUser()
    const entry = {
      organization_id: isPlatformAdmin ? null : organizationId,
      category: String(form.get('category')),
      code: String(form.get('code')).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      name: String(form.get('name')).trim(),
      description: String(form.get('description') ?? '').trim() || null,
      cost_amount: Number(form.get('costAmount')),
      sale_price: Number(form.get('salePrice')),
      currency: String(form.get('currency')).toUpperCase(),
      created_by: user!.id,
    }
    const { data, error } = await supabase
      .from('catalog_items')
      .insert(entry as never)
      .select('*')
      .single()
    if (error) {
      setMessage(error.message || 'No se pudo crear el artículo.')
    } else {
      setItems((current) => [...current, data as CatalogItem])
      formElement.reset()
      setMessage(isPlatformAdmin ? 'Artículo base creado correctamente.' : 'Artículo propio creado correctamente.')
    }
    setPending(false)
  }

  if (!isPlatformAdmin && !organizations.length) {
    return <p className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">Tu cuenta no tiene acceso comercial a una organización.</p>
  }

  const inputClass = 'rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2 text-sm text-[#07322F] outline-none focus:border-[#0D7A72] focus:ring-4 focus:ring-[#E2F4F1]'

  return (
    <div className="space-y-[18px]">
      <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5">
        {isPlatformAdmin ? (
          <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0D7A72]">Administración de plataforma</p><h2 className="mt-1 font-display text-lg font-semibold text-[#07322F]">Catálogo base global</h2><p className="mt-1 text-sm text-[#74857F]">Estos artículos están disponibles como base para todas las organizaciones.</p></div>
        ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-xs font-medium text-[#4A5B58]">Organización<FormSelect className="mt-1" ariaLabel="Organización" value={String(organizationId)} onValueChange={(value) => { setOrganizationId(Number(value)); setSelected([]); setResult(null); setPrescriptionRevisionId(null) }} options={organizations.map((organization) => ({ value: String(organization.id), label: organization.name }))} /></label>
          <label className="text-xs font-medium text-[#4A5B58]">Receta para sugerencias<FormSelect className="mt-1" ariaLabel="Receta para sugerencias" value={String(prescriptionRevisionId ?? '')} onValueChange={(value) => { setPrescriptionRevisionId(value ? Number(value) : null); setResult(null) }} options={[{ value: '', label: 'Sin receta' }, ...prescriptions.filter(({ organizationId: id }) => id === organizationId).map((prescription) => ({ value: String(prescription.id), label: prescription.label }))]} /></label>
          <label className="text-xs font-medium text-[#4A5B58]">Tasa de esta simulación<input className={`mt-1 w-full ${inputClass}`} value={rate} onChange={(event) => { setRate(event.target.value); setResult(null) }} type="number" min="0.01" step="0.01" /><span className="mt-1 block font-normal text-[#74857F]">CUP por 1 USD; no altera los importes originales.</span></label>
        </div>
        )}
        {!isPlatformAdmin && !access?.canCalculate ? <p className="mt-4 rounded-lg bg-[#FFF4E8] px-4 py-3 text-sm text-[#A35A15]">Esta organización está en modo de solo lectura; el simulador de nuevas ventas está deshabilitado.</p> : null}
      </section>

      <div className={isPlatformAdmin ? '' : 'grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_380px]'}>
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.key} className="rounded-[10px] border border-[#E3EFED] bg-white p-5">
              <h2 className="font-display text-base font-semibold text-[#07322F]">{group.label}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {group.items.map((item) => {
                  const active = selected.includes(item.id)
                  return (
                    <article key={item.id} className={`relative rounded-lg border p-4 ${active ? 'border-[1.5px] border-[#0D7A72] bg-[#F0FBF9]' : 'border-[#E3EFED]'}`}>
                      <div className="absolute right-3 top-3 z-[1] flex items-center gap-1.5">
                        <span className="rounded-[5px] bg-[#E2F4F1] px-2 py-1 text-[11px] font-bold text-[#0D7A72]">{item.effectiveCurrency}</span>
                        {canManage ? <button type="button" onClick={() => setEditingItemId(item.id)} aria-label={isPlatformAdmin ? `Editar artículo base ${item.name}` : `Personalizar ${item.name} para la organización`} title={isPlatformAdmin ? 'Editar artículo base' : 'Personalizar para la organización'} className="grid h-7 w-7 place-items-center rounded-[5px] text-[#0D7A72] transition hover:bg-[#D7EFEB] focus:outline-none focus:ring-2 focus:ring-[#35C2A8]"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></button> : null}
                      </div>
                      <button type="button" disabled={!item.enabled} onClick={() => toggleItem(item.id)} className="w-full pr-20 text-left disabled:cursor-not-allowed disabled:opacity-50">
                        <div><h3 className="text-sm font-semibold text-[#07322F]">{item.name}</h3><p className="mt-1 text-xs text-[#74857F]">{item.description}</p></div>
                        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#74857F]">Precio de venta</p><p className="font-display text-lg font-bold text-[#07322F]">{money(item.effectivePrice, item.effectiveCurrency)}</p>
                        {canManage ? <p className="mt-1 text-xs text-[#74857F]">Costo interno: {money(item.effectiveCost, item.effectiveCurrency)}{item.customized ? ' · personalizado' : ''}</p> : null}
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}

          {canManage ? (
            <details className="rounded-[10px] border border-[#E3EFED] bg-white p-5"><summary className="cursor-pointer font-display text-sm font-semibold text-[#07322F]">+ Crear {isPlatformAdmin ? 'artículo base' : 'artículo propio'}</summary><form onSubmit={createItem} className="mt-4 grid gap-3 md:grid-cols-3"><FormSelect name="category" ariaLabel="Categoría" options={[{ value: 'vision_type', label: 'Tipo' }, { value: 'lens_material', label: 'Material' }, { value: 'treatment', label: 'Tratamiento' }, { value: 'frame', label: 'Armadura' }, { value: 'mounting', label: 'Montaje' }, { value: 'adjustment', label: 'Ajuste' }]} /><input className={inputClass} name="code" placeholder="código_interno" pattern="[A-Za-z][A-Za-z0-9_]{1,49}" required /><input className={inputClass} name="name" placeholder="Nombre" minLength={2} maxLength={120} required /><input className={inputClass} name="costAmount" type="number" min="0" step="0.01" placeholder="Costo" required /><input className={inputClass} name="salePrice" type="number" min="0" step="0.01" placeholder="Precio" required /><FormSelect name="currency" ariaLabel="Moneda" options={[{ value: 'CUP', label: 'CUP' }, { value: 'USD', label: 'USD' }]} /><input className={`${inputClass} md:col-span-3`} name="description" placeholder="Descripción opcional" /><button disabled={pending} className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white">Crear artículo</button></form></details>
          ) : null}
        </div>

        {!isPlatformAdmin ? <aside className="h-fit rounded-[10px] border border-[#E3EFED] bg-white xl:sticky xl:top-6">
          <div className="border-b border-[#EEF5F4] p-5"><div className="flex items-center justify-between"><h2 className="font-display text-base font-semibold text-[#07322F]">Simulación</h2><span className="text-xs text-[#74857F]">{selected.length} conceptos</span></div></div>
          {result ? <div className="space-y-3 p-5">{result.lineItems.map((line, index) => <div key={`${line.kind}:${line.itemId ?? index}`} className="flex justify-between gap-3 text-sm"><span className="text-[#4A5B58]">{line.name}</span><span className="whitespace-nowrap font-display font-semibold text-[#07322F]">{money(Number(line.amount), line.currency)}</span></div>)}<div className="border-t border-dashed border-[#DCECEA] pt-4">{Object.entries(result.totals).map(([currency, total]) => <div key={currency} className="flex justify-between font-display text-xl font-bold text-[#07322F]"><span>Total {currency}</span><span>{money(Number(total), currency)}</span></div>)}{result.cupEquivalent !== null ? <p className="mt-2 text-right text-xs text-[#74857F]">Equivalente: {money(Number(result.cupEquivalent), 'CUP')} a {result.usdToCupRate} CUP/USD</p> : null}</div>{result.warnings.map((warning, index) => <div key={index} className="rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-3 text-xs leading-5 text-[#7A3A26]"><strong>Sugerencia orientativa:</strong> {warning.message}</div>)}</div> : <p className="p-5 text-sm leading-6 text-[#74857F]">Selecciona conceptos y calcula. Cada importe conserva su moneda original.</p>}
          <div className="border-t border-[#EEF5F4] p-5"><button type="button" disabled={pending || !selected.length || !access?.canCalculate} onClick={() => void calculate()} className="w-full rounded-[9px] bg-[#0D7A72] px-4 py-3.5 font-display text-sm font-semibold text-white hover:bg-[#07322F] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Calculando…' : 'Calcular precio'}</button>{message ? <p role="status" className="mt-3 text-sm text-[#4A5B58]">{message}</p> : null}</div>
        </aside> : null}
      </div>

      <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5"><h2 className="font-display text-base font-semibold text-[#07322F]">Reglas de graduación activas</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{rules.filter((rule) => rule.organization_id === null || rule.organization_id === organizationId).map((rule) => <article key={rule.id} className="rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-4"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold text-[#7A3A26]">{rule.name}</h3><span className="rounded-[5px] bg-white px-2 py-1 text-[11px] text-[#A35A15]">Orientativa</span></div><p className="mt-2 text-xs leading-5 text-[#7A3A26]">{rule.message}</p></article>)}</div></section>
      {editingItem ? <div role="dialog" aria-modal="true" aria-labelledby="catalog-edit-title" className="fixed inset-0 z-50 grid place-items-center bg-[#07322F]/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingItemId(null) }}><div className="w-full max-w-lg rounded-[12px] bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-[#E3EFED] p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0D7A72]">{isPlatformAdmin ? 'Catálogo base' : access?.name}</p><h2 id="catalog-edit-title" className="mt-1 font-display text-xl font-bold text-[#07322F]">Editar {editingItem.name}</h2></div><button type="button" onClick={() => setEditingItemId(null)} aria-label="Cerrar edición" className="grid h-10 w-10 place-items-center rounded-lg border border-[#DCECEA] text-xl text-[#07322F]">×</button></div><form onSubmit={(event) => void (isPlatformAdmin ? saveBaseItem(editingItem, event) : saveOverride(editingItem, event))} className="grid gap-4 p-5 sm:grid-cols-2"><label className="text-sm font-semibold text-[#4A5B58]">Costo interno<input className={`mt-1 w-full ${inputClass}`} name="costAmount" type="number" min="0" step="0.01" defaultValue={editingItem.effectiveCost} required /></label><label className="text-sm font-semibold text-[#4A5B58]">Precio de venta<input className={`mt-1 w-full ${inputClass}`} name="salePrice" type="number" min="0" step="0.01" defaultValue={editingItem.effectivePrice} required /></label><label className="text-sm font-semibold text-[#4A5B58]">Moneda<FormSelect className="mt-1" name="currency" ariaLabel="Moneda" defaultValue={editingItem.effectiveCurrency} options={[{ value: 'CUP', label: 'CUP' }, { value: 'USD', label: 'USD' }]} /></label><label className="flex h-[42px] items-center gap-3 self-end rounded-[7px] border border-[#DCECEA] px-3 text-sm font-semibold text-[#4A5B58]"><input name="isEnabled" type="checkbox" defaultChecked={editingItem.enabled} className="h-4 w-4 accent-[#0D7A72]" />Disponible</label><div className="flex justify-end gap-3 border-t border-[#EEF5F4] pt-4 sm:col-span-2"><button type="button" onClick={() => setEditingItemId(null)} className="rounded-[7px] border border-[#DCECEA] px-4 py-2.5 text-sm font-semibold text-[#4A5B58]">Cancelar</button><button disabled={pending} className="rounded-[7px] bg-[#07322F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Guardando…' : 'Guardar cambios'}</button></div></form></div></div> : null}
    </div>
  )
}
