/* eslint-disable @next/next/no-img-element -- صور يوتيوب المصغّرة الخارجية */
import { PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { listDirectoryVideos } from '@/server/services/educators.service'

type Data = Awaited<ReturnType<typeof listDirectoryVideos>>

/** فيديوهات دليل الأساتذة: مرشّحات المادة والصف والأستاذ، وبطاقات تفتح المشغّل داخل المنصة */
export function VideoDirectory({ data, basePath, current }: { data: Data; basePath: string; current: { subject?: string; level?: string; educator?: string } }) {
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ...current, ...patch }).filter((e): e is [string, string] => !!e[1]))
    const s = q.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  const chip = (active: boolean) => cn('rounded-full border px-3 py-1.5 text-sm transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  if (data.subjects.length === 0) {
    return <EmptyState icon={PlayCircle} title="لا فيديوهات بعد" description="يعتمد المشرف قنوات الأساتذة من «دليل الأساتذة»، فتظهر فيديوهاتهم هنا مصنّفة بالمادة والصف." />
  }
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Link href={href({ subject: undefined, level: undefined, educator: undefined })} className={chip(!current.subject)}>
            كل المواد
          </Link>
          {data.subjects.map((s) => (
            <Link key={s.slug} href={href({ subject: s.slug, level: undefined, educator: undefined })} className={chip(current.subject === s.slug)}>
              {s.nameAr} <span className="opacity-60">({s.n})</span>
            </Link>
          ))}
        </div>
        {data.levels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Link href={href({ level: undefined })} className={chip(!current.level)}>
              كل الصفوف
            </Link>
            {data.levels.map((l) => (
              <Link key={l.slug} href={href({ level: l.slug })} className={chip(current.level === l.slug)}>
                {l.nameAr} <span className="opacity-60">({l.n})</span>
              </Link>
            ))}
          </div>
        ) : null}
        {data.educators.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <Link href={href({ educator: undefined })} className={chip(!current.educator)}>
              كل الأساتذة
            </Link>
            {data.educators.map((e) => (
              <Link key={e.id} href={href({ educator: e.id })} className={cn(chip(current.educator === e.id), 'flex items-center gap-1.5')}>
                {e.thumbnail ? <img src={e.thumbnail} alt="" className="size-5 rounded-full" /> : null}
                {e.name} <span className="opacity-60">({e.n})</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      {data.videos.length === 0 ? (
        <EmptyState icon={PlayCircle} title="لا فيديوهات تطابق الاختيار" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.videos.map((v) => (
            <li key={v.id} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
              <Link href={`${basePath}/${v.id}`} className="block">
                <div className="relative bg-black" style={{ aspectRatio: '16 / 9' }}>
                  {v.thumbnail ? <img src={v.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : null}
                  <PlayCircle className="absolute inset-0 m-auto size-12 text-white/90 drop-shadow transition-transform group-hover:scale-110" />
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 font-semibold" dir="auto">
                    {v.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.educator?.name}
                    {v.level?.nameAr ? ` · ${v.level.nameAr}` : ''}
                    {v.topic ? ` · ${v.topic}` : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">الفيديوهات تُعرض من يوتيوب مباشرة وتبقى ملكاً لأصحاب قنواتها؛ المصدر مذكور تحت كل فيديو.</p>
    </div>
  )
}
