import type { ReactNode } from 'react'

import { Avatar } from './avatar'
import { cx } from './cx'

type ListItemProps = {
  title: ReactNode
  meta?: ReactNode
  // Initials avatar from this name; use `leading` for an icon instead.
  avatarName?: string
  leading?: ReactNode
  badge?: ReactNode
  trailing?: ReactNode
  selected?: boolean
  onSelect?: () => void
  last?: boolean
}

// Guide: orders, cashboxes and customers share one row pattern — avatar or icon,
// title, metadata, status and a figure on the right.
export function ListItem({ title, meta, avatarName, leading, badge, trailing, selected = false, onSelect, last = false }: ListItemProps) {
  const content = (
    <>
      {avatarName ? <Avatar name={avatarName} strong={selected} /> : leading}
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="truncate text-[15px] font-semibold text-ink">{title}</span>
        {meta ? <span className="text-[13px] text-text-muted">{meta}</span> : null}
      </span>
      {trailing || badge ? (
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          {trailing}
          {badge}
        </span>
      ) : null}
    </>
  )
  const className = cx(
    'flex w-full items-center gap-3.5 border-l-[3px] py-3.5 pl-[15px] pr-[18px] font-sans transition',
    !last && 'border-b border-b-line-soft',
    selected ? 'border-l-action bg-action-tint' : 'border-l-transparent bg-surface',
  )

  if (!onSelect) return <div className={className}>{content}</div>
  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cx(className, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action', !selected && 'hover:bg-canvas')}>
      {content}
    </button>
  )
}
