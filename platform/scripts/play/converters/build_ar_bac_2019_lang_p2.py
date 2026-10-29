"""Conversion: BAC 2019 (session عاديّة) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (عبّاس محمود العقّاد، «يسألونك»: رسالة الأدب).
Exam (most faithful source): gdrive 1vEFP2eO9tX-4aGYJbRRzhR1POIv2ZVit (بكالوريا العربية 2019 شعبة لغات.docx);
same paper as PDF (owner's retyped copy): gdrive 1APk5GHKFzPhvdl2nUeZTpyfHvE9vu6Yz (BAC 2019 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1Ypn1Kr-KCPPNHAPtDDCLJf4ewC2mjtrq (01_الموضوع.pdf, pages 3–4, read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 15EshNlI6DO8-o34Tks3znMKOE4kuNEoL (02_التصحيح.pdf, pages 3–4).

Method (same as the BAC 2020–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; outer whitespace / direction marks trimmed). The docx matches the official paper except small
spellings kept verbatim («أدباءنا» for «أدبائنا»); the docx critique items have no «أ-/ب-» labels (the official paper has
them), kept as in the docx. The correction PDF's text layer is reversed presentation-form Arabic, so the mark scheme was
read from the rendered pages (150 dpi, fully legible). Every mark comes from the official scheme; correct options and
explanations condense its wording.

Conversion notes / points for the owner's review:
- «ما تحته خطّ»: underlined in the docx: «توفيق», «فئة» and «(تعيش)» (the official paper underlines «توفيق», «فئة»; the
  question names all four items anyway).
- Q1: «2×0.5» cause (تشتّتهم وانعدام روح النّظام بينهم) + «2×0.5» consequence ⇒ two elements.
- Q2: «4×0.25» four values among five listed ⇒ one element. Q3: 01 tendency (الإنسانيّة) + 01 justification.
- Q4: 0.5 al-Hakim + 0.5 al-Aqqad + «0.75+0.25» opinion («يُبدي الممتحن رأيه معلّلًا»): the scheme does not say which part
  is the position and which the justification ⇒ one deferred essay_builder element of 1 (rule 11).
- Q5 (تلخيص) «3×01» = الحجم / المضمون / سلامة اللّغة ⇒ three deferred essay_builder elements (the scheme's summary is a
  «نموذج للاستئناس», kept as the model).
- Part 2 Q1 «2×0.50» = one field each (classification + naming: «حقل التّضامن (الاتّحاد)» / «حقل الأدب (النّقد)»).
- Part 2 Q2 «3×0.25» three argumentation devices among four ⇒ one element.
- Part 2 Q3: «توفيق» بدل (the scheme: «تُقبل إجابة عطف بيان» ⇒ never a distractor), «فئة» مفعول به ثانٍ, (تعيش) صلة,
  (هي التّبشير) خبر «رسالة».
- Part 2 Q4 «3×0.25» = pronoun «هم» / referent «الأدباء» / role. The scheme writes «الإحالة البعديّة» although «الأدباء»
  precedes «هم» (an anaphoric, «قبليّة», reference) — to review; the steps do not test the direction (no «قبليّة/بعديّة»
  choice), only the cohesion role.
- Part 2 Q5 «3×0.25» per image (type, explanation, effect) ⇒ six elements.
- Part 3 (04): أ- 01 the phenomenon (ظاهرة التّجديد) + 01 its definition; ب- «4×0.5» four writers («طه حسين – أدباء جماعة
  الدّيوان – أدباء الرّابطة القلميّة…», «يكتفي الممتحن بذكر أربعة أدباء») ⇒ interactive; the steps name members of the
  two groups the scheme cites (العقّاد، المازني، شكري / جبران، نعيمة، أبو ماضي) — to review.
"""
import json, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2019-lang-p2"
PAPER = 2
STREAMS = ["LANG"]
DOCX_ID = "1vEFP2eO9tX-4aGYJbRRzhR1POIv2ZVit"
DOCX_TITLE = "بكالوريا العربية 2019 شعبة لغات.docx"
PDF_ID = "1APk5GHKFzPhvdl2nUeZTpyfHvE9vu6Yz"
OFFICIAL_ID = "1Ypn1Kr-KCPPNHAPtDDCLJf4ewC2mjtrq"
CORR_ID = "15EshNlI6DO8-o34Tks3znMKOE4kuNEoL"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من فقرات ملفّ docx بـ python-docx: تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
TEXT2 = '«كتب الأستاذ توفيق الحكيم من برجه العاجيّ مقالاً يقول فيه: "إنّ الدّولة لا تنظر إلى الأدب بعين الجدّ، بل إنّه عندها شيءٌ وهميٌّ لا وجود له ولا حساب". ثم يقول: "إنّ انعدام روح النّظام بين الأدباء وتفرّق شملهم وانصرافهم عن النّظر فيما يربطهم جميعهم من مصالح وما يعنيهم جميعًا من مسائل قد فوّت عليهم النّفع الماديّ والأدبيّ، وجعلهم فئة لا خطر لها ولا وزن في نظر الدّولة ".\nوكتب مقالًا آخر يسأل عن أدباءنا المعاصرين، هل فهموا حقيقة رسالتهم؟ ويذكر ما يصنعه أدباء أوربا "كلّما هبّت ريح الخطر على إحدى هذه القيّم - وهي الحريّة والفكر والعدالة والحقّ والجمال - وكيف يتجرّد كل أديبٍ من رداء جنسيته الزّائل ليدخل معبد الفكر الخالد ويتكلّم باسم تلك الهيئة الواحدة المتّحدة التي (تعيش) للدّفاع عن قيم البشريّة العليا "...\nالحقيقة أنَّ الأدباء حين يخلقون أعمالهم فرديّون منعزلون، فلا حاجة بهم إلى محفل يسهّل لهم الخلق والإبداع، ولا فائدة لهم على الإطلاق من اتّفاق أو اجتماع، والحقيقة أن التّعاون إنّما يكون في مسائل الحصص والسّهوم والأجزاء ولا يكون في مسائل الخلق والتّكوين والإحياء، لأنّ الفكرة الفنيّة كائنٌ حيٌّ ووحدةٌ قائمة ليس يشترك فيها ذهنان كما ليس يشترك في الولد الواحد أبوان...\nأللأديب رسالة؟\nنعم، ليس بالأديب من ليست له في عالم الفكر رسالة، ومن ليس له وحيٌ وهداية، ولكن هل للأدب كلّه رسالة تتّفق في غايتها مع اختلاف رسائل الأدباء وتعدّد القرائح والآراء؟\nنعم، لهم جميعًا رسالة واحدة هي رسالة الحرّيّة والجمال... ورسالة الأدباء كافّة (هي التبشير) بدين الحرّيّة والإنحاء على صولة المستبدّين، فما من عداوة للأدب ولا من خيانة لأمانة الأديب أشدّ من عداوة " القوّة العضليّة " وَأَخوَنُ من خيانة الاستبداد».'
REF2 = 'عباس محمود العقّاد «يسألونك» المكتبة العصريّة للطباعة والنّشر.\nصيدا، بيروت، ط:3، ص7-11. (بتصرف)'
GLOSS2 = 'الشرح اللغوي:\nالإنحاء: أنحى الشّيء أي صرفه عنه.   صولة: بطش وقوّة.'
P2A = 'أوّلا- البناء الفكري: (10 نقاط)'
P2B = 'ثانيا- البناء اللّغوي: (06 نقاط)'
P2C = 'ثالثا- التّقويم النقدي: (04 نقاط)'
QT2 = ['ما الذي حرم الأدباء النّفع الماديّ والأدبيّ في نظر الأستاذ توفيق الحكيم؟ وماذا ترتّب عنه؟', 'هل للأدباء مبادئ وقيم يدافعون عنها؟ بين ذلك.', 'ما النّزعة المقصودة في قول الكاتب: «وكيف يتجرّد كلّ أديبٍ من رداء جنسيّته الزائل ليدخل معبد الفكر الخالد»؟ علِّل.', 'كيف تتحقّق رسالة الأدب عند كلّ من توفيق الحكيم والعقّاد؟ وإلى أيّ رأي تميل؟ علّل.', 'لخّص مضمون النّص.', 'صنّف الألفاظ التّالية في حقلين دلاليين: (المتحدة، الفكرة، اجتماع، رسالة، القرائح، اتّفاق).', 'تعدّدت وسائل الحِجاج في النَّص، دُلَّ على ثلاثةٍ منها.', 'أعربْ: أ- إعرابَ مفردات: -   لفظة " توفيق" الواردة في قوله: "كتب الأستاذ توفيق الحكيم".\nولفظة "فئة" الواردة في قوله: "وجعلهم فئة لا خطر لها".\nب- إعراب جمل:   -   (تعيش) الواردة في قوله: "التي تعيش للدفاع عن قيم البشرية".\n(هي التبشير) الواردة في قوله: "ورسالة الأدباء كافة هي التبشير بدين الحرية".', 'في الفقرة الأولى ضمير متكرّر، استخرجه وبين عائده ودوره في بناء الفقرة.', 'حَدّد نوع الصورة البيانيّة مع شرحها وإبراز سرّ بلاغتها في قول الكاتب:(كتب الأستاذ توفيق الحكيم من برجه العاجيّ)، وفي قوله: (لأنّ الفكرة الفنيّة كائنٌ حيّ).', 'ما الظّاهرة النّقديّة التي أشار إليها الكاتب؟ عرّفها.', 'اُذكر أشهر الأدباء الذين عُرفوا بها.']
CRIT2 = '- قال العقّاد: «ورسالة الأدباء كافّة هي التّبشير بدين الحرّيّة والإنحاء على صولة المستبدّين».'


