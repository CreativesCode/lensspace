'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'

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

export function OrganizationOnboardingForm() {
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
    setPending(false)
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-100'

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold text-slate-950">
          Organización y primera sucursal
        </legend>

        <label className="text-sm font-medium text-slate-700">
          Nombre de la óptica
          <input className={inputClass} name="organizationName" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Prefijo de pedidos
          <input
            className={inputClass}
            name="organizationPrefix"
            pattern="[A-Za-z0-9]{3,8}"
            placeholder="VIS"
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Nombre de la sucursal
          <input
            className={inputClass}
            name="branchName"
            defaultValue="Principal"
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Código de sucursal
          <input
            className={inputClass}
            name="branchCode"
            pattern="[A-Za-z0-9_-]{1,16}"
            defaultValue="MAIN"
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Zona horaria
          <input
            className={inputClass}
            name="timezone"
            defaultValue="America/Havana"
            required
          />
        </label>
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-4 text-lg font-semibold text-slate-950">
          Propietario
        </legend>
        <label className="text-sm font-medium text-slate-700">
          Nombre
          <input className={inputClass} name="ownerName" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Correo
          <input className={inputClass} name="ownerEmail" type="email" required />
        </label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">
          Contraseña inicial
          <input
            className={inputClass}
            name="ownerPassword"
            type="password"
            minLength={10}
            autoComplete="new-password"
            required
          />
        </label>
      </fieldset>

      <fieldset className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-4 text-lg font-semibold text-slate-950">
          Suscripción
        </legend>
        <label className="text-sm font-medium text-slate-700">
          Estado
          <select className={inputClass} name="subscriptionStatus" defaultValue="trial">
            <option value="trial">Prueba</option>
            <option value="active">Activa</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Importe
          <input
            className={inputClass}
            name="subscriptionAmount"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Moneda
          <input
            className={inputClass}
            name="subscriptionCurrency"
            pattern="[A-Za-z]{3}"
            defaultValue="USD"
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Periodicidad
          <select className={inputClass} name="billingPeriod" defaultValue="monthly">
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="semiannual">Semestral</option>
            <option value="annual">Anual</option>
            <option value="custom">Personalizada</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Inicio
          <input
            className={inputClass}
            name="startsOn"
            type="date"
            defaultValue={toIsoDate(today)}
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Vencimiento
          <input
            className={inputClass}
            name="expiresOn"
            type="date"
            defaultValue={toIsoDate(trialEnd)}
            required
          />
        </label>
      </fieldset>

      <fieldset>
        <legend className="text-lg font-semibold text-slate-950">
          Módulos habilitados
        </legend>
        <p className="mt-1 text-sm text-slate-500">
          El Núcleo siempre está habilitado. Caja, Producción y WhatsApp requieren
          Ventas ópticas.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {optionalModules.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name={key}
                defaultChecked={key === 'optical_sales'}
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {message ? (
        <p
          role="status"
          className={
            message.type === 'success'
              ? 'rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {message.text}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Creando organización…' : 'Crear organización'}
      </button>
    </form>
  )
}
