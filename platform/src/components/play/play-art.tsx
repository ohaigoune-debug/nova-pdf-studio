/**
 * رسوم MADRASADZ PLAY المتجهة كما في حزمة الهوية البصرية المعتمدة (Madrasa_PLAY_Visual_Identity):
 * ظهر البطاقة، إكليل الغار، الكتاب، سهم الدوران، الكأس، العملات، شارات الصح والخطأ وأيقونات الشاشة الأولى.
 * SVG مرسوم يدويًا (لا صور مولّدة ولا ملفات خارجية)، وكلها زخرفية: aria-hidden.
 */
import { useId } from 'react'
import { cn } from '@/lib/utils'

/** معرّف صالح داخل url(#…) مهما كانت صيغة useId */
function useSvgId(prefix: string): string {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

/* ------------------------------- إكليل الغار ------------------------------ */

const LEAF = 'M0 0 C4 -5.2 13 -5.6 19 0 C13 5.6 4 5.2 0 0 Z'

interface LeafSpec {
  x: number
  y: number
  rot: number
  scale: number
}

/** أوراق فرع واحد على قوس (درجات بإحداثيات SVG: 90 أسفل، 180 يسار، 270 أعلى) */
function branchLeaves(cx: number, cy: number, r: number, from: number, to: number, count: number, size: number): LeafSpec[] {
  const leaves: LeafSpec[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const deg = from + (to - from) * t
    const rad = (deg * Math.PI) / 180
    const x = cx + r * Math.cos(rad)
    const y = cy + r * Math.sin(rad)
    const tangent = deg + (to > from ? 90 : -90)
    const scale = size * (1 - t * 0.35)
    leaves.push({ x, y, rot: tangent - 38, scale }, { x, y, rot: tangent + 38, scale: scale * 0.92 })
  }
  // ورقة الطرف
  const end = (to * Math.PI) / 180
  leaves.push({ x: cx + r * Math.cos(end), y: cy + r * Math.sin(end), rot: to + (to > from ? 90 : -90), scale: size * 0.7 })
  return leaves
}

function Laurel({ cx, cy, r, from, to, count, size, gradient }: { cx: number; cy: number; r: number; from: number; to: number; count: number; size: number; gradient: string }) {
  const leaves = branchLeaves(cx, cy, r, from, to, count, size)
  const a = (from * Math.PI) / 180
  const b = (to * Math.PI) / 180
  const sweep = to > from ? 1 : 0
  const stem = `M${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} A${r} ${r} 0 0 ${sweep} ${cx + r * Math.cos(b)} ${cy + r * Math.sin(b)}`
  return (
    <g>
      <path d={stem} fill="none" stroke={`url(#${gradient})`} strokeWidth={2.4} strokeLinecap="round" />
      {leaves.map((l, i) => (
        <path key={i} d={LEAF} transform={`translate(${l.x.toFixed(2)} ${l.y.toFixed(2)}) rotate(${l.rot.toFixed(1)}) scale(${l.scale.toFixed(3)})`} fill={`url(#${gradient})`} stroke="#B87512" strokeWidth={0.5} />
      ))}
    </g>
  )
}

function GoldStops() {
  return (
    <>
      <stop offset="0" stopColor="#FFE38A" />
      <stop offset="0.5" stopColor="#F2B94B" />
      <stop offset="1" stopColor="#D88C14" />
    </>
  )
}

/** كتاب مفتوح أبيض بسطور زرقاء (وسط ظهر البطاقة) */
function OpenBook({ x, y, w }: { x: number; y: number; w: number }) {
  const s = w / 88
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 8 V54 C16 51 32 53 44 61 C56 53 72 51 88 54 V8 C72 6 56 8 44 15 C32 8 16 6 0 8 Z" fill="#0B3F9A" transform="translate(0 5)" />
      <path d="M44 12 C32 4 16 2 3 4 V50 C16 48 32 50 44 58 Z" fill="#FFFFFF" />
      <path d="M44 12 C56 4 72 2 85 4 V50 C72 48 56 50 44 58 Z" fill="#F1F5FD" />
      <path d="M44 12 V58" stroke="#C9D6EE" strokeWidth={1.4} />
      <g stroke="#1457C5" strokeWidth={3} strokeLinecap="round">
        <path d="M52 16 C60 12 68 11 77 11" />
        <path d="M52 24 C60 20 68 19 77 19" />
        <path d="M52 32 C60 28 68 27 77 27" />
        <path d="M52 40 C60 36 68 35 74 35" />
      </g>
      <g stroke="#C7D5EE" strokeWidth={2.2} strokeLinecap="round">
        <path d="M12 12 C20 11 28 12 36 16" />
        <path d="M12 20 C20 19 28 20 36 24" />
        <path d="M12 28 C20 27 28 28 36 32" />
      </g>
    </g>
  )
}

