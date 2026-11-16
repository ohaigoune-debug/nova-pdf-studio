/**
 * اختبار دخان شامل للواجهة المبنية (dist/) في Chromium بمقاسات iPhone وiPad:
 * يفتح التطبيق، يستورد PDF، يبحث، يحرر ويحفظ، يشغّل OCR (Tesseract WASM داخل المتصفح)، ينشئ فاتورة، ويلتقط صورًا.
 * ملاحظة: هذا ليس WKWebView؛ المحرك هنا Chromium. اختبار iOS الحقيقي يتم في Xcode/المحاكي.
 */
import { chromium } from 'playwright-core'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/'
const OUT = resolve('e2e/out')
mkdirSync(OUT, { recursive: true })
const results = []
const step = async (name, fn) => {
  const t0 = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, ms: Date.now() - t0 })
    console.log(`✓ ${name} (${Date.now() - t0}ms)`)
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: String(e?.message ?? e).slice(0, 400) })
    console.log(`✗ ${name}: ${String(e?.message ?? e).slice(0, 400)}`)
  }
}

async function makePdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < 3; i++) {
    const p = doc.addPage([595.28, 841.89])
    p.drawText(`NOVA contract page ${i + 1}`, { x: 60, y: 760, size: 22, font, color: rgb(0.07, 0.24, 0.21) })
    p.drawText('Payment terms: thirty days. Invoice reference INV-2026-00042.', { x: 60, y: 720, size: 12, font })
  }
  const path = resolve(OUT, 'Contract.pdf')
  writeFileSync(path, await doc.save())
  return path
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const consoleErrors = []

