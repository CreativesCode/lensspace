'use client'

import { useEffect } from 'react'

import type { Tables } from '@/lib/supabase/database.types'
import { LensSpaceLogo } from '@/shared/components'

import { contractDate, contractSections, partyLines } from '../contract-document'
import { planLabels, type LicensePlan } from '../license-pricing'
import './contract-print.css'

type Props = { contract: Tables<'license_contracts'>; provider: Tables<'platform_provider_profile'> | null; today: string }

// Contract proforma with the LensSpace brand; the browser print dialog saves it as PDF
// (same pattern as the manual).
export function ContractPrintView({ contract, provider, today }: Props) {
  const parties = partyLines(contract, provider)
  const sections = contractSections(contract, provider)
  useEffect(() => { const id = window.setTimeout(() => window.requestAnimationFrame(() => window.print()), 500); return () => window.clearTimeout(id) }, [])

  return <>
    <aside className="contract-notice" data-no-print>
      <strong>Antes de guardar como PDF</strong>
      <p>En «Más ajustes», quita «Encabezados y pies de página». Revisa el texto con un jurista antes de firmarlo.</p>
      {!provider ? <p>Faltan tus datos de proveedor: complétalos en Organizaciones → «Datos del proveedor».</p> : null}
    </aside>
    <article data-contract-root>
      <header className="contract-brand">
        <LensSpaceLogo subtitle="De la receta a la entrega" />
        <div className="contract-ref"><span>Proforma N.º {String(contract.id).padStart(4, '0')}</span><span>{contract.status === 'draft' ? 'Borrador' : 'Copia'} · {today}</span></div>
      </header>
      <h1>Contrato de licencia de uso de LensSpace</h1>
      <p className="contract-plan">Plan {planLabels[contract.plan as LicensePlan]}</p>
      <section className="contract-parties">
        <p><strong>De una parte, EL PROVEEDOR:</strong> {parties.provider}.</p>
        <p><strong>De otra parte, EL CLIENTE:</strong> {parties.client}.</p>
        <p>Ambas partes acuerdan las siguientes cláusulas:</p>
      </section>
      {sections.map((section) => <section key={section.title} className="contract-clause">
        <h2>{section.title}</h2>
        {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </section>)}
      <p className="contract-place">Y para que así conste, se firma en dos ejemplares en ______________________, a ____ de ______________ de ______.</p>
      <section className="contract-signatures">
        {[['EL PROVEEDOR', provider?.legal_name ?? ''], ['EL CLIENTE', contract.client_representative || contract.client_legal_name]].map(([role, name]) => <div key={role}>
          <span className="contract-line" />
          <strong>{role}</strong>
          <span>{name}</span>
        </div>)}
      </section>
      <footer className="contract-footer">LensSpace · Contrato N.º {String(contract.id).padStart(4, '0')} · vigente desde el {contractDate(contract.starts_on)}</footer>
    </article>
  </>
}
