import type { ReactNode } from 'react'

import { toneClasses, type Tone } from './badge'
import { cx } from './cx'

export type TimelineItem = { id: string; tone: Tone; tag: string; when: ReactNode; title: ReactNode; detail?: ReactNode; actor?: ReactNode }

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="m-0 list-none p-0">
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3.5">
          <div className="flex w-3 shrink-0 flex-col items-center">
            <span aria-hidden="true" className={cx('mt-1 size-3 rounded-full', toneClasses[item.tone].dot, toneClasses[item.tone].ring)} />
            {index < items.length - 1 ? <span aria-hidden="true" className="mt-1 min-h-3.5 w-0.5 flex-1 bg-[#E3EFED]" /> : null}
          </div>
          <div className="min-w-0 flex-1 pb-[18px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('rounded-[5px] px-[7px] py-0.5 text-[11.5px] font-bold', toneClasses[item.tone].surface)}>{item.tag}</span>
              <span className="text-[13px] text-text-muted">{item.when}</span>
            </div>
            <p className="mt-1.5 text-[15px] font-semibold text-ink">{item.title}</p>
            {item.detail ? <p className="mt-0.5 text-sm leading-normal text-[#4A5B58]">{item.detail}</p> : null}
            {item.actor ? <p className="mt-0.5 text-[13px] text-text-muted">{item.actor}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