/** الإكليل والكتاب: شعار ظهر البطاقة */
export function WreathEmblem({ className }: { className?: string }) {
  const gold = useSvgId('wg')
  return (
    <svg viewBox="0 0 200 150" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <GoldStops />
        </linearGradient>
      </defs>
      <Laurel cx={100} cy={76} r={66} from={116} to={240} count={9} size={1.3} gradient={gold} />
      <g transform="translate(200 0) scale(-1 1)">
        <Laurel cx={100} cy={76} r={66} from={116} to={240} count={9} size={1.3} gradient={gold} />
      </g>
      <OpenBook x={56} y={44} w={88} />
    </svg>
  )
}

/* -------------------------------- ظهر البطاقة ------------------------------- */

function CornerFlourish() {
  return (
    <g fill="none" stroke="#FFFFFF" strokeOpacity={0.42} strokeWidth={1.1} strokeLinecap="round">
      <path d="M6 30 C6 16 16 6 30 6" />
      <path d="M11 24 C12 16 16 12 24 11" />
      <path d="M14 14 c4 -4 10 -3 10 2 c0 4 -6 4 -6 0" />
      <path d="M30 6 c4 0 6 2 6 5" />
      <path d="M6 30 c0 4 2 6 5 6" />
    </g>
  )
}

/** وجه البطاقة الأزرق: إطار أبيض، زخرفة شبكية خفيفة، زوايا مزخرفة، والإكليل مع الكتاب */
export function CardBackArt() {
  const lattice = useSvgId('lt')
  const glow = useSvgId('bg')
  return (
    <span className="deck-back-frame" aria-hidden>
      <span className="deck-back-inner">
        <svg className="absolute inset-0 size-full" aria-hidden focusable="false">
          <defs>
            <radialGradient id={glow} cx="50%" cy="45%" r="75%">
              <stop offset="0" stopColor="#2F78E6" />
              <stop offset="0.55" stopColor="#1A62D3" />
              <stop offset="1" stopColor="#0E4AB3" />
            </radialGradient>
            <pattern id={lattice} width="30" height="30" patternUnits="userSpaceOnUse">
              <g fill="none" stroke="#FFFFFF" strokeOpacity={0.09} strokeWidth={1}>
                <path d="M8 8 H22 V22 H8 Z" />
                <path d="M15 4 L26 15 L15 26 L4 15 Z" />
                <path d="M0 0 L8 8 M30 0 L22 8 M0 30 L8 22 M30 30 L22 22" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${glow})`} />
          <rect width="100%" height="100%" fill={`url(#${lattice})`} />
        </svg>
        <span className="absolute inset-[7px] rounded-[9px] border border-white/25" />
        <svg className="absolute left-1 top-1 size-10" viewBox="0 0 40 40" aria-hidden focusable="false">
          <CornerFlourish />
        </svg>
        <svg className="absolute right-1 top-1 size-10 -scale-x-100" viewBox="0 0 40 40" aria-hidden focusable="false">
          <CornerFlourish />
        </svg>
        <svg className="absolute bottom-1 left-1 size-10 -scale-y-100" viewBox="0 0 40 40" aria-hidden focusable="false">
          <CornerFlourish />
        </svg>
        <svg className="absolute bottom-1 right-1 size-10 -scale-100" viewBox="0 0 40 40" aria-hidden focusable="false">
          <CornerFlourish />
        </svg>
        <WreathEmblem className="relative w-[94%] drop-shadow-[0_3px_6px_rgba(4,30,90,0.35)]" />
      </span>
    </span>
  )
}

