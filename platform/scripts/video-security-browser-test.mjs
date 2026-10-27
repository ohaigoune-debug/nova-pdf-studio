#!/usr/bin/env node
/**
 * Browser regressions for the real React players with deterministic local mocks.
 * No database, real account, Bunny credentials or live provider playback is used.
 * This is NOT evidence of iPhone/WebKit behavior or Bunny token-expiry semantics.
 *
 * Requires Playwright + Chromium and the platform's existing dev dependencies.
 * Optional: CHROMIUM_EXECUTABLE_PATH, VIDEO_BROWSER_EVIDENCE_DIR.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const platform = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(platform, 'package.json'))
const { build } = require('esbuild')
let playwright
try { playwright = require('playwright') } catch {
  throw new Error('Playwright is required. Install it outside this repository and expose it through NODE_PATH; do not change the platform lockfile for this harness.')
}
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'madrasadz-video-browser-'))
const evidence = process.env.VIDEO_BROWSER_EVIDENCE_DIR
  ? path.resolve(process.env.VIDEO_BROWSER_EVIDENCE_DIR)
  : await fs.mkdtemp(path.join(os.tmpdir(), 'madrasadz-video-browser-evidence-'))
await fs.mkdir(evidence, { recursive: true })
const fixtureDirectory = path.join(platform, 'tests/browser-fixtures/video-security')
const cssOutput = path.join(temporary, 'fixture.css')
const jsOutput = path.join(temporary, 'fixture.js')

const bundle = await build({
  entryPoints: [path.join(fixtureDirectory, 'entry.tsx')],
  outfile: jsOutput,
  absWorkingDir: platform,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  target: 'es2022',
  metafile: true,
  alias: { '@': path.join(platform, 'src') },
  define: { 'process.env.NODE_ENV': '"development"' },
  logLevel: 'silent'
})
const fingerprintFiles = [...new Set([
  ...Object.keys(bundle.metafile.inputs).map((input) => path.resolve(platform, input))
    .filter((input) => input.startsWith(path.join(platform, 'src') + path.sep) || input.startsWith(fixtureDirectory + path.sep)),
  path.join(platform, 'src/app/globals.css'),
  path.join(platform, 'tailwind.config.ts'),
  path.join(fixtureDirectory, 'mock-player-sdk.js'),
  fileURLToPath(import.meta.url)
])]
const sourceHashes = Object.fromEntries(await Promise.all(fingerprintFiles.map(async (filename) => [
  path.relative(platform, filename), createHash('sha256').update(await fs.readFile(filename)).digest('hex')
])))
execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '--config', path.join(platform, 'tailwind.config.ts'), '--input', path.join(platform, 'src/app/globals.css'), '--output', cssOutput], { cwd: platform, stdio: ['ignore', 'ignore', 'pipe'] })

const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body style="overflow:auto;min-height:140vh"><div id="fixture-root"></div><script src="/fixture.js"></script></body></html>'
const publicFonts = path.join(platform, 'public/fonts')
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    let filename
    let type
    if (url.pathname === '/fixture.js') { filename = jsOutput; type = 'text/javascript' }
    else if (url.pathname === '/fixture.css') { filename = cssOutput; type = 'text/css' }
    else if (url.pathname === '/fixture.webm') { filename = path.join(fixtureDirectory, 'fixture.webm'); type = 'video/webm' }
    else if (url.pathname.startsWith('/fonts/') && /^[-A-Za-z0-9.]+\.woff2$/.test(path.basename(url.pathname))) { filename = path.join(publicFonts, path.basename(url.pathname)); type = 'font/woff2' }
    else if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(html); return }
    else { res.writeHead(404); res.end(); return }
    const bytes = await fs.readFile(filename)
    res.writeHead(200, { 'content-type': type, 'content-length': bytes.length, 'cache-control': 'no-store' })
    res.end(bytes)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert(address && typeof address === 'object')
const origin = `http://127.0.0.1:${address.port}`
const installedChromium = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync)
const browser = await playwright.chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || installedChromium,
  headless: true,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
})
const results = []
const selectedCase = process.argv.find((argument) => argument.startsWith('--case='))?.slice('--case='.length)

async function poll(check, label, timeout = 5000) {
  const end = Date.now() + timeout
  do {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  } while (Date.now() < end)
  throw new Error(`Timed out: ${label}`)
}

async function fixture(kind, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const heartbeat = { calls: 0, settled: 0 }
  const renewal = { calls: 0 }
  const heartbeatSettled = (request) => {
    if (new URL(request.url()).pathname === '/api/v1/media/heartbeat') heartbeat.settled += 1
  }
  page.on('requestfinished', heartbeatSettled)
  page.on('requestfailed', heartbeatSettled)
  await page.route('**/api/v1/media/heartbeat', async (route) => {
    heartbeat.calls += 1
    const response = options.respond ? options.respond(heartbeat.calls) : { status: 200, body: { ok: true, data: {} } }
    if (response.abort) { await route.abort('failed'); return }
    await route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) })
  })
  await page.route('**/api/v1/media/bunny/refresh', async (route) => {
    renewal.calls += 1
    const expires = Math.floor((await page.evaluate(() => Date.now())) / 1000) + 300
    const response = options.renewRespond ? options.renewRespond(renewal.calls, expires) : { status: 200, body: { ok: true, data: {
      url: `https://iframe.mediadelivery.net/embed/1234/22222222-2222-4222-8222-222222222222?token=fixture-refresh-${renewal.calls}&expires=${expires}&playsinline=true&disableIosPlayer=true`,
      expires
    } } }
    await route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) })
  })
  // No remote provider request is made. The frame is a conspicuous test fixture.
  await page.route('https://iframe.mediadelivery.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body style="background:#17223b;color:white">LOCAL MOCK FRAME — no Bunny stream</body></html>' }))
  const sdk = await fs.readFile(path.join(fixtureDirectory, 'mock-player-sdk.js'), 'utf8')
  await page.route('https://assets.mediadelivery.net/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: sdk }))
  if (options.initScript) await page.addInitScript(options.initScript)
  if (options.clock) await page.clock.install()
  await page.goto(`${origin}/?kind=${kind}`, { waitUntil: 'networkidle' })
  await poll(async () => (await page.locator(kind === 'video' ? 'video' : 'iframe').count()) > 0, 'player render')
  if (kind === 'video') {
    await page.locator('video').evaluate(async (video) => { video.loop = true; video.muted = true; await video.play() })
  }
  return { page, context, heartbeat, renewal, pageErrors }
}