def el(i, label, pts):
    return {"id": i, "label": label, "max_points": pts, "verified": False}


Q = []
def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill=None, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
              "prompt": f"{title} — معيار {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": ind}},
              "answer": {"type": "essay_builder", "spec": {"rubric": ind}}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


TEXT_DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": TEXT2},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": REF2},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": GLOSS2},
]
D = TEXT_DOCS
CRIT_DOCS = [{"id": "d-crit", "kind": "text", "caption": "القول", "text": CRIT2}]

q("q1", "1", P2A, QT2[0], 2, [el("q1-e1", "ما حرم الأدباء النّفع (2×0.5)", 1), el("q1-e2", "ما ترتّب عنه (2×0.5)", 1)], D)
q("q2", "2", P2A, QT2[1], 1, [el("q2-e1", "مبادئ الأدباء وقيمهم (4×0.25)", 1)], D)
q("q3", "3", P2A, QT2[2], 2, [el("q3-e1", "النّزعة المقصودة", 1), el("q3-e2", "التّعليل", 1)], D)
q("q4", "4", P2A, QT2[3], 2, [el("q4-e1", "رسالة الأدب عند توفيق الحكيم", 0.5), el("q4-e2", "رسالة الأدب عند العقّاد", 0.5),
                              el("q4-e3", "إبداء الرّأي معلّلًا (0.75+0.25)", 1)], D)
