import { ANSWER_SHEET_LINES } from '@/lib/exam-print-config'
import { answerKeyText, ARABIC_LETTERS, durationAr, hasMath, renderBody } from '@/server/lib/exam-render'
import type { ExamItemSnapshot } from '@/server/db/schema'
import { itemPoints, type ExamView } from '@/server/services/exams.service'

export type PrintMode = 'subject' | 'correction'

/** صفحة A4 رسمية بالعربية: الموضوع أو التصحيح؛ CSS داخل الصفحة والمعادلات مُصيَّرة في الخادم */
export function ExamPrint({ exam, mode, variant = 'A' }: { exam: ExamView; mode: PrintMode; variant?: string }) {
  const graded = exam.items.filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION')
  const math = hasMath(exam.items.flatMap((i) => [i.snapshot.body, i.snapshot.solution, ...(i.snapshot.children ?? []).flatMap((c) => [c.body, c.solution])]))
  const total = Number(exam.totalPoints)
  const h = exam.header
  return (
    <>
      {math ? <link rel="stylesheet" href="/katex/katex.min.css" /> : null}
      <style>{PRINT_CSS}</style>
      <article className="sheet" dir="rtl" lang="ar">
        <header className="head">
          <p className="republic">الجمهورية الجزائرية الديمقراطية الشعبية</p>
          <p className="ministry">وزارة التربية الوطنية</p>
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
            </tbody>
          </table>
          <h1>
            {mode === 'correction' ? `التصحيح النموذجي وسلّم التنقيط — ${exam.heading}` : exam.heading}
            {variant !== 'A' ? <span className="variant"> — النسخة {variant}</span> : null}
          </h1>
          <p className="title">{exam.title}</p>
          {mode === 'subject' && exam.instructions ? <p className="instructions">{exam.instructions}</p> : null}
        </header>

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
            if (it.kind === 'TEXT') return mode === 'subject' ? <li key={it.id} className="text" dangerouslySetInnerHTML={{ __html: renderBody(s.body) }} /> : null
            const pts = itemPoints(it)
            return (
              <li key={it.id} className="item">
                <h2>
                  <span>{exam.numbering[it.id]}</span>
                  <span className="pts">({pts} ن)</span>
                </h2>
                {mode === 'subject' ? <Subject s={s} /> : <Correction s={s} />}
              </li>
            )
          })}
        </ol>

        {mode === 'subject' && h.showSources && graded.some((i) => i.snapshot.sourceLabel) ? (
          <footer className="sources">المصادر: {[...new Set(graded.map((i) => `${i.snapshot.sourceLabel ?? ''}${i.snapshot.sourceYear ? ` ${i.snapshot.sourceYear}` : ''}`.trim()).filter(Boolean))].join(' · ')}</footer>
        ) : null}
        <footer className="end">{mode === 'subject' ? 'بالتوفيق' : `المجموع: ${total} نقطة`}</footer>
      </article>
    </>
  )
}

function Subject({ s }: { s: ExamItemSnapshot }) {
  return (
    <>
      {s.title ? <p className="item-title">{s.title}</p> : null}
      <div className="body" dangerouslySetInnerHTML={{ __html: renderBody(s.body) }} />
      {s.options?.length ? (
        <ol className="options">
          {s.options.map((o, i) => (
            <li key={i}>
              <span className="letter">{ARABIC_LETTERS[i] ?? i + 1})</span> {o.label}
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
                <ol className="options">
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

const PRINT_CSS = `
@page { size: A4; margin: 14mm 14mm 16mm; }
.sheet { max-width: 182mm; margin: 0 auto; font-family: 'Amiri', 'IBM Plex Sans Arabic', serif; font-size: 13.5pt; line-height: 1.75; color: #000; background: #fff; }
.sheet * { box-sizing: border-box; }
.head { text-align: center; border-bottom: 1.5px solid #000; padding-bottom: 4mm; margin-bottom: 5mm; }
.republic { font-weight: 700; font-size: 14pt; margin: 0; }
.ministry { margin: 0 0 3mm; font-size: 11pt; }
.meta { width: 100%; font-size: 11.5pt; border-collapse: collapse; text-align: start; }
.meta td { padding: 1mm 2mm; width: 50%; }
.head h1 { font-size: 17pt; margin: 3mm 0 1mm; }
.head .title { margin: 0; font-weight: 700; }
.variant { font-size: 13pt; font-weight: 400; }
.instructions { font-size: 11pt; margin: 2mm 0 0; color: #222; }
.items { list-style: none; padding: 0; margin: 0; }
.item { margin: 0 0 5mm; break-inside: avoid-page; }
.item h2 { display: flex; justify-content: space-between; font-size: 14pt; margin: 0 0 1.5mm; border-bottom: 1px solid #999; }
.pts { font-weight: 400; font-size: 11pt; white-space: nowrap; }
.item-title { font-weight: 700; margin: 0 0 1mm; }
.body p, .solution p { margin: 0 0 1.5mm; }
.body.muted, .child-body.muted { color: #444; font-size: 12pt; }
.options { list-style: none; padding: 0 6mm 0 0; margin: 1mm 0; }
.options li { margin: 0; }
.letter { font-weight: 700; }
.tf { margin: 1mm 0; }
.children { padding: 0 6mm 0 0; margin: 1mm 0 0; }
.children > li { margin: 0 0 1.5mm; }
.child-head { display: flex; justify-content: space-between; gap: 4mm; align-items: baseline; }
.child-body p { display: inline; margin: 0; }
.text { margin: 0 0 4mm; padding: 2mm 3mm; border: 1px dashed #777; font-size: 12pt; }
.lines { background: repeating-linear-gradient(to bottom, transparent 0, transparent 7.5mm, #bbb 7.5mm, #bbb calc(7.5mm + 1px)); margin: 2mm 0; }
.page-break { break-after: page; height: 0; margin: 0; }
.key { margin: 1mm 0; }
.solution { margin: 1mm 0; padding: 2mm 3mm; border-inline-start: 2px solid #000; background: #f6f6f6; }
.no-solution { color: #777; font-size: 11pt; margin: 1mm 0; }
.bareme, .bareme-summary { border-collapse: collapse; margin: 1.5mm 0 3mm; font-size: 11.5pt; }
.bareme td, .bareme-summary td, .bareme-summary th { border: 1px solid #555; padding: 1mm 3mm; }
.bareme-summary { width: 60%; margin: 0 0 5mm; }
.bareme-summary th { background: #eee; }
.num { text-align: center; font-variant-numeric: tabular-nums; }
.total td { font-weight: 700; }
.sources { font-size: 10pt; color: #555; border-top: 1px solid #999; margin-top: 4mm; padding-top: 1mm; }
.end { text-align: center; font-weight: 700; margin-top: 6mm; }
.katex { font-size: 1.05em; direction: ltr; unicode-bidi: isolate; display: inline-block; }
.katex-display { direction: ltr; unicode-bidi: isolate; display: block; text-align: center; margin: 1.5mm 0; }
@media screen { .sheet { padding: 14mm; box-shadow: 0 0 0 1px #ddd, 0 10px 30px rgba(0,0,0,.08); margin: 16px auto; } }
@media print { .no-print { display: none !important; } html, body { background: #fff; } }
`
