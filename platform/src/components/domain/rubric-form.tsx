'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { toast } from '@/components/ui/toast'
import { t } from '@/i18n'
import { saveRubricAction } from '@/server/actions/quizzes.actions'

type Opt = { id: string; name: string }
interface ItemState {
  id?: string
  label: string
  description: string
  maxPoints: number
  skillId: string
}

export function RubricForm({ rubricId, defaults, skills, allowGlobal }: { rubricId?: string; defaults?: { name: string; description: string | null; items: ItemState[] }; skills: Opt[]; allowGlobal?: boolean }) {
  const router = useRouter()
  const [name, setName] = useState(defaults?.name ?? '')
  const [description, setDescription] = useState(defaults?.description ?? '')
  const [global, setGlobal] = useState(false)
  const [items, setItems] = useState<ItemState[]>(defaults?.items ?? [{ label: 'البناء الفكري', description: '', maxPoints: 8, skillId: '' }, { label: 'البناء اللغوي', description: '', maxPoints: 8, skillId: '' }, { label: 'التقويم النقدي', description: '', maxPoints: 4, skillId: '' }])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const total = items.reduce((s, i) => s + (Number.isFinite(i.maxPoints) ? i.maxPoints : 0), 0)
  const update = (i: number, patch: Partial<ItemState>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await saveRubricAction(rubricId ?? null, { name, description, global, items: items.map((i) => ({ id: i.id, label: i.label, description: i.description || null, maxPoints: i.maxPoints, skillId: i.skillId || null })) })
          if (!r.ok) setError(r.error.message + (r.error.fieldErrors ? ': ' + Object.values(r.error.fieldErrors).join('، ') : ''))
          else {
            toast('success', t('rubrics.saved'))
            router.push('/teacher/rubrics')
            router.refresh()
          }
        })
      }}
      className="space-y-5"
    >
      <Field label={t('rubrics.name')} htmlFor="name">
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('rubrics.namePlaceholder')} required />
      </Field>
      <Field label={t('rubrics.description')} htmlFor="description">
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
      </Field>
      <div className="space-y-2 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{t('rubrics.items')}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setItems((l) => [...l, { label: '', description: '', maxPoints: 2, skillId: '' }])}>
            <Plus className="size-4" /> {t('rubrics.addItem')}
          </Button>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-[2fr_1fr_1.5fr_auto]">
            <Input value={it.label} onChange={(e) => update(i, { label: e.target.value })} placeholder={t('rubrics.itemLabel')} required />
            <Input type="number" min={0.5} step="0.5" value={it.maxPoints} onChange={(e) => update(i, { maxPoints: Number(e.target.value) })} placeholder={t('rubrics.itemPoints')} dir="ltr" required />
            <Select value={it.skillId} onChange={(e) => update(i, { skillId: e.target.value })}>
              <option value="">{t('rubrics.itemSkill')}: —</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button type="button" size="icon" variant="ghost" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label={t('common.delete')}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        <p className="text-end text-sm">
          {t('rubrics.total')}: <b className="tabular">{total}</b>
        </p>
      </div>
      {allowGlobal && !rubricId ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} className="size-4" /> {t('rubrics.global')}
        </label>
      ) : null}
      {error ? <Alert tone="destructive">{error}</Alert> : null}
      <Button type="submit" size="lg" loading={pending}>
        {t('common.save')}
      </Button>
    </form>
  )
}
