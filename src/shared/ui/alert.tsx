import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from './cx'

export type AlertTone = 'info' | 'warning' | 'danger' | 'success'

const tones: Record<AlertTone, { box: string; icon: string; text: string; Icon: LucideIcon }> = {
  info: { box: 'border-line-focus bg-action-tint', icon: 'text-action', text: 'text-progress-ink', Icon: Info },
  warning: { box: 'border-amber-line bg-amber-soft', icon: 'text-amber-ink', text: 'text-amber-strong', Icon: TriangleAlert },
  danger: { box: 'border-coral-line bg-coral-tint', icon: 'text-coral-ink', text: 'text-coral-deep', Icon: CircleAlert },
  success: { box: 'border-success-line bg-success-tint', icon: 'text-success-ink', text: 'text-success-ink', Icon: CircleCheck },
}

// Feedback uses the same tones as statuses. `role` defaults to status; use "alert" for errors that need announcing.
export function Alert({ tone = 'info', title, icon, role = 'status', className, children }: { tone?: AlertTone; title?: ReactNode; icon?: LucideIcon; role?: 'status' | 'alert'; className?: string; children: ReactNode }) {
  const { box, icon: iconColor, text, Icon: DefaultIcon } = tones[tone]
  const Icon = icon ?? DefaultIcon
  return (
    <div role={role} className={cx('flex gap-3 rounded-[12px] border px-4 py-3.5', box, className)}>
      <Icon aria-hidden="true" size={18} className={cx('mt-px shrink-0', iconColor)} />
      <div className={cx('text-sm leading-normal', text)}>
        {title ? <strong className="font-semibold">{title} </strong> : null}
        {children}
      </div>
    </div>
  )
}
