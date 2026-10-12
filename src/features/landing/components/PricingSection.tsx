'use client'

import { BarChart3, Check, Factory, MessageCircleMore, Sparkles, Store, Wallet } from 'lucide-react'
import { useState } from 'react'

import { ADD_ON_MONTHLY, BASIC_MONTHLY, COMPLETE_MONTHLY, EXTRA_BRANCH_MONTHLY, PERIOD_MONTHS_CHARGED } from '@/features/admin/license-pricing'

import styles from './landing.module.css'

// Public price list: same constants the contracts use (license-pricing.ts). The annual
// payment charges 10 months for 12. The founder price is a private agreement, not listed.
type Billing = 'monthly' | 'annual'

// Sales contact shown on the public landing (product owner, 2026-10-11).
const SALES_WHATSAPP = '15753180319'
const contactHref = (plan: string, annual: boolean) =>
  `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(`Hola, quiero empezar con LensSpace: plan ${plan}, pago ${annual ? 'anual' : 'mensual'}.`)}`

const plans = [
  {
    key: 'basic', name: 'Básico', monthly: BASIC_MONTHLY, featured: false,
    pitch: 'Para vender, cobrar y entregar con orden desde el primer día.',
    items: ['Clientes y recetas con historial', 'Cotizaciones, ventas y cobros en CUP y USD', 'Pedidos y entrega protegida por saldo', 'Avisos por WhatsApp al cliente'],
  },
  {
    key: 'complete', name: 'Completo', monthly: COMPLETE_MONTHLY, featured: true,
    pitch: 'Toda la operación de la óptica, del mostrador al taller.',
    items: ['Todo lo del plan Básico', 'Caja con cierres protegidos', 'Producción: laboratorio, montaje y proveedores', 'Analítica de ventas, equipo y resultados'],
  },
]

const addOns = [
  { label: 'Caja', price: ADD_ON_MONTHLY.cashbox, icon: Wallet },
  { label: 'Producción y proveedores', price: ADD_ON_MONTHLY.production, icon: Factory },
  { label: 'Analítica', price: ADD_ON_MONTHLY.analytics, icon: BarChart3 },
  { label: 'Sucursal adicional', price: EXTRA_BRANCH_MONTHLY, icon: Store },
]

