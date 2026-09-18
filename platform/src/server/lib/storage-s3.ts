import { createHash, createHmac } from 'node:crypto'
import type { StorageAdapter } from './storage'

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

  private async request(method: 'PUT' | 'GET' | 'DELETE', key: string, body?: Buffer, extraHeaders: Record<string, string> = {}): Promise<Response> {
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
