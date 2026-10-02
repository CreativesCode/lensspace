import { cx } from './cx'

export function ProgressBar({ value, tone = 'success', size = 'md', label }: { value: number; tone?: 'success' | 'attention'; size?: 'md' | 'lg'; label: string }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className={cx('overflow-hidden rounded-full bg-[rgba(7,50,47,0.08)]', size === 'lg' ? 'h-2.5' : 'h-2')}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', tone === 'attention' ? 'bg-coral' : 'bg-mint')} style={{ width: `${percent}%` }} />
    </div>
  )
}
