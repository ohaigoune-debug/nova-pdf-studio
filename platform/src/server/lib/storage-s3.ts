import { createHash, createHmac } from 'node:crypto'
import type { RangeRead, StorageAdapter } from './storage'

/**
 * محوّل تخزين متوافق مع S3 (AWS S3, Cloudflare R2, MinIO, Supabase Storage S3, Backblaze B2)
 * بتوقيع AWS Signature V4 عبر `fetch` فقط — بلا SDK. يُفعَّل بـ STORAGE_DRIVER=s3.
 */
export interface S3Config {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** مثال: https://<account>.r2.cloudflarestorage.com أو http://localhost:9000 */
  endpoint?: string
  /** مسار بدل النطاق الفرعي (إلزامي لـ MinIO/R2/Supabase) */
  forcePathStyle?: boolean
  sessionToken?: string
}

const sha256hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data, 'utf8').digest()

/** ترميز مسار S3: كل مقطع بـ RFC3986 مع إبقاء '/' */
export function encodeS3Path(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()))
    .join('/')
}

export interface SignV4Input {
  method: string
  host: string
  /** مسار مرمّز يبدأ بـ '/' */
  path: string
  query?: Record<string, string>
  headers: Record<string, string>
  payloadHash: string
  date: Date
  region: string
  service?: string
  accessKeyId: string
  secretAccessKey: string
}

export function amzDate(d: Date): { amz: string; day: string } {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amz: iso, day: iso.slice(0, 8) }
}

/** توقيع SigV4 (دالة نقية قابلة للاختبار بمتجهات AWS الرسمية) */
export function signV4(input: SignV4Input): { authorization: string; signedHeaders: string; amzDate: string } {
  const service = input.service ?? 's3'
  const { amz, day } = amzDate(input.date)
  const headers: Record<string, string> = { ...input.headers, host: input.host, 'x-amz-date': amz, 'x-amz-content-sha256': input.payloadHash }
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, ' ')]))
  const signedHeaders = Object.keys(lower).sort().join(';')
  const canonicalHeaders = Object.keys(lower)
    .sort()
    .map((k) => `${k}:${lower[k]}\n`)
    .join('')
  const canonicalQuery = Object.keys(input.query ?? {})
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(input.query![k] ?? '')}`)
    .join('&')
  const canonicalRequest = [input.method.toUpperCase(), input.path, canonicalQuery, canonicalHeaders, signedHeaders, input.payloadHash].join('\n')
  const scope = `${day}/${input.region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256hex(canonicalRequest)].join('\n')
  const kDate = hmac(`AWS4${input.secretAccessKey}`, day)
  const kRegion = hmac(kDate, input.region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  return { authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, signedHeaders, amzDate: amz }
}

export class S3StorageAdapter implements StorageAdapter {
  constructor(private readonly cfg: S3Config) {}

  private target(key: string): { url: string; host: string; path: string } {
    const encodedKey = encodeS3Path(key)
    const endpoint = this.cfg.endpoint?.replace(/\/$/, '')
    const pathStyle = this.cfg.forcePathStyle ?? !!endpoint
    if (pathStyle) {
      const base = endpoint ?? `https://s3.${this.cfg.region}.amazonaws.com`
      const host = new URL(base).host
      const path = `/${this.cfg.bucket}/${encodedKey}`
      return { url: `${base}${path}`, host, path }
    }
    const host = endpoint ? `${this.cfg.bucket}.${new URL(endpoint).host}` : `${this.cfg.bucket}.s3.${this.cfg.region}.amazonaws.com`
    const proto = endpoint ? new URL(endpoint).protocol : 'https:'
    return { url: `${proto}//${host}/${encodedKey}`, host, path: `/${encodedKey}` }
  }

  private async request(method: 'PUT' | 'GET' | 'DELETE' | 'HEAD', key: string, body?: Buffer, extraHeaders: Record<string, string> = {}): Promise<Response> {
    const t = this.target(key)
    const payloadHash = sha256hex(body ?? '')
    const headers: Record<string, string> = { ...extraHeaders }
    if (this.cfg.sessionToken) headers['x-amz-security-token'] = this.cfg.sessionToken
    const signed = signV4({ method, host: t.host, path: t.path, headers, payloadHash, date: new Date(), region: this.cfg.region, accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey })
    const res = await fetch(t.url, {
      method,
      headers: { ...headers, 'x-amz-date': signed.amzDate, 'x-amz-content-sha256': payloadHash, authorization: signed.authorization },
      body: body ? new Uint8Array(body) : undefined
    })
    return res
  }

