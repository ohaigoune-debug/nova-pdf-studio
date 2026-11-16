import { HubTabs } from '@/components/student/hub-tabs'
import { ArrowLeft, BookOpen, FileText, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import { ScopePicker } from '@/components/academy/scope-picker'
import { TeacherBanner } from '@/components/domain/teacher-banner'
import { ChooseScopeCard, StudentScopeLine } from '@/components/student/student-scope-ui'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/misc'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getAboutSettings } from '@/server/services/about.service'
import { browseOptions, listStudentLessonsOrganized } from '@/server/services/academy-catalog.service'
import { levelStreamOptions, studentScope } from '@/server/services/student-scope.service'

export const dynamic = 'force-dynamic'

type Q = { subject?: string }
const TERM_AR: Record<number, string> = { 1: 'الفصل الأول', 2: 'الفصل الثاني', 3: 'الفصل الثالث' }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * /student/lessons — «دروسي»: دروس مستوى التلميذ وشعبته من حسابه (والمشتركة بين شعب مستواه)، مرتّبة بترتيب
 * المنهاج (وحدة ← درس)، ثم «دروس أخرى» للمحتوى القديم غير المصنّف. لا مرشّح للمستوى ولا للشعبة هنا
 * (قرار المالك 15 نوفمبر 2026): يغيّرهما التلميذ من «حسابي»، ومن لا مستوى له يختاره مرة واحدة.
 * ?level= و?stream= القديمان يُتجاهلان؛ والخادم يمنع فتح درس خارج النطاق بتغيير الرابط.
 */
export default async function StudentLessonsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('STUDENT')
  const sp = await searchParams
  const db = await getDb()
  const [own, about] = await Promise.all([studentScope(db, actor.studentId!), getAboutSettings(db)])
  const header = (
    <>
      <HubTabs hub="courses" />
      <TeacherBanner about={about} greeting={t('nav.myLessons')} subtitle="دروسك وملفات PDF، بترتيب الوحدات والدروس." />
    </>
  )
  if (!own.complete) {
    const options = await levelStreamOptions(db)
    return (
      <div className="space-y-6">
        {header}
        <ChooseScopeCard options={options} levelId={own.levelId} streamId={own.streamId} />
      </div>
    )
  }
  const scope = { levelId: own.levelId, streamId: own.streamId, subjectId: sp.subject && UUID.test(sp.subject) ? sp.subject : null }
  // القائمة تطبّق نطاق الحساب على الدروس العامة بنفسها؛ الموجَّه للتلميذ (دوراته) يبقى ظاهرًا أيًّا كان تصنيفه
  const [sections, options] = await Promise.all([listStudentLessonsOrganized(db, actor, { subjectId: scope.subjectId }), browseOptions(db, scope)])
  const total = sections.reduce((n, s) => n + s.lessons.length, 0)
  return (
    <div className="space-y-6">
      {header}
      <div className="space-y-3">
        <StudentScopeLine label={own.label!} />
        <ScopePicker base="/student/lessons" value={scope} options={options} subjectsOnly />
      </div>
      {total === 0 ? (
        <EmptyState icon={BookOpen} title="لا دروس منشورة لمستواك وشعبتك بعد" description={scope.subjectId ? 'جرّب «كل المواد». تُنشر الدروس تباعاً.' : 'تُنشر الدروس تباعاً.'} />
      ) : (
        sections.map((sec) => (
          <section key={sec.nodeId ?? 'unclassified'} className="space-y-2">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-bold">
              {sec.title}
              {sec.term ? <Badge variant="muted">{TERM_AR[sec.term]}</Badge> : null}
              <span className="text-xs font-normal text-muted-foreground">({sec.lessons.length})</span>
            </h2>
            <ul className="divide-y rounded-lg border bg-card">
              {sec.lessons.map((c) => (
                <li key={c.id}>
                  <Link href={c.href} className="flex items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/60">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{c.type === 'VIDEO' ? <PlayCircle className="size-4" /> : <FileText className="size-4" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {tEnum('contentTypes', c.type)}
                        {c.publishedAt ? ` · ${formatDate(c.publishedAt)}` : ''}
                      </span>
                    </span>
                    <ArrowLeft className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
