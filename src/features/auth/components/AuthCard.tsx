import type { ReactNode } from 'react'

import { LensSpaceLogo } from '@/shared/components'
import { cx } from '@/shared/ui'

type AuthCardProps = {
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  logoSubtitle?: string
  // Hide the in-card logo where the page already shows it (login aside on desktop).
  logoClassName?: string
  centered?: boolean
  children?: ReactNode
}

export function AuthCard({ title, eyebrow, description, logoSubtitle, logoClassName, centered = false, children }: AuthCardProps) {
  return (
    <div className={cx('w-full max-w-md rounded-panel border border-line-card bg-surface p-6 shadow-e2 sm:p-8', centered && 'text-center')}>
      <div className={cx('mb-7', centered && 'flex justify-center', logoClassName)}>
        <LensSpaceLogo compact={centered} subtitle={logoSubtitle} />
      </div>
      {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">{eyebrow}</p> : null}
      <h1 className={cx('font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[32px]', Boolean(eyebrow) && 'mt-2')}>{title}</h1>
      {description ? <p className="mt-2 text-[15px] leading-[1.55] text-text-muted">{description}</p> : null}
      {children ? <div className="mt-7">{children}</div> : null}
    </div>
  )
}
