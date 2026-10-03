'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

// QA-63: the landing stays static (fast, cacheable) and does not ship supabase-js; this
// only checks that the Supabase session cookie exists and turns the access CTAs into
// 'Ir a mi panel'. The proxy validates the session and sends a signed-in visitor from
// /login to /dashboard, so an expired cookie just ends on the login form.
export function AccessLink({ label, className, arrow = false }: { label: string; className: string; arrow?: boolean }) {
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookies exist only in the browser
    setSignedIn(/(?:^|;\s*)sb-[^=]+-auth-token(?:\.0)?=/.test(document.cookie))
  }, [])
  return (
    <Link href={signedIn ? '/dashboard' : '/login'} className={className}>
      {signedIn ? 'Ir a mi panel' : label}{arrow ? <> <ArrowRight aria-hidden="true" size={16} /></> : null}
    </Link>
  )
}
