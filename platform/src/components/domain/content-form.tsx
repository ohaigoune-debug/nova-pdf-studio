'use client'

import { useActionState, useState } from 'react'
import { FormError, SubmitButton, fieldError } from '@/components/forms/form-bits'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { t, tEnum } from '@/i18n'
import { createContentAction, updateContentAction } from '@/server/actions/content.actions'
import { CONTENT_TYPES, VISIBILITIES } from '@/server/db/schema/enums'
import type { ActionResult } from '@/server/lib/action-result'

type Opt = { id: string; name: string }

export interface ContentFormDefaults {
  type?: string
  title?: string
  summary?: string | null
  body?: string | null
  externalUrl?: string | null
  fileId?: string | null
  levelId?: string | null
  streamId?: string | null
  topic?: string | null
  skillId?: string | null
  subjectId?: string | null
  curriculumNodeId?: string | null
  visibility?: string
  published?: boolean
  groupIds?: string[]
  studentIds?: string[]
  videoProvider?: string | null
  youtubeId?: string | null
  bunnyVideoId?: string | null
  allowDownload?: boolean
}

const visibilityLabel: Record<string, string> = {
  PUBLIC: t('contentMgmt.visibilityPUBLIC'),
  STUDENTS_ONLY: t('contentMgmt.visibilitySTUDENTS_ONLY'),
  GROUP_ONLY: t('contentMgmt.visibilityGROUP_ONLY'),
  SPECIFIC_STUDENTS: t('contentMgmt.visibilitySPECIFIC_STUDENTS'),
  TEACHERS_ONLY: t('contentMgmt.visibilityTEACHERS_ONLY')
}

type FileOpt = Opt & { mimeType?: string }
export type NodeOpt = { id: string; subjectId: string; levelId: string; streamId: string | null; kind: string; label: string }

