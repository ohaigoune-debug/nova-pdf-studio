/**
 * عميل EcoTrack (منصّات ecotrack.dz ذات العلامة البيضاء: لكل تاجر رابط خاص https://<شركة>.ecotrack.dz ورمز Bearer).
 * منقول من NOVA COMMERCE (packages/core/src/shipping/ecotrack.ts) بالمنطق نفسه:
 *   GET    api/v1/get/wilayas            فحص الرمز + الولايات
 *   GET    api/v1/get/communes           { id: { nom, wilaya_id, has_stop_desk } }
 *   GET    api/v1/get/fees               رسوم التوصيل لكل ولاية
 *   POST   api/v1/create/order           → { success, tracking }
 *   GET    api/v1/get/orders?tracking=   الطلب وحالته والسائق
 *   GET    api/v1/get/tracking/info?tracking=  سجلّ الأحداث
 *   DELETE api/v1/delete/order?tracking= → { delete: "success" | "fail" } (HTTP 200 في الحالين!)
 * لا webhooks لدى EcoTrack: التتبّع بالاستطلاع الدوري (مهمة ECOTRACK_SYNC).
 * حدّ الطلبات: 429 يُعاد بعد 2/5/10 ثوانٍ؛ وميزانية X-RateLimit-Remaining (~15000/يوم) نحتفظ منها باحتياطي للعمل اليدوي.
 */

export interface EcotrackCredentials {
  baseUrl: string
  apiToken: string
}

/** الحالات الموحّدة للشحنة (نسق NOVA) */
export type EcotrackShipmentStatus = 'created' | 'picked_up' | 'in_transit' | 'at_agency' | 'out_for_delivery' | 'delivered' | 'failed_attempt' | 'returned' | 'canceled'

export interface EcotrackCreateInput {
  orderNumber: string
  fullName: string
  phone: string
  phone2?: string | null
  address: string
  wilayaCode: string
  communeName: string
  /** المبلغ المحصَّل عند التسليم بالدينار */
  codAmountDzd: number
  productsSummary: string
  notes?: string | null
  deliveryType?: 'HOME' | 'DESK'
  allowOpen?: boolean
  isExchange?: boolean
}

export interface EcotrackTrackingEvent {
  status: EcotrackShipmentStatus
  description: string
  location: string | null
  occurredAt: Date
}

export interface EcotrackTracking {
  trackingNumber: string
  status: EcotrackShipmentStatus
  events: EcotrackTrackingEvent[]
  driverName: string | null
  driverPhone: string | null
  carrierStatusLabel: string | null
  feeDzd: number | null
}

export interface EcotrackFee {
  wilayaCode: string
  homeDzd: number
  deskDzd: number
  returnDzd: number
}

export class EcotrackError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message)
    this.name = 'EcotrackError'
  }
}

const RESERVED_FOR_WORK = 1500
const BUDGET_TTL_MS = 30 * 60_000
const CACHE_TTL_MS = 10 * 60_000
const budget = new Map<string, { remaining: number; at: number }>()
const communeCache = new Map<string, { at: number; rows: { id: string; nom: string; wilaya: string }[] }>()
const feeCache = new Map<string, { at: number; rows: Record<string, unknown>[] }>()

export function ecotrackBaseUrl(raw: string): string {
  const v = (raw ?? '').trim().replace(/\/+$/, '')
  if (!v) throw new EcotrackError('EcoTrack: baseUrl is required')
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

const keyOf = (c: EcotrackCredentials) => `${ecotrackBaseUrl(c.baseUrl)}|${c.apiToken.slice(-8)}`

/** 213xxxxxxxxx / +213… → 0xxxxxxxxx كما تتوقّعه EcoTrack */
export function localPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('213') && digits.length >= 12) return `0${digits.slice(3)}`
  if (digits.length === 9) return `0${digits}`
  return digits
}

