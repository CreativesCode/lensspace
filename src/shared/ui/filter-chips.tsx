import { cx } from './cx'

type Chip<T extends string> = { value: T; label: string; count?: number }

// Quick status filters (Todos / Con saldo / …). The active chip is ink.
export function FilterChips<T extends string>({ chips, value, onChange, label }: { chips: Chip<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const active = chip.value === value
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cx(
              'flex min-h-9 items-center gap-2 rounded-full border pl-3.5 pr-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-soft',
              active ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-[#324E4A] hover:border-[#9BCDC6]',
              chip.count === undefined && 'pr-3.5',
            )}
          >
            {chip.label}
            {chip.count !== undefined ? (
              <span className={cx('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-bold text-ink', active ? 'bg-mint' : 'bg-[#EEF5F4]')}>{chip.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