q("q5", "5", P2A, QT2[4], 3, [el("q5-e1", "التّلخيص: الحجم", 1), el("q5-e2", "التّلخيص: المضمون", 1), el("q5-e3", "التّلخيص: سلامة اللّغة", 1)], D)
q("q6", "1", P2B, QT2[5], 1, [el("q6-e1", "الحقل الأوّل: التّضامن (الاتّحاد)", 0.5), el("q6-e2", "الحقل الثّاني: الأدب (النّقد)", 0.5)], D)
q("q7", "2", P2B, QT2[6], 0.75, [el("q7-e1", "ثلاث وسائل حجاجيّة (3×0.25)", 0.75)], D)
q("q8", "3", P2B, QT2[7], 2, [el("q8-e1", "إعراب «توفيق»", 0.5), el("q8-e2", "إعراب «فئة»", 0.5),
                              el("q8-e3", "محلّ جملة (تعيش)", 0.5), el("q8-e4", "محلّ جملة (هي التّبشير)", 0.5)], D)
q("q9", "4", P2B, QT2[8], 0.75, [el("q9-e1", "الضّمير المتكرّر", 0.25), el("q9-e2", "عائده", 0.25), el("q9-e3", "دوره في بناء الفقرة", 0.25)], D)
q("q10", "5", P2B, QT2[9], 1.5, [el("q10-e1", "(من برجه العاجيّ): النّوع", 0.25), el("q10-e2", "(من برجه العاجيّ): الشّرح", 0.25),
                                 el("q10-e3", "(من برجه العاجيّ): البلاغة", 0.25), el("q10-e4", "(الفكرة الفنّيّة كائن حيّ): النّوع", 0.25),
                                 el("q10-e5", "(الفكرة الفنّيّة كائن حيّ): الشّرح", 0.25), el("q10-e6", "(الفكرة الفنّيّة كائن حيّ): البلاغة", 0.25)], D)
q("q11", "أ", P2C, QT2[10], 2, [el("q11-e1", "الظّاهرة النّقديّة", 1), el("q11-e2", "تعريفها", 1)], D + CRIT_DOCS)
q("q12", "ب", P2C, QT2[11], 2, [el("q12-e1", "أشهر الأدباء الّذين عُرفوا بها (4×0.5)", 2)], D + CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "multi", "ما الّذي حرم الأدباء النّفع المادّيّ والأدبيّ في نظر توفيق الحكيم؟ (اختر كلّ ما يصحّ)",
   {"options": ["تشتّتهم", "انعدام روح النّظام بينهم", "كثرة اجتماعاتهم ومحافلهم", "اهتمام الدّولة المفرط بهم", "تفرّغهم للنّقد"]},
   {"correct": [0, 1]}, "الّذي حرم الأدباء النّفع المادّيّ والأدبيّ في نظر الأستاذ توفيق الحكيم هو تشتّتهم وانعدام روح النّظام بينهم.", 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "الّذي حرم الأدباء النّفع هو ____ وانعدام روح ____ بينهم.", "bank": ["تشتّتهم", "النّظام", "اتّحادهم", "التّنافس"]},
   {"blanks": [["تشتّتهم"], ["النّظام"]]}, "«هو تشتّتهم وانعدام روح النّظام بينهم».", 0.5, "ar.comprehension.details", "b")
