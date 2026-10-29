"""Conversion: BAC 2015 (session عاديّة، جوان 2015) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (مالك بن نبي، شروط النّهضة: الزّمن).
Exam (most faithful source): gdrive 1PNjmHWMx1Y55H9Q3E45KAsz2oizTfhun (بكالوريا العربية 2015 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's retyped copy): gdrive 12jakgHnlIe1pLwv0D7kgZgSgaQPkjSbs (BAC 2015 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1EgspKfRuGE8e_g4O3yYNfyCjeTPneqpi (01_الموضوع.pdf, pages 3–4 — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1-3T-LvPWNh7JBsmE2LZIBBdUugU82lbu (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2018_lit_p1.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed) and every verbatim string of the JSON was re-checked
programmatically against the docx. The docx was compared line by line with the official ONEC paper (rendered at 150 dpi).
The correction is a scanned PDF, read from the rendered pages (150 dpi, 300 dpi crops). Every mark comes from the official
scheme; correct options and explanations condense its wording.

Docx defects fixed from the ONEC paper (applied after generation, each asserted to occur once):
- the docx splits paragraphs 3 and 4 of the text in the middle of a sentence («… هذا» / «المعنى الّذي…», «… معرض "ألمانيا"» /
  «يفتح أبوابه…») ⇒ joined with a space (four paragraphs, as on the ONEC paper and as the questions count them); likewise the
  line-wrapped questions 2 and 5 of Part 2;
- word-level transcription errors: «يعبر العالم من الأزل» ⇒ «منذ الأزل»; paragraph 2 starts «حظُّ…» ⇒ «وحظُّ…»; «في العام
  الإسلامي» ⇒ «في العالم الإسلامي»; «يتحدث معنى التأثير» ⇒ «يتحدّد معنى التأثير»; Part 2 Q1 «للألفاظ الآية» ⇒ «الآتية»;
  Part 2 Q3 «أعربا إعراب مفردات» ⇒ «أعرب».
Other differences are diacritics / spelling / punctuation only (docx kept).

Conversion notes / points for the owner's review:
- Streams: آداب وفلسفة only (ONEC paper and correction headers) ⇒ LIT.
- Rule for «n×m» lines (as in the 2017–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×0.50» = issue / aim. Q2 «2×0.50» = fate / why. Q3 «01». Q4 «2×0.75» = the three elements (interactive) + «الرّأي:
  يبدي المترشّح رأيه» (deferred essay_builder, rule 11). Q5 «2×1» = what the comparison consists of / why it is a successful
  method (the scheme answers «وهو أسلوب ناجح لأنّه…» without accepting other opinions ⇒ interactive, the steps only ask for the
  scheme's justification — to be confirmed by the owner). Q6 «0.5 + 2×0.5»: type + two indicators among five («للمترشّح أن
  يذكر مؤشّرات أخرى») ⇒ one element of 1. Q7 (تلخيص الفقرتين الأخيرتين) «02» with three conditions (الدّلالة على المضمون،
  الحجم، سلامة اللّغة) and no split ⇒ one deferred element of 2 with one essay_builder step (2 cannot be split evenly).
- Part 2: Q1 «01»; Q2 «2×0.25»; Q3 «4×0.5»; Q4 «2×0.25»: one element per item. Q5 «2×1»: one element per image (steps 0.25 /
  0.5 / 0.25). «ترويها ساعات معيّنة»: the scheme compares the hours to «الماء» ⇒ no «النّهر» distractor in the explanation step.
- Part 3: Q1 «2×0.25» = definition / type; Q2 «3×0.25» = introduction / body / conclusion; Q3 «4×0.5» four characteristics
  among five ⇒ one element of 2; Q4 asks for four writers but the scheme gives «3×0.25» (five names listed) ⇒ one element of
  0.75 (sum of Part 3 = 4 as printed) — to be confirmed by the owner.
- Distractors avoid arguable alternatives: no «الحجاجيّ» for the type, no «حال» for (يسمّى الوقت) (نعت), no «اجتماعيّ» for the
  article type, no «مقال أدبيّ/فكريّ» variants.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2015-lit-p2"
PAPER = 2
STREAMS = ["LIT"]
DOCX_ID = "1PNjmHWMx1Y55H9Q3E45KAsz2oizTfhun"
DOCX_TITLE = "بكالوريا العربية 2015 شعبة اداب وفلسفة.docx"
PDF_ID = "12jakgHnlIe1pLwv0D7kgZgSgaQPkjSbs"
OFFICIAL_ID = "1EgspKfRuGE8e_g4O3yYNfyCjeTPneqpi"
CORR_ID = "1-3T-LvPWNh7JBsmE2LZIBBdUugU82lbu"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    30: 'الزمن نهرٌ قديمٌ يعبر العالم من الأزل، فهو يمر خلال المُدن، يغذّي نشاطها بطاقته الأبديّة، أو يُذلل نومها بأنشودة السّاعات التي تذهب هَبَاء، وهو يتدفَّق على السواء في أرضِ كل شعب، ومجالِ كل فرد، بفيضٍ من الساعات التي لا تَغيض، ولكنّه في مجالٍ ما (يصير ثروةً)، وفي مجالٍ آخر يتحول عدماً. ولكنه نهرٌ صامتٌ، حتى إننا ننساه أحيانا، وتنسى الحضارات، في ساعات الغفلة، أو نشوة الحظ، قيمتَه التي لا تعوّض.',
    31: 'حظُّ الشعب العربيّ والإسلامي من الساعات كحظ أي شعب متحضر، ولكنْ... عندما يدق الناقوس مُناديا الرجال، والنساء، والأطفال إلى مجالات العمل، في البلاد المتحضرة... أين يذهب الشعب الإسلامي؟ تلْكم هي المسألة المؤلمة... فنحن في العام الإسلامي نعرف شيئا (يُسمى الوقت). ولكنه الوقت الذي ينتهي إلى عدم، لأَننا لا ندرك معناه، ولا تجزئته الفنيّة. لأننا لا ندرك قيمة أجزائه من ساعةٍ، ودقيقة، وثانية، ولسنا نعرف إلى الآن فكرة الزّمن الذي يتصل اتصالاً وثيقا بالتاريخ، مع أن فلكيًّا عربيًّا مسلما هو أبو الحسن المرّاكشي، يُعتبر أوّل من أدرك هذه الفكرة الوثيقة الصّلة بنهضة العلم المادي في عصرنا.',
    32: 'وبتحديد فكرة الزّمن، يتحدث معنى التأثير والإنتاج، وهو معنى الحياة الحاضرة الذي ينقصُنا. هذا',
    33: 'المعنى الذي لم نكسبه بعد، هو مفهومُ الزّمن الدّاخل في تكوين الفكرة والنشاط، في تكوين المعاني والأشياء. فالحياة والتَاريخ الخاضعان للتوقيت كان وما يزال يفوتُنا قطارهما، فنحن في حاجةٍ ملحةٍ إلى توقيت دقيق، وخطوات واسعة لكي نُعوّض تَأَخّرَنا. وإنّما يكون ذلك بتحديد المنطقة التي ترويها ساعات معينة من السَّاعات الأربع والعشرين التي تمرُّ على أرضنا يوميًا. إن وقتنا الزَّاحف صوب التاريخ، لا يجب أن يَضيعَ هباء، كما يهرب الماء من ساقيةٍ خَرِبةٍ، ولا شكّ أن التربية هي الوسيلة الضروريَة التي تُعلم الشّعب العربي الإسلامي تماماً قيمة هذا الأمر.',
    34: 'ولابد لنا في الخاتمة أن نورد تجربةً قريبةً منا، هي ما حدث في "ألمانيا" عقب الحرب العالميّة الثانية التي خلفت وراءها "ألمانيا" عام 1945 قاعًا صفصفاً، وبعد عشر سنواتٍ نرى معرض "ألمانيا"',
    35: 'يفتح أبوابه بالقاهرة فتذهلنا المعجزة، إذ ينبعث شعب من الموت والدمار، ويُنشئ الصناعات الضخمة التي شهدناها. ويمكننا أن ندرك قيمة الوقت مباشرة في عودة الحياة الاجتماعيّة والاقتصادية لشعب لم يبق لديه من الوسائل إثر الحرب الثانية إلاّ العناصر الثلاثة: الإنسان، والتراب، والزّمن.',
    36: 'مالك بن نبي/ شروط النهضة (بتصرف)',
    37: 'الأسئلة:   أوّلا- البناء الفكري: (10 نقاط)',
    38: 'ما القضية التي عالجها الكاتب؟ وما الهدف منها؟',
    39: 'ما مصير الوقت عند الشعب العربيّ الإسلامي؟ ولماذا؟',
    40: 'ورد في النّص قول الكاتب: "هذا المعنى الذي لم نكسبه بعد".',
    41: 'ما المقصود بهذه العبارة؟ اشرحها بإيجاز.',
    42: 'حدد عناصر المعادلة التي يراها الكاتب كفيلة بنهوض الأمم. وما رأيك فيها؟',
    43: 'اعتمد الكاتب على أسلوب المقارنة في عرض أفكاره. فيم تمثل ذلك؟ وهل تراه أسلوبا ناجحا في التحليل والتفسير؟',
    44: 'ما النمط الغالب على النص؟ اذكر مؤشرين له، مع التمثيل من النّص.',
    45: 'لخّص الفقرتين الأخيرتين بأسلوبك.',
    46: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    47: 'ما الحقل الدلاليّ للألفاظ الآية: (الأزل، عصرنا، التاريخ، التوقيت)؟',
    48: 'حدد معاني حرف الجر "في" في قوله: [وهو يتدفق على السواء في أرضِ كل شعبٍ... وتنسى',
    49: 'الحضارات، في ساعات الغفلة ...]',
    50: 'أعربا إعراب مفردات: كلمة (مناديا) الواردة في الفقرة الثانية، وكلمة (يبق) الواردة في الفقرة الأخيرة.',
    51: 'وأعرب إعراب جُمل: [يصير ثروة] الواردة في الفقرة الأولى. و [يُسمى الوقت] الواردة في الفقرة الثانية.',
    52: 'ما نوع الجمع في اللفظتين: " وسائل" و" أحيانا "؟',
    53: 'اشرح الصورتين البيانيتين مبينا نوعيهما وسرَّ بلاغتهما فيما يلي: "ولكنّه نهرٌ" الواردة في الفقرة',
    54: 'الأولى، و" ترويها ساعات مُعيّنة" الواردة في الفقرة الثالثة.',
    55: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    56: 'من الفنون الأدبية التي شاعت في العصر الحديث واستوعبت قضايا الحياة الإنسانية فنّ المقال.',
    57: 'المطلوب:       1) عرّف فن المقال وحدّد نوعه في هذا النّص.',
    58: '2) حدد في هذا النّص بداية ونهاية المقدّمة والعرض والخاتمة.',
    59: '3) انطلاقا من النّص، استخرج أربعا من خصائص المقال.',
    60: '4) اذكر أربعة من كتَّاب المقال الجزائريين.',
}


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


# تصويبات من الموضوع الرّسميّ (عيوب في docx؛ انظر التّوثيق أعلاه)
assert PARAS[31].startswith("حظ")
TEXT_PARAS = [
    _fix(PARAS[30], "يعبر العالم من الأزل", "يعبر العالم منذ الأزل"),
    _fix("و" + PARAS[31], "في العام الإسلامي", "في العالم الإسلامي"),
    _fix(PARAS[32] + " " + PARAS[33], "يتحدث معنى", "يتحدّد معنى"),
    PARAS[34] + " " + PARAS[35],
]
_ask, P1 = re.split(r"\s{2,}", PARAS[37])
_req, Q13_LINE = re.split(r"\s{2,}", PARAS[57])
P2, P3 = PARAS[46], PARAS[55]
assert _ask == "الأسئلة:" and P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and _req == "المطلوب:"

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(TEXT_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[36]},
]
CRIT_DOCS = DOCS + [{"id": "d-crit", "kind": "text", "caption": "السّند", "text": PARAS[56]}]


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


q("q1", "1", P1, J(38), 1, [el("q1-e1", "القضيّة الّتي عالجها الكاتب", 0.5), el("q1-e2", "الهدف منها", 0.5)])
q("q2", "2", P1, J(39), 1, [el("q2-e1", "مصير الوقت عند الشّعب العربيّ الإسلاميّ", 0.5), el("q2-e2", "سبب ذلك", 0.5)])
q("q3", "3", P1, J(40, 41), 1, [el("q3-e1", "المقصود بعبارة «هذا المعنى الّذي لم نكسبه بعد»", 1)])
q("q4", "4", P1, J(42), 1.5, [el("q4-e1", "عناصر المعادلة الثّلاثة", 0.75), el("q4-e2", "الرّأي فيها", 0.75)])
q("q5", "5", P1, J(43), 2, [el("q5-e1", "فيمَ تمثّل أسلوب المقارنة", 1), el("q5-e2", "نجاح الأسلوب في التّحليل والتّفسير", 1)])
q("q6", "6", P1, J(44), 1.5, [el("q6-e1", "النّمط الغالب", 0.5), el("q6-e2", "مؤشّران مع التّمثيل (2×0.5)", 1)])
q("q7", "7", P1, J(45), 2, [el("q7-e1", "تلخيص الفقرتين الأخيرتين (المضمون، الحجم، سلامة اللّغة)", 2)])
q("q8", "1", P2, _fix(PARAS[47], "الآية", "الآتية"), 1, [el("q8-e1", "الحقل الدّلاليّ", 1)])
q("q9", "2", P2, PARAS[48] + " " + PARAS[49], 0.5, [el("q9-e1", "معنى «في» في «في أرضِ كلّ شعب»", 0.25), el("q9-e2", "معنى «في» في «في ساعات الغفلة»", 0.25)])
q("q10", "3", P2, _fix(PARAS[50], "أعربا", "أعرب") + "\n" + PARAS[51], 2,
  [el("q10-e1", "إعراب «مناديا»", 0.5), el("q10-e2", "إعراب «يبق»", 0.5), el("q10-e3", "محلّ جملة [يصير ثروة]", 0.5), el("q10-e4", "محلّ جملة [يُسمّى الوقت]", 0.5)])
q("q11", "4", P2, J(52), 0.5, [el("q11-e1", "نوع الجمع في «وسائل»", 0.25), el("q11-e2", "نوع الجمع في «أحيانا»", 0.25)])
q("q12", "5", P2, PARAS[53] + " " + PARAS[54], 2, [el("q12-e1", "«ولكنّه نهر»: النّوع والشّرح وسرّ البلاغة", 1),
                                                    el("q12-e2", "«ترويها ساعات معيّنة»: النّوع والشّرح وسرّ البلاغة", 1)])
q("q13", "1", P3, _req + "\n" + Q13_LINE, 0.5, [el("q13-e1", "تعريف فنّ المقال", 0.25), el("q13-e2", "نوع المقال في النّصّ", 0.25)], CRIT_DOCS)
q("q14", "2", P3, J(58), 0.75, [el("q14-e1", "المقدّمة", 0.25), el("q14-e2", "العرض", 0.25), el("q14-e3", "الخاتمة", 0.25)], CRIT_DOCS)
q("q15", "3", P3, J(59), 2, [el("q15-e1", "أربع من خصائص المقال من النّصّ (4×0.5)", 2)], CRIT_DOCS)
q("q16", "4", P3, J(60), 0.75, [el("q16-e1", "كتّاب المقال الجزائريّون (3×0.25)", 0.75)], CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("القضيّة الّتي عالجها الكاتب هي قضيّة الزّمن وأهمّيّته في حياة الأمم والشّعوب وحظّ الأمّة العربيّة والإسلاميّة منه. "
           "والهدف منها: توعية الأمّة بقيمة استثمار الزّمن وأخذ العبرة من تجارب النّاجحين في عصرنا.")
st("s01", "q1", "q1-e1", "mcq", "ما القضيّة الّتي عالجها مالك بن نبي في النّصّ؟",
   {"options": ["قضيّة الزّمن وأهمّيّته في حياة الأمم والشّعوب وحظّ الأمّة العربيّة والإسلاميّة منه", "قضيّة الحرب العالميّة الثّانية ونتائجها على ألمانيا",
                "قضيّة التّراث العلميّ عند علماء الفلك العرب", "قضيّة الهجرة من الأرياف إلى المدن"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل الهدف من هذه القضيّة:",
   {"text": "توعية الأمّة بقيمة ____ الزّمن وأخذ ____ من تجارب النّاجحين في عصرنا.", "bank": ["استثمار", "العبرة", "تضييع", "الثّأر"]},
   {"blanks": [["استثمار"], ["العبرة"]]}, Q1_EXPL, 0.5, "ar.comprehension.purpose")
Q2_EXPL = "الوقت في العالم العربيّ والإسلاميّ ينتهي إلى العدم لأنّنا لا نُدرك معناه ولا ندرك قيمة أجزائه من ساعة ودقيقة وثانية."
st("s03", "q2", "q2-e1", "mcq", "ما مصير الوقت عند الشّعب العربيّ الإسلاميّ؟",
   {"options": ["ينتهي إلى العدم", "يتحوّل إلى ثروة", "يُستثمر في الصّناعات الضّخمة", "يُقسَّم بدقّة إلى ساعات ودقائق وثوانٍ"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.details")
st("s04", "q2", "q2-e2", "multi", "ولماذا ينتهي الوقت عندنا إلى هذا المصير؟ (اختر كلّ ما يصحّ)",
   {"options": ["لأنّنا لا ندرك معناه", "لأنّنا لا ندرك قيمة أجزائه من ساعة ودقيقة وثانية", "لأنّ حظّنا من السّاعات أقلّ من حظّ الشّعوب المتحضّرة",
                "لأنّ الزّمن لا يمرّ على أرضنا"]},
   {"correct": [0, 1]}, Q2_EXPL + " أمّا حظّ الشّعب العربيّ والإسلاميّ من السّاعات فهو «كحظّ أيّ شعب متحضّر» كما في النّصّ.", 0.5, "ar.comprehension.explain")
Q3_EXPL = ("المقصود بعبارة «هذا المعنى الّذي لم نكسبه بعد» هو: عدم بلوغ الإنسان العربيّ والمسلم إلى تحديد مفهوم الزّمن المؤدّي إلى معنى هامّ هو التّأثير والإنتاج، "
           "ومع ذلك فالكاتب متفائل لبلوغ هذا المعنى في يوم ما.")
st("s05", "q3", "q3-e1", "mcq", "ما المقصود بعبارة «هذا المعنى الّذي لم نكسبه بعد»؟",
   {"options": ["عدم بلوغ الإنسان العربيّ والمسلم إلى تحديد مفهوم الزّمن المؤدّي إلى معنى هامّ هو التّأثير والإنتاج", "عجز العرب عن صناعة السّاعات",
                "عدم امتلاك العرب للثّروات المادّيّة", "جهل العرب بأعمال أبي الحسن المرّاكشيّ"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.explain")
st("s06", "q3", "q3-e1", "fill_blank", "أكمل شرح العبارة:",
   {"text": "المعنى الهامّ الّذي لم نكسبه بعد هو التّأثير و____، ومع ذلك فالكاتب ____ لبلوغ هذا المعنى في يوم ما.", "bank": ["الإنتاج", "متفائل", "الاستهلاك", "يائس"]},
   {"blanks": [["الإنتاج"], ["متفائل"]]}, Q3_EXPL, 0.5, "ar.comprehension.explain", "b")
Q4_EXPL = "العناصر الثّلاثة هي: الإنسان، التّراب، الزّمن. الرّأي: يبدي المترشّح رأيه."
st("s07", "q4", "q4-e1", "multi", "ما عناصر المعادلة الّتي يراها الكاتب كفيلة بنهوض الأمم؟ (اختر كلّ ما يصحّ)",
   {"options": ["الإنسان", "التّراب", "الزّمن", "المال", "السّلاح", "الصّناعات الضّخمة"]},
   {"correct": [0, 1, 2]}, Q4_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q4", "q4-e1", "fill_blank", "أكمل من النّصّ:",
   {"text": "لشعب لم يبق لديه من الوسائل إثر الحرب الثّانية إلاّ العناصر الثّلاثة: الإنسان، والتّراب، و____.", "bank": ["الزّمن", "المال", "السّلاح"]},
   {"blanks": [["الزّمن"]]}, Q4_EXPL, 0.25, "ar.comprehension.evidence", "b")
essay("s09", "q4", "q4-e2", "معادلة النّهوض عند مالك بن نبي (الإنسان، التّراب، الزّمن)", "إبداء الرّأي",
      "يبدي المترشّح رأيه في المعادلة مع التّعليل", 0.75,
      {"task": "إبداء الرّأي", "question": PARAS[42], "scheme": "«الرّأي: يبدي المترشّح رأيه» (2×0.75: العناصر + الرّأي)"},
      Q4_EXPL, "ar.comprehension.opinion")
Q5_EXPL = ("اعتمد الكاتب أسلوب المقارنة في عرض أفكاره حين قارن بين العالم العربيّ الإسلاميّ والبلاد المتحضّرة عمومًا وتجربة ألمانيا بعد الحرب العالميّة الثّانية خصوصًا. "
           "وهو أسلوب ناجح لأنّه يقوم على تقريب الفكرة من خلال التّمثيل من الواقع والتّحليل.")
st("s10", "q5", "q5-e1", "mcq", "فيمَ تمثّل اعتماد الكاتب على أسلوب المقارنة؟",
   {"options": ["في المقارنة بين العالم العربيّ الإسلاميّ والبلاد المتحضّرة عمومًا، وتجربة ألمانيا بعد الحرب العالميّة الثّانية خصوصًا",
                "في المقارنة بين الإنسان والحيوان", "في المقارنة بين الشّعر والنّثر", "في المقارنة بين المدن والأرياف"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.comprehension.link")
st("s11", "q5", "q5-e1", "fill_blank", "أكمل:",
   {"text": "قارن الكاتب بين العالم العربيّ الإسلاميّ و____ المتحضّرة عمومًا، وتجربة ____ بعد الحرب العالميّة الثّانية خصوصًا.", "bank": ["البلاد", "ألمانيا", "القرى", "فرنسا"]},
   {"blanks": [["البلاد"], ["ألمانيا"]]}, Q5_EXPL, 0.5, "ar.comprehension.link", "b")
st("s12", "q5", "q5-e2", "mcq", "لماذا يُعدّ أسلوب المقارنة أسلوبًا ناجحًا في التّحليل والتّفسير؟",
   {"options": ["لأنّه يقوم على تقريب الفكرة من خلال التّمثيل من الواقع والتّحليل", "لأنّه يعتمد على الخيال والعاطفة", "لأنّه يطيل الكلام ويكثر الاستطراد",
                "لأنّه يُغني عن التّعليل والاستدلال"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.rhetoric.style")
st("s13", "q5", "q5-e2", "fill_blank", "أكمل:",
   {"text": "وهو أسلوب ناجح لأنّه يقوم على ____ الفكرة من خلال التّمثيل من ____ والتّحليل.", "bank": ["تقريب", "الواقع", "تعقيد", "الخيال"]},
   {"blanks": [["تقريب"], ["الواقع"]]}, Q5_EXPL, 0.5, "ar.rhetoric.style", "b")
st("s14", "q6", "q6-e1", "mcq", "ما النّمط الغالب على نصّ مالك بن نبي؟",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]},
   {"correct": 0}, "نمط النّصّ الغالب هو النّمط التّفسيريّ.", 0.5, "ar.text.type")
Q6_EXPL = ("مؤشّراته: التّجرّد والموضوعيّة في العرض والبعد عن الذّاتيّة (مقال يخلو من العواطف والمشاعر)؛ استخدام الأمثلة والتّشابيه بهدف التّوضيح (البلاد المتحضّرة، "
           "ألمانيا، أبو الحسن المرّاكشيّ…)؛ التّعليل والتّفسير وبيان الغاية (الفقرة الثّالثة مثلًا، لأنّنا ندرك، مع أنّ، إنّما…)؛ كثرة التّعاريف والشّروح (الزّمن نهر… فهو يمرّ…)؛ "
           "كلمات ومصطلحات تقنيّة خاصّة بالموضوع المعرفيّ (الثّانية والدّقيقة والسّاعة والزّمن…). وللمترشّح أن يذكر مؤشّرات أخرى.")
st("s15", "q6", "q6-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط التّفسيريّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّجرّد والموضوعيّة في العرض والبعد عن الذّاتيّة", "استخدام الأمثلة والتّشابيه بهدف التّوضيح", "التّعليل والتّفسير وبيان الغاية",
                "كثرة التّعاريف والشّروح", "كلمات ومصطلحات تقنيّة خاصّة بالموضوع المعرفيّ", "كثرة الحوار بين الشّخصيّات", "التّعبير الانفعاليّ عن العواطف والمشاعر"]},
   {"correct": [0, 1, 2, 3, 4]}, Q6_EXPL, 0.5, "ar.text.type")
st("s16", "q6", "q6-e2", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط التّفسيريّ بمثاله من النّصّ.",
   {"lefts": ["استخدام الأمثلة والتّشابيه بهدف التّوضيح", "التّعليل والتّفسير وبيان الغاية", "كثرة التّعاريف والشّروح", "كلمات ومصطلحات تقنيّة خاصّة بالموضوع المعرفيّ"],
    "rights": ["(البلاد المتحضّرة، ألمانيا، أبو الحسن المرّاكشيّ)", "(لأنّنا ندرك، مع أنّ، إنّما)", "(الزّمن نهر… فهو يمرّ…)", "(الثّانية والدّقيقة والسّاعة والزّمن)",
               "(أوّاه، يا ليت)"]},
   {"pairs": [0, 1, 2, 3]}, Q6_EXPL, 0.5, "ar.text.type", "b")
essay("s17", "q7", "q7-e1", "تلخيص الفقرتين الأخيرتين من نصّ مالك بن نبي", "شروط التّلخيص (المضمون، الحجم، سلامة اللّغة)",
      "يراعى فيه شروط التّلخيص: الدّلالة على المضمون والحجم وسلامة اللّغة", 2,
      {"task": "تلخيص الفقرتين الأخيرتين", "text": "مالك بن نبي، شروط النّهضة (بكالوريا 2015، آداب وفلسفة، الموضوع الثّاني)",
       "scheme": "التّلخيص «02»: يراعى فيه شروط التّلخيص من الدّلالة على المضمون والحجم وسلامة اللّغة (دون تفصيل للعلامة)"},
      "التّلخيص: يراعى فيه شروط التّلخيص من الدّلالة على المضمون والحجم وسلامة اللّغة (نقطتان دون تفصيل).", "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s18", "q8", "q8-e1", "mcq", "ما الحقل الدّلاليّ للألفاظ: (الأزل، عصرنا، التّاريخ، التّوقيت)؟",
   {"options": ["الزّمن", "المكان", "الصّناعة", "الحرب"]},
   {"correct": 0}, "الحقل الدّلاليّ للألفاظ (الأزل، عصرنا، التّاريخ، التّوقيت) هو الزّمن.", 1, "ar.cohesion.effect")
FI_EXPL = "معاني حرف الجرّ «في»: في أرضِ (كلّ شعب): تفيد الظّرفيّة المكانيّة؛ في ساعات الغفلة: تفيد الظّرفيّة الزّمانيّة."
st("s19", "q9", "q9-e1", "mcq", "ما معنى حرف الجرّ «في» في قوله: «وهو يتدفّق على السّواء في أرضِ كلّ شعب»؟",
   {"options": ["الظّرفيّة المكانيّة", "الظّرفيّة الزّمانيّة", "السّببيّة", "المصاحبة"]},
   {"correct": 0}, FI_EXPL, 0.25, "ar.grammar.rules")
st("s20", "q9", "q9-e2", "mcq", "ما معنى حرف الجرّ «في» في قوله: «وتنسى الحضارات، في ساعات الغفلة»؟",
   {"options": ["الظّرفيّة الزّمانيّة", "الظّرفيّة المكانيّة", "السّببيّة", "الاستعلاء"]},
   {"correct": 0}, FI_EXPL, 0.25, "ar.grammar.rules")
st("s21", "q10", "q10-e1", "mcq", "ما إعراب «مناديا» في قوله: «عندما يدقّ النّاقوس مناديا الرّجال»؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة", "مفعول لأجله منصوب وعلامة نصبه الفتحة الظّاهرة",
                "تمييز منصوب وعلامة نصبه الفتحة الظّاهرة"]},
   {"correct": 0}, "«مناديا»: حال منصوبة وعلامة نصبها الفتحة الظّاهرة.", 0.5, "ar.grammar.irab")
st("s22", "q10", "q10-e2", "mcq", "ما إعراب «يبق» في قوله: «لشعب لم يبق لديه من الوسائل…»؟",
   {"options": ["فعل مضارع مجزوم بلم وعلامة جزمه حذف حرف العلّة", "فعل مضارع مجزوم بلم وعلامة جزمه السّكون", "فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة",
                "فعل ماضٍ مبنيّ على الفتح"]},
   {"correct": 0}, "«يبق»: فعل مضارع مجزوم بلم وعلامة جزمه حذف حرف العلّة.", 0.5, "ar.grammar.irab")
st("s23", "q10", "q10-e3", "mcq", "ما المحلّ الإعرابيّ لجملة [يصير ثروة] في قوله: «ولكنّه في مجالٍ ما (يصير ثروةً)»؟",
   {"options": ["في محلّ رفع خبر «لكنّ»", "في محلّ نصب حال", "في محلّ رفع نعت", "لا محلّ لها من الإعراب استئنافيّة"]},
   {"correct": 0}, "جملة «يصير ثروة»: في محلّ رفع خبر لكنّ.", 0.5, "ar.grammar.sentence_case")
st("s24", "q10", "q10-e4", "mcq", "ما المحلّ الإعرابيّ لجملة [يُسمّى الوقت] في قوله: «نعرف شيئا (يُسمّى الوقت)»؟",
   {"options": ["في محلّ نصب نعت", "في محلّ رفع خبر", "صلة موصول لا محلّ لها من الإعراب", "في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "جملة «يسمّى الوقت»: في محلّ نصب نعت.", 0.5, "ar.grammar.sentence_case")
PL_EXPL = "نوع الجمع: كلمة «وسائل»: صيغة منتهى الجموع على وزن فعائل. كلمة «أحيانا»: جمع قلّة على وزن أفعال."
st("s25", "q11", "q11-e1", "mcq", "ما نوع الجمع في «وسائل»؟",
   {"options": ["صيغة منتهى الجموع على وزن فعائل", "جمع قلّة على وزن أفعال", "جمع مؤنّث سالم", "اسم جمع"]},
   {"correct": 0}, PL_EXPL, 0.25, "ar.morphology")
st("s26", "q11", "q11-e2", "mcq", "ما نوع الجمع في «أحيانا»؟",
   {"options": ["جمع قلّة على وزن أفعال", "صيغة منتهى الجموع على وزن فواعل", "جمع مذكّر سالم", "اسم جمع"]},
   {"correct": 0}, PL_EXPL, 0.25, "ar.morphology")
IMG1 = "«ولكنّه نهر»: هي تشبيه بليغ؛ شبّه الزّمن بالنّهر، حذف الأداة ووجه الشّبه. سرّ بلاغتها: التّوضيح والتّوكيد والإيجاز."
st("s27", "q12", "q12-e1", "mcq", "ما نوع الصّورة البيانيّة في «ولكنّه نهرٌ»؟",
   {"options": ["تشبيه بليغ", "استعارة تصريحيّة", "كناية عن موصوف", "مجاز مرسل علاقته المحلّيّة"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.simile")
st("s28", "q12", "q12-e1", "matching", "اشرح التّشبيه في «ولكنّه نهرٌ»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به", "المحذوف من أركان التّشبيه"], "rights": ["الزّمن", "النّهر", "الأداة ووجه الشّبه", "الحضارات"]},
   {"pairs": [0, 1, 2]}, IMG1, 0.5, "ar.rhetoric.simile", "b")
st("s29", "q12", "q12-e1", "mcq", "ما سرّ بلاغة التّشبيه في «ولكنّه نهرٌ»؟",
   {"options": ["التّوضيح والتّوكيد والإيجاز", "تشخيص الجماد وبثّ الحياة فيه", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ في العبارة"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.effect", "c")
IMG2 = "«ترويها ساعات معيّنة»: هي استعارة مكنيّة؛ حيث شبّه السّاعات بالماء وحذف المشبّه به وأبقى شيئًا من لوازمه «ترويها». بلاغتها: تقوية المعنى وتجسيده."
st("s30", "q12", "q12-e2", "mcq", "ما نوع الصّورة البيانيّة في «ترويها ساعات مُعيّنة»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن صفة"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.metaphor")
st("s31", "q12", "q12-e2", "fill_blank", "اشرح الصّورة في «ترويها ساعات مُعيّنة»:",
   {"text": "شبّه السّاعات بـ____ وحذف المشبّه به وأبقى شيئًا من لوازمه «____».", "bank": ["الماء", "ترويها", "النّار", "تمرّ"]},
   {"blanks": [["الماء"], ["ترويها"]]}, IMG2, 0.5, "ar.rhetoric.metaphor", "b")
st("s32", "q12", "q12-e2", "mcq", "ما سرّ بلاغة الاستعارة في «ترويها ساعات مُعيّنة»؟",
   {"options": ["تقوية المعنى وتجسيده", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين المعنيين"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.effect", "c")
# ── ثالثًا: التّقويم النّقديّ ──
ART_EXPL = "تعريف المقال: هو قطعة نثريّة تتناول موضوعًا ما وفق منهجيّة خاصّة. نوع المقال: مقال فكريّ (لأنّه تناول فكرة الزّمن واستغلاله عند الشّعوب والأمم)."
st("s33", "q13", "q13-e1", "mcq", "ما تعريف فنّ المقال؟",
   {"options": ["قطعة نثريّة تتناول موضوعًا ما وفق منهجيّة خاصّة", "قطعة شعريّة موزونة مقفّاة", "حكاية نثريّة تقوم على الأحداث والشّخصيّات والحوار",
                "رسالة يبعث بها الأديب إلى صديق"]},
   {"correct": 0}, ART_EXPL, 0.25, "ar.literature.prose")
st("s34", "q13", "q13-e2", "mcq", "ما نوع المقال في نصّ مالك بن نبي؟",
   {"options": ["مقال فكريّ", "مقال سياسيّ", "مقال نقديّ", "مقال قصصيّ"]},
   {"correct": 0}, ART_EXPL, 0.25, "ar.literature.prose")
PLAN_EXPL = ("تحديد المقدّمة: «الزّمن نهر … الّتي لا تعوّض» (الفقرة الأولى)؛ تحديد العرض: «وحظّ الشّعب… تماما قيمة هذا الأمر» (الفقرتان الثّانية والثّالثة)؛ "
             "تحديد الخاتمة: «ولا بدّ لنا … الإنسان والتّراب والزّمن» (الفقرة الرّابعة).")
st("s35", "q14", "q14-e1", "mcq", "حدّد بداية المقدّمة ونهايتها في نصّ المقال.",
   {"options": ["الفقرة الأولى: «الزّمن نهر … الّتي لا تعوّض»", "الفقرتان الأولى والثّانية", "الفقرة الثّانية وحدها", "الجملة الأولى من الفقرة الأولى وحدها"]},
   {"correct": 0}, PLAN_EXPL, 0.25, "ar.literature.prose")
st("s36", "q14", "q14-e2", "mcq", "حدّد بداية العرض ونهايته في نصّ المقال.",
   {"options": ["الفقرتان الثّانية والثّالثة: «وحظّ الشّعب … تماما قيمة هذا الأمر»", "الفقرة الثّانية وحدها", "الفقرات الثّانية والثّالثة والرّابعة",
                "الفقرة الأولى"]},
   {"correct": 0}, PLAN_EXPL, 0.25, "ar.literature.prose")
st("s37", "q14", "q14-e3", "mcq", "حدّد بداية الخاتمة ونهايتها في نصّ المقال.",
   {"options": ["الفقرة الرّابعة: «ولا بدّ لنا … الإنسان والتّراب والزّمن»", "الفقرة الثّالثة", "الفقرتان الثّالثة والرّابعة", "الجملة الأخيرة من الفقرة الثّالثة"]},
   {"correct": 0}, PLAN_EXPL, 0.25, "ar.literature.prose")
CHAR_EXPL = ("خصائص المقال من النّصّ: البساطة في التّعبير وعمق الفكرة (أسلوب مباشر وواضح)؛ قطعة نثريّة محدودة الطّول؛ منهجيّة المقال (المقدّمة والعرض والخاتمة)؛ "
             "معالجة فكرة محدّدة (الزّمن وأهمّيّته في نهضة الأمّة)؛ الألفاظ الدّقيقة والاصطلاحيّة (الزّمن، الدّقيقة…). يكفي أربع منها.")
st("s38", "q15", "q15-e1", "multi", "أيّ ممّا يلي من خصائص المقال الّتي يمكن استخراجها من النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["البساطة في التّعبير وعمق الفكرة", "قطعة نثريّة محدودة الطّول", "منهجيّة المقال (المقدّمة والعرض والخاتمة)", "معالجة فكرة محدّدة",
                "الألفاظ الدّقيقة والاصطلاحيّة", "الوزن والقافية", "تعدّد الشّخصيّات والأحداث"]},
   {"correct": [0, 1, 2, 3, 4]}, CHAR_EXPL, 1, "ar.literature.features")
st("s39", "q15", "q15-e1", "matching", "طابق كلّ خاصّيّة من خصائص المقال بما يمثّل لها من النّصّ.",
   {"lefts": ["البساطة في التّعبير وعمق الفكرة", "منهجيّة المقال", "معالجة فكرة محدّدة", "الألفاظ الدّقيقة والاصطلاحيّة"],
    "rights": ["(أسلوب مباشر وواضح)", "(المقدّمة والعرض والخاتمة)", "(الزّمن وأهمّيّته في نهضة الأمّة)", "(الزّمن، الدّقيقة…)", "(الحوار بين الشّخصيّات)"]},
   {"pairs": [0, 1, 2, 3]}, CHAR_EXPL, 1, "ar.literature.features", "b")
st("s40", "q16", "q16-e1", "multi", "أيّ هؤلاء من أشهر كتّاب المقال الجزائريّين؟ (اختر كلّ ما يصحّ)",
   {"options": ["ابن باديس", "البشير الإبراهيمي", "مالك بن نبي", "أحمد توفيق المدني", "مبارك الميلي", "مصطفى لطفي المنفلوطي", "عبّاس محمود العقّاد"]},
   {"correct": [0, 1, 2, 3, 4]}, "أشهر كتّاب المقال من الجزائريّين: ابن باديس، البشير الإبراهيمي، مالك بن نبي، أحمد توفيق المدني، مبارك الميلي. "
   "أمّا المنفلوطي والعقّاد فكاتبان مصريّان.", 0.75, "ar.literature.prose")

TITLE = "بكالوريا 2015 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (مالك بن نبي: شروط النّهضة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2015، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّبت من الموضوع الرّسميّ أخطاء نسخ في docx: «من الأزل» ← «منذ الأزل»، «حظّ» ← «وحظّ» (بداية الفقرة 2)، «العام الإسلامي» ← «العالم الإسلامي»، "
         "«يتحدث معنى» ← «يتحدّد معنى»، «الآية» ← «الآتية» (البناء اللّغويّ س1)، «أعربا» ← «أعرب» (س3)؛ ووُصلت الفقرتان 3 و4 والسّؤالان 2 و5 المقطوعة أسطرها في docx. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص3–4، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): الرّأي في س4 (0.75) والتّلخيص س7 (02 بشروطه الثّلاثة دون تفصيل). التّقويم النّقديّ س4 يطلب أربعة كتّاب وعلامته في السّلّم 3×0.25.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."

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
            assert len(set(p["options"])) == len(p["options"]) and len({_norm(o) for o in p["options"]}) == len(p["options"]), (s["id"], "duplicate options")
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
        "kind": "BAC", "year": 2015, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T13:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
