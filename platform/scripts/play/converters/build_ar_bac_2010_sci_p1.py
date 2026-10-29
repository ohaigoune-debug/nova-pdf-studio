"""Conversion: BAC 2010 (session عاديّة، جوان 2010) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (توفيق الحكيم، «فنّ الأدب»).
Exam (most faithful source): gdrive 1U-ucd85xNww3mWZCy5_tAHdAyoRwDnXF (بكالوريا لغة عربية 2010 علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1l6WePwleEKBlR4I_U1xdqPuSgfA-Uio- (بكالوريا لغة عربية 2010 علوم تجريبية.pdf);
official ONEC paper: gdrive 1om7xSzhZiKOwnhKG-exFTpcNkcfNAGbn (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة وسلّم التّنقيط»): gdrive 1bp1dwK6BB9GZaQNN9OB2wsRAB2IrKdrw (02_التصحيح.pdf, page 1).

Method (as build_ar_bac_2011_sci_p1.py / build_ar_bac_2015_lit_p2.py): PARAS below were generated from the .docx with
python-docx (paragraph text read exactly; only outer whitespace and outer direction marks trimmed) and spliced into this
builder by script; every verbatim string of the JSON was re-checked programmatically against the docx (the documented fixes
reverted). The docx was compared line by line with the official ONEC paper (scanned, page images at their native
1557×2272 px, crops enlarged up to ×3). The correction is a scanned PDF (no text layer), read from the page image (crops
at native resolution). Every mark comes from the official scheme; correct options and explanations condense its wording.

Docx vs ONEC paper:
- The docx stores the text line by line (one paragraph per printed line) ⇒ the lines of each ONEC paragraph are joined with a
  space (eight paragraphs, as on the ONEC paper). The docx label «النّـــــص:» is not on the ONEC paper for this subject
  (not used).
- Defects fixed from the ONEC paper (asserted to occur once): «شيئا حي نابضا» ⇒ «شيئا حيًّا نابضا» (word truncated);
  «إلا ّإذا» (shadda detached from «إلاّ» and stuck to «إذا») ⇒ «إلاّ إذا».
- Other differences are diacritics / punctuation / labels only (docx kept): «الوَعْظَ والإرشاد … الفن.» (ONEC «الفنّ،»),
  «الأثّر», «ضُعْفً», «الفنٌ», «عَلِمْ», «أوّلا- البناء الفكري: (12 نقاط)» (ONEC «البناء الفكريّ: (12 نقطة)»)…
- Underlined on both: «إذا» (in «فإذا طالعتَ») and «الشّعورَ»; in brackets: «(شأن الفنّ هنا أيضا شأن الدّين...)» and
  «(يَهْبط)» — the targets of Part 2 Q3, named in the step prompts.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE.
  Two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8 (no التّقويم النّقديّ), as on the ONEC paper.
- Q1: the scheme prints «2×0.75» beside the topic («وظيفة الفنّ وتأثيره في القارئ») and «1.5» beside the line before the
  aim; the part total 12 is reached only if Q1 = 3 ⇒ topic 2×0.75 (وظيفة الفنّ / تأثيره في القارئ) + aim 1.5 — to be
  confirmed by the owner.
- Q2 «0.75 + 0.75» = the two lines of the relation (يسمو بالإنسان في تفكيره / يؤثّر فيه تأثيرًا إيجابيًّا).
- Q3 «0.75 + 0.75 + 1» = the view (فنّ رفيع وفنّ رخيص) / its explanation / «إبداء الرّأي» (deferred essay_builder, rule 11).
- Q4 «2×1» = رسالة سامية نبيلة / تتطلّب منه جهدًا وتفكيرًا واستقامة. Q5 «2×0.75» two traits followed by «…» (others
  accepted) ⇒ one element; distractors are attitudes contrary to the text. Q6 «0.5 + 4×0.25» = the type (الحجاجيّ; no
  «التّفسيريّ» distractor) + exactly the four features listed ⇒ four elements (the text examples in the prompts are ours).
- Part 2: Q1 1.5, Q2 01. Q3: «إذا» «3×0.25» (one word ⇒ one element of 0.75, as «تعطيها» in build_ar_bac_2019_lit_p2.py),
  «الشّعور» 0.75, each sentence «0.25 + 0.5» = its kind / its case with the reason ⇒ two elements per sentence.
  Q4 «01 + 01 + 0.5» = type / explanation / effect.
- Distractors avoid arguable alternatives: no «عطف بيان / نعت» for «الشّعور», no «استئنافيّة / اعتراضيّة» for (شأن الفنّ…),
  no «حرف» reading of «إذا», no «كناية» for «فنّ رخيص».
- Deferred (essay_builder): Q3 opinion (1 point).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2010-sci-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1U-ucd85xNww3mWZCy5_tAHdAyoRwDnXF"
DOCX_TITLE = "بكالوريا لغة عربية 2010 علوم تجريبية.docx"
PDF_ID = "1l6WePwleEKBlR4I_U1xdqPuSgfA-Uio-"
OFFICIAL_ID = "1om7xSzhZiKOwnhKG-exFTpcNkcfNAGbn"
CORR_ID = "1bp1dwK6BB9GZaQNN9OB2wsRAB2IrKdrw"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
# @@BEGIN-GENERATED@@
PARAS = {
    3: 'قال توفيق الحكيم:',
    4: 'من المُجمَع عليه أن الوَعْظَ والإرشاد ليسا من وظيفة الفن. لأنّ وظيفة الفن هي أن يخلق',
    5: 'شيئا حي نابضا يؤثّر في النَفْسِ والفِكر.',
    6: 'ما نوع هذا التأثير؟.. هنا المسألة!..',
    7: 'إنَّ نوع التأثير هو الذي يُحدَد نوع الفن. فإذا طَالعْت أثرًا فنيا: قصيدة أو قصة أو صورة؛',
    8: 'وشعرت بعدئذ أَنَّهَا حَرّكَت مشاعرك العليا أو تفكيرك المرتفع؛ فأنت أمام فنّ رفيع... فإذا لم تحرك',
    9: 'إلا المبتذلَ من مشاعرك والتّافِه من تفكيرك فأنت أمام فن رخيصٍ.',
    10: 'هناك سؤال آخر: ما مصدر هذا التأثير في العمل الفني؟ أهو الأسلوب أم اللبّ؟.. أهو الشكل أم',
    11: 'الموضوع؟',
    12: 'إن الأثّر الفني الكامل في نظري هو ذلك الذي يُحدِث فينا ذلك الشعورَ الكامل بالارتفاع..: وقلّمَا',
    13: 'يَحْدثُ هذا إلاّ عن طريق السموّ في اللّب والأسلوبِ، لأنّ ضُعْفً الشَّكل وسُقم الأسلوب يُحدثان في',
    14: 'النَّفس شعورا بِالقُبْح والضيق والاشمئزاز، وهذا ينافي الشعور بالجمال والتناسق والانسجام.',
    15: '(شأن الفنٌ هنا أيضا شأن الدين...) فما من رجل دين يثير في نفسك إحساسا عُلويًا حقا إلا ّإذا',
    16: 'كان في طريق حياته مستقيم السلوك سليم الأسلوب... بغير ذلك يختلُّ التناسق بين الغاية',
    17: 'والوسيلة، وبهذا الاختلال يُداخل النَفس شعور الشك في حقيقة رجل الدّين.',
    18: 'لو عَلِمْ رجل الفن خطر مهمته لَفكَّرَ دهرا قبل أن يخطّ سطرا... ولكن الوحي (يَهْبط) عليه',
    19: 'فيسعفه. - ومعنى هبوط الوحي أنّ شيئا ينزل عليه من أعلى - شأنه في ذلك شأن المصطفين من',
    20: 'أهل الدين!.. وهل يمكن أن يهبط من أعلى إلا كل مرتفع نبيل؟..',
    21: 'للدّين والفن.. السَّماء هي المنبع.',
    22: '" فن الأدب "',
    25: 'الأسئلة:',
    26: 'أوّلا- البناء الفكري: (12 نقاط)',
    27: 'ما الموضوع الذي يعالجه توفيق الحكيم في هذا النص؟ وما هدفه من إثارته؟',
    28: 'ربط الكاتب بين وظيفة الدّين ووظيفة الفن. اشرح هذه العلاقة.',
    29: 'للكاتب نظرة خاصة للفن. اشرحها مبديا رأيك فيها.',
    30: 'ماذا يقصد الكاتب في قوله «لو علم رجل الفن... يخطّ سطرًا».؟',
    31: 'كيف تبدو لك شخصية توفيق الحكيم الأدبيّة من خلال النّص؟',
    32: 'ما النمط الغالب في هذا النّص؟ وما هي خصائصه؟',
    33: 'ثانيا- البناء اللّغوي: (08 نقاط)',
    34: 'تكرّرت لفظة " الفن " في كل فقرات النّص. ما دورها في بنائه؟',
    35: 'ما مدلول الحرف «لو» في النّص؟',
    36: 'أعرب ما تحته خط في النّص إعراب مفردات، وما بين قوسين إعراب جمل.',
    37: 'في العبارة: «فأنت أمام فنّ رخيص» صورة بيانيّة، اشرحها وبيّن أثرها البلاغي.',
}
# @@END-GENERATED@@


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


JS = lambda *ix: " ".join(PARAS[i] for i in ix)  # أسطر الفقرة الواحدة في docx
TEXT_PARAS = [
    _fix(JS(4, 5), "شيئا حي نابضا", "شيئا حيًّا نابضا"),
    JS(6),
    JS(7, 8, 9),
    JS(10, 11),
    JS(12, 13, 14),
    _fix(JS(15, 16, 17), "إلا ّإذا", "إلاّ إذا"),
    JS(18, 19, 20),
    JS(21),
]
assert PARAS[3].startswith("قال توفيق") and PARAS[22] == '" فن الأدب "'
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[3]},
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(TEXT_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[22]},
]
P1, P2 = PARAS[26], PARAS[33]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا")


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


q("q1", "1", P1, PARAS[27], 3, [el("q1-e1", "الموضوع: وظيفة الفنّ", 0.75), el("q1-e2", "الموضوع: تأثيره في القارئ", 0.75),
                                el("q1-e3", "الهدف من إثارة الموضوع", 1.5)])
q("q2", "2", P1, PARAS[28], 1.5, [el("q2-e1", "العلاقة: كلاهما يسمو بالإنسان في تفكيره", 0.75),
                                  el("q2-e2", "العلاقة: كلاهما يؤثّر فيه تأثيرًا إيجابيًّا", 0.75)])
q("q3", "3", P1, PARAS[29], 2.5, [el("q3-e1", "نظرة الكاتب للفنّ", 0.75), el("q3-e2", "شرح هذه النّظرة", 0.75), el("q3-e3", "إبداء الرّأي", 1)])
q("q4", "4", P1, PARAS[30], 2, [el("q4-e1", "رجل الفنّ ذو رسالة سامية نبيلة", 1), el("q4-e2", "رسالة تتطلّب منه جهدًا وتفكيرًا واستقامة", 1)])
q("q5", "5", P1, PARAS[31], 1.5, [el("q5-e1", "سمات شخصيّة الحكيم الأدبيّة (2×0.75)", 1.5)])
q("q6", "6", P1, PARAS[32], 1.5, [el("q6-e1", "النّمط الغالب", 0.5), el("q6-e2", "خاصّيّة: أساليب الشّرط", 0.25),
                                  el("q6-e3", "خاصّيّة: أساليب التّوكيد", 0.25), el("q6-e4", "خاصّيّة: المقارنة", 0.25),
                                  el("q6-e5", "خاصّيّة: التّعليل", 0.25)])
q("q7", "1", P2, PARAS[34], 1.5, [el("q7-e1", "دور تكرار لفظة «الفنّ» في بناء النّصّ", 1.5)])
q("q8", "2", P2, PARAS[35], 1, [el("q8-e1", "مدلول «لو»", 1)])
q("q9", "3", P2, PARAS[36], 3, [el("q9-e1", "إعراب «إذا» (3×0.25)", 0.75), el("q9-e2", "إعراب «الشّعور»", 0.75),
                                el("q9-e3", "(شأن الفنّ هنا أيضا شأن الدّين): نوع الجملة", 0.25),
                                el("q9-e4", "(شأن الفنّ هنا أيضا شأن الدّين): محلّها مع التّعليل", 0.5),
                                el("q9-e5", "(يهبط): نوع الجملة", 0.25), el("q9-e6", "(يهبط): محلّها مع التّعليل", 0.5)])
q("q10", "4", P2, PARAS[37], 2.5, [el("q10-e1", "نوع الصّورة", 1), el("q10-e2", "شرحها", 1), el("q10-e3", "أثرها البلاغيّ", 0.5)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("الموضوع الّذي يعالجه توفيق الحكيم في هذا النّصّ: وظيفة الفنّ وتأثيره في القارئ (2×0.75). "
           "وهدفه من إثارة هذا الموضوع: توجيه القارئ إلى انتقاء ما يطالع من الفنون (1.5).")
st("s01", "q1", "q1-e1", "mcq", "يعالج توفيق الحكيم في النّصّ موضوعًا ذا شقّين. ما شقّه الأوّل؟",
   {"options": ["وظيفة الفنّ", "تاريخ الفنون عند العرب", "سيرة رجال الدّين", "الفرق بين الشّعر والنّثر"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل الشّقّ الثّاني من الموضوع:",
   {"text": "وظيفة الفنّ و____ في ____.", "bank": ["تأثيره", "القارئ", "تاريخه", "النّاقد"]},
   {"blanks": [["تأثيره"], ["القارئ"]]}, Q1_EXPL, 0.75, "ar.comprehension.idea")
st("s03", "q1", "q1-e3", "mcq", "ما هدف الكاتب من إثارة هذا الموضوع؟",
   {"options": ["توجيه القارئ إلى انتقاء ما يطالع من الفنون", "دعوة القارئ إلى هجر الفنون كلّها", "الدّعوة إلى جعل الفنّ وسيلة للوعظ والإرشاد",
                "التّعريف بحياة رجال الدّين"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.purpose")
st("s04", "q1", "q1-e3", "fill_blank", "أكمل الهدف:",
   {"text": "توجيه ____ إلى ____ ما يطالع من الفنون.", "bank": ["القارئ", "انتقاء", "الكاتب", "تجنّب"]},
   {"blanks": [["القارئ"], ["انتقاء"]]}, Q1_EXPL, 0.75, "ar.comprehension.purpose", "b")
Q2_EXPL = "العلاقة بين وظيفة الدّين ووظيفة الفنّ هي أنّ كلًّا منهما يسمو بالإنسان في تفكيره (0.75)، ويؤثّر فيه تأثيرًا إيجابيًّا (0.75)."
st("s05", "q2", "q2-e1", "mcq", "ربط الكاتب بين وظيفة الدّين ووظيفة الفنّ. ما الّذي يجمع بينهما في تفكير الإنسان؟",
   {"options": ["كلاهما يسمو بالإنسان في تفكيره", "كلاهما يقوم على الوعظ والإرشاد المباشر", "كلاهما يحرّك المبتذل من مشاعر الإنسان",
                "كلاهما يُبعد الإنسان عن التّفكير"]},
   {"correct": 0}, Q2_EXPL + " أمّا الوعظ والإرشاد فـ«ليسا من وظيفة الفنّ» كما في النّصّ.", 0.75, "ar.comprehension.link")
st("s06", "q2", "q2-e2", "fill_blank", "أكمل الوجه الثّاني من العلاقة:",
   {"text": "وكلاهما ____ في الإنسان تأثيرًا ____.", "bank": ["يؤثّر", "إيجابيًّا", "سلبيًّا", "ينفّر"]},
   {"blanks": [["يؤثّر"], ["إيجابيًّا", "إيجابيا"]]}, Q2_EXPL, 0.75, "ar.comprehension.link")
Q3_EXPL = ("نظرة الكاتب للفنّ: يرى بأنّ الفنّ نوعان: فنّ رفيع وفنّ رخيص (0.75). فنّ رفيع يحرّك في الإنسان مشاعره العليا، وفنّ رخيص لا يحرّك "
           "في الإنسان إلّا المبتذل من مشاعره والتّافه من تفكيره (0.75). ثمّ إبداء الرّأي (1).")
st("s07", "q3", "q3-e1", "mcq", "كيف ينظر الكاتب إلى الفنّ؟",
   {"options": ["يرى أنّ الفنّ نوعان: فنّ رفيع وفنّ رخيص", "يرى أنّ الفنّ كلّه رفيع مهما كان أثره", "يرى أنّ الفنّ وسيلة للوعظ والإرشاد",
                "يرى أنّ قيمة الفنّ في شكله وحده دون مضمونه"]},
   {"correct": 0}, Q3_EXPL, 0.75, "ar.comprehension.explain")
st("s08", "q3", "q3-e2", "matching", "اشرح هذه النّظرة: طابق كلّ نوع من الفنّ بأثره في الإنسان.",
   {"lefts": ["الفنّ الرّفيع", "الفنّ الرّخيص"],
    "rights": ["يحرّك في الإنسان مشاعره العليا", "لا يحرّك في الإنسان إلّا المبتذل من مشاعره والتّافه من تفكيره", "يقتصر على الوعظ والإرشاد"]},
   {"pairs": [0, 1]}, Q3_EXPL, 0.75, "ar.comprehension.explain")
essay("s09", "q3", "q3-e3", "نظرة توفيق الحكيم إلى الفنّ (فنّ رفيع وفنّ رخيص)", "إبداء الرّأي", "يبدي المترشّح رأيه في نظرة الكاتب للفنّ", 1,
      {"task": "إبداء الرّأي", "question": PARAS[29], "scheme": "«– إبداء الرّأي.» (1) دون نموذج"},
      "إبداء الرّأي (1): لا يقدّم التّصحيح نموذجًا؛ يُقدَّر رأي المترشّح.", "ar.comprehension.opinion")
Q4_EXPL = ("يقصد الكاتب في العبارة: «لو علم رجل الفنّ خطر مهمّته لفكّر دهرًا قبل أن يخطّ سطرًا» أنّ رجل الفنّ ذو رسالة سامية نبيلة (1) "
           "تتطلّب منه جهدًا وتفكيرًا واستقامة (1).")
st("s10", "q4", "q4-e1", "mcq", "ماذا يقصد الكاتب بقوله: «لو علم رجل الفنّ خطر مهمّته لفكّر دهرًا قبل أن يخطّ سطرًا»؟ إنّ رجل الفنّ…",
   {"options": ["ذو رسالة سامية نبيلة", "صاحب مهنة يسيرة لا خطر فيها", "تاجر يبحث عن الرّبح والشّهرة", "واعظ مهمّته الإرشاد المباشر"]},
   {"correct": 0}, Q4_EXPL, 1, "ar.comprehension.explain")
st("s11", "q4", "q4-e2", "multi", "وما الّذي تتطلّبه منه هذه الرّسالة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الجهد", "التّفكير", "الاستقامة", "السّرعة في الكتابة", "طلب الشّهرة", "مجاراة أذواق العامّة"]},
   {"correct": [0, 1, 2]}, Q4_EXPL, 1, "ar.comprehension.explain")
Q5_EXPL = "تبدو شخصيّة توفيق الحكيم الأدبيّة من خلال النّصّ: أديبًا مقدّرًا وظيفة الفنّ، مقدّسًا لها… (2×0.75)."
st("s12", "q5", "q5-e1", "multi", "كيف تبدو شخصيّة توفيق الحكيم الأدبيّة من خلال النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["أديب مقدّر وظيفة الفنّ", "أديب مقدّس للفنّ", "أديب مستخفّ بالفنّ ورسالته", "أديب يرى الفنّ وسيلة للتّسلية لا غير",
                "أديب لا يبالي بالأسلوب ولا بالشّكل"]},
   {"correct": [0, 1]}, Q5_EXPL + " أمّا الاستخفاف بالفنّ أو حصره في التّسلية أو إهمال الأسلوب فيناقض ما في النّصّ.", 0.75, "ar.comprehension.explain")
st("s13", "q5", "q5-e1", "fill_blank", "أكمل:",
   {"text": "يبدو توفيق الحكيم أديبًا ____ وظيفة الفنّ، ____ لها.", "bank": ["مقدّرًا", "مقدّسًا", "مستخفًّا", "محتقرًا"]},
   {"blanks": [["مقدّرًا", "مقدرا"], ["مقدّسًا", "مقدسا"]]}, Q5_EXPL, 0.75, "ar.comprehension.explain", "b")
TYPE_EXPL = ("النّمط الغالب في النّصّ هو الحجاجيّ (0.5). ومن خصائصه في هذا النّصّ كثرة أساليب الشّرط وأساليب التّوكيد والمقارنة والتّعليل (4×0.25). "
             "(الأمثلة من النّصّ في الأسئلة من إعداد التّحويل.)")
st("s14", "q6", "q6-e1", "mcq", "ما النّمط الغالب في النّصّ؟",
   {"options": ["الحجاجيّ", "السّرديّ", "الوصفيّ", "الحواريّ"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s15", "q6", "q6-e2", "mcq", "«فإذا طالعت أثرًا فنّيًّا… فأنت أمام فنّ رفيع»، «لو علم رجل الفنّ… لفكّر دهرًا»: من خصائص النّمط الحجاجيّ في النّصّ كثرة أساليب…",
   {"options": ["الشّرط", "النّداء", "التّمنّي", "الأمر"]}, {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
st("s16", "q6", "q6-e3", "fill_blank", "أكمل خاصّيّة أخرى من خصائص هذا النّمط:",
   {"text": "أساليب ____، مثل: «إنّ نوع التّأثير هو الّذي يحدّد نوع الفنّ».", "bank": ["التّوكيد", "النّداء", "التّمنّي"]},
   {"blanks": [["التّوكيد"]]}, TYPE_EXPL, 0.25, "ar.text.type")
st("s17", "q6", "q6-e4", "mcq", "«فنّ رفيع… فنّ رخيص»، «شأن الفنّ هنا أيضًا شأن الدّين»: أيّ خاصّيّة من خصائص النّمط الحجاجيّ تمثّلها هاتان العبارتان؟",
   {"options": ["المقارنة", "السّرد القصصيّ", "الحوار بين الشّخصيّات", "الوصف الحسّيّ"]}, {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
st("s18", "q6", "q6-e5", "fill_blank", "أكمل خاصّيّة أخرى من خصائص هذا النّمط:",
   {"text": "____، مثل: «لأنّ وظيفة الفنّ هي أن يخلق شيئًا حيًّا…»، «لأنّ ضعف الشّكل وسقم الأسلوب يحدثان في النّفس…».", "bank": ["التّعليل", "الوصف", "السّرد"]},
   {"blanks": [["التّعليل"]]}, TYPE_EXPL, 0.25, "ar.text.type")
# ── ثانيًا: البناء اللّغويّ ──
REP_EXPL = "أدّى تكرار لفظة «الفنّ» إلى تلاحم معاني النّصّ فيما بينها باعتبارها محور النّصّ."
st("s19", "q7", "q7-e1", "mcq", "تكرّرت لفظة «الفنّ» في كلّ فقرات النّصّ. ما دورها في بنائه؟",
   {"options": ["أدّى تكرارها إلى تلاحم معاني النّصّ فيما بينها باعتبارها محور النّصّ", "أحدث تكرارها جرسًا موسيقيًّا فحسب",
                "أدّى تكرارها إلى تشتّت معاني النّصّ", "دلّ تكرارها على ضعف لغة الكاتب"]},
   {"correct": 0}, REP_EXPL, 0.75, "ar.cohesion.effect")
st("s20", "q7", "q7-e1", "fill_blank", "أكمل:",
   {"text": "أدّى تكرار لفظة «الفنّ» إلى ____ معاني النّصّ فيما بينها باعتبارها ____ النّصّ.", "bank": ["تلاحم", "محور", "تفكّك", "هامش"]},
   {"blanks": [["تلاحم"], ["محور"]]}, REP_EXPL, 0.75, "ar.cohesion.effect", "b")
LAW_EXPL = "مدلول الحرف «لو» في النّصّ: امتناع الجواب لامتناع الشّرط."
st("s21", "q8", "q8-e1", "mcq", "ما مدلول الحرف «لو» في قوله: «لو علم رجل الفنّ خطر مهمّته لفكّر دهرًا…»؟",
   {"options": ["امتناع الجواب لامتناع الشّرط", "وجود الجواب لوجود الشّرط", "امتناع الجواب لوجود الشّرط", "الشّرط الجازم"]},
   {"correct": 0}, LAW_EXPL, 0.5, "ar.grammar.conditional")
st("s22", "q8", "q8-e1", "fill_blank", "أكمل مدلول «لو»:",
   {"text": "امتناع ____ لامتناع ____.", "bank": ["الجواب", "الشّرط", "الفاعل"]},
   {"blanks": [["الجواب"], ["الشّرط"]]}, LAW_EXPL, 0.5, "ar.grammar.conditional", "b")
IDHA_EXPL = "إذا: ظرف لما يستقبل من الزّمان يتضمّن معنى الشّرط، مبنيّ على السّكون في محلّ نصب على الظّرفيّة، وهو مضاف (3×0.25)."
st("s23", "q9", "q9-e1", "mcq", "ما إعراب «إذا» (ما تحته خطّ) في قوله: «فإذا طالعتَ أثرًا فنّيًّا…»؟",
   {"options": ["ظرف لما يستقبل من الزّمان يتضمّن معنى الشّرط، مبنيّ على السّكون في محلّ نصب على الظّرفيّة، وهو مضاف",
                "ظرف لما مضى من الزّمان، مبنيّ على السّكون في محلّ نصب على الظّرفيّة، وهو مضاف",
                "حرف مفاجأة مبنيّ على السّكون لا محلّ له من الإعراب", "اسم شرط جازم مبنيّ على السّكون في محلّ نصب على الظّرفيّة"]},
   {"correct": 0}, IDHA_EXPL, 0.5, "ar.grammar.irab")
st("s24", "q9", "q9-e1", "fill_blank", "أكمل إعراب «إذا»:",
   {"text": "ظرف لما يستقبل من الزّمان، مبنيّ على ____ في محلّ ____ على الظّرفيّة، وهو مضاف.", "bank": ["السّكون", "نصب", "الفتح", "جرّ"]},
   {"blanks": [["السّكون"], ["نصب"]]}, IDHA_EXPL, 0.25, "ar.grammar.irab", "b")
st("s25", "q9", "q9-e2", "mcq", "ما إعراب «الشّعور» (ما تحته خطّ) في قوله: «يُحدث فينا ذلك الشّعورَ الكامل بالارتفاع»؟",
   {"options": ["بدل من اسم الإشارة منصوب وعلامة نصبه الفتحة", "مفعول به منصوب وعلامة نصبه الفتحة", "فاعل مرفوع وعلامة رفعه الضّمّة",
                "مفعول مطلق منصوب وعلامة نصبه الفتحة"]},
   {"correct": 0}, "الشّعور: بدل من اسم الإشارة منصوب وعلامة نصبه الفتحة (اسم الإشارة «ذلك» هو المفعول به).", 0.75, "ar.grammar.badal")
SH_EXPL = "(شأن الفنّ هنا أيضًا شأن الدّين): جملة اسميّة (0.25) لا محلّ لها من الإعراب لأنّها جملة ابتدائيّة (0.5)."
st("s26", "q9", "q9-e3", "mcq", "ما نوع الجملة الواقعة بين قوسين: (شأن الفنّ هنا أيضًا شأن الدّين)؟",
   {"options": ["جملة اسميّة", "جملة فعليّة", "شبه جملة"]}, {"correct": 0}, SH_EXPL, 0.25, "ar.grammar.sentence_case")
st("s27", "q9", "q9-e4", "mcq", "ما محلّ جملة (شأن الفنّ هنا أيضًا شأن الدّين) من الإعراب؟",
   {"options": ["لا محلّ لها من الإعراب لأنّها جملة ابتدائيّة", "في محلّ رفع خبر", "في محلّ نصب حال", "لا محلّ لها من الإعراب لأنّها صلة الموصول"]},
   {"correct": 0}, SH_EXPL, 0.5, "ar.grammar.sentence_case")
YH_EXPL = "(يهبط): جملة فعليّة (0.25) في محلّ رفع خبر «لكنّ»، لأنّها تؤوّل بمفرد (0.5)."
st("s28", "q9", "q9-e5", "mcq", "ما نوع الجملة الواقعة بين قوسين في قوله: «ولكن الوحي (يهبط) عليه»؟",
   {"options": ["جملة فعليّة", "جملة اسميّة", "شبه جملة"]}, {"correct": 0}, YH_EXPL, 0.25, "ar.grammar.sentence_case")
st("s29", "q9", "q9-e6", "mcq", "ما محلّ جملة (يهبط) من الإعراب في قوله: «ولكن الوحي (يهبط) عليه»؟",
   {"options": ["في محلّ رفع خبر «لكنّ» لأنّها تؤوّل بمفرد", "في محلّ نصب حال", "لا محلّ لها من الإعراب لأنّها جملة ابتدائيّة", "في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, YH_EXPL, 0.5, "ar.grammar.sentence_case")
IMG_EXPL = ("في العبارة «فأنت أمام فنّ رخيص»: استعارة مكنيّة (01)؛ حيث شبّه الفنّ بسلعة ثمّ حذف المشبّه به ورمز له بكلمة «رخيص» (01). "
            "أثرها: توضيح المعنى عن طريق التّجسيد (0.5).")
st("s30", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في العبارة: «فأنت أمام فنّ رخيص»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل"]}, {"correct": 0}, IMG_EXPL, 1, "ar.rhetoric.metaphor")
st("s31", "q10", "q10-e2", "fill_blank", "اشرح الصّورة:",
   {"text": "شبّه ____ بسلعة، ثمّ حذف المشبّه به ورمز له بكلمة «____».", "bank": ["الفنّ", "رخيص", "الدّين", "أمام"]},
   {"blanks": [["الفنّ"], ["رخيص"]]}, IMG_EXPL, 1, "ar.rhetoric.metaphor")
st("s32", "q10", "q10-e3", "mcq", "ما الأثر البلاغيّ لهذه الصّورة؟",
   {"options": ["توضيح المعنى عن طريق التّجسيد", "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين المعنيين"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")

TITLE = "بكالوريا 2010 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (توفيق الحكيم: فنّ الأدب)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2010، شعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2، صورة ممسوحة)، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. وُصلت أسطر كلّ فقرة (docx يحفظ النّصّ سطرًا سطرًا)، وصُوّب من الموضوع الرّسميّ: «حي نابضا» ← «حيًّا نابضا»، "
         "«إلا ّإذا» ← «إلاّ إذا». العلامات من الإجابة وسلّم التّنقيط الرّسميّين (ص1، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8 "
         "(لا تقويم نقديّ في هذا الموضوع). س1: «2×0.75» للموضوع و«1.5» للهدف (ليبلغ مجموع البناء الفكريّ 12). مؤجَّل (essay_builder): إبداء الرّأي في س3 (1).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
            "الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات والأمثلة النّصّيّة في أسئلة س6 من إعداد التّحويل وتحتاج مراجعة.")

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
