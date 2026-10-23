import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface ScopeOptions {
  levels: { id: string; code: string; name: string }[]
  streams: { id: string; code: string; name: string }[]
  subjects: { id: string; name: string }[]
}

export interface ScopeValue {
  levelId: string | null
  streamId: string | null
  subjectId: string | null
}

/** رابط الصفحة نفسها بمرشّحات معدّلة (الاختيار محفوظ في الرابط لا في ملف التلميذ) */
export function scopeHref(base: string, v: ScopeValue, patch: Partial<Record<'level' | 'stream' | 'subject', string | null>>) {
  const p = new URLSearchParams()
  const level = patch.level !== undefined ? patch.level : v.levelId
  const stream = patch.level !== undefined ? null : patch.stream !== undefined ? patch.stream : v.streamId
  const subject = patch.subject !== undefined ? patch.subject : v.subjectId
  p.set('level', level ?? 'all')
  if (stream) p.set('stream', stream)
  if (subject) p.set('subject', subject)
  return `${base}?${p.toString()}`
}

/**
 * اختيار المستوى → الشعبة → المادة من البيانات المرجعية. «كل الشعب» و«كل المواد» تظهران دائماً
 * لأن المحتوى القديم قد لا يحمل تصنيفاً. لا يغيّر شيئاً في حساب التلميذ.
 */
export function ScopePicker({ base, value, options, fromProfile }: { base: string; value: ScopeValue; options: ScopeOptions; fromProfile?: boolean }) {
  const chip = (on: boolean) => cn('rounded-full border px-3 py-1 text-sm font-semibold transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:border-primary/50')
  return (
    <div className="space-y-2 rounded-xl border bg-card/60 p-3" role="group" aria-label="المستوى والشعبة والمادة">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-xs font-semibold text-muted-foreground">المستوى</span>
        <Link href={scopeHref(base, value, { level: null })} className={chip(!value.levelId)}>
          الكل
        </Link>
        {options.levels.map((l) => (
          <Link key={l.id} href={scopeHref(base, value, { level: l.id })} className={chip(value.levelId === l.id)}>
            {l.name}
          </Link>
        ))}
      </div>
      {value.levelId && options.streams.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-semibold text-muted-foreground">الشعبة</span>
          <Link href={scopeHref(base, value, { stream: null })} className={chip(!value.streamId)}>
            كل الشعب
          </Link>
          {options.streams.map((s) => (
            <Link key={s.id} href={scopeHref(base, value, { stream: s.id })} className={chip(value.streamId === s.id)}>
              {s.name}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 text-xs font-semibold text-muted-foreground">المادة</span>
        <Link href={scopeHref(base, value, { subject: null })} className={chip(!value.subjectId)}>
          كل المواد
        </Link>
        {options.subjects.map((s) => (
          <Link key={s.id} href={scopeHref(base, value, { subject: s.id })} className={chip(value.subjectId === s.id)}>
            {s.name}
          </Link>
        ))}
      </div>
      {fromProfile ? <p className="text-xs text-muted-foreground">المستوى والشعبة من ملفك؛ غيّرهما هنا للتصفّح فقط دون تعديل حسابك.</p> : null}
    </div>
  )
}
