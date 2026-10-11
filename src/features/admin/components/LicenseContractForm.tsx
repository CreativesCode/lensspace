'use client'

import { type FormEvent, useMemo, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'
import { FormSelect } from '@/shared/components'
import { friendlyError } from '@/shared/lib/friendly-error'
import { Alert, Button, Field, Input, Switch, Textarea } from '@/shared/ui'
import { formatBusinessDate, todayIn } from '@/shared/utils/dates'

import {
  addMonthsIso, billingPeriodLabels, COMPLETE_MONTHLY, DEFAULT_TERM_MONTHS, EXTRA_BRANCH_MONTHLY, formatUsd, FOUNDER_LOCK_MONTHS,
  type LicenseBillingPeriod, type LicensePlan, LICENSE_CURRENCY, moduleLabels, periodAmount, planLabels, planModules, suggestedMonthlyAmount,
} from '../license-pricing'

type Contract = Tables<'license_contracts'>
type Props = {
  organizationId: number
  defaults: { legalName: string; representative: string; modules: string[] }
  draft?: Contract
  referrerOptions: { id: number; name: string }[]
  onSaved: (message: string) => void
  onCancel: () => void
}

const contractModules = ['optical_sales', 'whatsapp', 'cashbox', 'production', 'analytics', 'multi_branch']
const salesDependents = ['cashbox', 'production', 'whatsapp']
const showDate = (isoDate: string) => formatBusinessDate(`${isoDate}T12:00:00`)

export function LicenseContractForm({ organizationId, defaults, draft, referrerOptions, onSaved, onCancel }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [plan, setPlan] = useState<LicensePlan>((draft?.plan as LicensePlan) ?? 'basic')
  const [modules, setModules] = useState<string[]>(draft?.module_keys ?? planModules('basic', defaults.modules))
  const [extraBranches, setExtraBranches] = useState(draft?.extra_branches ?? 0)
  const [monthly, setMonthly] = useState(String(draft?.monthly_amount ?? suggestedMonthlyAmount('basic', modules, 0)))
  const [period, setPeriod] = useState<LicenseBillingPeriod>((draft?.billing_period as LicenseBillingPeriod) ?? 'monthly')
  const [startsOn, setStartsOn] = useState(draft?.starts_on ?? todayIn())
  const [termMonths, setTermMonths] = useState(String(draft?.term_months ?? DEFAULT_TERM_MONTHS))
  const [postLock, setPostLock] = useState(String(draft?.post_lock_monthly_amount ?? COMPLETE_MONTHLY))
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const monthlyAmount = Number(monthly) || 0
  const term = Math.min(60, Math.max(1, Number(termMonths) || DEFAULT_TERM_MONTHS))
  const lockedUntil = plan === 'founder' && startsOn ? addMonthsIso(startsOn, FOUNDER_LOCK_MONTHS, true) : null

  // Any change of plan, modules or branches re-suggests the price from the list.
  function reprice(nextPlan: LicensePlan, nextModules: string[], nextBranches: number) {
    setMonthly(String(suggestedMonthlyAmount(nextPlan, nextModules, nextBranches)))
    setPostLock(String(COMPLETE_MONTHLY + nextBranches * EXTRA_BRANCH_MONTHLY))
  }
  function changePlan(value: string) {
    const nextPlan = value as LicensePlan
    const nextModules = [...planModules(nextPlan, modules), ...(extraBranches > 0 ? ['multi_branch'] : [])]
    setPlan(nextPlan)
    setModules([...new Set(nextModules)])
    if (nextPlan === 'founder') setTermMonths(String(FOUNDER_LOCK_MONTHS))
    reprice(nextPlan, nextModules, extraBranches)
  }
  function toggleModule(key: string, enabled: boolean) {
    const next = enabled
      ? [...new Set([...modules, key, ...(salesDependents.includes(key) ? ['optical_sales'] : [])])]
      : modules.filter((entry) => entry !== key && !(key === 'optical_sales' && salesDependents.includes(entry)))
    setPlan('custom')
    setModules(next)
    reprice('custom', next, extraBranches)
  }
  function changeBranches(value: string) {
    const next = Math.min(50, Math.max(0, Math.trunc(Number(value) || 0)))
    const nextModules = next > 0 ? [...new Set([...modules, 'multi_branch'])] : modules.filter((key) => key !== 'multi_branch')
    setExtraBranches(next)
    setModules(nextModules)
    reprice(plan, nextModules, next)
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name) ?? '').trim() || null
    const referrer = Number(form.get('referredBy')) || null
    const values = {
      plan, module_keys: modules, extra_branches: extraBranches, monthly_amount: monthlyAmount, currency: LICENSE_CURRENCY,
      billing_period: period, starts_on: startsOn, term_months: term,
      price_locked_until: lockedUntil, post_lock_monthly_amount: plan === 'founder' ? Number(postLock) || 0 : null,
      client_legal_name: text('legalName') ?? '', client_identification: text('identification'), client_representative: text('representative'),
      client_address: text('address'), client_phone: text('phone'), client_email: text('email'), notes: text('notes'),
      referred_by_organization_id: referrer,
    }
    startTransition(async () => {
      const { error: saveError } = draft
        ? await supabase.from('license_contracts').update(values as never).eq('id', draft.id)
        : await supabase.from('license_contracts').insert({ ...values, organization_id: organizationId } as never)
      if (saveError) return setError(friendlyError(saveError, 'No pudimos guardar el contrato.'))
      onSaved(draft ? 'Borrador del contrato actualizado.' : 'Borrador del contrato creado. Ya puedes descargar la proforma.')
    })
  }

  return <form onSubmit={save} className="flex flex-col gap-4 rounded-card border border-line p-4">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Plan"><FormSelect ariaLabel="Plan" value={plan} onValueChange={changePlan} options={(Object.keys(planLabels) as LicensePlan[]).map((key) => ({ value: key, label: planLabels[key] }))} /></Field>
      <Field label="Sucursales extra"><Input type="number" inputMode="numeric" min="0" max="50" value={extraBranches} onChange={(event) => changeBranches(event.target.value)} numeric /></Field>
      <Field label="Precio mensual (USD)" help="Sugerido por la lista; puedes cambiarlo."><Input type="number" inputMode="decimal" min="0" step="0.01" required value={monthly} onChange={(event) => { setMonthly(event.target.value); if (plan !== 'founder') setPlan('custom') }} numeric /></Field>
      <Field label="Forma de pago"><FormSelect ariaLabel="Forma de pago" value={period} onValueChange={(value) => setPeriod(value as LicenseBillingPeriod)} options={(Object.keys(billingPeriodLabels) as LicenseBillingPeriod[]).map((key) => ({ value: key, label: billingPeriodLabels[key] }))} /></Field>
      <Field label="Inicio"><Input type="date" required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></Field>
      <Field label="Duración (meses)"><Input type="number" inputMode="numeric" min="1" max="60" required value={termMonths} onChange={(event) => setTermMonths(event.target.value)} numeric /></Field>
      {plan === 'founder' ? <Field label="Precio tras el periodo fundador" help="Precio de lista del plan Completo."><Input type="number" inputMode="decimal" min="0" step="0.01" required value={postLock} onChange={(event) => setPostLock(event.target.value)} numeric /></Field> : null}
      <Field label="Referida por" optional><FormSelect name="referredBy" ariaLabel="Óptica que la refirió" defaultValue={String(draft?.referred_by_organization_id ?? '')} options={[{ value: '', label: 'Nadie' }, ...referrerOptions.map(({ id, name }) => ({ value: String(id), label: name }))]} /></Field>
    </div>

    <Field as="div" label="Módulos" help="Cambiar los módulos convierte el plan en Personalizado.">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {contractModules.map((key) => <div key={key} className="flex min-h-11 items-center rounded-control border border-line px-3"><Switch checked={modules.includes(key)} onChange={(enabled) => toggleModule(key, enabled)} label={moduleLabels[key]} disabled={key === 'multi_branch'} /></div>)}
      </div>
    </Field>

    <Alert tone="info" title={`Cobro: ${formatUsd(periodAmount(monthlyAmount, period))} ${billingPeriodLabels[period].toLowerCase()}`}>
      Vigencia del {startsOn ? showDate(startsOn) : '—'} al {startsOn ? showDate(addMonthsIso(startsOn, term, true)) : '—'}.
      {lockedUntil ? ` Precio de socio fundador fijo hasta el ${showDate(lockedUntil)}; después ${formatUsd(Number(postLock) || 0)} al mes.` : ''}
    </Alert>

    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <Field label="Nombre legal de la óptica"><Input name="legalName" required minLength={2} maxLength={200} defaultValue={draft?.client_legal_name ?? defaults.legalName} /></Field>
      <Field label="Carné o NIT" optional><Input name="identification" maxLength={60} defaultValue={draft?.client_identification ?? ''} /></Field>
      <Field label="Representante" optional><Input name="representative" maxLength={200} defaultValue={draft?.client_representative ?? defaults.representative} /></Field>
      <Field label="Teléfono" optional><Input name="phone" type="tel" maxLength={40} defaultValue={draft?.client_phone ?? ''} /></Field>
      <Field label="Dirección" optional><Input name="address" maxLength={300} defaultValue={draft?.client_address ?? ''} /></Field>
      <Field label="Correo" optional><Input name="email" type="email" maxLength={200} defaultValue={draft?.client_email ?? ''} /></Field>
    </div>
    <Field label="Notas" optional><Textarea name="notes" maxLength={1000} rows={2} defaultValue={draft?.notes ?? ''} /></Field>

    {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancelar</Button>
      <Button type="submit" variant="ink" disabled={pending}>{pending ? 'Guardando…' : draft ? 'Guardar borrador' : 'Crear borrador'}</Button>
    </div>
  </form>
}
