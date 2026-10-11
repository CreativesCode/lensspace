// License price list agreed with the product owner on 2026-10-10
// (.titan/plans/prp-license-pricing-and-contracts.md). Contracts snapshot the amounts,
// so changing these values never alters a signed contract.

export type LicensePlan = 'basic' | 'complete' | 'founder' | 'custom'
export type LicenseBillingPeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual'

export const LICENSE_CURRENCY = 'USD'
export const BASIC_MONTHLY = 10
export const COMPLETE_MONTHLY = 19
export const FOUNDER_MONTHLY = 15
export const FOUNDER_LOCK_MONTHS = 24
export const EXTRA_BRANCH_MONTHLY = 5
export const DEFAULT_TERM_MONTHS = 12
// Days an organization keeps operating after its expiry (private.subscription_grace_days).
export const SUBSCRIPTION_GRACE_DAYS = 5

// Basic includes WhatsApp while OpenWA has no infrastructure cost.
export const BASIC_MODULES = ['optical_sales', 'whatsapp']
export const COMPLETE_MODULES = ['optical_sales', 'whatsapp', 'cashbox', 'production', 'analytics']
export const ADD_ON_MONTHLY: Record<string, number> = { cashbox: 3, production: 5, analytics: 3 }

// Months charged per billing period: the annual payment covers 12 months for 10.
export const PERIOD_MONTHS_CHARGED: Record<LicenseBillingPeriod, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 10 }

export const planLabels: Record<LicensePlan, string> = { basic: 'Básico', complete: 'Completo', founder: 'Socio fundador', custom: 'Personalizado' }
export const billingPeriodLabels: Record<LicenseBillingPeriod, string> = { monthly: 'Mensual', quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual (12 meses por 10)' }
export const moduleLabels: Record<string, string> = {
  optical_sales: 'Ventas ópticas', whatsapp: 'WhatsApp', cashbox: 'Caja', production: 'Producción y proveedores',
  analytics: 'Analítica', multi_branch: 'Multisucursal',
}

export function planModules(plan: LicensePlan, current: string[]) {
  if (plan === 'basic') return BASIC_MODULES
  if (plan === 'complete' || plan === 'founder') return COMPLETE_MODULES
  return current
}

// Suggested monthly price for a plan, its modules and the extra branches.
export function suggestedMonthlyAmount(plan: LicensePlan, modules: string[], extraBranches: number) {
  const branches = Math.max(0, extraBranches) * EXTRA_BRANCH_MONTHLY
  if (plan === 'founder') return FOUNDER_MONTHLY + branches
  if (plan === 'complete') return COMPLETE_MONTHLY + branches
  const addOns = modules.reduce((total, key) => total + (ADD_ON_MONTHLY[key] ?? 0), 0)
  return Math.min(BASIC_MONTHLY + addOns, COMPLETE_MONTHLY) + branches
}

export function periodAmount(monthly: number, period: LicenseBillingPeriod) {
  return Math.round(monthly * PERIOD_MONTHS_CHARGED[period] * 100) / 100
}

// Calendar-date arithmetic matching Postgres `date + interval 'N months'` (the day is
// clamped to the target month's length), optionally minus one day for an end date.
export function addMonthsIso(isoDate: string, months: number, minusOneDay = false, plusDays = 0) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate()
  const date = new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay) - (minusOneDay ? 1 : 0) + plusDays))
  return date.toISOString().slice(0, 10)
}

export const formatUsd = (amount: number, currency = LICENSE_CURRENCY) =>
  `${new Intl.NumberFormat('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`

// Calendar months a payment covers (the annual payment charges 10 but covers 12).
export const PERIOD_MONTHS_COVERED: Record<LicenseBillingPeriod, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }

type PreviewContract = { monthly_amount: number; billing_period: string; price_locked_until: string | null; post_lock_monthly_amount: number | null }
type PreviewSubscription = { status: string; expires_on: string }

// Mirrors public.record_subscription_payment so the admin sees what will be charged.
export function nextPaymentPreview(contract: PreviewContract, subscription: PreviewSubscription, today: string) {
  const period = contract.billing_period as LicenseBillingPeriod
  const monthly = contract.price_locked_until && today > contract.price_locked_until ? contract.post_lock_monthly_amount ?? 0 : contract.monthly_amount
  // The grace days are never free: the period continues from the day after the last
  // covered day, or after a block from today minus the grace days used. An
  // organization in preparation ('pending') starts on its first payment.
  const continued = addMonthsIso(subscription.expires_on, 0, false, 1)
  const graceUsedFrom = addMonthsIso(today, 0, false, -SUBSCRIPTION_GRACE_DAYS)
  const coveredFrom = subscription.status === 'pending' ? today : continued > graceUsedFrom ? continued : graceUsedFrom
  return { amount: periodAmount(monthly, period), coveredFrom, expiresOn: addMonthsIso(coveredFrom, PERIOD_MONTHS_COVERED[period], true) }
}
