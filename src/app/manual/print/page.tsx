import type { Metadata } from 'next'
import { authorizeManualEditor } from '@/features/client-docs/authorize-manual'
import { PrintView } from '@/features/client-docs/components/PrintView'

export const metadata: Metadata = { title: 'Manual listo para imprimir', robots: { index: false, follow: false, nocache: true } }
const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export default async function ManualPrintPage() {
  await authorizeManualEditor()
  const now = new Date()
  return <PrintView generatedDateLabel={`${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`} />
}
