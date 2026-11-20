import { ExternalLink, Megaphone } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createLandingAction } from '@/server/actions/landing.actions'

/** بطاقة «صفحة الهبوط» في صفحة الدورة: زر الإنشاء، ثم روابط التعديل والمعاينة */
export function CourseLandingCard({ courseId, landings }: { courseId: string; landings: { id: string; slug: string; active: boolean }[] }) {
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary" aria-hidden /> صفحة الهبوط
          </CardTitle>
          <CardDescription>صفحة عامة لهذه الدورة تنشرها في إنستغرام ويوتيوب وفيسبوك، برابط لكل منصة.</CardDescription>
        </div>
        <form action={createLandingAction}>
          <input type="hidden" name="courseId" value={courseId} />
          <Button type="submit" variant={landings.length ? 'outline' : 'default'}>
            {landings.length ? 'صفحة أخرى' : 'إنشاء صفحة هبوط'}
          </Button>
        </form>
      </CardHeader>
      {landings.length ? (
        <CardContent>
          <ul className="divide-y rounded-lg border text-sm">
            {landings.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-semibold" dir="ltr">/go/{l.slug}</span>
                  <Badge variant={l.active ? 'success' : 'muted'}>{l.active ? 'مشغّلة' : 'متوقفة'}</Badge>
                </span>
                <span className="flex gap-2">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/go/${l.slug}?preview=1`} target="_blank">
                      <ExternalLink className="size-4" aria-hidden /> معاينة
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/landing/${l.id}`}>تعديل ونتائج</Link>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  )
}
