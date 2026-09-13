'use client'

import { useActionState } from 'react'

import { updatePassword, type PasswordState } from '../actions'

const initialState: PasswordState = { error: null }

export function UpdatePasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState,
  )

  return (
    <form action={formAction} className="space-y-5">
      <label className="block text-sm font-medium text-slate-700">
        Nueva contraseña
        <input
          name="password"
          type="password"
          minLength={10}
          autoComplete="new-password"
          required
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-100"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Repite la contraseña
        <input
          name="passwordConfirmation"
          type="password"
          minLength={10}
          autoComplete="new-password"
          required
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-600 focus:ring-4 focus:ring-sky-100"
        />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-sky-700 px-4 py-3 font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  )
}
