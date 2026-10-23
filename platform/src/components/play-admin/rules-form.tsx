'use client'

import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toast'
import { updatePlayRulesAction } from '@/server/actions/play-admin.actions'
import { DEFAULT_PLAY_RULES, PLAY_REVIEW_STATUSES, type PlayReviewStatus, type PlayRules } from '@/server/play/constants'
import { STATUS_AR } from './labels'

const XP_LABELS: Record<keyof PlayRules['xp'], string> = {
  correct: 'إجابة صحيحة',
  correctHard: 'إجابة صحيحة (سؤال صعب)',
  sessionComplete: 'إتمام جلسة',
  lessonMastery: 'إتقان درس',
  repeatMastered: 'سؤال مُتقَن مكرَّر'
}

const toInt = (v: string, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

export function RulesForm({ initial }: { initial: PlayRules }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [rules, setRules] = useState<PlayRules>(initial)
  const [errors, setErrors] = useState<string[]>([])

  const submit = () => {
    const e: string[] = []
    if (!rules.levels.length) e.push('أضف مستوى واحداً على الأقل')
    if (rules.levels.some((l) => !l.title.trim())) e.push('لكل مستوى اسم')
    const sorted = [...rules.levels].sort((a, b) => a.minXp - b.minXp)
    if (sorted[0] && sorted[0].minXp !== 0) e.push('المستوى الأول يبدأ من 0 XP')
    if (new Set(sorted.map((l) => l.minXp)).size !== sorted.length) e.push('حدود XP للمستويات يجب أن تكون مختلفة')
    if (!rules.servableStatuses.length) e.push('اختر حالة واحدة على الأقل تُقدَّم للتلاميذ')
    if (rules.mastery.minPct < 1 || rules.mastery.minPct > 100) e.push('نسبة الإتقان بين 1 و100')
    if (rules.mastery.minAnswered < 1) e.push('الحد الأدنى للإجابات 1 على الأقل')
    setErrors(e)
    if (e.length) return
    start(async () => {
      const r = await updatePlayRulesAction({ ...rules, levels: sorted })
      if (!r.ok) {
        setErrors([r.error.message, ...Object.values(r.error.fieldErrors ?? {})])
        return toast('error', r.error.message)
      }
      setRules(r.data)
      toast('success', 'حُفظت قواعد اللعبة')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {errors.length ? (
        <ul className="list-disc space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 ps-7 text-sm text-destructive">
          {errors.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : null}

      <section className="space-y-3">
        <h3 className="font-bold">نقاط الخبرة (XP)</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(XP_LABELS) as (keyof PlayRules['xp'])[]).map((k) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`xp-${k}`}>{XP_LABELS[k]}</Label>
              <Input id={`xp-${k}`} type="number" min={0} step={1} inputMode="numeric" value={rules.xp[k]} onChange={(e) => setRules({ ...rules, xp: { ...rules.xp, [k]: toInt(e.target.value) } })} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">المستويات</h3>
          <Button type="button" size="sm" variant="outline" disabled={rules.levels.length >= 20} onClick={() => setRules({ ...rules, levels: [...rules.levels, { title: '', minXp: (rules.levels.at(-1)?.minXp ?? 0) * 2 || 100 }] })}>
            <Plus className="size-4" /> مستوى
          </Button>
        </div>
        <div className="space-y-2">
          {rules.levels.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-center text-xs tabular text-muted-foreground">{i + 1}</span>
              <Input value={l.title} onChange={(e) => setRules({ ...rules, levels: rules.levels.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} placeholder="اسم المستوى" />
              <Input type="number" min={0} step={1} inputMode="numeric" className="w-32" value={l.minXp} onChange={(e) => setRules({ ...rules, levels: rules.levels.map((x, j) => (j === i ? { ...x, minXp: toInt(e.target.value) } : x)) })} aria-label="الحد الأدنى من XP" />
              <span className="text-xs text-muted-foreground">XP</span>
              <Button type="button" size="sm" variant="ghost" aria-label="حذف المستوى" disabled={rules.levels.length <= 1} onClick={() => setRules({ ...rules, levels: rules.levels.filter((_, j) => j !== i) })}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">تُرتَّب المستويات تلقائياً حسب الحد الأدنى من XP عند الحفظ.</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold">إتقان الدرس</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="m-min">الحد الأدنى من الإجابات</Label>
            <Input id="m-min" type="number" min={1} step={1} inputMode="numeric" value={rules.mastery.minAnswered} onChange={(e) => setRules({ ...rules, mastery: { ...rules.mastery, minAnswered: toInt(e.target.value, 1) } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-pct">نسبة الإتقان المطلوبة (%)</Label>
            <Input id="m-pct" type="number" min={1} max={100} step={1} inputMode="numeric" value={rules.mastery.minPct} onChange={(e) => setRules({ ...rules, mastery: { ...rules.mastery, minPct: Math.min(100, toInt(e.target.value, 1)) } })} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-bold">الحالات المقدَّمة للتلاميذ</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          {PLAY_REVIEW_STATUSES.map((s: PlayReviewStatus) => (
            <label key={s} className="flex items-center gap-1.5">
              <input type="checkbox" className="size-4 accent-primary" checked={rules.servableStatuses.includes(s)} onChange={(e) => setRules({ ...rules, servableStatuses: e.target.checked ? [...rules.servableStatuses, s] : rules.servableStatuses.filter((x) => x !== s) })} />
              {STATUS_AR[s]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">الأسئلة المعلَّقة أو المؤرشفة لا تُعرض مهما كانت حالتها.</p>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold">لوحة الترتيب</h3>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={rules.publicLeaderboard} onChange={(e) => setRules({ ...rules, publicLeaderboard: e.target.checked })} />
          إظهار لوحة ترتيب عامة بأسماء التلاميذ (معطّلة افتراضياً لحماية خصوصية القُصَّر)
        </label>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={submit} loading={pending}>
          <Save className="size-4" /> حفظ القواعد
        </Button>
        <Button type="button" variant="ghost" onClick={() => setRules(DEFAULT_PLAY_RULES)}>
          <RotateCcw className="size-4" /> استعادة الافتراضي (قبل الحفظ)
        </Button>
      </div>
    </div>
  )
}
