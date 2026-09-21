'use client'

export type CustomerPhoneDraft = { number: string; label: string; whatsappEnabled: boolean }

export type CustomerFormInitialValues = {
  nationalId?: string | null
  birthDate?: string | null
  address?: string | null
  notes?: string | null
  messagingConsent?: boolean
}

export function CustomerFormFields({ fullName, onFullNameChange, phones, onPhonesChange, initialValues, fieldClass }: { fullName: string; onFullNameChange: (value: string) => void; phones: CustomerPhoneDraft[]; onPhonesChange: (phones: CustomerPhoneDraft[]) => void; initialValues?: CustomerFormInitialValues; fieldClass: string }) {
  const compactClass = fieldClass.replace('mt-1 ', '')
  function updatePhone(index: number, patch: Partial<CustomerPhoneDraft>) {
    onPhonesChange(phones.map((phone, phoneIndex) => phoneIndex === index ? { ...phone, ...patch } : phone))
  }

  return <>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-xs font-medium text-[#4A5B58]">Nombre completo<input autoFocus className={fieldClass} name="fullName" value={fullName} onChange={(event) => onFullNameChange(event.target.value)} required minLength={2} maxLength={160} /></label>
      <label className="text-xs font-medium text-[#4A5B58]">Carné o identificador <span className="font-normal text-[#9AABA7]">(opcional)</span><input className={fieldClass} name="nationalId" defaultValue={initialValues?.nationalId ?? ''} maxLength={40} /></label>
      <label className="text-xs font-medium text-[#4A5B58]">Fecha de nacimiento <span className="font-normal text-[#9AABA7]">(opcional)</span><input className={fieldClass} name="birthDate" type="date" defaultValue={initialValues?.birthDate ?? ''} max={new Date().toISOString().slice(0, 10)} /></label>
      <label className="text-xs font-medium text-[#4A5B58] md:col-span-2">Dirección <span className="font-normal text-[#9AABA7]">(opcional)</span><input className={fieldClass} name="address" defaultValue={initialValues?.address ?? ''} /></label>
    </div>
    <fieldset className="mt-5 space-y-3">
      <legend className="font-display text-sm font-semibold text-[#07322F]">Teléfonos</legend>
      {phones.map((phone, index) => <div key={index} className="grid gap-2 rounded-lg border border-[#E3EFED] bg-[#FBFEFD] p-3 sm:grid-cols-[1fr_150px_auto]"><input aria-label={`Teléfono ${index + 1}`} className={compactClass} value={phone.number} onChange={(event) => updatePhone(index, { number: event.target.value })} placeholder="+53 5218 4477" required /><input aria-label={`Etiqueta del teléfono ${index + 1}`} className={compactClass} value={phone.label} onChange={(event) => updatePhone(index, { label: event.target.value })} maxLength={40} />{index ? <button type="button" onClick={() => onPhonesChange(phones.filter((_, phoneIndex) => phoneIndex !== index))} className="px-2 text-xs font-semibold text-[#C23C1C]">Quitar</button> : <span className="self-center px-2 text-xs text-[#74857F]">Principal</span>}</div>)}
      {phones.length < 5 ? <button type="button" onClick={() => onPhonesChange([...phones, { number: '', label: 'Otro', whatsappEnabled: true }])} className="text-sm font-semibold text-[#0D7A72]">+ Añadir otro teléfono</button> : null}
    </fieldset>
    <label className="mt-5 flex items-center gap-2 text-sm text-[#4A5B58]"><input name="messagingConsent" type="checkbox" defaultChecked={initialValues?.messagingConsent ?? false} className="h-4 w-4 accent-[#0D7A72]" />Consentimiento para mensajes por WhatsApp</label>
    <label className="mt-4 block text-xs font-medium text-[#4A5B58]">Notas <span className="font-normal text-[#9AABA7]">(opcional)</span><textarea className={fieldClass} name="notes" defaultValue={initialValues?.notes ?? ''} rows={3} /></label>
  </>
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
