import type { ReactNode } from 'react'

import { cx } from './cx'

// Guide: every business status maps to one of five tones, never to a loose colour.
// The status → tone mapping lives in each feature (status-tone.ts), not here.
export type Tone = 'neutral' | 'progress' | 'success' | 'warning' | 'danger'

export const toneClasses: Record<Tone, { surface: string; dot: string; ring: string }> = {
  neutral: { surface: 'bg-neutral-soft text-text-secondary', dot: 'bg-text-disabled', ring: 'shadow-[0_0_0_3px_theme(colors.neutral.soft)]' },
  progress: { surface: 'bg-action-soft text-progress-ink', dot: 'bg-action', ring: 'shadow-[0_0_0_3px_theme(colors.action.soft)]' },
  success: { surface: 'bg-success-soft text-success-ink', dot: 'bg-mint', ring: 'shadow-[0_0_0_3px_theme(colors.success.soft)]' },
  warning: { surface: 'bg-amber-soft text-amber-deep', dot: 'bg-amber-dot', ring: 'shadow-[0_0_0_3px_theme(colors.amber.soft)]' },
  danger: { surface: 'bg-coral-wash text-coral-strong', dot: 'bg-coral', ring: 'shadow-[0_0_0_3px_theme(colors.coral.wash)]' },
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