async function test(name, operation) {
  if (selectedCase && !name.includes(selectedCase)) return
  const start = Date.now()
  try {
    const details = await operation()
    results.push({ name, passed: true, elapsedMs: Date.now() - start, ...(details ? { details } : {}) })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, passed: false, elapsedMs: Date.now() - start, error: error.stack ?? String(error) })
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

const smokeOnly = process.argv.includes('--smoke')
const containerSelector = '[data-testid="video-container"]'
const toggleSelector = '[data-testid="video-fullscreen-toggle"]'
const blockedSelector = '[data-testid="video-blocked"]'

async function waitForHeartbeats(run, minimum) {
  try {
    await poll(() => Promise.resolve(run.heartbeat.calls >= minimum), `heartbeat ${minimum}`)
    // Await actual browser network completion, not merely route interception.
    // Advancing 15 virtual seconds while a mocked response is still in transit
    // would manufacture AbortController timeouts under a busy host CPU.
    await poll(() => Promise.resolve(run.heartbeat.settled >= minimum), `settled heartbeat ${minimum}`)
    await run.page.evaluate(() => Promise.resolve())
    await new Promise((resolve) => setTimeout(resolve, 30))
  } catch (error) {
    const state = await run.page.evaluate(() => ({
      hidden: document.hidden,
      frames: document.querySelectorAll('iframe').length,
      blocked: document.querySelector('[data-testid="video-blocked"]')?.textContent ?? null,
      provider: (Reflect.get(window, '__mockBunnyPlayers') ?? []).map((player) => ({
        paused: player.__state.paused, seconds: player.__state.seconds,
        seeks: player.__state.seekCalls, playCalls: player.__state.playCalls
      }))
    }))
    error.message += `; fixture state ${JSON.stringify({ heartbeat: run.heartbeat, renewal: run.renewal, ...state })}`
    throw error
  }
}

