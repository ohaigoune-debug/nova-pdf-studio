'use client'

import { CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { Alert } from '@/components/ui/misc'
import { t } from '@/i18n'
import { importPlaylistAction } from '@/server/actions/content.actions'
import { VISIBILITIES } from '@/server/db/schema/enums'

type Opt = { id: string; name: string }

const visibilityLabel: Record<string, string> = {
  PUBLIC: t('contentMgmt.visibilityPUBLIC'),
  STUDENTS_ONLY: t('contentMgmt.visibilitySTUDENTS_ONLY'),
  GROUP_ONLY: t('contentMgmt.visibilityGROUP_ONLY'),
  SPECIFIC_STUDENTS: t('contentMgmt.visibilitySPECIFIC_STUDENTS'),
  TEACHERS_ONLY: t('contentMgmt.visibilityTEACHERS_ONLY')
}

export function PlaylistImportForm({ levels, streams, hasApiKey, aiEnabled }: { levels: Opt[]; streams: Opt[]; hasApiKey: boolean; aiEnabled: boolean }) {
  const [state, action] = useActionState(importPlaylistAction, null)

  if (state?.ok) {
    const d = state.data
    return (
      <div className="space-y-4">
        <Alert tone="success" title={t('contentMgmt.importDone', { imported: d.imported, found: d.found })}>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {d.skipped > 0 ? <li>{t('contentMgmt.importSkipped', { skipped: d.skipped })}</li> : null}
            {d.organizedBy ? <li>{t('contentMgmt.importOrganizedBy', { name: d.organizedBy })}</li> : null}
            {d.imported === 0 ? <li>{t('contentMgmt.importNothingNew')}</li> : null}
          </ul>
        </Alert>
        {d.titles.length > 0 ? (
          <ol className="divide-y rounded-lg border text-sm">
            {d.titles.map((title, i) => (
              <li key={`${i}-${title}`} className="flex items-center gap-2 px-3 py-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                <span className="text-muted-foreground tabular">{i + 1}.</span>
                <span className="truncate">{title}</span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/teacher/content">{t('contentMgmt.title')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/teacher/content/import">{t('contentMgmt.importAgain')}</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <Field label={t('contentMgmt.importUrl')} htmlFor="url" hint={t('contentMgmt.importUrlHint')} error={fieldError(state, 'url')}>
        <Input id="url" name="url" required dir="ltr" placeholder="https://www.youtube.com/playlist?list=PL…" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('contentMgmt.level')} htmlFor="levelId">
          <Select id="levelId" name="levelId" defaultValue="">
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('contentMgmt.stream')} htmlFor="streamId">
          <Select id="streamId" name="streamId" defaultValue="">
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={t('contentMgmt.visibility')} htmlFor="visibility">
        <Select id="visibility" name="visibility" defaultValue="STUDENTS_ONLY">
          {VISIBILITIES.filter((v) => v !== 'GROUP_ONLY' && v !== 'SPECIFIC_STUDENTS').map((v) => (
            <option key={v} value={v}>
              {visibilityLabel[v]}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="organize" defaultChecked={aiEnabled} disabled={!aiEnabled} className="mt-1 size-4" />
        <span>
          {t('contentMgmt.importOrganize')}
          <span className="block text-xs text-muted-foreground">{t('contentMgmt.importOrganizeHint')}</span>
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="publish" className="size-4" />
        <span>{t('contentMgmt.publish')}</span>
      </label>

      {hasApiKey ? null : <p className="text-xs text-muted-foreground">{t('contentMgmt.importRssNote')}</p>}

      <FormError state={state} />
      <SubmitButton size="lg">{t('contentMgmt.importButton')}</SubmitButton>
    </form>
  )
}