st("s03", "q1", "q1-e2", "mcq", "وماذا ترتّب عن ذلك؟",
   {"options": ["أصبحوا فئة لا خطر لها ولا وزن في نظر الدّولة", "أصبحوا أغنى فئات المجتمع", "أصبحت الدّولة تستشيرهم في كلّ أمر", "أصبح لهم محفل يدافع عن مصالحهم"]},
   {"correct": 0}, "وترتّب عن ذلك أنّهم أصبحوا فئة لا خطر لها ولا وزن في نظر الدّولة.", 0.5, "ar.comprehension.link")
st("s04", "q1", "q1-e2", "fill_blank", "أكمل الشّاهد من النّصّ:",
   {"text": "«وجعلهم فئة لا ____ لها ولا ____ في نظر الدّولة»", "bank": ["خطر", "وزن", "حدود", "مال"]},
   {"blanks": [["خطر"], ["وزن"]]}, "«وجعلهم فئة لا خطر لها ولا وزن في نظر الدّولة».", 0.5, "ar.comprehension.evidence", "b")
st("s05", "q2", "q2-e1", "multi", "ما المبادئ والقيم الّتي يدافع عنها الأدباء؟ (اختر كلّ ما يصحّ)",
   {"options": ["الحرّيّة", "الفكر", "العدالة", "الحقّ", "الجمال", "الثّروة", "الشّهرة"]},
   {"correct": [0, 1, 2, 3, 4]}, "للأدباء مبادئ وقيم يدافعون عنها وتتمثّل في: الحرّيّة والفكر والعدالة والحقّ والجمال… (أربع منها تكفي).", 1, "ar.comprehension.values")
st("s06", "q3", "q3-e1", "mcq", "ما النّزعة المقصودة في قوله: «وكيف يتجرّد كلّ أديب من رداء جنسيّته الزّائل ليدخل معبد الفكر الخالد»؟",
   {"options": ["النّزعة الإنسانيّة", "النّزعة القوميّة", "النّزعة الوطنيّة", "النّزعة الذّاتيّة"]},
   {"correct": 0}, "النّزعة المقصودة في قوله: «كيف يتجرّد كلّ أديب…» هي النّزعة الإنسانيّة.", 1, "ar.literature.trend")
st("s07", "q3", "q3-e2", "fill_blank", "أكمل التّعليل:",
   {"text": "وذلك أنّ الأديب يحمل رسالة ____ تُنير الدّرب أمام كلّ طالب ____.", "bank": ["سامية", "للحقّ", "مادّيّة", "للمال"]},
   {"blanks": [["سامية"], ["للحقّ"]]}, "التّعليل: وذلك أنّ الأديب يحمل رسالة سامية تُنير الدّرب أمام كلّ طالب للحقّ.", 0.5, "ar.literature.trend")
st("s08", "q3", "q3-e2", "mcq", "ويُسهم الأديب بكتاباته في:",
   {"options": ["تركيز دعائم الفكر الخالد المدافع عن قيم البشريّة العليا", "خدمة جنسيّته وحدها دون غيرها", "الدّفاع عن مصالحه المادّيّة", "التّقرّب من الدّولة لنيل رضاها"]},
   {"correct": 0}, "…فيُسهم بكتاباته في تركيز دعائم الفكر الخالد المدافع عن قيم البشريّة العليا.", 0.5, "ar.literature.trend", "b")
st("s09", "q4", "q4-e1", "mcq", "كيف تتحقّق رسالة الأدب عند توفيق الحكيم؟",
   {"options": ["بتكتّل الأدباء والتفافهم حول هيئة واحدة", "بانعزال كلّ أديب في برجه العاجيّ", "بخدمة الأدباء للدّولة وتبنّي رسالتها", "بإبداع كلّ أديب منفردًا دون حاجة إلى اجتماع"]},
   {"correct": 0}, "يرى توفيق الحكيم أنّ رسالة الأدب تتحقّق بتكتّل الأدباء والتفافهم حول هيئة واحدة؛ أمّا الإبداع الفرديّ دون اجتماع فرأي العقّاد.", 0.5, "ar.comprehension.details")
st("s10", "q4", "q4-e2", "fill_blank", "أكمل رأي العقّاد في تحقّق رسالة الأدب:",
   {"text": "الأدب إبداع وخلق ____ لا يحتاج إلى تكتّل وتوحّد، وله رسالة ____ رغم اختلاف القرائح وتعدّد الآراء.", "bank": ["فرديّ", "واحدة", "جماعيّ", "متعدّدة"]},
   {"blanks": [["فرديّ"], ["واحدة"]]}, "أمّا العقّاد فيرى أنّ الأدب إبداع وخلق فرديّ لا يحتاج إلى تكتّل وتوحّد، وله رسالة واحدة رغم اختلاف القرائح وتعدّد الآراء.", 0.5, "ar.comprehension.details")
