/* eslint-disable @next/next/no-img-element -- صور يوتيوب المصغّرة الخارجية */
import { ArrowRight, BookOpen, PlayCircle, Search, Tv } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import type { Db } from '@/server/db/connect'
import { AppError } from '@/server/lib/errors'
import { listDirectoryVideos } from '@/server/services/educators.service'
import { listLessonVideos, listVideoLessons, videoSubjects } from '@/server/services/video-lessons.service'

export type VideoHubQuery = { tab?: string; subject?: string; lesson?: string; educator?: string; q?: string; level?: string }

const chip = (active: boolean) => cn('rounded-full border px-3 py-1.5 text-sm transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')

function VideoCard({ href, title, thumbnail, meta }: { href: string; title: string; thumbnail: string | null; meta?: string | null }) {
  return (
    <li className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <Link href={href} className="block">
        <div className="relative bg-black" style={{ aspectRatio: '16 / 9' }}>
          {thumbnail ? <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : null}
          <PlayCircle className="absolute inset-0 m-auto size-12 text-white/90 drop-shadow transition-transform group-hover:scale-110" />
        </div>
        <div className="space-y-1 p-3">
          <p className="line-clamp-2 font-semibold" dir="auto">
            {title}
          </p>
          {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      </Link>
    </li>
  )
}

/**
 * «الفيديوهات والقنوات»: افتراضياً بالدرس — كل من شرح «الدوال» أو «إعراب البدل» في بطاقة واحدة (ترتيب الذكاء الاصطناعي)،
 * والقنوات خيار ثانٍ. الكل بحسب مستوى الزائر (الفيديو بلا مستوى يظهر للجميع).
 */
export async function VideoHub({ db, basePath, q, levelId }: { db: Db; basePath: string; q: VideoHubQuery; levelId: string | null }) {
  const tab = q.tab === 'channels' ? 'channels' : 'lessons'
  const href = (patch: Partial<VideoHubQuery>) => {
    const p = new URLSearchParams(Object.entries({ ...q, ...patch }).filter((e): e is [string, string] => Boolean(e[1])))
    const s = p.toString()
    return s ? `${basePath}?${s}` : basePath
  }
  const subjectsList = await videoSubjects(db, levelId)
  if (subjectsList.length === 0) {
    return <EmptyState icon={PlayCircle} title="لا فيديوهات بعد" description="يعتمد المشرف قنوات الأساتذة من «دليل الأساتذة»، فتظهر فيديوهاتهم هنا مرتّبة بالدرس وبالقناة." />
  }

  return (
    <div className="space-y-6">
      <nav className="flex gap-2 border-b pb-3" aria-label="طريقة العرض">
        <Link href={href({ tab: undefined, educator: undefined })} className={cn(chip(tab === 'lessons'), 'flex items-center gap-1.5')}>
          <BookOpen className="size-4" /> حسب الدرس
        </Link>
        <Link href={href({ tab: 'channels', lesson: undefined })} className={cn(chip(tab === 'channels'), 'flex items-center gap-1.5')}>
          <Tv className="size-4" /> حسب القناة
        </Link>
      </nav>

      <div className="flex flex-wrap gap-2">
        <Link href={href({ subject: undefined, lesson: undefined, educator: undefined })} className={chip(!q.subject)}>
          كل المواد
        </Link>
        {subjectsList.map((s) => (
          <Link key={s.slug} href={href({ subject: s.slug, lesson: undefined, educator: undefined })} className={chip(q.subject === s.slug)}>
            {s.name} <span className="opacity-60">({s.n})</span>
          </Link>
        ))}
      </div>

      {tab === 'lessons' ? <LessonsView db={db} basePath={basePath} q={q} levelId={levelId} href={href} /> : <ChannelsView db={db} basePath={basePath} q={q} levelId={levelId} href={href} />}

      <p className="text-xs text-muted-foreground">الفيديوهات تُعرض من يوتيوب مباشرة وتبقى ملكاً لأصحاب قنواتها؛ المصدر مذكور تحت كل فيديو.</p>
    </div>
  )
}

async function LessonsView({ db, basePath, q, levelId, href }: { db: Db; basePath: string; q: VideoHubQuery; levelId: string | null; href: (p: Partial<VideoHubQuery>) => string }) {
  if (q.lesson && q.subject) {
    let lesson
    try {
      lesson = await listLessonVideos(db, { subjectSlug: q.subject, lessonKey: q.lesson, levelId })
    } catch (e) {
      if (!(e instanceof AppError)) throw e
      lesson = null
    }
    if (!lesson) return <EmptyState icon={BookOpen} title="لا شروح لهذا الدرس في مستواك" action={<Button asChild variant="outline"><Link href={href({ lesson: undefined })}>كل الدروس</Link></Button>} />
    return (
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-1 -ms-2">
              <Link href={href({ lesson: undefined })}>
                <ArrowRight className="size-4" /> كل الدروس
              </Link>
            </Button>
            <h2 className="text-2xl font-extrabold">{lesson.title}</h2>
            <p className="text-sm text-muted-foreground">
              {lesson.subject.name} — {lesson.total} شرحاً من {lesson.channels.length} {lesson.channels.length === 1 ? 'قناة' : 'قنوات'}
            </p>
          </div>
        </div>
        {lesson.channels.map((c) => (
          <div key={c.id}>
            <h3 className="mb-2 flex items-center gap-2 font-bold">
              {c.thumbnail ? <img src={c.thumbnail} alt="" className="size-6 rounded-full" /> : <Tv className="size-5 text-muted-foreground" />}
              {c.name} <Badge variant="muted">{c.videos.length}</Badge>
            </h3>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.videos.map((v) => (
                <VideoCard key={v.id} href={`${basePath}/${v.id}`} title={v.title} thumbnail={v.thumbnail} meta={v.level} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    )
  }

  const { lessons, unsorted } = await listVideoLessons(db, { subjectSlug: q.subject ?? null, levelId, q: q.q ?? null })
  return (
    <section className="space-y-4">
      <form action={basePath} className="flex gap-2">
        {q.subject ? <input type="hidden" name="subject" value={q.subject} /> : null}
        {q.level ? <input type="hidden" name="level" value={q.level} /> : null}
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q.q ?? ''} placeholder="ابحث عن درس: الدوال، إعراب البدل، الصور البيانية…" className="ps-9" dir="auto" />
        </div>
        <Button type="submit" variant="outline">
          بحث
        </Button>
      </form>
      {lessons.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={q.q ? 'لا درس بهذا الاسم بعد' : 'لم تُرتَّب الفيديوهات بالدرس بعد'}
          description={q.q ? 'جرّب اسماً آخر للدرس، أو تصفّح القنوات.' : 'يرتّبها الذكاء الاصطناعي بعد مزامنة القنوات؛ تصفّح القنوات في الأثناء.'}
          action={
            <Button asChild variant="outline">
              <Link href={href({ tab: 'channels', q: undefined })}>تصفّح حسب القناة</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => (
            <li key={`${l.subject.slug}-${l.key}`} className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
              <Link href={href({ subject: l.subject.slug, lesson: l.key, q: undefined })} className="flex h-full flex-col">
                <div className="relative bg-black" style={{ aspectRatio: '16 / 7' }}>
                  {l.thumbnail ? <img src={l.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" loading="lazy" /> : null}
                  <span className="absolute bottom-2 start-2 rounded-full bg-black/70 px-2.5 py-1 text-xs font-bold text-white">{l.videos} شرحاً</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="font-bold leading-snug" dir="auto">
                    {l.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.subject.name}
                    {l.levels.length ? ` · ${l.levels.join('، ')}` : ''}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    {l.channels.slice(0, 4).map((c) => (
                      <span key={c.id} className="flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]">
                        {c.thumbnail ? <img src={c.thumbnail} alt="" className="size-4 rounded-full" /> : null}
                        {c.name}
                      </span>
                    ))}
                    {l.channels.length > 4 ? <span className="text-[11px] text-muted-foreground">+{l.channels.length - 4}</span> : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {unsorted && lessons.length ? (
        <p className="text-xs text-muted-foreground">
          {unsorted} فيديو لم يُنسب إلى درس بعد —{' '}
          <Link href={href({ tab: 'channels', q: undefined })} className="text-primary underline">
            تصفّحها حسب القناة
          </Link>
        </p>
      ) : null}
    </section>
  )
}

async function ChannelsView({ db, basePath, q, levelId, href }: { db: Db; basePath: string; q: VideoHubQuery; levelId: string | null; href: (p: Partial<VideoHubQuery>) => string }) {
  const data = await listDirectoryVideos(db, { subject: q.subject ?? null, educator: q.educator ?? null, levelId })
  return (
    <section className="space-y-4">
      {data.educators.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <Link href={href({ educator: undefined })} className={chip(!q.educator)}>
            كل القنوات
          </Link>
          {data.educators.map((e) => (
            <Link key={e.id} href={href({ educator: e.id })} className={cn(chip(q.educator === e.id), 'flex items-center gap-1.5')}>
              {e.thumbnail ? <img src={e.thumbnail} alt="" className="size-5 rounded-full" /> : null}
              {e.name} <span className="opacity-60">({e.n})</span>
            </Link>
          ))}
        </div>
      ) : null}
      {data.videos.length === 0 ? (
        <EmptyState icon={PlayCircle} title="لا فيديوهات تطابق الاختيار" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.videos.map((v) => (
            <VideoCard key={v.id} href={`${basePath}/${v.id}`} title={v.title} thumbnail={v.thumbnail} meta={[v.educator?.name, v.level?.nameAr, v.topic].filter(Boolean).join(' · ')} />
          ))}
        </ul>
      )}
    </section>
  )
}
