import { Check } from 'lucide-react'
import { Fragment } from 'react'

import { cx } from './cx'

// Guide "Pasos del pedido": done steps in mint with a check, the current one in action.
export function Steps({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <div>
      <ol aria-label={label} className="flex items-center">
        {steps.map((step, index) => {
          const done = index < current
          const active = index === current
          return (
            <Fragment key={step}>
              {index ? <li aria-hidden="true" className={cx('h-0.5 min-w-4 flex-1', index <= current ? 'bg-mint' : 'bg-line')} /> : null}
              <li aria-current={active ? 'step' : undefined} className="shrink-0">
                <span className="sr-only">{step}{done ? ' (completado)' : active ? ' (actual)' : ''}</span>
                <span
                  aria-hidden="true"
                  className={cx(
                    'grid size-[26px] place-items-center rounded-full font-display text-xs font-bold',
                    done ? 'bg-mint text-ink' : active ? 'bg-action text-white shadow-[0_0_0_4px_theme(colors.action.soft)]' : 'bg-line-soft text-text-muted',
                  )}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : index + 1}
                </span>
              </li>
            </Fragment>
          )
        })}
      </ol>
      <p aria-hidden="true" className="mt-1.5 text-[12.5px] text-text-muted">{steps.join(' · ')}</p>
    </div>
  )
}
