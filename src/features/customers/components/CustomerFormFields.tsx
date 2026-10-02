'use client'

import { Plus, X } from 'lucide-react'

import { Button, Field, Input, Textarea } from '@/shared/ui'

export type CustomerPhoneDraft = { number: string; label: string; whatsappEnabled: boolean }

export type CustomerFormInitialValues = {
  nationalId?: string | null
  birthDate?: string | null
  address?: string | null
  notes?: string | null
  messagingConsent?: boolean
}

export function CustomerFormFields({ fullName, onFullNameChange, phones, onPhonesChange, initialValues }: { fullName: string; onFullNameChange: (value: string) => void; phones: CustomerPhoneDraft[]; onPhonesChange: (phones: CustomerPhoneDraft[]) => void; initialValues?: CustomerFormInitialValues }) {
  function updatePhone(index: number, patch: Partial<CustomerPhoneDraft>) {
    onPhonesChange(phones.map((phone, phoneIndex) => phoneIndex === index ? { ...phone, ...patch } : phone))
  }

  return <div className="flex flex-col gap-5">
    <div className="grid gap-[18px] md:grid-cols-2">
      <Field label="Nombre completo"><Input autoFocus name="fullName" value={fullName} onChange={(event) => onFullNameChange(event.target.value)} required minLength={2} maxLength={160} /></Field>
      <Field label="Carné o identificador" optional><Input name="nationalId" defaultValue={initialValues?.nationalId ?? ''} maxLength={40} /></Field>
      <Field label="Fecha de nacimiento" optional><Input name="birthDate" type="date" defaultValue={initialValues?.birthDate ?? ''} max={new Date().toISOString().slice(0, 10)} /></Field>
      <Field label="Dirección" optional className="md:col-span-2"><Input name="address" defaultValue={initialValues?.address ?? ''} /></Field>
    </div>
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 font-display text-[15px] font-semibold text-ink">Teléfonos</legend>
      {phones.map((phone, index) => (
        <div key={index} className="grid gap-2 rounded-control border border-[#E3EFED] bg-[#FBFEFD] p-3 sm:grid-cols-[1fr_150px_auto] sm:items-center">
          <Input aria-label={`Teléfono ${index + 1}`} type="tel" inputMode="tel" value={phone.number} onChange={(event) => updatePhone(index, { number: event.target.value })} placeholder="+53 5218 4477" required />
          <Input aria-label={`Etiqueta del teléfono ${index + 1}`} value={phone.label} onChange={(event) => updatePhone(index, { label: event.target.value })} maxLength={40} />
          {index ? (
            <Button variant="danger" size="sm" icon={X} onClick={() => onPhonesChange(phones.filter((_, phoneIndex) => phoneIndex !== index))}>Quitar</Button>
          ) : (
            <span className="px-2 text-[13px] text-text-muted">Principal</span>
          )}
        </div>
      ))}
      {phones.length < 5 ? (
        <div><Button variant="ghost" size="sm" icon={Plus} onClick={() => onPhonesChange([...phones, { number: '', label: 'Otro', whatsappEnabled: true }])}>Añadir otro teléfono</Button></div>
      ) : null}
    </fieldset>
    <label className="flex min-h-11 items-center gap-2.5 text-[15px] text-text">
      <input name="messagingConsent" type="checkbox" defaultChecked={initialValues?.messagingConsent ?? false} className="size-5 shrink-0 accent-[#0D7A72]" />
      Consentimiento para mensajes por WhatsApp
    </label>
    <Field label="Notas" optional><Textarea name="notes" defaultValue={initialValues?.notes ?? ''} rows={3} /></Field>
  </div>
}

export function customerFormValues(form: FormData, fullName: string, phones: CustomerPhoneDraft[]) {
  return {
    fullName: fullName.trim(),
    nationalId: String(form.get('nationalId') ?? ''),
    address: String(form.get('address') ?? ''),
    birthDate: String(form.get('birthDate') ?? '') || null,
    notes: String(form.get('notes') ?? ''),
    messagingConsent: form.get('messagingConsent') === 'on',
    phones: phones.filter(({ number }) => number.replace(/\D/g, '').length >= 5),
  }
}
