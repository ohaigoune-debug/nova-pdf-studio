/**
 * بلاغ المالك (22 نوفمبر 2026): حصة مبرمجة 12:00 ظهرت 13:00. الخادم في الإنتاج بتوقيت UTC وكان يقرأ
 * خانة الموعد (بلا منطقة) بتوقيته. المواعيد تُقرأ وتُعرض الآن بتوقيت الجزائر مهما كان توقيت الخادم.
 */
import { describe, expect, it } from 'vitest'
import { parseDzDateTime, toDzInput } from '@/lib/dz-time'
import { formatTime } from '@/lib/utils'

describe('مواعيد بتوقيت الجزائر', () => {
  it('خانة «12:00» = 12:00 بالجزائر = 11:00 UTC', () => {
    expect(parseDzDateTime('2026-11-22T12:00').toISOString()).toBe('2026-11-22T11:00:00.000Z')
    expect(parseDzDateTime('2026-11-22T00:30').toISOString()).toBe('2026-11-21T23:30:00.000Z')
    expect(parseDzDateTime('2026-11-22T12:00:30').toISOString()).toBe('2026-11-22T11:00:30.000Z')
  })

  it('قيمة بمنطقة صريحة تُقرأ كما هي، وغير التاريخ يبقى غير صالح', () => {
    expect(parseDzDateTime('2026-11-22T12:00:00Z').toISOString()).toBe('2026-11-22T12:00:00.000Z')
    expect(parseDzDateTime('2026-11-22T12:00:00+01:00').toISOString()).toBe('2026-11-22T11:00:00.000Z')
    expect(Number.isNaN(parseDzDateTime('غدًا').getTime())).toBe(true)
  })

  it('الخانة تعرض الموعد المحفوظ بتوقيت الجزائر، ذهابًا وإيابًا', () => {
    expect(toDzInput(new Date('2026-11-22T11:00:00Z'))).toBe('2026-11-22T12:00')
    expect(toDzInput('2026-11-21T23:30:00.000Z')).toBe('2026-11-22T00:30')
    expect(toDzInput(parseDzDateTime('2026-06-15T20:45'))).toBe('2026-06-15T20:45')
    expect(toDzInput(null)).toBe('')
  })

  it('العرض في الصفحات بتوقيت الجزائر', () => {
    expect(formatTime('2026-11-22T11:00:00Z')).toMatch(/12:00/)
  })
})
