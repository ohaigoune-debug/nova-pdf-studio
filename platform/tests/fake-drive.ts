/** Google Drive مزيّف لاختبارات القراءة: مجلدات وملفات في الذاكرة خلف fetch */
export interface FakeFile {
  id: string
  name: string
  mimeType: string
  text?: string
  bytes?: Uint8Array
  parent: string
}

export function fakeDrive(folders: Record<string, string>, files: FakeFile[], opts: { key?: string; shared?: boolean } = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (url.searchParams.get('key') !== (opts.key ?? 'test-key')) return new Response('{"error":{"message":"API key not valid"}}', { status: 400 })
    if (opts.shared === false) return new Response('{"error":{"code":404}}', { status: 404 })
    const parts = url.pathname.replace('/drive/v3/', '').split('/')
    if (parts[0] === 'files' && parts.length === 1) {
      const parent = /'([^']+)' in parents/.exec(url.searchParams.get('q') ?? '')?.[1] ?? ''
      const inFolder = [
        ...Object.entries(folders)
          .filter(([id]) => id.startsWith(`${parent}/`))
          .map(([id, name]) => ({ id, name, mimeType: 'application/vnd.google-apps.folder', modifiedTime: '2026-09-01T00:00:00Z' })),
        ...files.filter((f) => f.parent === parent).map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: '2026-09-01T00:00:00Z' }))
      ]
      return Response.json({ files: inFolder })
    }
    const id = decodeURIComponent(parts[1] ?? '')
    if (parts[2] === 'export') {
      const f = files.find((x) => x.id === id)
      return f ? new Response(f.text ?? '') : new Response('', { status: 404 })
    }
    if (url.searchParams.get('alt') === 'media') {
      const f = files.find((x) => x.id === id)
      return f ? new Response(f.bytes ? Buffer.from(f.bytes) : (f.text ?? '')) : new Response('', { status: 404 })
    }
    if (folders[id] !== undefined) return Response.json({ id, name: folders[id], mimeType: 'application/vnd.google-apps.folder' })
    const f = files.find((x) => x.id === id)
    return f ? Response.json({ id, name: f.name, mimeType: f.mimeType }) : new Response('', { status: 404 })
  }) as typeof fetch
}

export const LESSON_IMAGERY = `درس الصور البيانية
التشبيه هو إلحاق أمر بأمر في صفة مشتركة بينهما بأداة، وأركانه أربعة: المشبه والمشبه به وأداة التشبيه ووجه الشبه.
الاستعارة تشبيه حذف أحد طرفيه، فإن صرّح بالمشبه به فهي استعارة تصريحية، وإن حذف وبقي شيء من لوازمه فهي استعارة مكنية.
الكناية لفظ أطلق وأريد به لازم معناه مع جواز إرادة المعنى الأصلي، ومن أمثلتها قولهم فلان كثير الرماد.`

export const LESSON_OTHER = `درس العروض
البحر الطويل من أشهر بحور الشعر العربي، وتفعيلاته فعولن مفاعيلن فعولن مفاعيلن في كل شطر من البيت.`
