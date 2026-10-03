import { redirect } from 'next/navigation'

import { ChangePasswordForm } from '@/features/account/components/ChangePasswordForm'
import { ProfileDetailsForm } from '@/features/account/components/ProfileDetailsForm'
import type { Tables } from '@/lib/supabase/database.types'
import { getCurrentUser } from '@/lib/supabase/current-user'
import { createClient } from '@/lib/supabase/server'
import { PageContainer, PageHeader } from '@/shared/ui'

export default async function ProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/profile')
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('display_name, phone').eq('user_id', user.id).maybeSingle()
  const profile = data as Pick<Tables<'profiles'>, 'display_name' | 'phone'> | null

  return (
    <PageContainer>
      <PageHeader eyebrow="Cuenta" title="Mi perfil" description="Tus datos de contacto y tu contraseña de acceso." />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <ProfileDetailsForm userId={user.id} email={user.email} displayName={profile?.display_name ?? user.email?.split('@')[0] ?? ''} phone={profile?.phone ?? null} />
        <ChangePasswordForm email={user.email} />
      </div>
    </PageContainer>
  )
}
