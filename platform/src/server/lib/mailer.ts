/**
 * إرسال البريد عبر واجهة مجرّدة. الاختيار من البيئة فقط:
 *   MAIL_PROVIDER=console (افتراضي: يطبع في السجل) | resend (HTTP API) | webhook (POST JSON إلى MAIL_WEBHOOK_URL)
 *   MAIL_FROM="مدرسة <no-reply@example.com>"
 * لا يُرسل أي بريد من المتصفح؛ الفشل لا يكشف للمستخدم وجود الحساب من عدمه.
 */
export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface Mailer {
  readonly name: string
  send(msg: MailMessage): Promise<void>
}

const from = () => process.env.MAIL_FROM ?? 'مدرسة <no-reply@localhost>'

const consoleMailer: Mailer = {
  name: 'console',
  async send(msg) {
    if (process.env.NODE_ENV !== 'test') console.log(`[mail] to=${msg.to} subject=${msg.subject}\n${msg.text}`)
  }
}

function resendMailer(apiKey: string): Mailer {
  return {
    name: 'resend',
    async send(msg) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ from: from(), to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html })
      })
      if (!res.ok) throw new Error(`mail HTTP ${res.status}`)
    }
  }
}

function webhookMailer(url: string, secret?: string): Mailer {
  return {
    name: 'webhook',
    async send(msg) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(secret ? { 'x-mail-secret': secret } : {}) },
        body: JSON.stringify({ from: from(), ...msg })
      })
      if (!res.ok) throw new Error(`mail HTTP ${res.status}`)
    }
  }
}

let override: Mailer | null = null
let cached: Mailer | null = null

export function getMailer(): Mailer {
  if (override) return override
  if (cached) return cached
  const p = (process.env.MAIL_PROVIDER ?? 'console').toLowerCase()
  if (p === 'resend' && process.env.MAIL_API_KEY) cached = resendMailer(process.env.MAIL_API_KEY)
  else if (p === 'webhook' && process.env.MAIL_WEBHOOK_URL) cached = webhookMailer(process.env.MAIL_WEBHOOK_URL, process.env.MAIL_WEBHOOK_SECRET)
  else cached = consoleMailer
  return cached
}

/** للاختبارات فقط */
export function setMailerForTests(m: Mailer | null) {
  override = m
}
