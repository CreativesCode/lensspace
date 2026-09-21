import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function authorizeManualEditor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/manual')
  const { data: isPlatformAdmin } = await supabase.rpc('current_user_is_platform_admin')
  if (isPlatformAdmin) return
  const { data: owner } = await supabase.from('organization_memberships').select('id').eq('user_id', user.id).eq('role', 'owner').eq('status', 'active').limit(1).maybeSingle()
  if (!owner) redirect('/dashboard')
}
