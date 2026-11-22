"""Conversion: BAC 2010 (session عاديّة، جوان 2010) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (ميخائيل نعيمة، مقدّمة «الآباء والبنون»).

STATUS: BLOCKED — the official mark scheme is internally inconsistent: the marks printed for البناء الفكريّ of this subject
(02_التصحيح.pdf, page 3) are 0.5+0.5 | 0.5+0.5, 0.75 | 01, 0.5 | 3×0.5 | 0.5, 2×0.5 | 3×0.75 = 9.5, while the part total
printed beside them is 10 (البناء اللّغويّ 6 and التّقويم النّقديّ 4 add up correctly ⇒ 19.5/20). Re-read at the native
1555×2280 px resolution: every value is legible, nothing is hidden. The missing 0.5 cannot be placed without inventing a
mark (a candidate is Q4, whose «*(يراعى أسلوب المترشّح.)» has no mark, but the scheme does not say so). This builder
contains the full conversion according to the printed marks and exits without writing the JSON until the owner decides
where the missing 0.5 belongs (then: add it to that rubric element and its steps, rebuild, shuffle once, validate).

Exam (most faithful source): gdrive 1fWdlC6P2Ot_NvyVugoPqTHE-blwHVist (بكالوريا العربية 2010 شعبة اللغات.docx);
same paper as PDF (owner's copy): gdrive 1RSOaz8wWGXoTp7-FRrsTeplNT2jzDVzE (بكالوريا العربية 2010 شعبة اللغات.pdf);
official ONEC paper: gdrive 16QpgypTST-u9nsT5f1gmCKy4PQczh97D (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1PePHLgVjGYt6BYv_FFVMVoWfESsTRqk- (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2010_sci_p1.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by script. The docx was
compared line by line with the official ONEC paper (scanned, native page images).

Docx vs ONEC paper:
- Same five paragraphs and the same questions.
- Defect fixed from the ONEC paper (asserted to occur once): «في غير الغزل والتسيب» ⇒ «والنسيب» (ONEC «والنّسيب»).
- Other differences are diacritics / labels only (docx kept): «المحدّثين» (ONEC «المحدَثين»), «في النّصٌ نمطان» (ONEC
  «في النّصّ»), «أوّلا- البناء الفكري: (10 نقاط)» (ONEC «أوّلا ـ البناء الفكريّ: ( 10 نقاط )»)…
- Underlined on both: «تتغذّى» and «الأمثولة»; in brackets: «(يدعوه البعض «نهضة أدبيّة»)» and «(- أعني الأدب -)».

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «لغات أجنبيّة» ⇒ LANG.
- Q1 «0.5+0.5» = النّهضة الأدبيّة العربيّة الحديثة / ارتباطها بالغرب. Q2 «0.5+0.5» = the writer's concept (a movement that
  revived Arabic literature / the credit goes to the West) + «0.75» «الرّأي الشّخصيّ» (deferred essay_builder with the
  scheme's model opinion, rule 11). Q3 «01 + 0.5» = where the irony lies / whom it targets (distractor passages are ones
  without irony; «الحدود المقدّسة» and «يدعوه البعض» are not offered). Q4 «3×0.5» = the three statements. Q5 «0.5 + 2×0.5» =
  المقال النّقديّ + two features among three ⇒ one element. Q6 «3×0.75» titles of the three units ⇒ one element
  (matching + ordering, as the main ideas of a plan in build_ar_bac_2016_lit_p1.py).
- Part 2: Q1 0.5 per word / sentence. Q2 «3×0.25» three among the listed قرائن ⇒ one element. Q3 «0.75 + 0.75 + 0.25» =
  the explanation / a simile («الأدب والحياة توأمان») / a metaphor («المرض الّذي ألمّ بلغتنا»), «يكتفي المترشّح بذكر الصّورتين
  دون شرح». Q4 «0.25+0.5» per type = السّرديّ + its indicators / التّفسيريّ + its indicators (no «الحجاجيّ / الوصفيّ»
  distractors).
- Part 3 «2×0.5 + 01 + 4×0.5» = الرّابطة القلميّة / founded by مهجر writers in 1920 in America + the three pioneers + four
  features («يكتفي المترشّح بذكر أربع خصائص» ⇒ one element).
- Deferred (essay_builder): Q2 opinion (0.75).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2010-lang-p2"
PAPER = 2
STREAMS = ["LANG"]
DOCX_ID = "1fWdlC6P2Ot_NvyVugoPqTHE-blwHVist"
DOCX_TITLE = "بكالوريا العربية 2010 شعبة اللغات.docx"
PDF_ID = "1RSOaz8wWGXoTp7-FRrsTeplNT2jzDVzE"
OFFICIAL_ID = "16QpgypTST-u9nsT5f1gmCKy4PQczh97D"
CORR_ID = "1PePHLgVjGYt6BYv_FFVMVoWfESsTRqk-"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
# @@BEGIN-GENERATED@@
PARAS = {
    27: 'إنّ ما (يدعوه البعض «نهضة أدبيّة») عندنا ليس سوى نفحة هبّت على شعرائنا وكُتّابنا الناشئين من حدائق الآداب الغربيّة، فدبّت في مخيّلاتهم وقرائحهم دَبيبَ العافية في أعضاء المريض بعد إبلاله من سقم طويل.',
    28: 'والمرض الذي ألمّ بلغتنا أجيالا متوالية كان شللا أوقف فيها حركة الحياة وجعلها، بعد عزّها السّابق، جيفة تتغذّى بها أقلام الزّعانف المستبدّين وقرائح النظامين والمقلّدين.',
    29: 'أمّا اليوم فقد رجعنا إلى الغرب الذي كان بالأمس تلميذنا لنقتبس منه أمثولة جعلناها حجر زاوية «نهضتنا الأدبيّة»، وتلك الأمثولة هي أنّ الحياة والأدب توأمان لا ينفصلان، وأنّ الأدب يتوكأ على الحياة، والحياة على الأدب، وأنّه (- أعني الأدب -) واسع كالحياة، عميق كأسرارها، وهو ينعكس فيها وتنعكس فيه.',
    30: 'لقد أدركنا، بفضل الغرب، أنّ نظم الشعر ممكن في غير الغزل والتسيب والمدح والهجاء والوصف والرثاء والفخر والحماسة، لذلك أطربتنا نغمة بعض شعرائنا المحدّثين الذين كانت لهم الجرأة على اقتحام تلك الحدود المقدّسة.',
    31: 'وانتقلت إلينا، بفضل الغرب كذلك، الرواية فوجدنا فيها مجالا واسعا لوصف الحياة والتأثير في العقول والقلوب بواسطة القلم. وأدركنا أنّ النّثر لا ينحصر في صف الكلام المسجّع والإكثار من الألفاظ الشاردة المدفونة في بطون المعاجم وتحبير المقالات المُمِلّة في مواضيع مبتذلة.',
    32: 'عن مقدمة «مسرحية الآباء والأبناء» ميخائيل نعيمة.',
    34: 'الأسئلة:',
    35: 'أوّلا- البناء الفكري: (10 نقاط)',
    36: 'ما الموضوع الذي طرقه الكاتب؟',
    37: 'قدَّم الكاتب مفهومه الخاص للنّهضة الأدبيّة. اذكره مع إبداء رأيك فيه.',
    38: 'في النّص نبرة ساخرة. أين تلمسها؟ وممّن يسخر الكاتب؟',
    39: 'بيّن بأسلوبك نظرة الكاتب إلى الأدب.',
    40: 'إلى أي فن نثري ينتمي هذا النص؟ تتبّع خصائصه مع التمثيل من النّص.',
    41: 'ضع عنوانا مناسبا للوحدات الفكريّة للنّصّ.',
    42: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    43: 'أعرب ما تحته خط إعراب مفردات وما بين قوسين إعراب جمل.',
    44: 'في النّصّ أساليب توكيد. استخرج ثلاث قرائن لفظيّة دالة عليها.',
    45: 'بِمَ تفسر كثرة الخيال في النّص؟ مثّل له بتشبيه واستعارة.',
    46: 'في النّصٌ نمطان بارزان. اذكرهما محدّدا مؤشرين لكل منهما.',
    47: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    48: 'يعكس النّصّ خصائص المدرسة التي ينتمي إليها الكاتب. اذكر هذه المدرسة وأبرز روّادها، ثم بين - مستعينا بالنّص- أهمّ خصائصها.',
}
# @@END-GENERATED@@


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


TEXT_PARAS = [PARAS[27], PARAS[28], PARAS[29], _fix(PARAS[30], "والتسيب", "والنسيب"), PARAS[31]]
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(TEXT_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[32]},
]
P1, P2, P3 = PARAS[35], PARAS[42], PARAS[47]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")


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


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": "essay_builder",
              "prompt": f"{title} — معيار {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": ind}},
              "answer": {"type": "essay_builder", "spec": {"rubric": ind}}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


q("q1", "1", P1, PARAS[36], 1, [el("q1-e1", "الموضوع: النّهضة الأدبيّة العربيّة الحديثة", 0.5), el("q1-e2", "الموضوع: ارتباطها بالغرب", 0.5)])
q("q2", "2", P1, PARAS[37], 1.75, [el("q2-e1", "مفهوم النّهضة: حركة أنعشت الأدب العربيّ وبعثته من جديد", 0.5),
                                   el("q2-e2", "مفهوم النّهضة: الفضل فيها يعود إلى الغرب", 0.5), el("q2-e3", "الرّأي الشّخصيّ", 0.75)])
q("q3", "3", P1, PARAS[38], 1.5, [el("q3-e1", "موضع النّبرة السّاخرة", 1), el("q3-e2", "من يسخر منهم الكاتب", 0.5)])
q("q4", "4", P1, PARAS[39], 1.5, [el("q4-e1", "الأدب لا ينحصر في الأغراض التّقليديّة الجافّة", 0.5), el("q4-e2", "عليه أن يجدّد ويبتعد عن التّصنّع", 0.5),
                                  el("q4-e3", "مؤثّر في الحياة، مغيّر الواقع ومصلح", 0.5)])
q("q5", "5", P1, PARAS[40], 1.5, [el("q5-e1", "الفنّ النّثريّ", 0.5), el("q5-e2", "خصائصه مع التّمثيل (2×0.5)", 1)])
q("q6", "6", P1, PARAS[41], 2.25, [el("q6-e1", "عناوين الوحدات الفكريّة (3×0.75)", 2.25)])
q("q7", "1", P2, PARAS[43], 2, [el("q7-e1", "إعراب «تتغذّى»", 0.5), el("q7-e2", "إعراب «الأمثولة»", 0.5),
                                el("q7-e3", "محلّ جملة (يدعوه البعض «نهضة أدبيّة»)", 0.5), el("q7-e4", "محلّ جملة (أعني الأدب)", 0.5)])
q("q8", "2", P2, PARAS[44], 0.75, [el("q8-e1", "ثلاث قرائن لفظيّة للتّوكيد (3×0.25)", 0.75)])
q("q9", "3", P2, PARAS[45], 1.75, [el("q9-e1", "تفسير كثرة الخيال", 0.75), el("q9-e2", "مثال التّشبيه", 0.75), el("q9-e3", "مثال الاستعارة", 0.25)])
q("q10", "4", P2, PARAS[46], 1.5, [el("q10-e1", "النّمط السّرديّ", 0.25), el("q10-e2", "مؤشّرا السّرديّ", 0.5), el("q10-e3", "النّمط التّفسيريّ", 0.25),
                                   el("q10-e4", "مؤشّرا التّفسيريّ", 0.5)])
q("q11", "التّعليمة", P3, PARAS[48], 4, [el("q11-e1", "المدرسة: الرّابطة القلميّة", 0.5), el("q11-e2", "نشأتها: أدباء المهجر، 1920، أمريكا", 0.5),
                                       el("q11-e3", "أبرز روّادها", 1), el("q11-e4", "أهمّ خصائصها (4×0.5)", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "طرح الكاتب موضوع النّهضة الأدبيّة العربيّة الحديثة وارتباطها بالغرب (0.5+0.5)."
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي طرقه الكاتب؟ (الشّقّ الأوّل)",
   {"options": ["النّهضة الأدبيّة العربيّة الحديثة", "الأدب الجاهليّ وأغراضه", "حياة الأدباء في المهجر", "فنّ المسرح عند الغرب"]}, {"correct": 0}, Q1_EXPL, 0.5,
   "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل الشّقّ الثّاني من الموضوع:",
   {"text": "النّهضة الأدبيّة العربيّة الحديثة و____ بالغرب.", "bank": ["ارتباطها", "انفصالها", "عداوتها"]}, {"blanks": [["ارتباطها"]]}, Q1_EXPL, 0.5,
   "ar.comprehension.idea")
Q2_EXPL = ("يرى الكاتب أنّ النّهضة الأدبيّة هي حركة أنعشت الأدب العربيّ وبعثته من جديد، لكنّ الفضل في هذا يعود إلى الغرب (0.5+0.5). "
           "الرّأي الشّخصيّ (0.75): مثال الحلّ: «نوافق الكاتب في وجود تأثير غربيّ على نهضتنا لكنّنا لا نوافقه في نسب الفضل كلّه له، إذ لا يمكن إنكار "
           "فضل تراثنا الضّخم والجهود الشّخصيّة لأعلام النّهضة الحديثة».")
st("s03", "q2", "q2-e1", "mcq", "ما مفهوم الكاتب الخاصّ للنّهضة الأدبيّة؟",
   {"options": ["حركة أنعشت الأدب العربيّ وبعثته من جديد", "عودة إلى تقليد القدماء في أغراضهم", "قطيعة تامّة بين الأدب والحياة", "حركة سياسيّة لا صلة لها بالأدب"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s04", "q2", "q2-e2", "fill_blank", "أكمل مفهوم الكاتب:",
   {"text": "لكنّ الفضل في هذا يعود إلى ____.", "bank": ["الغرب", "القدماء", "الشّعراء المقلّدين"]}, {"blanks": [["الغرب"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain")
essay("s05", "q2", "q2-e3", "مفهوم ميخائيل نعيمة للنّهضة الأدبيّة", "الرّأي الشّخصيّ", "يبدي المترشّح رأيه في مفهوم الكاتب للنّهضة الأدبيّة مع التّعليل", 0.75,
      {"task": "إبداء الرّأي", "question": PARAS[37],
       "model_example": "نوافق الكاتب في وجود تأثير غربيّ على نهضتنا لكنّنا لا نوافقه في نسب الفضل كلّه له، إذ لا يمكن إنكار فضل تراثنا الضّخم والجهود الشّخصيّة لأعلام النّهضة الحديثة."},
      Q2_EXPL, "ar.comprehension.opinion")
Q3_EXPL = ("نلمس النّبرة السّاخرة في النّصّ في قوله: «جيفة تتغذّى بها أقلام الزّعانف المستبدّين وقرائح النّظّامين والمقلّدين» (01). "
           "يسخر الكاتب من الأدباء المقلّدين المقدّسين التّراث، الرّافضين التّجديد (المحافظين) (0.5).")
st("s06", "q3", "q3-e1", "mcq", "في النّصّ نبرة ساخرة. أين تلمسها؟",
   {"options": ["في قوله: «جيفة تتغذّى بها أقلام الزّعانف المستبدّين وقرائح النّظّامين والمقلّدين»",
                "في قوله: «فوجدنا فيها مجالا واسعا لوصف الحياة والتّأثير في العقول والقلوب بواسطة القلم»",
                "في قوله: «وتلك الأمثولة هي أنّ الحياة والأدب توأمان لا ينفصلان»"]},
   {"correct": 0}, Q3_EXPL, 1, "ar.rhetoric.style")
st("s07", "q3", "q3-e2", "mcq", "ممّن يسخر الكاتب؟",
   {"options": ["من الأدباء المقلّدين المقدّسين التّراث، الرّافضين التّجديد (المحافظين)", "من الأدباء الغربيّين", "من الشّعراء المحدثين المجدّدين",
                "من كتّاب الرّواية"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
Q4_EXPL = ("يرى الكاتب أنّ الأدب: لا ينحصر في الأغراض التّقليديّة الجافّة؛ عليه أن يجدّد ويبتعد عن التّصنّع؛ مؤثّر في الحياة، مغيّر الواقع ومصلح (3×0.5). "
           "(يراعى أسلوب المترشّح.)")
st("s08", "q4", "q4-e1", "mcq", "كيف ينظر الكاتب إلى الأدب؟ يرى أنّ الأدب…",
   {"options": ["لا ينحصر في الأغراض التّقليديّة الجافّة", "ينحصر في الغزل والمدح والهجاء والرّثاء", "منفصل عن الحياة", "صناعة لفظيّة غايتها السّجع"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.explain")
st("s09", "q4", "q4-e2", "fill_blank", "أكمل نظرة الكاتب إلى الأدب:",
   {"text": "عليه أن ____ ويبتعد عن ____.", "bank": ["يجدّد", "التّصنّع", "يقلّد", "البساطة"]},
   {"blanks": [["يجدّد"], ["التّصنّع"]]}, Q4_EXPL, 0.5, "ar.comprehension.explain")
st("s10", "q4", "q4-e3", "mcq", "والأدب في نظر الكاتب…",
   {"options": ["مؤثّر في الحياة، مغيّر الواقع ومصلح", "ترف لا أثر له في الحياة", "نقل حرفيّ للآداب الغربيّة", "حبيس بطون المعاجم"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.explain")
Q5_EXPL = ("ينتمي النّصّ إلى فنّ المقال النّقديّ (0.5). خصائصه مع التّمثيل (يشير المترشّح إلى عنصرين، 2×0.5): الموضوع المطروح: قضيّة أدبيّة؛ اعتماد النّصّ "
           "على عناصر بناء المقال (المقدّمة، العرض، الخاتمة)؛ المصطلحات المناسبة (نهضة.. قرائح.. المقلّدين.. الرّواية).")
st("s11", "q5", "q5-e1", "mcq", "إلى أيّ فنّ نثريّ ينتمي هذا النّصّ؟",
   {"options": ["فنّ المقال النّقديّ", "فنّ القصّة القصيرة", "فنّ الرّواية", "فنّ الخطابة"]}, {"correct": 0}, Q5_EXPL, 0.5, "ar.literature.prose")
st("s12", "q5", "q5-e2", "matching", "تتبّع خصائص المقال في النّصّ: طابق كلّ خاصّيّة بما يمثّلها.",
   {"lefts": ["الموضوع المطروح", "اعتماد النّصّ على عناصر بناء المقال", "المصطلحات المناسبة"],
    "rights": ["قضيّة أدبيّة", "(المقدّمة، العرض، الخاتمة)", "(نهضة.. قرائح.. المقلّدين.. الرّواية)", "قضيّة سياسيّة"]},
   {"pairs": [0, 1, 2]}, Q5_EXPL, 1, "ar.literature.features")
UNITS_EXPL = ("عناوين الفقرات: «إنّ ما … المقلّدين» = تعريف النّهضة الأدبيّة؛ «أمّا اليوم … تنعكس فيه» = ارتباط الأدب بالحياة؛ «لقد أدركنا … مبتذلة» = "
              "أثر الغرب على الشّعر والنّثر العربيّين (3×0.75).")
st("s13", "q6", "q6-e1", "matching", "ضع عنوانًا مناسبًا لكلّ وحدة فكريّة: طابق كلّ وحدة بعنوانها.",
   {"lefts": ["«إنّ ما … المقلّدين»", "«أمّا اليوم … تنعكس فيه»", "«لقد أدركنا … مبتذلة»"],
    "rights": ["تعريف النّهضة الأدبيّة", "ارتباط الأدب بالحياة", "أثر الغرب على الشّعر والنّثر العربيّين", "رثاء الأدب العربيّ القديم"]},
   {"pairs": [0, 1, 2]}, UNITS_EXPL, 1.25, "ar.writing.title")
st("s14", "q6", "q6-e1", "ordering", "رتّب عناوين الوحدات الفكريّة كما وردت في النّصّ.",
   {"items": ["تعريف النّهضة الأدبيّة", "ارتباط الأدب بالحياة", "أثر الغرب على الشّعر والنّثر العربيّين"]},
   {"order": [0, 1, 2]}, UNITS_EXPL, 1, "ar.writing.title", "b")
# ── ثانيًا: البناء اللّغويّ ──
st("s15", "q7", "q7-e1", "mcq", "ما إعراب «تتغذّى» (ما تحته خطّ) في قوله: «جيفة تتغذّى بها أقلام الزّعانف»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الألف للتّعذّر", "فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الألف للثّقل",
                "فعل ماضٍ مبنيّ على الفتح المقدّر", "فعل مضارع مجزوم وعلامة جزمه حذف حرف العلّة"]},
   {"correct": 0}, "تتغذّى: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الألف للتّعذّر.", 0.5, "ar.grammar.irab")
st("s16", "q7", "q7-e2", "mcq", "ما إعراب «الأمثولة» (ما تحته خطّ) في قوله: «وتلك الأمثولة هي أنّ الحياة والأدب توأمان»؟",
   {"options": ["بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة", "خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة",
                "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة"]},
   {"correct": 0}, "الأمثولة: بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة.", 0.5, "ar.grammar.badal")
st("s17", "q7", "q7-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (يدعوه البعض «نهضة أدبيّة») في قوله: «إنّ ما (يدعوه البعض «نهضة أدبيّة») عندنا ليس سوى نفحة»؟",
   {"options": ["جملة فعليّة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر «إنّ»", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "«يدعوه البعض نهضة أدبيّة»: جملة فعليّة صلة الموصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s18", "q7", "q7-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (أعني الأدب) في قوله: «وأنّه (- أعني الأدب -) واسع كالحياة»؟",
   {"options": ["جملة اعتراضيّة لا محلّ لها من الإعراب", "جملة في محلّ رفع خبر «أنّ»", "جملة في محلّ نصب حال", "جملة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "«أعني الأدب»: جملة اعتراضيّة لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s19", "q8", "q8-e1", "multi", "في النّصّ أساليب توكيد. أيّ ممّا يلي من قرائنها اللّفظيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["إنّ", "قد", "أمّا", "التّكرار (لفظة «أدب»)", "التّكرار (عبارة «بفضل الغرب»)", "لعلّ", "ليت", "هل"]},
   {"correct": [0, 1, 2, 3, 4]}, "القرائن اللّفظيّة المؤكّدة هي: إنّ… قد… أمّا… التّكرار (لفظة أدب) و(عبارة بفضل الغرب) (3×0.25).", 0.75, "ar.rhetoric.style")
IMG_EXPL = ("النّصّ مقال نقديّ ورغم ذلك زخر بالبيان لأنّه أدّى وظيفة التّوضيح والإقناع ولم يكن القصد منه الجانب الجماليّ الفنّيّ (0.75). "
            "من أمثلة ذلك، التّشبيه: «الأدب والحياة توأمان..» (0.75)؛ الاستعارة: «المرض الّذي ألمّ بلغتنا» (0.25). يكتفي المترشّح بذكر الصّورتين دون شرح.")
st("s20", "q9", "q9-e1", "mcq", "بمَ تفسّر كثرة الخيال في النّصّ؟",
   {"options": ["النّصّ مقال نقديّ، ورغم ذلك زخر بالبيان لأنّه أدّى وظيفة التّوضيح والإقناع، ولم يكن القصد منه الجانب الجماليّ الفنّيّ",
                "لأنّ الكاتب أراد الزّخرفة اللّفظيّة لذاتها", "لأنّ النّصّ قصيدة شعريّة", "لأنّ الكاتب يقلّد أسلوب المقامات"]},
   {"correct": 0}, IMG_EXPL, 0.75, "ar.rhetoric.effect")
st("s21", "q9", "q9-e2", "mcq", "مثّل لكثرة الخيال بتشبيه من النّصّ:",
   {"options": ["«الأدب والحياة توأمان»", "«المرض الّذي ألمّ بلغتنا»", "«لقد أدركنا، بفضل الغرب»"]}, {"correct": 0}, IMG_EXPL, 0.75, "ar.rhetoric.simile")
st("s22", "q9", "q9-e3", "mcq", "ومثّل له باستعارة من النّصّ:",
   {"options": ["«المرض الّذي ألمّ بلغتنا»", "«الأدب والحياة توأمان»", "«لقد أدركنا، بفضل الغرب»"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
TYPE_EXPL = ("النّمطان التّعبيريّان هما: السّرديّ: من مؤشّراته توظيف الأفعال الماضية، الظّروف… (0.25+0.5)؛ التّفسيريّ: من مؤشّراته الشّرح والتّحليل "
             "والاستنتاج، الإقناع والتّمثيل (0.25+0.5).")
st("s23", "q10", "q10-e1", "mcq", "في النّصّ نمطان بارزان، أحدهما التّفسيريّ. ما الآخر؟",
   {"options": ["السّرديّ", "الحواريّ", "الإيعازيّ"]}, {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
st("s24", "q10", "q10-e2", "multi", "من مؤشّرات النّمط السّرديّ في النّصّ: (اختر كلّ ما يصحّ)",
   {"options": ["توظيف الأفعال الماضية", "الظّروف", "صيغ الأمر والنّهي", "الحوار بين الشّخصيّات"]}, {"correct": [0, 1]}, TYPE_EXPL, 0.5, "ar.text.type")
st("s25", "q10", "q10-e3", "mcq", "وأحد النّمطين البارزين هو السّرديّ. ما الآخر؟",
   {"options": ["التّفسيريّ", "الحواريّ", "الإيعازيّ"]}, {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
st("s26", "q10", "q10-e4", "multi", "من مؤشّرات النّمط التّفسيريّ في النّصّ: (اختر كلّ ما يصحّ)",
   {"options": ["الشّرح", "التّحليل", "الاستنتاج", "الإقناع والتّمثيل", "صيغ الأمر والنّهي", "الحوار بين الشّخصيّات"]}, {"correct": [0, 1, 2, 3]}, TYPE_EXPL, 0.5,
   "ar.text.type")
# ── ثالثًا: التّقويم النّقديّ ──
SCH_EXPL = ("مدرسة الكاتب الأدبيّة هي الرّابطة القلميّة الّتي أنشأها مجموعة من أدباء المهجر عام 1920 بأمريكا (2×0.5). أبرز روّادها: ميخائيل نعيمة، جبران خليل "
            "جبران وإيليا أبو ماضي (01). أهمّ خصائصها: الدّعوة إلى التّجديد (موضوع هذا النّصّ)؛ سهولة اللّغة؛ ربط الأدب بالحياة؛ بعد الصّور عن التّصنّع والتّكلّف "
            "(يكتفي المترشّح بذكر أربع خصائص) (4×0.5).")
st("s27", "q11", "q11-e1", "mcq", "ما المدرسة الّتي ينتمي إليها الكاتب؟",
   {"options": ["الرّابطة القلميّة", "مدرسة الإحياء والبعث", "مدرسة الدّيوان", "جماعة أبولّو"]}, {"correct": 0}, SCH_EXPL, 0.5, "ar.literature.trend")
st("s28", "q11", "q11-e2", "fill_blank", "أكمل التّعريف بهذه المدرسة:",
   {"text": "أنشأها مجموعة من أدباء ____ عام ____ بأمريكا.", "bank": ["المهجر", "1920", "المشرق", "1932"]},
   {"blanks": [["المهجر"], ["1920"]]}, SCH_EXPL, 0.5, "ar.literature.trend")
st("s29", "q11", "q11-e3", "multi", "من أبرز روّادها: (اختر كلّ ما يصحّ)",
   {"options": ["ميخائيل نعيمة", "جبران خليل جبران", "إيليا أبو ماضي", "أحمد شوقي", "حافظ إبراهيم"]}, {"correct": [0, 1, 2]}, SCH_EXPL, 1, "ar.literature.trend")
st("s30", "q11", "q11-e4", "multi", "من أهمّ خصائص هذه المدرسة: (اختر كلّ ما يصحّ)",
   {"options": ["الدّعوة إلى التّجديد", "سهولة اللّغة", "ربط الأدب بالحياة", "بعد الصّور عن التّصنّع والتّكلّف", "التّمسّك بالأغراض التّقليديّة",
                "محاكاة القدماء في بناء القصيدة"]},
   {"correct": [0, 1, 2, 3]}, SCH_EXPL, 1, "ar.literature.features")
st("s31", "q11", "q11-e4", "fill_blank", "أكمل خصائص المدرسة مستعينًا بالنّصّ:",
   {"text": "الدّعوة إلى ____ (موضوع هذا النّصّ)، سهولة ____، ربط الأدب بـ____، بعد الصّور عن التّصنّع و____.",
    "bank": ["التّجديد", "اللّغة", "الحياة", "التّكلّف", "التّقليد", "الغموض"]},
   {"blanks": [["التّجديد"], ["اللّغة"], ["الحياة"], ["التّكلّف"]]}, SCH_EXPL, 1, "ar.literature.features", "b")

TITLE = "بكالوريا 2010 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (ميخائيل نعيمة: النّهضة الأدبيّة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2010، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: «والتسيب» ← «والنسيب». العلامات من الإجابة النّموذجيّة الرّسميّة (ص3–4، صورة ممسوحة). "
         "مؤجَّل (essay_builder): الرّأي الشّخصيّ في س2 (0.75).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
            "الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")

# ── حاجز BLOCKED: سلّم البناء الفكريّ في التّصحيح الرّسميّ مجموعه 9.5 والمطبوع 10 (المجموع 19.5) ⇒ لا يُكتب JSON ──
_total = sum(qq["rubric_total"] for qq in Q)
_part1 = sum(qq["rubric_total"] for qq in Q if qq["part"] == P1)
if abs(_total - 20) > 1e-9:
    sys.exit(f"BLOCKED {SET_ID}: the official scheme's البناء الفكريّ marks sum to {_part1} while the printed part total is 10 "
             f"(02_التصحيح.pdf p.3; whole paper {_total}/20). The JSON is not written until the owner decides where the missing 0.5 "
             "belongs (edit the rubric element and its steps, then rebuild and shuffle once).")

# ── تدقيق محلّيّ قبل الكتابة (المهارات من src/server/play/exams/skills.ts؛ التّطبيع نسخة من normalizeArabic في src/server/lib/arabic.ts) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(ar\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) > 20, "skills.ts not parsed"


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
    for qq in Q:
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for d in qq["documents"]:
            assert d.get("text") or d.get("table"), (qq["id"], d["id"])
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t == "mcq":
            assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
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
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
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
        "source_id": f"gdrive-{DOCX_ID}-p{PAPER}",
        "kind": "BAC", "year": 2010, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T16:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