async function session(name, { viewport, locale, deviceScaleFactor = 2 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, isMobile: viewport.width < 800, hasTouch: true, locale, colorScheme: 'light' })
  const page = await ctx.newPage()
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[${name}] ${m.text()}`))
  page.on('pageerror', (e) => consoleErrors.push(`[${name}] pageerror ${e.message}`))
  return { ctx, page }
}

const pdfPath = await makePdf()
/** لقطة بعد انتهاء الحركات والتحميل الكسول (لتفادي لقطات باهتة أثناء الانتقال). */
async function shot(page, path) {
  await page.waitForLoadState('networkidle').catch(() => undefined)
  await page.waitForTimeout(450)
  await page.screenshot({ path })
}

// ------------------------------------------------------------------ iPhone (English)
{
  const { ctx, page } = await session('iphone-en', { viewport: { width: 393, height: 852 }, locale: 'en-US', deviceScaleFactor: 3 })
  await step('boot: Documents tab renders', async () => {
    await page.goto(BASE)
    await page.getByRole('heading', { name: 'Documents' }).waitFor({ timeout: 15000 })
    await shot(page, `${OUT}/iphone-01-documents-empty.png`)
  })
  await step('import PDF from Files (picker) and open viewer', async () => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'From Files / iCloud' }).first().click()])
    await chooser.setFiles(pdfPath)
    await page.locator('canvas').first().waitFor({ timeout: 15000 })
    await page.waitForTimeout(1200)
    const painted = await page.evaluate(() => {
      const c = document.querySelector('[data-page="0"] canvas')
      if (!c || c.width < 10) return false
      const d = c.getContext('2d').getImageData(0, 0, c.width, Math.min(c.height, 200)).data
      let dark = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++
      return dark > 50
    })
    if (!painted) throw new Error('page canvas not painted')
    await shot(page, `${OUT}/iphone-02-viewer.png`)
  })
  await step('search inside document', async () => {
    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByPlaceholder('Search in document').fill('thirty')
    await page.getByText('1/3').waitFor({ timeout: 8000 })
    await shot(page, `${OUT}/iphone-03-search.png`)
    await page.getByRole('button', { name: 'Close' }).click()
  })
  await step('paywall blocks Pro editing tool (Free tier)', async () => {
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.locator('button:has-text("Text")').first().click()
    await page.getByText('Unlock for $4.99').waitFor({ timeout: 5000 })
    await shot(page, `${OUT}/iphone-04-paywall.png`)
  })
  await step('purchase (web preview store) unlocks Pro', async () => {
    await page.getByRole('button', { name: 'Unlock for $4.99' }).click()
    await page.getByText('Welcome to NOVA Pro!').waitFor({ timeout: 5000 })
  })
  await step('add text + pen stroke + comment, save (replace)', async () => {
    await page.locator('button:has-text("Text")').first().click()
    const box = await page.locator('[data-page="0"]').boundingBox()
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.35)
    await page.locator('input').last().fill('Approved — NOVA Docs')
    await page.getByRole('button', { name: 'OK' }).click()
    await page.getByText('Approved — NOVA Docs').waitFor({ timeout: 5000 })
    // قلم: سحب على الصفحة
    await page.locator('button:has-text("Pen")').first().click()
    await page.mouse.move(box.x + 60, box.y + box.height * 0.5)
    await page.mouse.down()
    for (let i = 0; i < 20; i++) await page.mouse.move(box.x + 60 + i * 8, box.y + box.height * 0.5 + Math.sin(i / 2) * 12)
    await page.mouse.up()
    await shot(page, `${OUT}/iphone-05-editing.png`)
    await page.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Replace original' }).click()
    await page.getByText('Saved', { exact: true }).waitFor({ timeout: 15000 })
    // التحقق من أن النص أصبح جزءًا من الملف: البحث عنه بعد إعادة التحميل
    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByPlaceholder('Search in document').fill('Approved')
    await page.getByText('1/1').waitFor({ timeout: 8000 })
    await page.getByRole('button', { name: 'Close' }).click()
  })
  await step('PDF tools: merge two documents', async () => {
    await page.getByTestId('nav-back').first().click()
    await page.locator('nav button:has-text("PDF Tools")').click()
    await page.getByRole('heading', { name: 'PDF Tools' }).waitFor()
    await shot(page, `${OUT}/iphone-06-tools.png`)
    await page.locator('button:has-text("Merge PDF")').first().click()
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'From Files / iCloud' }).click()])
    await chooser.setFiles(pdfPath)
    await page.locator('button:has-text("Contract")').first().click()
    await page.getByRole('button', { name: 'Run' }).click()
    await page.getByText(/Saved “Contract \+ 1/).waitFor({ timeout: 15000 })
    await page.locator('[data-page="5"]').waitFor({ timeout: 10000 })
  })
  await step('OCR a scanned page (Tesseract WASM in the web view)', async () => {
    await page.getByTestId('nav-back').first().click()
    await page.locator('nav button:has-text("Scan")').click()
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import photos' }).click()])
    await chooser.setFiles(resolve('tests/fixtures/scan-photo-fr.jpg'))
    await page.getByText('1 page', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('tab', { name: 'Enhanced' }).click()
    await page.waitForTimeout(1500)
    await page.getByRole('switch').click()
    await shot(page, `${OUT}/iphone-07-scan-review.png`)
    await page.getByRole('button', { name: 'Save PDF' }).click()
    await page.locator('[data-page="0"] canvas').waitFor({ timeout: 90000 })
    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByPlaceholder('Search in document').fill('confiance')
    await page.getByText('1/1').waitFor({ timeout: 15000 })
    await shot(page, `${OUT}/iphone-08-ocr-search.png`)
  })
  await step('invoices: create invoice with tax/discount and view it', async () => {
    await page.getByTestId('nav-back').first().click().catch(() => undefined)
    await page.locator('nav button:has-text("Invoices")').click()
    await page.getByRole('heading', { name: 'Invoices', exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'New invoice' }).click()
    await page.getByPlaceholder('Item').fill('Ramette A4')
    const inputs = page.locator('input[inputmode="decimal"]')
    await inputs.nth(0).fill('3')
    await inputs.nth(1).fill('750.50')
    await inputs.nth(2).fill('10')
    await inputs.nth(3).fill('19')
    await shot(page, `${OUT}/iphone-09-invoice-editor.png`)
    const total = await page.getByText('2,411.36 DZD').first().textContent({ timeout: 5000 }) // 2026.35 صافي + 385.01 ضريبة
    if (!total) throw new Error('total not computed')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.locator('iframe').waitFor({ timeout: 10000 })
    await page.waitForTimeout(800)
    await shot(page, `${OUT}/iphone-10-invoice-view.png`)
  })
  await step('more: restore + languages screen', async () => {
    await page.getByTestId('nav-back').first().click().catch(() => undefined)
    await page.locator('nav button:has-text("More")').click()
    await page.getByText('All pro tools are unlocked', { exact: false }).waitFor({ timeout: 5000 })
    await shot(page, `${OUT}/iphone-11-more.png`)
  })
  await step('spreadsheets: create sheet, formulas recalc, formatting, persist', async () => {
    await page.getByText('Spreadsheets', { exact: true }).click()
    await page.getByRole('button', { name: 'New spreadsheet' }).first().click()
    await page.locator('input').last().fill('Budget')
    await page.getByRole('button', { name: 'OK' }).click()
    const formula = page.getByPlaceholder('Formula or value')
    await formula.waitFor({ timeout: 10000 })
    for (const v of ['1250', '749.5', '=SUM(A1:A2)']) { await formula.fill(v); await formula.press('Enter') }
    const sumCell = page.locator('td', { hasText: /^1,?999\.5$/ }).first()
    await sumCell.waitFor({ timeout: 5000 })
    // تنسيق: عريض + عملة + تعبئة على خلية المجموع
    await sumCell.click()
    await page.getByRole('button', { name: 'Bold', exact: true }).click()
    await page.getByRole('button', { name: 'Currency', exact: true }).click()
    await page.getByRole('button', { name: 'Fill colour' }).nth(1).click()
    const styled = page.locator('td.font-bold', { hasText: /1,?999\.50/ }).first()
    await styled.waitFor({ timeout: 5000 })
    const bg = await styled.evaluate((el) => getComputedStyle(el).backgroundColor)
    if (!/255, 243, 176/.test(bg)) throw new Error(`fill not applied: ${bg}`)
    await shot(page, `${OUT}/iphone-12-sheet.png`)
    await page.getByTestId('nav-back').first().click()
    await page.getByText('Budget').first().waitFor({ timeout: 5000 })
  })
  await ctx.close()
}

// ------------------------------------------------------------------ iPhone (Arabic, RTL, dark)
{
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ar-DZ', colorScheme: 'dark' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => consoleErrors.push(`[iphone-ar] pageerror ${e.message}`))
  await step('arabic RTL + dark mode', async () => {
    await page.goto(BASE)
    await page.getByRole('heading', { name: 'المستندات' }).waitFor({ timeout: 15000 })
    const dir = await page.evaluate(() => document.documentElement.dir)
    if (dir !== 'rtl') throw new Error(`dir=${dir}`)
    await shot(page, `${OUT}/iphone-ar-01-documents.png`)
    await page.locator('nav button:has-text("الأدوات"), nav button:has-text("أدوات PDF")').first().click()
    await shot(page, `${OUT}/iphone-ar-02-tools.png`)
    await page.locator('nav button:has-text("المسح")').click()
    await shot(page, `${OUT}/iphone-ar-03-scan.png`)
    await page.locator('nav button:has-text("المزيد")').click()
    await shot(page, `${OUT}/iphone-ar-04-more.png`)
  })
  await ctx.close()
}

// ------------------------------------------------------------------ iPad Pro 13" (French)
{
  const { ctx, page } = await session('ipad-fr', { viewport: { width: 1032, height: 1376 }, locale: 'fr-FR', deviceScaleFactor: 2 })
  await step('iPad layout: sidebar + documents', async () => {
    await page.goto(BASE)
    await page.getByRole('heading', { name: 'Documents' }).waitFor({ timeout: 15000 })
    const sidebar = await page.locator('nav').first().boundingBox()
    if (!sidebar || sidebar.width < 200) throw new Error('no sidebar on iPad')
    await shot(page, `${OUT}/ipad-01-documents.png`)
    await page.getByText('Outils PDF').first().click()
    await shot(page, `${OUT}/ipad-02-tools.png`)
    await page.getByText('Factures').first().click()
    await shot(page, `${OUT}/ipad-03-invoices.png`)
  })
  await ctx.close()
}

await browser.close()
const summary = { passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results, consoleErrors: consoleErrors.slice(0, 50) }
writeFileSync(resolve(OUT, 'smoke-results.json'), JSON.stringify(summary, null, 2))
console.log(`\n${summary.passed} passed, ${summary.failed} failed; console errors: ${consoleErrors.length}`)
for (const e of consoleErrors.slice(0, 15)) console.log('  ', e.slice(0, 300))
process.exit(summary.failed ? 1 : 0)
