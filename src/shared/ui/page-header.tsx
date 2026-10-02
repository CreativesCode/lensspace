import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from './cx'

type PageHeaderProps = {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  // Featured (default): ink panel, optionally with 2-4 key figures. The user chose it for
  // every page (2026-10-01). Simple: white card with breadcrumb eyebrow; kept but unused.
  variant?: 'featured' | 'simple'
  stats?: ReactNode
  breadcrumb?: ReactNode
}

export function PageHeader({ title, eyebrow, description, actions, variant = 'featured', stats, breadcrumb }: PageHeaderProps) {
  if (variant === 'featured') {
    return (
      <header className="relative flex flex-col gap-[22px] overflow-hidden rounded-panel bg-ink p-5 md:p-[30px]">
        <span aria-hidden="true" className="pointer-events-none absolute -right-[90px] -top-[150px] size-[380px] rounded-full border border-on-ink-line" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-[60px] right-[30px] size-[210px] rounded-full border border-on-ink-line" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-[620px]">
            {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-ink-eyebrow">{eyebrow}</p> : null}
            <h1 className="mt-2 font-display text-[28px] font-bold leading-[1.08] tracking-[-0.03em] text-white md:text-[38px]">{title}</h1>
            {description ? <p className="mt-2 text-[15px] leading-[1.55] text-on-ink-body">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
        </div>
        {stats ? <div className="relative grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">{stats}</div> : null}
      </header>
    )
  }

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-line-card bg-surface px-5 py-5 md:px-[26px] md:py-[22px]">
      <div className="min-w-0">
        {breadcrumb ?? (eyebrow ? (
          <p className="flex items-center gap-1.5 text-[13px] text-text-muted">
            {eyebrow}
            <ChevronRight aria-hidden="true" size={13} className="text-text-disabled" />
            <span className="font-semibold text-ink">{title}</span>
          </p>
        ) : null)}
        <h1 className={cx('font-display text-[28px] font-bold tracking-[-0.03em] text-ink md:text-[32px]', Boolean(breadcrumb || eyebrow) && 'mt-1.5')}>{title}</h1>
        {description ? <p className="mt-1 text-[15px] text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </header>
  )
}
