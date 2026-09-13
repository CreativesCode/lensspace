type Props = { compact?: boolean; inverse?: boolean; subtitle?: string }

export function VisionStudioLogo({ compact = false, inverse = false, subtitle }: Props) {
  const ink = inverse ? '#35C2A8' : '#0D7A72'
  return (
    <div className="flex items-center gap-3">
      <svg aria-hidden="true" width={compact ? 34 : 42} height={compact ? 22 : 28} viewBox="0 0 76 48" fill="none">
        <path d="M6 24c10-13 22-19.5 32-19.5S60 11 70 24c-10 13-22 19.5-32 19.5S16 37 6 24z" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
        {!compact ? <path d="M38 12v24" stroke={ink} strokeWidth="4" /> : null}
        <circle cx="38" cy="24" r="7.5" fill="#FF6B4A" />
      </svg>
      <div className="min-w-0">
        <p className={inverse ? 'font-display text-[15.5px] font-bold tracking-tight text-[#F2FBF9]' : 'font-display text-lg font-bold tracking-tight text-slate-950'}>Vision Studio</p>
        {subtitle ? <p className={inverse ? 'truncate text-[11px] text-[#6F9C96]' : 'truncate text-xs text-slate-500'}>{subtitle}</p> : null}
      </div>
    </div>
  )
}
