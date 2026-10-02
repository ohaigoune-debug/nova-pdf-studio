import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { imageIdsOf } from '@/lib/exam-blocks'
import { autoTitle } from '@/lib/exam-points'
import { AppError } from '@/server/lib/errors'
import { buildExamDocx, type DocxMode } from '@/server/lib/exam-docx'
import { applyVariant, VARIANTS, type Variant } from '@/server/lib/exam-render'
import { readFileForDownload } from '@/server/services/files.service'
import { getExamForReader } from '@/server/services/marketplace.service'
import type { ExamView } from '@/server/services/exams.service'
import { jsonError } from '../../../_lib'

export const dynamic = 'force-dynamic'

/** GET /api/v1/exams/:id/docx?mode=subject|correction|marking&variant=A — ورقة الامتحان ملفَّ Word */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole('TEACHER')
    const { id } = await ctx.params
    const url = new URL(req.url)
    const mode: DocxMode = url.searchParams.get('mode') === 'correction' ? 'correction' : url.searchParams.get('mode') === 'marking' ? 'marking' : 'subject'
    const v = url.searchParams.get('variant') ?? 'A'
    const variant: Variant = (VARIANTS as readonly string[]).includes(v) ? (v as Variant) : 'A'
    const db = await getDb()
    const { exam } = await getExamForReader(db, actor, id)
    let view: ExamView = exam
    if (variant !== 'A') {
      const items = applyVariant(exam.items, exam.id, variant)
      const numbering: Record<string, string> = {}
      let ex = 0
      let q = 0
      const style = exam.layout?.numbering ?? 'words'
      for (const it of items) {
        if (it.kind === 'EXERCISE') numbering[it.id] = it.title?.trim() || autoTitle('EXERCISE', ++ex, style)
        else if (it.kind === 'QUESTION') numbering[it.id] = it.title?.trim() || autoTitle('QUESTION', ++q, style)
      }
      view = { ...exam, items, numbering }
    }
    // الصور: بايتات مباشرة من التخزين (png/jpeg فقط؛ webp لا يدعمه Word)
    const assets = new Map<string, { data: Uint8Array; type: 'png' | 'jpg' }>()
    for (const fid of imageIdsOf(view.items.flatMap((i) => [i.snapshot.block, ...(i.snapshot.figures ?? [])]))) {
      try {
        const { file, bytes } = await readFileForDownload(db, fid)
        if (file.mimeType === 'image/png') assets.set(fid, { data: new Uint8Array(bytes), type: 'png' })
        else if (file.mimeType === 'image/jpeg') assets.set(fid, { data: new Uint8Array(bytes), type: 'jpg' })
      } catch {
        /* صورة مفقودة: تُستبدل بنصّ */
      }
    }
    const buf = await buildExamDocx(view, mode, variant, assets)
    const name = `${exam.title}-${mode === 'subject' ? 'الموضوع' : mode === 'correction' ? 'التصحيح' : 'السلم'}${variant !== 'A' ? `-${variant}` : ''}.docx`
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch (err) {
    if (err instanceof AppError) return jsonError(err)
    return jsonError(err)
  }
}
