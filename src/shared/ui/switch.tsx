import type { ReactNode } from 'react'

import { cx } from './cx'

export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-2.5 text-[15px] text-text', disabled && 'opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'flex h-6 w-[42px] shrink-0 items-center rounded-full p-0.5 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-soft disabled:cursor-not-allowed',
          checked ? 'justify-end bg-action' : 'justify-start bg-line-strong',
        )}
      >
        <span className="size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(7,50,47,0.25)]" />
      </button>
      {label}
    </label>
  )
}