function parseDate(v: unknown): Date {
  if (!v) return new Date()
  const d = new Date(String(v).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? new Date() : d
}

/** تطبيع اسم البلدية للمطابقة: بلا تشكيل لاتيني ولا فراغات ولا شُرط، أحرف صغيرة */
export function communeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * حالات EcoTrack نصّ فرنسي حرّ يختلف قليلاً بين المنصّات ("livré_non_encaissé"، "Livré"، "Encaissé"، "Tentative échouée"، "Retourné au vendeur").
 * ترتيب الفحص مهم: "retour" قبل "livr"، و"échou"/"tentative" قبل "sorti".
 */
export function mapEcotrackStatus(label: string): EcotrackShipmentStatus | null {
  const s = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/_/g, ' ')
    .trim()
  if (!s) return null
  if (/supprim|annul|cancel/.test(s)) return 'canceled'
  // كل مراحل "retour_*" تعني انتهاء التوصيل وعودة الطرد: مرتجع لا «محاولة فاشلة أخرى»
  if (/retour/.test(s)) return 'returned'
  if (/echou|tentative|absent|injoignable|reporte|alerte|suspend/.test(s)) return 'failed_attempt'
  if (/livre|encaiss|paye/.test(s)) return 'delivered'
  if (/sorti|en livraison|out for delivery/.test(s)) return 'out_for_delivery'
  if (/recu a wilaya|centre|agence|hub|arrive|au bureau|en attente du client|pret pour retrait/.test(s)) return 'at_agency'
  // "prête à expédier": ما زال الطرد عند الشركة لم يتحرّك
  if (/pret.? a expedier|a expedier|pret.? pour expedition/.test(s)) return 'created'
  if (/transit|vers wilaya|expedie|en route|dispatch|transfer/.test(s)) return 'in_transit'
  if (/ramass|collect|pick/.test(s)) return 'picked_up'
  if (/prepar|nouveau|cree|valid|en attente|pending|new/.test(s)) return 'created'
  return null
}

export class EcotrackClient {
  constructor(
    private readonly creds: EcotrackCredentials,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
  ) {
    if (!(creds.apiToken ?? '').trim()) throw new EcotrackError('EcoTrack: apiToken is required')
  }

