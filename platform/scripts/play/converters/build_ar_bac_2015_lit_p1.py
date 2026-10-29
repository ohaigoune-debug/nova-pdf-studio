"""Conversion: BAC 2015 (session عاديّة، جوان 2015) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (عبد الله الجبوري، قصيدة في الثّورة الجزائريّة).
Exam (most faithful source): gdrive 1PNjmHWMx1Y55H9Q3E45KAsz2oizTfhun (بكالوريا العربية 2015 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's retyped copy): gdrive 12jakgHnlIe1pLwv0D7kgZgSgaQPkjSbs (BAC 2015 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1EgspKfRuGE8e_g4O3yYNfyCjeTPneqpi (01_الموضوع.pdf, pages 1–2 — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1-3T-LvPWNh7JBsmE2LZIBBdUugU82lbu (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2018_lit_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx (paragraph
and cell text read exactly; only outer whitespace and outer direction marks trimmed; the poem table is read as rows
[عجز, (empty), «n- صدر»] from the RTL 3-column layout, the verse number is split off the صدر cell) and every verbatim string
of the JSON was re-checked programmatically against the docx. The docx was compared verse by verse with the official ONEC
paper (rendered at 150 dpi, the poem at 300 dpi). The correction is a scanned PDF, read from the rendered pages (150 dpi,
300 dpi crops). Every mark comes from the official scheme; correct options and explanations condense its wording.

Docx defects fixed from the ONEC paper (PATCHES below, applied after generation):
- verse 1: «قـــد رَّف» (fatha + shadda on the ر) ⇒ «قـــد رفَّ» as on the ONEC paper;
- verse 9: the opening quote is a straight apostrophe «'باريس"» ⇒ «"باريس"»;
- verse 13: «فسيُــــكفَّنُ» has an extra «ف» (absent from the ONEC paper and breaking the كامل metre) ⇒ «سيُــــكفَّنُ».
Other docx/ONEC differences are spelling or labels («الشرح اللغوي» vs «شرح الكلمات», «22/04/ 1959» vs «22/4/ 1959») — docx kept.

Conversion notes / points for the owner's review:
- Streams: آداب وفلسفة only (ONEC paper and correction headers) ⇒ LIT.
- Rule for «n×m» lines (as in the 2017–2023 converters): interchangeable items (more listed than required) ⇒ one element;
  exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×1» = topic / aim. Q2 «4×0.25»: four words among seven listed ⇒ one element. Q3 «3×0.5» = where (verses 1–3) /
  source of confidence (verses 13–14, as the scheme puts it) / justification. Q4 «2×0.5» = one element per emotion.
- Q5 «0.5 + 2×0.5» = the type + two indicators among three («يمكن للمترشّح ذكر مؤشّرات أخرى») ⇒ one element of 1. The
  scheme's verb list «مضوا، يجوبون، يعنون» has «يعنون», not in the poem (probably «يجنون») ⇒ only «مضوا، يجوبون» used.
- Q6 (تلخيص) «3×1» = الإيجاز / المحافظة على المضمون / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2 Q1 «2×0.25», Q2 «2×0.25», Q3 «4×0.5»: one element per item («الوغى»: function and estimated mark as two 0.25 steps).
  Q4 «3×1»: one element per image (type / explanation / effect not split ⇒ steps 0.25 / 0.5 / 0.25).
- Part 3: Q1 «01»; Q2 «4×0.25» motives (four among five) + «2×0.5» aims (two among four) ⇒ two elements of 1; Q3 «4×0.25»
  four poets («يمكن للمترشّح ذكر مجموعة أخرى من الشّعراء العرب») ⇒ one element; the distractors are poets who did not live
  to see the revolution (أحمد شوقي، حافظ إبراهيم، المتنبّي), so that no Arab poet of the revolution is marked wrong.
- Distractors avoid alternatives that could be argued: «الزّهور» (بدل) has no نعت/عطف بيان/خبر distractor; «يجوبون القفار»
  (حال) no استئنافيّة; «باريس ويحك» (مجاز مرسل علاقته المكانيّة) no استعارة/تشبيه; «عشقوا المنيّة…» (تشبيه بليغ) no استعارة;
  the motives/aims of Part 3 no «إنسانيّة» distractor.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2015-lit-p1"
PAPER = 1
STREAMS = ["LIT"]
DOCX_ID = "1PNjmHWMx1Y55H9Q3E45KAsz2oizTfhun"
DOCX_TITLE = "بكالوريا العربية 2015 شعبة اداب وفلسفة.docx"
PDF_ID = "12jakgHnlIe1pLwv0D7kgZgSgaQPkjSbs"
OFFICIAL_ID = "1EgspKfRuGE8e_g4O3yYNfyCjeTPneqpi"
CORR_ID = "1-3T-LvPWNh7JBsmE2LZIBBdUugU82lbu"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    2: 'النّـــــص:  نظم الشاعر العراقي عبد الله الجبوري هذه القصيدة في 22/04/ 1959',
    3: 'الشرح اللغوي:   الغار: النّصر. الهامات: الرؤوس. حشاشات: ج حشاشة: بقيّة الرّوح في المريض.',
    4: 'لَثْمَ: من الفعل لَثَم أي قَبَّلَ.',
    6: 'أوّلا- البناء الفكري: (10 نقاط)',
    7: 'ما موضوع النص؟ وما غاية الشّاعر منه؟',
    8: 'خطاب السّخط والذّم بادٍ في القصيدة. دلّ عليه بأربعة ألفاظ من النص.',
    9: 'يبدو الشاعر واثقا من النّصر متفائلا به. أين يتجلّى ذلك في النّص؟ وما مصدر ثقته؟ علّل.',
    10: 'في النّص عاطفتان بارزتان متباينتان. ما هما؟',
    11: 'ما النَّمط الغالب على النّص؟ اذكر مؤشرين له مع التمثيل.',
    12: 'لخّص مضمون النّص بأسلوبك الخاص.',
    13: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    14: 'على من يعود ضمير الهاء في "ربوعها" في البيت الثالث، والتّاء في "أضعتِ" في البيت العاشر؟',
    15: 'عيّن المسند والمسند إليه في العبارة الآتية: " خُلِقَت قُلُوب بنيك".',
    16: 'أعرب كلمة "الوغى" في البيت الخامس، و "الزهور" في البيت الثاني عشر إعراب مفردات.',
    17: 'وأعرب إعراب جمل: (يريد) في البيت السّابع، و(يجوبون القفار) في البيت الحادي عشر.',
    18: 'إليك الصور البيانية التالية، اشرحها مبينا نوعها وسرّ بلاغتها:',
    19: '"يطوي الدجى".',
    20: '"عشِــقوا المنيَّة عِشقكم لثْمَ الخدودِ".',
    21: '"باريسُ" وَيْحَكِ...',
    22: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    23: 'من أكثر الثورات التي استرعت اهتمام الشعراء العرب ثورة التحرير الجزائريّة التي أدْمت قلوبهم وفجّرت قرائحهم، فنظموا فيها القصائد الممجّدة لقِيمها.',
    24: 'المطلوب:',
    25: '1- في أيّة نزعة تُدْرِج هذا الاهتمام؟',
    26: '2- ما هي دوافع شعراء هذه النزعة؟ وما غاياتهم؟',
    27: '3- اذكر أربعة شعراء عرب تغنّوا بالثورة الجزائريّة.',
}
# الجدول 0 في docx: صفوف [العجز، خليّة فارغة، «رقم- الصّدر»]
POEM_RAW = [
    ['والغــــار يلمـــع فــــوق هـــامـــاتِ الأســـــــودِ', '', '1- قـــد رَّف هــذا النصر خفاق البنـود'],
    ['يَطـــــــوي الدُّجـــــى وَيَهــــدُّ أركــــان القــــرودِ', '', '2-وغــــداً يُطــــل علـــــى الجــــــــزائر بـــــاسمًا'],
    ['والنُّـــــــور يطــــــوي ظلمــــــة اللــــيل العتيــــــدِ', '', '3-وغــــــــداً يســــيل الخُــــلد فـــــــوق ربوعهــــــا'],
    ['كَالأقــــــحوانَة فـــــي الـــــــــرُّبا أو كــالـــــــورودِ', '', '4-وإذا تـــــــعرّى الفـــــــجر أَســـــفَرَ بــــاسمـــــــا'],
    ['يــــا شـــــرَّ شَـــعْبٍ فـــــي حمــــاقات الوجــودِ', '', '5-خلُّــــــوا الدّيــــار لأهلـــها وذَرُوا الوغــى'],
    ['عشـــــقـــوا المــــــنية عِشــــقكم لثْمَ الخــــــــدودِ', '', '6-فالثَّــــأر زمْــــجر في حُشاشــــات الأُلَــى'],
    ['لا ينــــثني حتــــــى يحــــــقق مـــــــا(يريــــــدُ)', '', '7- جـــــيشٌ مـــن الحــــق المـــظفَّر عزمـــــه'],
    ['غــــير الجهــــــاد مُضــــــمَّخًا بـــدمِ الشهـــــيدِ', '', '8- فالــــــحـق يُـــــــدركُ بالجهــــــــاد وإن أرى'],
    ['مــــن ذِمَّــــةٍ فــــــي قلـــــب خــــائنة العـــــــهودِ', '', '9- \'باريس" وَيْـــحَكِ يــــا بَغـــيُّ وهــل نرى'],
    ['مـــــن كــــــل شـــــاردةٍ هنـــــــالك أو شــــــريدِ؟', '', '10-مـــــا ذَنـــب أيتــــامٍ أضــــعت حيــــــاتهم'],
    ['خلقت قلــوب بنيك من صلب الحــــديدِ؟', '', '11- فَمضوا (يَجُوبُون القِفار) فهل تَرى'],
    ['مـــمَّا جـــــنيت عــــواصف الحنق الشــــديدِ', '', '12-تـــــلك الزّهــورُ اليــــانعـــات أصــــابهــــا'],
    ['ويــــــعود هــــذا الشــــعب بالنـــصر الأكـــيدِ', '', '13-فسيُــــكفَّنُ الـــــوغد الدّخـــــيل بخِزيـــــــه'],
    ['يَجنُـــــونَ مـــــا زرعــــــوه مــــن ثـــمْرِ الحقـودِ', '', '14-لا بــــدَّ للبــــاغــــــــين مــــن يــــــــوم بـــــه'],
]
POEM = []
for _ajz, _empty, _sadr in POEM_RAW:
    _m = re.match(r"^(\d+)-\s*(.+)$", _sadr)
    assert _m and not _empty, _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 15)]
# تصويبات من الموضوع الرّسميّ (عيوب في docx؛ انظر التّوثيق أعلاه)
PATCHES = [(0, "رَّف", "رفَّ"), (8, "'باريس", '"باريس'), (12, "فسيُ", "سيُ")]
for _row, _old, _new in PATCHES:
    assert POEM[_row][1].count(_old) == 1, (_row, _old)
    POEM[_row][1] = POEM[_row][1].replace(_old, _new)

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2, P3 = PARAS[6], PARAS[13], PARAS[22]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[2]},
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": J(3, 4)},
]
CRIT_DOCS = DOCS + [{"id": "d-crit", "kind": "text", "caption": "السّند", "text": PARAS[23]}]


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


q("q1", "1", P1, J(7), 2, [el("q1-e1", "موضوع النّصّ", 1), el("q1-e2", "غاية الشّاعر منه", 1)])
q("q2", "2", P1, J(8), 1, [el("q2-e1", "أربعة ألفاظ دالّة على السّخط والذّمّ (4×0.25)", 1)])
q("q3", "3", P1, J(9), 1.5, [el("q3-e1", "أين يتجلّى تفاؤل الشّاعر", 0.5), el("q3-e2", "مصدر ثقته", 0.5), el("q3-e3", "التّعليل", 0.5)])
q("q4", "4", P1, J(10), 1, [el("q4-e1", "العاطفة الأولى", 0.5), el("q4-e2", "العاطفة الثّانية", 0.5)])
q("q5", "5", P1, J(11), 1.5, [el("q5-e1", "النّمط الغالب", 0.5), el("q5-e2", "مؤشّران مع التّمثيل (2×0.5)", 1)])
q("q6", "6", P1, J(12), 3, [el("q6-e1", "التّلخيص: الإيجاز", 1), el("q6-e2", "التّلخيص: المحافظة على المضمون", 1), el("q6-e3", "التّلخيص: سلامة اللّغة", 1)])
q("q7", "1", P2, J(14), 0.5, [el("q7-e1", "مرجع الهاء في «ربوعها»", 0.25), el("q7-e2", "مرجع التّاء في «أضعتِ»", 0.25)])
q("q8", "2", P2, J(15), 0.5, [el("q8-e1", "المسند", 0.25), el("q8-e2", "المسند إليه", 0.25)])
q("q9", "3", P2, J(16, 17), 2, [el("q9-e1", "إعراب «الوغى» (ب5)", 0.5), el("q9-e2", "إعراب «الزّهور» (ب12)", 0.5),
                                el("q9-e3", "محلّ جملة (يريد) (ب7)", 0.5), el("q9-e4", "محلّ جملة (يجوبون القفار) (ب11)", 0.5)])
q("q10", "4", P2, J(18, 19, 20, 21), 3, [el("q10-e1", "«يطوي الدّجى»: النّوع والشّرح وسرّ البلاغة", 1),
                                         el("q10-e2", "«عشقوا المنيّة عشقكم لثم الخدود»: النّوع والشّرح وسرّ البلاغة", 1),
                                         el("q10-e3", "«باريس ويحك»: النّوع والشّرح وسرّ البلاغة", 1)])
q("q11", "1", P3, J(24, 25), 1, [el("q11-e1", "النّزعة الّتي يُدرج فيها هذا الاهتمام", 1)], CRIT_DOCS)
q("q12", "2", P3, J(26), 2, [el("q12-e1", "دوافع شعراء هذه النّزعة (4×0.25)", 1), el("q12-e2", "غاياتهم (2×0.5)", 1)], CRIT_DOCS)
q("q13", "3", P3, J(27), 1, [el("q13-e1", "أربعة شعراء عرب تغنّوا بالثّورة الجزائريّة (4×0.25)", 1)], CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "الموضوع: هو الثّورة الجزائريّة. والغاية منه: المؤازرة والدّعم، والإشادة."
st("s01", "q1", "q1-e1", "mcq", "ما موضوع قصيدة عبد الله الجبوري؟",
   {"options": ["الثّورة الجزائريّة", "رثاء شهداء فلسطين", "وصف الطّبيعة الجزائريّة", "الحنين إلى العراق"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "multi", "ما غاية الشّاعر من قصيدته؟ (اختر كلّ ما يصحّ)",
   {"options": ["المؤازرة والدّعم", "الإشادة", "الدّعوة إلى الصّلح مع فرنسا", "التّسلية والإمتاع", "رثاء المستعمر"]},
   {"correct": [0, 1]}, Q1_EXPL, 0.5, "ar.comprehension.purpose")
st("s03", "q1", "q1-e2", "fill_blank", "أكمل غاية الشّاعر:",
   {"text": "الغاية منه: المؤازرة و____، و____.", "bank": ["الدّعم", "الإشادة", "العتاب", "الحياد"]},
   {"blanks": [["الدّعم"], ["الإشادة"]]}, Q1_EXPL, 0.5, "ar.comprehension.purpose", "b")
Q2_EXPL = "خطاب السّخط والذّمّ بادٍ في القصيدة يدلّ عليه: القرود، شرّ شعب، بغيّ، خائنة العهود، الوغد، الباغين، قلوب من صلب الحديد (يكفي أربعة ألفاظ)."
st("s04", "q2", "q2-e1", "multi", "اختر من الألفاظ ما يدلّ على خطاب السّخط والذّمّ في القصيدة. (اختر كلّ ما يصحّ)",
   {"options": ["القرود", "شرّ شعب", "بغيّ", "خائنة العهود", "الأسود", "الشّهيد"]},
   {"correct": [0, 1, 2, 3]}, Q2_EXPL + " أمّا «الأسود» و«الشّهيد» فمن ألفاظ الإشادة بالثّوّار.", 0.5, "ar.comprehension.evidence")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل من ألفاظ السّخط والذّمّ في القصيدة:",
   {"text": "سيُكفَّن ____ الدّخيل بخزيه — خُلقت ____ بنيك من صلب الحديد", "bank": ["الوغد", "قلوب", "الشّهيد", "عيون"]},
   {"blanks": [["الوغد"], ["قلوب"]]}, Q2_EXPL, 0.5, "ar.comprehension.evidence", "b")
Q3_EXPL = ("يبدو الشّاعر واثقًا من النّصر متفائلًا به وذلك في البيت الأوّل (رفّ هذا النّصر…)، والثّاني (غدا يطلّ على الجزائر باسما)، والثّالث (غدا يسيل الخلد). "
           "ومصدر ثقته يظهر في البيتين الثّالث عشر والرّابع عشر (سيكفّن الوغد… لا بدّ للباغين من يوم…)، لأنّ الحرّيّة تؤخذ ولا تعطى، وكلّ جهاد بعده لا محالة نصر محقّق.")
st("s06", "q3", "q3-e1", "mcq", "أين يتجلّى تفاؤل الشّاعر بالنّصر في النّصّ؟",
   {"options": ["في الأبيات الأوّل (رفّ هذا النّصر…) والثّاني (غدا يطلّ على الجزائر باسما) والثّالث (غدا يسيل الخلد)",
                "في البيتين التّاسع والعاشر («باريس» ويحك… ما ذنب أيتام…)", "في البيت الحادي عشر (فمضوا يجوبون القفار…)",
                "في البيت الثّاني عشر (تلك الزّهور اليانعات أصابها…)"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
st("s07", "q3", "q3-e2", "mcq", "في أيّ بيتين يظهر مصدر ثقة الشّاعر بالنّصر؟",
   {"options": ["الثّالث عشر والرّابع عشر (سيكفّن الوغد… لا بدّ للباغين من يوم…)", "التّاسع والعاشر («باريس» ويحك… ما ذنب أيتام…)",
                "الحادي عشر والثّاني عشر (فمضوا يجوبون القفار… تلك الزّهور…)", "الخامس والسّادس (خلّوا الدّيار… فالثّأر زمجر…)"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
st("s08", "q3", "q3-e3", "fill_blank", "أكمل التّعليل:",
   {"text": "لأنّ الحرّيّة ____ ولا ____، وكلّ جهاد بعده لا محالة نصر ____.", "bank": ["تؤخذ", "تعطى", "محقّق", "تُشترى", "مؤجّل"]},
   {"blanks": [["تؤخذ"], ["تعطى"], ["محقّق"]]}, Q3_EXPL, 0.5, "ar.comprehension.explain")
Q4_EXPL = ("العاطفتان البارزتان هما: الإعجاب والإشادة والاعتزاز والافتخار بالثّورة وأسودها؛ "
           "والاحتقار والسّخرية والسّخط والمقت لفرنسا الاستعماريّة وبنيها القساة الجبناء.")
st("s09", "q4", "q4-e1", "mcq", "ما العاطفة البارزة في النّصّ تجاه الثّورة وأسودها؟",
   {"options": ["الإعجاب والإشادة والاعتزاز والافتخار بالثّورة وأسودها", "الحزن واليأس من النّصر", "الحياد وعدم الاكتراث", "الخوف من بطش المستعمر"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.emotion")
st("s10", "q4", "q4-e2", "fill_blank", "أكمل العاطفة الثّانية البارزة في النّصّ:",
   {"text": "الاحتقار و____ والسّخط و____ لفرنسا الاستعماريّة وبنيها القساة ____.", "bank": ["السّخرية", "المقت", "الجبناء", "الإعجاب", "الشّجعان"]},
   {"blanks": [["السّخرية"], ["المقت"], ["الجبناء"]]}, Q4_EXPL, 0.5, "ar.comprehension.emotion")
st("s11", "q5", "q5-e1", "mcq", "ما النّمط الغالب على قصيدة عبد الله الجبوري؟",
   {"options": ["الوصفيّ", "السّرديّ", "التّفسيريّ", "الإيعازيّ"]},
   {"correct": 0}, "النّمط الغالب على النّصّ هو النّمط الوصفيّ.", 0.5, "ar.text.type")
Q5_EXPL = ("المؤشّران: كثرة النّعوت والإضافات والأحوال (العتيد، الأكيد، الشّديد)، كثرة الصّور (التّشبيه والاستعارة): كالورود، عشقوا المنيّة…، "
           "الأفعال الماضية والمضارعة: مضوا، يجوبون… (يمكن للمترشّح ذكر مؤشّرات أخرى).")
st("s12", "q5", "q5-e2", "matching", "طابق كلّ مؤشّر من مؤشّرات الوصف بأمثلته من القصيدة.",
   {"lefts": ["كثرة النّعوت والإضافات والأحوال", "كثرة الصّور (التّشبيه والاستعارة)", "الأفعال الماضية والمضارعة"],
    "rights": ["(العتيد، الأكيد، الشّديد)", "(كالورود، عشقوا المنيّة)", "(مضوا، يجوبون)", "(لأنّ، إذن، بما أنّ)"]},
   {"pairs": [0, 1, 2]}, Q5_EXPL, 0.5, "ar.text.type")
st("s13", "q5", "q5-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["كثرة النّعوت والإضافات والأحوال", "كثرة الصّور (التّشبيه والاستعارة)", "الأفعال الماضية والمضارعة", "الحوار بين الشّخصيّات",
                "أدوات التّعليل والاستنتاج"]},
   {"correct": [0, 1, 2]}, Q5_EXPL + " أمّا الحوار فمؤشّر حواريّ، وأدوات التّعليل والاستنتاج مؤشّر تفسيريّ/حجاجيّ.", 0.5, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ بأسلوب المترشّح", "text": "قصيدة عبد الله الجبوري في الثّورة الجزائريّة (بكالوريا 2015، آداب وفلسفة، الموضوع الأوّل)",
            "scheme": "تلخيص مضمون النّصّ: يراعى فيه الإيجاز / المحافظة على المضمون / سلامة اللّغة (3×1)"}
SUM_EXPL = "يراعى في تلخيص مضمون النّصّ: الإيجاز، المحافظة على المضمون، سلامة اللّغة (نقطة لكلّ معيار)."
for sid, eid, crit, ind in [("s14", "q6-e1", "الإيجاز", "الإيجاز"), ("s15", "q6-e2", "المحافظة على المضمون", "المحافظة على المضمون"),
                            ("s16", "q6-e3", "سلامة اللّغة", "سلامة اللّغة")]:
    essay(sid, "q6", eid, "تلخيص مضمون قصيدة عبد الله الجبوري", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
REF_EXPL = "الضّميران: ضمير الهاء في (ربوعها) يعود على الجزائر، والتّاء في (أضعتِ) تعود على باريس."
st("s17", "q7", "q7-e1", "mcq", "على مَن يعود ضمير الهاء في «ربوعها» (البيت الثّالث)؟",
   {"options": ["على الجزائر", "على فرنسا", "على الثّورة", "على الأمّة العربيّة"]},
   {"correct": 0}, REF_EXPL, 0.25, "ar.cohesion.reference")
st("s18", "q7", "q7-e2", "mcq", "على مَن تعود التّاء في «أضعتِ» (البيت العاشر)؟",
   {"options": ["على باريس", "على الجزائر", "على الأيتام", "على الثّورة"]},
   {"correct": 0}, REF_EXPL, 0.25, "ar.cohesion.reference")
NUC_EXPL = "في «خُلقت قلوب بنيك»: المسند: خُلق (الفعل)، المسند إليه: قلوب."
st("s19", "q8", "q8-e1", "mcq", "ما المسند في العبارة: «خُلِقَت قُلُوب بنيك»؟",
   {"options": ["خُلِقَت (الفعل)", "قلوب", "بنيك", "صلب الحديد"]},
   {"correct": 0}, NUC_EXPL, 0.25, "ar.grammar.rules")
st("s20", "q8", "q8-e2", "mcq", "ما المسند إليه في العبارة: «خُلِقَت قُلُوب بنيك»؟",
   {"options": ["قلوب", "خُلِقَت (الفعل)", "بنيك", "الحديد"]},
   {"correct": 0}, NUC_EXPL, 0.25, "ar.grammar.rules")
WAGHA = "«الوغى»: مفعول به منصوب وعلامة نصبه الفتحة المقدّرة على الألف المقصورة منع من ظهورها التّعذّر."
st("s21", "q9", "q9-e1", "mcq", "ما الوظيفة الإعرابيّة لكلمة «الوغى» في قوله: «وذَرُوا الوغى»؟",
   {"options": ["مفعول به منصوب", "فاعل مرفوع", "مضاف إليه مجرور", "حال منصوبة"]},
   {"correct": 0}, WAGHA, 0.25, "ar.grammar.irab")
st("s22", "q9", "q9-e1", "fill_blank", "أكمل علامة إعراب «الوغى»:",
   {"text": "الوغى: مفعول به منصوب وعلامة نصبه الفتحة ____ على الألف المقصورة منع من ظهورها ____.", "bank": ["المقدّرة", "التّعذّر", "الظّاهرة", "الثّقل"]},
   {"blanks": [["المقدّرة"], ["التّعذّر"]]}, WAGHA, 0.25, "ar.grammar.maqsur", "b")
st("s23", "q9", "q9-e2", "mcq", "ما إعراب «الزّهورُ» في قوله: «تلك الزّهورُ اليانعات أصابها»؟",
   {"options": ["بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مبتدأ مؤخّر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "نائب فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "«الزّهور»: بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.5, "ar.grammar.badal")
st("s24", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (يريد) في البيت السّابع: «حتّى يحقّق ما (يريدُ)»؟",
   {"options": ["جملة فعليّة صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب مفعول به", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "جملة (يريد): فعليّة صلة موصول («ما») لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s25", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (يجوبون القفار) في البيت الحادي عشر؟",
   {"options": ["جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "(يجوبون القفار): جملة فعليّة في محلّ نصب حال.", 0.5, "ar.grammar.sentence_case")
IMG1 = "«يطوي الدّجى»: استعارة مكنيّة شبّه فيها الدّجى بالثّوب الّذي يُطوى، حذف المشبّه به وأبقى على لازمة من لوازمه (يطوي). بلاغتها: توضيح وتوكيد المعنى ونقل المعنويّ في صورة المحسوس."
st("s26", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في «يطوي الدّجى»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن موصوف"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.metaphor")
st("s27", "q10", "q10-e1", "fill_blank", "اشرح الصّورة في «يطوي الدّجى»:",
   {"text": "شبّه الدّجى بـ____ الّذي يُطوى، حذف المشبّه به وأبقى على لازمة من لوازمه (____).", "bank": ["الثّوب", "يطوي", "النّهر", "يهدّ"]},
   {"blanks": [["الثّوب"], ["يطوي"]]}, IMG1, 0.5, "ar.rhetoric.metaphor", "b")
st("s28", "q10", "q10-e1", "mcq", "ما سرّ بلاغة الصّورة في «يطوي الدّجى»؟",
   {"options": ["توضيح المعنى وتوكيده ونقل المعنويّ في صورة المحسوس", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين المعنيين"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.effect", "c")
IMG2 = ("«عشقوا المنيّة عشقكم لثم الخدود»: تشبيه بليغ لأنّه شبّه عشق الثّوّار للمنيّة بعشق المستعمرين لتقبيل الخدود، فحذف أداة التّشبيه ووجه الشّبه. "
        "وبلاغتها: توضيح وتوكيد المعنى من خلال جعل المشبّه والمشبّه به صورة واحدة.")
st("s29", "q10", "q10-e2", "mcq", "ما نوع الصّورة البيانيّة في «عشقوا المنيّة عشقكم لثم الخدود»؟",
   {"options": ["تشبيه بليغ", "تشبيه مرسل مفصّل", "كناية عن صفة", "مجاز مرسل علاقته السّببيّة"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.simile")
st("s30", "q10", "q10-e2", "matching", "اشرح التّشبيه في «عشقوا المنيّة عشقكم لثم الخدود»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به", "المحذوف من أركان التّشبيه"],
    "rights": ["عشق الثّوّار للمنيّة", "عشق المستعمرين لتقبيل الخدود", "أداة التّشبيه ووجه الشّبه", "المنيّة وحدها"]},
   {"pairs": [0, 1, 2]}, IMG2, 0.5, "ar.rhetoric.simile", "b")
st("s31", "q10", "q10-e2", "mcq", "ما سرّ بلاغة التّشبيه في «عشقوا المنيّة عشقكم لثم الخدود»؟",
   {"options": ["توضيح المعنى وتوكيده من خلال جعل المشبّه والمشبّه به صورة واحدة", "تشخيص الجماد وبثّ الحياة فيه", "تقديم الحقيقة مصحوبة بدليلها",
                "إحداث جرس موسيقيّ في البيت"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.effect", "c")
IMG3 = "«باريس ويحك»: مجاز مرسل علاقته المكانيّة، لأنّه ذكر المكان «باريس» ويقصد المستعمر الفرنسيّ. بلاغتها: توضيح المعنى وتقريبه إلى الذّهن."
st("s32", "q10", "q10-e3", "mcq", 'ما نوع الصّورة البيانيّة في «"باريسُ" وَيْحَكِ…»؟',
   {"options": ["مجاز مرسل علاقته المكانيّة", "مجاز مرسل علاقته الجزئيّة", "مجاز مرسل علاقته الزّمانيّة", "كناية عن صفة"]},
   {"correct": 0}, IMG3, 0.25, "ar.rhetoric.metonymy")
st("s33", "q10", "q10-e3", "fill_blank", 'اشرح الصّورة في «"باريسُ" وَيْحَكِ…»:',
   {"text": "ذكر ____ «باريس» ويقصد ____ الفرنسيّ.", "bank": ["المكان", "المستعمر", "الزّمان", "النّهر"]},
   {"blanks": [["المكان"], ["المستعمر"]]}, IMG3, 0.5, "ar.rhetoric.metonymy", "b")
st("s34", "q10", "q10-e3", "mcq", 'ما سرّ بلاغة المجاز المرسل في «"باريسُ" وَيْحَكِ…»؟',
   {"options": ["توضيح المعنى وتقريبه إلى الذّهن", "المبالغة بادّعاء التّطابق بين طرفي التّشبيه", "تحسين العبارة بالجرس الموسيقيّ", "إظهار المعنى وتوكيده بذكر ضدّه"]},
   {"correct": 0}, IMG3, 0.25, "ar.rhetoric.effect", "c")
# ── ثالثًا: التّقويم النّقديّ ──
st("s35", "q11", "q11-e1", "mcq", "في أيّة نزعة يُدرج اهتمام الشّعراء العرب بالقضيّة الجزائريّة؟",
   {"options": ["النّزعة القوميّة", "النّزعة الذّاتيّة", "النّزعة الصّوفيّة", "النّزعة الرّومانسيّة الحالمة"]},
   {"correct": 0}, "يُدرج اهتمام الشّعراء العرب بالقضيّة الجزائريّة ضمن النّزعة القوميّة.", 1, "ar.literature.trend")
MOT_EXPL = ("دوافع الشّعراء: الاعتزاز بالثّورة – تقديس المبادئ والقيم الثّوريّة – اعتبار الجزائر جزءًا من الأمّة العربيّة – تقديس الحرّيّة – الإيمان بالقيم الإنسانيّة "
            "(أربعة منها). غاياتهم: الإشادة بالثّورة والدّعم والمساندة والمؤازرة، التّحفيز وبثّ الحماسة في النّفوس، والإعلام والتّعريف بالثّورة.")
st("s36", "q12", "q12-e1", "multi", "ما دوافع شعراء النّزعة القوميّة إلى التّغنّي بالثّورة الجزائريّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الاعتزاز بالثّورة", "تقديس المبادئ والقيم الثّوريّة", "اعتبار الجزائر جزءًا من الأمّة العربيّة", "تقديس الحرّيّة", "الإيمان بالقيم الإنسانيّة",
                "التّكسّب والتّقرّب من الحكّام", "الهروب من الواقع إلى الطّبيعة"]},
   {"correct": [0, 1, 2, 3, 4]}, MOT_EXPL, 1, "ar.literature.context")
st("s37", "q12", "q12-e2", "multi", "ما غايات شعراء هذه النّزعة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الإشادة بالثّورة", "الدّعم والمساندة والمؤازرة", "التّحفيز وبثّ الحماسة في النّفوس", "الإعلام والتّعريف بالثّورة", "التّشكيك في جدوى الثّورة", "مدح المستعمر"]},
   {"correct": [0, 1, 2, 3]}, MOT_EXPL, 0.5, "ar.literature.context")
st("s38", "q12", "q12-e2", "fill_blank", "أكمل من غايات شعراء هذه النّزعة:",
   {"text": "التّحفيز وبثّ ____ في النّفوس، والإعلام و____ بالثّورة.", "bank": ["الحماسة", "التّعريف", "اليأس", "التّشكيك"]},
   {"blanks": [["الحماسة"], ["التّعريف"]]}, MOT_EXPL, 0.5, "ar.literature.context", "b")
st("s39", "q13", "q13-e1", "multi", "اختر أربعة شعراء عرب تغنّوا بالثّورة الجزائريّة. (اختر كلّ ما يصحّ)",
   {"options": ["عبد الله الجبوري", "شفيق الكمالي", "سليمان العيسى", "محمود درويش", "أحمد شوقي", "حافظ إبراهيم", "المتنبّي"]},
   {"correct": [0, 1, 2, 3]}, "الشّعراء العرب: عبد الله الجبوري، شفيق الكمالي، سليمان العيسى، محمود درويش… (يمكن للمترشّح ذكر مجموعة أخرى من الشّعراء العرب). "
   "أمّا أحمد شوقي وحافظ إبراهيم والمتنبّي فلم يعاصروا الثّورة الجزائريّة (1954).", 1, "ar.literature.context")

TITLE = "بكالوريا 2015 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (عبد الله الجبوري: قصيدة في الثّورة الجزائريّة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2015، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّبت من الموضوع الرّسميّ ثلاثة عيوب في docx: «رَّف» ← «رفَّ» (ب1)، علامة التّنصيص «'باريس» ← «\"باريس» (ب9)، «فسيُكفّن» ← «سيُكفّن» (ب13، فاء زائدة تكسر الوزن). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "التّلخيص (س6) مؤجّل (essay_builder) بمعاييره الثّلاثة (3×1)؛ التّقويم النّقديّ أسئلة مباشرة فحُوِّل تفاعليًّا. "
         "في التّصحيح «مضوا، يجوبون، يعنون» و«يعنون» ليست في النّصّ فلم تُستعمل.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه في ثلاثة مواضع) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."

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
