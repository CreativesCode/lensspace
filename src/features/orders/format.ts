import { BUSINESS_TIME_ZONE, daysAgoIn, todayIn } from '@/shared/utils/dates'

const amountFormat = new Intl.NumberFormat('es-CU', { maximumFractionDigits: 2 })
const shortDate = new Intl.DateTimeFormat('es-CU', { day: 'numeric', month: 'short', timeZone: BUSINESS_TIME_ZONE })
const longDate = new Intl.DateTimeFormat('es-CU', { day: 'numeric', month: 'long', timeZone: BUSINESS_TIME_ZONE })
const time = new Intl.DateTimeFormat('es-CU', { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TIME_ZONE })

export const formatAmount = (value: number) => amountFormat.format(Number(value))


// "hoy", "ayer" or "27 sep".
export function formatShortDate(iso: string) {
  const date = new Date(iso)
  const day = todayIn(date)
  if (day === todayIn()) return 'hoy'
  if (day === daysAgoIn(1)) return 'ayer'
  return shortDate.format(date).replace('.', '')
}

export const formatLongDate = (iso: string) => longDate.format(new Date(iso))
export const formatDateTime = (iso: string) => `${formatShortDate(iso)} · ${time.format(new Date(iso))}`

// Folio without the year segment for compact rows: VIS-2026-000128 → VIS-000128.
export const shortOrderNumber = (orderNumber: string) => orderNumber.replace(/-\d{4}-/, '-')

// QA-32: /orders lists every open order but finished ones only from this window;
// a customer's full history opens with /orders?clienteId=….
export const FINISHED_ORDERS_DAYS = 90
