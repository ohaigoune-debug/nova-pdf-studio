/**
 * مركز الاتصال الذكي — القواعد النقية (بلا قاعدة بيانات): الإعداد الافتراضي، ساعات الاتصال بتوقيت الجزائر،
 * نصوص المكالمات وما يعنيه كل زر، وتعويض متغيّرات الرسائل. تُختبر وحدها.
 *
 * قرارات المالك (27 نوفمبر 2026):
 *  - الرسالة تُخبر، والمكالمة لقرار؛ المكالمة للولي أولًا ثم للتلميذ.
 *  - «المعلّقة» في 48HR ⇒ مكالمة. «الجارية» ⇒ رسالة (المكتب: «طردك في المكتب»؛ المنزل: «أبقِ هاتفك مفتوحًا»)،
 *    ثم مكالمة إن بقي التوصيل إلى المنزل 48 ساعة دون تسليم.
 *  - تأكيد الطلب: رمز OTP يكفي؛ مكالمة التأكيد للحالات الخاصة فقط (هاتف مختلف، إرجاع سابق، عدّة قطع، مبلغ مرتفع).
 *  - 3 خيارات على الأكثر في المكالمة، ولا خيار «ألغِ» في مكالمات التوصيل.
 *  - شريحة ثابتة لكل زبون؛ 50 مكالمة كحدّ أقصى لكل شريحة في اليوم؛ 3 شرائح للصادر وواحدة للوارد.
 *  - إعادة المحاولة بعد ساعتين ثم في الغد، ثم الموظف.
 */
import { DZ_TZ } from './dz-time'

export const CALL_CENTER_KEY = 'callcenter.config'

/** off: لا شيء؛ test: يُخطَّط كل شيء لكن لا يُتّصل ولا يُرسَل إلا لأرقام التجربة؛ live: كل الزبائن */
export const CC_MODES = ['off', 'test', 'live'] as const
export type CcMode = (typeof CC_MODES)[number]

export const CC_RULES = ['SUSPENDED_CALL', 'DESK_ARRIVED_SMS', 'HOME_ARRIVED_SMS', 'HOME_STUCK_CALL', 'CONFIRM_SPECIAL_CALL', 'INBOUND_REPLY_SMS'] as const
export type CcRule = (typeof CC_RULES)[number]

export const CC_SCRIPTS = ['SUSPENDED', 'HOME_STUCK', 'CONFIRM_SPECIAL'] as const
export type CcScript = (typeof CC_SCRIPTS)[number]

/** ما يعنيه الزر بعد سماع الرسالة المسجَّلة */
export type CcAction = 'REDELIVER' | 'SWITCH_DESK' | 'HUMAN' | 'CONFIRM'

export interface ScriptDef {
  /** النص المقروء (يسجّله المالك بصوته؛ يُعرض للموظف ويُرسل للصندوق احتياطًا) */
  text: string
  options: Record<string, CcAction>
}

export const SCRIPTS: Record<CcScript, ScriptDef> = {
  SUSPENDED: {
    text: 'السلام عليكم، معكم منصة مدرسة. طرد ابنكم لم يُسلَّم بعد عند شركة التوصيل. إن أردتم إعادة التوصيل اضغطوا 1، وإن أردتم استلامه من المكتب اضغطوا 2، وللتحدث مع موظف اضغطوا 3.',
    options: { '1': 'REDELIVER', '2': 'SWITCH_DESK', '3': 'HUMAN' }
  },
  HOME_STUCK: {
    text: 'السلام عليكم، معكم منصة مدرسة. طرد ابنكم عند عون التوصيل منذ يومين ولم يُسلَّم. إن كنتم ما زلتم تنتظرونه اضغطوا 1، وإن أردتم استلامه من المكتب اضغطوا 2، وللتحدث مع موظف اضغطوا 3.',
    options: { '1': 'REDELIVER', '2': 'SWITCH_DESK', '3': 'HUMAN' }
  },
  CONFIRM_SPECIAL: {
    text: 'السلام عليكم، معكم منصة مدرسة. وصلنا طلبكم. لتأكيده اضغطوا 1، وللتحدث مع موظف اضغطوا 2.',
    options: { '1': 'CONFIRM', '2': 'HUMAN' }
  }
}

