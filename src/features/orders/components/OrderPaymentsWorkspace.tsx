'use client'

import { Glasses, Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import { ButtonLink, EmptyState, PageHeader, StatCard, Toast, cx } from '@/shared/ui'

import { formatAmount } from '../format'
import { orderKpis } from '../order-kpis'
import { friendlyPaymentError } from '../payment-errors'
import type { Order, PaymentSummary, TimelineEvent } from '../types'
import { OrderDetail } from './OrderDetail'
import { OrdersInbox } from './OrdersInbox'
import type { PaymentInput } from './PaymentForm'

const DESKTOP_QUERY = '(min-width: 1280px)'

// /orders and /sales are enabled together (same optical_sales access), so the empty state can link to /sales.
type WorkspaceProps = { initialOrders: Order[]; initialCustomerFilter?: string; initialCustomerId?: number }

export function OrderPaymentsWorkspace({ initialOrders, initialCustomerFilter = '', initialCustomerId }: WorkspaceProps) {
  const supabase = useMemo(() => createClient(), [])
  const [orders, setOrders] = useState(initialOrders)
  const [selectedId, setSelectedId] = useState(0)
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [pending, startTransition] = useTransition()

  const loadDetail = useCallback(async (orderId: number) => {
    const [summaryResult, historyResult] = await Promise.all([
      supabase.rpc('get_order_payment_summary', { target_order_id: orderId } as never),
      supabase.rpc('get_order_timeline', { target_order_id: orderId } as never),
    ])
    if (summaryResult.error) throw summaryResult.error
    setSummary(summaryResult.data as unknown as PaymentSummary)
    setTimeline(historyResult.error ? [] : historyResult.data as unknown as TimelineEvent[])
  }, [supabase])

  const refreshOrders = useCallback(async () => {
    const { data, error: listError } = await supabase.rpc('list_accessible_orders')
    if (!listError) setOrders(data as unknown as Order[])
  }, [supabase])

  const select = useCallback((orderId: number) => {
    setSelectedId(orderId); setError('')
    startTransition(async () => {
      try { await loadDetail(orderId) } catch (loadError) { setSummary(null); setError(loadError instanceof Error ? loadError.message : 'No se pudo abrir el pedido.') }
    })
  }, [loadDetail])

  // Desktop shows inbox and detail side by side, so the first order opens automatically.
  // Mobile shows one pane at a time and starts on the inbox.
  useEffect(() => {
    const first = initialOrders[0]
    if (!first || !window.matchMedia(DESKTOP_QUERY).matches) return
    startTransition(async () => {
      try { await loadDetail(first.id); setSelectedId(first.id) } catch { /* the user can still pick an order */ }
    })
  }, [initialOrders, loadDetail])

  function registerPayment(input: PaymentInput) {
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        const { error: paymentError } = await supabase.rpc('register_cash_payment', { target_order_id: selectedId, payment_amount: input.amount, payment_currency: input.currency, payment_applied_rate: input.rate, payment_notes: input.notes } as never)
        if (paymentError) { setError(friendlyPaymentError(paymentError)); return resolve(false) }
        setError('')
        await Promise.all([loadDetail(selectedId), refreshOrders()]).catch(() => undefined)
        setToast('Pago en efectivo registrado.')
        resolve(true)
      })
    })
  }

  function deliver() {
    startTransition(async () => {
      const { error: deliveryError } = await supabase.rpc('mark_order_delivered', { target_order_id: selectedId } as never)
      if (deliveryError) return setError(deliveryError.message)
      setError('')
      await Promise.all([loadDetail(selectedId), refreshOrders()]).catch(() => undefined)
      setToast('Pedido marcado como entregado.')
    })
  }

  const kpis = orderKpis(orders)
  const selectedOrder = orders.find((order) => order.id === selectedId)
  const detailOpen = Boolean(summary && selectedOrder)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="featured"
        eyebrow="Operación comercial"
        title="Pedidos y cobros"
        description="Registra efectivo, controla el saldo y entrega solo cuando el pedido esté pagado."
        stats={<>
          <StatCard surface="ink" label="Pedidos activos" value={kpis.activeCount} />
          <StatCard surface="ink" tone="attention" label="Saldo por cobrar" value={formatAmount(kpis.balanceDue)} unit="CUP" />
          <StatCard surface="ink" tone="positive" label="Pagados, por entregar" value={kpis.readyToDeliver} />
          <StatCard surface="ink" label="Cobrado hoy" value={formatAmount(kpis.collectedToday)} unit="CUP" />
        </>}
      />

      {!orders.length ? (
        <EmptyState
          icon={Glasses}
          title="Aún no hay pedidos aceptados"
          description="Crea una venta y confirma la cotización; el pedido aparecerá aquí."
          action={<ButtonLink href="/sales" icon={Plus}>Nueva venta</ButtonLink>}
        />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
          <OrdersInbox
            orders={orders}
            selectedId={selectedId}
            onSelect={select}
            initialQuery={initialCustomerFilter}
            initialCustomerId={initialCustomerId}
            className={cx(detailOpen && 'hidden xl:block')}
          />
          <div className={cx(!detailOpen && 'hidden xl:block')}>
            {summary && selectedOrder ? (
              <OrderDetail
                order={selectedOrder}
                summary={summary}
                timeline={timeline}
                pending={pending}
                error={error}
                onBack={() => { setSummary(null); setTimeline([]); setSelectedId(0); setError('') }}
                onRegisterPayment={registerPayment}
                onDeliver={deliver}
              />
            ) : (
              <EmptyState icon={Glasses} title={pending ? 'Abriendo pedido…' : 'Selecciona un pedido'} description={error || 'Elige un pedido de la bandeja para ver su saldo, pagos e historial.'} />
            )}
          </div>
        </div>
      )}
      <Toast message={toast} onDismiss={() => setToast('')} />
    </div>
  )
}
