'use client'

import Link from 'next/link'
import { useCallback, useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'
import { CustomerFormFields, customerFormValues, type CustomerPhoneDraft } from './CustomerFormFields'

type AccessScope = {
  organizationId: number
  organizationName: string
  branchId: number
  branchName: string
  canWrite: boolean
}

type CustomerPhone = Pick<
  Tables<'customer_phones'>,
  'id' | 'phone_number' | 'normalized_phone' | 'label' | 'is_primary' | 'whatsapp_enabled'
>

type CustomerResult = Pick<
  Tables<'customers'>,
  | 'id'
  | 'organization_id'
  | 'branch_id'
  | 'full_name'
  | 'national_id'
  | 'address'
  | 'birth_date'
  | 'notes'
  | 'messaging_consent'
> & {
  customer_phones: CustomerPhone[]
  orderSummary?: { total: number; open: number; completed: number }
}

type CustomerOrder = { customerId: number; commercialStatus: string }

const customerSelect =
  'id, organization_id, branch_id, full_name, national_id, address, birth_date, notes, messaging_consent, customer_phones(id, phone_number, normalized_phone, label, is_primary, whatsapp_enabled)'

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function CustomerWorkspace({ scopes }: { scopes: AccessScope[] }) {
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerResult[]>([])
  const [selected, setSelected] = useState<CustomerResult | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicateReviewed, setDuplicateReviewed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [target, setTarget] = useState(
    scopes[0] ? `${scopes[0].organizationId}:${scopes[0].branchId}` : '',
  )
  const [fullName, setFullName] = useState('')
  const [phones, setPhones] = useState<CustomerPhoneDraft[]>([
    { number: '', label: 'Principal', whatsappEnabled: true },
  ])

  const activeScope = scopes.find(
    (scope) => `${scope.organizationId}:${scope.branchId}` === target,
  )

  const withOrderSummaries = useCallback(async (customers: CustomerResult[]) => {
    const ids = customers.map(({ id }) => id)
    if (!ids.length) return customers
    const { data, error } = await supabase.rpc('list_accessible_orders')
    if (error) return customers

    const orders = (data ?? []) as CustomerOrder[]
    return customers.map((customer) => {
      const customerOrders = orders.filter(({ customerId }) => customerId === customer.id)
      const completed = customerOrders.filter(({ commercialStatus }) =>
        ['delivered', 'closed'].includes(commercialStatus),
      ).length
      return {
        ...customer,
        orderSummary: {
          total: customerOrders.length,
          open: customerOrders.length - completed,
          completed,
        },
      }
    })
  }, [supabase])

  const searchCustomers = useCallback(
    async (rawQuery: string) => {
      setLoading(true)
      setSearched(true)
      setMessage(null)
      const term = rawQuery.trim()
      const digits = normalizePhone(term)
      let customerIds: number[] = []

      if (digits.length >= 5) {
        const { data: phoneMatches } = await supabase
          .from('customer_phones')
          .select('customer_id')
          .like('normalized_phone', `%${digits}%`)
          .limit(30)
        customerIds = [...new Set((phoneMatches ?? []).map(({ customer_id }) => customer_id))]
      }

      let request = supabase
        .from('customers')
        .select(customerSelect)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(30)

      if (term) {
        const safeTerm = term.replace(/[,%()]/g, ' ')
        request = customerIds.length
          ? request.or(`full_name.ilike.%${safeTerm}%,id.in.(${customerIds.join(',')})`)
          : request.ilike('full_name', `%${safeTerm}%`)
      }

      const { data, error } = await request
      if (error) {
        setResults([])
        setMessage('No pudimos consultar los clientes. Intenta nuevamente.')
      } else {
        const customers = (data ?? []) as CustomerResult[]
        setResults(await withOrderSummaries(customers))
      }
      setLoading(false)
    },
    [supabase, withOrderSummaries],
  )

  const duplicateCandidates = useMemo(() => {
    const draftedPhones = new Set(
      phones.map(({ number }) => normalizePhone(number)).filter((number) => number.length >= 5),
    )
    const normalizedName = fullName.trim().toLocaleLowerCase('es')

    return results.filter(
      (customer) =>
        (normalizedName.length >= 2 &&
          customer.full_name.trim().toLocaleLowerCase('es') === normalizedName) ||
        customer.customer_phones.some(({ normalized_phone }) =>
          normalized_phone ? draftedPhones.has(normalized_phone) : false,
        ),
    )
  }, [fullName, phones, results])

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSelected(null)
    await searchCustomers(query)
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeScope?.canWrite) {
      setMessage('Esta organización está en modo de solo lectura.')
      return
    }

    const form = new FormData(event.currentTarget)
    const values = customerFormValues(form, fullName, phones)
    const validPhones = values.phones
    if (validPhones.length !== phones.length || !fullName.trim()) {
      setMessage('Completa el nombre y usa teléfonos de al menos cinco dígitos.')
      return
    }

    setSaving(true)
    setMessage(null)
    const normalizedPhones = validPhones.map(({ number }) => normalizePhone(number))
    const [{ data: phoneMatches }, { data: nameMatches }] = await Promise.all([
      supabase
        .from('customer_phones')
        .select('customer_id')
        .in('normalized_phone', normalizedPhones),
      supabase
        .from('customers')
        .select('id')
        .is('archived_at', null)
        .ilike('full_name', fullName.trim()),
    ])
    const possibleDuplicateIds = [
      ...new Set([
        ...(phoneMatches ?? []).map(({ customer_id }) => customer_id),
        ...(nameMatches ?? []).map(({ id }) => id),
      ]),
    ]

    const otherDuplicateIds = possibleDuplicateIds.filter((id) => id !== editingCustomer?.id)
    if (otherDuplicateIds.length && !duplicateReviewed) {
      const { data: matches } = await supabase
        .from('customers')
        .select(customerSelect)
        .in('id', otherDuplicateIds)
        .is('archived_at', null)
      setResults(await withOrderSummaries((matches ?? []) as CustomerResult[]))
      setSearched(true)
      setQuery(fullName.trim())
      setDuplicateReviewed(true)
      setMessage('Revisa las posibles coincidencias. Si es otra persona, vuelve a pulsar Guardar cliente.')
      setSaving(false)
      return
    }

    const { data, error } = editingCustomer
      ? await supabase.rpc('update_customer_with_phones', {
          target_customer_id: editingCustomer.id,
          customer_full_name: values.fullName,
          customer_national_id: values.nationalId,
          customer_address: values.address,
          customer_birth_date: values.birthDate,
          customer_notes: values.notes,
          customer_messaging_consent: values.messagingConsent,
          phone_entries: validPhones,
        } as never)
      : await supabase.rpc('create_customer_with_phones', {
          target_organization_id: activeScope.organizationId,
          target_branch_id: activeScope.branchId,
          customer_full_name: values.fullName,
          customer_national_id: values.nationalId,
          customer_address: values.address,
          customer_birth_date: values.birthDate,
          customer_notes: values.notes,
          customer_messaging_consent: values.messagingConsent,
          phone_entries: validPhones,
        } as never)

    if (error) {
      setMessage(error.message || 'No se pudo registrar el cliente.')
      setSaving(false)
      return
    }

    setQuery(fullName.trim())
    setShowForm(false)
    setEditingCustomer(null)
    setFullName('')
    setPhones([{ number: '', label: 'Principal', whatsappEnabled: true }])
    await searchCustomers(fullName.trim())
    setSelected(null)
    setMessage(editingCustomer ? 'Ficha del cliente actualizada correctamente.' : `Cliente #${data} registrado correctamente.`)
    setDuplicateReviewed(false)
    setSaving(false)
  }

  if (!scopes.length) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#DCECEA] bg-white p-8 text-sm text-[#74857F]">
        Tu cuenta no tiene acceso de dueño o vendedor a una sucursal.
      </div>
    )
  }

  const fieldClass =
    'mt-1 w-full rounded-[7px] border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 text-sm text-[#1C3A37] outline-none transition focus:border-[#0D7A72] focus:bg-white focus:ring-4 focus:ring-[#E2F4F1]'

  return (
    <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <section className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)]">
          <h2 className="font-display text-base font-semibold text-[#07322F]">
            Buscar o registrar al cliente
          </h2>
          <p className="mt-1 text-[13px] text-[#74857F]">
            El teléfono no es único: varias personas pueden compartirlo.
          </p>

          <form onSubmit={submitSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#DCECEA] bg-[#FBFEFD] px-3 py-2.5 focus-within:border-[#0D7A72] focus-within:ring-4 focus-within:ring-[#E2F4F1]">
              <span aria-hidden="true" className="text-[#74857F]">⌕</span>
              <span className="sr-only">Buscar por nombre o teléfono</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-[#1C3A37] outline-none"
                placeholder="Nombre o teléfono"
              />
            </label>
            <button className="rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#07322F]">
              Buscar
            </button>
          </form>

          <div className="mt-3 space-y-2" aria-live="polite">
            {loading ? (
              <p className="py-5 text-sm text-[#74857F]">Buscando clientes…</p>
            ) : results.length ? (
              results.map((customer) => {
                const scope = scopes.find(
                  ({ organizationId, branchId }) =>
                    organizationId === customer.organization_id && branchId === customer.branch_id,
                )
                const isSelected = selected?.id === customer.id
                return (
                  <button
                    type="button"
                    key={customer.id}
                    onClick={() => setSelected(customer)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                      isSelected
                        ? 'border-[1.5px] border-[#0D7A72] bg-[#F0FBF9]'
                        : 'border-[#E3EFED] bg-white hover:bg-[#FBFEFD]'
                    }`}
                  >
                    <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ${isSelected ? 'bg-[#0D7A72] text-white' : 'bg-[#EEF5F4] text-[#74857F]'}`}>
                      {initials(customer.full_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#07322F]">
                        {customer.full_name}
                      </span>
                      <span className="block truncate text-xs text-[#74857F]">
                        {customer.customer_phones.map(({ phone_number }) => phone_number).join(' · ')}
                        {scope ? ` · ${scope.branchName}` : ''}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                        <span className="rounded bg-[#EEF5F4] px-2 py-1 text-[#4A5B58]">
                          {customer.orderSummary?.total ?? 0} {(customer.orderSummary?.total ?? 0) === 1 ? 'trabajo' : 'trabajos'}
                        </span>
                        <span className={`rounded px-2 py-1 ${(customer.orderSummary?.open ?? 0) > 0 ? 'bg-[#FFF0EB] text-[#A34732]' : 'bg-[#F4F7F6] text-[#74857F]'}`}>
                          {customer.orderSummary?.open ?? 0} abiertos
                        </span>
                        <span className="rounded bg-[#D9F5EE] px-2 py-1 text-[#07655C]">
                          {customer.orderSummary?.completed ?? 0} finalizados
                        </span>
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-[#0D7A72]">
                      {isSelected ? 'Seleccionado' : 'Usar ficha'}
                    </span>
                  </button>
                )
              })
            ) : searched ? (
              <p className="rounded-lg border border-dashed border-[#DCECEA] p-5 text-sm text-[#74857F]">
                No encontramos coincidencias. Puedes registrar una ficha nueva.
              </p>
            ) : (
              <p className="rounded-lg border border-dashed border-[#DCECEA] p-5 text-sm text-[#74857F]">
                Busca por nombre o teléfono antes de registrar una ficha nueva.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null)
              setShowForm((visible) => !visible)
              if (!showForm && query && !normalizePhone(query)) setFullName(query)
              if (!showForm && normalizePhone(query).length >= 5) {
                setPhones([{ number: query, label: 'Principal', whatsappEnabled: true }])
              }
            }}
            className="mt-4 rounded-[7px] border border-[#DCECEA] bg-white px-4 py-2.5 text-sm font-semibold text-[#07322F] transition hover:bg-[#F0FBF9]"
          >
            {showForm ? 'Cerrar formulario' : '+ Registrar cliente nuevo'}
          </button>
        </section>

        {showForm ? (
          <form key={editingCustomer?.id ?? 'new'} onSubmit={saveCustomer} className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#07322F]">{editingCustomer ? 'Editar ficha' : 'Nueva ficha'}</h2>
                <p className="mt-1 text-[13px] text-[#74857F]">{editingCustomer ? 'Actualiza los datos vigentes del cliente.' : 'Revisa las coincidencias antes de guardar.'}</p>
              </div>
              {!activeScope?.canWrite ? (
                <span className="rounded-[5px] bg-[#FFF4E8] px-2 py-1 text-xs font-semibold text-[#A35A15]">Solo lectura</span>
              ) : null}
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-[#4A5B58]">
                Organización y sucursal
                <FormSelect className="mt-1" ariaLabel="Organización y sucursal" value={target} disabled={Boolean(editingCustomer)} onValueChange={setTarget} options={scopes.map((scope) => ({ value: `${scope.organizationId}:${scope.branchId}`, label: `${scope.organizationName} · ${scope.branchName}${scope.canWrite ? '' : ' (solo lectura)'}` }))} />
              </label>
            </div>
            <div className="mt-4"><CustomerFormFields fullName={fullName} onFullNameChange={(value) => { setFullName(value); setDuplicateReviewed(false) }} phones={phones} onPhonesChange={(value) => { setPhones(value); setDuplicateReviewed(false) }} fieldClass={fieldClass} initialValues={editingCustomer ? { nationalId: editingCustomer.national_id, birthDate: editingCustomer.birth_date, address: editingCustomer.address, notes: editingCustomer.notes, messagingConsent: editingCustomer.messaging_consent } : undefined} /></div>

            {duplicateCandidates.length ? (
              <div className="mt-5 rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-4 text-sm text-[#7A3A26]">
                <p className="font-semibold">Posible duplicado</p>
                <p className="mt-1">Hay {duplicateCandidates.length} ficha(s) con el mismo nombre o teléfono. Revísalas arriba; el teléfono compartido no impide continuar.</p>
              </div>
            ) : null}

            <button disabled={saving || !activeScope?.canWrite} className="mt-5 rounded-[7px] bg-[#0D7A72] px-4 py-2.5 font-display text-sm font-semibold text-white transition hover:bg-[#07322F] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Guardando…' : editingCustomer ? 'Guardar cambios' : duplicateReviewed ? 'Confirmar cliente distinto' : 'Guardar cliente'}
            </button>
          </form>
        ) : null}

        {message ? <p role="status" className="rounded-lg border border-[#DCECEA] bg-white px-4 py-3 text-sm text-[#4A5B58]">{message}</p> : null}
      </div>

      <aside className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)] xl:sticky xl:top-6">
        <h2 className="font-display text-[15px] font-semibold text-[#07322F]">Ficha seleccionada</h2>
        {selected ? (
          <><dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-xs text-[#74857F]">Cliente</dt><dd className="mt-1 font-semibold text-[#07322F]">{selected.full_name}</dd></div>
            <div><dt className="text-xs text-[#74857F]">Teléfonos</dt><dd className="mt-1 text-[#1C3A37]">{selected.customer_phones.map(({ phone_number }) => phone_number).join(' · ')}</dd></div>
            <div><dt className="text-xs text-[#74857F]">Dirección</dt><dd className="mt-1 text-[#1C3A37]">{selected.address || '—'}</dd></div>
            <div><dt className="text-xs text-[#74857F]">Nacimiento</dt><dd className="mt-1 text-[#1C3A37]">{selected.birth_date || '—'}</dd></div>
            <div><dt className="text-xs text-[#74857F]">WhatsApp</dt><dd className={`mt-1 font-semibold ${selected.messaging_consent ? 'text-[#0D7A72]' : 'text-[#74857F]'}`}>{selected.messaging_consent ? 'Consentimiento otorgado' : 'Sin consentimiento'}</dd></div>
            <div><dt className="text-xs text-[#74857F]">Trabajos</dt><dd className="mt-2 grid grid-cols-3 gap-2 text-center"><span className="rounded-lg bg-[#EEF5F4] px-2 py-2"><strong className="block text-base text-[#07322F]">{selected.orderSummary?.total ?? 0}</strong><small className="text-[#74857F]">Total</small></span><span className="rounded-lg bg-[#FFF0EB] px-2 py-2"><strong className="block text-base text-[#A34732]">{selected.orderSummary?.open ?? 0}</strong><small className="text-[#A34732]">Abiertos</small></span><span className="rounded-lg bg-[#D9F5EE] px-2 py-2"><strong className="block text-base text-[#07655C]">{selected.orderSummary?.completed ?? 0}</strong><small className="text-[#07655C]">Finalizados</small></span></dd></div>
          </dl><div className="mt-5 grid gap-2"><Link href={`/orders?clienteId=${selected.id}&cliente=${encodeURIComponent(selected.full_name)}`} className="w-full rounded-[7px] bg-[#0D7A72] px-4 py-2.5 text-center text-sm font-semibold text-white">Ver pedidos de este cliente</Link><button type="button" onClick={() => { setEditingCustomer(selected); setTarget(`${selected.organization_id}:${selected.branch_id}`); setFullName(selected.full_name); setPhones([...selected.customer_phones].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map((phone) => ({ number: phone.phone_number, label: phone.label, whatsappEnabled: phone.whatsapp_enabled }))); setDuplicateReviewed(false); setShowForm(true); setMessage(null) }} className="w-full rounded-[7px] border border-[#9BCDC6] px-4 py-2.5 text-sm font-semibold text-[#0D7A72]">Editar cliente</button></div></>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[#74857F]">Selecciona una coincidencia para revisar su ficha y reutilizarla.</p>
        )}
      </aside>
    </div>
  )
}
