/**
 * مجلد Google Drive الذي يربطه الأستاذ مصدراً وحيداً للتمارين المولَّدة.
 * يُحفظ في إعدادات مساحة عمله، وتُخبَّأ نصوص ملفاته على القرص بمفتاح (الملف + تاريخ تعديله)
 * فلا يُعاد تنزيل ملف لم يتغيّر.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { teacherWorkspaces } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { fetchDriveText, listDriveFolder, parseDriveFolderId, type DriveOptions } from '@/server/lib/google-drive'
import { cachedText } from '@/server/lib/text-cache'

export interface DriveSource {
  folderId: string
  folderName: string
  files: number
  linkedAt: string
}

export interface SourceDoc {
  title: string
  text: string
}

async function readSettings(db: Db, workspaceId: string): Promise<Record<string, unknown>> {
  const [w] = await db.select({ settings: teacherWorkspaces.settings }).from(teacherWorkspaces).where(eq(teacherWorkspaces.id, workspaceId)).limit(1)
  if (!w) throw new AppError('NOT_FOUND')
  return w.settings ?? {}
}

export async function getDriveSource(db: Db, workspaceId: string): Promise<DriveSource | null> {
  const s = (await readSettings(db, workspaceId)).driveSource as DriveSource | undefined
  return s?.folderId ? s : null
}

/** ربط المجلد: يُقرأ فوراً للتأكد أنه مشارَك وفيه ملفات مقروءة، قبل الحفظ */
export async function setDriveSource(db: Db, actor: Actor, url: string, opts: DriveOptions = {}): Promise<DriveSource> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  const folderId = parseDriveFolderId(url)
  if (!folderId) throw new AppError('INVALID_DRIVE_URL')
  const { name, files } = await listDriveFolder(folderId, opts)
  if (files.length === 0) throw new AppError('DRIVE_EMPTY')
  const source: DriveSource = { folderId, folderName: name, files: files.length, linkedAt: new Date().toISOString() }
  const settings = await readSettings(db, actor.workspaceId)
  await db
    .update(teacherWorkspaces)
    .set({ settings: { ...settings, driveSource: source } })
    .where(eq(teacherWorkspaces.id, actor.workspaceId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'drive.source.link', entityType: 'workspace', entityId: actor.workspaceId, newValue: { folderId, folderName: name, files: files.length } })
  return source
}

export async function clearDriveSource(db: Db, actor: Actor): Promise<void> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  const { driveSource: _drop, ...rest } = await readSettings(db, actor.workspaceId)
  await db.update(teacherWorkspaces).set({ settings: rest }).where(eq(teacherWorkspaces.id, actor.workspaceId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'drive.source.unlink', entityType: 'workspace', entityId: actor.workspaceId })
}

/* ------------------------------ النصوص ------------------------------ */

/** نصوص كل ملفات المجلد (الفارغة، كـ PDF المصوّر، تُسقط) */
export async function loadSourceDocs(folderId: string, opts: DriveOptions = {}): Promise<SourceDoc[]> {
  const { files } = await listDriveFolder(folderId, opts)
  const docs: SourceDoc[] = []
  // ثلاثة تنزيلات متوازية تكفي ولا ترهق الخادم
  for (let i = 0; i < files.length; i += 3) {
    const batch = await Promise.all(
      files.slice(i, i + 3).map(async (f) => {
        try {
          return { title: f.name, text: await cachedText(`drive:${f.id}:${f.modifiedTime}`, () => fetchDriveText(f, opts)) }
        } catch (e) {
          // ملف واحد مقفل أو تالف لا يُسقط المجلد كلّه
          if (e instanceof AppError && e.code === 'DRIVE_API_DISABLED') throw e
          return { title: f.name, text: '' }
        }
      })
    )
    docs.push(...batch.filter((d) => d.text.length >= 40))
  }
  return docs
}

/* --------------------------- اختيار المقاطع --------------------------- */

const STOP = new Set(['في', 'من', 'علي', 'الي', 'عن', 'مع', 'او', 'ثم', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'كل', 'بين', 'غير', 'مهاره', 'درس'])

/** جذع خفيف: بلا «ال» وأدوات العطف والجرّ الملتصقة، فتتطابق «الاستعارة» و«والاستعارة» و«بالاستعارة» */
function stem(w: string): string {
  return w.replace(/^(و|ف|ب|ك|ل)?ال/, '').replace(/^لل/, '')
}

export function queryTerms(...parts: (string | null | undefined)[]): string[] {
  const words = normalizeArabic(parts.filter(Boolean).join(' ')).split(' ')
  return [...new Set(words.filter((w) => w.length >= 2 && !STOP.has(w)).map(stem).filter((w) => w.length >= 3))]
}

function chunks(text: string, size = 1400): string[] {
  const paras = text.split(/\n+/)
  const out: string[] = []
  let cur = ''
  for (const p of paras) {
    if (cur && cur.length + p.length > size) {
      out.push(cur)
      cur = ''
    }
    cur = cur ? `${cur}\n${p}` : p
    while (cur.length > size * 1.5) {
      out.push(cur.slice(0, size))
      cur = cur.slice(size)
    }
  }
  if (cur.trim()) out.push(cur)
  return out
}

/**
 * أنسب المقاطع لموضوع التمارين، حتى maxChars. null إن لم يرد الموضوع في أي ملف —
 * فالتوليد «من الدرايف لا غير» يرفض بدل أن يخترع.
 */
export function selectPassages(docs: SourceDoc[], terms: string[], maxChars = 12_000): SourceDoc[] | null {
  if (terms.length === 0) return null
  const scored: { doc: number; idx: number; text: string; score: number }[] = []
  docs.forEach((d, doc) => {
    const titleHits = terms.filter((t) => normalizeArabic(d.title).includes(t)).length
    chunks(d.text).forEach((text, idx) => {
      const n = normalizeArabic(text)
      let score = 0
      for (const t of terms) {
        const hits = n.split(t).length - 1
        // كل مصطلح يُحتسب، والتكرار يزيد بتناقص كي لا تطغى كلمة واحدة
        if (hits) score += 1 + Math.log2(hits)
      }
      if (score > 0) scored.push({ doc, idx, text, score: score + titleHits })
    })
  })
  if (scored.length === 0) return null
  scored.sort((a, b) => b.score - a.score)
  const picked: typeof scored = []
  let total = 0
  for (const s of scored) {
    if (total + s.text.length > maxChars && picked.length) break
    picked.push(s)
    total += s.text.length
  }
  // بترتيبها الأصلي داخل كل ملف، فيبقى السياق مقروءاً
  const byDoc = new Map<number, typeof picked>()
  for (const p of picked) byDoc.set(p.doc, [...(byDoc.get(p.doc) ?? []), p])
  return [...byDoc.entries()].map(([doc, ps]) => ({
    title: docs[doc]!.title,
    text: ps
      .sort((a, b) => a.idx - b.idx)
      .map((p) => p.text)
      .join('\n…\n')
  }))
}
