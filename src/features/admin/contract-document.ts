import type { Tables } from '@/lib/supabase/database.types'

import { billingPeriodLabels, formatUsd, type LicenseBillingPeriod, moduleLabels, PERIOD_MONTHS_CHARGED } from './license-pricing'

// Proforma text of the LensSpace license contract. It is a starting point the
// product owner sends to legal review; the signed copy uploaded afterwards is what binds.

type Contract = Tables<'license_contracts'>
type Provider = Tables<'platform_provider_profile'> | null
export type ContractSection = { title: string; paragraphs: string[] }

const blank = '______________________'
const ordinals = ['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima', 'Octava', 'Novena', 'Décima', 'Undécima', 'Duodécima', 'Decimotercera', 'Decimocuarta']
const dateFormat = new Intl.DateTimeFormat('es-CU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export const contractDate = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`))
const dayAfter = (isoDate: string) => new Date(Date.parse(`${isoDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
const join = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(', ')

export function partyLines(contract: Contract, provider: Provider) {
  return {
    provider: join([
      provider?.legal_name ?? blank,
      provider?.identification ? `carné/NIT ${provider.identification}` : `carné/NIT ${blank}`,
      provider?.address ? `con domicilio en ${provider.address}` : null,
      provider?.phone ? `teléfono ${provider.phone}` : null,
      provider?.email ? `correo ${provider.email}` : null,
    ]),
    client: join([
      contract.client_legal_name,
      contract.client_identification ? `carné/NIT ${contract.client_identification}` : `carné/NIT ${blank}`,
      contract.client_representative ? `representada por ${contract.client_representative}` : null,
      contract.client_address ? `con domicilio en ${contract.client_address}` : null,
      contract.client_phone ? `teléfono ${contract.client_phone}` : null,
      contract.client_email ? `correo ${contract.client_email}` : null,
    ]),
  }
}

export function contractSections(contract: Contract, provider: Provider): ContractSection[] {
  const period = contract.billing_period as LicenseBillingPeriod
  const monthly = formatUsd(contract.monthly_amount, contract.currency)
  const charge = formatUsd(contract.period_amount, contract.currency)
  const modules = ['Núcleo (organización, usuarios, seguridad y auditoría)', ...contract.module_keys.filter((key) => key !== 'multi_branch').map((key) => moduleLabels[key] ?? key)]
  const isFounder = contract.plan === 'founder' && contract.price_locked_until
  const sections: ContractSection[] = [
    { title: 'Objeto', paragraphs: [
      'EL PROVEEDOR concede a EL CLIENTE una licencia de uso no exclusiva e intransferible del sistema LensSpace, que se presta como servicio en línea (acceso por navegador y aplicación instalable) para gestionar su óptica: clientes, recetas, cotizaciones, pedidos, cobros, producción y entrega.',
      'Este contrato no implica la venta del software ni la cesión de su código fuente, marca o diseño, que siguen siendo de EL PROVEEDOR.',
    ] },
    { title: 'Módulos contratados', paragraphs: [
      `Se contratan los siguientes módulos: ${modules.join('; ')}.`,
      `Incluye 1 sucursal${contract.extra_branches ? ` y ${contract.extra_branches} sucursal${contract.extra_branches === 1 ? '' : 'es'} adicional${contract.extra_branches === 1 ? '' : 'es'} (módulo Multisucursal)` : ''}. Agregar o quitar módulos o sucursales requiere un anexo firmado con el nuevo precio.`,
      ...(contract.module_keys.includes('whatsapp') ? ['El envío de mensajes de WhatsApp depende de servicios de terceros; EL PROVEEDOR no garantiza la entrega de cada mensaje, pero sí el registro de cada intento en el sistema.'] : []),
    ] },
    { title: 'Precio y forma de pago', paragraphs: [
      `El precio es de ${monthly} al mes. Forma de pago: ${billingPeriodLabels[period].toLowerCase()}, por adelantado al inicio de cada periodo, por un importe de ${charge}${PERIOD_MONTHS_CHARGED[period] === 10 ? ' (12 meses de servicio pagando 10)' : ''}.`,
      provider?.payment_instructions ? `El pago se realizará así: ${provider.payment_instructions}` : 'El pago se realizará en efectivo o por el medio que las partes acuerden por escrito.',
      'Si las partes acuerdan pagar en otra moneda, se aplicará la tasa de cambio que acuerden el día del pago.',
    ] },
    { title: 'Vigencia y renovación', paragraphs: [
      `El contrato rige desde el ${contractDate(contract.starts_on)} hasta el ${contractDate(contract.ends_on)} (${contract.term_months} meses).`,
      'Al terminar, se renueva automáticamente por periodos iguales salvo que una de las partes avise por escrito con al menos 30 días de antelación. En cada renovación aplica el precio de lista vigente; EL PROVEEDOR avisará de cualquier cambio de precio con 30 días de antelación.',
    ] },
  ]
  if (isFounder) {
    sections.push({ title: 'Condición de socio fundador', paragraphs: [
      `EL CLIENTE participa como socio fundador de LensSpace. Por ello paga un precio especial de ${monthly} al mes durante 24 meses: desde el ${contractDate(contract.starts_on)} hasta el ${contractDate(contract.price_locked_until!)}, ambos incluidos.`,
      `A partir del ${contractDate(dayAfter(contract.price_locked_until!))} el precio pasa a ser ${formatUsd(contract.post_lock_monthly_amount ?? 0, contract.currency)} al mes (precio de lista del plan Completo), salvo que las partes acuerden otra cosa por escrito.`,
      'Esta condición es personal de EL CLIENTE, no se transfiere y se pierde si el contrato se termina antes de plazo.',
    ] })
  }
  const rest: [string, string[]][] = [
    ['Recomendaciones', [
      `Por cada óptica nueva que EL CLIENTE recomiende y que contrate LensSpace y pague su primer periodo, EL CLIENTE recibe ${isFounder ? '15 días de servicio gratis mientras tenga vigente el precio de socio fundador, y 10 días después' : '10 días de servicio gratis'}. Los días se suman a su próximo vencimiento y se acumulan.`,
    ]],
    ['Obligaciones de EL PROVEEDOR', [
      'Mantener el servicio disponible de forma razonable, corregir los fallos que se le reporten, conservar copias de seguridad de los datos y avisar con antelación de los mantenimientos programados.',
      'Dar soporte por WhatsApp o correo en horario laboral y capacitar al personal de EL CLIENTE al inicio del servicio.',
    ]],
    ['Obligaciones de EL CLIENTE', [
      'Pagar en fecha; usar el sistema solo para su óptica; custodiar las contraseñas de su personal; registrar datos veraces y contar con el consentimiento de sus clientes para enviarles mensajes.',
      'No copiar, revender, ceder ni intentar acceder al código o a datos de otras ópticas.',
    ]],
    ['Datos', [
      'Los datos que EL CLIENTE registra (clientes, recetas, ventas, cobros) le pertenecen. EL PROVEEDOR solo los usa para prestar el servicio y solo accede a ellos para dar asistencia a petición de EL CLIENTE, quedando registrado cada acceso.',
      'Al terminar el contrato, EL CLIENTE puede pedir una exportación de sus datos durante los 30 días siguientes.',
    ]],
    ['Falta de pago', [
      'Si un periodo vence sin pagarse, la cuenta queda en modo de solo lectura: se puede consultar la información, pero no registrar operaciones, hasta que se pague. Tras 60 días sin pago, EL PROVEEDOR puede dar por terminado el contrato.',
    ]],
    ['Responsabilidad', [
      'Las sugerencias del sistema sobre recetas y productos son orientativas; las decisiones clínicas y comerciales corresponden a EL CLIENTE. La responsabilidad de EL PROVEEDOR se limita al importe pagado en los últimos tres meses.',
    ]],
    ['Terminación y cambios', [
      'Cualquiera de las partes puede terminar el contrato avisando por escrito con 30 días de antelación; los periodos ya pagados no se devuelven salvo acuerdo. Cualquier cambio a este contrato debe constar por escrito y firmado por ambas partes.',
      'Este contrato se rige por la legislación de la República de Cuba. Las partes intentarán resolver cualquier diferencia de forma amistosa antes de acudir a otra vía.',
    ]],
  ]
  rest.forEach(([title, paragraphs]) => sections.push({ title, paragraphs }))
  if (contract.notes) sections.push({ title: 'Acuerdos adicionales', paragraphs: [contract.notes] })
  return sections.map((section, index) => ({ ...section, title: `${ordinals[index]}. ${section.title}` }))
}
