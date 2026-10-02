'use client'

import { RotateCcw, WifiOff } from 'lucide-react'
import { useEffect } from 'react'

import { Button, EmptyState, PageContainer } from '@/shared/ui'

// Keeps the sidebar usable when a screen fails to render (often a dropped
// connection) instead of replacing the whole app with the framework error page.
export default function MainError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <PageContainer>
      <EmptyState
        icon={WifiOff}
        title="No pudimos cargar esta pantalla"
        description="Puede ser la conexión. Lo que ya guardaste no se perdió; vuelve a intentarlo cuando haya señal."
        action={<Button icon={RotateCcw} onClick={() => retry()}>Reintentar</Button>}
      />
    </PageContainer>
  )
}