/** ما يقرؤه الموظف في لوحته لكل خيار */
export const ACTION_AR: Record<CcAction, string> = {
  REDELIVER: 'يطلب إعادة التوصيل — اطلبها من 48HR',
  SWITCH_DESK: 'يريد الاستلام من المكتب — حوّل الطرد عند 48HR وأعلمه بالعنوان',
  HUMAN: 'طلب التحدث مع موظف — اتصل به',
  CONFIRM: 'أكّد الطلب بالمكالمة'
}

export const RULE_AR: Record<CcRule, string> = {
  SUSPENDED_CALL: 'مكالمة: طرد معلّق',
  DESK_ARRIVED_SMS: 'رسالة: الطرد في المكتب',
  HOME_ARRIVED_SMS: 'رسالة: الطرد مع عون التوصيل',
  HOME_STUCK_CALL: 'مكالمة: توصيل المنزل متأخر',
  CONFIRM_SPECIAL_CALL: 'مكالمة: تأكيد حالة خاصة',
  INBOUND_REPLY_SMS: 'رسالة: ردّ على مكالمة واردة'
}

export interface CallCenterConfig {
  mode: CcMode
  /** متى شُغّل آخر مرة (من off): لا يُخطَّط شيء لأحداث أقدم، فلا تنهال رسائل على طرود قديمة */
  enabledAt: string | null
  /** أرقام التجربة (وضع test): وحدها تُتّصل وتُراسَل فعلًا */
  testPhones: string[]
  outboundSims: number[]
  inboundSim: number
  dailyCapPerSim: number
  /** ساعات الاتصال بتوقيت الجزائر، بالدقائق من منتصف الليل */
  quietStart: number
  quietEnd: number
  /** بعد كل محاولة بلا ردّ: كم دقيقة ننتظر (ما بلغ يومًا يُؤجَّل إلى بداية الغد) */
  retryDelaysMinutes: number[]
  maxCallAttempts: number
  homeStuckHours: number
  /** provider = مزوّد الرسائل المربوط (SuiviSMS)؛ gateway = من شرائح الصندوق */
  smsChannel: 'provider' | 'gateway'
  rules: Record<CcRule, boolean>
  confirmSpecial: { amountDzd: number; multiItems: boolean; phoneMismatch: boolean; pastReturn: boolean }
  texts: { deskArrived: string; homeArrived: string; inboundReply: Record<string, string> }
  inboundMenu: Record<string, string>
  agent: { tokenHash: string | null; hint: string | null; lastSeenAt: string | null; version: string | null; sims: { slot: number; ok: boolean; signal: number | null }[] }
}

export const DEFAULT_CALL_CENTER: CallCenterConfig = {
  mode: 'off',
  enabledAt: null,
  testPhones: [],
  outboundSims: [1, 2, 3],
  inboundSim: 4,
  dailyCapPerSim: 50,
  quietStart: 9 * 60,
  quietEnd: 20 * 60,
  retryDelaysMinutes: [120, 1440],
  maxCallAttempts: 3,
  homeStuckHours: 48,
  smsChannel: 'provider',
  rules: { SUSPENDED_CALL: true, DESK_ARRIVED_SMS: true, HOME_ARRIVED_SMS: true, HOME_STUCK_CALL: true, CONFIRM_SPECIAL_CALL: true, INBOUND_REPLY_SMS: true },
  confirmSpecial: { amountDzd: 8000, multiItems: true, phoneMismatch: true, pastReturn: true },
  texts: {
    deskArrived: 'مدرسة: طردكم {order} وصل إلى مكتب 48HR{office}. تفضّلوا باستلامه ببطاقة الهوية.',
    homeArrived: 'مدرسة: طردكم {order} مع عون التوصيل. أبقوا هاتفكم مفتوحًا ليتصل بكم.',
    inboundReply: { '2': 'مدرسة: شرح تفعيل الدورة خطوة بخطوة: madrasadz.com/help' }
  },
  inboundMenu: { '1': 'مشكل تقني', '2': 'تفعيل الدورة أو شحنها', '3': 'طلبيتي والتوصيل', '4': 'أمر آخر', '0': 'التحدث مع موظف' },
  agent: { tokenHash: null, hint: null, lastSeenAt: null, version: null, sims: [] }
}

const int = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

