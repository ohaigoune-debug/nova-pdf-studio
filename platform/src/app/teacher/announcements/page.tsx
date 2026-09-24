import { Megaphone } from 'lucide-react'
import { AnnouncementForm } from '@/components/domain/announcement-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherFormOptions } from '@/server/queries/teacher-form-options'
import { listAnnouncements } from '@/server/services/announcements.service'

export const dynamic = 'force-dynamic'

export default async function AnnouncementsPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [opts, sent] = await Promise.all([teacherFormOptions(db, actor), listAnnouncements(db, actor)])
  return (
    <>
      <PageHeader title="الإشعارات" description="رسالتك تصل تلاميذك فوراً: إشعاراً داخل المنصة والتطبيق، وعلى الهاتف لمن فعّل الإشعارات." />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>رسالة جديدة</CardTitle>
          </CardHeader>
          <CardContent>
            <AnnouncementForm groups={opts.groups} />
          </CardContent>
        </Card>
        <div className="space-y-3">
          <h2 className="text-lg font-extrabold">ما أرسلته</h2>
          {sent.length === 0 ? <EmptyState icon={Megaphone} title="لم ترسل رسائل بعد" /> : null}
          {sent.map((a) => (
            <div key={a.id} className="rounded-lg border bg-card p-4 shadow-soft">
              <p className="font-bold">{a.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {formatDateTime(a.createdAt)} · {a.groupIds.length ? a.groupNames.join('، ') : 'كل التلاميذ'} · وصلت {a.recipients} تلميذ
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
