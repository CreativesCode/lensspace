import { cx } from './cx'

type Tab<T extends string> = { value: T; label: string; count?: number }

// Presentational tablist; the parent renders the active panel.
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: Tab<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 overflow-x-auto border-b border-[#E3EFED]">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cx(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 font-display text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action',
              active ? 'border-action text-ink' : 'border-transparent text-text-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cx('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11.5px] font-bold', active ? 'bg-action-soft text-[#0B5A53]' : 'bg-[#EEF5F4] text-text-muted')}>
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
