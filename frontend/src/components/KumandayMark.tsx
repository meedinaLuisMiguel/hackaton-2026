interface KumandayMarkProps {
  size?: number
  className?: string
}

export function KumandayMark({ size = 48, className }: KumandayMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label="Símbolo de Kumanday">
      <path d="M8 48 25 19l10 17 7-11 14 23H8Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M19 48c2-7 7-11 13-11s11 4 13 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M31.8 36.5v11M27.7 40.4l4.1-3.9 4.2 3.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="49" cy="15" r="3" fill="#d7e9aa" />
    </svg>
  )
}
