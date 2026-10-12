import { Download, ExternalLink, FileCheck2, GraduationCap, Search } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import type { ResourceCard } from '@/server/services/library.service'

/** بطاقات موارد المكتبة (فروض، اختبارات، دروس…) — زرّ واحد يفتح الملف عندنا أو عند مصدره، والمصدر مذكور دائماً */
export function ResourceCards({ items }: { items: ResourceCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <Card key={it.id} className="flex flex-col">
          <CardContent className="flex flex-1 flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="default">{it.typeLabel}</Badge>
              {it.subjectName ? <Badge variant="outline">{it.subjectName}</Badge> : null}
              {it.levelName ? <Badge variant="muted">{it.levelName}</Badge> : null}
              {it.term ? <Badge variant="secondary">الفصل {it.term}</Badge> : null}
              {it.year ? <Badge variant="secondary">{it.year}</Badge> : null}
            </div>
            <p className="font-bold leading-snug" dir="auto">
              {it.title}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              {it.official ? (
                <Badge variant="success">
                  <FileCheck2 className="size-3" /> رسمي
                </Badge>
              ) : null}
              {it.hasSolution ? <Badge variant="success">مع الحلّ</Badge> : null}
              {it.groupOnly ? <Badge variant="warning">لفوجك فقط</Badge> : null}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {it.href !== '#' ? (
                <Button asChild size="sm">
                  {it.external ? (
                    <a href={it.href} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4" /> فتح
                    </a>
                  ) : (
                    <a href={it.href} target="_blank" rel="noopener">
                      <Download className="size-4" /> فتح / تحميل
                    </a>
                  )}
                </Button>
              ) : null}
              {it.hasSolution ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`/library/r/${it.id}?part=solution`} target="_blank" rel="noopener">
                    الحلّ
                  </a>
                </Button>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {it.author ? (
                <>
                  من إنشاء: <span className="font-semibold text-foreground">{it.author}</span> ·{' '}
                </>
              ) : null}
              المصدر: {it.source}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** شريط المرشّحات المشترك: المستوى (من «مستواك» أعلى الموقع) + المادة + بحث */
export function LevelSubjectBar({ action, levelLabel, subjects, subjectId, q, hidden = {}, placeholder = 'ابحث بالعنوان…' }: { action: string; levelLabel: string | null; subjects: { id: string; name: string }[]; subjectId: string | null; q?: string | null; hidden?: Record<string, string | undefined>; placeholder?: string }) {
  return (
    <form action={action} className="mb-5 space-y-2 rounded-xl border bg-card p-3">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
        <Select name="subject" defaultValue={subjectId ?? ''} aria-label="المادة">
          <option value="">كل المواد</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ''} placeholder={placeholder} className="ps-9" dir="auto" />
        </div>
        <Button type="submit" variant="outline">
          تصفية
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <GraduationCap className="me-1 inline size-4 align-text-bottom text-primary" />
        {levelLabel ? (
          <>
            المستوى: <span className="font-bold text-foreground">{levelLabel}</span> — غيّره من «مستواك» أعلى الصفحة، أو{' '}
            <Link href={`${action}?level=all`} className="text-primary underline">
              اعرض كل المستويات
            </Link>
          </>
        ) : (
          <>اختر مستواك من أعلى الصفحة (4 متوسط، 1 ثانوي…) لترى ما يناسبك فقط.</>
        )}
      </p>
    </form>
  )
}
