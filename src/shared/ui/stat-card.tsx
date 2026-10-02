import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from './cx'

type StatCardProps = {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  // `ink` sits inside a featured PageHeader; `light` is a standalone card.
  surface?: 'ink' | 'light'
  // positive: mint figure on ink / green hint on light; attention: coral (balance due); danger: incidents.
  tone?: 'default' | 'positive' | 'attention' | 'danger'
}

export function StatCard({ label, value, unit, hint, icon: Icon, surface = 'light', tone = 'default' }: StatCardProps) {
  if (surface === 'ink') {
    const attention = tone === 'attention'
    return (
      <div className={cx('rounded-card px-4 py-3.5', attention ? 'bg-coral' : 'bg-ink-2')}>
        <p className={cx('text-[13px]', attention ? 'font-semibold text-[#4A1507]' : 'text-[#A7CFC9]')}>{label}</p>
        <p className={cx('mt-1 font-display text-[26px] font-bold tabular-nums tracking-[-0.02em]', attention ? 'text-ink' : tone === 'positive' ? 'text-mint' : 'text-white')}>
          {value}
          {unit ? <span className={cx('ml-1 text-[13px]', attention ? 'font-semibold' : 'font-medium text-[#A7CFC9]')}>{unit}</span> : null}
        </p>
      </div>
    )
  }

  const danger = tone === 'danger'
  return (
    <div className={cx('rounded-card border px-5 py-[18px]', danger ? 'border-[#FFD9CD] bg-[#FFF6F2]' : 'border-[#E3EFED] bg-surface shadow-e1')}>
      <div className="flex items-center justify-between gap-3">
        <p className={cx('text-[13px]', danger ? 'font-semibold text-coral-ink' : 'text-text-muted')}>{label}</p>
        {Icon ? (
          <span className={cx('grid size-[34px] shrink-0 place-items-center rounded-control', danger ? 'bg-[#FFE8E1] text-coral-ink' : 'bg-action-soft text-action')}>
            <Icon aria-hidden="true" size={17} />
          </span>
        ) : null}
      </div>
      <p className={cx('mt-1.5 font-display text-[30px] font-bold tabular-nums tracking-[-0.02em]', danger ? 'text-coral-ink' : 'text-ink')}>
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className={cx('mt-0.5 text-[13px]', danger ? 'text-[#7A3A26]' : tone === 'positive' ? 'font-semibold text-[#07655C]' : 'text-text-muted')}>{hint}</p> : null}
    </div>
  )
}