const PHONE_RE = /^0[5-7]\d{8}$/
export function localPhone(raw: string): string | null {
  const p = (raw ?? '').replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')
  if (/^[5-7]\d{8}$/.test(p)) return `0${p}`
  return PHONE_RE.test(p) ? p : null
}

/** يقرأ الإعداد المحفوظ بأمان: كل حقل ناقص أو فاسد يعود إلى قيمته الافتراضية */
export function readCallCenterConfig(raw: unknown): CallCenterConfig {
  const r = (raw ?? {}) as Partial<CallCenterConfig> & Record<string, unknown>
  const d = DEFAULT_CALL_CENTER
  const sims = (v: unknown, fb: number[]) => {
    const list = Array.isArray(v) ? [...new Set(v.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 1 && x <= 32))] : []
    return list.length ? list.sort((a, b) => a - b) : fb
  }
  const rules = { ...d.rules }
  for (const k of CC_RULES) if (typeof (r.rules as Record<string, unknown> | undefined)?.[k] === 'boolean') rules[k] = (r.rules as Record<string, boolean>)[k]!
  const cs = (r.confirmSpecial ?? {}) as Partial<CallCenterConfig['confirmSpecial']>
  const texts = (r.texts ?? {}) as Partial<CallCenterConfig['texts']>
  const strMap = (v: unknown, fb: Record<string, string>) => {
    if (!v || typeof v !== 'object') return fb
    const out: Record<string, string> = {}
    for (const [k, s] of Object.entries(v as Record<string, unknown>)) if (/^[0-9]$/.test(k) && typeof s === 'string' && s.trim()) out[k] = s.trim().slice(0, 300)
    return out
  }
  const agent = (r.agent ?? {}) as Partial<CallCenterConfig['agent']>
  const quietStart = int(r.quietStart, 0, 24 * 60, d.quietStart)
  const quietEnd = int(r.quietEnd, 0, 24 * 60, d.quietEnd)
  const delays = Array.isArray(r.retryDelaysMinutes) ? r.retryDelaysMinutes.map((x) => int(x, 5, 7 * 24 * 60, -1)).filter((x) => x > 0) : []
  return {
    mode: (CC_MODES as readonly string[]).includes(String(r.mode)) ? (r.mode as CcMode) : d.mode,
    enabledAt: typeof r.enabledAt === 'string' && r.enabledAt ? r.enabledAt : null,
    testPhones: Array.isArray(r.testPhones) ? [...new Set(r.testPhones.map((p) => localPhone(String(p))).filter((p): p is string => Boolean(p)))].slice(0, 20) : [],
    outboundSims: sims(r.outboundSims, d.outboundSims),
    inboundSim: int(r.inboundSim, 1, 32, d.inboundSim),
    dailyCapPerSim: int(r.dailyCapPerSim, 1, 1000, d.dailyCapPerSim),
    quietStart: quietStart < quietEnd ? quietStart : d.quietStart,
    quietEnd: quietStart < quietEnd ? quietEnd : d.quietEnd,
    retryDelaysMinutes: delays.length ? delays.slice(0, 5) : d.retryDelaysMinutes,
    maxCallAttempts: int(r.maxCallAttempts, 1, 6, d.maxCallAttempts),
    homeStuckHours: int(r.homeStuckHours, 6, 240, d.homeStuckHours),
    smsChannel: r.smsChannel === 'gateway' ? 'gateway' : 'provider',
    rules,
    confirmSpecial: {
      amountDzd: int(cs.amountDzd, 0, 1_000_000, d.confirmSpecial.amountDzd),
      multiItems: typeof cs.multiItems === 'boolean' ? cs.multiItems : d.confirmSpecial.multiItems,
      phoneMismatch: typeof cs.phoneMismatch === 'boolean' ? cs.phoneMismatch : d.confirmSpecial.phoneMismatch,
      pastReturn: typeof cs.pastReturn === 'boolean' ? cs.pastReturn : d.confirmSpecial.pastReturn
    },
    texts: {
      deskArrived: typeof texts.deskArrived === 'string' && texts.deskArrived.trim() ? texts.deskArrived.trim().slice(0, 300) : d.texts.deskArrived,
      homeArrived: typeof texts.homeArrived === 'string' && texts.homeArrived.trim() ? texts.homeArrived.trim().slice(0, 300) : d.texts.homeArrived,
      inboundReply: strMap(texts.inboundReply, d.texts.inboundReply)
    },
    inboundMenu: strMap(r.inboundMenu, d.inboundMenu),
    agent: {
      tokenHash: typeof agent.tokenHash === 'string' && agent.tokenHash ? agent.tokenHash : null,
      hint: typeof agent.hint === 'string' ? agent.hint : null,
      lastSeenAt: typeof agent.lastSeenAt === 'string' ? agent.lastSeenAt : null,
      version: typeof agent.version === 'string' ? agent.version : null,
      sims: Array.isArray(agent.sims) ? agent.sims.filter((s) => s && Number.isInteger(s.slot)).slice(0, 32) : []
    }
  }
}

