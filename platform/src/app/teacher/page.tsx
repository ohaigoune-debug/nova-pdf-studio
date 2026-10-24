import { BookOpen, ClipboardList, MessagesSquare, Upload, Users, UsersRound, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/misc'
import { getDictionary, t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherDashboard } from '@/server/queries/teacher-dashboard.queries'

/** اسم الحدث بالعربية؛ حدث جديد بلا ترجمة يظهر بمفتاحه بدل أن يختفي */
function actionLabel(action: string): string {
  const labels = getDictionary().activity as Record<string, string | undefined>
  return labels[action.replace(/\./g, '_')] ?? action
}

/**
 * لوحة الأستاذ بلا حضور (قرار المالك 2026-10-24: الماسح والحصص الحضورية وبطاقات الحضور مخفية).
 * المسجّلون، والنشر، والقسم الافتراضي، وآخر النشاط.
 */
export default async function TeacherHomePage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const d = await teacherDashboard(db, actor)
  const actions = [
    { href: '/teacher/publish', label: 'نشر درس / ملف', icon: Upload },
    { href: '/teacher/publish?type=TEST', label: 'رفع اختبار', icon: ClipboardList },
    { href: '/teacher/content', label: 'المحتوى والحصص السابقة', icon: BookOpen },
    { href: '/teacher/classroom', label: 'القسم الافتراضي', icon: MessagesSquare },
    { href: '/teacher/exams/generate', label: 'ابنِ لي الامتحان', icon: Wand2 }
  ]
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t('dashboard.welcome', { name: actor.fullName })}</h1>
        <p className="text-sm text-muted-foreground">{t('dashboard.teacherTitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label={t('dashboard.groupsCount')} value={d.groupsCount} icon={UsersRound} />
        <StatCard label="المسجّلون" value={d.studentsCount} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickActions')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {actions.map((a) => (
            <Button key={a.href} asChild variant="outline" className="h-auto flex-col gap-1 py-3">
              <Link href={a.href}>
                <a.icon className="size-5" />
                <span className="text-xs">{a.label}</span>
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          {d.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {d.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                  <span>
                    <span className="font-semibold">{a.actorName ?? '—'}</span> {actionLabel(a.action)}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
