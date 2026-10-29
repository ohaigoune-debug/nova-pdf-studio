"""Conversion: BAC 2015 (session عاديّة، جوان 2015) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (عبد الوهّاب البيّاتي، «الموت في الظّهيرة»).
Exam (most faithful source): gdrive 1nGcUcZWX56LyEun6s29WQqD3VvcfOgO0 (بكالوريا العربية 2015 شعبة لغات اجنبية.docx);
same paper as PDF (owner's retyped copy): gdrive 1EnKlP11rv00o9lydr2vIvFc1hKSDOOyZ (BAC 2015 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 12qyLtITTxkRgFMWtecpdW_TK8MmaWx00 (01_الموضوع.pdf, pages 1–2 — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1cWxix73GjU2N3sz3rFbn-ucgsS6A119F (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2019_lit_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx (paragraph
and cell text read exactly; only outer whitespace and outer direction marks trimmed; the free-verse poem sits in a two-cell
table whose cells are kept line by line and cut into its two stanzas «-1-», «-2-») and every verbatim string of the JSON was
re-checked programmatically against the docx. The docx was compared line by line with the official ONEC paper (rendered at
150 dpi): same poem and line breaks, same questions (docx «الطّفل» الوارد / ONEC «الواردة», «الشرح اللغوي» / «شرح المفردات»
— docx kept). The correction is a scanned PDF, read from the rendered pages (150 dpi, 300 dpi crops for the scansion).
Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: لغات أجنبيّة only (ONEC paper and correction headers) ⇒ LANG.
- Rule for «n×m» lines (as in the 2017–2023 converters): interchangeable items (more listed than required) ⇒ one element;
  exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1 «4×0.5»: four features among six («يكتفي المترشّح بذكر أربعة ملامح فقط») ⇒ one element of 2.
- Q2 «4×0.25» = the four verbs ⇒ four elements. Q3 «2×0.75» = religious symbol / natural symbol (example + meaning each).
- Q4 «4×0.5» = exactly the four optimistic phrases given by the scheme ⇒ four elements.
- Q5 «2×01» for «هل ينطبق… علّل»: the scheme answers «نعم ينطبق… لأنّه ينتمي إلى أمّته…» + the evidence from the poem; it does
  not say that any reasoned opinion is accepted ⇒ interactive (applies + reason / evidence) — to be confirmed by the owner.
- Q6 «0.5 + 2×0.5»: the type + two indicators among three ⇒ one element of 1. The scheme puts «يتدلّى رأسه» among the
  النّعوت والإضافات examples ⇒ not used in the steps.
- Part 2: Q1 «01»; Q2 «2×0.5» and Q3 «2×0.5» one element per item; Q4 «3×0.5» = type / explanation / effect; Q5 «3×0.5»
  (unlabelled) = the scansion (writing + symbols) / the feet / the metre. The scheme prints the symbols mirror-reversed
  (left-to-right: «0/0//0/ 0/0//0/ 0/0///»); read in Arabic order they are ///0/0 /0//0/0 /0//0/0 (فعلاتن فاعلاتن فاعلاتن)
  and /0//0/0 /0//0/0 (فاعلاتن فاعلاتن), بحر الرّمل, as the feet written under them confirm.
- Part 3 (three dash items): «01» motive, «01.5» what the Aurès stands for, «01.5» three poets among five («يكتفي المترشّح
  بذكر ثلاثة أعلام») ⇒ one element each; the poet distractors did not live to see the revolution.
- Distractors avoid arguable alternatives: «الطّفل» (بدل) has no نعت/عطف بيان distractor; (يحلم) (خبر كان) has no حال;
  «ولدته الرّيح» (استعارة مكنيّة) has no مجاز distractor; the type of the poem has no «السّرديّ» distractor.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2015-lang-p1"
PAPER = 1
STREAMS = ["LANG"]
DOCX_ID = "1nGcUcZWX56LyEun6s29WQqD3VvcfOgO0"
DOCX_TITLE = "بكالوريا العربية 2015 شعبة لغات اجنبية.docx"
PDF_ID = "1EnKlP11rv00o9lydr2vIvFc1hKSDOOyZ"
OFFICIAL_ID = "12qyLtITTxkRgFMWtecpdW_TK8MmaWx00"
CORR_ID = "1cWxix73GjU2N3sz3rFbn-ucgsS6A119F"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    2: 'النّـــــص: قال الشّاعر العراقي عبد الوهاب البيّاتي بعد مقتل الزعيم الوطنيّ الجزائريّ العربي بن مهيدي في زنزانته في السّجن من قبل البرابرة الفرنسيّين:',
    3: 'الموت في الظهيرة',
    4: 'الديوان الجزء الأوّل ص: 359 إلى 361',
    5: 'الشرح اللغوي: فلّ: جمع فلة نوع من النبات له زهر طيّب الرائحة نقيّ البياض',
    6: 'خميلة: الشجر الكثير الملتف. جنادل: جمع جندلة، وهي الصخرة العظيمة.',
    7: 'الأسئلة:    أوّلا- البناء الفكري: (10 نقاط)',
    8: 'رسم الشّاعر شخصية البطل العربي بن مهيدي، اذكر بعض ملامحها من النّص.',
    9: 'تضمّنت الأفعال الآتية: «يحلم -\u200f يتألّم -لا يتكلّم - يعلم» قيما ومبادئ آمن بها الثوار الجزائريّون. اذكرها.',
    10: 'وظف الشاعر نوعين من الرّمز، ما هما؟ هات مثالا لكل نوع مع الشرح.',
    11: 'نظرة الشاعر التفاؤلية واضحة في النّص. ما العبارات الدالة على ذلك؟',
    12: 'يقول الكاتب أحمد قبش: «الشّاعر الحديث مصلوب إلى أمّته، يشارك في آلامها وأفراحها...». هل ينطبق هذا القول على الشاعر البيّاتي في قصيدته؟ علّل.',
    13: 'ما النّمط الغالب على النص؟ اذكر مؤشرين له مع التمثيل من النص.',
    14: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    15: 'ما الحقل الدلالي للألفاظ التالية: «السجن، حمّى، ليل، جريمة، يتألم»؟',
    16: 'أعرب لفظة «يتلو» الواردة في قول الشاعر: «أخضر العينين يتلو»، ولفظة «الطّفل» الوارد في قوله: «فوق عيني ذلك الطفل المناضل».',
    17: 'بين المحلّ الإعرابي للجملتين الآتيتين:',
    18: '«قمر أَسودُ في نافذة السّجن» الواردة في المقطع الأوّل.',
    19: '«يحلم» الواردة في المقطع الثاني.',
    20: 'في عبارة «ولدته الرّيح والأرض...» صورة بيانيّة، اشرحها مبيّنا نوعها وسرّ بلاغتها.',
    21: 'قطّع السّطرين الآتيين تقطيعا عروضيا محددا التفعيلات والبحر:',
    22: 'وحماماتٌ وقرآنٌ وطفلُ',
    23: 'أخضرُ العينينِ يتلو',
    24: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    25: 'يقول عبدالله الركيبي في كتابه (الأوراس في الشّعر العربيّ): «كما اهتم شعراؤنا بالأوراس اهتمّ به الشعراء العرب في شتّى أنحاء الوطن العربي...».',
    26: '- انطلاقا من هذا القول بيّن الدّافع إلى اهتمام الشعراء العرب بالثورة الجزائريّة.',
    27: '- ماذا يمثل الأوراس بالنسبة إليهم؟',
    28: '- اذكر بعض الشعراء العرب الذين مجّدوا الثورة الجزائريّة واحتفوا بها، مقتصرا على ثلاثة أعلام منهم.',
}
# الجدول 0 في docx: خليّتان (اليمنى ثمّ اليسرى)، سطرًا سطرًا.
POEM_RAW = [
    ['-1-', '(قمرٌ أسود في نافذة السّجن)، وليلُ', 'وحماماتٌ وقرآنٌ وطفلُ', 'أخضر العينين يتلو', 'سورة «النّصر» وفلُّ', 'من حقول النُّور، من أفق جديدِ', 'قطفته يدُ قدّيس شهيد', 'يدُ قدّيس وثائر', 'ولدته في ليالي بعثها شمس الجزائر', 'ولدته الرّيح والأرض وأشواق الطفولة', 'وعذاباتُ ربيع في خميلة', 'وانتصارات وحُمّى وبطولة...', 'وحماماتٌ وقرآنٌ، وليل', 'صامتٌ يمسح عن كفيه آثار الجريمة', 'قمرٌ أسودُ'],
    ['آثار الجريمة', 'وعلى الجدران ظل', 'يتدلى رأسه، يَسقط ثلج', 'فوق عينيه وترب وجنادل', 'فوق عيني ذلك الطفل المناضل', '-2-', 'كان في نافذة السّجن مع العصفور (يحلم)', 'كان مثلي يتألم', 'كان سرّاً مغلقاً لا يتكلم', 'كان يعلم:', 'أنه لا بدّ هالك', 'وستبقى بعده الشمس هنالك', 'في ليالي بعثها، شمس الجزائر', 'تلد الثائر في أعقاب ثائر.'],
]
LINES = POEM_RAW[0] + POEM_RAW[1]
_i2 = LINES.index('-2-')
STANZAS = [LINES[:_i2], LINES[_i2:]]
assert STANZAS[0][0] == '-1-' and len(STANZAS[0]) == 20 and len(STANZAS[1]) == 9

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
_ask, P1 = re.split(r"\s{2,}", PARAS[7])
P2, P3 = PARAS[14], PARAS[24]
assert _ask == "الأسئلة:" and P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[2]},
    {"id": "d-title", "kind": "text", "caption": "العنوان", "text": PARAS[3]},
    {"id": "d-poem-1", "kind": "text", "caption": "النّصّ (1)", "text": "\n".join(STANZAS[0])},
    {"id": "d-poem-2", "kind": "text", "caption": "النّصّ (2)", "text": "\n".join(STANZAS[1])},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[4]},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": J(5, 6)},
]
CRIT_DOCS = DOCS + [{"id": "d-crit", "kind": "text", "caption": "القول", "text": PARAS[25]}]


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


q("q1", "1", P1, J(8), 2, [el("q1-e1", "أربعة ملامح لشخصيّة العربي بن مهيدي (4×0.5)", 2)])
q("q2", "2", P1, J(9), 1, [el("q2-e1", "ما تضمّنه الفعل «يحلم»", 0.25), el("q2-e2", "ما تضمّنه الفعل «يتألّم»", 0.25),
                           el("q2-e3", "ما تضمّنه «لا يتكلّم»", 0.25), el("q2-e4", "ما تضمّنه الفعل «يعلم»", 0.25)])
q("q3", "3", P1, J(10), 1.5, [el("q3-e1", "الرّمز الأوّل: مثاله وشرحه", 0.75), el("q3-e2", "الرّمز الثّاني: مثاله وشرحه", 0.75)])
q("q4", "4", P1, J(11), 2, [el("q4-e1", "العبارة الأولى الدّالّة على التّفاؤل", 0.5), el("q4-e2", "العبارة الثّانية", 0.5),
                            el("q4-e3", "العبارة الثّالثة", 0.5), el("q4-e4", "العبارة الرّابعة", 0.5)])
q("q5", "5", P1, J(12), 2, [el("q5-e1", "انطباق القول على البيّاتي وتعليله", 1), el("q5-e2", "الدّليل من القصيدة", 1)])
q("q6", "6", P1, J(13), 1.5, [el("q6-e1", "النّمط الغالب", 0.5), el("q6-e2", "مؤشّران مع التّمثيل (2×0.5)", 1)])
q("q7", "1", P2, J(15), 1, [el("q7-e1", "الحقل الدّلاليّ", 1)])
q("q8", "2", P2, J(16), 1, [el("q8-e1", "إعراب «يتلو»", 0.5), el("q8-e2", "إعراب «الطّفل»", 0.5)])
q("q9", "3", P2, J(17, 18, 19), 1, [el("q9-e1", "محلّ جملة «قمر أسود في نافذة السّجن»", 0.5), el("q9-e2", "محلّ جملة «يحلم»", 0.5)])
q("q10", "4", P2, J(20), 1.5, [el("q10-e1", "«ولدته الرّيح…»: النّوع", 0.5), el("q10-e2", "«ولدته الرّيح…»: الشّرح", 0.5), el("q10-e3", "«ولدته الرّيح…»: سرّ البلاغة", 0.5)])
q("q11", "5", P2, J(21, 22, 23), 1.5, [el("q11-e1", "التّقطيع (الكتابة العروضيّة والرّموز)", 0.5), el("q11-e2", "التّفعيلات", 0.5), el("q11-e3", "البحر", 0.5)])
q("q12", "1", P3, J(26), 1, [el("q12-e1", "الدّافع إلى اهتمام الشّعراء العرب بالثّورة الجزائريّة", 1)], CRIT_DOCS)
q("q13", "2", P3, J(27), 1.5, [el("q13-e1", "ما يمثّله الأوراس بالنّسبة إليهم", 1.5)], CRIT_DOCS)
q("q14", "3", P3, J(28), 1.5, [el("q14-e1", "ثلاثة من الشّعراء العرب الّذين مجّدوا الثّورة", 1.5)], CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("بعض ملامح شخصيّة العربي بن مهيدي من النّصّ: البراءة والتّطلّع إلى غد جميل ومستقبل زاهر «طفل أخضر العينين»؛ الإيمان بالله واليقين التّامّ في نصره "
           "«يتلو سورة النّصر»؛ التّشبّع بمشاعر الحبّ والجمال «وفلّ من حقول النّور»؛ الطّهر والتّضحية «يد قدّيس شهيد»؛ الإباء والرّفض «وثائر…»؛ "
           "الجلد والصّبر «كان مثلي يتألّم». يكتفي المترشّح بذكر أربعة ملامح فقط.")
st("s01", "q1", "q1-e1", "multi", "اختر من ملامح شخصيّة البطل العربي بن مهيدي كما رسمها الشّاعر. (اختر كلّ ما يصحّ)",
   {"options": ["البراءة والتّطلّع إلى غد جميل ومستقبل زاهر", "الإيمان بالله واليقين التّامّ في نصره", "التّشبّع بمشاعر الحبّ والجمال", "الطّهر والتّضحية",
                "الإباء والرّفض", "الجلد والصّبر", "الخوف والتّردّد", "اليأس والاستسلام"]},
   {"correct": [0, 1, 2, 3, 4, 5]}, Q1_EXPL, 1, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "matching", "طابق كلّ ملمح من ملامح الشّخصيّة بالعبارة الدّالّة عليه من النّصّ.",
   {"lefts": ["البراءة والتّطلّع إلى غد جميل", "الإيمان بالله واليقين التّامّ في نصره", "الطّهر والتّضحية", "الجلد والصّبر"],
    "rights": ["«طفل أخضر العينين»", "«يتلو سورة النّصر»", "«يد قدّيس شهيد»", "«كان مثلي يتألّم»", "«وعلى الجدران ظلّ»"]},
   {"pairs": [0, 1, 2, 3]}, Q1_EXPL, 1, "ar.comprehension.evidence", "b")
Q2_EXPL = ("المعاني الّتي تضمّنتها الأفعال: يحلم: يتطلّع إلى المستقبل الواعد، أي يتوق إلى تحرّر شعبه واستقلال وطنه الجزائر؛ يتألّم: لحاله وحال شعبه ووطنه؛ "
           "لا يتكلّم: يتحدّى الجلّادين ويحافظ على أسرار الثّورة رغم وحشيّة التّعذيب؛ يعلم: الإيمان بالشّهادة واستمرار الثّورة والثّوّار حتّى النّصر.")
st("s03", "q2", "q2-e1", "mcq", "ما المعنى الّذي تضمّنه الفعل «يحلم»؟",
   {"options": ["يتطلّع إلى المستقبل الواعد، أي يتوق إلى تحرّر شعبه واستقلال وطنه الجزائر", "يتألّم لحاله وحال شعبه ووطنه",
                "يتحدّى الجلّادين ويحافظ على أسرار الثّورة رغم وحشيّة التّعذيب", "يهرب من واقع السّجن إلى عالم الخيال"]},
   {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.values")
st("s04", "q2", "q2-e2", "fill_blank", "أكمل ما تضمّنه الفعل «يتألّم»:",
   {"text": "يتألّم ____ وحال ____ ووطنه.", "bank": ["لحاله", "شعبه", "لعدوّه", "جلّاديه"]},
   {"blanks": [["لحاله"], ["شعبه"]]}, Q2_EXPL, 0.25, "ar.comprehension.values")
st("s05", "q2", "q2-e3", "mcq", "ما المعنى الّذي تضمّنه «لا يتكلّم»؟",
   {"options": ["يتحدّى الجلّادين ويحافظ على أسرار الثّورة رغم وحشيّة التّعذيب", "يتطلّع إلى المستقبل الواعد", "يخاف من الجلّادين فيصمت",
                "لا يعرف شيئًا عن أسرار الثّورة"]},
   {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.values")
st("s06", "q2", "q2-e4", "fill_blank", "أكمل ما تضمّنه الفعل «يعلم»:",
   {"text": "الإيمان بـ____ واستمرار الثّورة والثّوّار حتّى ____.", "bank": ["الشّهادة", "النّصر", "الهزيمة", "الهدنة"]},
   {"blanks": [["الشّهادة"], ["النّصر"]]}, Q2_EXPL, 0.25, "ar.comprehension.values")
Q3_EXPL = ("وظّف الشّاعر نوعين من الرّمز: الأوّل دينيّ مثل «قرآن، سورة النّصر، قدّيس»: فالقرآن رمز للإسلام بمبادئه وقيمه، وسورة النّصر رمز لانتصار الحقّ على الباطل، "
           "والقدّيس رمز لمعاني السّلم والطّهر. والثّاني طبيعيّ مثل «ليل، أفق، الرّيح، الشّمس…»: فاللّيل رمز لكلّ معاني الشّرّ من ظلم وقهر وغدر وهي تتجسّد في "
           "الاستعمار البغيض، والأفق يرمز للأمل والمستقبل السّعيد، والرّيح ترمز لمعاني التّغيير والثّورة والتّدمير، والشّمس ترمز لمعاني الحقيقة والحرّيّة.")
st("s07", "q3", "q3-e1", "multi", "اختر أمثلة الرّمز الدّينيّ في القصيدة. (اختر كلّ ما يصحّ)",
   {"options": ["قرآن", "سورة النّصر", "قدّيس", "ليل", "الرّيح"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 0.25, "ar.literature.features")
st("s08", "q3", "q3-e1", "matching", "اشرح الرّمز الدّينيّ: طابق كلّ رمز بدلالته.",
   {"lefts": ["القرآن", "سورة النّصر", "القدّيس"],
    "rights": ["رمز للإسلام بمبادئه وقيمه", "رمز لانتصار الحقّ على الباطل", "رمز لمعاني السّلم والطّهر", "رمز لمعاني التّغيير والثّورة والتّدمير"]},
   {"pairs": [0, 1, 2]}, Q3_EXPL, 0.5, "ar.literature.features", "b")
st("s09", "q3", "q3-e2", "multi", "اختر أمثلة الرّمز الطّبيعيّ في القصيدة. (اختر كلّ ما يصحّ)",
   {"options": ["ليل", "أفق", "الرّيح", "الشّمس", "قدّيس", "سورة النّصر"]},
   {"correct": [0, 1, 2, 3]}, Q3_EXPL, 0.25, "ar.literature.features")
st("s10", "q3", "q3-e2", "matching", "اشرح الرّمز الطّبيعيّ: طابق كلّ رمز بدلالته.",
   {"lefts": ["اللّيل", "الأفق", "الرّيح", "الشّمس"],
    "rights": ["معاني الشّرّ من ظلم وقهر وغدر تتجسّد في الاستعمار البغيض", "الأمل والمستقبل السّعيد", "معاني التّغيير والثّورة والتّدمير", "معاني الحقيقة والحرّيّة",
               "معاني السّلم والطّهر"]},
   {"pairs": [0, 1, 2, 3]}, Q3_EXPL, 0.5, "ar.literature.features", "b")
Q4_EXPL = "الشّاعر متفائل في النّصّ، ومن العبارات الدّالّة على ذلك: «مع العصفور يحلم»، «وستبقى بعده الشّمس هنالك»، «شمس الجزائر»، «تلد الثّائر في أعقاب الثّائر»."
st("s11", "q4", "q4-e1", "mcq", "أكمل العبارة الدّالّة على تفاؤل الشّاعر: «كان في نافذة السّجن مع العصفور …»",
   {"options": ["يحلم", "يتألّم", "يبكي", "ينام"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.evidence")
st("s12", "q4", "q4-e2", "fill_blank", "أكمل العبارة الدّالّة على تفاؤل الشّاعر:",
   {"text": "«وستبقى بعده ____ هنالك»", "bank": ["الشّمس", "الجريمة", "الظّلمة"]},
   {"blanks": [["الشّمس"]]}, Q4_EXPL, 0.5, "ar.comprehension.evidence")
st("s13", "q4", "q4-e3", "mcq", "أيّ العبارات الآتية من القصيدة تدلّ على تفاؤل الشّاعر؟",
   {"options": ["«شمس الجزائر»", "«قمرٌ أسودُ»", "«آثار الجريمة»", "«يسقط ثلج»"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.evidence")
st("s14", "q4", "q4-e4", "fill_blank", "أكمل العبارة الدّالّة على تفاؤل الشّاعر في خاتمة القصيدة:",
   {"text": "«____ الثّائر في أعقاب ثائر.»", "bank": ["تلد", "تقتل", "تنسى"]},
   {"blanks": [["تلد"]]}, Q4_EXPL, 0.5, "ar.comprehension.evidence")
Q5_EXPL = ("نعم ينطبق هذا القول على الشّاعر البيّاتي لأنّه ينتمي إلى أمّته العربيّة، يتألّم لآلامها، ويبتهج ويفرح لانتصاراتها، وأصدق دليل على هذا، وعلى ضوء القصيدة، "
           "فهو يؤازر الثّورة الجزائريّة وثوّارها، ويمجّد بقلمه وبيانه عظماءها أمثال الشّهيد العربي بن مهيدي، ويكشف الأعمال البشعة لفرنسا، ويعبّر بصدق عن جرحه "
           "ومعاناته كقوله «كان مثلي يتألّم».")
st("s15", "q5", "q5-e1", "mcq", "هل ينطبق قول أحمد قبش «الشّاعر الحديث مصلوب إلى أمّته، يشارك في آلامها وأفراحها» على البيّاتي في قصيدته؟",
   {"options": ["نعم، لأنّه ينتمي إلى أمّته العربيّة، يتألّم لآلامها، ويبتهج ويفرح لانتصاراتها", "لا، لأنّه يتحدّث عن همومه الذّاتيّة فقط",
                "لا، لأنّ القصيدة لا تتناول قضيّة عربيّة", "نعم، لأنّه التزم بنظام الشّطرين والقافية الموحّدة"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.literature.trend")
st("s16", "q5", "q5-e1", "fill_blank", "أكمل التّعليل:",
   {"text": "ينطبق هذا القول على البيّاتي لأنّه ينتمي إلى أمّته العربيّة، ____ لآلامها، ويبتهج ويفرح ____.", "bank": ["يتألّم", "لانتصاراتها", "يشمت", "لهزائمها"]},
   {"blanks": [["يتألّم"], ["لانتصاراتها"]]}, Q5_EXPL, 0.5, "ar.literature.trend", "b")
st("s17", "q5", "q5-e2", "multi", "على ضوء القصيدة، ما الدّليل على مشاركة الشّاعر أمّته آلامها وأفراحها؟ (اختر كلّ ما يصحّ)",
   {"options": ["يؤازر الثّورة الجزائريّة وثوّارها", "يمجّد بقلمه وبيانه عظماءها أمثال الشّهيد العربي بن مهيدي", "يكشف الأعمال البشعة لفرنسا",
                "يمدح المستعمر الفرنسيّ", "يدعو الثّوّار إلى إلقاء السّلاح"]},
   {"correct": [0, 1, 2]}, Q5_EXPL, 0.5, "ar.comprehension.evidence")
st("s18", "q5", "q5-e2", "mcq", "بأيّ عبارة من القصيدة يعبّر الشّاعر بصدق عن جرحه ومعاناته؟",
   {"options": ["«كان مثلي يتألّم»", "«من حقول النّور، من أفق جديد»", "«وستبقى بعده الشّمس هنالك»", "«قطفته يد قدّيس شهيد»"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.comprehension.evidence", "b")
st("s19", "q6", "q6-e1", "mcq", "ما النّمط الغالب على قصيدة «الموت في الظّهيرة»؟",
   {"options": ["الوصفيّ", "الحجاجيّ", "التّفسيريّ", "الإيعازيّ"]},
   {"correct": 0}, "النّمط الغالب على النّصّ هو النّمط الوصفيّ.", 0.5, "ar.text.type")
Q6_EXPL = ("مؤشّراته: النّعوت والإضافات «أسود، شهيد، نافذة السّجن، شمس الجزائر…»، كثرة الأفعال المضارعة «يتلو، يسقط»، والصّور البيانيّة «ولدته الرّيح، ليل صامت، "
           "يمسح آثار الجريمة».")
st("s20", "q6", "q6-e2", "matching", "طابق كلّ مؤشّر من مؤشّرات الوصف بأمثلته من القصيدة.",
   {"lefts": ["النّعوت والإضافات", "كثرة الأفعال المضارعة", "الصّور البيانيّة"],
    "rights": ["«أسود، شهيد، نافذة السّجن، شمس الجزائر»", "«يتلو، يسقط»", "«ولدته الرّيح، ليل صامت، يمسح آثار الجريمة»", "«لأنّ، إذن، بما أنّ»"]},
   {"pairs": [0, 1, 2]}, Q6_EXPL, 0.5, "ar.text.type")
st("s21", "q6", "q6-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["النّعوت والإضافات", "كثرة الأفعال المضارعة", "الصّور البيانيّة", "أدوات التّعليل والاستنتاج", "تقديم الحجج والبراهين"]},
   {"correct": [0, 1, 2]}, Q6_EXPL, 0.5, "ar.text.type", "b")
# ── ثانيًا: البناء اللّغويّ ──
st("s22", "q7", "q7-e1", "mcq", "ما الحقل الدّلاليّ للألفاظ: «السّجن، حمّى، ليل، جريمة، يتألّم»؟",
   {"options": ["المعاناة – الاضطهاد", "الفرح والأمل", "الطّبيعة الجميلة", "الحرب والانتصار"]},
   {"correct": 0}, "الحقل الدّلاليّ للألفاظ (السّجن، حمّى، ليل، جريمة، يتألّم) هو: المعاناة – الاضطهاد.", 1, "ar.cohesion.effect")
YATLU = "«يتلو»: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو منع من ظهورها الثّقل، والفاعل ضمير مستتر جوازًا تقديره هو."
st("s23", "q8", "q8-e1", "mcq", "ما إعراب «يتلو» في قول الشّاعر: «أخضر العينين يتلو»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو منع من ظهورها الثّقل", "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "فعل مضارع مجزوم وعلامة جزمه حذف حرف العلّة", "فعل مضارع منصوب وعلامة نصبه الفتحة المقدّرة"]},
   {"correct": 0}, YATLU, 0.25, "ar.grammar.irab")
st("s24", "q8", "q8-e1", "fill_blank", "أكمل: فاعل «يتلو»",
   {"text": "والفاعل ضمير مستتر جوازًا تقديره ____.", "bank": ["هو", "هي", "أنت"]},
   {"blanks": [["هو"]]}, YATLU, 0.25, "ar.grammar.irab", "b")
st("s25", "q8", "q8-e2", "mcq", "ما إعراب «الطّفل» في قوله: «فوق عيني ذلك الطّفل المناضل»؟",
   {"options": ["بدل من اسم الإشارة مجرور وعلامة جرّه الكسرة الظّاهرة على آخره", "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة على آخره",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«الطّفل»: بدل من اسم الإشارة مجرور وعلامة جرّه الكسرة الظّاهرة على آخره.", 0.5, "ar.grammar.badal")
st("s26", "q9", "q9-e1", "mcq", "ما المحلّ الإعرابيّ لجملة «قمرٌ أسودُ في نافذة السّجن» في المقطع الأوّل؟",
   {"options": ["جملة ابتدائيّة لا محلّ لها من الإعراب", "جملة اسميّة في محلّ رفع خبر", "جملة اسميّة في محلّ نصب حال", "جملة اسميّة في محلّ رفع نعت"]},
   {"correct": 0}, "«قمر أسود في نافذة السّجن»: جملة ابتدائيّة لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s27", "q9", "q9-e2", "mcq", "ما المحلّ الإعرابيّ لجملة «يحلم» في قوله: «كان في نافذة السّجن مع العصفور (يحلم)»؟",
   {"options": ["جملة فعليّة في محلّ نصب خبر كان", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة صلة موصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "«يحلم»: جملة فعليّة في محلّ نصب خبر كان.", 0.5, "ar.grammar.sentence_case")
IMG = ("«ولدته الرّيح…»: استعارة مكنيّة شبّه فيها الرّيح الّتي هي شيء معنويّ بالأمّ الّتي هي شيء مادّيّ، فحذف المشبّه به الأمّ ورمز له بأحد لوازمه «ولدت». "
       "بلاغتها: تشخيص المعنى وتقريبه إلى الذّهن.")
st("s28", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في «ولدته الرّيح والأرض…»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن موصوف"]},
   {"correct": 0}, IMG, 0.5, "ar.rhetoric.metaphor")
st("s29", "q10", "q10-e2", "fill_blank", "اشرح الصّورة في «ولدته الرّيح والأرض…»:",
   {"text": "شبّه الرّيح الّتي هي شيء ____ بالأمّ الّتي هي شيء ____، فحذف المشبّه به ورمز له بأحد لوازمه «____».",
    "bank": ["معنويّ", "مادّيّ", "ولدت", "الأرض", "يتلو"]},
   {"blanks": [["معنويّ"], ["مادّيّ"], ["ولدت"]]}, IMG, 0.5, "ar.rhetoric.metaphor")
st("s30", "q10", "q10-e3", "mcq", "ما سرّ بلاغة الصّورة في «ولدته الرّيح والأرض…»؟",
   {"options": ["تشخيص المعنى وتقريبه إلى الذّهن", "تقديم الحقيقة مصحوبة بدليلها", "الإيجاز بحذف الأداة ووجه الشّبه", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, IMG, 0.5, "ar.rhetoric.effect")
PRO_EXPL = ("التّقطيع: «وحماما | تنوقرآ | ننوطفلو» = ///0/0 /0//0/0 /0//0/0 = فعلاتن فاعلاتن فاعلاتن؛ «أخضرلعي | نين يتلو» = /0//0/0 /0//0/0 = فاعلاتن فاعلاتن. "
            "القصيدة من بحر الرّمل.")
st("s31", "q11", "q11-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر «وحماماتٌ وقرآنٌ وطفلُ»:",
   {"text": "وحماما / ____ / ننوطفلو", "bank": ["تنوقرآ", "تن وقرآن", "تنوقرآنن"]},
   {"blanks": [["تنوقرآ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s32", "q11", "q11-e1", "mcq", "ما الرّموز العروضيّة للسّطر «وحماماتٌ وقرآنٌ وطفلُ»؟",
   {"options": ["///0/0 /0//0/0 /0//0/0", "/0//0/0 /0//0/0 /0//0/0", "///0/0 ///0/0 /0//0/0", "/0//0/0 ///0/0 /0/0//0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s33", "q11", "q11-e2", "mcq", "ما تفعيلات السّطر «وحماماتٌ وقرآنٌ وطفلُ»؟",
   {"options": ["فعلاتن فاعلاتن فاعلاتن", "فاعلاتن فاعلاتن فاعلاتن", "مستفعلن مستفعلن مستفعلن", "فاعلن فاعلن فاعلن"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s34", "q11", "q11-e2", "mcq", "ما تفعيلات السّطر «أخضرُ العينينِ يتلو»؟",
   {"options": ["فاعلاتن فاعلاتن", "فعلاتن فعلاتن", "مستفعلن مستفعلن", "مفاعيلن مفاعيلن"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s35", "q11", "q11-e3", "mcq", "ما بحر قصيدة «الموت في الظّهيرة»؟",
   {"options": ["الرّمل", "الرّجز", "المتدارك", "الكامل"]},
   {"correct": 0}, PRO_EXPL, 0.5, "ar.prosody")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_EXPL = ("الدّافع إلى اهتمام الشّعراء العرب بالثّورة الجزائريّة هو النّزعة القوميّة الّتي جعلت العربيّ يشارك أبناء أمّته في آلامهم وآمالهم من المحيط إلى الخليج، "
             "يفرح لانتصاراتهم ويتألّم ويتحسّر على معاناتهم.")
st("s36", "q12", "q12-e1", "mcq", "ما الدّافع إلى اهتمام الشّعراء العرب بالثّورة الجزائريّة؟",
   {"options": ["النّزعة القوميّة", "النّزعة الذّاتيّة", "النّزعة الصّوفيّة", "التّكسّب بالشّعر"]},
   {"correct": 0}, CRIT_EXPL, 0.5, "ar.literature.trend")
st("s37", "q12", "q12-e1", "fill_blank", "أكمل:",
   {"text": "النّزعة القوميّة جعلت العربيّ يشارك أبناء أمّته في ____ وآمالهم من المحيط إلى ____، يفرح لانتصاراتهم ويتألّم ويتحسّر على معاناتهم.",
    "bank": ["آلامهم", "الخليج", "أموالهم", "البحر"]},
   {"blanks": [["آلامهم"], ["الخليج"]]}, CRIT_EXPL, 0.5, "ar.literature.trend", "b")
AURES = ("الأوراس بالنّسبة إليهم رمز للبطولة والصّمود والإباء في تحقيق الحرّيّة وتقرير المصير وطرد كلّ دخيل مغتصب، حتّى أضحت ثورة الجزائر بهذه الالتفاتة من قبل الشّعراء "
         "نموذجًا يُحتذى من شعوب العالم العربيّ وغير العربيّ لتحقيق الحرّيّة والكرامة.")
st("s38", "q13", "q13-e1", "mcq", "ماذا يمثّل الأوراس بالنّسبة إلى الشّعراء العرب؟",
   {"options": ["رمز للبطولة والصّمود والإباء في تحقيق الحرّيّة وتقرير المصير وطرد كلّ دخيل مغتصب", "رمز للجمال الطّبيعيّ والسّياحة",
                "رمز للحزن والهزيمة", "مكان لعزلة الشّعراء وتأمّلهم"]},
   {"correct": 0}, AURES, 0.75, "ar.literature.context")
st("s39", "q13", "q13-e1", "fill_blank", "أكمل:",
   {"text": "أضحت ثورة الجزائر بهذه الالتفاتة من قبل الشّعراء ____ يُحتذى من شعوب العالم العربيّ وغير العربيّ لتحقيق ____ والكرامة.",
    "bank": ["نموذجًا", "الحرّيّة", "عائقًا", "الثّروة"]},
   {"blanks": [["نموذجًا"], ["الحرّيّة"]]}, AURES, 0.75, "ar.literature.context", "b")
POETS = ("من الشّعراء الّذين مجّدوا الثّورة الجزائريّة: شفيق الكمالي، سليمان العيسى، محمّد الفيتوري، إبراهيم الدامغ، عبد المعطي حجازي… "
         "(يكتفي المترشّح بذكر ثلاثة أعلام). أمّا أحمد شوقي وحافظ إبراهيم وأبو تمّام فلم يعاصروا الثّورة الجزائريّة (1954).")
st("s40", "q14", "q14-e1", "multi", "أيّ هؤلاء من الشّعراء العرب الّذين مجّدوا الثّورة الجزائريّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["شفيق الكمالي", "سليمان العيسى", "محمّد الفيتوري", "إبراهيم الدامغ", "عبد المعطي حجازي", "أحمد شوقي", "حافظ إبراهيم", "أبو تمّام"]},
   {"correct": [0, 1, 2, 3, 4]}, POETS, 0.75, "ar.literature.context")
st("s41", "q14", "q14-e1", "fill_blank", "أكمل أسماء ثلاثة من الشّعراء العرب الّذين مجّدوا الثّورة الجزائريّة:",
   {"text": "شفيق ____، سليمان ____، محمّد ____.", "bank": ["الكمالي", "العيسى", "الفيتوري", "شوقي", "المتنبّي"]},
   {"blanks": [["الكمالي"], ["العيسى"], ["الفيتوري"]]}, POETS, 0.75, "ar.literature.context", "b")

TITLE = "بكالوريا 2015 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (عبد الوهّاب البيّاتي: الموت في الظّهيرة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2015، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "القصيدة في جدول من خليّتين فقُسّمت إلى مقطعيها (-1-، -2-). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، صورة ممسوحة قُرئت مصوّرة؛ "
         "رموز التّقطيع مطبوعة معكوسة الاتّجاه فقُرئت بترتيبها العربيّ). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "س5 (هل ينطبق… علّل) جوابه في الحلّ مغلق «نعم ينطبق…» فحُوِّل تفاعليًّا؛ لا جزء مؤجَّل في هذا الموضوع.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."

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