/* ───────────── الوقت بتوقيت الجزائر ───────────── */

const HM = new Intl.DateTimeFormat('en-US', { timeZone: DZ_TZ, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })
const YMD = new Intl.DateTimeFormat('en-CA', { timeZone: DZ_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** الدقائق من منتصف الليل بتوقيت الجزائر */
export function dzMinuteOfDay(at: Date): number {
  const p = Object.fromEntries(HM.formatToParts(at).map((x) => [x.type, x.value]))
  return (Number(p.hour) % 24) * 60 + Number(p.minute)
}

/** اليوم بتوقيت الجزائر «2026-11-27» */
export function dzDay(at: Date): string {
  return YMD.format(at)
}

/** بداية اليوم الحالي بتوقيت الجزائر (لحظة UTC) */
export function dzStartOfDay(at: Date): Date {
  return new Date(at.getTime() - dzMinuteOfDay(at) * 60_000 - at.getUTCSeconds() * 1000 - at.getUTCMilliseconds())
}

export function withinCallingHours(cfg: Pick<CallCenterConfig, 'quietStart' | 'quietEnd'>, at: Date): boolean {
  const m = dzMinuteOfDay(at)
  return m >= cfg.quietStart && m < cfg.quietEnd
}

/** أقرب لحظة مسموحة للاتصال ابتداءً من `at` */
export function nextCallingTime(cfg: Pick<CallCenterConfig, 'quietStart' | 'quietEnd'>, at: Date): Date {
  if (withinCallingHours(cfg, at)) return at
  const m = dzMinuteOfDay(at)
  const start = dzStartOfDay(at)
  const minutes = m < cfg.quietStart ? cfg.quietStart : 24 * 60 + cfg.quietStart
  return new Date(start.getTime() + minutes * 60_000)
}

/**
 * موعد المحاولة التالية بعد محاولة رقم `attempt` (1، 2…) بلا ردّ: ساعتان ثم الغد.
 * التأجيل الذي يبلغ يومًا يُصبح بداية ساعات الاتصال في الغد (لا نفس الساعة من الغد).
 */
export function retryAt(cfg: Pick<CallCenterConfig, 'quietStart' | 'quietEnd' | 'retryDelaysMinutes'>, attempt: number, now: Date): Date {
  const delays = cfg.retryDelaysMinutes
  const minutes = delays[Math.min(attempt - 1, delays.length - 1)] ?? 120
  if (minutes >= 24 * 60) {
    const days = Math.floor(minutes / (24 * 60))
    const start = dzStartOfDay(now)
    return new Date(start.getTime() + (days * 24 * 60 + cfg.quietStart) * 60_000)
  }
  return nextCallingTime(cfg, new Date(now.getTime() + minutes * 60_000))
}

/** يعوّض {order} و{office} و{name} في نص الرسالة */
export function renderText(template: string, vars: Record<string, string | null | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '').replace(/\s{2,}/g, ' ').trim()
}

/** ماذا يعني الزر في هذا النص؟ null = زر غير معروف */
export function actionFor(script: string | null, digit: string | null | undefined): CcAction | null {
  if (!script || !digit) return null
  const def = (SCRIPTS as Record<string, ScriptDef>)[script]
  return def?.options[digit.trim()] ?? null
}

/** حالة EcoTrack الموحّدة ⇒ قاعدة مركز الاتصال (null = لا شيء) */
export function deliveryRuleFor(ecotrackStatus: string | null | undefined): 'SUSPENDED' | 'ARRIVED' | null {
  if (ecotrackStatus === 'failed_attempt') return 'SUSPENDED'
  if (ecotrackStatus === 'at_agency' || ecotrackStatus === 'out_for_delivery') return 'ARRIVED'
  return null
}
