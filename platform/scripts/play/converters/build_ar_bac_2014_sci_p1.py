"""Conversion: BAC 2014 (session عاديّة، جوان 2014) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (مفدي زكرياء، قصيدة في الثّورة الكبرى).
Exam (most faithful source): gdrive 1lGAfpKFy4ZVdzXngnmyrtpHc-7B-8tbM (بكالوريا العربية 2014 شعبة علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1xAT5vToLoQje95pekwqBdQAK_hYihFb4 (BAC 2014 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 14aB7wrDomnsoNMnnxTYlIhJSR4Ph-u59 (01_الموضوع.pdf, pages 1–2, image-only — rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1uU60n10RL2QFPGJoBt4kqpGQtQZtXGCF (02_التصحيح.pdf, page 1).

Method (as build_ar_bac_2015_lit_p1.py / build_ar_bac_2018_lit_p1.py): PARAS / POEM_RAW below were generated from the .docx
with python-docx (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed; the poem
table is read as rows [عجز, (empty), «n- صدر»] from the RTL 3-column layout, the verse number is split off the صدر cell)
and every verbatim string of the JSON was re-checked programmatically against the docx. The docx was compared verse by
verse and question by question with the official ONEC paper (rendered at 130–150 dpi). The correction PDF has no usable
text layer, so the mark scheme was read from the rendered page (150 dpi, fully legible). Every mark comes from the
official scheme; correct options and explanations condense its wording.

Docx defects fixed from the ONEC paper (applied after generation, see PATCHES / STRAY below):
- the cell of verse 8 carries, after two line breaks, a stray clipped copy of verse 9 «ِنّي رأيت الكون يَسْجُدْ خاشيفًا»
  (absent from the ONEC paper) ⇒ dropped;
- verse 7: «فَأَصبّحـــت» carries a stray shadda on the ب (ONEC: «فَأَصْبَحَتْ») ⇒ «فَأَصبحـــت».
Other docx/ONEC differences are labels or spelling: the ONEC paper has no verse numbers (the docx numbers the verses 1–11,
which the questions use: «البيت الثامن»، «البيت العاشر»، «البيت الأخير» = 11), «الشرح اللغوي» vs «شرح المفردات»,
«أوّلا-/ثانيا-» vs «أ-/ب-», «(12 نقاط)» vs «(12 نقطة)» — docx kept.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE
  (the docx title says «علوم تجريبية» only). This paper (2014) has two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items (more listed or accepted than required) ⇒ one
  element; exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1 «1.5» and Q2 «1.5»: one element each (one continuous model answer).
- Q3 «2×01» = the explanation of the resistance method in verse 8 (interactive) + the opinion «مبديا رأيك فيه» (deferred
  essay_builder, rule 11: the scheme's «أوافق الشّاعر في ذلك لأنّ…» is kept in the spec as the expected stance).
- Q4 «2×01» = the tendency (الوطنيّة التّحرّريّة) + the examples. Q5 «2×01» = two expressions among many («والعبارات الدّالّة
  على ذلك في النّصّ كثيرة») ⇒ one element of 2.
- Q6 (تلخيص) «3×01» = المحافظة على معاني الأبيات / اعتماد الأسلوب الخاصّ وسلامة اللّغة / الإيجاز ⇒ three deferred elements.
- Part 2 Q1: four 0.5 lines (السّياسة، خاشعا، ادّعى، أن يثور) ⇒ four elements. Q2 «3×0.5» one element per word.
  Q3 «0.5 + 2×0.5» = the type with its reason + exactly the two indicators the scheme lists ⇒ three elements.
  Q4 «3×0.5» = exactly three kinds of connectors (الضّمائر / حروف الجرّ والعطف / أدوات الشّرط) ⇒ three elements.
  Q5 «3×0.5» = the image («لا لن أبيح من الجزائر إصبعا») / its type (كناية عن صفة: عدم التّفريط في الوطن) / its effect.
- The scheme gives «التّشخيص والتّقوية» as the effect of the كناية; kept as the correct option. Distractors avoid what usage
  could accept: no «تقديم الحقيقة مصحوبة بالدّليل»/«الإيجاز» for the كناية effect, no «مبتدأ» for «السّياسة» (after إذا),
  no «مفعول به ثانٍ» for «خاشعا», no «أسماء الإشارة» distractor for the pronoun examples, no connector that occurs in the
  poem as a distractor of «حروف الجرّ والعطف», no «الوصفيّ» distractor for the type.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2014-sci-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1lGAfpKFy4ZVdzXngnmyrtpHc-7B-8tbM"
DOCX_TITLE = "بكالوريا العربية 2014 شعبة علوم تجريبية.docx"
PDF_ID = "1xAT5vToLoQje95pekwqBdQAK_hYihFb4"
OFFICIAL_ID = "14aB7wrDomnsoNMnnxTYlIhJSR4Ph-u59"
CORR_ID = "1uU60n10RL2QFPGJoBt4kqpGQtQZtXGCF"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    2: "النّـــــص:",
    3: "قال الشاعر مفدي زكرياء:",
    5: "الشرح اللغوي:      مِهْيَعا: سبيلا     - شِلْوًا: مفرد أشلاء     - مُمزّعا: ممزقا.",
    9: "أوّلا- البناء الفكري: (12 نقاط)",
    10: "كيف تجلّى الوطن للشاعر؟ وضّح ذلك.",
    11: "لماذا جمع الشاعر بين التضحية والاستقلال، وبين الحق والحرية؟",
    12: "في البيت الثامن إشارةٌ إلى أسلوب المقاومة. وضّحه مُبديا رأيك فيه.",
    13: "يعكس النصّ نزعة الشاعر. أبرزها مع التمثيل.",
    14: "يبدو الشاعر ملتزما بقضايا وطنه. أثبت ذلك بعبارتين من النص.",
    15: "لخص مضمون النص.",
    16: "ثانيا- البناء اللّغوي: (08 نقاط)",
    17: "أعرب ما يلي إعراب مفردات: \"السياسة\" في البيت الثامن و\"خاشعا\" في البيت التاسع.",
    18: "وأعرب ما يلي إعراب جُمل: \"ادَّعى\" في البيت الرابع و \"أن يثور\" في البيت الأخير.",
    19: "بِمَ توحي لك كل لفظة من هذه الألفاظ: \" مُتمنّعا - الذئاب - يقرعَا\"؟",
    20: "عيّن النمط السائد في هذا النص، واذكر مؤشرين له، مع التمثيل.",
    21: "هات من النصّ ثلاثة روابط مختلفة اعتمدها الشاعر في بناء نصّه، مع التمثيل.",
    22: "في البيت العاشر صورة بيانية، حددها وبين نوعها وأثرها في المعنى.",
}
# الجدول 0 في docx: صفوف [العجز، خليّة فارغة، «رقم- الصّدر»]
POEM_RAW = [
    ["فـــــي الثــــورة الكــــبرى فقــــــــال وأَسمعــــــــا", "", "1-هـــــذي خواطر شــــــــاعر، غنَّــــــى بــــــــها"],
    ["رغـــــــم البلاء عــــــن البـــــــــــلى مُتمنّـــــــــعا", "", "2-وطـــــنٌ يعُزّ على البقاء وما انقضـــــى"],
    ["متشــــــــــــامخـــــا مَهْمَا النَّكــــــــــال تنوَّعَــــــــا", "", "3-لـــــــم يَرْض يومـــا بالوثـــــــاق ولـــــم يَـــزل"],
    ["سخِرت بِمَنْ مسخ الحقائق و(ادعى)", "", "4-هــــــذي الجبــــال الشَّــــاهِقَات، شــــــــواهِد"],
    ["تــخـــذت لـــــه مهج الضَّحـــــايا مَصنعـــــا", "", "5-تــــــلك الجـــــــزائر تَصنـــــــــع استقلالـــــــها"],
    ["نَهْـــــــجَ المنــــــــــايَا، للسيـــــــــــــادة مِهْيَعــــــــــــا", "", "6-طاشت بها الطرقات، فاختصرت لَهَا"],
    ["شِلــــــــــــوًا، بأنيـــــــــــاب الذّئــــاب مُمـــــزَّعَـــــــا", "", "7- وامتصّـــــها المتزعمـــــــون، فَأَصبّحـــت"],
    ["للنـــــــار، كــــــانت خــــــــدعةً، وتصنعــــــــــا", "", "8- وإذا السيّــــــاسة، لم تفــــوض أمرهـــــا\n\nِنّي رأيت الكون يَسْجُدْ خاشيفًا"],
    ["للحـــــــــق والرشـــــــــــاش، إن نطقــــــا مَعـــــا", "", "9-إنّـــــــي رأيـــــــت الكـــون يَسْــــجُد خاشعـــا"],
    ["لا لـــــن أبــــــــيحَ مِن الجـــــــزائر إِصبــعــــا", "", "10- شعـــــب الجزائر، قال في استفتائــه"],
    ["فمضى، وَصمَّــــــم (أن يثور)، ويقرعــا", "", "11- واختـــــار يـــــــــــوم الاقتـــــراع نوفمبـــــــرا"],
]
# عيوب docx مصحَّحة من الموضوع الرّسميّ (انظر التّوثيق أعلاه)
STRAY = (7, "\n\nِنّي رأيت الكون يَسْجُدْ خاشيفًا")
assert POEM_RAW[STRAY[0]][2].endswith(STRAY[1])
POEM_RAW[STRAY[0]][2] = POEM_RAW[STRAY[0]][2][: -len(STRAY[1])]
POEM = []
for _ajz, _empty, _sadr in POEM_RAW:
    _m = re.match(r"^(\d+)-\s*(.+)$", _sadr)
    assert _m and not _empty and "\n" not in _sadr and "\n" not in _ajz, _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 12)]
PATCHES = [(6, "فَأَصبّحـــت", "فَأَصبحـــت")]
for _row, _old, _new in PATCHES:
    assert POEM[_row][1].count(_old) == 1, (_row, _old)
    POEM[_row][1] = POEM[_row][1].replace(_old, _new)
assert POEM[7][1].startswith("وإذا السيّ") and POEM[9][2].startswith("لا لـ") and "(أن يثور)" in POEM[10][2] and "(ادعى)" in POEM[3][2]

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2 = PARAS[9], PARAS[16]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا")
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": J(2, 3)},
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": PARAS[5]},
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


q("q1", "1", P1, J(10), 1.5, [el("q1-e1", "كيف تجلّى الوطن للشّاعر مع التّوضيح", 1.5)])
q("q2", "2", P1, J(11), 1.5, [el("q2-e1", "سبب الجمع بين التّضحية والاستقلال وبين الحقّ والحرّيّة", 1.5)])
q("q3", "3", P1, J(12), 2, [el("q3-e1", "توضيح أسلوب المقاومة في البيت الثّامن", 1), el("q3-e2", "إبداء الرّأي فيه", 1)])
q("q4", "4", P1, J(13), 2, [el("q4-e1", "نزعة الشّاعر", 1), el("q4-e2", "التّمثيل لها", 1)])
q("q5", "5", P1, J(14), 2, [el("q5-e1", "عبارتان تثبتان التزام الشّاعر (2×1)", 2)])
q("q6", "6", P1, J(15), 3, [el("q6-e1", "التّلخيص: المحافظة على معاني الأبيات", 1), el("q6-e2", "التّلخيص: الأسلوب الخاصّ وسلامة اللّغة", 1),
                            el("q6-e3", "التّلخيص: الإيجاز", 1)])
q("q7", "1", P2, J(17, 18), 2, [el("q7-e1", "إعراب «السّياسة» (ب8)", 0.5), el("q7-e2", "إعراب «خاشعا» (ب9)", 0.5),
                                el("q7-e3", "محلّ جملة «ادّعى» (ب4)", 0.5), el("q7-e4", "محلّ جملة «أن يثور» (ب11)", 0.5)])
q("q8", "2", P2, J(19), 1.5, [el("q8-e1", "إيحاء «متمنّعا»", 0.5), el("q8-e2", "إيحاء «الذّئاب»", 0.5), el("q8-e3", "إيحاء «يقرعا»", 0.5)])
q("q9", "3", P2, J(20), 1.5, [el("q9-e1", "النّمط السّائد مع تعليله", 0.5), el("q9-e2", "المؤشّر الأوّل مع التّمثيل", 0.5),
                              el("q9-e3", "المؤشّر الثّاني مع التّمثيل", 0.5)])
q("q10", "4", P2, J(21), 1.5, [el("q10-e1", "الرّابط الأوّل: الضّمائر مع التّمثيل", 0.5), el("q10-e2", "الرّابط الثّاني: حروف الجرّ والعطف مع التّمثيل", 0.5),
                               el("q10-e3", "الرّابط الثّالث: أدوات الشّرط مع التّمثيل", 0.5)])
q("q11", "5", P2, J(22), 1.5, [el("q11-e1", "تحديد الصّورة البيانيّة", 0.5), el("q11-e2", "نوعها", 0.5), el("q11-e3", "أثرها في المعنى", 0.5)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "تجلّى الوطن للشّاعر متمنّعًا عن الاحتلال رافضًا لقيوده، متشامخًا مهما لحقه من نكال…"
st("s01", "q1", "q1-e1", "mcq", "كيف تجلّى الوطن للشّاعر؟",
   {"options": ["متمنّعًا عن الاحتلال رافضًا لقيوده، متشامخًا مهما لحقه من نكال", "مستسلمًا للمحتلّ راضيًا بقيوده",
                "هادئًا ساكنًا لا يعنيه ما يجري حوله", "بعيدًا يحنّ إليه الشّاعر من منفاه"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "matching", "وضّح ذلك: طابق كلّ صفة من صفات الوطن بما يدلّ عليها من الأبيات.",
   {"lefts": ["التّمنّع عن الاحتلال", "رفض القيود", "التّشامخ مهما لحقه من نكال"],
    "rights": ["«وطنٌ يعزّ على البقاء وما انقضى، رغم البلاء عن البلى متمنّعا»", "«لم يرضَ يومًا بالوثاق»",
               "«ولم يزل متشامخًا مهما النّكال تنوّعا»", "«طاشت بها الطّرقات، فاختصرت لها»"]},
   {"pairs": [0, 1, 2]}, Q1_EXPL + " وذلك في البيتين الثّاني والثّالث: «متمنّعا»، «لم يرض يومًا بالوثاق»، «متشامخا مهما النّكال تنوّعا».",
   0.75, "ar.comprehension.evidence", "b")
Q2_EXPL = ("جمع الشّاعر بين التّضحية والاستقلال وبين الحقّ والحرّيّة؛ لأنّ كلّ واحد منهما يلازم الآخر، فالتّضحية ضروريّة لتحقيق الاستقلال، "
           "كما أنّ المطالبة بالحقوق أساس الحرّيّات.")
st("s03", "q2", "q2-e1", "mcq", "لماذا جمع الشّاعر بين التّضحية والاستقلال، وبين الحقّ والحرّيّة؟",
   {"options": ["لأنّ كلّ واحد منهما يلازم الآخر", "لأنّها ألفاظ متقاربة في جرسها يزيّن بها القصيدة",
                "لأنّ الاستقلال يتحقّق بالمفاوضات دون تضحية", "لأنّ الحرّيّة تُمنح للشّعوب دون مطالبة بالحقوق"]},
   {"correct": 0}, Q2_EXPL, 0.75, "ar.comprehension.link")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل التّعليل:",
   {"text": "فالتّضحية ____ لتحقيق الاستقلال، كما أنّ المطالبة بالحقوق ____ الحرّيّات.", "bank": ["ضروريّة", "أساس", "عائق", "نقيض"]},
   {"blanks": [["ضروريّة"], ["أساس"]]}, Q2_EXPL, 0.75, "ar.comprehension.link", "b")
st("s05", "q3", "q3-e1", "mcq", "إلامَ يشير البيت الثّامن «وإذا السّياسة، لم تفوّض أمرها للنّار، كانت خدعةً، وتصنّعا» في أسلوب المقاومة؟",
   {"options": ["إلى ضرورة اللّجوء إلى الكفاح المسلّح بدل المقاومة السّياسيّة", "إلى الاكتفاء بالنّضال السّياسيّ والمفاوضات",
                "إلى الهجرة واللّجوء إلى المنفى", "إلى الصّبر وانتظار رحيل المستعمر"]},
   {"correct": 0}, "يتمثّل أسلوب المقاومة عند الشّاعر في البيت 8 في ضرورة اللّجوء للكفاح المسلّح بدل المقاومة السّياسيّة.", 0.5, "ar.comprehension.explain")
st("s06", "q3", "q3-e1", "fill_blank", "أكمل توضيح أسلوب المقاومة في البيت الثّامن:",
   {"text": "يتمثّل أسلوب المقاومة عند الشّاعر في ضرورة اللّجوء للكفاح ____ بدل المقاومة ____.", "bank": ["المسلّح", "السّياسيّة", "الدّبلوماسيّ", "المسلّحة"]},
   {"blanks": [["المسلّح"], ["السّياسيّة"]]}, "«يتمثّل أسلوب المقاومة عند الشّاعر في البيت 8 في ضرورة اللّجوء للكفاح المسلّح بدل المقاومة السّياسيّة».", 0.5,
   "ar.comprehension.explain", "b")
OP_SPEC = {"task": "إبداء الرّأي في أسلوب المقاومة الّذي يشير إليه البيت الثّامن", "question": PARAS[12],
           "model": "الإجابة النّموذجيّة: «أوافق الشّاعر في ذلك لأنّ الكفاح السّياسيّ أثبت فشله وصار مجرّد خدع وحيل»."}
essay("s07", "q3", "q3-e2", "رأيك في أسلوب المقاومة في البيت الثّامن", "الرّأي والتّعليل", "رأي واضح معلَّل (المنتظَر: موافقة الشّاعر)", 1, OP_SPEC,
      "أوافق الشّاعر في ذلك لأنّ الكفاح السّياسيّ أثبت فشله وصار مجرّد خدع وحيل.", "ar.comprehension.opinion")
st("s08", "q4", "q4-e1", "mcq", "ما النّزعة الّتي يعكسها النّصّ؟",
   {"options": ["النّزعة الوطنيّة التّحرّريّة", "النّزعة الذّاتيّة الوجدانيّة", "النّزعة الصّوفيّة", "نزعة الهروب إلى الطّبيعة"]},
   {"correct": 0}, "يعكس النّصّ نزعة الشّاعر الوطنيّة التّحرّريّة.", 1, "ar.literature.trend")
st("s09", "q4", "q4-e2", "fill_blank", "أكمل العبارات الدّالّة على هذه النّزعة:",
   {"text": "«وطنٌ يعزّ على ____» – «تلك الجزائر تصنع ____» – «أن يثور و____»", "bank": ["البقاء", "استقلالها", "يقرعا", "الفناء", "أمجادها", "يركعا"]},
   {"blanks": [["البقاء"], ["استقلالها"], ["يقرعا"]]}, "ومن العبارات الدّالّة عليها: (وطن يعزّ على البقاء – تلك الجزائر تصنع استقلالها – أن يثور ويقرعا…).", 1,
   "ar.comprehension.evidence")
Q5_EXPL = "الشّاعر ملتزم بقضايا وطنه، والعبارات الدّالّة على ذلك في النّصّ كثيرة، منها: (هذي خواطر شاعر غنّى بها – لا لن أبيح من الجزائر إصبعا…)."
st("s10", "q5", "q5-e1", "mcq", "ما الّذي يثبته قول الشّاعر: «هذي خواطر شاعر، غنّى بها في الثّورة الكبرى فقال وأسمعا»؟",
   {"options": ["التزام الشّاعر بقضايا وطنه", "انصراف الشّاعر عن قضايا وطنه إلى همومه الذّاتيّة", "حياد الشّاعر تجاه الثّورة", "إعراض الشّاعر عن الشّعر إلى السّياسة"]},
   {"correct": 0}, Q5_EXPL, 1, "ar.comprehension.evidence")
st("s11", "q5", "q5-e1", "fill_blank", "أكمل عبارة أخرى تثبت التزام الشّاعر بقضايا وطنه (ب10):",
   {"text": "«لا لن ____ من الجزائر ____»", "bank": ["أبيح", "إصبعا", "أترك", "شبرا"]},
   {"blanks": [["أبيح"], ["إصبعا"]]}, Q5_EXPL, 1, "ar.comprehension.evidence", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "قصيدة مفدي زكرياء (بكالوريا 2014، الشّعب العلميّة، الموضوع الأوّل)", "model_example": None}
SUM_EXPL = "تلخيص مضمون النّصّ: يراعي فيه المترشّح المحافظة على معاني الأبيات، اعتماد الأسلوب الخاصّ وسلامة اللّغة، الإيجاز (3×1). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for i, (crit, ind) in enumerate([("المضمون", "المحافظة على معاني الأبيات"), ("الأسلوب واللّغة", "اعتماد الأسلوب الخاصّ وسلامة اللّغة"), ("الإيجاز", "الإيجاز")]):
    essay(f"s{12 + i}", "q6", f"q6-e{i + 1}", "تلخيص مضمون قصيدة مفدي زكرياء", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s15", "q7", "q7-e1", "mcq", "ما إعراب «السّياسة» في قوله: «وإذا السّياسةُ، لم تفوّض أمرها» (ب8)؟",
   {"options": ["فاعل لفعل محذوف يفسّره الفعل الّذي يليه مرفوع وعلامة رفعه الضّمّة الظّاهرة",
                "مفعول به لفعل محذوف يفسّره الفعل الّذي يليه منصوب وعلامة نصبه الفتحة الظّاهرة",
                "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة", "خبر لمبتدأ محذوف مرفوع وعلامة رفعه الضّمّة الظّاهرة"]},
   {"correct": 0}, "السّياسة: فاعل لفعل محذوف يفسّره الفعل الّذي يليه مرفوع وعلامة رفعه الضّمّة الظّاهرة.", 0.5, "ar.grammar.irab")
st("s16", "q7", "q7-e2", "mcq", "ما إعراب «خاشعا» في قوله: «إنّي رأيت الكون يسجد خاشعا» (ب9)؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة", "نعت منصوب وعلامة نصبه الفتحة الظّاهرة", "تمييز منصوب وعلامة نصبه الفتحة الظّاهرة",
                "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة"]},
   {"correct": 0}, "خاشعا: حال منصوبة وعلامة نصبها الفتحة الظّاهرة.", 0.5, "ar.grammar.irab")
st("s17", "q7", "q7-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «ادّعى» في قوله: «سخرت بمَن مسخ الحقائق و(ادّعى)» (ب4)؟",
   {"options": ["جملة فعليّة معطوفة على صلة الموصول، لا محلّ لها من الإعراب", "جملة فعليّة معطوفة في محلّ جرّ", "جملة فعليّة في محلّ نصب حال",
                "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(ادّعى): جملة فعليّة معطوفة على صلة الموصول، لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s18", "q7", "q7-e4", "fill_blank", "أكمل المحلّ الإعرابيّ لجملة «أن يثور» في قوله: «وصمّم (أن يثور)» (ب11):",
   {"text": "(أن يثور): جملة ____ في محلّ ____ مفعول به.", "bank": ["مصدريّة", "نصب", "استئنافيّة", "جرّ", "رفع"]},
   {"blanks": [["مصدريّة"], ["نصب"]]}, "(أن يثور): جملة مصدريّة في محلّ نصب مفعول به.", 0.5, "ar.grammar.sentence_case")
st("s19", "q8", "q8-e1", "mcq", "بمَ توحي لفظة «متمنّعا»؟",
   {"options": ["بالرّفض والصّمود", "بالضّعف والاستسلام", "باليأس والقنوط", "بالفرح والابتهاج"]},
   {"correct": 0}, "متمنّعا: توحي بالرّفض والصّمود.", 0.5, "ar.comprehension.explain")
st("s20", "q8", "q8-e2", "mcq", "بمَ توحي لفظة «الذّئاب» في قوله: «شلوًا، بأنياب الذّئاب ممزّعا»؟",
   {"options": ["بالمكر والخديعة والسّطو", "بالوفاء والإخلاص", "بالبراءة والضّعف", "بالحكمة والتّعقّل"]},
   {"correct": 0}, "الذّئاب: توحي بالمكر والخديعة والسّطو.", 0.5, "ar.comprehension.explain")
st("s21", "q8", "q8-e3", "fill_blank", "أكمل إيحاء لفظة «يقرعا» في قوله: «فمضى، وصمّم (أن يثور)، ويقرعا»:",
   {"text": "يقرع: توحي بإعلان ____، والمطالبة بالحقّ ____.", "bank": ["الحرب", "المسلوب", "الهدنة", "الزّائف"]},
   {"blanks": [["الحرب"], ["المسلوب"]]}, "يقرع: توحي بإعلان الحرب، والمطالبة بالحقّ المسلوب.", 0.5, "ar.comprehension.explain")
TYPE_EXPL = ("نمط النّصّ سرديّ لأنّ الشّاعر في مقام سرد مرحلة تاريخيّة من مراحل مقاومة الشّعب الجزائريّ للاستعمار الفرنسيّ. مؤشّراه مع التّمثيل: "
             "التّرتيب الزّمنيّ للأحداث (نضال سياسيّ، ثمّ كفاح مسلّح)؛ الأفعال الماضية، والمضارعة الدّالّة على الماضي مثل: (انقضى، لم يرض، سخرت).")
st("s22", "q9", "q9-e1", "mcq", "ما النّمط السّائد في هذا النّصّ، ولماذا؟",
   {"options": ["سرديّ، لأنّ الشّاعر في مقام سرد مرحلة تاريخيّة من مراحل مقاومة الشّعب الجزائريّ للاستعمار الفرنسيّ",
                "حجاجيّ، لأنّ الشّاعر يعرض الحجج والبراهين لإقناع المستعمر", "تفسيريّ، لأنّ الشّاعر يشرح ظاهرة علميّة",
                "حواريّ، لأنّ النّصّ قائم على تبادل الكلام بين شخصيّتين"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s23", "q9", "q9-e2", "mcq", "أيّ ممّا يلي مؤشّر من مؤشّرات النّمط السّرديّ في النّصّ؟",
   {"options": ["التّرتيب الزّمنيّ للأحداث (نضال سياسيّ، ثمّ كفاح مسلّح)", "كثرة الحجج والبراهين وأدوات التّعليل",
                "كثرة النّعوت والصّفات الّتي ترسم المكان", "توظيف المصطلحات العلميّة والتّعريفات"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s24", "q9", "q9-e3", "fill_blank", "أكمل المؤشّر الثّاني مع التّمثيل:",
   {"text": "الأفعال ____، والمضارعة الدّالّة على ____، مثل: (انقضى، لم يرضَ، سخرت).", "bank": ["الماضية", "الماضي", "الطّلبيّة", "المستقبل"]},
   {"blanks": [["الماضية"], ["الماضي"]]}, TYPE_EXPL, 0.5, "ar.text.type")
LINK_EXPL = ("الرّوابط الّتي اعتمدها الشّاعر في بناء نصّه: الضّمائر بأنواعها، ومنها ضمير الغائب «هو» في قوله: (ما انقضى، لم يرض لم يزل) "
             "وضمير الغائب «هي» في قوله: (استقلالها، تصنع، أصبحت…)؛ حروف الجرّ والعطف مثل: (على، من، في، الواو…)؛ أدوات الشّرط: (إذا السّياسة، إن نطقا).")
st("s25", "q10", "q10-e1", "mcq", "ما نوع الرّابط في قوله: (ما انقضى، لم يرض، لم يزل) و(استقلالها، تصنع، أصبحت)؟",
   {"options": ["الضّمائر: ضمير الغائب «هو» وضمير الغائب «هي»", "أدوات الشّرط", "حروف العطف", "حروف الجرّ"]},
   {"correct": 0}, LINK_EXPL, 0.5, "ar.cohesion.reference")
st("s26", "q10", "q10-e2", "multi", "أيّ ممّا يلي من حروف الجرّ والعطف الّتي اعتمدها الشّاعر رابطًا في نصّه؟ (اختر كلّ ما يصحّ)",
   {"options": ["على", "من", "في", "الواو", "ثمّ", "حتّى", "أو"]},
   {"correct": [0, 1, 2, 3]}, LINK_EXPL + " أمّا «ثمّ» و«حتّى» و«أو» فلا ترد في الأبيات.", 0.5, "ar.cohesion.connectors")
st("s27", "q10", "q10-e3", "fill_blank", "أكمل أدوات الشّرط الّتي ربط بها الشّاعر:",
   {"text": "(____ السّياسة، لم تفوّض أمرها…)، (____ نطقا معا)", "bank": ["إذا", "إنْ", "لو", "متى"]},
   {"blanks": [["إذا"], ["إنْ", "إن"]]}, LINK_EXPL, 0.5, "ar.cohesion.connectors")
IMG_EXPL = "تحديد الصّورة البيانيّة: (لن أبيح من الجزائر إصبعا). نوعها: كناية عن صفة، هي عدم التّفريط في الوطن. وأثرها: التّشخيص والتّقوية…"
st("s28", "q11", "q11-e1", "mcq", "ما الصّورة البيانيّة الواردة في البيت العاشر؟",
   {"options": ["«لا لن أبيح من الجزائر إصبعا»", "«هذي الجبال الشّاهقات، شواهد»", "«تخذت له مهج الضّحايا مصنعا»", "«وامتصّها المتزعّمون»"]},
   {"correct": 0}, IMG_EXPL + " أمّا العبارات الأخرى فمن أبيات أخرى (4، 5، 7).", 0.5, "ar.rhetoric.metonymy")
st("s29", "q11", "q11-e2", "mcq", "ما نوع الصّورة في «لا لن أبيح من الجزائر إصبعا»؟",
   {"options": ["كناية عن صفة، هي عدم التّفريط في الوطن", "كناية عن موصوف، هو الوطن", "استعارة مكنيّة", "تشبيه بليغ"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s30", "q11", "q11-e3", "mcq", "ما أثر هذه الصّورة في المعنى حسب الإجابة النّموذجيّة؟",
   {"options": ["التّشخيص والتّقوية", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين معنيين", "تحسين اللّفظ بالسّجع"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")

TITLE = "بكالوريا 2014 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (مفدي زكرياء: هذي خواطر شاعر)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2014، الشّعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: "
         f"gdrive:{PDF_ID}. عيبان في docx صُحّحا من الموضوع الرّسميّ: سطر زائد مبتور في خليّة البيت 8 «ِنّي رأيت الكون يَسْجُدْ خاشيفًا» حُذف، وشدّة زائدة في «فَأَصبّحـــت» (ب7) حُذفت. "
         "ترقيم الأبيات من docx (لا ترقيم في الموضوع الرّسميّ). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1، قُرئت مصوّرة). "
         "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. مؤجَّل (essay_builder): إبداء الرّأي في س3 (1؛ المنتظر موافقة الشّاعر) والتّلخيص س6 (3×1).")
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