/* ------------------------------- سهم الدوران ------------------------------- */

export function FlipArrow({ className }: { className?: string }) {
  const g = useSvgId('fa')
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <GoldStops />
        </linearGradient>
      </defs>
      <path d="M14 22 C6 46 38 62 84 52" fill="none" stroke={`url(#${g})`} strokeWidth={13} strokeLinecap="round" />
      <path d="M78 34 L112 50 L80 68 Z" fill={`url(#${g})`} stroke="#C98110" strokeWidth={1} strokeLinejoin="round" />
      <path d="M18 26 C14 40 34 52 70 50" fill="none" stroke="#FFF3C4" strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

/* ---------------------------------- الكأس ---------------------------------- */

export function TrophyArt({ className }: { className?: string }) {
  const gold = useSvgId('tg')
  const cup = useSvgId('tc')
  return (
    <svg viewBox="0 0 240 150" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <GoldStops />
        </linearGradient>
        <linearGradient id={cup} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFD46A" />
          <stop offset="0.45" stopColor="#FFE9A6" />
          <stop offset="0.6" stopColor="#F5BE45" />
          <stop offset="1" stopColor="#D88C14" />
        </linearGradient>
      </defs>
      <Laurel cx={120} cy={72} r={86} from={118} to={218} count={8} size={1.3} gradient={gold} />
      <g transform="translate(240 0) scale(-1 1)">
        <Laurel cx={120} cy={72} r={86} from={118} to={218} count={8} size={1.3} gradient={gold} />
      </g>
      <g stroke="#C98110" strokeWidth={1}>
        <path d="M84 30 H66 C58 30 56 38 60 46 C65 57 76 63 88 64" fill="none" stroke={`url(#${gold})`} strokeWidth={8} strokeLinecap="round" />
        <path d="M156 30 H174 C182 30 184 38 180 46 C175 57 164 63 152 64" fill="none" stroke={`url(#${gold})`} strokeWidth={8} strokeLinecap="round" />
        <path d="M82 18 H158 V40 C158 72 140 90 120 92 C100 90 82 72 82 40 Z" fill={`url(#${cup})`} />
        <rect x="113" y="91" width="14" height="16" fill={`url(#${gold})`} />
        <path d="M96 107 H144 L149 121 H91 Z" fill={`url(#${cup})`} />
        <rect x="86" y="121" width="68" height="11" rx="2" fill={`url(#${gold})`} />
      </g>
      <path d="M120 36 L125.3 47 L137 48.5 L128.4 56.6 L130.6 68.3 L120 62.6 L109.4 68.3 L111.6 56.6 L103 48.5 L114.7 47 Z" fill="#FFF0B8" stroke="#D99A1F" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M90 24 C90 50 98 70 110 82" fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={5} strokeLinecap="round" />
    </svg>
  )
}

/** كأس صغيرة للبلاطة الأولى والنقاط */
export function TrophyGlyph({ className }: { className?: string }) {
  const gold = useSvgId('tgl')
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <GoldStops />
        </linearGradient>
      </defs>
      <path d="M9 6 H5 C3.6 6 3.2 7.6 3.8 9 C5 12 7.4 13.6 10 14 M23 6 H27 C28.4 6 28.8 7.6 28.2 9 C27 12 24.6 13.6 22 14" fill="none" stroke={`url(#${gold})`} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M8 4 H24 V9 C24 15.5 20.5 19 16 19.5 C11.5 19 8 15.5 8 9 Z" fill={`url(#${gold})`} stroke="#C98110" strokeWidth={0.7} />
      <rect x="14.2" y="19" width="3.6" height="4" fill="#E2A12C" />
      <path d="M10.5 23 H21.5 L22.6 26.5 H9.4 Z" fill={`url(#${gold})`} stroke="#C98110" strokeWidth={0.6} />
      <rect x="8.5" y="26.5" width="15" height="2.6" rx="0.8" fill="#D88C14" />
    </svg>
  )
}

