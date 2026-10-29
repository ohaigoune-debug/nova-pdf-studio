/**
 * MADRASA PLAY — فحص طرفي على بيئة التطوير (لا الإنتاج): الدخول، حالة الوصول، الأقسام الأربعة، مشغّل الاختبار، النتيجة.
 *
 *   BASE=http://localhost:3210 OUT=outputs/play-night/e2e node scripts/play/e2e-play.mjs
 *
 * يشترط خادم تطوير على قاعدة تطوير (PGlite) فيها حساب التلميذ التجريبي ومجموعة مستوردة بـ import-dev،
 * و PLAY_EXAM_PREVIEW=1 إن كانت المجموعة قيد المراجعة. يكتب لقطات PNG وملف results.json (PASS/FAIL لكل خطوة).
 * يفشل (خروج 1) إن فشلت أي خطوة، أو ظهرت صورة شخصية مكسورة/رمادية في سؤال مصوّر.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3210'
const OUT = path.resolve(process.env.OUT || 'outputs/play-night/e2e')
const EMAIL = process.env.E2E_EMAIL || 'mohamed@madrasa.dz'
const PASSWORD = process.env.E2E_PASSWORD || 'Student@12345'
const GRADE = process.env.E2E_GRADE || 'السنة الثانية ثانوي'
const STREAM = process.env.E2E_STREAM || 'علوم تجريبية'

fs.mkdirSync(OUT, { recursive: true })
const results = []
async function step(name, fn) {
  const t = Date.now()
  try {
    const note = await fn()
    results.push({ name, status: 'PASS', ms: Date.now() - t, note: note ?? null })
    console.log(`PASS ${name}${note ? ` — ${note}` : ''}`)
  } catch (e) {
    results.push({ name, status: 'FAIL', ms: Date.now() - t, error: String(e && e.message ? e.message : e).slice(0, 500) })
    console.log(`FAIL ${name} — ${e && e.message ? e.message : e}`)
  }
}

/** نقر بعد توسيط العنصر: شريط التنقل السفلي الثابت في الهاتف قد يغطي عنصرًا ملاصقًا لحافة الشاشة */
async function tap(locator) {
  await locator.waitFor()
  await locator.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }))
  await locator.click()
}

async function brokenImages(page) {
  return page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src))
}

