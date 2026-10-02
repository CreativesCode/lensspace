'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes } from 'react'

import { controlClasses, cx } from '@/shared/ui'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }

// UI 2.0 field styling is built in; `className` is for layout of the wrapper only.
export function PasswordInput({ className, invalid, ...props }: Props) {
  const [visible, setVisible] = useState(false)
  const label = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'

  return (
    <div className={cx('relative', className)}>
      <input {...props} aria-invalid={invalid || undefined} type={visible ? 'text' : 'password'} className={cx(controlClasses({ invalid }), 'h-11 pr-12')} />
      <button
        type="button"
        aria-label={label}
        aria-pressed={visible}
        title={label}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-control text-text-muted transition hover:bg-action-soft hover:text-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action"
      >
        {visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}
      </button>
    </div>
  )
}
