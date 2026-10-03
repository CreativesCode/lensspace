// Business dates follow the organization's timezone (pilot: Cuba), never UTC: after
// 20:00 in Havana `toISOString()` already returns tomorrow. Vercel renders in UTC.
export const BUSINESS_TIME_ZONE = 'America/Havana'

const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

// YYYY-MM-DD of `date` (default now) in the business timezone.
export const todayIn = (date: Date = new Date()) => isoDay.format(date)

// YYYY-MM-DD `days` days before today in the business timezone.
export const daysAgoIn = (days: number) => todayIn(new Date(Date.now() - days * 24 * 60 * 60 * 1000))

const businessDate = new Intl.DateTimeFormat('es-CU', { timeZone: BUSINESS_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' })

// dd/mm/yyyy in the business timezone. The explicit zone keeps the server (UTC) and
// browser renders identical, avoiding hydration mismatches.
export const formatBusinessDate = (value: string | Date) => businessDate.format(new Date(value))
