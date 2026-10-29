"""Conversion: BAC 2009 (session عاديّة، جوان 2009) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الثّاني (طه حسين، «خصام ونقد»: الأدب في سبيل الحياة).
Exam (most faithful source): gdrive 14_ieafXTNAhSJNNjvpaJ6zhpx6Y8GuB5 (بكالوريا العربية 2009 شعبة لغات..docx);
same paper as PDF (owner's copy): gdrive 1D9RGabxYDDVaF4uMCHcauHBo6PWoLlA5 (BAC 2009 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1AZvhhY5HIlsd9JddB3UOrML7NJO8tKVA (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1Ya6TzMEk96GuxLVjHCyiZIu8RRzQh3hy (02_التصحيح.pdf, page 2).

Method (as build_ar_bac_2015_lit_p2.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed), spliced into this builder by script and re-checked
programmatically against the docx. The underline («يقولونها») comes from the docx run formatting and matches the ONEC paper.
The docx was compared line by line with the official ONEC paper (scanned, rendered at 130 dpi). The correction is a scanned
PDF (no text layer), read from the rendered page (150 dpi, 250–400 dpi crops). Every mark comes from the official scheme;
correct options and explanations condense its wording.

Docx vs ONEC paper: same two paragraphs (the second starts «فالأدب اجتماعيّ بطبعه…»), same questions; differences are
labels / diacritics / punctuation only (docx kept): «أوّلا- البناء الفكري» (ONEC «أ – البناء الفكريّ»), «الشرح اللغوي: -
المحمقون» (ONEC «المُحمقُون:»), «يكتب -أتاح - يسعى - أعاب» (ONEC dashes «ــ»). The line-wrapped Part 3 instruction
(«…مبرزا مدى توافرها» / «في النص…») is joined with a space. No word-level defect found.
Paper inconsistency kept verbatim: Part 2 Q4 says «من مطلع الفقرة الثّالثة», but the text has two paragraphs on both the
docx and the ONEC paper; the scheme answers with the opening of the second paragraph («الأدب اجتماعيّ بطبعه كالإنسان»).

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «لغات أجنبيّة» ⇒ LANG.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×1» = the issue (تحديد غاية الأدب) / what it consists of (خدمة المجتمع والإنسان). Q2 «2×1.5» = exactly the two aims
  listed ⇒ two elements. Q3 «2×1» = the aim chosen / the reason. Q4 (تلخيص) «3×1» = الفهم الصّحيح للمضمون / تقنيات
  التّلخيص / سلامة اللّغة وجودة الأسلوب ⇒ three deferred essay_builder elements.
- Part 2 Q1: «4×0.5» beside «يقولون… وواو الجماعة…» + «0.5» beside «والهاء…» (Part 2 = 2.5 + 1 + 1 + 1.5 = 06) ⇒ the
  four clauses of the scheme for «يقولون» (فعل مضارع مرفوع / علامة رفعه ثبوت النّون لأنّه من الأفعال الخمسة / واو الجماعة
  ضمير متّصل مبنيّ / في محلّ رفع فاعل) + the هاء ⇒ five elements of 0.5 — the split of the «4×0.5» is the converter's reading
  of the scheme's four clauses, to be confirmed by the owner. Q2 «01». Q3 «4×0.25» one per verb: the scheme writes «أكتُبْ،
  أتِحْ، اسعَ، أعِبْ»; the vowel of the hamza (asked by the question) is not legible on the scan, so the options carry the
  standard marking (اُكْتُبْ همزة وصل مضمومة، أَتِحْ همزة قطع مفتوحة، اِسْعَ همزة وصل مكسورة، أَعِبْ همزة قطع مفتوحة) —
  to be confirmed by the owner. Q4 «3×0.5» = the image and its type (تشبيه تامّ) / its explanation (the four أركان) /
  its rhetoric.
- Part 3 «4×1» = المقصود بشعراء البلاط / توافرها في النّصّ / موقف الكاتب منها (interactive, from the scheme) / the
  candidate's opinion («يبدي المترشّح رأيه الخاصّ إيجابا أم سلبا» ⇒ deferred essay_builder, rule 11).
- Distractors avoid arguable alternatives: the هاء of «يقولونها» has no «مبنيّ على السّكون في محلّ نصب مفعول به»
  distractor; (كثر تكرارها) has no «نعت» distractor (صلة after «الّتي»); no «تشبيه مرسل / مفصّل» for the type.
- Deferred: Q4 (3) and the opinion in Part 3 (1) = 4 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2009-lang-p2"
PAPER = 2
STREAMS = ["LANG"]
DOCX_ID = "14_ieafXTNAhSJNNjvpaJ6zhpx6Y8GuB5"
DOCX_TITLE = "بكالوريا العربية 2009 شعبة لغات..docx"
PDF_ID = "1D9RGabxYDDVaF4uMCHcauHBo6PWoLlA5"
OFFICIAL_ID = "1AZvhhY5HIlsd9JddB3UOrML7NJO8tKVA"
CORR_ID = "1Ya6TzMEk96GuxLVjHCyiZIu8RRzQh3hy"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    45: "الموضوع الثاني",
    46: "النّص:",
    47: "«الأدب في سبيل الحياة كلمة تُقال وتُكتب، ولا يكاد الذين يقولونها ويكتبونها يحققون معناها، ولا يكادون يحققون نتائجها أيضا. فما عسى أن تكون هذه الحياة التي يريدون أن يجعلوا الأدب وسيلة إليها؟: أهي حياة الأجسام أم حياة القلوب والعقول؟ فإن تكن حياة الأجسام فما أهون الغاية!، وما أخطر الوسيلة! وقد عاشت أجيال الإنسانية إلى الآن على أن الأجسام وسائل إلى إرضاء العقول، لا على أنّ العقول وسائل إلى إرضاء الأجسام، وإن كانت حياة العقول والقلوب والأذواق ومَلَكات النفس الإنسانية كافة، فالأدب والفن والفلسفة والعلم لا غاية لها إلاّ إرضاء هذه المَلَكَات وتمكينها من النمو والرقي والسمو إلى الكمال بمقدار ما يتاح للناس أن يسعوا إلى الكمال. أهي حياة الأفراد أم حياة الشعوب؟ فإن تكن حياة الأفراد فما أهون الغاية! وما أخطر الوسيلة! وويل لأدب لا ينشأ إلا لينعم به هذا الفرد أو ذاك.",
    48: "فالأدب اجتماعيّ بطبعه كالإنسان ولا ينبغي أن نقف عند هذه السخافة التي (كثر تكرارها) والتي تعيب على الأدب القديم أنه كان يتجه ببعض فنونه إلى الملوك والأمراء، وأصحاب السعة من الأغنياء. فهذا الأدب الذي كان يوجه إلى هؤلاء الناس قلة ضئيلة بالقياس إلى الأدب الذي كان يوجه إلى الإنسان من حيث هو إنسان، وهو على رغم اتجاهه إلى هؤلاء الأفراد أدب اجتماعيّ، وكثير منه إنسانيّ، لا يجادل في ذلك إلا المُحمقُون.»",
    49: "من كتاب «خصام ونقد» لطه حسين.",
    50: "الشرح اللغوي:     - المحمقون: أصحاب الحماقة.",
    51: "الأسئلة:",
    52: "أوّلا- البناء الفكري: (10 نقاط)",
    53: "ما القضية التي يعالجها الكاتب في هذا النَّص؟",
    54: "في النص غاياتٌ يريد بعض الأدباء أن يجعلوا الأدب وسيلة إليها. اذكرها حسبما أوردها الكاتب.",
    55: "أيّة غاية اختار الكاتب للأدب؟ ولماذا؟",
    56: "لخّص مضمون النّص بأسلوبك.",
    57: "ثانيا- البناء اللّغوي: (06 نقاط)",
    58: "أعرب ما تحته خط إعراب مفردات.",
    59: "ما محل الجملة المحصورة بين قوسين من الإعراب؟",
    60: "حوّل الأفعال الآتية إلى الأمر، واشكل همزتها: يكتب -أتاح - يسعى - أعاب.",
    61: "استخرج من مطلع الفقرة الثالثة صورة بيانيّة واشرحها مبرزا بلاغتها.",
    62: "ثالثا- التّقويم النقدي: (04 نقاط)",
    63: "كثيرا ما تردّد مصطلح «شعراءُ البلاط» على ألسنة النّقاد، وضح هذه الفكرة مبرزا مدى توافرها",
    64: "في النص وموقف الكاتب منها مُبديا رأيك الشخصي فيها.",
}


J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2, P3 = PARAS[52], PARAS[57], PARAS[62]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and PARAS[45] == "الموضوع الثاني"
assert PARAS[47].startswith("«الأدب في سبيل") and PARAS[48].startswith("فالأدب اجتماعيّ") and "(كثر تكرارها)" in PARAS[48]
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": J(47, 48)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[49]},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": PARAS[50]},
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


q("q1", "1", P1, J(53), 2, [el("q1-e1", "القضيّة الّتي يعالجها الكاتب", 1), el("q1-e2", "ما تتمثّل فيه", 1)])
q("q2", "2", P1, J(54), 3, [el("q2-e1", "الغاية الأولى", 1.5), el("q2-e2", "الغاية الثّانية", 1.5)])
q("q3", "3", P1, J(55), 2, [el("q3-e1", "الغاية الّتي اختارها الكاتب للأدب", 1), el("q3-e2", "التّعليل", 1)])
q("q4", "4", P1, J(56), 3, [el("q4-e1", "التّلخيص: الفهم الصّحيح للمضمون", 1), el("q4-e2", "التّلخيص: تقنيات التّلخيص", 1),
                           el("q4-e3", "التّلخيص: سلامة اللّغة وجودة الأسلوب", 1)])
q("q5", "1", P2, J(58), 2.5, [el("q5-e1", "«يقولون»: فعل مضارع مرفوع", 0.5), el("q5-e2", "«يقولون»: علامة رفعه", 0.5),
                             el("q5-e3", "واو الجماعة: نوعها", 0.5), el("q5-e4", "واو الجماعة: محلّها", 0.5), el("q5-e5", "إعراب الهاء", 0.5)])
q("q6", "2", P2, J(59), 1, [el("q6-e1", "محلّ جملة (كثر تكرارها)", 1)])
q("q7", "3", P2, J(60), 1, [el("q7-e1", "الأمر من «يكتب»", 0.25), el("q7-e2", "الأمر من «أتاح»", 0.25), el("q7-e3", "الأمر من «يسعى»", 0.25),
                           el("q7-e4", "الأمر من «أعاب»", 0.25)])
q("q8", "4", P2, J(61), 1.5, [el("q8-e1", "الصّورة ونوعها", 0.5), el("q8-e2", "شرحها", 0.5), el("q8-e3", "بلاغتها", 0.5)])
q("q9", "التّعليمة", P3, PARAS[63] + " " + PARAS[64], 4,
  [el("q9-e1", "المقصود بشعراء البلاط", 1), el("q9-e2", "مدى توافر الفكرة في النّصّ", 1), el("q9-e3", "موقف الكاتب منها", 1),
   el("q9-e4", "الرّأي الشّخصيّ", 1)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "القضيّة الّتي يعالجها الكاتب في هذا النّصّ تكمن في: تحديد غاية الأدب، والمتمثّل في خدمة المجتمع والإنسان من حيث هو إنسان."
st("s01", "q1", "q1-e1", "mcq", "ما القضيّة الّتي يعالجها طه حسين في هذا النّصّ؟",
   {"options": ["تحديد غاية الأدب", "نشأة الأدب العربيّ القديم", "الموازنة بين الشّعر والنّثر", "سيرة شعراء البلاط"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل: فيمَ تتمثّل غاية الأدب في هذه القضيّة؟",
   {"text": "تحديد غاية الأدب، والمتمثّل في خدمة ____ و____ من حيث هو إنسان.", "bank": ["المجتمع", "الإنسان", "الملوك", "الجسد"]},
   {"blanks": [["المجتمع"], ["الإنسان"]]}, Q1_EXPL, 1, "ar.comprehension.idea")
AIMS_EXPL = ("في النّصّ غايات يريد الأدباء أن يجعلوا الأدب وسيلة إليها، وهي: جعل الأدب خادمًا للجسم والغرائز والشّهوات (حياة الإنسان)؛ "
             "جعل الأدب خادمًا للأفراد كالملوك والأمراء (خادمًا للخاصّة من النّاس).")
st("s03", "q2", "q2-e1", "mcq", "ما الغاية الّتي ينتقدها الكاتب في قوله: «فإن تكن حياة الأجسام فما أهون الغاية!، وما أخطر الوسيلة!»؟",
   {"options": ["جعل الأدب خادمًا للجسم والغرائز والشّهوات", "جعل الأدب في خدمة الرّوح والعقل", "جعل الأدب في خدمة المجتمع والإنسانيّة عامّة",
                "جعل الأدب وسيلة إلى نموّ ملكات النّفس ورقيّها"]},
   {"correct": 0}, AIMS_EXPL, 0.75, "ar.comprehension.details")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل الغاية الأولى:",
   {"text": "جعل الأدب خادمًا للجسم و____ و____.", "bank": ["الغرائز", "الشّهوات", "العقول", "القلوب"]},
   {"blanks": [["الغرائز"], ["الشّهوات"]]}, AIMS_EXPL, 0.75, "ar.comprehension.details", "b")
st("s05", "q2", "q2-e2", "mcq", "ما الغاية الّتي ينتقدها الكاتب في قوله: «فإن تكن حياة الأفراد فما أهون الغاية! وما أخطر الوسيلة!»؟",
   {"options": ["جعل الأدب خادمًا للأفراد كالملوك والأمراء", "جعل الأدب خادمًا للشّعوب والمجتمعات", "جعل الأدب في خدمة العقل والذّوق",
                "جعل الأدب وسيلة إلى بلوغ الكمال"]},
   {"correct": 0}, AIMS_EXPL, 0.75, "ar.comprehension.details")
st("s06", "q2", "q2-e2", "fill_blank", "أكمل الغاية الثّانية:",
   {"text": "جعل الأدب خادمًا للأفراد كـ____ و____ (خادمًا للخاصّة من النّاس).", "bank": ["الملوك", "الأمراء", "الفقراء", "العامّة"]},
   {"blanks": [["الملوك"], ["الأمراء"]]}, AIMS_EXPL, 0.75, "ar.comprehension.details", "b")
CHOICE_EXPL = ("الغاية الّتي اختارها الكاتب للأدب: أن يكون في خدمة الرّوح والعقل (حياة القلوب والعقول)، وأن يكون في خدمة المجتمع والإنسانيّة عامّة؛ "
               "وذلك أنّ الأدب اجتماعيّ بطبعه كالإنسان، ولا يمكن إلاّ أن يكون كذلك.")
st("s07", "q3", "q3-e1", "multi", "أيّة غاية اختار الكاتب للأدب؟ (اختر كلّ ما يصحّ)",
   {"options": ["أن يكون في خدمة الرّوح والعقل (حياة القلوب والعقول)", "أن يكون في خدمة المجتمع والإنسانيّة عامّة",
                "أن يكون خادمًا للجسم وشهواته", "أن يكون خادمًا للملوك والأمراء", "أن يكون متعة خاصّة بالأديب وحده"]},
   {"correct": [0, 1]}, CHOICE_EXPL, 1, "ar.comprehension.idea")
st("s08", "q3", "q3-e2", "mcq", "ولماذا اختار الكاتب هذه الغاية للأدب؟",
   {"options": ["لأنّ الأدب اجتماعيّ بطبعه كالإنسان، ولا يمكن إلاّ أن يكون كذلك", "لأنّ الأدب القديم كان يتّجه ببعض فنونه إلى الملوك والأمراء",
                "لأنّ حياة الأجسام أولى من حياة العقول", "لأنّ الأديب يكتب لنفسه قبل أن يكتب لغيره"]},
   {"correct": 0}, CHOICE_EXPL, 1, "ar.comprehension.explain")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ بالأسلوب الخاصّ", "text": "طه حسين، خصام ونقد (بكالوريا 2009، لغات أجنبيّة، الموضوع الثّاني)",
            "scheme": "«3×1»: الفهم الصّحيح للمضمون – تقنيات التّلخيص – سلامة اللّغة وجودة الأسلوب", "model_example": None}
SUM_EXPL = "تلخيص مضمون النّصّ: يراعى في إجابة المترشّح الفهم الصّحيح للمضمون (1)، تقنيات التّلخيص (1)، سلامة اللّغة وجودة الأسلوب (1)."
for sid, eid, crit, ind, pts in [("s09", "q4-e1", "المضمون", "الفهم الصّحيح للمضمون", 1), ("s10", "q4-e2", "التّقنية", "تقنيات التّلخيص", 1),
                                 ("s11", "q4-e3", "اللّغة والأسلوب", "سلامة اللّغة وجودة الأسلوب", 1)]:
    essay(sid, "q4", eid, "تلخيص مضمون نصّ طه حسين", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
IRAB_EXPL = ("يقولونها: يقولون: فعل مضارع مرفوع وعلامة رفعه ثبوت النّون لأنّه من الأفعال الخمسة، وواو الجماعة ضمير متّصل مبنيّ في محلّ رفع فاعل، "
             "والهاء: ضمير متّصل مبنيّ على الفتح في محلّ نصب مفعول به.")
st("s12", "q5", "q5-e1", "mcq", "ما نوع «يقولون» وحكمه الإعرابيّ في قوله: «ولا يكاد الّذين يقولونها ويكتبونها…»؟",
   {"options": ["فعل مضارع مرفوع", "فعل مضارع منصوب", "فعل مضارع مجزوم", "فعل ماضٍ مبنيّ"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
st("s13", "q5", "q5-e2", "mcq", "ما علامة رفع «يقولون»؟",
   {"options": ["ثبوت النّون لأنّه من الأفعال الخمسة", "الضّمّة الظّاهرة على آخره", "الضّمّة المقدّرة على الواو", "الواو لأنّه جمع مذكّر سالم"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
st("s14", "q5", "q5-e3", "mcq", "ما الواو في «يقولونها»؟",
   {"options": ["واو الجماعة: ضمير متّصل مبنيّ", "حرف عطف مبنيّ", "واو الحال", "حرف زائد للإشباع"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
st("s15", "q5", "q5-e4", "mcq", "ما محلّ واو الجماعة في «يقولونها» من الإعراب؟",
   {"options": ["في محلّ رفع فاعل", "في محلّ نصب مفعول به", "في محلّ جرّ مضاف إليه", "في محلّ رفع نائب فاعل"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
st("s16", "q5", "q5-e5", "mcq", "ما إعراب الهاء في «يقولونها»؟",
   {"options": ["ضمير متّصل مبنيّ على الفتح في محلّ نصب مفعول به", "ضمير متّصل مبنيّ على الفتح في محلّ جرّ مضاف إليه",
                "ضمير متّصل مبنيّ على الفتح في محلّ رفع فاعل", "ضمير منفصل مبنيّ في محلّ رفع مبتدأ"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
REL_EXPL = "إعراب الجملة: (كثر تكرارها) جملة فعليّة صلة الموصول لا محلّ لها من الإعراب."
st("s17", "q6", "q6-e1", "mcq", "ما محلّ جملة (كثر تكرارها) في قوله: «هذه السّخافة الّتي (كثر تكرارها)» من الإعراب؟",
   {"options": ["جملة فعليّة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر",
                "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, REL_EXPL, 0.5, "ar.grammar.sentence_case")
st("s18", "q6", "q6-e1", "fill_blank", "أكمل إعراب الجملة:",
   {"text": "(كثر تكرارها): جملة ____ صلة ____ لا محلّ لها من الإعراب.", "bank": ["فعليّة", "الموصول", "اسميّة", "الشّرط"]},
   {"blanks": [["فعليّة"], ["الموصول"]]}, REL_EXPL, 0.5, "ar.grammar.sentence_case", "b")
IMP_EXPL = ("التّحويل إلى الأمر: يكتب ← اُكْتُبْ (همزة وصل مضمومة)، أتاح ← أَتِحْ (همزة قطع مفتوحة)، يسعى ← اِسْعَ (همزة وصل مكسورة)، "
            "أعاب ← أَعِبْ (همزة قطع مفتوحة). (يكتب التّصحيح: أكتُبْ، أتِحْ، اسعَ، أعِبْ؛ حركة الهمزة غير مقروءة في النّسخة الممسوحة.)")
for sid, eid, verb, opts in [("s19", "q7-e1", "يكتب", ["اُكْتُبْ", "اِكْتُبْ", "أَكْتُبْ", "اُكْتِبْ"]),
                             ("s20", "q7-e2", "أتاح", ["أَتِحْ", "اِتِحْ", "أَتِيحْ", "تِحْ"]),
                             ("s21", "q7-e3", "يسعى", ["اِسْعَ", "اُسْعَ", "اِسْعَى", "أَسْعِ"]),
                             ("s22", "q7-e4", "أعاب", ["أَعِبْ", "اِعِبْ", "أَعِيبْ", "عِبْ"])]:
    st(sid, "q7", eid, "mcq", f"حوّل الفعل «{verb}» إلى الأمر مع شكل همزته:", {"options": opts}, {"correct": 0}, IMP_EXPL, 0.25, "ar.morphology")
IMG_EXPL = ("في مطلع الفقرة صورة بيانيّة هي قول الكاتب: «الأدب اجتماعيّ بطبعه كالإنسان»، وهي تشبيه تامّ يتوفّر على كلّ أركان التّشبيه: "
            "فالأدب هو المشبّه، والإنسان هو المشبّه به، والأداة هي الكاف، ووجه الشّبه: الطّابع الاجتماعيّ لكلّ منهما. بلاغته: توضيح المعنى وبيان قيمة الأدب. "
            "(يذكر السّؤال «الفقرة الثّالثة» والنّصّ فقرتان؛ الصّورة في مطلع الفقرة «فالأدب اجتماعيّ بطبعه…».)")
st("s23", "q8", "q8-e1", "mcq", "ما الصّورة البيانيّة الواردة في مطلع الفقرة «فالأدب اجتماعيّ بطبعه…»، وما نوعها؟",
   {"options": ["«الأدب اجتماعيّ بطبعه كالإنسان»: تشبيه تامّ", "«الأدب اجتماعيّ بطبعه كالإنسان»: تشبيه بليغ",
                "«الأدب اجتماعيّ بطبعه كالإنسان»: استعارة مكنيّة", "«الأدب اجتماعيّ بطبعه كالإنسان»: كناية عن صفة"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s24", "q8", "q8-e2", "matching", "اشرح التّشبيه في «الأدب اجتماعيّ بطبعه كالإنسان»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به", "الأداة", "وجه الشّبه"], "rights": ["الأدب", "الإنسان", "الكاف", "الطّابع الاجتماعيّ لكلّ منهما", "الملوك والأمراء"]},
   {"pairs": [0, 1, 2, 3]}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s25", "q8", "q8-e3", "mcq", "ما بلاغة التّشبيه في «الأدب اجتماعيّ بطبعه كالإنسان»؟",
   {"options": ["توضيح المعنى وبيان قيمة الأدب", "تشخيص المعنويّ وبثّ الحياة فيه", "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
COURT_EXPL = ("المقصود بشعراء البلاط: أولئك الّذين كانوا يسخّرون شعرهم لمدح الملوك والأمراء، تقرّبًا وتزلّفًا طمعًا في منحة أو منصب. وهي تتجلّى في النّصّ "
              "عبر موقف بعض الأدباء الّذين جعلوا من الأدب خادمًا للأفراد ملوكًا كانوا أم أمراء. وقد رفض الكاتب طه حسين هذه الفكرة من أساسها ودعا أن يكون "
              "الأدب في خدمة المجتمع والإنسان. (يبدي المترشّح رأيه الخاصّ إيجابًا أم سلبًا.)")
st("s26", "q9", "q9-e1", "mcq", "ما المقصود بـ«شعراء البلاط»؟",
   {"options": ["الّذين كانوا يسخّرون شعرهم لمدح الملوك والأمراء تقرّبًا وتزلّفًا طمعًا في منحة أو منصب", "الشّعراء الّذين يصفون القصور وجمال عمارتها",
                "الشّعراء الّذين يدافعون عن قضايا الشّعب والفقراء", "الشّعراء الّذين اعتزلوا النّاس وتغنّوا بالطّبيعة"]},
   {"correct": 0}, COURT_EXPL, 0.5, "ar.literature.context")
st("s27", "q9", "q9-e1", "fill_blank", "أكمل التّعريف:",
   {"text": "شعراء البلاط: الّذين كانوا يسخّرون شعرهم لمدح الملوك والأمراء، ____ و____ طمعًا في منحة أو منصب.", "bank": ["تقرّبًا", "تزلّفًا", "زهدًا", "تمرّدًا"]},
   {"blanks": [["تقرّبًا", "تقربا"], ["تزلّفًا", "تزلفا"]]}, COURT_EXPL, 0.5, "ar.literature.context", "b")
st("s28", "q9", "q9-e2", "mcq", "كيف تتجلّى فكرة «شعراء البلاط» في النّصّ؟",
   {"options": ["عبر موقف بعض الأدباء الّذين جعلوا من الأدب خادمًا للأفراد ملوكًا كانوا أم أمراء", "عبر وصف الكاتب لقصور الملوك والأمراء",
                "عبر قصيدة مدح يوردها الكاتب كاملة", "لا أثر لها في النّصّ"]},
   {"correct": 0}, COURT_EXPL, 1, "ar.comprehension.details")
st("s29", "q9", "q9-e3", "mcq", "ما موقف الكاتب طه حسين من هذه الفكرة؟",
   {"options": ["رفضها من أساسها ودعا أن يكون الأدب في خدمة المجتمع والإنسان", "أيّدها ودعا الأدباء إلى التّقرّب من الملوك",
                "وقف منها موقف الحياد فلم يبدِ فيها رأيًا", "دعا إلى أن يكون الأدب خادمًا لحياة الأجسام"]},
   {"correct": 0}, COURT_EXPL, 1, "ar.comprehension.opinion")
essay("s30", "q9", "q9-e4", "شعراء البلاط وموقف طه حسين منهم", "إبداء الرّأي", "يبدي المترشّح رأيه الخاصّ إيجابًا أم سلبًا مع التّعليل", 1,
      {"task": "إبداء الرّأي الشّخصيّ في فكرة «شعراء البلاط»", "question": PARAS[63] + " " + PARAS[64],
       "scheme": "«4×1»: المقصود بشعراء البلاط – توافرها في النّصّ – موقف الكاتب – (يبدي المترشّح رأيه الخاصّ إيجابا أم سلبا)"},
      COURT_EXPL, "ar.comprehension.opinion")

TITLE = "بكالوريا 2009 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الثّاني (طه حسين: خصام ونقد)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2009، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
         f"مولَّد من ملفّ docx ومقابَل سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "لا اختلاف في الكلمات؛ وُصل سطرا تعليمة التّقويم النّقديّ. يذكر السّؤال 4 من البناء اللّغويّ «الفقرة الثّالثة» والنّصّ فقرتان (كما في الموضوع الرّسميّ). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص2، صورة ممسوحة قُرئت مصوّرة). البناء اللّغويّ س1: «4×0.5» + «0.5» قُسّمت على عبارات "
         "الإعراب الخمس؛ س3: حركة الهمزة غير مقروءة في المسح فكُتبت بالضّبط المعياريّ. "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. مؤجَّل (essay_builder): التّلخيص س4 (3×1) والرّأي في التّقويم النّقديّ (1).")
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
        "kind": "BAC", "year": 2009, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
