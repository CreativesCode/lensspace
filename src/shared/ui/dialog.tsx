'use client'

import { X, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

import { cx } from './cx'

type DialogProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: ReactNode
  children?: ReactNode
}

const widths = { sm: 'max-w-[460px]', md: 'max-w-[520px]', lg: 'max-w-3xl', xl: 'max-w-5xl' }

// Shared modal: Escape and backdrop close, body scroll lock, initial focus and focus
// restore — the behaviour the hand-written dialogs repeat today.
export function Dialog({ open, onClose, title, eyebrow, description, icon: Icon, tone = 'default', size = 'sm', footer, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const firstField = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, [data-autofocus]')
    ;(firstField ?? panelRef.current)?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(7,50,47,0.55)] p-4 md:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx('flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-panel bg-surface shadow-[0_28px_64px_rgba(7,50,47,0.3)] outline-none', widths[size])}
      >
        <div className="flex items-start gap-3.5 border-b border-[#EEF5F4] px-6 py-5">
          {Icon ? (
            <span className={cx('grid size-11 shrink-0 place-items-center rounded-[12px]', tone === 'danger' ? 'bg-coral-soft text-coral-ink' : 'bg-action-soft text-action')}>
              <Icon aria-hidden="true" size={22} />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-action">{eyebrow}</p> : null}
            <h2 id={titleId} className={cx('font-display text-[19px] font-bold text-ink', Boolean(eyebrow) && 'mt-1')}>{title}</h2>
            {description ? <p id={descriptionId} className="mt-1.5 text-[15px] leading-[1.55] text-[#4A5B58]">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="grid size-10 shrink-0 place-items-center rounded-control border border-line text-ink transition hover:bg-[#F0FBF9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action-soft">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {children ? <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div> : null}
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2.5 bg-canvas px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}
