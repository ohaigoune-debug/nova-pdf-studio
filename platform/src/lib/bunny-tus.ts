/**
 * رفع TUS 1.0 من المتصفح إلى Bunny Stream مباشرة (https://bunny.net/docs/stream/tus-resumable-uploads).
 * الخادم يعطي توقيعًا لفيديو واحد (createBunnyUploadAction)؛ مفتاح API لا يصل إلى المتصفح أبدًا.
 * قطع 8 MB، ويستأنف من الموضع الذي يعلنه Bunny إن انقطع الاتصال (حتى 5 محاولات لكل قطعة).
 */
export interface TusTicket {
  endpoint: string
  libraryId: string
  videoId: string
  expires: number
  signature: string
}

const CHUNK = 8 * 1024 * 1024

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function tusUpload(file: File, ticket: TusTicket, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  const auth = {
    'Tus-Resumable': '1.0.0',
    AuthorizationSignature: ticket.signature,
    AuthorizationExpire: String(ticket.expires),
    VideoId: ticket.videoId,
    LibraryId: ticket.libraryId
  }
  const created = await fetch(ticket.endpoint, {
    method: 'POST',
    headers: { ...auth, 'Upload-Length': String(file.size), 'Upload-Metadata': `filetype ${b64(file.type || 'video/mp4')},title ${b64(file.name)}` },
    signal
  })
  const location = created.headers.get('Location')
  if (created.status !== 201 || !location) throw new Error(`تعذّر بدء الرفع (${created.status})`)
  const url = new URL(location, ticket.endpoint).toString()

  let offset = 0
  onProgress(0)
  while (offset < file.size) {
    let attempt = 0
    for (;;) {
      try {
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { ...auth, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' },
          body: file.slice(offset, Math.min(file.size, offset + CHUNK)),
          signal
        })
        if (res.status !== 204) throw new Error(`PATCH ${res.status}`)
        offset = Number(res.headers.get('Upload-Offset') ?? offset + CHUNK)
        break
      } catch (err) {
        if (signal?.aborted || ++attempt > 5) throw err instanceof Error ? err : new Error(String(err))
        await sleep(1000 * attempt)
        // أين وصل Bunny فعلًا؟ نكمل من هناك
        const head = await fetch(url, { method: 'HEAD', headers: auth, signal }).catch(() => null)
        const known = Number(head?.headers.get('Upload-Offset'))
        if (Number.isFinite(known) && known >= 0) offset = known
      }
    }
    onProgress(Math.min(1, offset / file.size))
  }
}
