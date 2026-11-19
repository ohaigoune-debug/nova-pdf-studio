/** شعار NOVA Docs: حرف N هندسي من صفحتين متراكبتين مع ركن مطوي — نفس تصميم أيقونة التطبيق. */
export function LogoMark({ size = 40, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden>
      <defs>
        <linearGradient id="nv-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1B5A4F" />
          <stop offset="1" stopColor="#0E302A" />
        </linearGradient>
        <linearGradient id="nv-em" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2FD3A8" />
          <stop offset="1" stopColor="#17B890" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx={rounded ? 228 : 0} fill="url(#nv-bg)" />
      <path d="M300 250h150l0 0 0 524H300z" fill="#FFFFFF" />
      <path d="M574 250h150v524H574z" fill="#FFFFFF" />
      <path d="M300 250h150l274 436v88H574L300 338z" fill="url(#nv-em)" />
      <path d="M574 250h96l54 54v0H574z" fill="#CFEFE5" />
      <path d="M670 250l54 54h-54z" fill="#9ADCC9" />
    </svg>
  )
}
