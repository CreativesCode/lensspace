import type { Metadata } from 'next'
import { authorizeManualEditor } from '@/features/client-docs/authorize-manual'
import { ClientDocsGenerator } from '@/features/client-docs/components/ClientDocsGenerator'

export const metadata: Metadata = { title: 'Manual del sistema', robots: { index: false, follow: false, nocache: true } }

export default async function ManualPage() {
  await authorizeManualEditor()
  return <ClientDocsGenerator />
}
