import { LogOut } from 'lucide-react'
import Link from 'next/link'

import { signOut } from '@/features/auth/actions'
import { Avatar } from '@/shared/ui'

export type ShellIdentity = { userId: string; displayName: string; phone: string | null; roleLabel: string; organizationName: string }

// QA-62: the name opens the profile page (name, phone, password).
export function SidebarAccount({ identity, onNavigate }: { identity: ShellIdentity; onNavigate?: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] bg-ink-2 p-3">
      <Link href="/profile" prefetch={false} onClick={onNavigate} title="Mi perfil" aria-label={`Mi perfil: ${identity.displayName}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[8px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint">
        <Avatar name={identity.displayName} size="sm" strong />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-on-ink-text">{identity.displayName}</span>
          <span className="block truncate text-xs text-on-ink-subtle">{identity.roleLabel}</span>
        </span>
      </Link>
      <form action={signOut}>
        <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className="grid size-9 place-items-center rounded-[8px] text-on-ink-subtle transition hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint">
          <LogOut aria-hidden="true" size={18} />
        </button>
      </form>
    </div>
  )
}
