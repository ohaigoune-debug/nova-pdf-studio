/** أسماء المهارات المعروضة في «نتائجي وتقدمي» (skill_id في خطوات المجموعات) */
export const SKILL_LABELS: Record<string, string> = {
  'ar.comprehension.link': 'فهم العلاقات بين الأفكار',
  'ar.comprehension.evidence': 'الاستشهاد من النّصّ',
  'ar.comprehension.purpose': 'تحديد الغرض',
  'ar.comprehension.image': 'فهم الصّور في النّصّ',
  'ar.comprehension.details': 'استخراج المضامين',
  'ar.comprehension.explain': 'شرح الأبيات والعبارات',
  'ar.comprehension.idea': 'الفكرة العامّة والأفكار الأساسيّة',
  'ar.literature.tradition': 'مظاهر التّقليد',
  'ar.literature.renewal': 'مظاهر التّجديد',
  'ar.literature.context': 'السّياق الأدبيّ والتّاريخيّ',
  'ar.text.type': 'نمط النّصّ ومؤشّراته',
  'ar.grammar.irab': 'إعراب المفردات',
  'ar.grammar.sentence_case': 'محلّ الجمل من الإعراب',
  'ar.grammar.maqsur': 'المقصور والمنقوص والممدود',
  'ar.grammar.mamnu': 'الممنوع من الصّرف',
  'ar.grammar.rules': 'القواعد النّحويّة',
  'ar.morphology': 'الصّرف',
  'ar.rhetoric.metaphor': 'الاستعارة',
  'ar.rhetoric.simile': 'التّشبيه',
  'ar.rhetoric.metonymy': 'الكناية والمجاز',
  'ar.rhetoric.effect': 'سرّ البلاغة',
  'ar.rhetoric.badi': 'المحسّنات البديعيّة',
  'ar.prosody': 'العروض والقافية',
  'ar.cohesion.connectors': 'أدوات الرّبط',
  'ar.cohesion.reference': 'الإحالة ومرجع الضّمير',
  'ar.cohesion.effect': 'الاتّساق والانسجام',
  'ar.writing.integration': 'الوضعيّة الإدماجيّة'
}

export function skillLabel(id: string | null | undefined): string {
  if (!id) return 'مهارات أخرى'
  return SKILL_LABELS[id] ?? id
}
