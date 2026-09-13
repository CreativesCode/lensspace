'use client'

import type { EmailOtpType } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'
import { VisionStudioLogo } from '@/shared/components'

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
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-7 flex justify-center">
          <VisionStudioLogo compact />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-950">
          {error ? 'No pudimos completar el acceso' : 'Completando acceso…'}
        </h1>
        <p className="mt-3 text-slate-600">
          {error ?? 'Estamos verificando tu invitación de Vision Studio.'}
        </p>
      </div>
    </main>
  )
}
