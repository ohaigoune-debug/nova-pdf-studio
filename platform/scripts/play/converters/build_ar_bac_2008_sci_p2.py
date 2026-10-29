"""Conversion: BAC 2008 (session عاديّة، جوان 2008) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (محمّد البشير الإبراهيميّ، «هذا المعهد أمانة»).
Exam (most faithful source): gdrive 1jiQFft2dvpdd8TK-BrBcblmvPQQm3a3G (اختبار اللغة العربية 2008 علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1B_-mczZ_WMrv2bHifGWm4xQkxU9U1FyT (BAC 2008 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1gwKbg3oZbrFX6Nf46jkpatkMFPfKDRiV (01_الموضوع.pdf, pages 2–3, image-only scan at 96 ppi);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1kOohNk66gvjOX6_V7YKIeWy-YtLT0zeQ (02_التصحيح.pdf, page 2).

Method (as build_ar_bac_2008_sci_p1.py): PARAS below were generated from the .docx with python-docx and spliced into this
file by script (paragraph text read exactly; only outer whitespace and outer direction marks trimmed); every verbatim string
of the JSON is built from PARAS and was re-checked programmatically against the docx. The docx was compared line by line
with the ONEC paper (page images enlarged ×2–×6): same introduction, same six paragraphs, same questions, same underlines
(«أمانة» in paragraph 1, «جميعًا» in paragraph 2 — «نتعاون جميعًا») and the bracketed sentence «(إنك لا تنهضِين)». No
word-level defect found: differences are diacritics / spelling / labels only (docx kept, e.g. «سِتُّمائة» vs ONEC «ستّمائة»,
«(12 نقاط)» vs «(12 نقطة)», «أوّلا-/ثانيا-» vs «ـ البناء الفكريّ»). The correction PDF has no text layer; the scheme was
read from its page image (enlarged ×2–×8). Every mark comes from the official scheme; correct options and explanations
condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper «علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد»; correction «ع.تج، تس.اق، ريا، تقني.ريا» ⇒ SCI,
  MATH, TM, GE. Two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×01» = topic / aim. Q2 «2×01» = where the blame and the acquittal appear in the text (interactive) + «فهل توافقه على
  ما قدّم من حجج» (the candidate's opinion ⇒ deferred essay_builder, rule 11; the scheme's «أوافق الكاتب على ما ذهب إليه»
  is kept in the spec as the expected stance). Q3 «2×01» = the passage showing optimism / its link to taking the means (العلم).
  Q4 «2×01» = the concept of the authentic renaissance (interactive) + «رأي المترشّح يكون مدعومًا بالحجج» (deferred).
  Q5 (تلخيص) «2×02» = دلالة المضمون / سلامة اللّغة ⇒ two deferred elements.
- Part 2 Q1 «2×01» = the function of واو (العطف للرّبط بين الجمل والكلمات) / the reason (مطلق الجمع دون ترتيب أو اختيار).
  Q2 «3×0,5» for the six forms laid out in three columns (هو/هي، هما/هما، هم/هنّ) ⇒ one element per column.
  !! The scheme prints the feminine dual «هما أدّيتا»; the regular form is «أدّتا» (أدّى ← أدّت ← أدّتا). The step of the
  dual element therefore asks only for the masculine dual «أدّيا» (as printed) and the explanation flags the misprint — owner
  to confirm. Q3: «01» each for «أمانة», «جميعًا», «(إنّك لا تنهضين)». Q4 «3×0,5» = explanation / type / effect.
- Distractors avoid what the scheme or usage could accept: no «توكيد/تمييز» for «جميعًا», no «حال/استئناف» for the واو, no
  «تعقيب» in the واو bank, no form «أدّتا» anywhere.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2008-sci-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1jiQFft2dvpdd8TK-BrBcblmvPQQm3a3G"
DOCX_TITLE = "اختبار اللغة العربية 2008 علوم تجريبية.docx"
PDF_ID = "1B_-mczZ_WMrv2bHifGWm4xQkxU9U1FyT"
OFFICIAL_ID = "1gwKbg3oZbrFX6Nf46jkpatkMFPfKDRiV"
CORR_ID = "1kOohNk66gvjOX6_V7YKIeWy-YtLT0zeQ"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    20: "الموضوع الثاني",
    21: "النّص:",
    22: "يقول محمد البشير الإبراهيمي عند افتتاح معهد عبد الحميد بن باديس:",
    23: "«هذا المعهد أمانة بيننا وبينك – أيتها الأمة – وعهد العروبة والإسلام في عنقنا وعنقك، وواجب العلم علينا وعليك، وحق الأجيال الزاحفة إلى الحياة من أبنائنا جميعا؛ فأيُّنا قام بحظه من الأمانة، ووفى بقسطه من العهد، وأدى ما عليه من الواجب، واستبرأ من الحق؟",
    24: "لا منة لنا ولا لك على الله ودينه وما عظم من حرمات العلم، وما أوجب من رعاية الأبناء، وإنما علينا أن نتعاون جميعًا، كل بما قسم الله له؛ وقد اقتسمنا الخطتين، فقمنا وقعدت، واجتهدنا وقصرت؛ فقمنا بقسطنا من الواجب حق القيام، فدعونا ما وسعت الدعاية، وبينَّا ما وسع البيان، وعلَّمنا ما أمكن التعليم، ونظَّمنا إلى حيث تبلغ غاية التنظيم، ووعدنا فأنجزنا الوعد، وأخذنا الأمر بقوة، لأن زمنك قوي لا يرضى بصحبة الضعفاء.",
    25: "نحن إنما نبني لك، ونُفصّل على مقدارك، ونُرشدك إلى ما يجب أن تكوني عليه لتستبدلي حالة بحالةٍ ولبُوسا بِلبُوس.",
    26: "عصرك عصر نهوض ومن لم يُجار فيه النَّاهضين، كان من الهالكين؛ وقد بدت عليكِ مخايل النهوض، وقد قال الناس: قد نهضتِ، فحق القول، ولم يبق للنّكوص مجال، وما عن الهوى نَطقنا، ولا عن غِشّ صدرنا، حين قلنا لك: (إنك لا تنهضِين) إلاّ بالعلم، وإنَّ نهضة لا يكون أساسها العلم هي بناءٌ بلا أساس ولا دعامة.",
    27: "إنَّ النّهضات الأصيلة لا تعرفُ القناعة، ولا تدينُ بها، ولا ترضى بالتَّقلُّلِ والتَّبلُّغِ، وإنَّما هي القوة والفوران، والتأجُّج والجيشان، والبناء الرُّم، والأكل اللّم، وصَدْم ثابتٍ بسيَّارٍ، ودفع تيَّارٍ بتيَّار.",
    28: "إنّ قليلاً للنَّهضة – في بَابِ العلم – معهدٌ يضمُّ سِتُّمائة تلميذ في أمةٍ تُعدُّ بعشرة ملايين تسعة أعشارها ونصف عشرها أمّيُّون.»",
    29: "محمد البشير الإبراهيمي / عيون البصائر.",
    33: "الأسئلة:",
    34: "أوّلا- البناء الفكري: (12 نقاط)",
    35: "ما الموضوع الذي عالجه الكاتب في هذا النص، وما هدفه؟",
    36: "حَمَّل الكاتب التقصير للأمة، وبرَّأ القائمين على التعليم منه، فهل توافقه على ما قدم من حجج، وأين يظهر ذلك في النص؟",
    37: "يبدو الكاتب متفائلاً من نهضة الأمة، أين يظهر ذلك في النَّص؟",
    38: "ما المفهوم الذي حدده للنهضة الأصيلة، وما رأيك فيه؟",
    39: "لخّص النَّص.",
    40: "ثانيا- البناء اللّغوي: (08 نقاط)",
    41: "وظف الكاتب حرف الواو كثيرًا في الفقرة الأولى من النَّص، ما الـمُسوِّغ لهذا التوظيف؟",
    42: "صرّف الفعل \"أدَّى\" في الماضي مع ضمائر الغائبين.",
    43: "أعرب ما تحته خط إعراب مفردات، وما بين قوسين إعراب جمل.",
    44: "في العبارة الآتية صورة بيانية، اشرحها، وبين نوعها، وأثرها البلاغي: \"إن النّهضات الأصيلة لا تعرف القناعة\".",
}

P1, P2 = PARAS[34], PARAS[40]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and PARAS[22].startswith("يقول محمد البشير")
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[22]},
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(PARAS[i] for i in range(23, 29))},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[29]},
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


q("q1", "1", P1, PARAS[35], 2, [el("q1-e1", "الموضوع الّذي عالجه الكاتب", 1), el("q1-e2", "هدفه", 1)])
q("q2", "2", P1, PARAS[36], 2, [el("q2-e1", "تحميل التّقصير للأمّة وتبرئة القائمين على التّعليم ومواضع ذلك في النّصّ", 1),
                               el("q2-e2", "الموافقة على حجج الكاتب (رأي المترشّح)", 1)])
q("q3", "3", P1, PARAS[37], 2, [el("q3-e1", "مواضع تفاؤل الكاتب في النّصّ", 1), el("q3-e2", "ارتباط التّفاؤل بالأخذ بالأسباب", 1)])
q("q4", "4", P1, PARAS[38], 2, [el("q4-e1", "مفهوم النّهضة الأصيلة", 1), el("q4-e2", "الرّأي فيه", 1)])
q("q5", "5", P1, PARAS[39], 4, [el("q5-e1", "التّلخيص: دلالة المضمون", 2), el("q5-e2", "التّلخيص: سلامة اللّغة", 2)])
q("q6", "1", P2, PARAS[41], 2, [el("q6-e1", "وظيفة حرف الواو في الفقرة الأولى", 1), el("q6-e2", "مسوّغ كثرة توظيفه", 1)])
q("q7", "2", P2, PARAS[42], 1.5, [el("q7-e1", "المفرد: هو / هي", 0.5), el("q7-e2", "المثنّى: هما", 0.5), el("q7-e3", "الجمع: هم / هنّ", 0.5)])
q("q8", "3", P2, PARAS[43], 3, [el("q8-e1", "إعراب «أمانة»", 1), el("q8-e2", "إعراب «جميعًا»", 1), el("q8-e3", "محلّ جملة (إنّك لا تنهضين)", 1)])
q("q9", "4", P2, PARAS[44], 1.5, [el("q9-e1", "شرح الصّورة", 0.5), el("q9-e2", "نوعها", 0.5), el("q9-e3", "أثرها البلاغيّ", 0.5)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("الموضوع الّذي عالجه الكاتب في هذا النّصّ هو: ضرورة النّهوض بالأمّة بالاعتماد على العلم، وتعاون الجميع، في زمن التّدافع والتّنافس. "
           "والهدف منه يتمثّل في الدّعوة إلى إصلاح وضع الأمّة، والرّفع من شأنها.")
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي عالجه الكاتب في هذا النّصّ؟",
   {"options": ["ضرورة النّهوض بالأمّة بالاعتماد على العلم وتعاون الجميع في زمن التّدافع والتّنافس", "تاريخ تأسيس معهد عبد الحميد بن باديس ومراحل بنائه",
                "الدّعوة إلى الهجرة لطلب العلم في البلاد المتقدّمة", "وصف حياة التّلاميذ داخل المعهد"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل: وما هدفه؟",
   {"text": "يتمثّل هدفه في الدّعوة إلى ____ وضع الأمّة، و____ من شأنها.", "bank": ["إصلاح", "الرّفع", "تجميد", "الحطّ"]},
   {"blanks": [["إصلاح"], ["الرّفع"]]}, Q1_EXPL, 1, "ar.comprehension.purpose")
Q2_EXPL = ("حمّل الكاتب التّقصير للأمّة بتقصير بعض أفرادها، وبرّأ القائمين على التّعليم – وهو منهم – لأنّهم بذلوا مجهودًا لا يُنكر في نشر العلم، "
           "وبناء المدارس، والدّعوة إلى النّهوض بالأمّة. ويظهر ذلك في قوله في الفقرة الثّانية من النّصّ: «فقمنا وقعدتِ، واجتهدنا وقصّرتِ، فقمنا "
           "بقسطنا من الواجب حقّ القيام…».")
st("s03", "q2", "q2-e1", "mcq", "لماذا برّأ الكاتب القائمين على التّعليم من التّقصير؟",
   {"options": ["لأنّهم بذلوا مجهودًا لا يُنكر في نشر العلم وبناء المدارس والدّعوة إلى النّهوض بالأمّة", "لأنّهم لم يتولّوا التّعليم إلاّ منذ زمن قصير",
                "لأنّ الأمّة لم تطلب منهم شيئًا", "لأنّ الاستعمار منعهم من كلّ عمل"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s04", "q2", "q2-e1", "multi", "أين يظهر ذلك في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["«فقمنا وقعدتِ»", "«واجتهدنا وقصّرتِ»", "«فقمنا بقسطنا من الواجب حقّ القيام»", "«عصرك عصر نهوض»",
                "«إنّ النّهضات الأصيلة لا تعرف القناعة»", "«هذا المعهد أمانة بيننا وبينك»"]},
   {"correct": [0, 1, 2]}, Q2_EXPL, 0.5, "ar.comprehension.evidence", "b")
essay("s05", "q2", "q2-e2", "حجج الإبراهيميّ في تحميل الأمّة التّقصير وتبرئة القائمين على التّعليم", "إبداء الرّأي",
      "يبدي المترشّح موقفه من حجج الكاتب (موافقة أو غيرها) مع التّعليل", 1,
      {"task": "إبداء الرّأي في حجج الكاتب", "question": PARAS[36],
       "scheme": "«ونظرًا لقوّة هذه الحجج المدعومة بالأمثلة، ومنها بناء المدارس والمعاهد بالإضافة إلى العمل الدّعويّ أوافق الكاتب على ما ذهب إليه» (2×01: المواضع + الرّأي)",
       "model_example": "أوافق الكاتب على ما ذهب إليه نظرًا لقوّة حججه المدعومة بالأمثلة (بناء المدارس والمعاهد، العمل الدّعويّ)."},
      Q2_EXPL + " الرّأي في الإجابة النّموذجيّة: «ونظرًا لقوّة هذه الحجج المدعومة بالأمثلة… أوافق الكاتب على ما ذهب إليه».", "ar.comprehension.opinion")
Q3_EXPL = ("يبدو الكاتب متفائلًا من نهضة الأمّة، ويظهر ذلك في قوله: «وقد بدت عليك مخايل النّهوض، فحقّ القول، ولم يبقَ للنّكوص مجال». "
           "وتفاؤله مرتبط بضرورة الأخذ بالأسباب، فلا نهضة إلاّ بالعلم.")
st("s06", "q3", "q3-e1", "multi", "أين يظهر تفاؤل الكاتب من نهضة الأمّة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["«وقد بدت عليكِ مخايل النّهوض»", "«فحقّ القول»", "«ولم يبقَ للنّكوص مجال»", "«لا منّة لنا ولا لكِ على الله ودينه»",
                "«في أمّة تُعدّ بعشرة ملايين تسعة أعشارها ونصف عشرها أمّيّون»", "«واجتهدنا وقصّرتِ»"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 1, "ar.comprehension.evidence")
st("s07", "q3", "q3-e2", "fill_blank", "أكمل:",
   {"text": "وتفاؤله مرتبط بضرورة الأخذ بـ____، فلا نهضة إلاّ بـ____.", "bank": ["الأسباب", "العلم", "الأماني", "المال"]},
   {"blanks": [["الأسباب"], ["العلم"]]}, Q3_EXPL, 1, "ar.comprehension.explain")
Q4_EXPL = ("المفهوم الّذي حدّده الكاتب للنّهضة الأصيلة: أنّها لا تعرف القناعة في الطّلب، ولا ترضى بالقليل، وتأبى الرّكود والتّأسّن، وتقبل بالتّدافع "
           "والتّنافس. رأي المترشّح يكون مدعومًا بالحجج.")
st("s08", "q4", "q4-e1", "mcq", "ما المفهوم الّذي حدّده الكاتب للنّهضة الأصيلة؟",
   {"options": ["أنّها لا تعرف القناعة في الطّلب، ولا ترضى بالقليل، وتأبى الرّكود، وتقبل بالتّدافع والتّنافس", "أنّها تكتفي بالقليل وتقنع بما تحقّق",
                "أنّها تقوم على المال والتّجارة وحدهما", "أنّها تتمّ ببطء وهدوء بعيدًا عن التّنافس"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.explain")
st("s09", "q4", "q4-e1", "multi", "أيّ الصّفات الآتية من صفات النّهضة الأصيلة كما حدّدها الكاتب؟ (اختر كلّ ما يصحّ)",
   {"options": ["لا تعرف القناعة في الطّلب", "لا ترضى بالقليل", "تأبى الرّكود والتّأسّن", "تقبل بالتّدافع والتّنافس", "ترضى بالتّقلّل والتّبلّغ",
                "تدين بالقناعة"]},
   {"correct": [0, 1, 2, 3]}, Q4_EXPL + " أمّا «ترضى بالتّقلّل والتّبلّغ، تدين بالقناعة» فينفيها النّصّ.", 0.5, "ar.comprehension.details", "b")
essay("s10", "q4", "q4-e2", "مفهوم النّهضة الأصيلة عند الإبراهيميّ", "إبداء الرّأي", "رأي المترشّح يكون مدعومًا بالحجج", 1,
      {"task": "إبداء الرّأي في مفهوم النّهضة الأصيلة", "question": PARAS[38], "scheme": "«رأي المترشّح يكون مدعومًا بالحجج» (2×01: المفهوم + الرّأي)",
       "model_example": None},
      Q4_EXPL, "ar.comprehension.opinion")
SUM_SPEC = {"task": "تلخيص النّصّ", "text": "محمّد البشير الإبراهيميّ، عيون البصائر (بكالوريا 2008، الشّعب العلميّة، الموضوع الثّاني)",
            "scheme": "التّلخيص: ويراعى فيه دلالة المضمون، وسلامة اللّغة (2×02)", "model_example": None}
SUM_EXPL = "التّلخيص: ويراعى فيه دلالة المضمون (02) وسلامة اللّغة (02). لا تقدّم الإجابة النّموذجيّة نموذجًا للتّلخيص."
essay("s11", "q5", "q5-e1", "تلخيص نصّ الإبراهيميّ «هذا المعهد أمانة»", "المضمون", "دلالة المضمون", 2, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
essay("s12", "q5", "q5-e2", "تلخيص نصّ الإبراهيميّ «هذا المعهد أمانة»", "سلامة اللّغة", "سلامة اللّغة", 2, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
WAW_EXPL = ("وظّف الكاتب حرف الواو كثيرًا في الفقرة الأولى من النّصّ، وهو للعطف، للرّبط بين الجمل والكلمات… وذلك لأنّ حرف الواو يفيد مطلق الجمع في "
            "أغلب استعمالاته، يلجأ إليه الكاتب لعطف الأشياء دون ترتيب أو اختيار.")
st("s13", "q6", "q6-e1", "mcq", "ما وظيفة حرف الواو الّذي أكثر الكاتب من توظيفه في الفقرة الأولى؟",
   {"options": ["العطف، للرّبط بين الجمل والكلمات", "القسم", "المعيّة", "الحال"]},
   {"correct": 0}, WAW_EXPL, 1, "ar.cohesion.connectors")
st("s14", "q6", "q6-e2", "fill_blank", "ما المسوّغ لهذا التّوظيف؟ أكمل:",
   {"text": "لأنّ حرف الواو يفيد ____ الجمع في أغلب استعمالاته، يلجأ إليه الكاتب لعطف الأشياء دون ____ أو اختيار.",
    "bank": ["مطلق", "ترتيب", "مقيّد", "تشبيه"]},
   {"blanks": [["مطلق"], ["ترتيب"]]}, WAW_EXPL, 1, "ar.cohesion.connectors")
CONJ_EXPL = ("الصّرف في الإجابة النّموذجيّة: هو أدّى – هما أدّيا – هم أدّوا / هي أدّت – هما «أدّيتا» – هنّ أدّين. "
             "(صيغة المثنّى المؤنّث مطبوعة في الإجابة النّموذجيّة «أدّيتا»، والقياس «أدّتا»؛ تحتاج مراجعة صاحب المنصّة، ولذلك لا تُسأل هنا.)")
st("s15", "q7", "q7-e1", "fill_blank", "صرّف الفعل «أدّى» في الماضي مع ضميري الغائب المفرد:",
   {"text": "هو ____ — هي ____", "bank": ["أدّى", "أدّت", "أدّيت", "أدّوا"]},
   {"blanks": [["أدّى"], ["أدّت"]]}, CONJ_EXPL, 0.5, "ar.morphology")
st("s16", "q7", "q7-e2", "mcq", "صرّف الفعل «أدّى» في الماضي مع ضمير الغائبَين المذكّرين (هما):",
   {"options": ["أدّيا", "أدّوا", "أدّيان", "أدّى"]},
   {"correct": 0}, CONJ_EXPL, 0.5, "ar.morphology")
st("s17", "q7", "q7-e3", "fill_blank", "صرّف الفعل «أدّى» في الماضي مع ضميري جمع الغائبين:",
   {"text": "هم ____ — هنّ ____", "bank": ["أدّوا", "أدّين", "أدّيوا", "أدّيا"]},
   {"blanks": [["أدّوا"], ["أدّين"]]}, CONJ_EXPL, 0.5, "ar.morphology")
st("s18", "q8", "q8-e1", "mcq", "ما إعراب «أمانة» في قوله: «هذا المعهد أمانة بيننا وبينك»؟",
   {"options": ["خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "مبتدأ مؤخّر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "نعت مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "أمانة: خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 1, "ar.grammar.irab")
st("s19", "q8", "q8-e2", "mcq", "ما إعراب «جميعًا» في قوله: «وإنّما علينا أن نتعاون جميعًا»؟",
   {"options": ["حال منصوبة", "مفعول به منصوب", "مفعول مطلق منصوب", "ظرف زمان منصوب"]},
   {"correct": 0}, "جميعًا: حال منصوبة.", 1, "ar.grammar.irab")
st("s20", "q8", "q8-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (إنّك لا تنهضين) في قوله: «حين قلنا لكِ: (إنّك لا تنهضين) إلاّ بالعلم»؟",
   {"options": ["جملة مقول القول في محلّ نصب مفعول به", "جملة في محلّ رفع خبر", "جملة في محلّ جرّ نعت", "جملة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "جملة (إنّك لا تنهضين..) جملة مقول القول في محلّ نصب مفعول به.", 1, "ar.grammar.sentence_case")
IMG_EXPL = ("الصّورة البيانيّة في عبارة: «إنّ النّهضات الأصيلة لا تعرف القناعة»: في العبارة مجاز حيث شبّه «النّهضات» بإنسان قنوع، ثمّ حذف المشبّه به، "
            "وأبقى على شيء من لوازمه (تعرف القناعة) على سبيل الاستعارة المكنيّة. وأثرها البلاغيّ تشخيص المعنويّ وإظهاره في صورة المادّيّ.")
st("s21", "q9", "q9-e1", "fill_blank", "اشرح الصّورة البيانيّة في «إنّ النّهضات الأصيلة لا تعرف القناعة»:",
   {"text": "شبّه «____» بإنسان قنوع، ثمّ حذف المشبّه به، وأبقى على شيء من لوازمه (____).",
    "bank": ["النّهضات", "تعرف القناعة", "العلم", "الأصيلة"]},
   {"blanks": [["النّهضات"], ["تعرف القناعة"]]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s22", "q9", "q9-e2", "mcq", "ما نوع الصّورة البيانيّة في «إنّ النّهضات الأصيلة لا تعرف القناعة»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "تشبيه مرسل"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s23", "q9", "q9-e3", "mcq", "ما الأثر البلاغيّ للصّورة في «إنّ النّهضات الأصيلة لا تعرف القناعة»؟",
   {"options": ["تشخيص المعنويّ وإظهاره في صورة المادّيّ", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز المعنى بذكر ضدّه"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")

TITLE = "بكالوريا 2008 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (محمّد البشير الإبراهيميّ: هذا المعهد أمانة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، شعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص2–3)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "لم يُعثر على خطأ نسخ في docx (الفروق تشكيل وعناوين فقط). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص2، صورة ممسوحة قُرئت مكبَّرة). "
         "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. مؤجَّل (essay_builder): الرّأي في س2 (01) وفي س4 (01)، والتّلخيص س5 (2×02). "
         "تنبيه: الإجابة النّموذجيّة تطبع المثنّى المؤنّث «هما أدّيتا» (القياس: أدّتا)؛ خطوة المثنّى تسأل عن «أدّيا» وحدها.")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
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
        "kind": "BAC", "year": 2008, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T15:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
