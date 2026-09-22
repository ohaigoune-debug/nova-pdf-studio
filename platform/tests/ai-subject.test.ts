import { describe, expect, it } from 'vitest'
import { analyzeSystem, essaySystem, exercisesSystem, insightsSystem, organizeSystem } from '@/server/ai/shared'
import { createTeacher } from '@/server/services/admin.service'
import { workspaceSubject } from '@/server/services/ai.service'
import { makeAdmin, setupDb, uniq } from './helpers'

describe('المنصة متعددة المواد: الذكاء الاصطناعي يتبع مادة الأستاذ', () => {
  it('التعليمات تحمل المادة ولا تفترض العربية', () => {
    for (const build of [essaySystem, insightsSystem, exercisesSystem, analyzeSystem, organizeSystem]) {
      const math = build('الرياضيات')
      expect(math).toContain('«الرياضيات»')
      expect(math).not.toMatch(/لغة عربية|اللغة العربية وآدابها/)
      // بلا مادة معروفة: دور عام لا يفترض مادة
      expect(build(null)).not.toMatch(/مادة «/)
    }
  })

  it('مادة لغة أجنبية تُصحَّح بلغتها', () => {
    expect(essaySystem('اللغة الفرنسية')).toMatch(/بلغة المادة إن كانت لغة أجنبية/)
    expect(exercisesSystem('اللغة الإنجليزية')).toMatch(/بلغة المادة إن كانت لغة أجنبية/)
  })

  it('مادة كل مساحة عمل تُقرأ من ملف أستاذها', async () => {
    const h = await setupDb()
    try {
      const admin = await makeAdmin(h.db)
      const r = await createTeacher(h.db, admin, { email: `${uniq('t')}@test.dz`, password: 'Teacher@12345', fullName: 'أستاذ رياضيات', subject: 'الرياضيات' })
      expect(await workspaceSubject(h.db, r.workspaceId)).toBe('الرياضيات')
      expect(await workspaceSubject(h.db, null)).toBeNull()
    } finally {
      await h.close()
    }
  })
})
