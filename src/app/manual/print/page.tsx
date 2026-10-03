import type { Metadata } from 'next'

import { authorizeManualAccess, loadManualInput } from '@/features/client-docs/authorize-manual'
import { PrintView } from '@/features/client-docs/components/PrintView'
import { BUSINESS_TIME_ZONE } from '@/shared/utils/dates'

export const metadata: Metadata = { title: 'Manual listo para imprimir', robots: { index: false, follow: false, nocache: true } }
// e.g. '3 de octubre de 2026', in business time (the server renders in UTC).
const generatedDate = new Intl.DateTimeFormat('es-CU', { timeZone: BUSINESS_TIME_ZONE, day: 'numeric', month: 'long', year: 'numeric' })

export default async function ManualPrintPage({ searchParams }: PageProps<'/manual/print'>) {
  const [access, manual, query] = await Promise.all([authorizeManualAccess(), loadManualInput(), searchParams])
  // The administration variant only for those allowed to read it.
  const audience = query.audience === 'admin' && access.audiences.includes('admin') ? 'admin' : 'worker'
  return <PrintView input={manual.input} audience={audience} generatedDateLabel={generatedDate.format(new Date())} />
}
