import { describe, expect, it } from 'vitest'
import { codNetDzd, ecotrackMoneyStatus } from '@/lib/cod-money'

describe('أين مال الدفع عند الاستلام؟ قراءة حالات EcoTrack', () => {
  it('الحالات الأربع بعد التسليم، بأيّ كتابة', () => {
    expect(ecotrackMoneyStatus('livre_non_encaisse')).toBe('WITH_DRIVER')
    expect(ecotrackMoneyStatus('Livré non encaissé')).toBe('WITH_DRIVER')
    expect(ecotrackMoneyStatus('encaisse_non_paye')).toBe('AT_CARRIER')
    expect(ecotrackMoneyStatus('Encaissé non payé')).toBe('AT_CARRIER')
    expect(ecotrackMoneyStatus('paiements_prets')).toBe('READY')
    expect(ecotrackMoneyStatus('Paiement prêt')).toBe('READY')
    expect(ecotrackMoneyStatus('paye_et_archive')).toBe('RECEIVED')
    expect(ecotrackMoneyStatus('Payé et archivé')).toBe('RECEIVED')
    expect(ecotrackMoneyStatus('Payé')).toBe('RECEIVED')
    expect(ecotrackMoneyStatus('Livré')).toBe('WITH_DRIVER')
  })
  it('ما ليس حالة مال: لا شيء', () => {
    for (const s of ['Retour livré', 'retour_paye', 'En transit vers wilaya', 'Tentative échouée', 'Nouveau', '', null]) expect(ecotrackMoneyStatus(s), String(s)).toBeNull()
  })
  it('المبلغ الصافي: الإجمالي ناقص رسم الشركة، أو رسم التوصيل إن جُهل', () => {
    expect(codNetDzd({ totalDzd: 4500, shippingDzd: 600, codFeeDzd: 550 })).toBe(3950)
    expect(codNetDzd({ totalDzd: 4500, shippingDzd: 600, codFeeDzd: null })).toBe(3900)
    expect(codNetDzd({ totalDzd: 300, shippingDzd: 600, codFeeDzd: null })).toBe(0)
  })
})
