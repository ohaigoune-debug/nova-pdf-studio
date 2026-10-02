'use client'

import { BookTemplate, Copy, Pencil, Star, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn, formatDate } from '@/lib/utils'
import { createFromTemplateAction, deleteExamAction, duplicateExamAction, setTemplateAction, updateExamAction } from '@/server/actions/exams.actions'
import { createFromStudioTemplateAction } from '@/server/actions/studio.actions'
import type { TemplateCard } from '@/server/services/exam-studio.service'

export interface MyTemplate {
  id: string
  title: string
  subjectName: string | null
  levelName: string | null
  streamName: string | null
  isFavorite: boolean
  isTemplate: boolean
  items: number
  totalPoints: string
  updatedAt: Date
}

const KIND_AR: Record<string, string> = { TEST: 'اختبار', HOMEWORK: 'فرض', BAC_MOCK: 'بكالوريا تجريبية', BEM_MOCK: 'BEM تجريبية', QUIZ: 'استجواب', PRACTICE: 'تدريب' }

/** معرض القوالب: قوالب Madrasadz الرسمية (كود) + قوالبي + المفضّلة؛ استعمال/نسخ/تعديل/حفظ كقالب/مفضّلة/حذف */
export function TemplatesGallery({ official, mine, favorites }: { official: TemplateCard[]; mine: MyTemplate[]; favorites: MyTemplate[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (fn: () => Promise<{ ok: boolean; error?: { message: string }; data?: { id: string } }>, ok: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) return toast('error', r.error!.message)
      toast('success', ok)
      if (r.data?.id) router.push(`/teacher/exams/${r.data.id}`)
      else router.refresh()
    })
  const Mine = ({ t }: { t: MyTemplate }) => (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold">{t.title}</p>
          <p className="text-xs text-muted-foreground">
            {[t.subjectName, t.levelName, t.streamName].filter(Boolean).join(' · ') || '—'} · {t.items} عنصر · {Number(t.totalPoints)} ن · {formatDate(t.updatedAt)}
          </p>
        </div>
        <button type="button" onClick={() => go(() => updateExamAction(t.id, { isFavorite: !t.isFavorite }), t.isFavorite ? 'أُزيل من المفضّلة' : 'أُضيف إلى المفضّلة')} className={cn('rounded p-1', t.isFavorite ? 'text-accent' : 'text-muted-foreground hover:text-accent')} title="مفضّلة" disabled={pending}>
          <Star className={cn('size-4', t.isFavorite ? 'fill-current' : '')} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {t.isTemplate ? (
          <Button size="sm" onClick={() => go(() => createFromTemplateAction(t.id), 'أُنشئ امتحان من القالب')} loading={pending}>
            <Wand2 className="size-4" /> استعمال
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => go(() => setTemplateAction(t.id, true), 'أصبح قالباً')} loading={pending}>
            <BookTemplate className="size-4" /> حفظ كقالب
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href={`/teacher/exams/${t.id}`}>
            <Pencil className="size-4" /> تعديل
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={() => go(() => duplicateExamAction(t.id), 'نُسخ')} loading={pending} title="نسخة قابلة للتعديل">
          <Copy className="size-4" />
        </Button>
        {t.isTemplate ? (
          <Button size="sm" variant="ghost" onClick={() => go(() => setTemplateAction(t.id, false), 'لم يعد قالباً')} loading={pending} title="إلغاء القالب (يبقى امتحاناً)">
            <BookTemplate className="size-4 text-muted-foreground" />
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={() => confirm('حذف هذا القالب؟') && go(() => deleteExamAction(t.id), 'حُذف')} loading={pending} title="حذف">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 text-lg font-bold">قوالب Madrasadz</h2>
        <p className="mb-3 text-sm text-muted-foreground">هياكل رسمية جاهزة: ترويسة وتخطيط وتمارين بنقاطها وأشكالها. «استعمال» ينشئ امتحاناً في ورشتك تعدّله كما تشاء (القالب نفسه لا يتغيّر).</p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {official.map((t) => (
            <li key={t.id} className={cn('flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm', t.matches ? 'border-primary/40' : 'opacity-80')}>
              <div>
                <p className="font-bold">{t.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              </div>
              <div className="flex flex-wrap gap-1 text-[11px]">
                <Badge variant="secondary">{KIND_AR[t.kind] ?? t.kind}</Badge>
                <Badge variant="muted">{t.durationMinutes} د</Badge>
                <Badge variant="muted">{t.exercises} تمارين · {t.blocks} عنصر</Badge>
                {t.matches ? <Badge variant="success">مادتك</Badge> : null}
              </div>
              <Button size="sm" className="mt-auto" onClick={() => go(() => createFromStudioTemplateAction(t.id), 'أُنشئ امتحان من القالب')} loading={pending}>
                <Wand2 className="size-4" /> استعمال
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">قوالبي ({mine.length})</h2>
        {mine.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">لا قوالب بعد. افتح أي امتحان واختر «قالب» في إعداداته، أو اضغط «حفظ كقالب» من المفضّلة.</p> : null}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((t) => (
            <Mine key={t.id} t={t} />
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">المفضّلة ({favorites.length})</h2>
        {favorites.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">علّم امتحاناً أو قالباً بالنجمة من المحرّر ليظهر هنا.</p> : null}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {favorites.map((t) => (
            <Mine key={t.id} t={t} />
          ))}
        </ul>
      </section>
    </div>
  )
}
