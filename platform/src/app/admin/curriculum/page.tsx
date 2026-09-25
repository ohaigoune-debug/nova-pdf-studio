import Link from 'next/link'
import { CurriculumTree } from '@/components/domain/curriculum-tree'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { resourceStats } from '@/server/services/resources.service'
import { getTaxonomy, listNodes, subjectsFor } from '@/server/services/taxonomy.service'
import { BookOpen, FileCheck2, Layers, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

type Q = { level?: string; stream?: string; subject?: string }

const TYPE_AR: Record<string, string> = { LESSON: 'دروس', SUMMARY: 'ملخصات', EXERCISE: 'تمارين', HOMEWORK: 'فروض', TEST: 'اختبارات', EXAM: 'امتحانات رسمية', SOLUTION: 'حلول', VIDEO: 'فيديوهات', PEDAGOGICAL: 'وثائق بيداغوجية', OTHER: 'أخرى' }

export default async function CurriculumAdminPage({ searchParams }: { searchParams: Promise<Q> }) {
  await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const q = await searchParams
  const [tax, stats] = await Promise.all([getTaxonomy(db), resourceStats(db)])
  const allLevels = tax.stages.flatMap((s) => s.levels)
  const level = allLevels.find((l) => l.id === q.level) ?? null
  const stream = level?.streams.find((s) => s.id === q.stream) ?? null
  const offered = level ? await subjectsFor(db, level.id, stream?.id) : []
  const subject = offered.find((s) => s.id === q.subject) ?? null
  const nodes = level && subject ? await listNodes(db, { subjectId: subject.id, levelId: level.id, streamId: stream?.id ?? null }) : []
  const link = (patch: Partial<Q>) => {
    const p = new URLSearchParams(Object.entries({ ...q, ...patch }).filter((e): e is [string, string] => !!e[1]))
    return `/admin/curriculum?${p.toString()}`
  }
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')

  return (
    <>
      <PageHeader title="المنهاج والمكتبة" description="تصنيف المنهاج الجزائري الذي تُربط به كل الموارد والأسئلة والفيديوهات: الطور ← الصف ← الشعبة ← المادة ← الوحدات والدروس." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="موارد المكتبة" value={stats.total} icon={Layers} />
        <StatCard label="امتحانات ووثائق رسمية" value={stats.official} icon={FileCheck2} tone="success" />
        <StatCard label="مولّدة بالذكاء الاصطناعي" value={stats.ai} icon={Sparkles} />
        <StatCard label="بلا مادة (تحتاج تصنيفاً)" value={stats.unclassified} icon={BookOpen} tone={stats.unclassified ? 'warning' : 'default'} />
      </div>
      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-4 p-4 text-sm">
          {stats.bySource.map((s) => (
            <span key={s.code}>
              <strong>{s.name}</strong>: {s.n}
            </span>
          ))}
          {stats.byType.map((t) => (
            <Badge key={t.type} variant="secondary">
              {TYPE_AR[t.type] ?? t.type}: {t.n}
            </Badge>
          ))}
          {stats.total === 0 ? <span className="text-muted-foreground">المكتبة فارغة بعد — يملؤها استيراد DzExams (المرحلة 2).</span> : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {tax.stages.map((s) => (
          <div key={s.id} className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground">
              {s.nameAr}
              {s.examCode ? ` · امتحان ${s.examCode}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {s.levels.map((l) => (
                <Link key={l.id} href={link({ level: l.id, stream: undefined, subject: undefined })} className={chip(level?.id === l.id)}>
                  {l.nameAr}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {level && level.streams.length ? (
          <div className="flex flex-wrap gap-2">
            {level.streams.map((st) => (
              <Link key={st.id} href={link({ stream: st.id, subject: undefined })} className={chip(stream?.id === st.id)}>
                {st.nameAr}
              </Link>
            ))}
          </div>
        ) : null}
        {level && (!level.streams.length || stream) ? (
          <div className="flex flex-wrap gap-2">
            {offered.map((su) => (
              <Link key={su.id} href={link({ subject: su.id })} className={chip(subject?.id === su.id)}>
                {su.nameAr}
                {su.isExamSubject ? ' ★' : ''}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {level && subject ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {subject.nameAr} — {level.nameAr}
              {stream ? ` — ${stream.nameAr}` : ''}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{stream ? 'ما تضيفه هنا خاص بهذه الشعبة (برنامج الرياضيات يختلف بين علوم تجريبية ورياضيات مثلاً). ' : ''}★ مادة امتحان وطني.</p>
          </CardHeader>
          <CardContent>
            <CurriculumTree nodes={nodes} scope={{ subjectId: subject.id, levelId: level.id, streamId: stream?.id ?? null }} />
          </CardContent>
        </Card>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">اختر الصف{level?.streams.length ? ' والشعبة' : ''} ثم المادة لتدير وحداتها ودروسها.</p>
      )}
    </>
  )
}
