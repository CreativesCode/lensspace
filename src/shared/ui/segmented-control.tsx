import { cx } from './cx'

type Option<T extends string> = { value: T; label: string }

// Guide: CUP/USD selector and view toggles. Rendered as a radiogroup of buttons.
export function SegmentedControl<T extends string>({ options, value, onChange, label, className }: { options: Option<T>[]; value: T; onChange: (value: T) => void; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex shrink-0 gap-[3px] rounded-control bg-[#EEF5F4] p-[3px]', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'min-h-[38px] rounded-[8px] px-3.5 font-display text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action',
              active ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(7,50,47,0.15)]' : 'text-text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
