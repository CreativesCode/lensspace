import { PageContainer } from '@/shared/ui'

// Route shell shown instantly on navigation; with experimental.useOffline it also
// stays on screen while a navigation waits for the connection to return.
export default function MainLoading() {
  return (
    <PageContainer>
      <div aria-busy="true" aria-label="Cargando" className="flex animate-pulse flex-col gap-5">
        <div className="h-[132px] rounded-card bg-ink/90" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-card border border-line-card bg-surface" />
          <div className="h-40 rounded-card border border-line-card bg-surface" />
        </div>
        <div className="h-64 rounded-card border border-line-card bg-surface" />
      </div>
    </PageContainer>
  )
}
