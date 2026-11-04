import { z } from 'zod'

/** إجابة خطوة واحدة كما يرسلها المتصفح أو تطبيق الآيفون (الخادم يصحّحها بمفاتيحه) */
export const stepAnswerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), choice: z.number().int().min(0).max(50) }),
  z.object({ type: z.literal('multi'), choices: z.array(z.number().int().min(0).max(50)).max(50) }),
  z.object({ type: z.literal('fill_blank'), blanks: z.array(z.string().max(200)).max(50) }),
  z.object({ type: z.literal('ordering'), order: z.array(z.number().int().min(0).max(100)).max(100) }),
  z.object({ type: z.literal('matching'), pairs: z.array(z.number().int().min(-1).max(100)).max(100) }),
  z.object({ type: z.literal('portrait'), choice: z.number().int().min(0).max(50) }),
  z.object({ type: z.literal('numeric'), value: z.number().finite() }),
  z.object({ type: z.literal('short_text'), text: z.string().max(500) })
])

export const stepAnswersSchema = z.record(z.string().max(120), stepAnswerSchema)
