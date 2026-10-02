'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type FormSelectOption = { value: string; label: string }

type FormSelectProps = {
  name?: string
  value?: string
  defaultValue?: string
  options: FormSelectOption[]
  ariaLabel: string
  className?: string
  disabled?: boolean
  required?: boolean
  menuPlacement?: 'top' | 'bottom'
  onValueChange?: (value: string) => void
}

export function FormSelect({ name, value: controlledValue, defaultValue, options, ariaLabel, className = '', disabled = false, required = false, menuPlacement = 'bottom', onValueChange }: FormSelectProps) {
  const initialValue = options.some(({ value }) => value === defaultValue) ? defaultValue! : options[0]?.value ?? ''
  const [internalValue, setInternalValue] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const value = controlledValue ?? internalValue
  const selected = options.find((option) => option.value === value)

  function selectValue(nextValue: string) {
    if (controlledValue === undefined) setInternalValue(nextValue)
    onValueChange?.(nextValue)
    setOpen(false)
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    if (controlledValue !== undefined) return
    const form = rootRef.current?.closest('form')
    if (!form) return
    function handleReset() {
      setInternalValue(initialValue)
      setOpen(false)
    }
    form.addEventListener('reset', handleReset)
    return () => form.removeEventListener('reset', handleReset)
  }, [controlledValue, initialValue])

  return <div ref={rootRef} className={`relative min-w-0 ${className}`}>{name ? <input type="hidden" name={name} value={value} required={required} /> : null}<button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-controls={listboxId} aria-expanded={open} disabled={disabled || !options.length} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !options.length) return
    event.preventDefault()
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === value))
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown' ? (currentIndex + 1) % options.length : (currentIndex - 1 + options.length) % options.length
    selectValue(options[nextIndex].value)
  }} className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-control border border-line bg-field px-3.5 text-left text-[16px] text-text outline-none transition md:text-[15px] focus:border-[1.5px] focus:border-action focus:bg-surface focus:ring-4 focus:ring-action-soft disabled:cursor-not-allowed disabled:opacity-60"><span className="min-w-0 truncate">{selected?.label ?? 'Selecciona una opción'}</span><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={`h-4 w-4 shrink-0 text-ink transition-transform duration-150 ${open ? 'rotate-180' : ''}`}><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg></button>{open ? <div id={listboxId} role="listbox" aria-label={ariaLabel} className={`absolute left-0 right-0 z-[70] max-h-56 min-w-0 overflow-y-auto rounded-control border border-line bg-surface p-1 shadow-e2 ${menuPlacement === 'top' ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]'}`}>{options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => selectValue(option.value)} className={`block min-h-11 w-full min-w-0 rounded-[8px] px-3 py-2.5 text-left text-[15px] ${option.value === value ? 'bg-action-soft font-semibold text-ink' : 'text-text-secondary hover:bg-action-tint'}`}>{option.label}</button>)}</div> : null}</div>
}
