/** موقع DzExams مزيّف للاختبارات: الصفحات كما يتوقّعها الزاحف */
export const B = 'https://www.dzexams.com'
export const pages: Record<string, string> = {
  [`${B}/ar/bac`]: `<nav><a href="/ar/bac/arabe">اللغة العربية وآدابها</a><a href="/ar/bac/physique" title="الفيزياء"><img src="x.png"></a><a href="/fr/bac/arabe">Arabe</a></nav>`,
  [`${B}/ar/bac/arabe`]: `<a href="/ar/bac/arabe/lp">شعبة آداب وفلسفة</a>
    <a href="/ar/annales/AAA111=="><img></a><a href="/ar/annales/AAA111==">موضوع اللغة العربية شعبة ل.أ مع التصحيح – بكالوريا 2024</a>
    <a href="/ar/bac/arabe?page=2">2</a>`,
  [`${B}/ar/bac/arabe?page=2`]: `<a href="https://www.dzexams.com/ar/annales/BBB222==">موضوع اللغة العربية شعبة علمية – بكالوريا 2019</a>`,
  [`${B}/ar/bac/arabe/lp`]: `<a href="/ar/annales/AAA111==">موضوع اللغة العربية – بكالوريا 2024</a>`,
  [`${B}/ar/bac/physique`]: `<p>لا مواضيع</p>`,
  [`${B}/ar/annales/AAA111==`]: `<h1>موضوع اللغة العربية شعبة ل.أ مع التصحيح – بكالوريا 2024</h1>
    <a href="https://cdn.dzexams.com/bac/arabe-2024-lp.pdf" class="btn">تحميل الموضوع</a>
    <a href="/download/arabe-2024-lp-corrige.pdf">تحميل التصحيح</a>`,
  [`${B}/ar/annales/BBB222==`]: `<h1>موضوع 2019</h1><iframe src="https://cdn.dzexams.com/viewer/bac-2019-arabe.pdf"></iframe>`
}
export const fakeSite = (async (u: RequestInfo | URL, init?: RequestInit) => {
  // كما يفعل fetch الحقيقي: ترويسة بحرف غير لاتيني ترمي خطأ
  new Headers(init?.headers)
  const html = pages[String(u)]
  return html === undefined ? new Response('not found', { status: 404 }) : new Response(html, { headers: { 'content-type': 'text/html' } })
}) as typeof fetch
