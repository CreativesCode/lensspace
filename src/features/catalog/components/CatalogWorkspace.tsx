'use client'

import { Calculator, Check, Pencil, Plus, Store } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'
import { Alert, Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, IconButton, Input, Switch, Toast, cx } from '@/shared/ui'

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
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [pending, setPending] = useState(false)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editEnabled, setEditEnabled] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

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

  function openEditor(itemId: number, enabled: boolean) {
    setError(null)
    setEditEnabled(enabled)
    setEditingItemId(itemId)
  }

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
      setError('Selecciona al menos un artículo disponible.')
      return
    }
    setPending(true)
    setError(null)
    const numericRate = rate.trim() ? Number(rate) : null
    const { data, error } = await supabase.rpc('calculate_catalog_price', {
      target_organization_id: organizationId,
      selected_item_ids: selected,
      target_prescription_revision_id: prescriptionRevisionId,
      usd_to_cup_rate: numericRate,
    } as never)
    if (error) {
      setError(error.message || 'No se pudo calcular el precio.')
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
    setError(null)
    const form = new FormData(event.currentTarget)
    const { data: { user } } = await supabase.auth.getUser()
    const changes = {
      cost_amount: Number(form.get('costAmount')),
      sale_price: Number(form.get('salePrice')),
      currency: String(form.get('currency')).toUpperCase(),
      is_enabled: editEnabled,
      changed_by: user!.id,
      changed_at: new Date().toISOString(),
    }
    const entry = { organization_id: organizationId, catalog_item_id: item.id, ...changes }
    // UPDATE is granted only on the editable columns, so an upsert (which also sets the
    // key columns) is rejected: update an existing override, insert a new one.
    const updateExisting = () => supabase.from('catalog_item_overrides').update(changes as never).eq('organization_id', organizationId).eq('catalog_item_id', item.id)
    const exists = overrides.some((override) => override.organization_id === organizationId && override.catalog_item_id === item.id)
    let { error } = exists ? await updateExisting() : await supabase.from('catalog_item_overrides').insert(entry as never)
    if (error?.code === '23505') ({ error } = await updateExisting())
    if (error) {
      setError(error.message || 'No se pudo guardar la personalización.')
    } else {
      setOverrides((current) => [
        ...current.filter(
          (override) =>
            override.organization_id !== organizationId || override.catalog_item_id !== item.id,
        ),
        entry,
      ])
      setResult(null)
      setToast(`${item.name} actualizado para ${access?.name ?? 'la organización'}.`)
      setEditingItemId(null)
    }
    setPending(false)
  }

  async function saveBaseItem(item: CatalogItem, event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isPlatformAdmin) return
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const changes = {
      cost_amount: Number(form.get('costAmount')),
      sale_price: Number(form.get('salePrice')),
      currency: String(form.get('currency')).toUpperCase(),
      is_active: editEnabled,
    }
    const { error } = await supabase
      .from('catalog_items')
      .update(changes as never)
      .eq('id', item.id)
      .is('organization_id', null)
    if (error) {
      setError(error.message || 'No se pudo actualizar el artículo base.')
    } else {
      setItems((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, ...changes } : entry,
      ))
      setToast(`${item.name} actualizado en el catálogo base.`)
      setEditingItemId(null)
    }
    setPending(false)
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) return
    setPending(true)
    setError(null)
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
      setError(error.message || 'No se pudo crear el artículo.')
    } else {
      setItems((current) => [...current, data as CatalogItem])
      formElement.reset()
      setCreateOpen(false)
      setToast(isPlatformAdmin ? 'Artículo base creado correctamente.' : 'Artículo propio creado correctamente.')
    }
    setPending(false)
  }

  if (!isPlatformAdmin && !organizations.length) {
    return <EmptyState icon={Store} title="Sin acceso comercial" description="Tu cuenta no tiene acceso comercial a una organización." />
  }

  const currencyOptions = [{ value: 'CUP', label: 'CUP' }, { value: 'USD', label: 'USD' }]
  const activeRules = rules.filter((rule) => rule.organization_id === null || rule.organization_id === organizationId)
  const inlineError = error && !editingItem && !createOpen ? <Alert tone="danger" role="alert">{error}</Alert> : null

  return (
    <div className="flex flex-col gap-5">
      {!isPlatformAdmin ? (
        <Card className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Field label="Organización"><FormSelect ariaLabel="Organización" value={String(organizationId)} onValueChange={(value) => { setOrganizationId(Number(value)); setSelected([]); setResult(null); setPrescriptionRevisionId(null) }} options={organizations.map((organization) => ({ value: String(organization.id), label: organization.name }))} /></Field>
            <Field label="Receta para sugerencias"><FormSelect ariaLabel="Receta para sugerencias" value={String(prescriptionRevisionId ?? '')} onValueChange={(value) => { setPrescriptionRevisionId(value ? Number(value) : null); setResult(null) }} options={[{ value: '', label: 'Sin receta' }, ...prescriptions.filter(({ organizationId: id }) => id === organizationId).map((prescription) => ({ value: String(prescription.id), label: prescription.label }))]} /></Field>
            <Field label="Tasa de esta simulación" help="CUP por 1 USD; no altera los importes originales."><Input value={rate} onChange={(event) => { setRate(event.target.value); setResult(null) }} type="number" inputMode="decimal" min="0.01" step="0.01" numeric /></Field>
          </div>
          {!access?.canCalculate ? <Alert tone="warning">Esta organización está en modo de solo lectura; el simulador de nuevas ventas está deshabilitado.</Alert> : null}
        </Card>
      ) : null}

      {canManage ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-muted">{visibleItems.length === 1 ? '1 artículo' : `${visibleItems.length} artículos`}</p>
          <Button icon={Plus} onClick={() => { setError(null); setCreateOpen(true) }}>{isPlatformAdmin ? 'Nuevo artículo base' : 'Nuevo artículo propio'}</Button>
        </div>
      ) : null}

      <div className={isPlatformAdmin ? 'flex flex-col gap-4' : 'grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]'}>
        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <Card key={group.key} className="flex flex-col gap-3">
              <CardHeader title={group.label} meta={group.items.length} />
              <div className="grid gap-2.5 md:grid-cols-2">
                {group.items.map((item) => {
                  const active = selected.includes(item.id)
                  return (
                    <div key={item.id} className={cx('relative rounded-card border transition', active ? 'border-action bg-action-tint shadow-[0_0_0_1px_theme(colors.action.DEFAULT)]' : 'border-line-card bg-surface hover:border-line-hover')}>
                      <button type="button" aria-pressed={isPlatformAdmin ? undefined : active} disabled={isPlatformAdmin || !item.enabled} onClick={() => toggleItem(item.id)} className="flex min-h-16 w-full items-start gap-3 rounded-card p-3.5 pr-14 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action disabled:cursor-default">
                        {!isPlatformAdmin ? (
                          <span aria-hidden="true" className={cx('mt-0.5 grid size-5 shrink-0 place-items-center rounded-badge border', active ? 'border-action bg-action text-white' : 'border-line-strong bg-surface')}>
                            {active ? <Check size={14} strokeWidth={3} /> : null}
                          </span>
                        ) : null}
                        <span className={cx('flex min-w-0 flex-col gap-1', !item.enabled && 'opacity-50')}>
                          <strong className="font-display text-[15px] font-semibold text-ink">{item.name}</strong>
                          {item.description ? <span className="text-[13px] text-text-muted">{item.description}</span> : null}
                          <span className="font-display text-lg font-bold tabular-nums text-ink">{money(item.effectivePrice, item.effectiveCurrency)}</span>
                          {canManage ? <span className="text-[13px] text-text-muted">Costo interno: {money(item.effectiveCost, item.effectiveCurrency)}</span> : null}
                          <span className="flex flex-wrap gap-1.5">
                            <Badge tone="neutral">{item.effectiveCurrency}</Badge>
                            {item.customized ? <Badge tone="progress">Personalizado</Badge> : null}
                            {!item.enabled ? <Badge tone="neutral">No disponible</Badge> : null}
                          </span>
                        </span>
                      </button>
                      {canManage ? <div className="absolute right-2 top-2"><IconButton icon={Pencil} label={isPlatformAdmin ? `Editar artículo base ${item.name}` : `Personalizar ${item.name} para la organización`} onClick={() => openEditor(item.id, item.enabled)} /></div> : null}
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
          {!grouped.length ? <EmptyState icon={Store} title="Sin artículos en el catálogo" description={canManage ? 'Crea el primer artículo para empezar a cotizar.' : undefined} /> : null}
          {isPlatformAdmin ? inlineError : null}
        </div>

        {!isPlatformAdmin ? (
          <Card padded={false} className="xl:sticky xl:top-6">
            <div className="border-b border-line p-5"><CardHeader title="Simulación" meta={selected.length === 1 ? '1 concepto' : `${selected.length} conceptos`} /></div>
            {result ? (
              <div className="flex flex-col gap-3 p-5">
                {result.lineItems.map((line, index) => <div key={`${line.kind}:${line.itemId ?? index}`} className="flex justify-between gap-3 text-sm"><span className="text-text">{line.name}</span><span className="whitespace-nowrap font-display font-semibold tabular-nums text-ink">{money(Number(line.amount), line.currency)}</span></div>)}
                <div className="border-t border-dashed border-line pt-4">
                  {Object.entries(result.totals).map(([currency, total]) => <div key={currency} className="flex justify-between font-display text-xl font-bold tabular-nums text-ink"><span>Total {currency}</span><span>{money(Number(total), currency)}</span></div>)}
                  {result.cupEquivalent !== null ? <p className="mt-2 text-right text-[13px] text-text-muted">Equivalente: {money(Number(result.cupEquivalent), 'CUP')} a {result.usdToCupRate} CUP/USD</p> : null}
                </div>
                {result.warnings.map((warning, index) => <Alert key={index} tone="warning" title="Sugerencia orientativa">{warning.message}</Alert>)}
              </div>
            ) : <p className="p-5 text-sm leading-6 text-text-muted">Selecciona conceptos y calcula. Cada importe conserva su moneda original.</p>}
            <div className="flex flex-col gap-3 border-t border-line p-5">
              <Button size="lg" block icon={Calculator} disabled={pending || !selected.length || !access?.canCalculate} onClick={() => void calculate()}>{pending ? 'Calculando…' : 'Calcular precio'}</Button>
              {inlineError}
            </div>
          </Card>
        ) : null}
      </div>

      {activeRules.length ? (
        <Card className="flex flex-col gap-3">
          <CardHeader title="Reglas de graduación activas" meta={activeRules.length} />
          <div className="grid gap-3 md:grid-cols-2">
            {activeRules.map((rule) => <Alert key={rule.id} tone="warning" title={rule.name}>{rule.message}</Alert>)}
          </div>
        </Card>
      ) : null}

      <Dialog
        open={Boolean(editingItem)}
        onClose={() => { if (!pending) setEditingItemId(null) }}
        eyebrow={isPlatformAdmin ? 'Catálogo base' : access?.name}
        title={editingItem ? `Editar ${editingItem.name}` : ''}
        size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setEditingItemId(null)} disabled={pending}>Cancelar</Button>
          <Button type="submit" form="catalog-edit" variant="ink" disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</Button>
        </>}
      >
        {editingItem ? (
          <form id="catalog-edit" onSubmit={(event) => void (isPlatformAdmin ? saveBaseItem(editingItem, event) : saveOverride(editingItem, event))} className="grid gap-4 sm:grid-cols-2">
            <Field label="Costo interno"><Input name="costAmount" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={editingItem.effectiveCost} required numeric /></Field>
            <Field label="Precio de venta"><Input name="salePrice" type="number" inputMode="decimal" min="0" step="0.01" defaultValue={editingItem.effectivePrice} required numeric /></Field>
            <Field label="Moneda"><FormSelect name="currency" ariaLabel="Moneda" defaultValue={editingItem.effectiveCurrency} options={currencyOptions} /></Field>
            <div className="flex min-h-11 items-end"><Switch checked={editEnabled} onChange={setEditEnabled} label="Disponible" /></div>
            {error ? <Alert tone="danger" role="alert" className="sm:col-span-2">{error}</Alert> : null}
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={createOpen}
        onClose={() => { if (!pending) setCreateOpen(false) }}
        eyebrow={isPlatformAdmin ? 'Catálogo base' : access?.name}
        title={isPlatformAdmin ? 'Nuevo artículo base' : 'Nuevo artículo propio'}
        size="lg"
        footer={<>
          <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={pending}>Cancelar</Button>
          <Button type="submit" form="catalog-create" icon={Plus} disabled={pending}>{pending ? 'Creando…' : 'Crear artículo'}</Button>
        </>}
      >
        <form id="catalog-create" onSubmit={(event) => void createItem(event)} className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoría"><FormSelect name="category" ariaLabel="Categoría" options={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))} /></Field>
          <Field label="Código interno" help="Letras, números y guion bajo."><Input name="code" placeholder="codigo_interno" pattern="[A-Za-z][A-Za-z0-9_]{1,49}" required /></Field>
          <Field label="Nombre" className="sm:col-span-2"><Input name="name" minLength={2} maxLength={120} required /></Field>
          <Field label="Costo"><Input name="costAmount" type="number" inputMode="decimal" min="0" step="0.01" required numeric /></Field>
          <Field label="Precio de venta"><Input name="salePrice" type="number" inputMode="decimal" min="0" step="0.01" required numeric /></Field>
          <Field label="Moneda"><FormSelect name="currency" ariaLabel="Moneda" options={currencyOptions} /></Field>
          <Field label="Descripción" optional className="sm:col-span-2"><Input name="description" maxLength={300} /></Field>
          {error ? <Alert tone="danger" role="alert" className="sm:col-span-2">{error}</Alert> : null}
        </form>
      </Dialog>

      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
