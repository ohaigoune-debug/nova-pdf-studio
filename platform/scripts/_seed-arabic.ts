// زرع تجريبي لفحص الفيديو: نصّ أدبي (ملك عام) بأسئلته في بنك الأستاذ التجريبي + محاور العربية 3AS (لا يُستعمل في الإنتاج)
import { and, eq, isNull } from 'drizzle-orm'
import { createDatabase } from '../src/server/db/connect'
import { curriculumNodes, levels, subjects, users } from '../src/server/db/schema'
import { createSession, resolveActor } from '../src/server/auth/session'
import { createBankQuestion } from '../src/server/services/question-bank.service'
import { createNode } from '../src/server/services/taxonomy.service'

async function main() {
  const h = await createDatabase(process.env.DATABASE_URL!)
  const db = h.db
  const [ar] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC'))
  const [l3] = await db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS'))
  const actorOf = async (email: string) => {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
    const s = await createSession(db, { userId: u!.id })
    return (await resolveActor(db, s.token))!
  }
  const admin = await actorOf('check-admin@example.com')
  const teacher = await actorOf('check-teacher@example.com')
  const scope = { subjectId: ar!.id, levelId: l3!.id, streamId: null }
  const ensure = async (title: string, term: 1 | 2 | 3) => {
    const [ex] = await db.select({ id: curriculumNodes.id }).from(curriculumNodes).where(and(eq(curriculumNodes.subjectId, ar!.id), eq(curriculumNodes.levelId, l3!.id), isNull(curriculumNodes.parentId), eq(curriculumNodes.title, title)))
    return ex?.id ?? (await createNode(db, admin, { ...scope, kind: 'UNIT', title, schoolTerm: term })).id
  }
  const poetry = await ensure('الشعر الحديث: الرومانسية والالتزام', 1)
  const integ = await ensure('الوضعية الإدماجية', 1)
  const poem = [
    'إذا الشَّعْبُ يَوْمًا أرادَ الحَيَاةَ      فَلا بُدَّ أنْ يَسْتَجِيبَ القَدَرْ',
    'وَلا بُدَّ لِلَّيْلِ أنْ يَنْجَلِي      وَلا بُدَّ لِلْقَيْدِ أَنْ يَنْكَسِرْ',
    'وَمَنْ لَمْ يُعانِقْهُ شَوْقُ الحَيَاةِ      تَبَخَّرَ في جَوِّها وانْدَثَرْ',
    'كَذلِكَ قالَتْ لِيَ الكائِناتُ      وَحَدَّثَني رُوحُها المُسْتَتِرْ',
    'وَدَمْدَمَتِ الرِّيحُ بَيْنَ الفِجاجِ      وَفَوْقَ الجِبالِ وَتَحْتَ الشَّجَرْ',
    'إذا ما طَمَحْتُ إلى غايَةٍ      رَكِبْتُ المُنَى وَنَسِيتُ الحَذَرْ'
  ].join('\n')
  const body = `اقرأ النصّ الآتي ثم أجب عن الأسئلة.\n\nقال أبو القاسم الشابي في قصيدته «إرادة الحياة»:\n\n${poem}\n\n**الشرح:** الفِجاج: الطرق الواسعة بين الجبال · دمدمت: صوّتت بغضب · المُنى: الأماني.`
  const q = (t: string, body: string, points: number, solution: string, difficulty: 1 | 2 | 3 = 2) => ({ kind: 'QUESTION' as const, type: 'OPEN' as const, title: t, body, points, difficulty, solution })
  const children = [
    q('البناء الفكري', 'ما القضية التي يعالجها الشاعر في هذا المقطع؟ وما موقفه منها؟', 2, 'يعالج الشاعر قضية إرادة الشعوب في التحرّر والحياة؛ موقفه إيماني متفائل: الإرادة تقهر القدر والقيد والظلام.'),
    q('البناء الفكري', 'بِمَ ربط الشاعر تحقّق الحياة؟ استخرج من النصّ ما يدلّ على ذلك.', 2, 'ربطها بالإرادة الجماعية: «إذا الشعب يومًا أراد الحياة فلا بدّ أن يستجيب القدر»، وبالشوق إلى الحياة: «ومن لم يعانقه شوق الحياة تبخّر».'),
    q('البناء الفكري', 'ما النمط الغالب على النصّ؟ اذكر مؤشّرين له.', 2, 'النمط الحجاجي الممزوج بالوصف: الربط السببي (إذا… فلا بدّ)، التوكيد (لا بدّ)، الصور الدالّة على الفكرة.'),
    q('البناء الفكري', 'إلامَ ينتمي النصّ من حيث المذهب الأدبي؟ علّل بمؤشّرين.', 2, 'الرومانسية: الهروب إلى الطبيعة ومحاورتها (قالت لي الكائنات، دمدمت الريح)، وطغيان الذات والعاطفة الجيّاشة.'),
    q('البناء اللغوي', 'أعرب ما تحته خطّ: «يَسْتَجِيبَ» في البيت الأول، و«شَوْقُ» في البيت الثالث.', 2, 'يستجيبَ: فعل مضارع منصوب بأن وعلامة نصبه الفتحة الظاهرة. شوقُ: فاعل مرفوع وعلامة رفعه الضمة، وهو مضاف.'),
    q('البناء اللغوي', 'في البيت الرابع صورة بيانية: حدّدها، اشرحها، وبيّن أثرها في المعنى.', 2, 'استعارة مكنية: شبّه الكائنات بإنسان يتكلّم وحذفه ورمز إليه بلازمة «قالت»؛ أثرها تجسيد تعاطف الطبيعة مع فكرة الشاعر وتقويتها.', 3),
    q('البناء اللغوي', 'ما دلالة تكرار «لا بدّ» في النصّ؟', 1, 'التوكيد والإصرار على حتمية النتيجة وقوّة الإرادة.'),
    q('التقويم النقدي', 'يرى نقّاد أن الشابي «شاعر الإرادة والأمل». هل يؤيّد هذا المقطع رأيهم؟ ناقش في فقرة قصيرة.', 3, 'نعم؛ المقطع يقوم على ثنائية الإرادة/القدر والنور/الظلام وينتصر للأمل، مع لغة التوكيد والصور الحيّة… (يُقبل كل تعليل مدعّم بالشواهد).', 3)
  ]
  const passage = await createBankQuestion(db, teacher, { kind: 'PASSAGE', type: 'OPEN', title: 'النصّ الأدبي: «إرادة الحياة» لأبي القاسم الشابي', body, points: 16, difficulty: 2, estimatedMinutes: 90, subjectId: ar!.id, levelId: l3!.id, streamId: null, curriculumNodeId: poetry, schoolTerm: 1, examKind: 'TEST', sourceLabel: 'من إعداد الأستاذ', keywords: ['الشعر الحديث', 'الرومانسية', 'الشابي', 'إرادة الحياة', 'البناء الفكري', 'البناء اللغوي'], solution: 'الحلول النموذجية مرفقة بكل سؤال فرعي؛ سلّم التنقيط: البناء الفكري 8 ن، البناء اللغوي 5 ن، التقويم النقدي 3 ن.' })
  for (const [i, c] of children.entries()) await createBankQuestion(db, teacher, { ...c, subjectId: ar!.id, levelId: l3!.id, parentId: passage.id, sortOrder: i })
  await createBankQuestion(db, teacher, { kind: 'INTEGRATIVE', type: 'OPEN', title: 'الوضعية الإدماجية', body: 'يرى بعض الشباب أن النجاح في الحياة رهين الحظّ لا الإرادة.\n\nاكتب نصًّا حجاجيًّا من اثني عشر سطرًا تردّ فيه على هذا الرأي، موظّفًا: حجّتين على الأقل، أسلوب الشرط، وصورة بيانية.', points: 4, difficulty: 3, estimatedMinutes: 30, subjectId: ar!.id, levelId: l3!.id, streamId: null, curriculumNodeId: integ, schoolTerm: 1, examKind: 'TEST', sourceLabel: 'من إعداد الأستاذ', keywords: ['الوضعية الإدماجية', 'الحجاج'], solution: 'سلّم التنقيط: الوجاهة 1 ن (احترام الموضوع والنمط الحجاجي)، سلامة اللغة 1 ن، الانسجام 1 ن (ترابط الحجج والروابط)، الإبداع والتوظيف 1 ن (الشرط والصورة البيانية).' })
  console.log('seeded arabic passage', passage.id)
  await h.close()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