async function advanceIntervals(run, count) {
  for (let interval = 0; interval < count; interval += 1) {
    const before = run.heartbeat.calls
    await run.page.clock.runFor(15_050)
    await waitForHeartbeats(run, before + 1)
  }
}

try {
  await test('real React video fixture renders and plays locally', async () => {
    const run = await fixture('video')
    try {
      assert.equal(await run.page.locator('video').count(), 1)
      assert.equal(await run.page.locator('video').evaluate((video) => video.paused), false)
      await poll(() => Promise.resolve(run.heartbeat.calls > 0), 'initial heartbeat')
      assert.deepEqual(run.pageErrors, [])
      await run.page.screenshot({ path: path.join(evidence, 'local-video-fixture.png') })
    } finally { await run.context.close() }
  })
  if (!smokeOnly) {
    await test('container fullscreen keeps the real video and watermark together', async () => {
      const run = await fixture('video')
      try {
        const video = run.page.locator('video')
        assert.match(await video.getAttribute('controlslist'), /nofullscreen/)
        assert.equal(await video.evaluate((element) => element.playsInline), true)
        await run.page.locator(toggleSelector).click()
        await poll(() => run.page.evaluate(() => {
          const fullscreen = document.fullscreenElement
          return Boolean(fullscreen?.querySelector('video') && fullscreen.textContent.includes('LOCAL TEST FIXTURE'))
        }), 'container fullscreen')
        assert.equal(await run.page.evaluate(() => ['VIDEO', 'IFRAME'].includes(document.fullscreenElement.tagName)), false)
        await run.page.screenshot({ path: path.join(evidence, 'container-fullscreen.png') })
        await run.page.locator(toggleSelector).click()
        await poll(() => run.page.evaluate(() => document.fullscreenElement === null), 'fullscreen exit')
        assert.deepEqual(run.pageErrors, [])
      } finally { await run.context.close() }
    })

    await test('Bunny iframe cannot fullscreen itself; the watermarked container can', async () => {
      const run = await fixture('bunny')
      try {
        const frame = run.page.locator('iframe')
        assert.equal(await frame.evaluate((element) => element.hasAttribute('allowfullscreen')), false)
        assert.equal(/(?:^|[;\s])fullscreen(?:[;\s]|$)/.test((await frame.getAttribute('allow')) ?? ''), false)
        await run.page.locator(toggleSelector).click()
        await poll(() => run.page.evaluate(() => Boolean(document.fullscreenElement?.querySelector('iframe') && document.fullscreenElement.textContent.includes('LOCAL TEST FIXTURE'))), 'Bunny container fullscreen')
        await run.page.locator(toggleSelector).click()
        assert.deepEqual(run.pageErrors, [])
      } finally { await run.context.close() }
    })

    await test('CSS fullscreen fallback retains watermark and restores scroll on Escape', async () => {
      const run = await fixture('video', { initScript: () => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
        Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: undefined })
        Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { configurable: true, value: undefined })
        Object.defineProperty(Element.prototype, 'webkitRequestFullScreen', { configurable: true, value: undefined })
      } })
      try {
        await run.page.locator(toggleSelector).click()
        await poll(() => run.page.locator(containerSelector).evaluate((element) => getComputedStyle(element).position === 'fixed'), 'CSS fullscreen fallback')
        assert.equal(await run.page.evaluate(() => document.fullscreenElement), null)
        assert.equal(await run.page.locator(containerSelector).getByText('LOCAL TEST FIXTURE', { exact: true }).count(), 1)
        assert.equal(await run.page.evaluate(() => document.body.style.overflow), 'hidden')
        const rectangle = await run.page.locator(containerSelector).boundingBox()
        assert(rectangle && rectangle.x === 0 && rectangle.y === 0)
        assert(rectangle.width >= 1099 && rectangle.height >= 799)
        await run.page.screenshot({ path: path.join(evidence, 'css-fullscreen-fallback.png') })
        await run.page.keyboard.press('Escape')
        await poll(() => run.page.locator(containerSelector).evaluate((element) => getComputedStyle(element).position !== 'fixed'), 'Escape exits CSS fullscreen')
        assert.equal(await run.page.evaluate(() => document.body.style.overflow), 'auto')
        await run.page.locator(toggleSelector).click()
        await run.page.evaluate(() => Reflect.get(window, '__unmountVideoSecurityFixture')())
        assert.equal(await run.page.evaluate(() => document.body.style.overflow), 'auto')
        assert.deepEqual(run.pageErrors, [])
      } finally { await run.context.close() }
    })

    await test('webkit-prefixed fullscreen contract selects the whole container', async () => {
      const run = await fixture('video', { initScript: () => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', { configurable: true, value: undefined })
        Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: undefined })
        Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, value: null })
        Element.prototype.webkitRequestFullscreen = function () {
          Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, value: this })
          document.dispatchEvent(new Event('webkitfullscreenchange'))
        }
        document.webkitExitFullscreen = () => {
          Object.defineProperty(document, 'webkitFullscreenElement', { configurable: true, value: null })
          document.dispatchEvent(new Event('webkitfullscreenchange'))
        }
      } })
      try {
        await run.page.locator(toggleSelector).click()
        assert.equal(await run.page.evaluate(() => Boolean(document.webkitFullscreenElement?.querySelector('video') && document.webkitFullscreenElement.textContent.includes('LOCAL TEST FIXTURE'))), true)
        await run.page.locator(toggleSelector).click()
        assert.equal(await run.page.evaluate(() => document.webkitFullscreenElement), null)
        assert.deepEqual(run.pageErrors, [])
      } finally { await run.context.close() }
    })

    for (const kind of ['video', 'bunny']) {
      await test(`${kind}: device-limit rejection removes playback immediately and offers reload`, async () => {
        const run = await fixture(kind, { clock: true, respond: (number) => number === 1
          ? { status: 200, body: { ok: true, data: {} } }
          : { status: 403, body: { ok: false, error: { code: 'MEDIA_TOO_MANY_DEVICES', message: 'fixture device limit' } } } })
        try {
          await waitForHeartbeats(run, 1)
          await run.page.clock.runFor(15_050)
          await waitForHeartbeats(run, 2)
          await poll(async () => (await run.page.locator(kind === 'video' ? 'video' : 'iframe').count()) === 0, 'blocked player removed')
          assert.equal(await run.page.locator(blockedSelector).count(), 1)
          assert.equal(await run.page.getByRole('button', { name: 'متابعة', exact: true }).count(), 0)
          const reload = run.page.locator(blockedSelector).getByRole('button')
          assert.equal(await reload.count(), 1)
          let navigations = 0
          run.page.on('framenavigated', (frame) => { if (frame === run.page.mainFrame()) navigations += 1 })
          await reload.click()
          await poll(() => Promise.resolve(navigations > 0), 'explicit reload navigation')
          assert.deepEqual(run.pageErrors, [])
        } finally { await run.context.close() }
      })

      await test(`${kind}: four consecutive heartbeat failures unmount playback`, async () => {
        const run = await fixture(kind, { clock: true, respond: () => ({ status: 503, body: { ok: false, error: { code: 'TEMPORARY_FAILURE' } } }) })
        try {
          await waitForHeartbeats(run, 1)
          for (let number = 2; number <= 3; number += 1) {
            await run.page.clock.runFor(15_050)
            await waitForHeartbeats(run, number)
            assert.equal(await run.page.locator(kind === 'video' ? 'video' : 'iframe').count(), 1)
          }
          await run.page.clock.runFor(15_050)
          await waitForHeartbeats(run, 4)
          await poll(async () => (await run.page.locator(kind === 'video' ? 'video' : 'iframe').count()) === 0, 'four failed heartbeats stop playback')
          assert.equal(await run.page.locator(blockedSelector).count(), 1)
          assert.deepEqual(run.pageErrors, [])
        } finally { await run.context.close() }
      })

      await test(`${kind}: a successful heartbeat resets a short interruption`, async () => {
        const run = await fixture(kind, { clock: true, respond: (number) => number === 4
          ? { status: 200, body: { ok: true, data: {} } }
          : { status: 503, body: { ok: false, error: { code: 'TEMPORARY_FAILURE' } } } })
        try {
          await waitForHeartbeats(run, 1)
          for (let number = 2; number <= 7; number += 1) {
            await run.page.clock.runFor(15_050)
            await waitForHeartbeats(run, number)
            assert.equal(await run.page.locator(kind === 'video' ? 'video' : 'iframe').count(), 1)
          }
          assert.equal(await run.page.locator(blockedSelector).count(), 0)
          await run.page.clock.runFor(15_050)
          await waitForHeartbeats(run, 8)
          await poll(async () => (await run.page.locator(kind === 'video' ? 'video' : 'iframe').count()) === 0, 'four failures after reset stop playback')
          assert.deepEqual(run.pageErrors, [])
        } finally { await run.context.close() }
      })
    }
    for (const paused of [false, true]) {
      await test(`Bunny SDK mock renews beyond original expiry, preserving position and ${paused ? 'paused' : 'playing'} state`, async () => {
        const run = await fixture('bunny', { clock: true })
        try {
          await waitForHeartbeats(run, 1)
          await poll(() => run.page.evaluate(() => (Reflect.get(window, '__mockBunnyPlayers') ?? []).length > 0), 'mock Player.js ready')
          const originalExpiry = Number(new URL(await run.page.locator('iframe').getAttribute('src')).searchParams.get('expires'))
          await run.page.evaluate(({ paused }) => {
            const player = Reflect.get(window, '__mockBunnyPlayers')[0]
            player.__state.seconds = 3721
            player.__state.paused = paused
            player.__emit('timeupdate', { seconds: 3721, duration: 5400 })
            player.__emit(paused ? 'pause' : 'play')
          }, { paused })
          // Run individual virtual intervals and settle each mocked network turn;
          // this is not elapsed real-provider playback or a one-hour stream test.
          await advanceIntervals(run, 22)
          assert((await run.page.evaluate(() => Date.now() / 1000)) > originalExpiry)
          assert(run.renewal.calls >= 1)
          assert.equal(await run.page.locator('iframe').count(), 1)
          assert.equal(await run.page.locator(blockedSelector).count(), 0)
          assert.match(await run.page.locator('iframe').getAttribute('src'), /fixture-refresh-/)
          await poll(() => run.page.evaluate(() => Reflect.get(window, '__mockBunnyPlayers').some((player) => player.__state.seekCalls.includes(3721))), 'SDK seek restored after renewal')
          assert.equal(await run.page.evaluate(() => Reflect.get(window, '__mockBunnyPlayers').at(-1).__state.paused), paused)
          assert.deepEqual(run.pageErrors, [])
        } finally { await run.context.close() }
      })
    }
    for (const denial of [
      { code: 'MEDIA_TOO_MANY_DEVICES', status: 403, message: /حد المشاهدات المتزامنة/ },
      { code: 'AUTH_REQUIRED', status: 401, message: /لم تعد جلسة المشاهدة صالحة/ }
    ]) {
      await test(`Bunny renewal ${denial.code} removes the frame permanently with the correct reason`, async () => {
        const run = await fixture('bunny', { clock: true, renewRespond: () => ({
          status: denial.status, body: { ok: false, error: { code: denial.code, message: 'fixture denial' } }
        }) })
        try {
          await waitForHeartbeats(run, 1)
          await advanceIntervals(run, 16)
          await poll(async () => (await run.page.locator('iframe').count()) === 0, 'renewal denial removes iframe')
          assert.equal(await run.page.locator(blockedSelector).count(), 1)
          assert.match(await run.page.locator(blockedSelector).innerText(), denial.message)
          assert.equal(await run.page.getByRole('button', { name: 'متابعة', exact: true }).count(), 0)
          assert.equal(await run.page.locator(blockedSelector).getByRole('button').count(), 1)
          const renewalCallsAtBlock = run.renewal.calls
          // Late provider events and passing time cannot clear a denied instance.
          await run.page.evaluate(() => {
            for (const player of Reflect.get(window, '__mockBunnyPlayers')) {
              player.__emit('ready')
              player.__emit('play')
              player.__emit('timeupdate', { seconds: 500, duration: 5400 })
            }
          })
          await run.page.clock.runFor(60_000)
          assert.equal(await run.page.locator('iframe').count(), 0)
          assert.equal(run.renewal.calls, renewalCallsAtBlock)
          assert.deepEqual(run.pageErrors, [])
        } finally { await run.context.close() }
      })
    }

    await test('Bunny SDK mock survives fifteen renewals over one virtual hour with position preserved', async () => {
      const run = await fixture('bunny', { clock: true })
      try {
        await waitForHeartbeats(run, 1)
        await poll(() => run.page.evaluate(() => (Reflect.get(window, '__mockBunnyPlayers') ?? []).length > 0), 'mock Player.js ready')
        const startedAt = await run.page.evaluate(() => Date.now())
        for (let cycle = 1; cycle <= 15; cycle += 1) {
          const expectedPosition = 137 + (cycle - 1) * 240
          await run.page.evaluate(({ seconds }) => {
            const player = Reflect.get(window, '__mockBunnyPlayers').at(-1)
            player.__state.seconds = seconds
            player.__state.paused = false
            player.__emit('timeupdate', { seconds, duration: 5400 })
            player.__emit('play')
          }, { seconds: expectedPosition })
          await advanceIntervals(run, 16)
          await poll(() => Promise.resolve(run.renewal.calls >= cycle), `mock renewal ${cycle}`)
          await poll(() => run.page.evaluate((seconds) => Reflect.get(window, '__mockBunnyPlayers').some((player) => player.__state.seekCalls.includes(seconds)), expectedPosition), `position restored in mock renewal ${cycle}`)
          assert.equal(await run.page.locator('iframe').count(), 1)
          assert.equal(await run.page.locator(blockedSelector).count(), 0)
          assert.equal(await run.page.evaluate(() => Reflect.get(window, '__mockBunnyPlayers').at(-1).__state.paused), false)
        }
        const elapsed = (await run.page.evaluate(() => Date.now())) - startedAt
        assert(elapsed >= 3_600_000)
        assert.equal(run.renewal.calls, 15)
        assert.deepEqual(run.pageErrors, [])
        return { renewalCount: run.renewal.calls, positionChecks: 15, virtualElapsedMs: elapsed, realProviderPlayback: false }
      } finally { await run.context.close() }
    })
  }
} finally {
  const chromiumVersion = browser.version()
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
  const sourceChangedDuringRun = []
  for (const [relative, expected] of Object.entries(sourceHashes)) {
    const actual = createHash('sha256').update(await fs.readFile(path.join(platform, relative))).digest('hex')
    if (actual !== expected) sourceChangedDuringRun.push(relative)
  }
  const report = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    chromiumVersion,
    environment: 'headless Chromium; local real React components; mocked API/provider',
    notVerified: ['real Bunny signed-token expiry or one-hour playback', 'iPhone/Safari/WebKit fullscreen', 'DRM or network-level revocation'],
    knownLimitations: ['The SDK double emits ready deterministically. Real provider readiness after iframe navigation is not verified; the component has no separate provider-ready deadline, so a missing real ready event may leave renewal pending.'],
    selectedCase: selectedCase ?? null,
    smokeOnly,
    sourceHashes,
    sourceChangedDuringRun,
    results
  }
  await fs.writeFile(path.join(evidence, 'browser-results.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(`Browser evidence: ${evidence}`)
  process.exitCode = results.length === 0 || results.some((result) => !result.passed) || sourceChangedDuringRun.length > 0 ? 1 : 0
  await fs.rm(temporary, { recursive: true, force: true })
}
