type NumericRule = {
  name: string
  label: string
  min: number
  max: number
}

const allowedAttachmentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function optionalNumber(form: FormData, name: string) {
  const value = String(form.get(name) ?? '').trim()
  return value ? Number(value) : null
}

export function prescriptionRevisionValues(form: FormData) {
  return {
    revision_prescription_date: String(form.get('prescriptionDate')),
    revision_prescriber_name: String(form.get('prescriberName') ?? ''),
    revision_right_sphere: optionalNumber(form, 'rightSphere'),
    revision_right_cylinder: optionalNumber(form, 'rightCylinder'),
    revision_right_axis: optionalNumber(form, 'rightAxis'),
    revision_right_addition: optionalNumber(form, 'rightAddition'),
    revision_right_prism: optionalNumber(form, 'rightPrism'),
    revision_right_prism_base: String(form.get('rightPrismBase') ?? ''),
    revision_left_sphere: optionalNumber(form, 'leftSphere'),
    revision_left_cylinder: optionalNumber(form, 'leftCylinder'),
    revision_left_axis: optionalNumber(form, 'leftAxis'),
    revision_left_addition: optionalNumber(form, 'leftAddition'),
    revision_left_prism: optionalNumber(form, 'leftPrism'),
    revision_left_prism_base: String(form.get('leftPrismBase') ?? ''),
    revision_pupillary_distance_total: optionalNumber(form, 'pupillaryDistanceTotal'),
    revision_right_pupillary_distance: optionalNumber(form, 'rightPupillaryDistance'),
    revision_left_pupillary_distance: optionalNumber(form, 'leftPupillaryDistance'),
    revision_right_height: optionalNumber(form, 'rightHeight'),
    revision_left_height: optionalNumber(form, 'leftHeight'),
    revision_notes: String(form.get('notes') ?? ''),
  }
}

export function prescriptionAttachmentError(attachment: FormDataEntryValue | null) {
  if (!(attachment instanceof File) || !attachment.size) return null
  if (!allowedAttachmentTypes.has(attachment.type)) {
    return 'El original debe ser una imagen JPEG, PNG, WebP o un documento PDF.'
  }
  if (attachment.size > 10 * 1024 * 1024) return 'El original no puede superar 10 MB.'
  return null
}

export function prescriptionFileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (fromName) return fromName
  return file.type === 'application/pdf' ? 'pdf' : 'bin'
}

const numericRules: NumericRule[] = [
  { name: 'rightSphere', label: 'Esfera del ojo derecho (OD)', min: -40, max: 40 },
  { name: 'leftSphere', label: 'Esfera del ojo izquierdo (OI)', min: -40, max: 40 },
  { name: 'rightCylinder', label: 'Cilindro del ojo derecho (OD)', min: -20, max: 20 },
  { name: 'leftCylinder', label: 'Cilindro del ojo izquierdo (OI)', min: -20, max: 20 },
  { name: 'rightAxis', label: 'Eje del ojo derecho (OD)', min: 0, max: 180 },
  { name: 'leftAxis', label: 'Eje del ojo izquierdo (OI)', min: 0, max: 180 },
  { name: 'rightAddition', label: 'Adición del ojo derecho (OD)', min: 0, max: 8 },
  { name: 'leftAddition', label: 'Adición del ojo izquierdo (OI)', min: 0, max: 8 },
  { name: 'rightPrism', label: 'Prisma del ojo derecho (OD)', min: 0, max: 20 },
  { name: 'leftPrism', label: 'Prisma del ojo izquierdo (OI)', min: 0, max: 20 },
  { name: 'pupillaryDistanceTotal', label: 'Distancia pupilar total', min: 30, max: 90 },
  { name: 'rightPupillaryDistance', label: 'Distancia pupilar del ojo derecho (OD)', min: 15, max: 50 },
  { name: 'leftPupillaryDistance', label: 'Distancia pupilar del ojo izquierdo (OI)', min: 15, max: 50 },
  { name: 'rightHeight', label: 'Altura del ojo derecho (OD)', min: 0, max: 60 },
  { name: 'leftHeight', label: 'Altura del ojo izquierdo (OI)', min: 0, max: 60 },
]

export function validatePrescriptionForm(form: FormData) {
  if (!String(form.get('prescriptionDate') ?? '').trim()) return 'Indica la fecha de la receta.'
  if (form.has('changeReason') && !String(form.get('changeReason') ?? '').trim()) {
    return 'Indica el motivo de la corrección.'
  }
  const prescriberName = String(form.get('prescriberName') ?? '').trim()
  if (prescriberName.length === 1) return 'El nombre del médico u optometrista debe tener al menos dos caracteres.'
  for (const rule of numericRules) {
    const rawValue = String(form.get(rule.name) ?? '').trim()
    if (!rawValue) continue
    const value = Number(rawValue)
    if (!Number.isFinite(value)) return `${rule.label} debe ser un número.`
    if (value < rule.min || value > rule.max) {
      return `${rule.label} debe estar entre ${rule.min} y ${rule.max}. Revisa el valor introducido.`
    }
  }
  return null
}

const constraintMessages: Record<string, string> = {
  right_sphere: 'La esfera del ojo derecho (OD) debe estar entre -40 y 40.',
  left_sphere: 'La esfera del ojo izquierdo (OI) debe estar entre -40 y 40.',
  right_cylinder: 'El cilindro del ojo derecho (OD) debe estar entre -20 y 20.',
  left_cylinder: 'El cilindro del ojo izquierdo (OI) debe estar entre -20 y 20.',
  right_axis: 'El eje del ojo derecho (OD) debe estar entre 0° y 180°.',
  left_axis: 'El eje del ojo izquierdo (OI) debe estar entre 0° y 180°.',
  right_addition: 'La adición del ojo derecho (OD) debe estar entre 0 y 8.',
  left_addition: 'La adición del ojo izquierdo (OI) debe estar entre 0 y 8.',
  right_prism: 'El prisma del ojo derecho (OD) debe estar entre 0 y 20.',
  left_prism: 'El prisma del ojo izquierdo (OI) debe estar entre 0 y 20.',
  pupillary_distance_total: 'La distancia pupilar total debe estar entre 30 y 90 mm.',
  right_pupillary_distance: 'La distancia pupilar del ojo derecho (OD) debe estar entre 15 y 50 mm.',
  left_pupillary_distance: 'La distancia pupilar del ojo izquierdo (OI) debe estar entre 15 y 50 mm.',
  right_height: 'La altura del ojo derecho (OD) debe estar entre 0 y 60 mm.',
  left_height: 'La altura del ojo izquierdo (OI) debe estar entre 0 y 60 mm.',
}

export function friendlyPrescriptionError(message?: string) {
  const normalized = message?.toLowerCase() ?? ''
  const match = Object.entries(constraintMessages).find(([constraint]) => normalized.includes(constraint))
  return match?.[1] ?? 'No pudimos guardar la receta. Revisa los valores introducidos e inténtalo nuevamente.'
}
