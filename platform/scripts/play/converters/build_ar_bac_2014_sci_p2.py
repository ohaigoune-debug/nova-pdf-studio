"""Conversion: BAC 2014 (session عاديّة، جوان 2014) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (أحمد أمين، في الطّموح والمثل الأعلى).
Exam (most faithful source): gdrive 1lGAfpKFy4ZVdzXngnmyrtpHc-7B-8tbM (بكالوريا العربية 2014 شعبة علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1xAT5vToLoQje95pekwqBdQAK_hYihFb4 (BAC 2014 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 14aB7wrDomnsoNMnnxTYlIhJSR4Ph-u59 (01_الموضوع.pdf, pages 3–4, image-only — rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1uU60n10RL2QFPGJoBt4kqpGQtQZtXGCF (02_التصحيح.pdf, page 2).

Method (as build_ar_bac_2014_sci_p1.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly — inner direction marks of the docx kept; only outer whitespace and outer direction marks trimmed) and every verbatim
string of the JSON was re-checked programmatically against the docx. The docx was compared paragraph by paragraph with the
official ONEC paper (rendered at 130 dpi). The mark scheme was read from the rendered page (150 dpi, fully legible). Every
mark comes from the official scheme; correct options and explanations condense its wording.

Docx vs ONEC:
- the last paragraph of the text is split in the docx after «ولو من طريق» (a line wrap; one paragraph on the ONEC paper)
  ⇒ the two docx paragraphs are joined with one space; Q4 of part 2 is likewise wrapped after «وأثرها» ⇒ joined with a space;
- docx defect fixed from the ONEC paper: part 2 Q1 opens its second item with a straight apostrophe «و'المثل"» ⇒ «و"المثل"»
  (PATCHES below);
- other differences are labels or spelling («أوّلا-/ثانيا-» vs «أ-/ب-», «(12 نقاط)» vs «(12 نقطة)», «إن هذا» vs «إنّ هذا»)
  — docx kept.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE.
  Two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; distinct demands ⇒ one
  element per demand.
- Q1 «3×0.5» = the issue (0.5) + two supporting expressions (2×0.5, one element of 1, as in build_ar_bac_2017_lit_s2_p1.py).
- Q2 «2×01» = the components of success / the causes of failure. Q3 «01.5», Q4 «01.5»: one element each.
- Q5 «01 + 3×0.5» = the genre (المقال الاجتماعيّ) + its main features (three listed, open list «…») ⇒ 1 + one element of 1.5.
- Q6 (تلخيص) «3×01» = احترام تقنية التّلخيص / سلامة الفهم / جمال أسلوب التّلميذ وسلامة لغته ⇒ three deferred elements.
- Part 2: Q1 «2×0.5», Q2 «2×0.5»: one element per word / sentence. Q3 «2×0.5» = the style (خبريّ) / why.
  Q4 «01 + 0.5 + 0.5» = explanation / type (تشبيه بليغ) / effect. Q5 «3×01» = the type (تفسيريّ حجاجيّ) + two
  indicators (open list «…») ⇒ 1 + one element of 2.
- Distractors avoid what usage could accept: no «مبتدأ مؤخّر» for «سوء» (both terms definite), no «نعت»/«عطف بيان» for
  «المثل» (after اسم الإشارة), no «في محلّ جرّ نعت» for «رسم لنفسه غرضا» (مَن نكرة موصوفة), no text passage that could
  also illustrate the issue or the failure causes (the «بذرة» and «ميل واحد» passages are not used as distractors).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2014-sci-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1lGAfpKFy4ZVdzXngnmyrtpHc-7B-8tbM"
DOCX_TITLE = "بكالوريا العربية 2014 شعبة علوم تجريبية.docx"
PDF_ID = "1xAT5vToLoQje95pekwqBdQAK_hYihFb4"
OFFICIAL_ID = "14aB7wrDomnsoNMnnxTYlIhJSR4Ph-u59"
CORR_ID = "1uU60n10RL2QFPGJoBt4kqpGQtQZtXGCF"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    26: "إنَّ كثيرا من الشبان يعتقدون أن هناك مَنْ مُنحوا قدرة على التفوق من غير جهد، وعلى‎ الإتيان بالعجائب من غير مشقة، وعلى قلب التراب ذهبا بعصا سحرية؛ ولكن كلّ هذه أفكار‎ عائقة عن العمل وعن النجاح... وخير وسيلة للنجاح في الحياة أن يكون للشباب مَثَلٌ أعلى عظيم‎ يطمح إليه وينشده، ويضعه دائما نصب عينيه، ويسعى دائمًا في الوصول إليه: أن يكون عالمًا عظيمًا أو تاجرًا عظيمًا أو صانعًا عظيمًا أو سياسيًا عظيما، فمن قنع بالدُّون لم يصل إلاَّ إلى الدُّون. ونحن‎ نشاهد في حياتنا العادية أنَّ مَنْ عزم أن يسير ميلا واحدا أحس التعب عند الفراغ منه، ولكن مَن عزم‎ أن يسير خمسة أميال قطع ميلاً وميلين وثلاثة من غير تعب لأنّ غرضه أوسع وهمَّته المدَّخرة‎ أكبر.",
    27: "إنَّا نشاهد أن كل مَن (رسم لنفسه غرضا) يسعى إليه وأخلص له واستوحاه واجتهد في الوصول إليه نجح في حياته، ولو لم يدرك الغاية كلها أدرك جانبا عظيما منها.",
    28: "أكبر أسباب فشلنا أنَّنا نخلق لأنفسنا أعذارا وأوهاما وعوائق حتّى تكون لنا سدَّا كبيرا كسد الصين؛ حجارته أحيانا سوء الظن، وأحيانا تخذيل النفس؛ وأحيانا الشك في النتيجة، وأحيانا الخوف من الفشل وأحيانا الكسل، إلى غير ذلك من أسباب، ولا تزال هذه الأحجار (تتراكم) حتّى يحجب السور الشمس عن أعيننا فلا نرى خيرا ولا نرى غاية.",
    29: "ليس الإنسان إلا بذرة أو نبتة تسعى دائما للخروج إلى الشمس والهواء الطلق، وثمرتها إنّما تثمر بحظها من هذين، وبذرة الإنسان يُقضى عليها بهذه العوائق التي ذكرنا فلا تُثمر.",
    30: "إنّ هذا المثل الأعلى الذي يجب أن ينشده الشباب يجب ألاَّ يكون المال وحده ولو من طريق",
    31: "التحايل والمكر واستغلال الآخرين لمصلحته وابتزاز الضعفاء لشخصه، فتلك وسيلة من الوسائل الحقيرة، والنجاح المؤسّس على هذا نجاح حقير رخيص، إِنما النجاح الحق أن يجمع- إلى نجاحه في عمله- نبله في خلقه وصدقه وأمانته في نفسه وعطفه وتسامحه وبرّه بالضعفاء وذوي الحاجة، فلم يُخلق الناس حوله ليكونوا مادّة لاستغلاله إنما خلقوا ليتبادل معهم المنافع والخير العام.",
    32: "- أحمد أمين –",
    36: "أوّلا- البناء الفكري: (12 نقاط)",
    37: "ما القضية التي شغلت الكاتب في هذا النص؟ استشهد بعبارتين منه.",
    38: "للنجاح مقوّمات كما أن للفشل أسبابا، وضّح ذلك من خلال النص.",
    39: "قال أبو القاسم الشابي:",
    40: "ومن يَتَهَيَّب صُعود الجبال        يَعِش أَبَدَ الدَّهر بين الحُفَرْ",
    41: "هات من النص العبارة الدالة على معنى هذا البيت.",
    42: "استخرج من النص مثالا عزّز به الكاتب وجهة نظره في أسباب الفشل.",
    43: "إلى أي فنّ من فنون النثر ينتمي هذا النص؟ اذكر أهم ميزاته.",
    44: "لخّص مضمون النص.",
    45: "ثانيا- البناء اللّغوي: (08 نقاط)",
    46: "أعرب ما يلي إعراب مفردات: \"سوء\" في قول الكاتب \"حجارته أحيانا سوء الظن\"",
    47: "و'المثل\" في قوله: \"إن هذا المثل الأعلى ...\".",
    48: "أعرب ما يلي إعراب جمل: \"رسم لنفسه غرضا\" في الفقرة الثانية.",
    49: "\"تتراكم\" في الفقرة الثالثة.",
    50: "ما نوع الأسلوب السائد في النص (خبري أم إنشائي)؟ ولماذا؟",
    51: "في العبارة الآتية صورة بيانية: \"ليس الإنسان إلاّ بذرة ...\" اشرحها مبينا نوعها وأثرها",
    52: "في المعنى.",
    53: "ما النمط الغالب على النص؟ اذكر مؤشرين له.",
}
# عيب docx مصحَّح من الموضوع الرّسميّ: علامة تنصيص مفردة في «و'المثل"»
PATCHES = [(47, "و'المثل\"", 'و"المثل"')]
for _k, _old, _new in PATCHES:
    assert PARAS[_k].count(_old) == 1, (_k, _old)
    PARAS[_k] = PARAS[_k].replace(_old, _new)

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2 = PARAS[36], PARAS[45]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا")
TEXT = "\n".join([PARAS[26], PARAS[27], PARAS[28], PARAS[29], PARAS[30] + " " + PARAS[31]])  # ف5 ملفوفة في docx
assert "(رسم لنفسه غرضا)" in PARAS[27] and "(تتراكم)" in PARAS[28] and PARAS[30].endswith("ولو من طريق")
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": TEXT},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[32]},
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


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": "essay_builder",
              "prompt": f"{title} — معيار {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": ind}},
              "answer": {"type": "essay_builder", "spec": {"rubric": ind}}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})



q("q1", "1", P1, J(37), 1.5, [el("q1-e1", "القضيّة الّتي شغلت الكاتب", 0.5), el("q1-e2", "عبارتان يُستشهد بهما (2×0.5)", 1)])
q("q2", "2", P1, J(38), 2, [el("q2-e1", "مقوّمات النّجاح", 1), el("q2-e2", "أسباب الفشل", 1)])
q("q3", "3", P1, J(39, 40, 41), 1.5, [el("q3-e1", "العبارة الدّالّة على معنى بيت الشّابّي", 1.5)])
q("q4", "4", P1, J(42), 1.5, [el("q4-e1", "المثال الّذي عزّز به الكاتب وجهة نظره في أسباب الفشل", 1.5)])
q("q5", "5", P1, J(43), 2.5, [el("q5-e1", "الفنّ النّثريّ", 1), el("q5-e2", "أهمّ ميزاته (3×0.5)", 1.5)])
q("q6", "6", P1, J(44), 3, [el("q6-e1", "التّلخيص: احترام تقنية التّلخيص", 1), el("q6-e2", "التّلخيص: سلامة الفهم", 1),
                            el("q6-e3", "التّلخيص: جمال الأسلوب وسلامة اللّغة", 1)])
q("q7", "1", P2, J(46, 47), 1, [el("q7-e1", "إعراب «سوء»", 0.5), el("q7-e2", "إعراب «المثل»", 0.5)])
q("q8", "2", P2, J(48, 49), 1, [el("q8-e1", "محلّ جملة «رسم لنفسه غرضا»", 0.5), el("q8-e2", "محلّ جملة «تتراكم»", 0.5)])
q("q9", "3", P2, J(50), 1, [el("q9-e1", "نوع الأسلوب السّائد", 0.5), el("q9-e2", "تعليل ذلك", 0.5)])
q("q10", "4", P2, PARAS[51] + " " + PARAS[52], 2, [el("q10-e1", "شرح الصّورة", 1), el("q10-e2", "نوعها", 0.5), el("q10-e3", "أثرها في المعنى", 0.5)])
q("q11", "5", P2, J(53), 3, [el("q11-e1", "النّمط الغالب", 1), el("q11-e2", "مؤشّران له (2×1)", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("القضيّة الّتي شغلت بال الكاتب في هذا النّصّ هي طموح الشّباب إلى المثل العليا، الّتي تكفل له النّجاح في ميادين الحياة، وممّا يدلّ من النّصّ قوله: "
           "(أن يكون للشّباب مثل أعلى يطمح إليه)، (إنّما النّجاح الحقّ… نبله في خلقه وصدقه وأمانته…).")
st("s01", "q1", "q1-e1", "mcq", "ما القضيّة الّتي شغلت الكاتب في هذا النّصّ؟",
   {"options": ["طموح الشّباب إلى المثل العليا الّتي تكفل له النّجاح في ميادين الحياة", "جمع المال بأيّ وسيلة لتحقيق النّجاح",
                "الاعتماد على الحظّ والقدرات الخارقة لبلوغ التّفوّق", "هجرة الشّباب بحثًا عن العمل"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل العبارتين اللّتين يُستشهد بهما على هذه القضيّة:",
   {"text": "«أن يكون للشّباب ____ أعلى يطمح إليه» – «إنّما النّجاح الحقّ… ____ في خلقه وصدقه وأمانته…»", "bank": ["مثل", "نبله", "مال", "ذكاؤه"]},
   {"blanks": [["مثل", "مَثَلٌ"], ["نبله"]]}, Q1_EXPL, 1, "ar.comprehension.evidence")
Q2_EXPL = ("مقوّمات النّجاح: تحديد الغرض ورسمه، الإخلاص له، الاجتهاد في الوصول إليه. أسباب الفشل: افتعال الأعذار والأوهام والعوائق، "
           "تخذيل النّفس وسوء الظّنّ بها، الشّكّ في النّتيجة والخوف من الفشل.")
st("s03", "q2", "q2-e1", "multi", "أيّ ممّا يلي من مقوّمات النّجاح كما وضّحها النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["تحديد الغرض ورسمه", "الإخلاص له", "الاجتهاد في الوصول إليه", "افتعال الأعذار والأوهام والعوائق", "الشّكّ في النّتيجة", "تخذيل النّفس"]},
   {"correct": [0, 1, 2]}, Q2_EXPL, 1, "ar.comprehension.details")
st("s04", "q2", "q2-e2", "fill_blank", "أكمل أسباب الفشل كما وردت في النّصّ:",
   {"text": "افتعال الأعذار و____ والعوائق، تخذيل النّفس و____ الظّنّ بها، الشّكّ في النّتيجة و____ من الفشل.",
    "bank": ["الأوهام", "سوء", "الخوف", "الآمال", "حسن", "الأمن"]},
   {"blanks": [["الأوهام"], ["سوء"], ["الخوف"]]}, Q2_EXPL, 1, "ar.comprehension.details")
Q3_EXPL = "العبارة الدّالّة على معنى بيت أبي القاسم الشّابّي هي: (فمن قنع بالدّون لم يصل إلّا إلى الدّون)."
st("s05", "q3", "q3-e1", "mcq", "ما العبارة من النّصّ الدّالّة على معنى بيت الشّابّي «ومن يتهيّب صعود الجبال يعش أبد الدّهر بين الحفر»؟",
   {"options": ["«فمن قنع بالدّون لم يصل إلّا إلى الدّون»", "«حجارته أحيانا سوء الظّنّ»", "«فتلك وسيلة من الوسائل الحقيرة»",
                "«فلم يُخلق النّاس حوله ليكونوا مادّة لاستغلاله»"]},
   {"correct": 0}, Q3_EXPL, 0.75, "ar.literature.intertext")
st("s06", "q3", "q3-e1", "fill_blank", "أكمل العبارة الدّالّة على معنى البيت:",
   {"text": "«فمن ____ بالدّون لم ____ إلّا إلى الدّون»", "bank": ["قنع", "يصل", "طمح", "يرجع"]},
   {"blanks": [["قنع"], ["يصل"]]}, Q3_EXPL, 0.75, "ar.literature.intertext", "b")
Q4_EXPL = ("المثال الّذي عزّز به الكاتب وجهة نظره: حينما شبّه أسباب الفشل الّتي يفتعلها الشّباب ووقوفها حاجزًا أمام نجاحه بـ«سدّ الصّين» العظيم في قوّته "
           "وصلابته، وهي دلالة على تهويل الأمر دون مسوّغ…")
st("s07", "q4", "q4-e1", "mcq", "ما المثال الّذي عزّز به الكاتب وجهة نظره في أسباب الفشل؟",
   {"options": ["تشبيه أسباب الفشل الّتي يفتعلها الشّباب بسدّ الصّين العظيم في قوّته وصلابته", "قصّة طالب أخفق في دراسته بسبب كسله",
                "أرقام وإحصاءات عن نسب الفشل بين الشّباب", "قول مأثور لأحد الحكماء في ذمّ الكسل"]},
   {"correct": 0}, Q4_EXPL, 0.75, "ar.comprehension.evidence")
st("s08", "q4", "q4-e1", "fill_blank", "أكمل شرح المثال:",
   {"text": "شبّه الكاتب أسباب الفشل ووقوفها حاجزًا أمام نجاح الشّباب بـ«سدّ ____» العظيم في قوّته وصلابته، وهي دلالة على ____ الأمر دون مسوّغ.",
    "bank": ["الصّين", "تهويل", "الحديد", "تهوين"]},
   {"blanks": [["الصّين"], ["تهويل"]]}, Q4_EXPL, 0.75, "ar.comprehension.explain", "b")
Q5_EXPL = "ينتمي النّصّ إلى فنّ المقال الاجتماعيّ، ومن أهمّ ميزاته: منهجيّة العرض (مقدّمة، عرض وخاتمة)، وحدة الموضوع، وسائل الإقناع…"
st("s09", "q5", "q5-e1", "mcq", "إلى أيّ فنّ من فنون النّثر ينتمي هذا النّصّ؟",
   {"options": ["المقال الاجتماعيّ", "القصّة القصيرة", "الخطابة", "المقامة"]},
   {"correct": 0}, Q5_EXPL, 1, "ar.literature.prose")
st("s10", "q5", "q5-e2", "multi", "أيّ ممّا يلي من أهمّ ميزات هذا الفنّ كما تظهر في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["منهجيّة العرض (مقدّمة، عرض وخاتمة)", "وحدة الموضوع", "وسائل الإقناع", "الحبكة والعقدة والحلّ", "الحوار بين الشّخصيّات", "السّجع والمحسّنات المتكلّفة"]},
   {"correct": [0, 1, 2]}, Q5_EXPL, 0.75, "ar.literature.features")
st("s11", "q5", "q5-e2", "fill_blank", "أكمل ميزات المقال كما تظهر في النّصّ:",
   {"text": "____ العرض (مقدّمة، عرض وخاتمة)، ____ الموضوع، وسائل ____.", "bank": ["منهجيّة", "وحدة", "الإقناع", "فوضى", "تشتّت", "الإبهام"]},
   {"blanks": [["منهجيّة"], ["وحدة"], ["الإقناع"]]}, Q5_EXPL, 0.75, "ar.literature.features", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "نصّ أحمد أمين (بكالوريا 2014، الشّعب العلميّة، الموضوع الثّاني)", "model_example": None}
SUM_EXPL = "تلخيص مضمون النّصّ: يراعى فيه احترام تقنية التّلخيص، سلامة الفهم، جمال أسلوب التّلميذ وسلامة لغته (3×1). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for i, (crit, ind) in enumerate([("التّقنية", "احترام تقنية التّلخيص"), ("الفهم", "سلامة الفهم"), ("الأسلوب واللّغة", "جمال أسلوب التّلميذ وسلامة لغته")]):
    essay(f"s{12 + i}", "q6", f"q6-e{i + 1}", "تلخيص مضمون نصّ أحمد أمين", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s15", "q7", "q7-e1", "mcq", "ما إعراب «سوء» في قول الكاتب: «حجارته أحيانا سوءُ الظّنّ»؟",
   {"options": ["خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة",
                "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة"]},
   {"correct": 0}, "سوء: خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة.", 0.5, "ar.grammar.irab")
st("s16", "q7", "q7-e2", "mcq", "ما إعراب «المثل» في قوله: «إنّ هذا المثلَ الأعلى…»؟",
   {"options": ["بدل من اسم الإشارة منصوب وعلامة نصبه الفتحة الظّاهرة", "خبر إنّ مرفوع وعلامة رفعه الضّمّة الظّاهرة",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة", "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة"]},
   {"correct": 0}, "المثل: بدل من اسم الإشارة منصوب وعلامة نصبه الفتحة الظّاهرة.", 0.5, "ar.grammar.badal")
st("s17", "q8", "q8-e1", "mcq", "ما المحلّ الإعرابيّ لجملة «رسم لنفسه غرضا» في قوله: «إنّا نشاهد أنّ كلّ مَن (رسم لنفسه غرضا) يسعى إليه…»؟",
   {"options": ["صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "(رسم لنفسه غرضا): صلة الموصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s18", "q8", "q8-e2", "fill_blank", "أكمل المحلّ الإعرابيّ لجملة «تتراكم» في قوله: «ولا تزال هذه الأحجار (تتراكم)»:",
   {"text": "(تتراكم): جملة فعليّة في محلّ ____ خبر «____».", "bank": ["نصب", "لا تزال", "رفع", "الأحجار"]},
   {"blanks": [["نصب"], ["لا تزال"]]}, "(تتراكم): جملة فعليّة في محلّ نصب خبر «لا تزال».", 0.5, "ar.grammar.sentence_case")
STYLE_EXPL = ("اعتمد الكاتب الأسلوب الخبريّ الأنسب للتّقرير والسّرد، وتعداد أوصاف النّاجحين والفاشلين من الشّباب في الحياة، والتّركيز على الأسلوب الخبريّ "
              "فقط دلالة على ثقة الكاتب واطمئنانه…")
st("s19", "q9", "q9-e1", "mcq", "ما نوع الأسلوب السّائد في النّصّ؟",
   {"options": ["الأسلوب الخبريّ", "الأسلوب الإنشائيّ الطّلبيّ", "الأسلوب الإنشائيّ غير الطّلبيّ"]},
   {"correct": 0}, STYLE_EXPL, 0.5, "ar.rhetoric.style")
st("s20", "q9", "q9-e2", "mcq", "لماذا اعتمد الكاتب هذا الأسلوب؟",
   {"options": ["لأنّه الأنسب للتّقرير والسّرد وتعداد أوصاف النّاجحين والفاشلين من الشّباب، وهو دلالة على ثقة الكاتب واطمئنانه",
                "لأنّ الكاتب يريد إثارة انفعال القارئ بالتّعجّب والاستفهام", "لأنّ الكاتب في مقام البوح بمشاعره الذّاتيّة",
                "لأنّ الكاتب يأمر الشّباب وينهاهم مباشرة"]},
   {"correct": 0}, STYLE_EXPL, 0.5, "ar.rhetoric.style")
IMG_EXPL = ("شبّه الكاتب في العبارة «الإنسان» بـ«البذرة» فذكر المشبّه والمشبّه به وحذف الأداة ووجه الشّبه، فالصّورة تشبيه بليغ. "
            "أثرها: توضيح المعنى وتقويته وهو إبراز طموح الإنسان وسعيه إلى الأفضل.")
st("s21", "q10", "q10-e1", "matching", "اشرح الصّورة في «ليس الإنسان إلّا بذرة…»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به", "الأداة ووجه الشّبه"], "rights": ["الإنسان", "البذرة", "محذوفان", "الشّمس"]},
   {"pairs": [0, 1, 2]}, IMG_EXPL, 1, "ar.rhetoric.simile")
st("s22", "q10", "q10-e2", "mcq", "ما نوع الصّورة البيانيّة في «ليس الإنسان إلّا بذرة…»؟",
   {"options": ["تشبيه بليغ", "استعارة تصريحيّة", "كناية عن صفة", "مجاز مرسل"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s23", "q10", "q10-e3", "mcq", "ما أثر هذه الصّورة في المعنى؟",
   {"options": ["توضيح المعنى وتقويته، وهو إبراز طموح الإنسان وسعيه إلى الأفضل", "تقديم الحقيقة مصحوبة بالدّليل عليها",
                "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين معنيين متقابلين"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
PAT_EXPL = "النّمط الغالب على النّصّ هو: نمط تفسيريّ حجاجيّ. مؤشّراه: التّفسير والشّرح والتّعليل بالشّواهد والأدلّة – استخدام لغة موضوعيّة وسهلة…"
st("s24", "q11", "q11-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["النّمط التّفسيريّ الحجاجيّ", "النّمط السّرديّ", "النّمط الوصفيّ", "النّمط الحواريّ"]},
   {"correct": 0}, PAT_EXPL, 1, "ar.text.type")
st("s25", "q11", "q11-e2", "multi", "أيّ ممّا يلي من مؤشّرات هذا النّمط في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّفسير والشّرح والتّعليل بالشّواهد والأدلّة", "استخدام لغة موضوعيّة وسهلة", "تتابع الأحداث وفق ترتيب زمنيّ",
                "كثرة الحوار بين الشّخصيّات", "الإكثار من الأساليب الانفعاليّة والمشاعر الذّاتيّة"]},
   {"correct": [0, 1]}, PAT_EXPL, 1, "ar.text.type")
st("s26", "q11", "q11-e2", "fill_blank", "أكمل مؤشّري النّمط:",
   {"text": "التّفسير والشّرح و____ بالشّواهد والأدلّة – استخدام لغة ____ وسهلة.", "bank": ["التّعليل", "موضوعيّة", "التّخييل", "ذاتيّة"]},
   {"blanks": [["التّعليل"], ["موضوعيّة"]]}, PAT_EXPL, 1, "ar.text.type", "b")

TITLE = "بكالوريا 2014 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (أحمد أمين: المثل الأعلى والنّجاح)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2014، الشّعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: "
         f"gdrive:{PDF_ID}. الفقرة الأخيرة من النّصّ مقسومة في docx بعد «ولو من طريق» (سطر ملفوف) فوُصلت بمسافة، وكذلك س4 من البناء اللّغويّ بعد «وأثرها». "
         "عيب في docx صُحّح من الموضوع الرّسميّ: «و'المثل\"» ⇐ «و\"المثل\"». العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص2، قُرئت مصوّرة). "
         "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. مؤجَّل (essay_builder): التّلخيص س6 (3×1).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ "
            "الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")

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
        "kind": "BAC", "year": 2014, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T14:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