/* -------------------------------- العملات --------------------------------- */

export function CoinsArt({ className }: { className?: string }) {
  const gold = useSvgId('cg')
  const coin = (cx: number, cy: number) => (
    <g key={`${cx}-${cy}`}>
      <path d={`M${cx - 11} ${cy} v5 a11 4.4 0 0 0 22 0 v-5`} fill="#D88C14" />
      <ellipse cx={cx} cy={cy} rx={11} ry={4.4} fill={`url(#${gold})`} stroke="#C98110" strokeWidth={0.6} />
    </g>
  )
  return (
    <svg viewBox="0 0 44 36" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <GoldStops />
        </linearGradient>
      </defs>
      {coin(28, 26)}
      {coin(28, 20)}
      {coin(14, 27)}
      {coin(14, 21)}
      {coin(14, 15)}
      {coin(22, 9)}
    </svg>
  )
}

/** عملة صغيرة بجانب رقم النقاط */
export function CoinDot({ className }: { className?: string }) {
  const gold = useSvgId('cd')
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <GoldStops />
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="7" fill={`url(#${gold})`} stroke="#C98110" strokeWidth={0.8} />
      <circle cx="8" cy="8" r="4.2" fill="none" stroke="#FFF1C2" strokeOpacity={0.8} strokeWidth={1} />
    </svg>
  )
}

/* --------------------------- شارات الصح والخطأ --------------------------- */

export function ResultBadge({ ok, className }: { ok: boolean; className?: string }) {
  const g = useSvgId('rb')
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          {ok ? (
            <>
              <stop offset="0" stopColor="#47D16C" />
              <stop offset="1" stopColor="#1C9A43" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#F27272" />
              <stop offset="1" stopColor="#CF3B3B" />
            </>
          )}
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="26" fill={`url(#${g})`} stroke="#FFFFFF" strokeWidth={3} />
      {ok ? <path d="M16 29 L24.5 37.5 L40.5 20.5" fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" /> : <path d="M19 19 L37 37 M37 19 L19 37" fill="none" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />}
    </svg>
  )
}

/* ------------------------- أيقونة لسان بطاقة السؤال ------------------------- */

export function BookTabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 36" className={className} aria-hidden focusable="false">
      <path d="M24 7 C18 3 10 2 3 3 V29 C10 28 18 29 24 33 C30 29 38 28 45 29 V3 C38 2 30 3 24 7 Z" fill="#E3ECFD" stroke="#1457C5" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M24 7 V33" stroke="#1457C5" strokeWidth={2.2} />
      <g stroke="#1457C5" strokeWidth={2} strokeLinecap="round">
        <path d="M8 10 C12 9.6 16 10 20 11.6 M8 15.5 C12 15.1 16 15.5 20 17.1 M8 21 C12 20.6 16 21 20 22.6" />
        <path d="M28 11.6 C32 10 36 9.6 40 10 M28 17.1 C32 15.5 36 15.1 40 15.5 M28 22.6 C32 21 36 20.6 40 21" />
      </g>
    </svg>
  )
}

/* --------------------------- أيقونات الشاشة الأولى --------------------------- */

export function GamepadArt({ className }: { className?: string }) {
  const g = useSvgId('gp')
  return (
    <svg viewBox="0 0 64 44" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A8BF0" />
          <stop offset="1" stopColor="#1457C5" />
        </linearGradient>
      </defs>
      <path d="M17 4 H47 C56 4 61 12 62.5 24 C64 36 60 42 54 42 C49 42 46.5 37 43 33 H21 C17.5 37 15 42 10 42 C4 42 0 36 1.5 24 C3 12 8 4 17 4 Z" fill={`url(#${g})`} />
      <path d="M17 4 H47 C52 4 55.5 6.5 58 10.5" fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M14 18 H18 V14 H22 V18 H26 V22 H22 V26 H18 V22 H14 Z" fill="#FFFFFF" />
      <circle cx="44" cy="15.5" r="3" fill="#FFD25E" />
      <circle cx="50.5" cy="21" r="3" fill="#FFFFFF" />
      <circle cx="44" cy="26.5" r="3" fill="#FFFFFF" />
      <circle cx="37.5" cy="21" r="3" fill="#FFFFFF" />
    </svg>
  )
}

