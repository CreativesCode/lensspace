import type { HTMLAttributes, ReactNode } from 'react'

import { cx } from './cx'

export function Card({ padded = true, className, children, ...props }: { padded?: boolean; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={cx('min-w-0 rounded-card border border-[#E3EFED] bg-surface shadow-e1', padded && 'p-5 md:px-[22px]', className)} {...props}>
      {children}
    </section>
  )
}

// Card title row: Space Grotesk 17 px heading with optional trailing meta (counts, actions).
export function CardHeader({ title, meta, className }: { title: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <h2 className="font-display text-[17px] font-semibold text-ink">{title}</h2>
      {meta ? <div className="text-[13px] text-text-muted">{meta}</div> : null}
    </div>
  )
}
