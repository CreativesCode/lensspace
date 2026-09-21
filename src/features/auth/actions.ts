'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'

export type LoginState = {
  error: string | null
}

export type PasswordState = {
  error: string | null
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function isValidEmail(value: string) {
  return value.length <= 254 && emailPattern.test(value)
}

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard'
  }

  return value
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Completa el correo y la contraseña.' }
  }

  const normalizedEmail = email.trim()
  if (!isValidEmail(normalizedEmail)) {
    return { error: 'Escribe un correo electrónico válido.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    return { error: 'No pudimos iniciar sesión con esas credenciales.' }
  }

  revalidatePath('/', 'layout')
  redirect(safeNextPath(formData.get('next')))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function updatePassword(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = formData.get('password')
  const confirmation = formData.get('passwordConfirmation')

  if (typeof password !== 'string' || password.length < 10) {
    return { error: 'La contraseña debe tener al menos 10 caracteres.' }
  }
  if (password !== confirmation) {
    return { error: 'Las contraseñas no coinciden.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'La sesión de invitación no es válida o ya venció.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: 'No se pudo guardar la contraseña.' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
