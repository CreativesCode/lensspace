export type SaleItem = {
  id: number
  organizationId: number | null
  name: string
  category: string
  price: number
  currency: string
}

export type PriceResult = {
  lineItems: { name: string; baseAmount: number; amount: number; currency: string; adjustmentReason?: string | null }[]
  totals: Record<string, number>
  cupEquivalent: number | null
  warnings: { message: string }[]
}

export type AcceptedOrder = { orderId: number; orderNumber: string }
