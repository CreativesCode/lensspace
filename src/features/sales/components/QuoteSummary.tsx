'use client'

import { CircleCheck, Save } from 'lucide-react'

import { Alert, Button, Card } from '@/shared/ui'

import type { PriceResult } from './sale-types'

const amount = (value: number) => Number(value).toLocaleString('es-CU', { maximumFractionDigits: 2 })

type QuoteSummaryProps = {
  preview: PriceResult | null
  selectedCount: number
  quotationId: number | null
  pending: boolean
  canOperate: boolean
  message: string
  onAccept: () => void
}

// Lives inside the sale <form>: "Guardar cotización" submits it.
export function QuoteSummary({ preview, selectedCount, quotationId, pending, canOperate, message, onAccept }: QuoteSummaryProps) {
  return (
    <Card padded={false} className="h-fit overflow-hidden xl:sticky xl:top-6">
      <div className="border-b border-[#EEF5F4] px-5 py-4">
        <h2 className="font-display text-[17px] font-semibold text-ink">Cotización</h2>
        <p className="mt-0.5 text-[13px] text-text-muted">{selectedCount === 1 ? '1 concepto seleccionado' : `${selectedCount} conceptos seleccionados`}</p>
      </div>
      <div className="flex flex-col gap-4 p-5">
        {preview ? (
          <>
            {preview.lineItems.map((line, index) => (
              <div key={index} className="text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-[#4A5B58]">{line.name}</span>
                  <strong className="whitespace-nowrap font-display tabular-nums text-ink">{amount(line.amount)} {line.currency}</strong>
                </div>
                {Number(line.baseAmount) !== Number(line.amount) ? (
                  <p className="mt-1 text-[13px] text-text-muted">Base {amount(line.baseAmount)} {line.currency} · {line.adjustmentReason}</p>
                ) : null}
              </div>
            ))}
            <div className="border-t border-dashed border-line pt-3">
              {Object.entries(preview.totals).map(([currency, total]) => (
                <p key={currency} className="flex justify-between font-display text-2xl font-bold tabular-nums tracking-[-0.02em] text-ink">
                  <span>Total</span>
                  <span>{amount(total)} <span className="text-sm font-medium text-text-muted">{currency}</span></span>
                </p>
              ))}
              {preview.cupEquivalent !== null ? <p className="mt-1.5 text-right text-[13px] text-text-muted">Equivalente: {amount(preview.cupEquivalent)} CUP</p> : null}
            </div>
            {/* Catalog advisories inform; they never block the sale. */}
            {preview.warnings.map((warning, index) => <Alert key={index} tone="warning">{warning.message}</Alert>)}
          </>
        ) : (
          <p className="rounded-control border border-dashed border-line p-5 text-sm text-text-muted">Guarda para obtener el desglose definitivo.</p>
        )}
        <Button type="submit" icon={Save} block disabled={pending || !canOperate}>{quotationId ? 'Actualizar cotización' : 'Guardar cotización'}</Button>
        {quotationId ? <Button variant="ink" icon={CircleCheck} block onClick={onAccept} disabled={pending}>Cliente acepta · crear pedido</Button> : null}
        {message ? <Alert tone="info">{message}</Alert> : null}
      </div>
    </Card>
  )
}
