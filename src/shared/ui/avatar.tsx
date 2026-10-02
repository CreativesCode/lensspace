import { cx } from './cx'

const sizes = { sm: 'size-[34px] text-[12.5px]', md: 'size-10 text-[13px]', lg: 'size-12 text-[15px]' }

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('')
}

export function Avatar({ name, size = 'md', strong = false, className }: { name: string; size?: keyof typeof sizes; strong?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-display font-bold',
        strong ? 'bg-action text-white' : 'bg-action-soft text-action',
        sizes[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