export function CapArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden focusable="false">
      <path d="M10 15 V22 C10 25 15 27.5 20 27.5 C25 27.5 30 25 30 22 V15" fill="#0F4AAE" />
      <path d="M20 4 L38 12 L20 20 L2 12 Z" fill="#1F6BE0" stroke="#0F4AAE" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M20 4 L38 12 L20 14.5 L2 12 Z" fill="#4B8DF2" />
      <path d="M33 14 V24" stroke="#E2A12C" strokeWidth={1.6} />
      <circle cx="33" cy="25.5" r="2" fill="#F2B94B" />
    </svg>
  )
}

export function BooksArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 32" className={className} aria-hidden focusable="false">
      <rect x="4" y="21" width="32" height="8" rx="2.5" fill="#1457C5" />
      <rect x="8" y="22.6" width="25" height="2.2" rx="1" fill="#DCE7FB" />
      <rect x="6" y="12.5" width="30" height="8" rx="2.5" fill="#3E80EA" />
      <rect x="9" y="14.1" width="24" height="2.2" rx="1" fill="#EEF3FD" />
      <rect x="4" y="4" width="32" height="8" rx="2.5" fill="#8FAAFF" />
      <rect x="7" y="5.6" width="26" height="2.2" rx="1" fill="#FFFFFF" />
    </svg>
  )
}

export function LessonDocArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 36" className={className} aria-hidden focusable="false">
      <rect x="3" y="2" width="22" height="30" rx="3.5" fill="#1F6BE0" />
      <g stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round">
        <path d="M8 9 H20 M8 14.5 H20 M8 20 H15" />
      </g>
      <path d="M26 10 L30 12 V31 C30 33 28.5 34 27 34 H11" fill="none" stroke="#8FAAFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 36" className={className} aria-hidden focusable="false">
      <rect x="3" y="20" width="10" height="13" rx="2" fill="#3E80EA" />
      <rect x="15" y="11" width="10" height="22" rx="2" fill="#1457C5" />
      <rect x="27" y="16" width="10" height="17" rx="2" fill="#3E80EA" />
      <circle cx="8" cy="15" r="3" fill="#8FAAFF" />
      <circle cx="20" cy="5.5" r="3" fill="#8FAAFF" />
      <circle cx="32" cy="10.5" r="3" fill="#8FAAFF" />
    </svg>
  )
}

export function GearArt({ className }: { className?: string }) {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45)
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden focusable="false">
      <g fill="#1457C5">
        {teeth.map((a) => (
          <rect key={a} x="16.5" y="1.5" width="7" height="9" rx="1.6" transform={`rotate(${a} 20 20)`} />
        ))}
        <circle cx="20" cy="20" r="13" />
      </g>
      <circle cx="20" cy="20" r="5.5" fill="#FFFFFF" />
    </svg>
  )
}

/** يد اللمس مع إشارات النقر تحت البطاقة المغلقة */
export function TapHandArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 56" className={cn('text-[hsl(var(--primary))]', className)} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d="M15 9 L12.5 4.5 M21 7 V2 M27 9 L29.5 4.5" strokeWidth={2.2} />
      <path d="M17 33 V14.5 a3.5 3.5 0 0 1 7 0 V30" />
      <path d="M24 26 v-2 a3.5 3.5 0 0 1 7 0 v4" />
      <path d="M31 27 a3.5 3.5 0 0 1 7 0 v3" />
      <path d="M38 29 a3.5 3.5 0 0 1 7 0 v7 c0 9.5 -6.5 16 -15 16 h-3 c-5 0 -8 -1.6 -10.8 -4.4 l-7.4 -7.6 a3.6 3.6 0 0 1 5.1 -5.1 L17 33" />
    </svg>
  )
}
