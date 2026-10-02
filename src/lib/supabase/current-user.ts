import { cache } from 'react'

import { createClient } from './server'

export type CurrentUser = { id: string; email: string | null }

// QA-31: one auth check per request, shared by the layout and the page (React cache),
// and verified locally against the project's ES256 signing keys (getClaims) instead
// of a round trip to the Auth server on every render. RLS still checks the JWT.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null }
})
