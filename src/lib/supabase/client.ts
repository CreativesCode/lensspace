import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'

const REQUEST_TIMEOUT_MS = 20_000

// A hung request on a weak link must not lock a form silently: after 20 s it fails
// like a dropped connection (retry-safe RPCs make the retry harmless). Storage
// uploads (originals up to 10 MB) are exempt because they can legitimately take longer.
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (init?.signal || url.includes('/storage/v1/')) return fetch(input, init)
  return fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchWithTimeout } }
  )
}