  async put(key: string, data: Buffer): Promise<void> {
    const res = await this.request('PUT', key, data, { 'content-type': 'application/octet-stream', 'content-length': String(data.length) })
    if (!res.ok) throw new Error(`s3 put failed: ${res.status}`)
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.request('GET', key)
    if (!res.ok) throw new Error(`s3 get failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  async remove(key: string): Promise<void> {
    const res = await this.request('DELETE', key)
    if (!res.ok && res.status !== 404) throw new Error(`s3 delete failed: ${res.status}`)
  }

  async size(key: string): Promise<number | null> {
    const res = await this.request('HEAD', key)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`s3 head failed: ${res.status}`)
    const len = Number(res.headers.get('content-length'))
    return Number.isFinite(len) ? len : null
  }

  /** بثّ جزئي: S3 يدعم Range أصلاً، نمرّر التيار كما هو */
  async getRange(key: string, start: number, end?: number): Promise<RangeRead> {
    const res = await this.request('GET', key, undefined, { range: `bytes=${start}-${end ?? ''}` })
    if (!res.ok || !res.body) throw new Error(`s3 range get failed: ${res.status}`)
    const cr = res.headers.get('content-range') // bytes s-e/size
    const m = cr?.match(/bytes (\d+)-(\d+)\/(\d+)/)
    const size = m ? Number(m[3]) : Number(res.headers.get('content-length'))
    const s = m ? Number(m[1]) : start
    const e = m ? Number(m[2]) : size - 1
    return { stream: res.body, size, start: s, end: e }
  }

  /** رفع تياري عبر الخادم: S3 يتطلب طولاً معروفاً للتوقيع؛ نجمّع في الذاكرة حتى الحد ثم PUT واحد */
  async putStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<number> {
    const chunks: Uint8Array[] = []
    let total = 0
    const reader = body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) throw new Error('FILE_TOO_LARGE')
      chunks.push(value)
    }
    await this.put(key, Buffer.concat(chunks))
    return total
  }

  /**
   * رابط رفع مباشر من المتصفح (Presigned PUT، SigV4 query-string). المتصفح يرفع إلى S3 مباشرة،
   * فلا يمرّ الفيديو الكبير عبر خادم التطبيق. يجب ضبط CORS على الحاوية (PUT من نطاق التطبيق).
   */
  async presignPut(key: string, contentType: string, contentLength: number, ttlSeconds: number) {
    const t = this.target(key)
    const now = new Date()
    const { amz, day } = amzDate(now)
    const scope = `${day}/${this.cfg.region}/s3/aws4_request`
    const signedHeaders = 'content-length;content-type;host'
    const query: Record<string, string> = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.cfg.accessKeyId}/${scope}`,
      'X-Amz-Date': amz,
      'X-Amz-Expires': String(ttlSeconds),
      'X-Amz-SignedHeaders': signedHeaders
    }
    if (this.cfg.sessionToken) query['X-Amz-Security-Token'] = this.cfg.sessionToken
    const enc = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${enc(k)}=${enc(query[k]!)}`)
      .join('&')
    const canonicalHeaders = `content-length:${contentLength}\ncontent-type:${contentType}\nhost:${t.host}\n`
    const canonicalRequest = ['PUT', t.path, canonicalQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n')
    const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256hex(canonicalRequest)].join('\n')
    const kDate = hmac('AWS4' + this.cfg.secretAccessKey, day)
    const kRegion = hmac(kDate, this.cfg.region)
    const kService = hmac(kRegion, 's3')
    const kSigning = hmac(kService, 'aws4_request')
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
    return { url: `${t.url}?${canonicalQuery}&X-Amz-Signature=${signature}`, headers: { 'Content-Type': contentType, 'Content-Length': String(contentLength) } }
  }
}

export function s3ConfigFromEnv(): S3Config | null {
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) return null
  return {
    bucket,
    region: process.env.S3_REGION ?? 'auto',
    accessKeyId,
    secretAccessKey,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE ? process.env.S3_FORCE_PATH_STYLE === '1' : undefined,
    sessionToken: process.env.S3_SESSION_TOKEN || undefined
  }
}
