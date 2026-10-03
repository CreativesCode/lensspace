import { redirect } from 'next/navigation'

import { getAccessSummary } from '@/lib/supabase/access'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'

import type { ClientDocsInput, ManualAudience } from './generators/types'
import { clientDocsInput } from './schemas/clientDocsInput'

export type ManualAccess = { canEdit: boolean; audiences: ManualAudience[] }

// QA-64: every signed-in user reads the manual; only the platform superadmin edits it
// (also enforced by RLS on manual_documents). Owners and the superadmin also read the
// administration variant.
export async function authorizeManualAccess(): Promise<ManualAccess> {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/manual')
  const { isPlatformAdmin, roles } = await getAccessSummary()
  const audiences: ManualAudience[] = isPlatformAdmin || roles.includes('owner') ? ['worker', 'admin'] : ['worker']
  return { canEdit: isPlatformAdmin, audiences }
}

// The saved manual, or the bundled default content until the superadmin saves one.
export async function loadManualInput(): Promise<{ input: ClientDocsInput; savedAt: string | null }> {
  const supabase = await createClient()
  const { data } = await supabase.from('manual_documents').select('content, updated_at').eq('key', 'main').maybeSingle()
  const row = data as { content: ClientDocsInput; updated_at: string } | null
  return row ? { input: row.content, savedAt: row.updated_at } : { input: clientDocsInput as ClientDocsInput, savedAt: null }
}
