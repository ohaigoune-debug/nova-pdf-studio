import { cn } from '@/lib/utils'
import type { WilayaCount } from '@/server/queries/map.queries'
import { MAP_VIEWBOX, MAP_WILAYAS } from './algeria-map-data'

/**
 * خريطة الجزائر بولاياتها: تلوين ذهبي يشتدّ بعدد الطلاب، ونبض على كل ولاية فيها طلاب.
 * SVG خالص من الخادم — لا JavaScript ولا مكتبة خرائط. التلميح بـ<title> الأصلي.
 * showCounts=false في الصفحة العامة: اسم الولاية فقط، بلا أرقام لكل ولاية.
 */
export function AlgeriaMap({ data, showCounts = false, className }: { data: WilayaCount[]; showCounts?: boolean; className?: string }) {
  const byCode = new Map(data.map((w) => [w.code, w]))
  const max = Math.max(1, ...data.map((w) => w.students))
  // سلّم لوغاريتمي: ولاية بطالب واحد تظهر، وولاية بمئة لا تُطفئ الباقي
  const level = (n: number) => (n <= 0 ? 0 : 0.2 + 0.6 * (Math.log1p(n) / Math.log1p(max)))
  const label = (code: string) => {
    const w = byCode.get(code)
    if (!w) return code
    return showCounts ? `${w.name} — ${w.students} طالب` : w.name
  }
  const reached = data.filter((w) => w.students > 0).length

  return (
    <svg viewBox={MAP_VIEWBOX} className={cn('h-auto w-full', className)} role="img" aria-label={`خريطة الجزائر — طلاب في ${reached} ولاية`}>
      <defs>
        <filter id="dz-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>

      <g filter="url(#dz-shadow)">
        {MAP_WILAYAS.filter((w) => w.d).map((w) => {
          const own = byCode.get(w.code)?.students ?? 0
          // الولاية الأم تضيء أيضاً بطلاب الولايات المقتطعة منها (لا حدود لها في البيانات)
          const children = MAP_WILAYAS.filter((c) => c.parent === w.code).reduce((s, c) => s + (byCode.get(c.code)?.students ?? 0), 0)
          const a = level(own + children)
          return (
            <path
              key={w.code}
              d={w.d}
              className="transition-[fill-opacity] duration-300 hover:[fill-opacity:0.95]"
              fill={a > 0 ? 'hsl(42 78% 52%)' : 'hsl(195 30% 16%)'}
              fillOpacity={a > 0 ? a : 1}
              stroke="hsl(42 70% 60%)"
              strokeOpacity={0.35}
              strokeWidth={0.8}
              strokeLinejoin="round"
            >
              <title>{label(w.code)}</title>
            </path>
          )
        })}
      </g>

      {MAP_WILAYAS.map((w) => {
        const n = byCode.get(w.code)?.students ?? 0
        const r = n > 0 ? 4 + 5 * (Math.log1p(n) / Math.log1p(max)) : 2.2
        return (
          <g key={`dot-${w.code}`}>
            {n > 0 ? (
              <circle cx={w.cx} cy={w.cy} r={r} fill="none" stroke="hsl(42 85% 62%)" strokeWidth={1.5} className="animate-ping" style={{ transformBox: 'fill-box', transformOrigin: 'center', animationDuration: '2.4s' }} />
            ) : null}
            <circle cx={w.cx} cy={w.cy} r={r} fill={n > 0 ? 'hsl(42 90% 66%)' : 'hsl(42 60% 70%)'} fillOpacity={n > 0 ? 1 : 0.45}>
              <title>{label(w.code)}</title>
            </circle>
          </g>
        )
      })}
    </svg>
  )
}
