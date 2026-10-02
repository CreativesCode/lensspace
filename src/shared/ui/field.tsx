import { CircleAlert, type LucideIcon } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

import { cx } from './cx'

// Guide: 44 px, radius 10, label 13 px semibold above, help or error below.
// 16 px text on mobile avoids the iOS zoom; 15 px from md up.
// Conflicting utilities (colour, size, background) are chosen exclusively, never stacked:
// Tailwind resolves stacked conflicts by stylesheet order, not by class order.
const controlBase =
  'w-full min-w-0 rounded-control px-3.5 outline-none transition placeholder:text-text-placeholder focus:border-[1.5px] focus:border-action focus:bg-surface focus:ring-4 focus:ring-action-soft disabled:cursor-not-allowed disabled:opacity-60'

export type ControlSize = 'md' | 'lg'

// md = 44 px (guide default); lg = 48 px with a 20 px figure for amount entry.
export function controlClasses({ invalid = false, numeric = false, controlSize = 'md', className }: { invalid?: boolean; numeric?: boolean; controlSize?: ControlSize; className?: string } = {}) {
  const text = numeric
    ? cx('font-display tabular-nums text-ink', controlSize === 'lg' ? 'text-[20px] font-bold' : 'text-[16px] font-semibold')
    : 'text-[16px] text-text md:text-[15px]'
  return cx(
    controlBase,
    invalid ? 'border-[1.5px] border-coral bg-coral-field' : 'border border-line bg-field',
    text,
    className,
  )
}

type FieldProps = { label: ReactNode; help?: ReactNode; error?: ReactNode; optional?: boolean; as?: 'label' | 'div'; className?: string; children: ReactNode }

// Wraps the control in a <label> so the association needs no generated id. Use as="div"
// for composite controls (input + segmented CUP/USD) where a label would click the first button.
export function Field({ label, help, error, optional = false, as: Wrapper = 'label', className, children }: FieldProps) {
  return (
    <Wrapper className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[13px] font-semibold text-text-label">
        {label}
        {optional ? <span className="font-normal text-text-muted"> (opcional)</span> : null}
      </span>
      {children}
      {error ? (
        <span role="alert" className="flex items-center gap-1.5 text-[13px] text-coral-ink">
          <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
          {error}
        </span>
      ) : help ? (
        <span className="text-[13px] text-text-muted">{help}</span>
      ) : null}
    </Wrapper>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; numeric?: boolean; controlSize?: ControlSize; leadingIcon?: LucideIcon }

export function Input({ invalid, numeric, controlSize = 'md', leadingIcon: Icon, className, ...props }: InputProps) {
  const height = controlSize === 'lg' ? 'h-12' : 'h-11'
  if (!Icon) return <input aria-invalid={invalid || undefined} className={cx(controlClasses({ invalid, numeric, controlSize }), height, className)} {...props} />
  // With an icon, `className` sizes the wrapper (e.g. flex-1 in a toolbar).
  return (
    <span className={cx('relative flex min-w-0', className)}>
      <Icon aria-hidden="true" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
      <input aria-invalid={invalid || undefined} className={cx(controlClasses({ invalid, numeric, controlSize }), height, 'pl-10')} {...props} />
    </span>
  )
}

export function Textarea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea aria-invalid={invalid || undefined} className={cx(controlClasses({ invalid }), 'min-h-24 py-2.5', className)} {...props} />
}
