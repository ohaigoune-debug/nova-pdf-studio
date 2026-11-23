// يولّد أيقونة التطبيق (1024×1024 بلا شفافية) وصور شاشة الإطلاق (2732×2732) وأيقونات الموقع من brand/nova-icon.svg
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const svg = readFileSync(resolve('brand/nova-icon.svg'), 'utf8')
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ deviceScaleFactor: 1 })

async function render(html, w, h, out) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`)
  await page.screenshot({ path: out, omitBackground: false, clip: { x: 0, y: 0, width: w, height: h } })
  console.log('wrote', out)
}

const icon = svg.replace('width="1024" height="1024"', 'width="1024" height="1024" style="display:block"')
await render(icon, 1024, 1024, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
const splash = `<div style="width:2732px;height:2732px;background:#123D36;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,Helvetica,Arial">
  <div style="width:520px;height:520px;border-radius:118px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35)">${svg.replace('width="1024" height="1024"', 'width="520" height="520"')}</div>
  <div style="margin-top:70px;color:#fff;font-size:120px;font-weight:700;letter-spacing:-2px">NOVA Docs</div>
  <div style="margin-top:18px;color:#7FE3C8;font-size:56px">Your Documents. Your Control.</div></div>`
for (const n of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await render(splash, 2732, 2732, `ios/App/App/Assets.xcassets/Splash.imageset/${n}`)
const rounded = `<div style="width:512px;height:512px;border-radius:115px;overflow:hidden">${svg.replace('width="1024" height="1024"', 'width="512" height="512"')}</div>`
await render(rounded, 512, 512, '../../site/nova-docs/assets/icon-512.png')
await render(icon.replace('width="1024" height="1024"', 'width="180" height="180"'), 180, 180, '../../site/nova-docs/assets/apple-touch-icon.png')
writeFileSync('../../site/nova-docs/assets/icon.svg', svg)
await browser.close()
