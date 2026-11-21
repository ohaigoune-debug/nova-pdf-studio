import { iconByName } from '@/components/icon-registry'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface RoleTile {
  href: string
  label: string
  /** سطر قصير تحت العنوان */
  hint?: string
  /** اسم أيقونة lucide (PascalCase) كما في القائمة الجانبية */
  iconKey: string
  /** عدد يحتاج انتباهًا (طلبات جديدة مثلًا)؛ يظهر شارةً ليمونية */
  badge?: number
}

function TileIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = iconByName(name)
  return Cmp ? <Cmp className={className} aria-hidden /> : <span className={className} aria-hidden />
}

/**
 * أوامر لوحة المشرف بهوية مدرسة الفاخرة (طلب المالك 21 نوفمبر 2026): مساحة كحلية بزخرفة ذهبية خافتة
 * وخط ذهبي سفلي، ومربعات زجاجية بإطار ذهبي رقيق يتوهّج عند اللمس. الأيقونة الأولى ذهبية ممتلئة (الأمر الرئيسي)،
 * والبقية ذهبية على كحلي. روابط عادية: الصلاحية تبقى في كل صفحة.
 */
export function RoleTiles({ title, tiles, more }: { title?: string; tiles: RoleTile[]; more?: RoleTile[] }) {
  return (
    <section
      className="relative isolate overflow-hidden rounded-[24px] border-b-[3px] border-[#C29B45] bg-gradient-to-br from-[#1C3A63] via-[#14305A] to-[#0F2544] p-4 shadow-lift sm:p-6"
      aria-label={title ?? 'الأوامر'}
    >
      {/* زخرفة ذهبية خافتة وتوهّج في الزاوية */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[url('/brand/bg/tile.png')] bg-[length:220px] opacity-[0.07]" />
      <span aria-hidden className="pointer-events-none absolute -top-24 start-1/2 -z-10 size-72 rounded-full bg-[#C29B45]/20 blur-3xl" />
      <div className="mb-4 flex items-center gap-3">
        <h2 className="font-heading text-sm font-bold tracking-wide text-[#E6CF95]">{title ?? 'الأوامر السريعة'}</h2>
        <span aria-hidden className="h-px flex-1 bg-gradient-to-l from-[#C29B45]/60 to-transparent rtl:bg-gradient-to-r" />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <li key={tile.href + tile.label}>
            <Link
              href={tile.href}
              className="group relative flex h-full min-h-32 flex-col justify-between gap-4 rounded-2xl border border-[#C29B45]/25 bg-white/[0.04] p-4 text-[#FFFDF7] shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C29B45]/70 hover:bg-white/[0.08] hover:shadow-[0_12px_30px_-12px_rgba(194,155,69,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6CF95]"
            >
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
                  i === 0
                    ? 'bg-gradient-to-br from-[#F3DFA6] via-[#E6CF95] to-[#C29B45] text-[#0F2544] shadow-[0_6px_18px_-6px_rgba(194,155,69,.8)]'
                    : 'bg-[#C29B45]/[0.14] text-[#E6CF95] ring-1 ring-inset ring-[#C29B45]/35'
                )}
              >
                <TileIcon name={tile.iconKey} className="size-[22px]" />
              </span>
              <span className="space-y-1">
                <span className="block font-heading text-[17px] font-bold leading-snug">{tile.label}</span>
                {tile.hint ? <span className="block text-xs leading-relaxed text-[#F5EEDF]/65">{tile.hint}</span> : null}
              </span>
              {tile.badge ? (
                <span className="absolute end-3 top-3 min-w-7 rounded-full bg-[#E6CF95] px-2 py-0.5 text-center text-xs font-extrabold text-[#0F2544] shadow tabular">
                  {tile.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {more?.length ? (
        <ul className="mt-5 grid grid-cols-2 gap-2 border-t border-dashed border-[#C29B45]/30 pt-4 sm:grid-cols-3 lg:grid-cols-5">
          {more.map((tile) => (
            <li key={tile.href + tile.label}>
              <Link
                href={tile.href}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#FFFDF7]/90 transition-colors hover:bg-[#C29B45]/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6CF95]"
              >
                <TileIcon name={tile.iconKey} className="size-4 shrink-0 text-[#E6CF95]" />
                <span className="min-w-0 leading-snug">{tile.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
