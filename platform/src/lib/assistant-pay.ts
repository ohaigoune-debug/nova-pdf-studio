/**
 * أجر «الأستاذ المساعد» — قرار المالك 23 نوفمبر 2026:
 * راتب ثابت يشمل عددًا من الرّدود في الشّهر ومراجعة التّعليقات، وفوقه: الرّدود الزّائدة بحسب نوعها
 * والمحتوى المرفوع (بالصّفحة، والاختبار بالقطعة)، والاثنان معًا تحت سقف واحد. كلّ الأرقام تُضبط من الإدارة (لا برمجة).
 * المساعد موثوق: الصّفحات يصرّح بها هو، والمحتوى يُحسب فور رفعه.
 */

export const CONTENT_KINDS = [
  "SUMMARY",
  "EXERCISES",
  "EXAM",
  "PROPOSAL",
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  SUMMARY: "ملخّص درس",
  EXERCISES: "سلسلة تمارين بحلولها",
  EXAM: "اختبار كامل بتصحيحه",
  PROPOSAL: "موضوع مقترح بتصحيحه",
};

/** الاختبار والمقترح: صفحات الموضوع وحدها تُحسب (التّصحيح مشمول)، وفي حدود termLimit معًا لكلّ فصل */
export const TERM_LIMITED_KINDS: readonly ContentKind[] = ["EXAM", "PROPOSAL"];

export const CONTENT_UNITS = ["PAGE", "ITEM"] as const;
export type ContentUnit = (typeof CONTENT_UNITS)[number];
export const CONTENT_UNIT_LABELS: Record<ContentUnit, string> = {
  PAGE: "للصّفحة",
  ITEM: "للقطعة كاملة",
};

export const REPLY_KINDS = ["SHORT", "DETAILED", "CORRECTION"] as const;
export type ReplyKind = (typeof REPLY_KINDS)[number];
export const REPLY_KIND_LABELS: Record<ReplyKind, string> = {
  SHORT: "ردّ قصير",
  DETAILED: "ردّ مفصّل",
  CORRECTION: "تصحيح تعبير",
};

export interface AssistantPayConfig {
  /** الرّاتب الثّابت الشّهريّ (دج) */
  baseSalary: number;
  /** عدد الرّدود الّتي يشملها الرّاتب؛ ما بعدها يُدفع */
  includedReplies: number;
  /** ثمن الرّدّ الزّائد بحسب نوعه (دج) */
  replyRates: Record<ReplyKind, number>;
  /** الرّدّ الّذي يبلغ هذا العدد من الحروف «مفصّل»، وما دونه «قصير» */
  detailedMinChars: number;
  /** ثمن المحتوى بحسب نوعه (دج): للصّفحة أو للقطعة كاملة بحسب contentUnits */
  contentRates: Record<ContentKind, number>;
  /** PAGE: الثّمن × عدد الصّفحات؛ ITEM: ثمن ثابت للقطعة كاملة مهما كانت صفحاتها */
  contentUnits: Record<ContentKind, ContentUnit>;
  /** سقف الإضافيّ الشّهريّ: الرّدود الزّائدة + المحتوى معًا (دج) */
  extraCap: number;
  /** عدد الاختبارات والمقترحات (معًا) المدفوعة في كلّ فصل دراسيّ؛ 0 = بلا حدّ */
  termLimit: number;
}

export const DEFAULT_ASSISTANT_PAY: AssistantPayConfig = {
  baseSalary: 40000,
  includedReplies: 300,
  replyRates: { SHORT: 40, DETAILED: 80, CORRECTION: 150 },
  detailedMinChars: 400,
  // 23 نوفمبر 2026: الاختبار الكامل أو المقترح 1000 دج لصفحة الموضوع، والتّصحيح مجّانيّ، في حدود 4 لكلّ فصل
  contentRates: { SUMMARY: 400, EXERCISES: 500, EXAM: 1000, PROPOSAL: 1000 },
  contentUnits: {
    SUMMARY: "PAGE",
    EXERCISES: "PAGE",
    EXAM: "PAGE",
    PROPOSAL: "PAGE",
  },
  extraCap: 30000,
  termLimit: 4,
};

