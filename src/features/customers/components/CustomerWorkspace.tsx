'use client'

import { useCallback, useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'

type AccessScope = {
  organizationId: number
  organizationName: string
  branchId: number
  branchName: string
  canWrite: boolean
}

type CustomerPhone = Pick<
  Tables<'customer_phones'>,
  'id' | 'phone_number' | 'normalized_phone' | 'label' | 'is_primary'
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
> & { customer_phones: CustomerPhone[] }

type PhoneDraft = { number: string; label: string; whatsappEnabled: boolean }

const customerSelect =
  'id, organization_id, branch_id, full_name, national_id, address, birth_date, notes, messaging_consent, customer_phones(id, phone_number, normalized_phone, label, is_primary)'

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
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [duplicateReviewed, setDuplicateReviewed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [target, setTarget] = useState(
    scopes[0] ? `${scopes[0].organizationId}:${scopes[0].branchId}` : '',
  )
  const [fullName, setFullName] = useState('')
  const [phones, setPhones] = useState<PhoneDraft[]>([
    { number: '', label: 'Principal', whatsappEnabled: true },
  ])

  const activeScope = scopes.find(
    (scope) => `${scope.organizationId}:${scope.branchId}` === target,
  )

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
        setResults((data ?? []) as CustomerResult[])
      }
      setLoading(false)
    },
    [supabase],
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

  function updatePhone(index: number, patch: Partial<PhoneDraft>) {
    setDuplicateReviewed(false)
    setPhones((current) =>
      current.map((phone, phoneIndex) =>
        phoneIndex === index ? { ...phone, ...patch } : phone,
      ),
    )
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeScope?.canWrite) {
      setMessage('Esta organización está en modo de solo lectura.')
      return
    }

    const validPhones = phones.filter(({ number }) => normalizePhone(number).length >= 5)
    if (validPhones.length !== phones.length || !fullName.trim()) {
      setMessage('Completa el nombre y usa teléfonos de al menos cinco dígitos.')
      return
    }

    setSaving(true)
    setMessage(null)
    const form = new FormData(event.currentTarget)
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

    if (possibleDuplicateIds.length && !duplicateReviewed) {
      const { data: matches } = await supabase
        .from('customers')
        .select(customerSelect)
        .in('id', possibleDuplicateIds)
        .is('archived_at', null)
      setResults((matches ?? []) as CustomerResult[])
      setSearched(true)
      setQuery(fullName.trim())
      setDuplicateReviewed(true)
      setMessage('Revisa las posibles coincidencias. Si es otra persona, vuelve a pulsar Guardar cliente.')
      setSaving(false)
      return
    }

    const { data, error } = await supabase.rpc('create_customer_with_phones', {
      target_organization_id: activeScope.organizationId,
      target_branch_id: activeScope.branchId,
      customer_full_name: fullName.trim(),
      customer_national_id: String(form.get('nationalId') ?? ''),
      customer_address: String(form.get('address') ?? ''),
      customer_birth_date: String(form.get('birthDate') ?? '') || undefined,
      customer_notes: String(form.get('notes') ?? ''),
      customer_messaging_consent: form.get('messagingConsent') === 'on',
      phone_entries: validPhones,
    } as never)

    if (error) {
      setMessage(error.message || 'No se pudo registrar el cliente.')
      setSaving(false)
      return
    }

    setQuery(fullName.trim())
    setShowForm(false)
    setFullName('')
    setPhones([{ number: '', label: 'Principal', whatsappEnabled: true }])
    await searchCustomers(fullName.trim())
    setMessage(`Cliente #${data} registrado correctamente.`)
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
          <form onSubmit={createCustomer} className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#07322F]">Nueva ficha</h2>
                <p className="mt-1 text-[13px] text-[#74857F]">Revisa las coincidencias antes de guardar.</p>
              </div>
              {!activeScope?.canWrite ? (
                <span className="rounded-[5px] bg-[#FFF4E8] px-2 py-1 text-xs font-semibold text-[#A35A15]">Solo lectura</span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-xs font-medium text-[#4A5B58]">
                Organización y sucursal
                <FormSelect className="mt-1" ariaLabel="Organización y sucursal" value={target} onValueChange={setTarget} options={scopes.map((scope) => ({ value: `${scope.organizationId}:${scope.branchId}`, label: `${scope.organizationName} · ${scope.branchName}${scope.canWrite ? '' : ' (solo lectura)'}` }))} />
              </label>
              <label className="text-xs font-medium text-[#4A5B58]">
                Nombre completo
                <input className={fieldClass} value={fullName} onChange={(event) => { setFullName(event.target.value); setDuplicateReviewed(false) }} required minLength={2} maxLength={160} />
              </label>
              <label className="text-xs font-medium text-[#4A5B58]">
                Carné o identificador <span className="font-normal text-[#9AABA7]">(opcional)</span>
                <input className={fieldClass} name="nationalId" maxLength={40} />
              </label>
              <label className="text-xs font-medium text-[#4A5B58]">
                Fecha de nacimiento <span className="font-normal text-[#9AABA7]">(opcional)</span>
                <input className={fieldClass} name="birthDate" type="date" max={new Date().toISOString().slice(0, 10)} />
              </label>
              <label className="text-xs font-medium text-[#4A5B58] md:col-span-2">
                Dirección <span className="font-normal text-[#9AABA7]">(opcional)</span>
                <input className={fieldClass} name="address" />
              </label>
            </div>

            <fieldset className="mt-5 space-y-3">
              <legend className="font-display text-sm font-semibold text-[#07322F]">Teléfonos</legend>
              {phones.map((phone, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-[#E3EFED] bg-[#FBFEFD] p-3 sm:grid-cols-[1fr_150px_auto]">
                  <input aria-label={`Teléfono ${index + 1}`} className={fieldClass.replace('mt-1 ', '')} value={phone.number} onChange={(event) => updatePhone(index, { number: event.target.value })} placeholder="+53 5218 4477" required />
                  <input aria-label={`Etiqueta del teléfono ${index + 1}`} className={fieldClass.replace('mt-1 ', '')} value={phone.label} onChange={(event) => updatePhone(index, { label: event.target.value })} maxLength={40} />
                  {index ? (
                    <button type="button" onClick={() => setPhones((current) => current.filter((_, phoneIndex) => phoneIndex !== index))} className="px-2 text-xs font-semibold text-[#C23C1C]">Quitar</button>
                  ) : <span className="self-center px-2 text-xs text-[#74857F]">Principal</span>}
                </div>
              ))}
              {phones.length < 5 ? (
                <button type="button" onClick={() => setPhones((current) => [...current, { number: '', label: 'Otro', whatsappEnabled: true }])} className="text-sm font-semibold text-[#0D7A72]">+ Añadir otro teléfono</button>
              ) : null}
            </fieldset>

            {duplicateCandidates.length ? (
              <div className="mt-5 rounded-lg border border-[#FFD9CD] bg-[#FFF6F2] p-4 text-sm text-[#7A3A26]">
                <p className="font-semibold">Posible duplicado</p>
                <p className="mt-1">Hay {duplicateCandidates.length} ficha(s) con el mismo nombre o teléfono. Revísalas arriba; el teléfono compartido no impide continuar.</p>
              </div>
            ) : null}

            <label className="mt-5 flex items-center gap-2 text-sm text-[#4A5B58]">
              <input name="messagingConsent" type="checkbox" className="h-4 w-4 accent-[#0D7A72]" />
              Consentimiento para mensajes por WhatsApp
            </label>
            <label className="mt-4 block text-xs font-medium text-[#4A5B58]">
              Notas <span className="font-normal text-[#9AABA7]">(opcional)</span>
              <textarea className={fieldClass} name="notes" rows={3} />
            </label>
            <button disabled={saving || !activeScope?.canWrite} className="mt-5 rounded-[7px] bg-[#0D7A72] px-4 py-2.5 font-display text-sm font-semibold text-white transition hover:bg-[#07322F] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Guardando…' : duplicateReviewed ? 'Confirmar cliente distinto' : 'Guardar cliente'}
            </button>
          </form>
        ) : null}

        {message ? <p role="status" className="rounded-lg border border-[#DCECEA] bg-white px-4 py-3 text-sm text-[#4A5B58]">{message}</p> : null}
      </div>

      <aside className="rounded-[10px] border border-[#E3EFED] bg-white p-5 shadow-[0_8px_24px_rgba(7,50,47,0.04)] xl:sticky xl:top-6">
        <h2 className="font-display text-[15px] font-semibold text-[#07322F]">Ficha seleccionada</h2>
        {selected ? (
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="text-xs text-[#74857F]">Cliente</dt><dd className="mt-1 font-semibold text-[#07322F]">{selected.full_name}</dd></div>
            <div><dt className="text-xs text-[#74857F]">Teléfonos</dt><dd className="mt-1 text-[#1C3A37]">{selected.customer_phones.map(({ phone_number }) => phone_number).join(' · ')}</dd></div>
            <div><dt className="text-xs text-[#74857F]">Dirección</dt><dd className="mt-1 text-[#1C3A37]">{selected.address || '—'}</dd></div>
            <div><dt className="text-xs text-[#74857F]">Nacimiento</dt><dd className="mt-1 text-[#1C3A37]">{selected.birth_date || '—'}</dd></div>
            <div><dt className="text-xs text-[#74857F]">WhatsApp</dt><dd className={`mt-1 font-semibold ${selected.messaging_consent ? 'text-[#0D7A72]' : 'text-[#74857F]'}`}>{selected.messaging_consent ? 'Consentimiento otorgado' : 'Sin consentimiento'}</dd></div>
          </dl>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[#74857F]">Selecciona una coincidencia para revisar su ficha y reutilizarla.</p>
        )}
      </aside>
    </div>
  )
}
