type Props = { compact?: boolean; inverse?: boolean; subtitle?: string }

export function LensSpaceLogo({ compact = false, inverse = false, subtitle }: Props) {
  return (
    <div className="flex items-center gap-3">
      <svg aria-hidden="true" width={compact ? 34 : 42} height={compact ? 34 : 42} viewBox="0 0 188 188" fill="none">
        <rect width="188" height="188" rx="44" fill="#07322F" />
        <path d="M29 92C48 61 71 47 94 47s46 14 65 45" stroke="#7FD8C8" strokeWidth="10" strokeLinecap="round" />
        <path d="M29 96C48 127 71 141 94 141s46-14 65-45" stroke="#F0FBF9" strokeWidth="10" strokeLinecap="round" />
        <path d="M94 64A30 30 0 0 0 94 124" stroke="#35C2A8" strokeWidth="7" strokeLinecap="round" />
        <path d="M94 64A30 30 0 0 1 94 124" stroke="#0D7A72" strokeWidth="7" strokeLinecap="round" />
        <path d="M94 59V129" stroke="#F0FBF9" strokeWidth="5" strokeLinecap="round" />
        <circle cx="94" cy="94" r="13" fill="#FF6B4A" />
        <circle cx="90" cy="90" r="3.5" fill="#FFD9D0" />
      </svg>
      <div className="min-w-0">
        <p className={inverse ? 'font-display text-[15.5px] font-bold tracking-tight text-[#F2FBF9]' : 'font-display text-lg font-bold tracking-tight text-slate-950'}>LensSpace</p>
        {subtitle ? <p className={inverse ? 'truncate text-[11px] text-[#6F9C96]' : 'truncate text-xs text-slate-500'}>{subtitle}</p> : null}
      </div>
    </div>
  )
}
