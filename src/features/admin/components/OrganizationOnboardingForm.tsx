'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { Building } from 'lucide-react'

import { FormSelect, PasswordInput } from '@/shared/components'
import { Alert, Button, Field, Input } from '@/shared/ui'

const optionalModules = [
  { key: 'optical_sales', label: 'Ventas ópticas' },
  { key: 'cashbox', label: 'Caja' },
  { key: 'production', label: 'Producción y proveedores' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'analytics', label: 'Analítica' },
  { key: 'multi_branch', label: 'Multisucursal' },
] as const

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function OrganizationOnboardingForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const today = useMemo(() => new Date(), [])
  const trialEnd = useMemo(() => {
    const date = new Date(today)
    date.setDate(date.getDate() + 15)
    return date
  }, [today])
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)

    const form = event.currentTarget
    const formData = new FormData(form)
    const enabledModules = optionalModules
      .filter(({ key }) => formData.get(key) === 'on')
      .map(({ key }) => key)

    const { data, error } = await supabase.functions.invoke(
      'onboard-organization',
      {
        body: {
          organizationName: formData.get('organizationName'),
          organizationPrefix: formData.get('organizationPrefix'),
          timezone: formData.get('timezone'),
          branchName: formData.get('branchName'),
          branchCode: formData.get('branchCode'),
          ownerName: formData.get('ownerName'),
          ownerEmail: formData.get('ownerEmail'),
          ownerPassword: formData.get('ownerPassword'),
          subscriptionStatus: formData.get('subscriptionStatus'),
          subscriptionAmount: Number(formData.get('subscriptionAmount')),
          subscriptionCurrency: formData.get('subscriptionCurrency'),
          billingPeriod: formData.get('billingPeriod'),
          startsOn: formData.get('startsOn'),
          expiresOn: formData.get('expiresOn'),
          enabledModules,
        },
      },
    )

    if (error) {
      let text = 'No se pudo crear la organización.'
      const response = error.context

      if (response instanceof Response) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        text = body?.error ?? text
      }

      setMessage({ type: 'error', text })
      setPending(false)
      return
    }

    setMessage({
      type: 'success',
      text: `Organización creada correctamente (ID ${data.organizationId}).`,
    })
    form.reset()
    router.refresh()
    onCreated?.()
    setPending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 rounded-card border border-[#E3EFED] bg-surface p-5 shadow-e1 md:p-6">
      <fieldset className="grid gap-[18px] md:grid-cols-2">
        <legend className="mb-4 font-display text-[17px] font-semibold text-ink">Organización y primera sucursal</legend>
        <Field label="Nombre de la óptica"><Input name="organizationName" required /></Field>
        <Field label="Prefijo de pedidos" help="3 a 8 letras o números, por ejemplo VIS."><Input name="organizationPrefix" pattern="[A-Za-z0-9]{3,8}" placeholder="VIS" required /></Field>
        <Field label="Nombre de la sucursal"><Input name="branchName" defaultValue="Principal" required /></Field>
        <Field label="Código de sucursal"><Input name="branchCode" pattern="[A-Za-z0-9_-]{1,16}" defaultValue="MAIN" required /></Field>
        <Field label="Zona horaria" className="md:col-span-2"><Input name="timezone" defaultValue="America/Havana" required /></Field>
      </fieldset>

      <fieldset className="grid gap-[18px] md:grid-cols-2">
        <legend className="mb-4 font-display text-[17px] font-semibold text-ink">Propietario</legend>
        <Field label="Nombre"><Input name="ownerName" required /></Field>
        <Field label="Correo"><Input name="ownerEmail" type="email" inputMode="email" required /></Field>
        <Field label="Contraseña inicial" help="Mínimo 10 caracteres." className="md:col-span-2">
          <PasswordInput name="ownerPassword" minLength={10} autoComplete="new-password" required />
        </Field>
      </fieldset>

      <fieldset className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-4 font-display text-[17px] font-semibold text-ink">Suscripción</legend>
        <Field label="Estado"><FormSelect name="subscriptionStatus" ariaLabel="Estado de la suscripción" defaultValue="trial" options={[{ value: 'trial', label: 'Prueba' }, { value: 'active', label: 'Activa' }]} /></Field>
        <Field label="Importe"><Input name="subscriptionAmount" type="number" inputMode="decimal" min="0" step="0.01" defaultValue="0" numeric required /></Field>
        <Field label="Moneda"><Input name="subscriptionCurrency" pattern="[A-Za-z]{3}" defaultValue="USD" required /></Field>
        <Field label="Periodicidad"><FormSelect name="billingPeriod" ariaLabel="Periodicidad" defaultValue="monthly" options={[{ value: 'monthly', label: 'Mensual' }, { value: 'quarterly', label: 'Trimestral' }, { value: 'semiannual', label: 'Semestral' }, { value: 'annual', label: 'Anual' }, { value: 'custom', label: 'Personalizada' }]} /></Field>
        <Field label="Inicio"><Input name="startsOn" type="date" defaultValue={toIsoDate(today)} required /></Field>
        <Field label="Vencimiento"><Input name="expiresOn" type="date" defaultValue={toIsoDate(trialEnd)} required /></Field>
      </fieldset>

      <fieldset>
        <legend className="font-display text-[17px] font-semibold text-ink">Módulos habilitados</legend>
        <p className="mt-1 text-sm text-text-muted">El Núcleo siempre está habilitado. Caja, Producción y WhatsApp requieren Ventas ópticas.</p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {optionalModules.map(({ key, label }) => (
            <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-line bg-[#FBFEFD] px-4 py-3 text-[15px] text-text transition hover:border-[#9BCDC6] has-[:checked]:border-action has-[:checked]:bg-[#F0FBF9]">
              <input type="checkbox" name={key} defaultChecked={key === 'optical_sales'} className="size-5 shrink-0 rounded-badge accent-[#0D7A72]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {message ? <Alert tone={message.type === 'success' ? 'success' : 'danger'} role={message.type === 'success' ? 'status' : 'alert'}>{message.text}</Alert> : null}

      <div className="flex justify-end">
        <Button type="submit" icon={Building} disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Creando organización…' : 'Crear organización'}
        </Button>
      </div>
    </form>
  )
}
