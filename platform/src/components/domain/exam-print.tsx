import { resolveLayout } from '@/lib/exam-blocks'
import { ANSWER_SHEET_LINES } from '@/lib/exam-print-config'
import { answerKeyText, ARABIC_LETTERS, BLOCK_CSS, blocksHaveMath, durationAr, hasMath, renderBlock, renderBody, renderFigures, type RenderContext } from '@/server/lib/exam-render'
import type { ExamItemSnapshot } from '@/server/db/schema'
import { itemPoints } from '@/lib/exam-points'
import { markingSummary } from '@/lib/marking'
import type { ExamView } from '@/server/services/exams.service'

export type PrintMode = 'subject' | 'correction' | 'marking'

/**
 * صفحة A4 رسمية بالعربية: الموضوع، أو التصحيح، أو سلّم التنقيط؛ CSS داخل الصفحة والمعادلات والمنحنيات مُصيَّرة في الخادم.
 * التخطيط (خطّ، هوامش، ترويسة، حقول التلميذ، تذييل، QR) من `exam.layout`؛ الفارغ = الشكل الكلاسيكي نفسه.
 */
export function ExamPrint({ exam, mode, variant = 'A', qrSvg = null }: { exam: ExamView; mode: PrintMode; variant?: string; qrSvg?: string | null }) {
  const graded = exam.items.filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION')
  const L = resolveLayout(exam.layout)
  const ctx: RenderContext = { assets: exam.assets }
  const math = hasMath(exam.items.flatMap((i) => [i.snapshot.body, i.snapshot.solution, ...(i.snapshot.children ?? []).flatMap((c) => [c.body, c.solution])])) || blocksHaveMath(exam.items.flatMap((i) => [i.snapshot.block, ...(i.snapshot.figures ?? [])]))
  const total = Number(exam.totalPoints)
  const h = exam.header
  const logo = L.logoFileId ? exam.assets[L.logoFileId] : null
  const titleOf = mode === 'correction' ? `التصحيح النموذجي وسلّم التنقيط — ${exam.heading}` : mode === 'marking' ? `سلّم التنقيط — ${exam.heading}` : exam.heading
  return (
    <>
      {math ? <link rel="stylesheet" href="/katex/katex.min.css" /> : null}
      <style>{printCss(L)}</style>
      <article className={`sheet head-${L.headerLayout}`} dir="rtl" lang="ar">
        <header className="head">
          {logo || qrSvg ? (
            <div className="head-side">
              {logo ? <img className="logo" src={logo} alt="" /> : <span />}
              {qrSvg ? <span className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <span />}
            </div>
          ) : null}
          {L.showRepublic ? <p className="republic">الجمهورية الجزائرية الديمقراطية الشعبية</p> : null}
          {L.headerLayout === 'bilingual' && L.showRepublic ? <p className="fr">République Algérienne Démocratique et Populaire</p> : null}
          {L.showMinistry ? <p className="ministry">وزارة التربية الوطنية</p> : null}
          {L.headerLayout === 'bilingual' && L.showMinistry ? <p className="fr small">Ministère de l’Éducation Nationale</p> : null}
          {L.directorate ? <p className="directorate">{L.directorate}</p> : null}
          {L.headerLayout === 'compact' ? (
            <p className="meta-line">
              <span>المؤسسة: {h.school || '……………'}</span>
              <span>المادة: {exam.subjectName ?? '………'}</span>
              <span>المستوى: {[exam.levelName, exam.streamName].filter(Boolean).join(' — ') || '………'}</span>
              <span>المدة: {durationAr(exam.durationMinutes)}</span>
              <span>السنة الدراسية: {exam.academicYear ?? '………'}</span>
            </p>
          ) : (
            <table className="meta">
              <tbody>
                <tr>
                  <td>المؤسسة: {h.school || '……………………'}</td>
                  <td>السنة الدراسية: {exam.academicYear ?? '…………'}</td>
                </tr>
                <tr>
                  <td>المادة: {exam.subjectName ?? '…………'}</td>
                  <td>المستوى: {[exam.levelName, exam.streamName].filter(Boolean).join(' — ') || '…………'}</td>
                </tr>
                <tr>
                  <td>الأستاذ: {h.teacherName || '…………'}</td>
                  <td>المدة: {durationAr(exam.durationMinutes)}</td>
                </tr>
                {L.showDate || h.wilaya ? (
                  <tr>
                    <td>{h.wilaya ? `الولاية: ${h.wilaya}` : ''}</td>
                    <td>{L.showDate ? `التاريخ: ${h.date || '…… / …… / ………'}` : ''}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
          <h1>
            {titleOf}
            {variant !== 'A' && L.variantLabel ? <span className="variant"> — النسخة {variant}</span> : null}
          </h1>
          <p className="title">{exam.title}</p>
          {L.studentFields && mode === 'subject' ? (
            <p className="student-fields">
              <span>الاسم واللقب: ………………………………</span>
              <span>القسم: …………</span>
              <span>الرقم: ………</span>
              <span className="mark">العلامة: …… / {Number(exam.targetPoints)}</span>
            </p>
          ) : null}
          {mode === 'subject' && exam.instructions ? <p className="instructions">{exam.instructions}</p> : null}
        </header>

        {mode === 'marking' ? (
          <MarkingSheet exam={exam} />
        ) : (
          <>
            {mode === 'correction' ? (
              <table className="bareme-summary">
                <thead>
                  <tr>
                    <th>العنصر</th>
                    <th>النقاط</th>
                  </tr>
                </thead>
                <tbody>
                  {graded.map((it) => (
                    <tr key={it.id}>
                      <td>{exam.numbering[it.id]}</td>
                      <td className="num">{itemPoints(it)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>المجموع</td>
                    <td className="num">
                      {total} / {Number(exam.targetPoints)}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}

            <ol className="items">
              {exam.items.map((it) => {
                if (it.kind === 'PAGE_BREAK') return <li key={it.id} className="page-break" aria-hidden />
                const s = it.snapshot
                if (it.kind === 'BLOCK' && s.block) return mode === 'subject' || s.block.type === 'HEADING' ? <li key={it.id} className="block" dangerouslySetInnerHTML={{ __html: renderBlock(s.block, ctx) }} /> : null
                if (it.kind === 'TEXT') return mode === 'subject' ? <li key={it.id} className="text" dangerouslySetInnerHTML={{ __html: renderBody(s.body) }} /> : null
                const pts = itemPoints(it)
                return (
                  <li key={it.id} className="item">
                    <h2>
                      <span>{exam.numbering[it.id]}</span>
                      <span className="pts">({pts} ن)</span>
                    </h2>
                    {mode === 'subject' ? <Subject s={s} ctx={ctx} columns={s.optionsColumns ?? L.optionsColumns} /> : <Correction s={s} />}
                  </li>
                )
              })}
            </ol>

            {mode === 'subject' && h.showSources && graded.some((i) => i.snapshot.sourceLabel) ? (
              <footer className="sources">المصادر: {[...new Set(graded.map((i) => `${i.snapshot.sourceLabel ?? ''}${i.snapshot.sourceYear ? ` ${i.snapshot.sourceYear}` : ''}`.trim()).filter(Boolean))].join(' · ')}</footer>
            ) : null}
            <footer className="end">{mode === 'subject' ? 'بالتوفيق' : `المجموع: ${total} نقطة`}</footer>
          </>
        )}
        {L.footer.text ? <footer className="foot-text">{L.footer.text}</footer> : null}
      </article>
    </>
  )
}

function Subject({ s, ctx, columns }: { s: ExamItemSnapshot; ctx: RenderContext; columns: 1 | 2 | 3 | 4 }) {
  return (
    <>
      {s.title ? <p className="item-title">{s.title}</p> : null}
      <div className="body" dangerouslySetInnerHTML={{ __html: renderBody(s.body) }} />
      {s.figures?.length ? <div dangerouslySetInnerHTML={{ __html: renderFigures(s.figures, ctx) }} /> : null}
      {s.options?.length ? (
        <ol className={`options cols-${columns}`}>
          {s.options.map((o, i) => (
            <li key={i}>
              <span className="letter">{ARABIC_LETTERS[i] ?? i + 1})</span> <span dangerouslySetInnerHTML={{ __html: renderBody(o.label).replace(/^<p dir="auto">|<\/p>$/g, '') }} />
            </li>
          ))}
        </ol>
      ) : null}
      {s.type === 'TRUE_FALSE' ? <p className="tf">صحيح ☐ &nbsp;&nbsp; خطأ ☐</p> : null}
      {s.children?.length ? (
        <ol className="children">
          {s.children.map((c, i) => (
            <li key={i}>
              <div className="child-head">
                <span className="child-body" dangerouslySetInnerHTML={{ __html: renderBody(c.body) }} />
                <span className="pts">({c.points ?? 0} ن)</span>
              </div>
              {c.options?.length ? (
                <ol className={`options cols-${columns}`}>
                  {c.options.map((o, j) => (
                    <li key={j}>
                      <span className="letter">{ARABIC_LETTERS[j] ?? j + 1})</span> {o.label}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {!s.children?.length && !s.options?.length && (s.type === 'SHORT_ANSWER' || s.type === 'FILL_BLANK') ? <div className="lines" style={{ height: `${ANSWER_SHEET_LINES.short}mm` }} /> : null}
    </>
  )
}

function Correction({ s }: { s: ExamItemSnapshot }) {
  const key = answerKeyText(s.type, s.answerKey, s.options)
  const rows: { label: string; points: number }[] = s.bareme?.length ? s.bareme : []
  return (
    <>
      {s.title ? <p className="item-title">{s.title}</p> : null}
      <div className="body muted" dangerouslySetInnerHTML={{ __html: renderBody(s.body) }} />
      {key ? (
        <p className="key">
          <strong>الإجابة:</strong> {key}
        </p>
      ) : null}
      {s.solution ? <div className="solution" dangerouslySetInnerHTML={{ __html: renderBody(s.solution) }} /> : null}
      {s.children?.length ? (
        <ol className="children">
          {s.children.map((c, i) => {
            const ck = answerKeyText(c.type, c.answerKey, c.options)
            return (
              <li key={i}>
                <div className="child-head">
                  <span className="child-body muted" dangerouslySetInnerHTML={{ __html: renderBody(c.body) }} />
                  <span className="pts">({c.points ?? 0} ن)</span>
                </div>
                {ck ? (
                  <p className="key">
                    <strong>الإجابة:</strong> {ck}
                  </p>
                ) : null}
                {c.solution ? <div className="solution" dangerouslySetInnerHTML={{ __html: renderBody(c.solution) }} /> : null}
                {c.bareme?.length ? <Bareme rows={c.bareme} /> : null}
              </li>
            )
          })}
        </ol>
      ) : null}
      {rows.length ? <Bareme rows={rows} /> : null}
      {!s.solution && !key && !s.children?.some((c) => c.solution) ? <p className="no-solution">(لا حلّ نموذجي مسجَّل لهذا العنصر)</p> : null}
    </>
  )
}

function Bareme({ rows }: { rows: { label: string; points: number }[] }) {
  return (
    <table className="bareme">
      <tbody>
        {rows.map((b, i) => (
          <tr key={i}>
            <td>{b.label}</td>
            <td className="num">{b.points} ن</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** نسخة سلّم التنقيط: كل عنصر بفرعياته وسلّمه ونقاطه، مع فحص المجموع */
function MarkingSheet({ exam }: { exam: ExamView }) {
  const m = markingSummary(exam)
  return (
    <section className="marking">
      {m.warnings.length ? <p className="warn">⚠ {m.warnings.join(' · ')}</p> : null}
      <table className="marking-table">
        <thead>
          <tr>
            <th>العنصر</th>
            <th>البند</th>
            <th>النقاط</th>
          </tr>
        </thead>
        <tbody>
          {m.rows.map((r) => (
            <RowGroup key={r.itemId} r={r} />
          ))}
          <tr className="total">
            <td colSpan={2}>المجموع</td>
            <td className="num">
              {m.total} / {m.target}
            </td>
          </tr>
        </tbody>
      </table>
      <p className="end">{m.ok ? 'المجموع مطابق للمستهدف.' : 'راجع توزيع النقاط قبل الطباعة النهائية.'}</p>
    </section>
  )
}

function RowGroup({ r }: { r: ReturnType<typeof markingSummary>['rows'][number] }) {
  const subRows = r.children.length ? r.children.flatMap((c, i) => [{ label: `${i + 1}) ${c.body.slice(0, 90)}`, points: c.points, sub: false }, ...c.bareme.map((b) => ({ label: `— ${b.label}`, points: b.points, sub: true }))]) : r.bareme.map((b) => ({ label: b.label, points: b.points, sub: true }))
  return (
    <>
      <tr className="item-row">
        <td rowSpan={subRows.length + 1} className="item-name">
          {r.label}
          {r.mismatch ? <span className="mismatch"> ⚠</span> : null}
        </td>
        <td className="muted">{subRows.length ? '' : '—'}</td>
        <td className="num strong">{r.points}</td>
      </tr>
      {subRows.map((s, i) => (
        <tr key={i} className={s.sub ? 'sub' : ''}>
          <td dir="auto" dangerouslySetInnerHTML={{ __html: renderBody(s.label).replace(/^<p dir="auto">|<\/p>$/g, '') }} />
          <td className="num">{s.points}</td>
        </tr>
      ))}
    </>
  )
}

function printCss(L: ReturnType<typeof resolveLayout>): string {
  return `
@page { size: A4; margin: ${L.margins.top}mm ${L.margins.side}mm ${L.margins.bottom}mm; ${L.footer.pageNumbers ? '@bottom-center { content: counter(page) " / " counter(pages); font-size: 9pt; color: #555; }' : ''} }
.sheet { max-width: ${210 - 2 * L.margins.side}mm; margin: 0 auto; font-family: 'Amiri', 'IBM Plex Sans Arabic', serif; font-size: ${L.fontSize}pt; line-height: ${L.lineHeight}; color: #000; background: #fff; position: relative; }
.sheet * { box-sizing: border-box; }
.head { text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 4mm; margin-bottom: 5mm; position: relative; }
.head-boxed .head { border: 1.5px solid #000; padding: 3mm 4mm; border-radius: 2mm; }
.head-boxed .meta td { border: 1px solid #777; }
.head-side { display: flex; justify-content: space-between; align-items: flex-start; position: absolute; inset-inline: 0; top: 0; pointer-events: none; }
.logo { height: 16mm; width: auto; }
.qr svg { width: 16mm; height: 16mm; }
.republic { font-weight: 700; font-size: ${L.fontSize + 0.5}pt; margin: 0; }
.ministry { margin: 0 0 1mm; font-size: ${L.fontSize - 2.5}pt; }
.directorate { margin: 0 0 2mm; font-size: ${L.fontSize - 2.5}pt; }
.fr { direction: ltr; font-family: 'IBM Plex Sans Arabic', Arial, sans-serif; font-size: ${L.fontSize - 3}pt; margin: 0; }
.fr.small { margin-bottom: 1mm; }
.meta { width: 100%; font-size: ${L.fontSize - 2}pt; border-collapse: collapse; text-align: start; margin-top: 2mm; }
.meta td { padding: 1mm 2mm; width: 50%; }
.meta-line { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2mm 5mm; font-size: ${L.fontSize - 2.5}pt; margin: 2mm 0 0; }
.head h1 { font-size: ${L.fontSize + 3.5}pt; margin: 3mm 0 1mm; }
.head .title { margin: 0; font-weight: 700; }
.variant { font-size: ${L.fontSize - 0.5}pt; font-weight: 400; }
.instructions { font-size: ${L.fontSize - 2.5}pt; margin: 2mm 0 0; color: #222; }
.student-fields { display: flex; flex-wrap: wrap; gap: 1mm 6mm; justify-content: space-between; font-size: ${L.fontSize - 2}pt; margin: 2mm 0 0; border: 1px solid #000; padding: 1.5mm 3mm; text-align: start; }
.student-fields .mark { font-weight: 700; }
.items { list-style: none; padding: 0; margin: 0; }
.item { margin: 0 0 5mm; break-inside: avoid-page; }
.item h2 { display: flex; justify-content: space-between; font-size: ${L.fontSize + 0.5}pt; margin: 0 0 1.5mm; border-bottom: 1px solid #999; }
.pts { font-weight: 400; font-size: ${L.fontSize - 2.5}pt; white-space: nowrap; }
.item-title { font-weight: 700; margin: 0 0 1mm; }
.body p, .solution p { margin: 0 0 1.5mm; }
.body.muted, .child-body.muted { color: #444; font-size: ${L.fontSize - 1.5}pt; }
.options { list-style: none; padding: 0 6mm 0 0; margin: 1mm 0; }
.options.cols-2, .options.cols-3, .options.cols-4 { display: grid; gap: 0 6mm; }
.options.cols-2 { grid-template-columns: 1fr 1fr; }
.options.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.options.cols-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
.options li { margin: 0; }
.options li p { display: inline; margin: 0; }
.letter { font-weight: 700; }
.tf { margin: 1mm 0; }
.children { padding: 0 6mm 0 0; margin: 1mm 0 0; }
.children > li { margin: 0 0 1.5mm; }
.child-head { display: flex; justify-content: space-between; gap: 4mm; align-items: baseline; }
.child-body p { display: inline; margin: 0; }
.text { margin: 0 0 4mm; padding: 2mm 3mm; border: 1px dashed #777; font-size: ${L.fontSize - 1.5}pt; }
.block { margin: 0; }
.lines { background: repeating-linear-gradient(to bottom, transparent 0, transparent 7.5mm, #bbb 7.5mm, #bbb calc(7.5mm + 1px)); margin: 2mm 0; }
.page-break { break-after: page; height: 0; margin: 0; }
.key { margin: 1mm 0; }
.solution { margin: 1mm 0; padding: 2mm 3mm; border-inline-start: 2px solid #000; background: #f6f6f6; }
.no-solution { color: #777; font-size: ${L.fontSize - 2.5}pt; margin: 1mm 0; }
.bareme, .bareme-summary { border-collapse: collapse; margin: 1.5mm 0 3mm; font-size: ${L.fontSize - 2}pt; }
.bareme td, .bareme-summary td, .bareme-summary th { border: 1px solid #555; padding: 1mm 3mm; }
.bareme-summary { width: 60%; margin: 0 0 5mm; }
.bareme-summary th { background: #eee; }
.num { text-align: center; font-variant-numeric: tabular-nums; }
.total td { font-weight: 700; }
.sources { font-size: 10pt; color: #555; border-top: 1px solid #999; margin-top: 4mm; padding-top: 1mm; }
.end { text-align: center; font-weight: 700; margin-top: 6mm; }
.foot-text { text-align: center; font-size: 9.5pt; color: #444; margin-top: 4mm; border-top: 1px solid #ccc; padding-top: 1mm; }
.marking .warn { border: 1.5px solid #000; padding: 1.5mm 3mm; font-size: ${L.fontSize - 2}pt; }
.marking-table { width: 100%; border-collapse: collapse; font-size: ${L.fontSize - 1.5}pt; }
.marking-table th, .marking-table td { border: 1px solid #555; padding: 1mm 3mm; vertical-align: top; }
.marking-table th { background: #eee; }
.marking-table .item-name { font-weight: 700; width: 28mm; }
.marking-table .sub td { color: #333; font-size: ${L.fontSize - 2.5}pt; }
.marking-table .strong { font-weight: 700; }
.marking-table .mismatch { color: #b3261e; }
.muted { color: #666; }
.katex { font-size: 1.05em; direction: ltr; unicode-bidi: isolate; display: inline-block; }
.katex-display { direction: ltr; unicode-bidi: isolate; display: block; text-align: center; margin: 1.5mm 0; }
${BLOCK_CSS}
@media screen { .sheet { padding: ${L.margins.top}mm ${L.margins.side}mm ${L.margins.bottom}mm; box-shadow: 0 0 0 1px #ddd, 0 10px 30px rgba(0,0,0,.08); margin: 16px auto; } }
@media print { .no-print { display: none !important; } html, body { background: #fff; } }
`
}
