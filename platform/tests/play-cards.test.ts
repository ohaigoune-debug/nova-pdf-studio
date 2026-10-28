/**
 * لعبة البطاقات — انتقال الحالات، منع التكرار، عرض السؤال، ملء الفراغ، الحركة المخفّضة، RTL.
 * التصحيح والتسجيل لا يتغيّران: تغطيهما tests/play.test.ts على الخادم نفسه.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { answerReady, canSubmit, cardReducer, createSubmitGate, faceVisibility, FLIP_MS, initialCardState, longestStreak, resumeIndex, type CardEvent, type CardState } from '@/components/play/card-machine'
import { choiceState, DeckMcq } from '@/components/play/deck-choices'
import { FlipCard } from '@/components/play/flip-card'
import type { PlayPublicPayload } from '@/server/play/question-types'

const run = (events: CardEvent[], from: CardState = initialCardState('q1')) => events.reduce(cardReducer, from)

const mcq: PlayPublicPayload = { type: 'MCQ', options: [{ key: 'a', text: 'التنظيم في القضايا الاجتماعية' }, { key: 'b', text: 'الدعوة إلى التحرر والاستقلال' }, { key: 'c', text: 'الوصف الدقيق للطبيعة' }, { key: 'd', text: 'التعبير عن الغزل' }] }
const fill: PlayPublicPayload = { type: 'FILL_BLANK', segments: [{ t: 'عاصمة الجزائر هي ' }, { b: 0 }, { t: ' وتطل على ' }, { b: 1 }], blanks: 2, bank: ['الجزائر', 'وهران', 'البحر المتوسط', 'الصحراء'] }

describe('card state machine', () => {
  it('goes covered → flipping → question → answered → next → covered for the next question', () => {
    let s = initialCardState('q1')
    expect(s.phase).toBe('covered')
    s = cardReducer(s, { type: 'REVEAL', reducedMotion: false })
    expect(s.phase).toBe('flipping')
    s = cardReducer(s, { type: 'FLIP_END' })
    expect(s.phase).toBe('question')
    s = cardReducer(s, { type: 'SUBMIT' })
    expect(s).toMatchObject({ phase: 'question', submitting: true })
    s = cardReducer(s, { type: 'SUBMIT_OK' })
    expect(s).toMatchObject({ phase: 'answered', submitting: false })
    s = cardReducer(s, { type: 'NEXT' })
    expect(s.phase).toBe('next')
    s = cardReducer(s, { type: 'LOAD', questionId: 'q2' })
    expect(s).toEqual({ questionId: 'q2', phase: 'covered', submitting: false })
  })

  it('flips once however fast the card is tapped', () => {
    const s = run([
      { type: 'REVEAL', reducedMotion: false },
      { type: 'REVEAL', reducedMotion: false },
      { type: 'REVEAL', reducedMotion: false }
    ])
    expect(s.phase).toBe('flipping')
    // transitionend والمهلة الاحتياطية معًا لا يتجاوزان «السؤال»
    expect(run([{ type: 'FLIP_END' }, { type: 'FLIP_END' }], s).phase).toBe('question')
    // لا قلب قبل اللمس، ولا «التالي» قبل الإجابة
    expect(run([{ type: 'FLIP_END' }]).phase).toBe('covered')
    expect(run([{ type: 'NEXT' }]).phase).toBe('covered')
    expect(run([{ type: 'NEXT' }], run([{ type: 'REVEAL', reducedMotion: true }])).phase).toBe('question')
  })

  it('never sends the same answer twice', () => {
    const open = run([{ type: 'REVEAL', reducedMotion: true }])
    expect(canSubmit(open, true)).toBe(true)
    const sending = cardReducer(open, { type: 'SUBMIT' })
    expect(cardReducer(sending, { type: 'SUBMIT' })).toBe(sending)
    expect(canSubmit(sending, true)).toBe(false)
    const done = cardReducer(sending, { type: 'SUBMIT_OK' })
    expect(canSubmit(done, true)).toBe(false)
    expect(cardReducer(done, { type: 'SUBMIT' })).toBe(done)
    // لا إرسال والبطاقة مغلقة، ولا بإجابة ناقصة
    expect(canSubmit(initialCardState('q1'), true)).toBe(false)
    expect(canSubmit(open, false)).toBe(false)

    // نقرتان في الإطار نفسه قبل إعادة الرسم: القفل يمرّر واحدة فقط
    const gate = createSubmitGate()
    expect(gate.tryEnter()).toBe(true)
    expect(gate.tryEnter()).toBe(false)
    gate.leave()
    expect(gate.tryEnter()).toBe(true)
  })

  it('lets the student retry after a network failure and shows the saved result if the server already recorded it', () => {
    const sending = run([{ type: 'REVEAL', reducedMotion: true }, { type: 'SUBMIT' }])
    const failed = cardReducer(sending, { type: 'SUBMIT_FAIL' })
    expect(failed).toMatchObject({ phase: 'question', submitting: false })
    expect(canSubmit(failed, true)).toBe(true)
    // بعد تحديث الصفحة: الخادم يؤكد أنه مُجاب
    expect(cardReducer(failed, { type: 'LOAD', questionId: 'q1', answered: true })).toMatchObject({ phase: 'answered', submitting: false })
    // إعادة الرسم لنفس السؤال غير المُجاب لا تغلق البطاقة
    expect(cardReducer(failed, { type: 'LOAD', questionId: 'q1' })).toBe(failed)
  })

  it('swaps instantly with reduced motion', () => {
    expect(run([{ type: 'REVEAL', reducedMotion: true }]).phase).toBe('question')
    expect(FLIP_MS).toBeGreaterThanOrEqual(550)
    expect(FLIP_MS).toBeLessThanOrEqual(650)
  })

  it('resumes at the first unanswered question and computes the round streak without storing it', () => {
    expect(resumeIndex('ACTIVE', [true, true, false, false])).toBe(2)
    expect(resumeIndex('ACTIVE', [true, true])).toBe(2)
    expect(resumeIndex('COMPLETED', [true, false])).toBe(2)
    expect(longestStreak([true, true, false, true, true, true, null])).toBe(3)
    expect(longestStreak([false, null])).toBe(0)
  })
})

describe('answers by real question type', () => {
  it('requires a real option for MCQ', () => {
    expect(answerReady(mcq, null)).toBe(false)
    expect(answerReady(mcq, { type: 'MCQ', key: 'b' })).toBe(true)
    expect(answerReady(mcq, { type: 'MCQ', key: 'z' })).toBe(false)
    expect(answerReady(mcq, { type: 'FILL_BLANK', blanks: ['x'] })).toBe(false)
  })

  it('fill-in: every blank filled with a word from the bank', () => {
    expect(answerReady(fill, { type: 'FILL_BLANK', blanks: ['الجزائر'] })).toBe(false)
    expect(answerReady(fill, { type: 'FILL_BLANK', blanks: ['الجزائر', ''] })).toBe(false)
    expect(answerReady(fill, { type: 'FILL_BLANK', blanks: ['الجزائر', 'كلمة خارج البنك'] })).toBe(false)
    expect(answerReady(fill, { type: 'FILL_BLANK', blanks: ['الجزائر', 'البحر المتوسط'] })).toBe(true)
  })

  it('matching and ordering stay supported', () => {
    const matching: PlayPublicPayload = { type: 'MATCHING', lefts: [{ key: 'l1', text: 'أ' }, { key: 'l2', text: 'ب' }], rights: [{ key: 'r1', text: '1' }, { key: 'r2', text: '2' }] }
    expect(answerReady(matching, { type: 'MATCHING', matches: { l1: 'r2' } })).toBe(false)
    expect(answerReady(matching, { type: 'MATCHING', matches: { l1: 'r2', l2: 'r1' } })).toBe(true)
    const ordering: PlayPublicPayload = { type: 'ORDERING', items: [{ key: 'i1', text: 'أولًا' }, { key: 'i2', text: 'ثانيًا' }] }
    expect(answerReady(ordering, { type: 'ORDERING', order: ['i2', 'i1'] })).toBe(true)
    expect(answerReady(ordering, { type: 'ORDERING', order: ['i2'] })).toBe(false)
  })
})

describe('flip card markup', () => {
  const QUESTION = 'من أبرز خصائص شعر الثورة في الجزائر؟'
  const render = (phase: Parameters<typeof faceVisibility>[0], text = QUESTION, motion = true) =>
    renderToStaticMarkup(createElement(FlipCard, { phase, position: 1, total: 10, motion, onReveal: () => {}, onFlipEnd: () => {} }, createElement('p', { dir: 'auto' }, text)))
  const tag = (html: string, testId: string) => html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ''

  it('covered: a real button with an Arabic label; the question is not in the page before the card is turned', () => {
    const html = render('covered')
    const back = tag(html, 'card-back')
    expect(back).toMatch(/^<button[^>]*type="button"/)
    expect(back).toContain('aria-label="البطاقة 1 من 10. اضغط لعرض السؤال"')
    expect(back).not.toContain('aria-hidden')
    const front = tag(html, 'card-front')
    expect(front).toContain('aria-hidden="true"')
    expect(front).toContain('inert=""')
    expect(html).not.toContain(QUESTION)
    // ظهر البطاقة المرسوم: الإطار والكتاب والإكليل SVG زخرفية
    expect(html).toContain('deck-back-frame')
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it('question: the blue back is gone and the question is readable once', () => {
    const html = render('question')
    expect(html).not.toContain('card-back')
    expect(html).not.toMatch(/inert=""/)
    expect(tag(html, 'card-front')).not.toContain('aria-hidden')
    expect(html.split(QUESTION).length - 1).toBe(1)
    expect(html).toContain('data-settled="true"')
  })

  it('flipping: the same card turns (white face, gold arrow) and neither face is read', () => {
    const html = render('flipping')
    expect(tag(html, 'card-back')).toContain('aria-hidden="true"')
    expect(tag(html, 'card-back')).toContain('inert=""')
    expect(tag(html, 'card-front')).toContain('aria-hidden="true"')
    expect(html).toContain('data-flipped="true"')
    expect(html).toContain('deck-front-blank')
    expect(html).toContain('deck-flip-arrow')
    expect(html).not.toContain(QUESTION)
  })

  it('reduced motion is carried to the card (no arrow, no transition)', () => {
    expect(render('covered', QUESTION, false)).toContain('data-motion="off"')
    expect(render('flipping', QUESTION, false)).not.toContain('deck-flip-arrow')
    expect(render('covered', QUESTION, true)).toContain('data-motion="on"')
  })

  it('RTL: the scene is rtl and French questions keep their own direction', () => {
    const html = render('question', 'Quelle est la capitale de l’Algérie ?')
    expect(html).toMatch(/^<div dir="rtl" class="deck-scene/)
    expect(html).toContain('Quelle est la capitale')
  })
})

describe('choices on the card', () => {
  const mcqPayload = mcq as Extract<PlayPublicPayload, { type: 'MCQ' }>
  const html = (picked: string | null, result: { correctText: string } | null) => renderToStaticMarkup(createElement(DeckMcq, { payload: mcqPayload, picked, disabled: !!result, result, onPick: () => {} }))

  it('never shows the correct answer before the attempt', () => {
    const before = html('a', null)
    expect(before).not.toContain('data-state="correct"')
    expect(before).toContain('data-state="picked"')
    expect(before.match(/role="radio"/g)?.length).toBe(4)
    expect(choiceState('أي نص', false, null)).toBe('idle')
  })

  it('after the server result: correct green, picked wrong red, the rest dimmed', () => {
    const after = html('a', { correctText: 'الدعوة إلى التحرر والاستقلال' })
    expect(after.match(/data-state="correct"/g)?.length).toBe(1)
    expect(after.match(/data-state="wrong"/g)?.length).toBe(1)
    expect(after.match(/data-state="dim"/g)?.length).toBe(2)
    expect(after).toMatch(/disabled=""/)
    expect(choiceState('الدعوة إلى التحرر والاستقلال', true, { correctText: 'الدعوة إلى التحرر والاستقلال' })).toBe('correct')
  })
})

describe('flip css', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')
  const deck = css.slice(css.indexOf('.play-deck {'))

  it('uses a 3D Y flip with hidden backfaces and never mirrors text', () => {
    expect(deck).toMatch(/\.deck-scene \{[^}]*perspective:/)
    expect(deck).toMatch(/\.deck-face \{[^}]*backface-visibility: hidden/)
    expect(deck).toMatch(/\.deck-card\[data-flipped='true'\] \{\s*transform: rotateY\(-180deg\)/)
    expect(deck).toMatch(/\.deck-face-front \{\s*transform: rotateY\(180deg\)/)
    expect(deck).not.toMatch(/scaleX\(-1\)|direction:/)
  })

  it('turns the flip off for reduced motion', () => {
    expect(deck).toMatch(/\.deck-card\[data-motion='off'\] \{\s*transition: none/)
    expect(deck).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.deck-scene,\s*\.deck-card \{\s*transition: none/)
    expect(deck).toMatch(/\.deck-reveal,\s*\.deck-flip-arrow \{\s*animation: none/)
    expect(deck).toMatch(/--deck-flip-ms: 600ms/)
  })

  it('keeps the approved light palette even when the site is dark', () => {
    expect(deck).toMatch(/--primary: 217 82% 43%; \/\* #1457C5 \*\//)
    expect(deck).toMatch(/--background: 222 100% 98%; \/\* #F5F8FF \*\//)
    expect(deck).toMatch(/--deck-gold: 40 87% 62%; \/\* #F2B94B \*\//)
    expect(deck).toMatch(/color-scheme: light/)
    expect(css).not.toContain('.dark .play-deck')
  })

  it('hides the site header and bottom bar during a round on phones only', () => {
    expect(deck).toMatch(/@media \(max-width: 1023\.98px\) \{\s*html\.play-immersive \.brand-header,\s*html\.play-immersive \.student-bottom-nav \{\s*display: none/)
  })
})