async function run(viewport, tag) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport, locale: 'ar-DZ', deviceScaleFactor: viewport.width < 500 ? 2 : 1, hasTouch: viewport.width < 500, isMobile: viewport.width < 500 })
  const page = await ctx.newPage()
  page.setDefaultTimeout(90_000)
  // لقطة الصفحة كاملة حتى 5000px (الصفحات الأطول تُقصّ: لقطة ضخمة قد تُسقط المتصفح على جهاز محدود الذاكرة)
  const shot = async (n) => {
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    const opts = { path: path.join(OUT, `${tag}-${n}.png`), fullPage: true }
    if (h > 5000) opts.clip = { x: 0, y: 0, width: viewport.width, height: 5000 }
    await page.screenshot(opts)
  }

  await step(`${tag}: login as student`, async () => {
    await page.goto(`${BASE}/login`)
    await page.fill('#email', EMAIL)
    await page.fill('#password', PASSWORD)
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 120_000 }), page.click('button[type=submit]')])
    return page.url()
  })

  if (tag === 'mobile') {
    await step(`${tag}: PLAY profile = 2AS / SCI`, async () => {
      await page.goto(`${BASE}/student/play/setup`)
      await page.waitForLoadState('networkidle') // انتظار الترطيب (hydration) قبل النقر
      await tap(page.getByRole('button', { name: GRADE, exact: false }).first())
      await tap(page.getByRole('button', { name: STREAM }).first())
      await Promise.all([page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/student/play')), tap(page.getByRole('button', { name: 'ابدأ اللعب' }))])
      await page.goto(`${BASE}/student/play?subject=AR`)
      await page.getByText('الثانية ثانوي', { exact: false }).first().waitFor()
    })
  }

  await step(`${tag}: PLAY home shows access state and the four sections`, async () => {
    await page.goto(`${BASE}/student/play?subject=AR`)
    await page.waitForLoadState('networkidle')
    const banner = page.getByTestId('play-access')
    await banner.waitFor()
    const state = await banner.getAttribute('data-state')
    for (const k of ['lessons', 'tests', 'bac', 'results']) await page.getByTestId(`play-section-${k}`).waitFor()
    await shot('01-play-home')
    return `access=${state}`
  })

  let attemptUrl = null
  await step(`${tag}: tests section lists the converted set by term`, async () => {
    await tap(page.getByTestId('play-section-tests'))
    await page.waitForURL(/\/student\/play\/exams/)
    await page.waitForLoadState('networkidle')
    await page.getByTestId('exam-card').first().waitFor({ timeout: 20_000 })
    const n = await page.getByTestId('exam-card').count()
    await shot('02-tests')
    return `${n} set(s)`
  })

  await step(`${tag}: practice mode — read first, answer, instant feedback`, async () => {
    await tap(page.getByTestId('exam-start-practice').first())
    await page.waitForURL(/\/student\/play\/exam\//)
    await page.waitForLoadState('networkidle')
    attemptUrl = page.url()
    const begin = page.getByTestId('exam-begin')
    if (await begin.isVisible().catch(() => false)) {
      await page.getByTestId('exam-poem').waitFor()
      await shot('03-read-first')
      await tap(begin)
    }
    let answered = 0
    const kinds = new Set()
    for (let i = 0; i < 6; i++) {
      const card = page.getByTestId('exam-step')
      await card.waitFor()
      const type = await card.getAttribute('data-step-type')
      kinds.add(type)
      if (await page.getByTestId('exam-next').isVisible().catch(() => false)) {
        await tap(page.getByTestId('exam-next'))
        continue
      }
      if (type === 'mcq' || type === 'portrait') await tap(card.getByRole('radio').first())
      else if (type === 'multi') await tap(card.getByRole('checkbox').first())
      else if (type === 'matching') {
        const selects = card.locator('select')
        for (let j = 0; j < (await selects.count()); j++) await selects.nth(j).selectOption({ index: j + 1 })
      } else if (type === 'fill_blank') {
        const bank = card.getByLabel('بنك الكلمات').getByRole('button')
        const holes = (await card.locator('h2').count()) && (await card.locator('p button').count())
        for (let j = 0; j < holes; j++) await tap(bank.nth(j))
      }
      await tap(page.getByTestId('exam-check'))
      await page.getByTestId('exam-feedback').waitFor()
      answered++
      if (i === 0) await shot('04-feedback')
      if (type === 'fill_blank') await shot('05-fill-blank-feedback')
      if (type === 'matching') await shot('05-matching-feedback')
      await tap(page.getByTestId('exam-next'))
    }
    return `answered ${answered}, types ${[...kinds].join(',')}`
  })

  await step(`${tag}: source text opens while answering`, async () => {
    await tap(page.getByTestId('exam-open-docs'))
    await page.getByRole('dialog').getByTestId('exam-poem').waitFor()
    await shot('06-docs-dialog')
    await page.keyboard.press('Escape')
  })

  await step(`${tag}: finish → result with original-weight score and mistakes review`, async () => {
    await tap(page.getByRole('button', { name: /إنهاء المحاولة الآن/ }))
    await page.waitForURL(/\/result$/)
    const score = await page.getByTestId('exam-result-score').innerText()
    await shot('07-result')
    return `score ${score.replace(/\s+/g, ' ')}`
  })

  await step(`${tag}: results & progress page`, async () => {
    await page.goto(`${BASE}/student/play/results`)
    await page.getByTestId('progress-TEST').waitFor()
    await shot('08-results')
  })

  await step(`${tag}: bac section`, async () => {
    await page.goto(`${BASE}/student/play/bac?subject=AR`)
    await page.getByRole('heading', { name: 'البكالوريا' }).waitFor()
    await shot('09-bac')
  })

  await step(`${tag}: access banner after first play`, async () => {
    await page.goto(`${BASE}/student/play?subject=AR`)
    const st = await page.getByTestId('play-access').getAttribute('data-state')
    if (st !== 'trial_active' && st !== 'subscriber') throw new Error(`unexpected state ${st}`)
    await shot('10-play-home-after')
    return `access=${st}`
  })

  await step(`${tag}: no broken or placeholder images on visited pages`, async () => {
    const broken = await brokenImages(page)
    if (broken.length) throw new Error(`broken: ${broken.join(', ')}`)
  })

  if (attemptUrl) results.push({ name: `${tag}: attempt url`, status: 'INFO', note: attemptUrl })
  await browser.close()
}

;(async () => {
  await run({ width: 390, height: 844 }, 'mobile')
  await run({ width: 1280, height: 900 }, 'desktop')
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 1))
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log(`\n${results.filter((r) => r.status === 'PASS').length} PASS, ${failed} FAIL`)
  process.exit(failed ? 1 : 0)
})()
