const amountFormat = new Intl.NumberFormat('es-CU', { maximumFractionDigits: 2 })
const shortDate = new Intl.DateTimeFormat('es-CU', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('es-CU', { day: 'numeric', month: 'long' })
const time = new Intl.DateTimeFormat('es-CU', { hour: '2-digit', minute: '2-digit' })

export const formatAmount = (value: number) => amountFormat.format(Number(value))

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

// "hoy", "ayer" or "27 sep".
export function formatShortDate(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (dayKey(date) === dayKey(today)) return 'hoy'
  if (dayKey(date) === dayKey(yesterday)) return 'ayer'
  return shortDate.format(date).replace('.', '')
}

export const formatLongDate = (iso: string) => longDate.format(new Date(iso))
export const formatDateTime = (iso: string) => `${formatShortDate(iso)} · ${time.format(new Date(iso))}`

// Folio without the year segment for compact rows: VIS-2026-000128 → VIS-000128.
export const shortOrderNumber = (orderNumber: string) => orderNumber.replace(/-\d{4}-/, '-')
