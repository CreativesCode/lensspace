import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-field px-5 py-7 text-center">
      <span className="grid size-[52px] place-items-center rounded-[16px] bg-action-soft text-action">
        <Icon aria-hidden="true" size={24} />
      </span>
      <p className="mt-3 font-display text-[17px] font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-[300px] text-sm leading-normal text-text-muted">{description}</p> : null}
      {action ? <div className="mt-3.5">{action}</div> : null}
    </div>
  )
}
