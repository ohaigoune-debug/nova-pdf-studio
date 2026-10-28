import * as Icons from 'lucide-react'
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
  const Cmp = (Icons as unknown as Record<string, Icons.LucideIcon>)[name]
  return Cmp ? <Cmp className={className} aria-hidden /> : <span className={className} aria-hidden />
}

/**
 * أوامر الحساب في مربعات بهوية مدرسة: مساحة زرقاء (bg-ink) ومربعات زجاجية بيضاء الكتابة،
 * الأيقونة الأولى ليمونية كما في معاينة الصفحة الرئيسية. روابط عادية: الصلاحية تبقى في كل صفحة.
 */
export function RoleTiles({ title, tiles, more }: { title?: string; tiles: RoleTile[]; more?: RoleTile[] }) {
  return (
    <section className="bg-ink overflow-hidden rounded-xl p-4 shadow-lift sm:p-6" aria-label={title ?? 'الأوامر'}>
      {title ? <h2 className="mb-4 font-heading text-lg font-bold text-white">{title}</h2> : null}
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <li key={tile.href + tile.label}>
            <Link
              href={tile.href}
              className="glass group relative flex h-full min-h-28 flex-col justify-between gap-3 rounded-lg p-4 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span
                className={cn(
                  'flex size-11 items-center justify-center rounded-md',
                  i === 0 ? 'bg-gradient-to-br from-accent to-accent/70 text-accent-foreground' : 'bg-white/10 text-accent'
                )}
              >
                <TileIcon name={tile.iconKey} className="size-5" />
              </span>
              <span className="space-y-1">
                <span className="block font-bold leading-snug">{tile.label}</span>
                {tile.hint ? <span className="block text-xs leading-relaxed text-white/65">{tile.hint}</span> : null}
              </span>
              {tile.badge ? (
                <span className="absolute end-3 top-3 min-w-7 rounded-full bg-accent px-2 py-0.5 text-center text-xs font-bold text-accent-foreground tabular">
                  {tile.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {more?.length ? (
        <ul className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 sm:grid-cols-3 lg:grid-cols-5">
          {more.map((tile) => (
            <li key={tile.href + tile.label}>
              <Link
                href={tile.href}
                className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <TileIcon name={tile.iconKey} className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 leading-snug">{tile.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
