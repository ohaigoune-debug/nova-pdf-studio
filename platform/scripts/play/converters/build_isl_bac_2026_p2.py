"""Conversion: BAC 2026 (الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الثّاني
(حديث أبي هريرة «إنّ الله يرضى لكم ثلاثا…» رواه مسلم + حديث رافع بن خديج «أيّ الكسب أطيب؟» رواه الحاكم).
Pattern of the ISL pilot (build_isl_bac_2008_p2.py, CONVERSION_GUIDE.md Appendix A). Usage:
  python3 scripts/play/converters/build_isl_bac_2026_p2.py content/play-exams/sets/3AS/ISL/isl-bac-2026-p2.json
  python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/ISL/isl-bac-2026-p2.json   (ONCE)

Sources: same files as build_isl_bac_2026_p1.py — paper gdrive 1UW8apgER15DEf9aJWSZQCVbDVRHxbzMt p2 (الموضوع الثّاني), correction
gdrive 1txkvht7dulcviXGBOzfVOsdbDszOlvYj p3–4; combined copy 16MnlnMgACkCIEsciS6TFTTkV43r8874S only checked to be the same paper.
Word export WITH a text layer; text transcribed from the page image (pdftoppm -r 300/700) and checked against `pdftotext -raw/-bbox`
(dashes, spaces, tatweel); marks from the correction image.

Transcription decisions (owner to check once against the paper):
- Both hadiths copied with every diacritic visible at 700 dpi («إنَّ الله يرضَى لكُم ثلاثاً ويَكْرَهُ …»، «عن رَافِعِ بْنِ خديج…»).
  «و يَكْرَهُ» is printed with a space after the «و» ⇒ kept. The text layer encodes «الله» of «بحَبل الله» as the ligature ﷲ (U+FDF2);
  written «الله» like every other occurrence. Justification tatweel («عنـه»، «أَبِيـهِ»، «الْكَسْـبِ»، «أَطْيَـبُ») is not transcribed.
- «جـ-» (part 1, Q2) has a tatweel in the text layer, «ج-» (part 2, Q2) has none ⇒ each kept as in the text layer. «–» (U+2013) before
  «من التّعدي» and «-» elsewhere, as in the text layer.

Rubric reading (correction p3–4, one rubric element per mark line of the «مجزأة» column):
- Q1 01.5: three 0.5 lines; «يكتفى بثلاثة عناصر منها» (closed list of 5: الاسم، الكنية، الإسلام، المرويّات، الوفاة) ⇒ 3 mcq steps on
  اسمه / إسلامه / مرويّاته (the kunya is printed in the hadith itself), the explanation lists all five.
- Q2 03.5: 01 تعريف العقيدة (mcq + fill_blank) + 01 أثرها (mcq) + 0.5 محلّ الشّاهد (mcq; distractors are other sentences of the hadith
  that carry no social effect; «قِيلَ وقالَ» is deliberately NOT used: arguable) + «2x0.5» مظاهر الشّرك (multi 2 of 4).
- Q3 03: 0.5 القسم + 0.5 المرتبة + 0.5 العقوبة + 0.5 تصنيفها + 01 دليلها. «يُقبل الدّليل من القرآن أو من السّنّة» ⇒ the evidence line is
  OPEN ⇒ deferred essay_builder (its spec names the correction's evidence, سورة المائدة 38, without re-transcribing the verse).
- Q4 03: three lines «2x0.5» (السّبب + المثال) ⇒ three elements; per element one mcq on the cause (given the correction's example) and one
  mcq on the example (given the cause); the cause steps come first.
- Q5 01: 0.5 حكم + 0.5 فائدة, «تُقبل كلّ الأحكام والفوائد الصّحيحة» ⇒ OPEN ⇒ deferred (2 steps of 0.5).
- Part 2 Q1 2.5: 01 التّعريف («عرّف واحدا منهما»: the correction gives المرابحة «(أو)» الصّرف ⇒ asked on المرابحة, the صرف
  definition/example never used as distractors) + 0.5 المثال + 0.5 عند اتّحاد الجنس + 0.5 عند اختلاف الجنس.
- Part 2 Q2 03: three lines «2x0.5» (الحكم + التّعليل) ⇒ three elements, 2 mcq each. For «أوصى أب بنصف ماله لابنه» the correction's
  reason is «لا وصيّة لوارث»; «تجاوز الثّلث» is also defensible and is therefore NOT offered as a distractor.
- Part 2 Q3 2.5: 0.5 + 0.5 المصدران + 1.5 الدّلالة على المرونة. «تقبل كلّ إجابة تتضمّن هذه الأفكار» fixes the three ideas ⇒ kept
  interactive (multi 3 of 6, 0.75 + fill_blank 0.75), like «يراعى في الشّرح النّقاط التّالية» in the pilot.
- Deferred points: 2 (Q3 الدّليل 1 + Q5 1).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "isl-bac-2026-p2"
YEAR = 2026
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE", "LIT", "LANG"]
PAPER_ID = "1UW8apgER15DEf9aJWSZQCVbDVRHxbzMt"
PAPER_TITLE = "2026 - العلوم الإسلامية - جميع الشعب - الدورة العادية - الموضوع.pdf"
CORR_ID = "1txkvht7dulcviXGBOzfVOsdbDszOlvYj"
CORR_TITLE = "2026 - العلوم الإسلامية - جميع الشعب - الدورة العادية - الحل.pdf"
COMBINED_ID = "16MnlnMgACkCIEsciS6TFTTkV43r8874S"

# ── النّصوص الحرفيّة (منسوخة من صورة الورقة الرّسميّة، ص2) ──
HADITH = ("عن أبي هريرة (رضي الله عنه) أنّ النّبيّ (صلّى الله عليه وسلّم) قال: (إنَّ الله يرضَى لكُم ثلاثاً ويَكْرَهُ لكم ثلاثاً "
          "فَيرضَى لكم أن تَعبدُوه ولا تُشرِكُوا بِهِ شيئًا وأن تعتصِمُوا بحَبل الله جميعاً ولا تفرّقُوا و يَكْرَهُ لكمْ قِيلَ وقالَ "
          "وكَثرَةَ السُّؤالِ وإضاعَةَ المالِ).")
REF = "[ رواه مسلم]"
HADITH2 = ("عن رَافِعِ بْنِ خديج، عَنْ أَبِيهِ، قَالَ: قِيلَ يَا رَسُولَ الله أَيُّ الْكَسْبِ أَطْيَبُ؟ قَالَ:\" كَسْبُ الرَّجُلِ بِيَدِهِ، "
           "وَكُلُّ بَيْعٍ مَبْرُورٍ\".")
REF2 = "[ رواه الحاكم وصحّحه]"
GLOSS2 = "- مَبْرُورٍ: لا غشّ فيه ولا خيانة."
P1 = "الجزء الأوّل: (12 نقطة)"
P2 = "الجزء الثّاني: (08 نقاط)"
SEG_IBADA = "أن تَعبدُوه ولا تُشرِكُوا بِهِ شيئًا"
SEG_ITISAM = "وأن تعتصِمُوا بحَبل الله جميعاً ولا تفرّقُوا"
SEG_MAL = "وإضاعَةَ المالِ"
SEG_THALATH = "إنَّ الله يرضَى لكُم ثلاثاً"
for _seg in (SEG_IBADA, SEG_ITISAM, SEG_MAL, SEG_THALATH):
    assert _seg in HADITH, _seg

QT = {
    1: "عرّف بالصّحابيّ راوي الحديث.",
    2: ("في الحديث نهي عن الشّرك وفي ذلك دعوة إلى توحيد الله تعالى، وهذا أصل من أصول العقيدة الإسلاميّة:\n"
        "أ- عرّف العقيدة الإسلاميّة اصطلاحا.\n"
        "ب- استخرج من الحديث أثرا للعقيدة على المجتمع مبيّنا محلّ الشّاهد عليه.\n"
        "جـ- بيّن مظاهر الشّرك في عقيدة النّصارى المحرّفة."),
    3: ("في قوله (صلّى الله عليه وسلّم): \" وإضاعة المال\" إشارة إلى أهميّة المال.\n"
        "أ- بيّن القسم الذي يندرج تحته مقصد حفظ المال ثمّ رتّبه مع بقيّة المقاصد.\n"
        "ب– من التّعدي على المال السّرقة، حدّد عقوبتها ثم صنّف هذه العقوبة، واذكر دليلها."),
    4: "الميراث من الطّرق المشروعة لانتقال المال، اذكر أسباب الميراث مع تقديم مثال لكلّ واحد منها.",
    5: "استخرج من الحديث حكما وفائدة.",
    6: ("في قوله (صلّى الله عليه وسلّم): \"وكلّ بيع مبرور\" إشارة إلى المعاملات الماليّة الجائزة والّتي منها بيع المرابحة وبيع الصّرف.\n"
        "أ- عرّف واحدا منهما اصطلاحا ثمّ قدّم مثالا عنه. ب- قارن بين بيع الصّرف والرّبا من حيث الشّروط."),
    7: ("بيّن حُكم التصرّفات الماليّة الآتية مع التّعليل:\n"
        "أ- بيع سيّارة بثمن مُقَسّط على ستّة أشهر. ب- أوصى أب بنصف ماله لابنه.\n"
        "ج- باع أرضًا حَبَسَها والده لمشروع خيريّ."),
    8: ("إليك الأحكام الشّرعيّة التالية: - جوازُ التّجارة الإلكترونيّة. - تحريم الرّبا في الأوراق النّقديّة.\n"
        "أ- استخلص المصدر التّشريعيّ المُعتمد في كلِ حُكم.\n"
        "ب- وضّح كيف يدلّ هذان المصدران على مرونة الشّريعة الإسلاميّة؟"),
}
DOCS = [
    {"id": "d-hadith", "kind": "text", "caption": "الحديث الشريف", "text": HADITH},
    {"id": "d-ref", "kind": "text", "caption": "التخريج", "text": REF},
]
DOCS2 = [
    {"id": "d-hadith2", "kind": "text", "caption": "الحديث الشريف", "text": HADITH2},
    {"id": "d-ref2", "kind": "text", "caption": "التخريج", "text": REF2},
    {"id": "d-gloss2", "kind": "text", "caption": "شرح المفردات", "text": GLOSS2},
]


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
def q(qid, number, part, text, total, elements, docs=DOCS):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def deferred(sid, qid, eid, prompt, spec, answer_spec, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": "essay_builder", "prompt": prompt,
              "payload": {"type": "essay_builder", "spec": spec}, "answer": {"type": "essay_builder", "spec": answer_spec},
              "explanation": expl, "points": pts, "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False,
              "review_status": "needs_engine_support"})


ACCEPTED = {}

q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "التعريف بالصّحابيّ: العنصر الأوّل", 0.5), el("q1-e2", "التعريف بالصّحابيّ: العنصر الثّاني", 0.5),
                             el("q1-e3", "التعريف بالصّحابيّ: العنصر الثّالث", 0.5)])
q("q2", "2", P1, QT[2], 3.5, [el("q2-e1", "أ- تعريف العقيدة الإسلاميّة اصطلاحا", 1), el("q2-e2", "ب- أثر العقيدة على المجتمع", 1),
                             el("q2-e3", "محلّ الشّاهد", 0.5), el("q2-e4", "جـ- مظاهر الشّرك في عقيدة النّصارى المحرّفة (2×0.5)", 1)])
q("q3", "3", P1, QT[3], 3, [el("q3-e1", "أ- القسم", 0.5), el("q3-e2", "المرتبة", 0.5), el("q3-e3", "ب- العقوبة", 0.5),
                           el("q3-e4", "تصنيف العقوبة", 0.5), el("q3-e5", "دليل العقوبة", 1)])
q("q4", "4", P1, QT[4], 3, [el("q4-e1", "السّبب الأوّل مع مثاله (2×0.5)", 1), el("q4-e2", "السّبب الثّاني مع مثاله (2×0.5)", 1),
                           el("q4-e3", "السّبب الثّالث مع مثاله (2×0.5)", 1)])
q("q5", "5", P1, QT[5], 1, [el("q5-e1", "الحكم", 0.5), el("q5-e2", "الفائدة", 0.5)])
q("q6", "1", P2, QT[6], 2.5, [el("q6-e1", "أ- التّعريف الاصطلاحيّ", 1), el("q6-e2", "المثال", 0.5),
                             el("q6-e3", "ب- المقارنة عند اتّحاد الجنس", 0.5), el("q6-e4", "المقارنة عند اختلاف الجنس", 0.5)], docs=DOCS2)
q("q7", "2", P2, QT[7], 3, [el("q7-e1", "أ- الحكم والتّعليل (2×0.5)", 1), el("q7-e2", "ب- الحكم والتّعليل (2×0.5)", 1),
                           el("q7-e3", "جـ- الحكم والتّعليل (2×0.5)", 1)], docs=DOCS2)
q("q8", "3", P2, QT[8], 2.5, [el("q8-e1", "أ- مصدر الحكم الأوّل", 0.5), el("q8-e2", "مصدر الحكم الثّاني", 0.5),
                             el("q8-e3", "ب- دلالة المصدرين على مرونة الشّريعة", 1.5)], docs=DOCS2)

# ── 1. التّعريف بأبي هريرة ──
RAWI_EXPL = ("التّعريف بالصّحابيّ راوي الحديث (الإجابة النّموذجيّة): اسمه: عبد الرّحمن بن صخر الدّوسيّ. كنيته: أبو هريرة. إسلامه: سنة 7هـ "
             "(عام خيبر). مرويّاته: 5374 حديثا. وفاته: 57هـ (58هـ) ودفن بالبقيع. (ملاحظة: يُكتفى بثلاثة عناصر منها.)")
st("s01", "q1", "q1-e1", "mcq", "ما اسم الصّحابيّ أبي هريرة رضي الله عنه؟",
   {"options": ["عبد الرّحمن بن صخر الدّوسيّ", "عبد الله بن عمر بن الخطّاب", "أنس بن مالك الأنصاريّ", "عبد الله بن عبّاس"]},
   {"correct": 0}, RAWI_EXPL, 0.5, "isl.concept")
st("s02", "q1", "q1-e2", "mcq", "متى أسلم أبو هريرة رضي الله عنه؟",
   {"options": ["سنة 7هـ (عام خيبر)", "قبل الهجرة في مكّة", "سنة 2هـ (عام بدر)", "سنة 10هـ (عام حجّة الوداع)"]},
   {"correct": 0}, RAWI_EXPL, 0.5, "isl.concept")
st("s03", "q1", "q1-e3", "mcq", "كم عدد مرويّات أبي هريرة رضي الله عنه؟",
   {"options": ["5374 حديثا", "2286 حديثا", "1540 حديثا", "700 حديث"]}, {"correct": 0}, RAWI_EXPL, 0.5, "isl.concept")

# ── 2. العقيدة ──
AQIDA = "هي التّصديق الجازم بأركان الإيمان السّتّة"
AQIDA_EXPL = f"تعريف العقيدة الإسلاميّة اصطلاحا (الإجابة النّموذجيّة): {AQIDA}."
st("s04", "q2", "q2-e1", "mcq", "ما تعريف العقيدة الإسلاميّة اصطلاحا؟",
   {"options": [AQIDA, "هي العلم بالأحكام الشّرعيّة العمليّة المستمدّة من أدلّتها التّفصيليّة", "هي الظّنّ الرّاجح بأركان الإيمان السّتّة",
                "هي أداء العبادات المفروضة من صلاة وصيام وزكاة"]},
   {"correct": 0}, AQIDA_EXPL, 0.5, "isl.concept")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل تعريف العقيدة الإسلاميّة اصطلاحا:",
   {"text": "هي التّصديق ____ بأركان الإيمان ____.", "bank": ["الجازم", "السّتّة", "الظّنّيّ", "الخمسة"]},
   {"blanks": [["الجازم"], ["السّتّة"]]}, AQIDA_EXPL, 0.5, "isl.concept", "b")
ATHAR_EXPL = (f"الإجابة النّموذجيّة: أثر العقيدة على المجتمع: الأخوّة والتّضامن. محلّ الشّاهد: قوله صلّى الله عليه وسلّم «{SEG_ITISAM}».")
st("s06", "q2", "q2-e2", "mcq", "ما أثر العقيدة على المجتمع الذي يُستخرج من الحديث؟",
   {"options": ["الأخوّة والتّضامن", "التّفرّق والتّنازع", "العزلة والانطواء على النّفس", "التّعصّب للقبيلة"]},
   {"correct": 0}, ATHAR_EXPL, 1, "isl.values")
st("s07", "q2", "q2-e3", "mcq", "ما محلّ الشّاهد في الحديث على أثر الأخوّة والتّضامن؟",
   {"options": [f"«{SEG_ITISAM}»", f"«{SEG_IBADA}»", f"«{SEG_MAL}»", f"«{SEG_THALATH}»"]},
   {"correct": 0}, ATHAR_EXPL, 0.5, "isl.evidence")
SHIRK_EXPL = "مظاهر الشّرك في عقيدة النّصارى المحرّفة (الإجابة النّموذجيّة): التّثليث – عقيدة التّوسّط."
st("s08", "q2", "q2-e4", "multi", "ما مظاهر الشّرك في عقيدة النّصارى المحرّفة؟ (اختر اثنين)",
   {"options": ["التّثليث", "عقيدة التّوسّط", "إفراد الله تعالى بالعبادة", "الإيمان بجميع الرّسل دون تفريق"]},
   {"correct": [0, 1]}, SHIRK_EXPL, 1, "isl.concept")

# ── 3. حفظ المال والسّرقة ──
MAQSAD_EXPL = "الإجابة النّموذجيّة: قسم المقصد ومرتبته: القسم: الضّروريّات. المرتبة: الأولى."
st("s09", "q3", "q3-e1", "mcq", "تحت أيّ قسم من أقسام المقاصد يندرج مقصد حفظ المال؟", {"options": ["الضّروريّات", "الحاجيّات", "التّحسينيّات"]},
   {"correct": 0}, MAQSAD_EXPL, 0.5, "isl.concept")
st("s10", "q3", "q3-e2", "mcq", "ما مرتبة الضّروريّات بين أقسام المقاصد؟", {"options": ["الأولى", "الثّانية", "الثّالثة"]},
   {"correct": 0}, MAQSAD_EXPL, 0.5, "isl.concept")
SARIQA_EXPL = ("الإجابة النّموذجيّة: العقوبة: قطع يد السّارق. تصنيف العقوبة: حدّ من الحدود. دليلها: الآية 38 من سورة المائدة "
               "(يُقبل الدّليل من القرآن أو من السّنّة).")
st("s11", "q3", "q3-e3", "mcq", "ما عقوبة السّرقة؟",
   {"options": ["قطع يد السّارق", "الجلد مائة جلدة", "السّجن والغرامة الماليّة فقط", "الدّية"]}, {"correct": 0}, SARIQA_EXPL, 0.5, "isl.ruling")
st("s12", "q3", "q3-e4", "mcq", "ما تصنيف عقوبة السّرقة؟", {"options": ["حدّ من الحدود", "تعزير", "قصاص"]}, {"correct": 0},
   SARIQA_EXPL, 0.5, "isl.ruling")
deferred("s13", "q3", "q3-e5", "اذكر دليل عقوبة السّرقة (من القرآن أو من السّنّة).",
         {"task": QT[3], "criterion": "دليل عقوبة السّرقة",
          "model": "قوله تعالى: ﴿ وَٱلسَّارِقُ وَٱلسَّارِقَةُ … ﴾ سورة المائدة (الآية 38)، كما طُبع في الإجابة النّموذجيّة",
          "accepts": "ملاحظة التّصحيح: يُقبل الدّليل من القرآن أو من السّنّة."},
         {"rubric": "01 لدليل صحيح من القرآن أو من السّنّة", "points": 1, "model_ref": CORR_TITLE},
         "دليل الإجابة النّموذجيّة: الآية 38 من سورة المائدة ﴿ وَٱلسَّارِقُ وَٱلسَّارِقَةُ … ﴾؛ ويُقبل الدّليل من القرآن أو من السّنّة.",
         1, "isl.evidence")

# ── 4. أسباب الميراث ──
ASBAB_EXPL = ("أسباب الميراث مع المثال (الإجابة النّموذجيّة): الزّواج – الزّوجة ترث من زوجها أو العكس؛ النّسب – الابن يرث من الأب؛ "
              "الولاء – المعتِق أو المعتِقة.")
SABAB_OPTS = ["الزّواج", "النّسب", "الولاء"]
EX = {"الزّواج": "الزّوجة ترث من زوجها أو العكس", "النّسب": "الابن يرث من الأب", "الولاء": "المعتِق أو المعتِقة"}
for i, (eid, sab, others) in enumerate([("q4-e1", "الزّواج", ["النّسب", "الولاء"]), ("q4-e2", "النّسب", ["الزّواج", "الولاء"]),
                                         ("q4-e3", "الولاء", ["الزّواج", "النّسب"])]):
    st(f"s{14 + i:02d}", "q4", eid, "mcq", f"ما سبب الميراث في المثال: «{EX[sab]}»؟", {"options": [sab] + others},
       {"correct": 0}, ASBAB_EXPL, 0.5, "isl.ruling")
for i, (eid, sab, others) in enumerate([("q4-e1", "الزّواج", ["النّسب", "الولاء"]), ("q4-e2", "النّسب", ["الزّواج", "الولاء"]),
                                         ("q4-e3", "الولاء", ["الزّواج", "النّسب"])]):
    st(f"s{17 + i:02d}", "q4", eid, "mcq", f"ما المثال الذي ذكرته الإجابة النّموذجيّة على الميراث بسبب {sab}؟",
       {"options": [EX[sab]] + [EX[o] for o in others]}, {"correct": 0}, ASBAB_EXPL, 0.5, "isl.ruling", "b")

# ── 5. حكم وفائدة: مفتوح ──
Q5_NOTE = "ملاحظة التّصحيح: تُقبل كلّ الأحكام والفوائد الصّحيحة."
deferred("s20", "q5", "q5-e1", "استخرج من الحديث حكما.",
         {"task": QT[5], "criterion": "حكم مستخرج من الحديث", "model_examples": "تحريم إضاعة المال", "accepts": Q5_NOTE},
         {"rubric": "0.5 لحكم صحيح", "points": 0.5, "model_ref": CORR_TITLE}, f"مثال الإجابة النّموذجيّة: الحكم: تحريم إضاعة المال. {Q5_NOTE}",
         0.5, "isl.ruling")
deferred("s21", "q5", "q5-e2", "استخرج من الحديث فائدة.",
         {"task": QT[5], "criterion": "فائدة مستخرجة من الحديث", "model_examples": "تحذير النّبيّ صلّى الله عليه وسلّم من التّفرّق",
          "accepts": Q5_NOTE},
         {"rubric": "0.5 لفائدة صحيحة", "points": 0.5, "model_ref": CORR_TITLE},
         f"مثال الإجابة النّموذجيّة: الفائدة: تحذير النّبيّ صلّى الله عليه وسلّم من التّفرّق. {Q5_NOTE}", 0.5, "isl.values")

# ── الجزء الثّاني — 1. المرابحة والصّرف ──
MURABAHA = "بيع السّلعة بالثّمن الذي اشتراها به وزيادة ربح معلوم"
MURABAHA_EXPL = (f"الإجابة النّموذجيّة: بيع المرابحة اصطلاحا: {MURABAHA}. مثاله: بيع سيّارة بثمنها الذي اشتريت به مع ربح قدره 10 ملايين سنتيم. "
                 "(أو) بيع الصّرف اصطلاحا: بيع النّقد بالنّقد جنسا بجنس أو بغير جنس؛ مثاله: مبادلة 1500دج بـ 100 أورو يدا بيد.")
st("s22", "q6", "q6-e1", "mcq", "ما تعريف بيع المرابحة اصطلاحا؟",
   {"options": [MURABAHA, "بيع السّلعة بأقلّ من الثّمن الذي اشتراها به", "بيع السّلعة بثمن مؤجّل يُدفع على أقساط",
                "بيع موصوف في الذّمّة بثمن معجّل"]},
   {"correct": 0}, MURABAHA_EXPL, 0.5, "isl.concept")
ACCEPTED["s22"] = ["بيع النّقد بالنّقد جنسا بجنس أو بغير جنس"]
st("s23", "q6", "q6-e1", "fill_blank", "أكمل تعريف بيع المرابحة اصطلاحا:",
   {"text": "بيع السّلعة ____ الذي اشتراها به وزيادة ربح ____.", "bank": ["بالثّمن", "معلوم", "مجهول", "بالقيمة"]},
   {"blanks": [["بالثّمن"], ["معلوم"]]}, MURABAHA_EXPL, 0.5, "isl.concept", "b")
st("s24", "q6", "q6-e2", "mcq", "ما المثال على بيع المرابحة؟",
   {"options": ["بيع سيّارة بثمنها الذي اشتريت به مع ربح قدره 10 ملايين سنتيم", "بيع سيّارة بثمن مقسّط على ستّة أشهر",
                "بيع سيّارة بأقلّ من ثمن شرائها بسبب عيب فيها", "شراء سلعة موصوفة تُسلَّم بعد شهر بثمن معجّل"]},
   {"correct": 0}, MURABAHA_EXPL, 0.5, "isl.concept")
ACCEPTED["s24"] = ["مبادلة 1500دج بـ 100 أورو يدا بيد"]
SHURUT_EXPL = ("المقارنة بين الرّبا والصّرف من حيث الشّروط (الإجابة النّموذجيّة): عند اتّحاد الجنس: إذا توفّر التّماثل والتّقابض فهو صرف، وإذا فقد "
               "أحد الشّرطين فهو ربا. عند اختلاف الجنس: إذا توفّر التّقابض فهو صرف، وإذا فقد هذا الشّرط فهو ربا.")
st("s25", "q6", "q6-e3", "mcq", "عند اتّحاد الجنس (نقد بنقد من جنسه): متى تكون المبادلة صرفا ومتى تكون ربا؟",
   {"options": ["إذا توفّر التّماثل والتّقابض فهو صرف، وإذا فقد أحد الشّرطين فهو ربا", "إذا توفّر التّقابض وحده فهو صرف ولو اختلف المقدار",
                "إذا توفّر التّماثل وحده فهو صرف ولو تأخّر التّسليم", "تكون ربا دائما لاتّحاد الجنس"]},
   {"correct": 0}, SHURUT_EXPL, 0.5, "isl.ruling")
st("s26", "q6", "q6-e4", "mcq", "عند اختلاف الجنس (عملة بعملة أخرى): متى تكون المبادلة صرفا ومتى تكون ربا؟",
   {"options": ["إذا توفّر التّقابض فهو صرف، وإذا فقد هذا الشّرط فهو ربا", "يشترط التّماثل والتّقابض معا وإلّا فهو ربا",
                "لا يشترط شيء فيجوز تأجيل التّسليم", "تكون ربا دائما لاختلاف الجنس"]},
   {"correct": 0}, SHURUT_EXPL, 0.5, "isl.ruling")

# ── 2. حكم التصرّفات الماليّة ──
TASARRUF_EXPL = ("الإجابة النّموذجيّة: أ) بيع السّيّارة بثمن مقسّط: صحيح؛ التّعليل: لأنّ بيع التّقسيط مشروع. ب) أوصى الأب لابنه بنصف ماله: غير صحيح؛ "
                 "التّعليل: لا وصيّة لوارث. جـ) بيع الأرض الحبس: غير صحيح؛ التّعليل: عدم جواز بيع الأرض الموقوفة. (ملاحظة: تُقبل عبارة حلال، جائز / "
                 "حرام، غير جائز، غير صحيح.)")
HUKM3 = ["صحيح (جائز)", "غير صحيح (غير جائز)", "مكروه"]
st("s27", "q7", "q7-e1", "mcq", "ما حكم بيع سيّارة بثمن مقسّط على ستّة أشهر؟", {"options": HUKM3}, {"correct": 0}, TASARRUF_EXPL, 0.5, "isl.ruling")
st("s28", "q7", "q7-e1", "mcq", "ما تعليل حكم بيع السّيّارة بثمن مقسّط؟",
   {"options": ["لأنّ بيع التّقسيط مشروع", "لأنّ الثّمن مجهول عند العقد", "لأنّ كلّ بيع بالأجل ربا"]}, {"correct": 0},
   TASARRUF_EXPL, 0.5, "isl.ruling", "b")
st("s29", "q7", "q7-e2", "mcq", "ما حكم وصيّة الأب لابنه بنصف ماله؟", {"options": [HUKM3[1], HUKM3[0], HUKM3[2]]}, {"correct": 0},
   TASARRUF_EXPL, 0.5, "isl.ruling")
st("s30", "q7", "q7-e2", "mcq", "ما تعليل حكم وصيّة الأب لابنه بنصف ماله؟",
   {"options": ["لا وصيّة لوارث", "لأنّ الوصيّة لا تكون إلّا للفقراء", "لأنّ الوصيّة لا تصحّ إلّا بإذن القاضي", "لأنّ الأب لا يملك التصرّف في ماله"]},
   {"correct": 0}, TASARRUF_EXPL, 0.5, "isl.ruling", "b")
ACCEPTED["s30"] = ["الثّلث"]
st("s31", "q7", "q7-e3", "mcq", "ما حكم بيع الابن أرضًا حبسها والده لمشروع خيريّ؟", {"options": [HUKM3[1], HUKM3[0], HUKM3[2]]},
   {"correct": 0}, TASARRUF_EXPL, 0.5, "isl.ruling", "c")
st("s32", "q7", "q7-e3", "mcq", "ما تعليل حكم بيع الأرض التي حبسها الوالد لمشروع خيريّ؟",
   {"options": ["عدم جواز بيع الأرض الموقوفة", "لأنّ بيع الأراضي محرّم مطلقا", "لأنّ الثّمن لم يُقبض في مجلس العقد",
                "لأنّ الابن لم يُشهد على البيع"]},
   {"correct": 0}, TASARRUF_EXPL, 0.5, "isl.ruling", "d")

# ── 3. المصادر التّبعيّة ومرونة الشّريعة ──
MASADIR_EXPL = ("الإجابة النّموذجيّة: جواز التّجارة الإلكترونيّة – المصدر: المصالح المرسلة. تحريم الرّبا في الأوراق النّقديّة – المصدر: القياس.")
st("s33", "q8", "q8-e1", "mcq", "ما المصدر التّشريعيّ المعتمد في حكم جواز التّجارة الإلكترونيّة؟",
   {"options": ["المصالح المرسلة", "الإجماع", "شرع من قبلنا"]}, {"correct": 0}, MASADIR_EXPL, 0.5, "isl.concept")
st("s34", "q8", "q8-e2", "mcq", "ما المصدر التّشريعيّ المعتمد في حكم تحريم الرّبا في الأوراق النّقديّة؟",
   {"options": ["القياس", "المصالح المرسلة", "شرع من قبلنا"]}, {"correct": 0}, MASADIR_EXPL, 0.5, "isl.concept")
MURUNA_EXPL = ("دلالة المصدرين على مرونة الشّريعة (الإجابة النّموذجيّة): كلاهما يُمكّن الشّريعة من مسايرة النّوازل – استيعاب حاجات النّاس "
               "المتجدّدة – المحافظة على صلاحية الشّريعة لكلّ زمان ومكان، فالنّصوص متناهية والوقائع غير متناهية. (ملاحظة: تُقبل كلّ إجابة "
               "تتضمّن هذه الأفكار.)")
st("s35", "q8", "q8-e3", "multi", "كيف يدلّ هذان المصدران على مرونة الشّريعة الإسلاميّة؟ (اختر ثلاثًا)",
   {"options": ["يُمكّنان الشّريعة من مسايرة النّوازل", "استيعاب حاجات النّاس المتجدّدة", "المحافظة على صلاحية الشّريعة لكلّ زمان ومكان",
                "تثبيت الأحكام الاجتهاديّة مهما تغيّرت الظّروف", "الاستغناء عن نصوص القرآن والسّنّة", "ترك الوقائع الجديدة بلا حكم شرعيّ"]},
   {"correct": [0, 1, 2]}, MURUNA_EXPL, 0.75, "isl.concept")
st("s36", "q8", "q8-e3", "fill_blank", "أكمل دلالة المصدرين على مرونة الشّريعة:",
   {"text": ("كلاهما يُمكّن الشّريعة من مسايرة ____، واستيعاب حاجات النّاس ____، والمحافظة على صلاحية الشّريعة لكلّ زمان ومكان، "
             "فالنّصوص ____ والوقائع غير متناهية."), "bank": ["النّوازل", "المتجدّدة", "متناهية", "العادات", "الثّابتة"]},
   {"blanks": [["النّوازل"], ["المتجدّدة"], ["متناهية"]]}, MURUNA_EXPL, 0.75, "isl.concept", "b")

TITLE = ("بكالوريا 2026 (الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الثّاني "
         "(حديث «إنّ الله يرضى لكم ثلاثا» / حديث «أيّ الكسب أطيب»)")
NOTES = ("موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، الدّورة 2026، «الشعبة: جميع الشعب»، المدّة 02 سا و30 د) "
         f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، ص2 = الموضوع الثّاني). الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان في ملفّ مستقلّ: "
         f"gdrive:{CORR_ID} ({CORR_TITLE}، ص3–4). النّسخة المجمّعة gdrive:{COMBINED_ID} فُتحت للتّأكّد فقط: الموضوع والتّصحيح نفسهما. "
         "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): للملفّ طبقة نصّ (تصدير Word) مقلوبة الاتّجاه تفصل الحركات والمسافات، فنُسخ النّصّ "
         "من الصّورة (700 نقطة في البوصة للحديثين) وقوبل بطبقة النّصّ في الشّرطات والمسافات والتّطويل. "
         "الحديثان بكلّ ما يظهر من ضبط؛ «و يَكْرَهُ» بمسافة بعد الواو كما طُبعت؛ «الله» في «بحَبل الله» مرمّزة في طبقة النّصّ بالحرف المركّب ﷲ "
         "فكُتبت «الله» كسائر المواضع؛ لم يُنقل تطويل ضبط الأسطر (عنـه، أَبِيـهِ، الْكَسْـبِ، أَطْيَـبُ)؛ «جـ-» في الجزء الأوّل و«ج-» في الجزء "
         "الثّاني كما في طبقة النّصّ؛ الشّرطة قبل «من التّعدي» «–» والباقي «-». "
         "التّصحيح (من الصّورة): س1 3×0.5 = 01.5؛ س2 01+01+0.5+2×0.5 = 03.5؛ س3 0.5+0.5+0.5+0.5+01 = 03؛ س4 3×(2×0.5) = 03؛ س5 0.5+0.5 = 01؛ "
         "الجزء الثّاني: س1 01+0.5+0.5+0.5 = 2.5؛ س2 3×(2×0.5) = 03؛ س3 0.5+0.5+1.5 = 2.5؛ المجموع 20. "
         "قرارات التّحويل: عنصر لكلّ سطر علامة؛ «يكتفى بثلاثة عناصر» للتّعريف بالرّاوي قائمة مغلقة (ثلاث خطوات على الاسم والإسلام والمرويّات)؛ "
         "«عرّف واحدا منهما» سُئل عن المرابحة ولم يُعرض تعريف الصّرف ولا مثاله مشتّتًا؛ تعليل الوصيّة «لا وصيّة لوارث» دون عرض «تجاوز الثّلث» "
         "مشتّتًا لأنّه قابل للدّفاع عنه؛ دليل عقوبة السّرقة («يُقبل الدّليل من القرآن أو من السّنّة») والحكم والفائدة («تُقبل كلّ الأحكام "
         "والفوائد الصّحيحة») مفتوحة فأُجّلت essay_builder (2 نقطتان مؤجّلتان)؛ «تقبل كلّ إجابة تتضمّن هذه الأفكار» يحدّد ثلاث أفكار فبقي "
         "تفاعليًّا (multi + fill_blank).")
LOG_NOTE = ("تحويل من صورتي الموضوع والإجابة النّموذجيّة الرّسميّين في Drive (طبقة النّصّ للتّدقيق فقط)؛ العلامات من سلّم التّنقيط؛ الإجابات "
            "الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة؛ ضبط الحديثين يحتاج مقابلة بالورقة.")

# ── تدقيق محلّيّ قبل الكتابة (المهارات من src/server/play/exams/skills.ts؛ التّطبيع نسخة من normalizeArabic في src/server/lib/arabic.ts) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'((?:ar|hist|geo|isl|en|fr|math|phys|svt|tech)\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert {"isl.vocab", "isl.ruling", "isl.evidence", "isl.concept", "isl.values", "isl.writing"} <= SKILLS, "skills.ts not parsed"
DEFERRED = {"table_fill", "bar_chart", "variation_table", "function_plot", "map_locate", "essay_builder"}


def _norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub("[ً-ْٰـ]", "", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _check(total=20):
    els = {e["id"]: e for qq in Q for e in qq["rubric_elements"]}
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    variants = sorted({s for e in els.values() for s in e.get("streams", [])}) or [None]
    for v in variants:
        for qq in Q:
            tot = sum(e["max_points"] for e in qq["rubric_elements"] if v is None or not e.get("streams") or v in e["streams"])
            assert abs(tot - qq["rubric_total"]) < 1e-9, (qq["id"], v, tot)
        steps_v = [s for s in S if v is None or not els[s["rubric_element_id"]].get("streams") or v in els[s["rubric_element_id"]]["streams"]]
        assert abs(sum(s["points"] for s in steps_v) - total) < 1e-9, (v, sum(s["points"] for s in steps_v))
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for d in qq["documents"]:
            assert d.get("text") or d.get("table"), (qq["id"], d["id"])
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t in DEFERRED:
            assert s["review_status"] == "needs_engine_support" and set(p) == {"type", "spec"} and set(a) == {"type", "spec"}, s["id"]
            continue
        if t == "mcq":
            assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
        if t in ("mcq", "multi"):
            assert len({_norm(o) for o in p["options"]}) == len(p["options"]), (s["id"], "duplicate options")
            wrong = [o for i, o in enumerate(p["options"]) if (i != a["correct"] if t == "mcq" else i not in a["correct"])]
            for acc in ACCEPTED.get(s["id"], []):  # صيغة يقبلها التّصحيح لا تكون مشتّتًا
                assert all(_norm(acc) != _norm(o) and _norm(acc) not in _norm(o) for o in wrong), (s["id"], "accepted form as distractor", acc)
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
            assert len(set(a["correct"])) == len(a["correct"]) and all(0 <= i < len(p["options"]) for i in a["correct"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(bank) > len(a["blanks"]), (s["id"], "no distractor in bank")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2, s["id"]
            assert len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]) and all(0 <= i < len(p["rights"]) for i in a["pairs"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        assert s["review_status"] == "needs_human_review", s["id"]
        keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
        for k in keys:  # القاعدة 12: الإجابة لا تظهر في عنوان وثيقة
            nk = _norm(k)
            assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{PAPER_ID}-p{PAPER}",
        "kind": "BAC", "year": YEAR, "level": "3AS", "streams": STREAMS, "subject": "ISL", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": f"https://drive.google.com/file/d/{PAPER_ID}/view",
        "original_file_ref": f"gdrive:{PAPER_ID} ({PAPER_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} ({CORR_TITLE})",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
pathlib.Path(OUT).parent.mkdir(parents=True, exist_ok=True)
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
deferred_pts = sum(s["points"] for s in S if s["type"] in DEFERRED)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points,",
      deferred_pts, "deferred")
