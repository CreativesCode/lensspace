import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from './cx'

export type AlertTone = 'info' | 'warning' | 'danger' | 'success'

const tones: Record<AlertTone, { box: string; icon: string; text: string; Icon: LucideIcon }> = {
  info: { box: 'border-[#B9DFD9] bg-[#F0FBF9]', icon: 'text-action', text: 'text-[#0B5A53]', Icon: Info },
  warning: { box: 'border-[#F6D9B3] bg-amber-soft', icon: 'text-amber-ink', text: 'text-[#7A4510]', Icon: TriangleAlert },
  danger: { box: 'border-[#FFD9CD] bg-[#FFF6F2]', icon: 'text-coral-ink', text: 'text-[#7A3A26]', Icon: CircleAlert },
  success: { box: 'border-[#A9E6D7] bg-[#E9FAF5]', icon: 'text-[#07655C]', text: 'text-[#07655C]', Icon: CircleCheck },
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
