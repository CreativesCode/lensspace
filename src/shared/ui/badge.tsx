import type { ReactNode } from 'react'

import { cx } from './cx'

// Guide: every business status maps to one of five tones, never to a loose colour.
// The status → tone mapping lives in each feature (status-tone.ts), not here.
export type Tone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger'

export const toneClasses: Record<Tone, { surface: string; dot: string; ring: string }> = {
  neutral: { surface: 'bg-[#EEF3F2] text-[#4A5B58]', dot: 'bg-[#9AABA7]', ring: 'shadow-[0_0_0_3px_#EEF3F2]' },
  progress: { surface: 'bg-action-soft text-[#0B5A53]', dot: 'bg-action', ring: 'shadow-[0_0_0_3px_#E2F4F1]' },
  success: { surface: 'bg-[#D9F5EE] text-[#07655C]', dot: 'bg-mint', ring: 'shadow-[0_0_0_3px_#D9F5EE]' },
  warning: { surface: 'bg-amber-soft text-[#8F4C0F]', dot: 'bg-[#E39A3B]', ring: 'shadow-[0_0_0_3px_#FFF4E8]' },
  danger: { surface: 'bg-[#FFE8E1] text-[#B2361A]', dot: 'bg-coral', ring: 'shadow-[0_0_0_3px_#FFE8E1]' },
}

export function Badge({ tone = 'neutral', size = 'sm', dot = true, className, children }: { tone?: Tone; size?: 'sm' | 'lg'; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-semibold',
        size === 'lg' ? 'rounded-[8px] px-3 py-1.5 text-[13.5px]' : 'rounded-badge px-[9px] py-1 text-xs',
        toneClasses[tone].surface,
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className={cx('size-1.5 shrink-0 rounded-full', toneClasses[tone].dot)} /> : null}
      {children}
    </span>
  )
}