essay("s11", "q4", "q4-e3", "إلى أيّ الرّأيين تميل في تحقّق رسالة الأدب؟", "الرّأي والتّعليل", "إبداء رأي واضح (الميل إلى أحد الرّأيين) معلّل", 1,
      {"task": "إبداء الرّأي مع التّعليل", "question": QT2[3], "model": "إبداء الرّأي: يُبدي الممتحن رأيه معلّلًا (0.75+0.25)."},
      "إبداء الرّأي: يُبدي الممتحن رأيه معلّلًا.", "ar.comprehension.opinion")
SUM_SPEC = {"task": "تلخيص", "text": "نصّ العقّاد في رسالة الأدب (بكالوريا 2019، لغات أجنبيّة، الموضوع الثّاني)",
            "model_example": "(رأى توفيق الحكيم أنّ على الأدباء أن يتوحّدوا في نظام يضمن لهم حقوقهم المادّيّة والأدبيّة، فيردّ عليه العقّاد بأنّ الأدب خلق فرديّ لا حاجة فيه للاجتماع؛ إذ للأدب رسالة هي الحرّيّة والجمال والحقّ والعدالة وإن اختلفت القرائح، وتعدّدت الآراء…) (نموذج للاستئناس)"}
SUM_EXPL = "التّلخيص: يُراعى فيه الحجم، المضمون، سلامة اللّغة (3×01)؛ والتّلخيص المقترح في الحلّ نموذج للاستئناس."
for i, (crit, ind) in enumerate([("الحجم", "مراعاة حجم التّلخيص"), ("المضمون", "ملاءمة المضمون"), ("سلامة اللّغة", "سلامة اللّغة")]):
    essay(f"s{12 + i}", "q5", f"q5-e{i + 1}", "تلخيص نصّ العقّاد في رسالة الأدب", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s15", "q6", "q6-e1", "multi", "أيّ الألفاظ الآتية تنتمي إلى الحقل الدّلاليّ نفسه مع «المتّحدة»؟ (اختر كلّ ما يصحّ)",
   {"options": ["اجتماع", "اتّفاق", "الفكرة", "رسالة", "القرائح"]},
   {"correct": [0, 1]}, "حقل التّضامن (الاتّحاد): المتّحدة – اجتماع – اتّفاق.", 0.25, "ar.cohesion.effect")
st("s16", "q6", "q6-e1", "mcq", "ما اسم الحقل الّذي تنتمي إليه ألفاظ: (المتّحدة – اجتماع – اتّفاق)؟",
   {"options": ["حقل التّضامن (الاتّحاد)", "حقل الحرب", "حقل الطّبيعة", "حقل الاقتصاد"]},
   {"correct": 0}, "حقل التّضامن (الاتّحاد): المتّحدة – اجتماع – اتّفاق.", 0.25, "ar.cohesion.effect", "b")
st("s17", "q6", "q6-e2", "multi", "أيّ الألفاظ الآتية تنتمي إلى الحقل الدّلاليّ نفسه مع «الفكرة»؟ (اختر كلّ ما يصحّ)",
   {"options": ["رسالة", "القرائح", "المتّحدة", "اجتماع", "اتّفاق"]},
   {"correct": [0, 1]}, "حقل الأدب (النّقد): الفكرة – رسالة – القرائح.", 0.25, "ar.cohesion.effect")
st("s18", "q6", "q6-e2", "mcq", "ما اسم الحقل الّذي تنتمي إليه ألفاظ: (الفكرة – رسالة – القرائح)؟",
   {"options": ["حقل الأدب (النّقد)", "حقل الحرب", "حقل الطّبيعة", "حقل الاقتصاد"]},
   {"correct": 0}, "حقل الأدب (النّقد): الفكرة – رسالة – القرائح.", 0.25, "ar.cohesion.effect", "b")
st("s19", "q7", "q7-e1", "multi", "دُلّ على وسائل الحجاج في النّصّ. (اختر كلّ ما يصحّ)",
   {"options": ["توظيف أدوات التّوكيد", "النّفي والإثبات", "المقارنة بين موقفين مختلفين", "الجمل الاسميّة", "السّرد القصصيّ لأحداث متخيّلة", "الوصف الحسّيّ للطّبيعة"]},
   {"correct": [0, 1, 2, 3]}, "وسائل الحجاج في النّصّ: توظيف أدوات التّوكيد (إنّ، أنّ، إنّما، قد، جميعهم، كافّة…)، النّفي والإثبات (لا تنظر إلى الأدب بعين الجدّ بل إنّه عندها…)، المقارنة بين موقفين مختلفين (موقف توفيق الحكيم وموقف العقّاد)، الجمل الاسميّة (الحقيقة أنّ الأدباء – رسالة الأدباء هي التّبشير). يكفي ذكر ثلاث.", 0.5, "ar.text.type")
