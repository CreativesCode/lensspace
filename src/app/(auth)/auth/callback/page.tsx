'use client'

import type { EmailOtpType } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { AuthCard } from '@/features/auth/components'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function completeAuthentication() {
      const supabase = createClient()
      const url = new URL(window.location.href)
      const fragment = new URLSearchParams(url.hash.slice(1))
      const accessToken = fragment.get('access_token')
      const refreshToken = fragment.get('refresh_token')
      const flowType = fragment.get('type') ?? url.searchParams.get('type')
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')

      let authError: Error | null = null

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        authError = sessionError
      } else if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)
        authError = exchangeError
      } else if (tokenHash && flowType) {
        const { error: verificationError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: flowType as EmailOtpType,
        })
        authError = verificationError
      } else {
        authError = new Error('Missing authentication parameters')
      }

      window.history.replaceState({}, document.title, '/auth/callback')

      if (authError) {
        setError('La invitación no es válida o ya venció.')
        return
      }

      router.replace(
        flowType === 'invite' || flowType === 'recovery'
          ? '/set-password'
          : '/dashboard',
      )
      router.refresh()
    }

    void completeAuthentication()
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 sm:px-6">
      <AuthCard
        centered
        title={error ? 'No pudimos completar el acceso' : 'Completando acceso…'}
        description={error ?? 'Estamos verificando tu invitación de LensSpace.'}
      />
    </main>
  )
}