  /** طلب واحد مع معالجة 429 حيث يقع: إرسال عشرة طرود متتالية عمل عادي، فالإعادة هنا لا عند المستدعي */
  private async call<T = unknown>(method: 'GET' | 'POST' | 'DELETE', path: string, params?: Record<string, string | number | null | undefined>, body?: unknown): Promise<T> {
    const url = new URL(`${ecotrackBaseUrl(this.creds.baseUrl)}/${path.replace(/^\//, '')}`)
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    let lastRateLimit = ''
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await this.fetchImpl(url, {
        method,
        headers: { Authorization: `Bearer ${this.creds.apiToken.trim()}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json; charset=utf-8' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000)
      })
      const text = await res.text()
      const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? NaN)
      if (Number.isFinite(remaining)) budget.set(keyOf(this.creds), { remaining, at: Date.now() })
      if (res.status === 429) {
        lastRateLimit = text.slice(0, 200)
        if (attempt === 3) break
        const retryAfter = Number(res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-reset') ?? 0)
        const waitMs = retryAfter > 0 && retryAfter < 120 ? retryAfter * 1000 : [2000, 5000, 10_000][attempt]!
        await this.sleep(waitMs)
        continue
      }
      if (res.status === 401 || res.status === 403) throw new EcotrackError(`EcoTrack rejected the token (${res.status})`, res.status)
      if (res.status === 404) throw new EcotrackError('EcoTrack: endpoint not found (check the platform URL)', 404)
      if (!res.ok) throw new EcotrackError(`EcoTrack error ${res.status}: ${text.slice(0, 200)}`, res.status)
      if (!text.trim()) return {} as T
      try {
        return JSON.parse(text) as T
      } catch {
        throw new EcotrackError(`EcoTrack: unexpected non-JSON response: ${text.slice(0, 120)}`, res.status)
      }
    }
    throw new EcotrackError(`EcoTrack error 429: ${lastRateLimit || 'Too Many Attempts'}`, 429)
  }

  async validate(): Promise<{ ok: true; wilayas: number } | { ok: false; message: string }> {
    try {
      const res = await this.call<unknown>('GET', 'api/v1/get/wilayas')
      const n = Array.isArray(res) ? res.length : res && typeof res === 'object' ? Object.keys(res as object).length : 0
      return { ok: true, wilayas: n }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'EcoTrack validation failed' }
    }
  }

  /** الاستطلاع الدوري يتوقّف قبل نفاد الميزانية؛ إنشاء الطرود لا يتوقّف أبداً */
  pollingAllowed(): boolean {
    const b = budget.get(keyOf(this.creds))
    if (!b || Date.now() - b.at > BUDGET_TTL_MS) return true
    return b.remaining > RESERVED_FOR_WORK
  }

  private async communes(): Promise<{ id: string; nom: string; wilaya: string }[]> {
    const k = keyOf(this.creds)
    const hit = communeCache.get(k)
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.rows
    const res = await this.call<Record<string, Record<string, unknown>>>('GET', 'api/v1/get/communes')
    const rows = Object.entries(res ?? {})
      .filter(([, c]) => c && typeof c === 'object')
      .map(([id, c]) => ({ id: String(c.id ?? id), nom: String(c.nom ?? ''), wilaya: String(c.wilaya_id ?? '') }))
      .filter((c) => c.nom)
    communeCache.set(k, { at: Date.now(), rows })
    return rows
  }

  /** EcoTrack تطابق البلدية بالإملاء الدقيق: نحلّ اسمنا إلى مدخلها هي في الولاية نفسها ونرسل اسمها ومعرّفها */
  async resolveCommune(wilayaCode: string, name: string): Promise<{ id: string; nom: string } | null> {
    let rows: { id: string; nom: string; wilaya: string }[]
    try {
      rows = (await this.communes()).filter((c) => c.wilaya === String(Number(wilayaCode)))
    } catch {
      return null
    }
    if (!rows.length || !name.trim()) return null
    const want = communeKey(name)
    if (!want) return null
    const exact = rows.find((c) => communeKey(c.nom) === want)
    if (exact) return { id: exact.id, nom: exact.nom }
    const partial = rows.find((c) => communeKey(c.nom).includes(want) || want.includes(communeKey(c.nom)))
    return partial ? { id: partial.id, nom: partial.nom } : null
  }

  /** بلديات ولاية (لقائمة الاختيار في صفحة الطلب) */
  async communesOf(wilayaCode: string): Promise<{ name: string; hasDesk: boolean }[]> {
    const res = await this.call<Record<string, Record<string, unknown>>>('GET', 'api/v1/get/communes')
    return Object.values(res ?? {})
      .filter((c) => c && typeof c === 'object' && String(c.wilaya_id ?? '') === String(Number(wilayaCode)))
      .map((c) => ({ name: String(c.nom ?? ''), hasDesk: Boolean(Number(c.has_stop_desk ?? c.stop_desk ?? 0)) }))
      .filter((c) => c.name)
  }

  /** حمولة إنشاء الطرد (تُفصَل لتُختبر بلا شبكة) */
  static buildCreatePayload(input: EcotrackCreateInput, matched: { id: string; nom: string } | null): Record<string, unknown> {
    const communeName = matched?.nom ?? input.communeName
    return {
      reference: input.orderNumber,
      nom_client: input.fullName,
      telephone: localPhone(input.phone),
      telephone_2: input.phone2 ? localPhone(input.phone2) : '',
      adresse: input.address || communeName,
      commune: communeName,
      ...(matched ? { commune_id: matched.id } : {}),
      code_wilaya: Number(input.wilayaCode),
      montant: Math.max(0, Math.round(input.codAmountDzd)),
      remarque: [input.notes ?? '', input.allowOpen ? 'Ouverture autorisée' : ''].filter(Boolean).join(' | '),
      produit: input.productsSummary.slice(0, 250),
      type: input.isExchange ? 2 : 1,
      stop_desk: input.deliveryType === 'DESK' ? 1 : 0,
      stock: 0,
      quantite: 1,
      can_open: input.allowOpen ? 1 : 0
    }
  }

  async createOrder(input: EcotrackCreateInput): Promise<{ tracking: string; raw: Record<string, unknown> }> {
    const matched = await this.resolveCommune(input.wilayaCode, input.communeName).catch(() => null)
    const res = await this.call<Record<string, unknown>>('POST', 'api/v1/create/order', undefined, EcotrackClient.buildCreatePayload(input, matched))
    const nested = res.data as Record<string, unknown> | undefined
    const tracking = String(res.tracking ?? nested?.tracking ?? '').trim()
    if (!tracking || res.success === false) {
      const msg = typeof res.message === 'string' ? res.message : JSON.stringify(res).slice(0, 200)
      throw new EcotrackError(`EcoTrack did not return a tracking number: ${msg}`)
    }
    return { tracking, raw: res }
  }

  /** DELETE (POST يجيب 405)؛ الجسم يقول success|fail مع HTTP 200 في الحالين */
  async deleteOrder(tracking: string): Promise<boolean> {
    const res = await this.call<Record<string, unknown>>('DELETE', 'api/v1/delete/order', { tracking })
    return res.delete === 'success' || res.success === true
  }

  private async orderRecord(tracking: string): Promise<Record<string, unknown> | null> {
    const page = await this.call<{ data?: unknown }>('GET', 'api/v1/get/orders', { tracking })
    const rows = (Array.isArray(page.data) ? page.data : page.data && typeof page.data === 'object' ? Object.values(page.data as Record<string, unknown>) : []) as Record<string, unknown>[]
    return rows.find((o) => String(o.tracking ?? '') === tracking) ?? rows[0] ?? null
  }

  /**
   * `knownStatus` يسمح بتخطّي سجلّ الأحداث حين لم يتحرّك شيء: نداءان لكل طرد كل بضع دقائق هو ما يستنزف الحدّ.
   */
  async tracking(trackingNumber: string, knownStatus?: string | null): Promise<EcotrackTracking> {
    const events: EcotrackTrackingEvent[] = []
    let status: EcotrackShipmentStatus | null = null
    let driverName: string | null = null
    let driverPhone: string | null = null
    let carrierStatusLabel: string | null = null
    let feeDzd: number | null = null
    const readRow = (row: Record<string, unknown>) => {
      driverName = String(row.driver_name ?? '').trim() || null
      driverPhone = String(row.driver_phone ?? '').trim() || null
      carrierStatusLabel = String(row.status ?? '').trim() || null
      const fee = Number(row.tarif_prestation ?? NaN)
      feeDzd = Number.isFinite(fee) ? Math.round(fee) : null
      return mapEcotrackStatus(String(row.status ?? ''))
    }
    // 1) سجلّ الطلب: الحالة والسائق والرسم في نداء واحد
    try {
      const row = await this.orderRecord(trackingNumber)
      if (row) status = readRow(row)
    } catch (e) {
      if (knownStatus) throw e
    }
    if (status && knownStatus && status === knownStatus) return { trackingNumber, status, events, driverName, driverPhone, carrierStatusLabel, feeDzd }
    // 2) سجلّ الأحداث حين تغيّرت الحالة أو جُهلت
    try {
      const info = await this.call<Record<string, unknown>>('GET', 'api/v1/get/tracking/info', { tracking: trackingNumber })
      const activity = (Array.isArray(info.activity) ? info.activity : Array.isArray(info.data) ? info.data : []) as Record<string, unknown>[]
      for (const a of activity) {
        const label = String(a.event ?? a.status ?? a.remarque ?? '').trim()
        const mapped = label ? mapEcotrackStatus(label) : null
        if (!mapped) continue
        events.push({ status: mapped, description: label, location: a.station ? String(a.station) : a.causer ? String(a.causer) : null, occurredAt: parseDate(a.date ?? a.created_at) })
      }
      // حالة سجلّ الطلب هي الحقيقة الحالية؛ السجلّ يكمل فقط حين لم يعطِ السجلّ شيئاً
      if (!status && events.length) status = [...events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0]!.status
    } catch {
      /* نعود إلى سجلّ الطلب */
    }
    if (!status) {
      const row = await this.orderRecord(trackingNumber)
      if (row) {
        status = readRow(row)
        if (status && !events.some((e) => e.status === status)) {
          const reasons = (Array.isArray(row.status_reason) ? row.status_reason : []) as Record<string, unknown>[]
          const last = reasons[reasons.length - 1]
          events.push({ status, description: String(row.status), location: last?.station ? String(last.station) : null, occurredAt: parseDate(last?.date ?? row.updated_at) })
        }
      }
    }
    if (!status) throw new EcotrackError(`EcoTrack: no tracking data for ${trackingNumber}`)
    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    return { trackingNumber, status, events, driverName, driverPhone, carrierStatusLabel, feeDzd }
  }

  /** جدول الرسوم لكل ولاية (يتغيّر نادراً؛ مخزَّن 10 دقائق) */
  async fees(): Promise<EcotrackFee[]> {
    const k = keyOf(this.creds)
    const hit = feeCache.get(k)
    let rows = hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.rows : null
    if (!rows) {
      const res = await this.call<Record<string, unknown>>('GET', 'api/v1/get/fees')
      rows = (Array.isArray(res.livraison) ? res.livraison : Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : []) as Record<string, unknown>[]
      feeCache.set(k, { at: Date.now(), rows })
    }
    return rows
      .map((f) => {
        const code = String(f.wilaya_id ?? f.code ?? f.id ?? '').padStart(2, '0')
        const home = Number(f.tarif ?? f.domicile ?? f.home ?? 0)
        const desk = Number(f.tarif_stopdesk ?? f.stop_desk ?? f.desk ?? home)
        const ret = Number(f.retour ?? f.tarif_retour ?? 0)
        return { wilayaCode: code, homeDzd: Math.round(home), deskDzd: Math.round(desk > 0 ? desk : home), returnDzd: Math.round(ret > 0 ? ret : home * 0.5) }
      })
      .filter((f) => f.wilayaCode !== '00' && f.homeDzd > 0)
  }

  /** ملصق الطرد PDF */
  async label(tracking: string): Promise<Buffer> {
    const url = new URL(`${ecotrackBaseUrl(this.creds.baseUrl)}/api/v1/get/order/label`)
    url.searchParams.set('tracking', tracking)
    const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.creds.apiToken.trim()}` }, signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new EcotrackError(`EcoTrack label error ${res.status}`, res.status)
    return Buffer.from(await res.arrayBuffer())
  }
}

/** للاختبارات: تفريغ الذاكرات المؤقتة */
export function _resetEcotrackCaches(): void {
  budget.clear()
  communeCache.clear()
  feeCache.clear()
}