st("s20", "q7", "q7-e1", "matching", "طابق كلّ وسيلة حجاجيّة بمثالها من النّصّ.",
   {"lefts": ["توظيف أدوات التّوكيد", "النّفي والإثبات", "المقارنة بين موقفين مختلفين"],
    "rights": ["(إنّ، أنّ، إنّما، قد)", "(لا تنظر إلى الأدب بعين الجدّ، بل إنّه عندها…)", "(موقف توفيق الحكيم وموقف العقّاد)"]},
   {"pairs": [0, 1, 2]}, "توظيف أدوات التّوكيد: (إنّ، أنّ، إنّما، قد…)؛ النّفي والإثبات: (لا تنظر إلى الأدب بعين الجدّ بل إنّه عندها…)؛ المقارنة بين موقفين مختلفين: (موقف توفيق الحكيم وموقف العقّاد).", 0.25, "ar.text.type", "b")
st("s21", "q8", "q8-e1", "mcq", "ما إعراب «توفيق» في قوله: «كتب الأستاذ توفيق الحكيم»؟",
   {"options": ["بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة على آخره"]},
   {"correct": 0}, "«توفيقُ»: بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره (ملاحظة: تُقبل إجابة عطف بيان).", 0.5, "ar.grammar.badal")
st("s22", "q8", "q8-e2", "fill_blank", "أكمل إعراب «فئة» في قوله: «وجعلهم فئة لا خطر لها»:",
   {"text": "فئةً: مفعول به ____ للفعل «____» منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", "bank": ["ثانٍ", "جعل", "أوّل", "كتب"]},
   {"blanks": [["ثانٍ"], ["جعل"]]}, "«فئةً»: مفعول به ثانٍ للفعل «جعل» منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s23", "q8", "q8-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (تعيش) في قوله: «الّتي تعيش للدّفاع عن قيم البشريّة»؟",
   {"options": ["جملة فعليّة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع نعت", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "(تعيش): جملة فعليّة صلة الموصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s24", "q8", "q8-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (هي التّبشير) في قوله: «ورسالة الأدباء كافّة هي التّبشير بدين الحرّيّة»؟",
   {"options": ["جملة اسميّة في محلّ رفع خبر للمبتدأ «رسالة»", "جملة اسميّة في محلّ نصب حال", "جملة اسميّة في محلّ رفع نعت لـ«الأدباء»", "جملة اسميّة لا محلّ لها من الإعراب، استئنافيّة"]},
   {"correct": 0}, "(هي التّبشير): جملة اسميّة في محلّ رفع خبر للمبتدأ «رسالة».", 0.5, "ar.grammar.sentence_case")
st("s25", "q9", "q9-e1", "mcq", "ما الضّمير المتكرّر في الفقرة الأولى؟",
   {"options": ["«هم»", "«نحن»", "«أنتم»", "«أنا»"]},
   {"correct": 0}, "الضّمير المتكرّر في الفقرة الأولى: «هم» (شملهم، انصرافهم، يربطهم، جميعهم، يعنيهم، عليهم، جعلهم).", 0.25, "ar.cohesion.reference")
st("s26", "q9", "q9-e2", "mcq", "على من يعود الضّمير «هم»؟",
   {"options": ["الأدباء", "الدّولة", "توفيق الحكيم", "المسائل"]},
   {"correct": 0}, "عائده: الأدباء.", 0.25, "ar.cohesion.reference")
st("s27", "q9", "q9-e3", "fill_blank", "أكمل دور الضّمير «هم» في بناء الفقرة:",
   {"text": "الرّبط وتوفير خاصّيّة ____ عن طريق الإحالة.", "bank": ["الاتّساق", "التّنافر", "الغموض"]},
   {"blanks": [["الاتّساق"]]}, "دوره في بناء الفقرة: الرّبط وتوفير خاصّيّة الاتّساق عن طريق الإحالة (يكتب الحلّ: «الإحالة البعديّة»).", 0.25, "ar.cohesion.effect")
st("s28", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في (كتب الأستاذ توفيق الحكيم من برجه العاجيّ)؟",
   {"options": ["كناية", "تشبيه بليغ", "مجاز عقليّ", "تشبيه مرسل"]},
   {"correct": 0}, "(كتب توفيق الحكيم من برجه العاجيّ): كناية.", 0.25, "ar.rhetoric.metonymy")
st("s29", "q10", "q10-e2", "mcq", "اشرح الصّورة: عمَّ كنّى الكاتب بقوله (من برجه العاجيّ)؟",
   {"options": ["كناية عن صفة التّعالي", "كناية عن صفة الكرم", "كناية عن موصوف هو الدّولة", "كناية عن صفة الفقر"]},
   {"correct": 0}, "شرحها: كناية عن صفة التّعالي.", 0.25, "ar.rhetoric.metonymy")
st("s30", "q10", "q10-e3", "mcq", "ما بلاغة الكناية في (من برجه العاجيّ)؟",
   {"options": ["تعطيك حقيقة التّعالي مصحوبة بالدّليل (البرج العاجيّ)", "توضيح المعنى وتشخيصه في شكل كائن حيّ",
                "إيهام المتلقّي بالتّطابق بين المشبّه والمشبّه به", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "بلاغتها: تعطيك حقيقة التّعالي مصحوبة بالدّليل (البرج العاجيّ).", 0.25, "ar.rhetoric.effect")
st("s31", "q10", "q10-e4", "mcq", "ما نوع الصّورة البيانيّة في (لأنّ الفكرة الفنّيّة كائنٌ حيّ)؟",
   {"options": ["تشبيه بليغ", "استعارة مكنيّة", "كناية عن صفة", "تشبيه مرسل مجمل"]},
   {"correct": 0}, "(لأنّ الفكرة الفنّيّة كائن حيّ): تشبيه بليغ.", 0.25, "ar.rhetoric.simile")
st("s32", "q10", "q10-e5", "matching", "اشرح الصّورة: حدّد طرفي التّشبيه في (الفكرة الفنّيّة كائنٌ حيّ).",
   {"lefts": ["المشبّه", "المشبّه به"], "rights": ["الفكرة", "الكائن (الحيّ)", "الولد", "الذّهن"]},
   {"pairs": [0, 1]}, "شرحها: شبّه الفكرة بالكائن (الحيّ).", 0.25, "ar.rhetoric.simile")
st("s33", "q10", "q10-e6", "mcq", "ما بلاغة التّشبيه في (لأنّ الفكرة الفنّيّة كائنٌ حيّ)؟",
   {"options": ["توضيح معنى الفكرة وتشخيصها في شكل كائن حيّ", "تعطيك الحقيقة مصحوبة بالدّليل", "الإيجاز بحذف المشبّه به", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "بلاغتها: توضيح معنى الفكرة وتشخيصها في شكل كائن حيّ.", 0.25, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
st("s34", "q11", "q11-e1", "mcq", "ما الظّاهرة النّقديّة الّتي أشار إليها العقّاد في قوله: «ورسالة الأدباء كافّة هي التّبشير بدين الحرّيّة…»؟",
   {"options": ["ظاهرة التّجديد", "ظاهرة التّقليد", "ظاهرة الإحياء والبعث", "ظاهرة السّرقات الأدبيّة"]},
   {"correct": 0}, "الظّاهرة النّقديّة المقصودة هي: «ظاهرة التّجديد».", 1, "ar.literature.renewal")
st("s35", "q11", "q11-e2", "fill_blank", "أكمل تعريف الظّاهرة:",
   {"text": "هي حرّيّة الأديب ورسالة الأدب ____، وذلك بإعطاء الأدب مساحة أوسع في تناول الموضوعات وأساليب التّعبير، و____ على قيود القديم.",
    "bank": ["الإنسانيّة", "الثّورة", "المادّيّة", "المحافظة"]},
   {"blanks": [["الإنسانيّة"], ["الثّورة"]]}, "تعريفها: هي حرّيّة الأديب ورسالة الأدب الإنسانيّة، وذلك بإعطاء الأدب مساحة أوسع في تناول الموضوعات وأساليب التّعبير والثّورة على قيود القديم الّذي استبدّ بعقول النّاس ردحًا من الزّمن…", 0.5, "ar.literature.renewal")
st("s36", "q11", "q11-e2", "mcq", "أيّ ممّا يلي يناسب تعريف هذه الظّاهرة؟",
   {"options": ["الثّورة على قيود القديم الّذي استبدّ بعقول النّاس ردحًا من الزّمن", "التّمسّك بنظام القصيدة القديمة في كلّ شيء",
                "محاكاة القدماء في أغراضهم ومعجمهم", "تقييد حرّيّة الأديب بقواعد ثابتة"]},
   {"correct": 0}, "من تعريفها: الثّورة على قيود القديم الّذي استبدّ بعقول النّاس ردحًا من الزّمن…", 0.5, "ar.literature.renewal", "b")
st("s37", "q12", "q12-e1", "multi", "أيّ هؤلاء من أشهر الأدباء الّذين عُرفوا بالتّجديد؟ (اختر كلّ ما يصحّ)",
   {"options": ["طه حسين", "عبّاس محمود العقّاد (جماعة الدّيوان)", "ميخائيل نعيمة (الرّابطة القلميّة)", "جبران خليل جبران (الرّابطة القلميّة)", "امرؤ القيس", "الحطيئة"]},
   {"correct": [0, 1, 2, 3]}, "الأدباء الّذين عُرفوا بها: طه حسين – أدباء جماعة الدّيوان – أدباء الرّابطة القلميّة… (يكتفي الممتحن بذكر أربعة أدباء)؛ أمّا امرؤ القيس والحطيئة فشاعران قديمان.", 1, "ar.literature.renewal")
st("s38", "q12", "q12-e1", "fill_blank", "أكمل:",
   {"text": "من أعلام التّجديد: طه حسين، وأدباء جماعة ____ (العقّاد، المازني، شكري)، وأدباء ____ القلميّة (جبران، نعيمة، أبو ماضي).",
    "bank": ["الدّيوان", "الرّابطة", "الإحياء", "العصبة"]},
   {"blanks": [["الدّيوان"], ["الرّابطة"]]}, "«الأدباء الّذين عرفوا بها: طه حسين – أدباء جماعة الدّيوان – أدباء الرّابطة القلميّة…».", 1, "ar.literature.renewal", "b")

TITLE = "بكالوريا 2019 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (العقّاد: رسالة الأدب)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2019، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. الموضوع الرّسميّ للمقارنة: gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين "
         "(الصّفحتان 3–4، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة). ما تحته خطّ: «توفيق» و«فئة» (و«تعيش» في docx). "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. مؤجَّل (essay_builder): إبداء الرّأي في س4 (0.75+0.25 دون تحديد الجزأين، عنصر واحد) والتّلخيص س5 (3×01). "
         "للمراجعة: الحلّ يصف إحالة «هم» على «الأدباء» بأنّها «بعديّة» مع أنّ العائد سابق.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive، مع مقابلة الموضوع الرّسميّ؛ العلامات من سلّم التّنقيط؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."


# ── تدقيق محلّيّ قبل الكتابة (مهارات src/server/play/exams/skills.ts؛ نسخة من normalizeArabic في src/server/lib/arabic.ts) ──
SKILLS = {"ar.comprehension.link", "ar.comprehension.evidence", "ar.comprehension.purpose", "ar.comprehension.image", "ar.comprehension.details",
          "ar.comprehension.explain", "ar.comprehension.idea", "ar.literature.tradition", "ar.literature.renewal", "ar.literature.context",
          "ar.text.type", "ar.grammar.irab", "ar.grammar.sentence_case", "ar.grammar.maqsur", "ar.grammar.mamnu", "ar.grammar.rules",
          "ar.morphology", "ar.rhetoric.metaphor", "ar.rhetoric.simile", "ar.rhetoric.metonymy", "ar.rhetoric.effect", "ar.rhetoric.badi",
          "ar.prosody", "ar.cohesion.connectors", "ar.cohesion.reference", "ar.cohesion.effect", "ar.writing.integration", "ar.writing.summary",
          "ar.comprehension.emotion", "ar.comprehension.opinion", "ar.comprehension.values", "ar.grammar.conditional", "ar.grammar.styles",
          "ar.literature.features", "ar.literature.genre", "ar.literature.prose", "ar.literature.trend", "ar.rhetoric.insha", "ar.rhetoric.style",
          "ar.grammar.naat", "ar.grammar.badal", "ar.grammar.nawasikh"}


def _norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub("[ً-ْٰـ]", "", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _check():
    els = {e["id"]: e["max_points"] for qq in Q for e in qq["rubric_elements"]}
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els, (s["id"], s["rubric_element_id"])
        assert s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
            assert (3 <= len(p["options"]) <= 4) if t == "mcq" else len(p["options"]) >= 3, (s["id"], "option count")
            if t == "multi":
                assert 0 < len(a["correct"]) < len(p["options"]) and len(set(a["correct"])) == len(a["correct"]), s["id"]
            else:
                assert 0 <= a["correct"] < len(p["options"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(p["bank"]) > len(a["blanks"]), (s["id"], "no distractor in bank")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2, s["id"]
            assert len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]), s["id"]
            assert all(0 <= i < len(p["rights"]) for i in a["pairs"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            # الإجابة الصّحيحة لا تظهر في عنوان وثيقة (القاعدة 12)
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, mx in els.items():
        assert abs(got.get(eid, 0) - mx) < 1e-9, (eid, got.get(eid), mx)
    assert abs(sum(qq["rubric_total"] for qq in Q) - 20) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - 20) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"


_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p{PAPER}",
        "kind": "BAC", "year": 2019, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