function num(v: unknown, fallback: number, max = 10_000_000): number {
  const n =
    typeof v === "string"
      ? Number(v.trim())
      : typeof v === "number"
        ? v
        : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), max) : fallback;
}

/** يكمل القيمة المخزّنة أو المرسلة بالافتراضيّ، ويرفض السّالب وغير الرّقميّ */
export function cleanPayConfig(input: unknown): AssistantPayConfig {
  const o = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_ASSISTANT_PAY;
  const rr = (o.replyRates ?? {}) as Record<string, unknown>;
  const pr = (o.contentRates ?? {}) as Record<string, unknown>;
  const pu = (o.contentUnits ?? {}) as Record<string, unknown>;
  const unit = (k: ContentKind): ContentUnit =>
    CONTENT_UNITS.includes(pu[k] as ContentUnit)
      ? (pu[k] as ContentUnit)
      : d.contentUnits[k];
  return {
    baseSalary: num(o.baseSalary, d.baseSalary),
    includedReplies: num(o.includedReplies, d.includedReplies, 100_000),
    replyRates: {
      SHORT: num(rr.SHORT, d.replyRates.SHORT),
      DETAILED: num(rr.DETAILED, d.replyRates.DETAILED),
      CORRECTION: num(rr.CORRECTION, d.replyRates.CORRECTION),
    },
    detailedMinChars: num(o.detailedMinChars, d.detailedMinChars, 100_000),
    contentRates: {
      SUMMARY: num(pr.SUMMARY, d.contentRates.SUMMARY),
      EXERCISES: num(pr.EXERCISES, d.contentRates.EXERCISES),
      EXAM: num(pr.EXAM, d.contentRates.EXAM),
      PROPOSAL: num(pr.PROPOSAL, d.contentRates.PROPOSAL),
    },
    contentUnits: {
      SUMMARY: unit("SUMMARY"),
      EXERCISES: unit("EXERCISES"),
      EXAM: unit("EXAM"),
      PROPOSAL: unit("PROPOSAL"),
    },
    extraCap: num(o.extraCap, d.extraCap),
    termLimit: num(o.termLimit, d.termLimit, 1000),
  };
}

export function replyKindOf(
  chars: number,
  correction: boolean,
  cfg: AssistantPayConfig,
): ReplyKind {
  if (correction) return "CORRECTION";
  return chars >= cfg.detailedMinChars ? "DETAILED" : "SHORT";
}

/** ثمن قطعة محتوى واحدة */
export function contentAmount(
  kind: ContentKind,
  pages: number,
  cfg: AssistantPayConfig,
): number {
  const p = Math.max(0, pages);
  if (p === 0) return 0;
  return cfg.contentUnits[kind] === "ITEM"
    ? cfg.contentRates[kind]
    : p * cfg.contentRates[kind];
}

/** «400 دج للصّفحة» أو «1 500 دج للقطعة كاملة» */
export function rateLabel(kind: ContentKind, cfg: AssistantPayConfig): string {
  return `${formatDa(cfg.contentRates[kind])} ${CONTENT_UNIT_LABELS[cfg.contentUnits[kind]]}`;
}

export interface StatementInput {
  /** ردود المساعد في الشّهر بترتيبها الزّمنيّ */
  replies: { chars: number; correction: boolean }[];
  /** overLimit: اختبار أو مقترح فوق حدّ الفصل ⇒ لا يُحسب */
  content: { kind: ContentKind; pages: number; overLimit?: boolean }[];
}

export interface Statement {
  base: number;
  repliesTotal: number;
  repliesIncluded: number;
  /** الرّدود الزّائدة المدفوعة بحسب نوعها */
  extraReplies: Record<ReplyKind, { count: number; amount: number }>;
  repliesAmount: number;
  contentPages: number;
  contentCount: number;
  contentOverLimit: number;
  contentAmount: number;
  /** الإضافيّ قبل السّقف */
  extraBeforeCap: number;
  extra: number;
  capped: boolean;
  total: number;
}