const money = (amount: number) => new Intl.NumberFormat('es-CU', { maximumFractionDigits: 2 }).format(amount)

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>('monthly')
  const annual = billing === 'annual'
  const freeMonths = 12 - PERIOD_MONTHS_CHARGED.annual

  return (
    <section id="precios" className={`${styles.pricing} scroll-mt-24 px-5 py-24 md:px-8 md:py-32`}>
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0D7A72]">PRECIOS CLAROS</p>
          <h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-0.045em] text-[#07322F] md:text-5xl">Paga por lo que tu óptica usa.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[#5B6F6B]">Una licencia mensual por óptica, con todo tu equipo incluido. Empieza con lo esencial y suma módulos cuando los necesites.</p>
        </div>

        <div className="mt-10 flex justify-center">
          <div role="group" aria-label="Forma de pago" className="relative inline-grid grid-cols-2 rounded-full border border-[#CBE5E0] bg-white p-1 shadow-[0_8px_24px_rgba(7,50,47,0.07)]">
            <span aria-hidden="true" className={`${styles.billingThumb} ${annual ? styles.billingThumbAnnual : ''}`} />
            {([['monthly', 'Mensual'], ['annual', 'Anual']] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={billing === value} onClick={() => setBilling(value)}
                className={`relative z-10 inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-display text-sm font-bold transition-colors sm:gap-2 sm:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D7A72] focus-visible:ring-offset-2 ${billing === value ? 'text-white' : 'text-[#4A5B58] hover:text-[#07322F]'}`}>
                {label}
                {value === 'annual' ? <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold sm:px-2 ${annual ? 'bg-[#FF6B4A] text-[#07322F]' : 'bg-[#FFE9E2] text-[#B8452B]'}`}>{freeMonths} meses gratis</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
          {plans.map(({ key, name, monthly, featured, pitch, items }) => {
            const yearly = monthly * PERIOD_MONTHS_CHARGED.annual
            return (
              <article key={key} className={`${styles.planCard} ${featured ? styles.planFeatured : ''} relative flex flex-col rounded-[18px] border p-7 md:p-8 ${featured ? 'border-transparent bg-[#07322F] text-white' : 'border-[#DCECEA] bg-white'}`}>
                {featured ? <span className="absolute -top-3 right-6 inline-flex items-center gap-1.5 rounded-full bg-[#FF6B4A] px-3 py-1.5 text-xs font-bold text-[#07322F] shadow-[0_10px_24px_rgba(255,107,74,0.3)]"><Sparkles aria-hidden="true" size={13} /> Todo incluido</span> : null}
                <h3 className={`font-display text-2xl font-bold tracking-[-0.025em] ${featured ? 'text-white' : 'text-[#07322F]'}`}>{name}</h3>
                <p className={`mt-2 min-h-12 text-sm leading-6 ${featured ? 'text-[#A7CFC9]' : 'text-[#5B6F6B]'}`}>{pitch}</p>

                <div key={billing} className={`${styles.priceSwap} mt-7`}>
                  <p className="flex items-end gap-2">
                    <span className={`font-display text-6xl font-bold leading-none tracking-[-0.05em] tabular-nums ${featured ? 'text-white' : 'text-[#07322F]'}`}>{money(annual ? yearly : monthly)}</span>
                    <span className={`pb-1.5 text-sm font-semibold ${featured ? 'text-[#7FD8C8]' : 'text-[#0D7A72]'}`}>USD / {annual ? 'año' : 'mes'}</span>
                  </p>
                  <p className={`mt-3 min-h-6 text-sm ${featured ? 'text-[#A7CFC9]' : 'text-[#5B6F6B]'}`}>
                    {annual
                      ? <>Equivale a <strong className={featured ? 'text-white' : 'text-[#07322F]'}>{money(yearly / 12)} USD al mes</strong> · <s>{money(monthly * 12)}</s> ahorras {money(monthly * freeMonths)} USD</>
                      : <>O {money(yearly)} USD al año: 12 meses por el precio de {PERIOD_MONTHS_CHARGED.annual}.</>}
                  </p>
                </div>

                <ul className={`mt-7 flex-1 space-y-3 border-t pt-7 ${featured ? 'border-white/10' : 'border-[#E6F0EE]'}`}>
                  {items.map((item) => (
                    <li key={item} className={`flex gap-3 text-sm leading-6 ${featured ? 'text-[#D8F0ED]' : 'text-[#315A55]'}`}>
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${featured ? 'bg-[#35C2A8] text-[#07322F]' : 'bg-[#DDF5F0] text-[#0D7A72]'}`}><Check aria-hidden="true" size={12} strokeWidth={3} /></span>
                      {item}
                    </li>
                  ))}
                </ul>

                <a href={contactHref(name, annual)} target="_blank" rel="noopener noreferrer"
                  className={`mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-[7px] px-5 font-display text-sm font-bold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${featured ? 'bg-[#FF6B4A] text-[#07322F] shadow-[0_12px_30px_rgba(255,107,74,0.25)] hover:bg-[#FF8466] focus-visible:ring-[#FF6B4A] focus-visible:ring-offset-[#07322F]' : 'bg-[#07322F] text-white hover:bg-[#0D7A72] focus-visible:ring-[#0D7A72]'}`}>
                  <MessageCircleMore aria-hidden="true" size={18} /> Quiero empezar
                </a>
              </article>
            )
          })}
        </div>

        <div className="mx-auto mt-5 max-w-4xl rounded-[18px] border border-[#DCECEA] bg-white p-6 md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="font-display text-lg font-bold text-[#07322F]">Arma tu plan desde el Básico</p>
            <p className="text-sm text-[#5B6F6B]">Con todos los módulos nunca pagas más que el Completo.</p>
          </div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {addOns.map(({ label, price, icon: Icon }) => (
              <li key={label} className="flex items-center gap-3 rounded-[10px] bg-[#F3FAF8] p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[7px] bg-white text-[#0D7A72] shadow-[0_1px_3px_rgba(7,50,47,0.12)]"><Icon aria-hidden="true" size={19} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-5 text-[#1C3A37]">{label}</span>
                  <span className="block text-xs font-bold tabular-nums text-[#0D7A72]">+{money(price)} USD / mes</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-x-7 gap-y-3 text-sm text-[#4A5B58]">
          {['Pago en efectivo o Zelle', '5 días de margen para pagar', 'Usuarios sin costo adicional', 'Tus datos siempre son tuyos'].map((item) => (
            <span key={item} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#DDF5F0] text-[#0D7A72]"><Check aria-hidden="true" size={13} strokeWidth={3} /></span>{item}</span>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-[#5B6F6B]">¿Dudas sobre qué plan te conviene? Escríbenos por WhatsApp al <a href={`https://wa.me/${SALES_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0D7A72] underline-offset-4 hover:underline">+1 575 318 0319</a>.</p>
      </div>
    </section>
  )
}
