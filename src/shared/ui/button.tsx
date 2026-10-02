import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'

import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'attention' | 'danger' | 'ink' | 'mint' | 'inverse'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Guide: teal acts, ink frames (navigation/totals), coral only for attention.
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'font-semibold bg-action text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_12px_rgba(13,122,114,0.28)] hover:bg-action-hover',
  secondary: 'font-semibold border border-[#CFE3E0] bg-surface text-ink hover:border-[#9BCDC6] hover:bg-[#F0FBF9] [&>svg]:text-action',
  ghost: 'font-semibold bg-transparent text-action hover:bg-action-soft',
  attention: 'bg-coral font-bold text-ink shadow-[0_4px_14px_rgba(255,107,74,0.32)] hover:bg-coral-hover',
  danger: 'font-semibold border border-[#FFD9CD] bg-[#FFF6F2] text-coral-ink hover:bg-[#FFE8E1]',
  ink: 'font-semibold bg-ink text-white shadow-[0_6px_16px_rgba(7,50,47,0.22)] hover:bg-ink-2 [&>svg]:text-mint',
  mint: 'bg-mint font-bold text-ink hover:bg-[#5DD3BD]',
  inverse: 'font-semibold border border-[#2B5E58] bg-transparent text-[#D8F0ED] hover:bg-ink-2',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-[34px] gap-1.5 rounded-[8px] px-3 text-[13px] [&>svg]:size-4',
  md: 'min-h-11 gap-2 rounded-control px-[18px] text-sm [&>svg]:size-[17px]',
  lg: 'min-h-[52px] gap-2 rounded-[12px] px-6 text-[15px] [&>svg]:size-[18px]',
}

export function buttonClasses({ variant = 'primary', size = 'md', block = false, className }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; className?: string } = {}) {
  return cx(
    'inline-flex shrink-0 items-center justify-center font-display transition',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9DFD9]',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-action-soft disabled:text-[#9AABA7] disabled:shadow-none',
    variantClasses[variant],
    sizeClasses[size],
    block && 'w-full',
    className,
  )
}

type CommonProps = { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon; block?: boolean; children?: ReactNode }

export function Button({ variant, size, icon: Icon, block, className, type = 'button', children, ...props }: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} {...props}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

export function ButtonLink({ variant, size, icon: Icon, block, className, children, ...props }: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...props}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </Link>
  )
}

// Square 44 px control (filters, close). `label` is required because there is no visible text.
// outline: bordered (filters, close); ghost: borderless inside dense rows; danger: borderless destructive.
export function IconButton({ icon: Icon, label, count, variant = 'outline', className, type = 'button', ...props }: { icon: LucideIcon; label: string; count?: number; variant?: 'outline' | 'ghost' | 'danger' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'relative grid size-11 shrink-0 place-items-center rounded-control border transition',
        variant === 'outline' && 'border-[#CFE3E0] bg-surface text-action hover:bg-[#F0FBF9]',
        variant === 'ghost' && 'border-transparent bg-transparent text-text-muted hover:bg-[#F0FBF9] hover:text-action',
        variant === 'danger' && 'border-transparent bg-transparent text-coral-ink hover:bg-[#FFF6F2]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#B9DFD9] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" size={18} />
      {count ? (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-coral px-1 font-display text-[11px] font-bold text-ink">
          {count}
        </span>
      ) : null}
    </button>
  )
}