/** أوّل includedReplies ردًّا في الشّهر يشملها الرّاتب؛ ما بعدها يُدفع بنوعه؛ والمحتوى بالصّفحة؛ والإضافيّ كلّه تحت السّقف */
export function computeStatement(
  input: StatementInput,
  cfg: AssistantPayConfig,
): Statement {
  const extraReplies: Statement["extraReplies"] = {
    SHORT: { count: 0, amount: 0 },
    DETAILED: { count: 0, amount: 0 },
    CORRECTION: { count: 0, amount: 0 },
  };
  input.replies.slice(cfg.includedReplies).forEach((r) => {
    const k = replyKindOf(r.chars, r.correction, cfg);
    extraReplies[k].count += 1;
    extraReplies[k].amount += cfg.replyRates[k];
  });
  const repliesAmount = REPLY_KINDS.reduce(
    (s, k) => s + extraReplies[k].amount,
    0,
  );
  const paid = input.content.filter((c) => !c.overLimit);
  const contentPages = paid.reduce((s, c) => s + Math.max(0, c.pages), 0);
  const contentTotal = paid.reduce(
    (s, c) => s + contentAmount(c.kind, c.pages, cfg),
    0,
  );
  const extraBeforeCap = repliesAmount + contentTotal;
  const extra = Math.min(cfg.extraCap, extraBeforeCap);
  return {
    base: cfg.baseSalary,
    repliesTotal: input.replies.length,
    repliesIncluded: Math.min(input.replies.length, cfg.includedReplies),
    extraReplies,
    repliesAmount,
    contentPages,
    contentCount: paid.length,
    contentOverLimit: input.content.length - paid.length,
    contentAmount: contentTotal,
    extraBeforeCap,
    extra,
    capped: extraBeforeCap > cfg.extraCap,
    total: cfg.baseSalary + extra,
  };
}

/** «2026-11» ⇐ تاريخ، بتوقيت الجزائر (UTC+1 بلا توقيت صيفيّ) */
export function monthOf(d: Date): string {
  const t = new Date(d.getTime() + 3_600_000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** حدود الشّهر [بداية، نهاية) بتوقيت الجزائر؛ null لصيغة غير صالحة */
export function monthRange(month: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return {
    start: new Date(Date.UTC(y, mo - 1, 1) - 3_600_000),
    end: new Date(Date.UTC(y, mo, 1) - 3_600_000),
  };
}

export function formatDa(n: number): string {
  return `${n.toLocaleString("fr-DZ").replace(/ | /g, " ")} دج`;
}

/** هذا الشّهر والأشهر السّابقة (الأحدث أوّلًا) */
export function recentMonths(now: Date, count = 6): string[] {
  const [y, m] = monthOf(now).split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * الفصل الدّراسيّ الجزائريّ لشهر: الأوّل سبتمبر–ديسمبر، الثّاني جانفي–مارس، الثّالث أفريل–أوت.
 * يعيد مفتاحه («2026-2027·1») وأوّل شهر فيه.
 */
export function termOf(month: string): {
  key: string;
  label: string;
  firstMonth: string;
} {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = m >= 9 ? y : y - 1;
  const n = m >= 9 ? 1 : m <= 3 ? 2 : 3;
  const first =
    n === 1 ? `${start}-09` : n === 2 ? `${start + 1}-01` : `${start + 1}-04`;
  return {
    key: `${start}-${start + 1}·${n}`,
    label: `${["الفصل الأوّل", "الفصل الثّاني", "الفصل الثّالث"][n - 1]} ${start}-${start + 1}`,
    firstMonth: first,
  };
}

/** أيّ الاختبارات والمقترحات فوق حدّ الفصل: before = ما سبق الشّهر في الفصل نفسه، والقائمة بترتيبها الزّمنيّ */
export function markOverLimit<T extends { kind: ContentKind }>(
  items: T[],
  before: number,
  cfg: AssistantPayConfig,
): (T & { overLimit: boolean })[] {
  let used = before;
  return items.map((c) => {
    if (!TERM_LIMITED_KINDS.includes(c.kind)) return { ...c, overLimit: false };
    used += 1;
    return { ...c, overLimit: cfg.termLimit > 0 && used > cfg.termLimit };
  });
}
