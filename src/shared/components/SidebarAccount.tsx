import { LogOut } from 'lucide-react'

import { signOut } from '@/features/auth/actions'
import { Avatar } from '@/shared/ui'

export type ShellIdentity = { displayName: string; roleLabel: string; organizationName: string }

export function SidebarAccount({ identity }: { identity: ShellIdentity }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] bg-ink-2 p-3">
      <Avatar name={identity.displayName} size="sm" strong />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#E6F5F3]">{identity.displayName}</p>
        <p className="truncate text-xs text-[#7FB3AC]">{identity.roleLabel}</p>
      </div>
      <form action={signOut}>
        <button type="submit" aria-label="Cerrar sesión" title="Cerrar sesión" className="grid size-9 place-items-center rounded-[8px] text-[#7FB3AC] transition hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint">
          <LogOut aria-hidden="true" size={18} />
        </button>
      </form>
    </div>
  )
}
