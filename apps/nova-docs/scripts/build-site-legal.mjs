// يولّد site/nova-docs/privacy.html و terms.html و support.html من نفس نصوص التطبيق (src/lib/legal.ts) حتى لا تختلف النسختان
import { transformSync } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const code = transformSync(readFileSync(resolve('src/lib/legal.ts'), 'utf8'), { loader: 'ts', format: 'esm' }).code
const { LEGAL } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const out = resolve('../../site/nova-docs')
const style = `body{margin:0;font-family:-apple-system,"Segoe UI","Noto Naskh Arabic",Tahoma,sans-serif;background:#F5F7F6;color:#0E1F1B;line-height:1.7}
main{max-width:760px;margin:auto;padding:32px 20px}h1{color:#123D36}section{background:#fff;border-radius:16px;padding:20px 24px;margin:18px 0}a{color:#17B890}
.lang a{margin-inline-end:12px}.top{display:flex;align-items:center;gap:10px}.top img{width:40px;height:40px;border-radius:10px}`
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — NOVA Docs</title><link rel="icon" href="assets/icon.svg"><style>${style}</style></head><body><main>
<div class="top"><img src="assets/icon-512.png" alt=""><a href="index.html"><b>NOVA Docs</b></a></div>${body}<p style="color:#5F6F6B;font-size:13px">Last updated: 2026-11-16 · NOVA Docs: PDF & Invoices 1.0.0</p></main></body></html>`
for (const doc of ['privacy', 'terms']) {
  const body = ['en', 'fr', 'ar'].map((l) => {
    const d = LEGAL[doc][l]
    return `<section lang="${l}" dir="${l === 'ar' ? 'rtl' : 'ltr'}" id="${l}"><h1>${d.title}</h1>${d.body.map((p) => `<p>${p}</p>`).join('')}</section>`
  }).join('\n')
  writeFileSync(resolve(out, `${doc}.html`), page(LEGAL[doc].en.title, `<p class="lang"><a href="#en">English</a><a href="#fr">Français</a><a href="#ar">العربية</a></p>${body}`))
}
const support = `<section><h1>Support</h1><p>NOVA Docs works fully offline. For help, write to the support address shown in the app (More → Support) — answers in Arabic, French or English, usually within 48 hours.</p>
<h3>Restore NOVA Pro</h3><p>Open the app → More → Restore purchases, signed in with the same Apple ID used for the purchase.</p>
<h3>Refunds</h3><p>Refunds are handled by Apple: reportaproblem.apple.com or More → Request a refund in the app.</p>
<h3>Where are my files?</h3><p>Open the Files app → On My iPhone/iPad → NOVA Docs. Nothing is uploaded to any server.</p></section>
<section dir="rtl" lang="ar"><h1>الدعم</h1><p>يعمل NOVA Docs دون إنترنت. للمساعدة راسل عنوان الدعم الظاهر في التطبيق (المزيد ← الدعم).</p><h3>استعادة NOVA Pro</h3><p>المزيد ← استعادة المشتريات، بنفس حساب Apple المستعمل في الشراء.</p><h3>الاسترداد</h3><p>تتولاه Apple عبر reportaproblem.apple.com أو من التطبيق: المزيد ← طلب استرداد المبلغ.</p><h3>أين ملفاتي؟</h3><p>تطبيق الملفات ← على iPhone/iPad ← NOVA Docs. لا يُرفع أي ملف.</p></section>
<section lang="fr"><h1>Assistance</h1><p>NOVA Docs fonctionne hors ligne. Écrivez à l’adresse indiquée dans l’app (Plus → Assistance). Restauration : Plus → Restaurer les achats. Remboursements : gérés par Apple. Vos fichiers : app Fichiers → Sur mon iPhone/iPad → NOVA Docs.</p></section>`
writeFileSync(resolve(out, 'support.html'), page('Support', support))
console.log('site legal pages written')
