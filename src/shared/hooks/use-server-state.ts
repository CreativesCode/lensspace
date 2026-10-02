'use client'

import { useState } from 'react'

// Local state seeded from server props that follows new props (router.refresh,
// back/forward) instead of freezing the first value (QA-26). Uses React's
// "adjust state while rendering" pattern, so there is no extra effect pass.
export function useServerState<T>(serverValue: T) {
  const [state, setState] = useState(serverValue)
  const [seen, setSeen] = useState(serverValue)
  if (seen !== serverValue) {
    setSeen(serverValue)
    setState(serverValue)
  }
  return [state, setState] as const
}
