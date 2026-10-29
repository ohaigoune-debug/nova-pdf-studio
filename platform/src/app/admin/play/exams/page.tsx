import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { playExamSets } from '@/server/db/schema'
import { streamName } from '@/server/play/constants'
import { pointsFor, validateExamSet } from '@/server/play/exams/engine'

export const dynamic = 'force-dynamic'

const KIND = { BAC: 'بكالوريا', TEST: 'اختبار', DEVOIR: 'فرض' } as Record<string, string>

/** مراجعة المواضيع المحوّلة (قراءة فقط): الاعتماد يتمّ بأمر approve في المستودع ليبقى موثّقًا باسم المراجع */
export default async function AdminPlayExamsPage() {
  await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const rows = await db.select().from(playExamSets)
  rows.sort((a, b) => a.gradeCode.localeCompare(b.gradeCode) || a.kind.localeCompare(b.kind) || (a.term ?? 0) - (b.term ?? 0) || (b.year ?? 0) - (a.year ?? 0) || a.setId.localeCompare(b.setId))
  return (
    <>
      <PageHeader title="الفروض والاختبارات والبكالوريا — مراجعة" description="كل موضوع محوَّل من مصدره وتصحيحه. لا يراه التلاميذ قبل اعتمادك (npx tsx scripts/play/exams.ts approve <المعرّف> --by «الاسم»)." />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-start">الموضوع</th>
                <th className="p-3 text-start">النوع</th>
                <th className="p-3 text-start">المستوى / الشعب</th>
                <th className="p-3 text-start">الخطوات</th>
                <th className="p-3 text-start">النقاط</th>
                <th className="p-3 text-start">التدقيق</th>
                <th className="p-3 text-start">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = validateExamSet(r.document)
                const pts = pointsFor(r.document, null)
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">
                      <Link href={`/admin/play/exams/${r.setId}`} className="font-semibold text-primary hover:underline">
                        {r.title}
                      </Link>
                      <div className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                        {r.setId}
                      </div>
                    </td>
                    <td className="p-3">
                      {KIND[r.kind] ?? r.kind}
                      {r.kind === 'BAC' ? ` ${r.year ?? ''} · الموضوع ${r.paper ?? '—'}` : r.term ? ` · الفصل ${r.term}` : ''}
                    </td>
                    <td className="p-3">
                      {r.gradeCode} · {r.streamCodes.map(streamName).join('، ') || 'كل الشعب'}
                    </td>
                    <td className="p-3">{r.stepCount}</td>
                    <td className="p-3">
                      {pts.interactive} + {pts.deferred} مؤجلة
                    </td>
                    <td className="p-3">
                      <Badge variant={v.errors.length ? 'destructive' : 'secondary'}>
                        {v.errors.length} خطأ · {v.warnings.length} تنبيه
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={r.publishable ? 'default' : 'outline'}>{r.publishable ? 'معتمد ومنشور' : r.status}</Badge>
                    </td>
                  </tr>
                )
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    لا مواضيع مستوردة في هذه القاعدة.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  )
}