export function ContentForm({ contentId, defaults = {}, groups, students, levels, streams, skills, files, subjects = [], nodes = [] }: { contentId?: string; defaults?: ContentFormDefaults; groups: Opt[]; students: Opt[]; levels: Opt[]; streams: Opt[]; skills: Opt[]; files: FileOpt[]; subjects?: Opt[]; nodes?: NodeOpt[] }) {
  const action = contentId
    ? (updateContentAction.bind(null, contentId) as (p: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>)
    : (createContentAction as (p: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>)
  const [state, formAction] = useActionState(action, null)
  const [visibility, setVisibility] = useState(defaults.visibility ?? 'STUDENTS_ONLY')
  const [type, setType] = useState(defaults.type ?? 'LESSON')
  const [videoProvider, setVideoProvider] = useState<'YOUTUBE' | 'UPLOAD' | 'BUNNY'>(defaults.videoProvider === 'UPLOAD' ? 'UPLOAD' : defaults.videoProvider === 'BUNNY' ? 'BUNNY' : 'YOUTUBE')
  const [levelId, setLevelId] = useState(defaults.levelId ?? '')
  const [streamId, setStreamId] = useState(defaults.streamId ?? '')
  const [subjectId, setSubjectId] = useState(defaults.subjectId ?? '')
  // عقد المنهاج المتاحة: المادة والمستوى المختاران، والمشتركة بين الشعب أو شعبة الدرس
  const nodeChoices = subjectId && levelId ? nodes.filter((n) => n.subjectId === subjectId && n.levelId === levelId && (!n.streamId || !streamId || n.streamId === streamId)) : []
  const videoFiles = files.filter((f) => f.mimeType?.startsWith('video/'))
  const pdfFiles = files.filter((f) => f.mimeType === 'application/pdf')
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <Field label={t('contentMgmt.type')} htmlFor="type">
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
            {CONTENT_TYPES.map((c) => (
              <option key={c} value={c}>
                {tEnum('contentTypes', c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('contentMgmt.titleField')} htmlFor="title" error={fieldError(state, 'title')}>
          <Input id="title" name="title" defaultValue={defaults.title ?? ''} required />
        </Field>
      </div>
      <Field label={t('contentMgmt.summary')} htmlFor="summary">
        <Input id="summary" name="summary" defaultValue={defaults.summary ?? ''} />
      </Field>
      <Field label={t('contentMgmt.body')} htmlFor="body">
        <Textarea id="body" name="body" rows={12} defaultValue={defaults.body ?? ''} className="leading-7" />
      </Field>
      {type === 'VIDEO' ? (
        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-bold">{t('contentMgmt.videoSource')}</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="videoProvider" value="YOUTUBE" checked={videoProvider === 'YOUTUBE'} onChange={() => setVideoProvider('YOUTUBE')} className="size-4" />
              {t('contentMgmt.videoYoutube')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="videoProvider" value="UPLOAD" checked={videoProvider === 'UPLOAD'} onChange={() => setVideoProvider('UPLOAD')} className="size-4" />
              {t('contentMgmt.videoUpload')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="videoProvider" value="BUNNY" checked={videoProvider === 'BUNNY'} onChange={() => setVideoProvider('BUNNY')} className="size-4" />
              {t('contentMgmt.videoBunny')}
            </label>
          </div>
          {videoProvider === 'YOUTUBE' ? (
            <Field label={t('contentMgmt.youtubeUrl')} htmlFor="youtubeUrl" hint={t('contentMgmt.youtubeHint')} error={fieldError(state, 'youtubeUrl')}>
              <Input id="youtubeUrl" name="youtubeUrl" defaultValue={defaults.externalUrl ?? ''} dir="ltr" placeholder="https://www.youtube.com/watch?v=…" required />
            </Field>
          ) : videoProvider === 'BUNNY' ? (
            <Field label={t('contentMgmt.bunnyVideoId')} htmlFor="bunnyVideoId" hint={t('contentMgmt.bunnyVideoIdHint')} error={fieldError(state, 'bunnyVideoId')}>
              <Input id="bunnyVideoId" name="bunnyVideoId" defaultValue={defaults.bunnyVideoId ?? ''} dir="ltr" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required />
            </Field>
          ) : (
            <Field label={t('contentMgmt.videoFile')} htmlFor="fileId" hint={t('contentMgmt.videoFileHint')} error={fieldError(state, 'fileId')}>
              <Select id="fileId" name="fileId" defaultValue={defaults.fileId ?? ''} required>
                <option value="">—</option>
                {videoFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </fieldset>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('contentMgmt.externalUrl')} htmlFor="externalUrl" error={fieldError(state, 'externalUrl')}>
            <Input id="externalUrl" name="externalUrl" type="url" defaultValue={defaults.externalUrl ?? ''} dir="ltr" placeholder="https://" />
          </Field>
          <Field label={type === 'PDF' ? t('contentMgmt.pdfFile') : t('contentMgmt.file')} htmlFor="fileId">
            <Select id="fileId" name="fileId" defaultValue={defaults.fileId ?? ''}>
              <option value="">—</option>
              {(type === 'PDF' ? pdfFiles : files).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {type !== 'VIDEO' ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="allowDownload" defaultChecked={defaults.allowDownload ?? false} className="mt-1 size-4" />
          <span>
            <span className="block font-semibold">{t('contentMgmt.allowDownload')}</span>
            <span className="block text-xs text-muted-foreground">{t('contentMgmt.allowDownloadHint')}</span>
          </span>
        </label>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t('contentMgmt.level')} htmlFor="levelId">
          <Select id="levelId" name="levelId" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('contentMgmt.stream')} htmlFor="streamId">
          <Select id="streamId" name="streamId" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
            <option value="">—</option>
            {streams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('contentMgmt.topic')} htmlFor="topic">
          <Input id="topic" name="topic" defaultValue={defaults.topic ?? ''} />
        </Field>
        <Field label={t('contentMgmt.skill')} htmlFor="skillId">
          <Select id="skillId" name="skillId" defaultValue={defaults.skillId ?? ''}>
            <option value="">—</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="المادة" htmlFor="subjectId">
          <Select id="subjectId" name="subjectId" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">—</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="موضعه في المنهاج (وحدة › درس)" htmlFor="curriculumNodeId" className="sm:col-span-2">
          <Select id="curriculumNodeId" name="curriculumNodeId" defaultValue={defaults.curriculumNodeId ?? ''} disabled={!nodeChoices.length}>
            <option value="">{subjectId && levelId ? (nodeChoices.length ? '— غير مصنّف —' : 'لا منهاج مزروع لهذه المادة والمستوى') : 'اختر المستوى والمادة أولاً'}</option>
            {nodeChoices.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">يرتّب الدرس في صفحة «دروسي» بترتيب المنهاج. بلا تصنيف يظهر في «دروس أخرى».</p>
        </Field>
      </div>
      <fieldset className="rounded-lg border p-4">
        <legend className="px-1 text-sm font-bold">{t('contentMgmt.visibility')}</legend>
        <Select name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value)} className="mb-3 max-w-sm">
          {VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {visibilityLabel[v]}
            </option>
          ))}
        </Select>
        {visibility === 'GROUP_ONLY' ? (
          <div className="space-y-1">
            {fieldError(state, 'groupIds') ? <p className="text-xs text-destructive">{fieldError(state, 'groupIds')}</p> : null}
            {groups.map((g) => (
              <label key={g.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="groupIds" value={g.id} defaultChecked={defaults.groupIds?.includes(g.id)} className="size-4" />
                {g.name}
              </label>
            ))}
          </div>
        ) : null}
        {visibility === 'SPECIFIC_STUDENTS' ? (
          <select name="studentIds" multiple defaultValue={defaults.studentIds ?? []} className="h-40 w-full rounded-md border bg-background p-2 text-sm">
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : null}
      </fieldset>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="publish" defaultChecked={defaults.published ?? true} className="size-4" /> {t('contentMgmt.publish')}
      </label>
      <FormError state={state} />
      {state?.ok && contentId ? <p className="text-sm text-success">{t('contentMgmt.updated')}</p> : null}
      <SubmitButton size="lg">{contentId ? t('common.save') : t('common.create')}</SubmitButton>
    </form>
  )
}
