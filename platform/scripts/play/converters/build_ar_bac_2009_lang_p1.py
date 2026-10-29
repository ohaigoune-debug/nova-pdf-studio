"""Conversion: BAC 2009 (session عاديّة، جوان 2009) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (محمّد الصّالح باوية، «ساعة الصّفر»).
Exam (most faithful source): gdrive 14_ieafXTNAhSJNNjvpaJ6zhpx6Y8GuB5 (بكالوريا العربية 2009 شعبة لغات..docx);
same paper as PDF (owner's copy): gdrive 1D9RGabxYDDVaF4uMCHcauHBo6PWoLlA5 (BAC 2009 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1AZvhhY5HIlsd9JddB3UOrML7NJO8tKVA (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1Ya6TzMEk96GuxLVjHCyiZIu8RRzQh3hy (02_التصحيح.pdf, page 1).

Method (as build_ar_bac_2015_lit_p2.py / build_ar_bac_2014_lit_p1.py): PARAS below were generated from the .docx with python-docx
(paragraph text read exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by
script, then re-checked programmatically against the docx. Underlines come from the docx run formatting («يرمي» in line 5,
«صَموتًا» in the third-to-last stanza line) and match the ONEC paper. The docx was compared line by line with the official
ONEC paper (scanned, rendered at 130 dpi). The correction is a scanned PDF (no text layer), read from the rendered page
(150 dpi, 250–400 dpi crops). Every mark comes from the official scheme; correct options and explanations condense it.

Docx vs ONEC paper:
- Same poem lines in the same order (free verse, one line per paragraph, «...» separator kept), same questions.
- Defects fixed (each asserted to occur once): Part 2 Q4 «بیانیتان» is typed with two Farsi yeh (U+06CC) ⇒ «بيانيتان»
  (Arabic yeh, as printed); Part 3 «الَّنقديّة» (shadda + fatha misplaced on the lam) ⇒ «النّقديّة» (ONEC «النّقديّة»).
- Two-line Part 2 Q4 («في العبارتين…» / «"وإذا البارود عربد"، …») kept as two lines of one question.
- Other differences are labels / diacritics / punctuation only (docx kept): «أوّلا- البناء الفكري» (ONEC «أ ــ البناء الفكريّ»),
  «ساعة الصفر» without some shaddas, «عميقهْ»…

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «لغات أجنبيّة» ⇒ LANG.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×01» = the subject (الثّورة الجزائريّة المجيدة) / the explanation (معايشة الشّاعر التّجربة). Q2 «01 + 01» one per
  expression. Q3 «01.5 + 01.5» = the meaning of الحقيقة (الاستقلال والانعتاق) / why it is linked to يقظة الإنسان.
- Q4 (نثر المقطع الأخير) «3×1» = تقنية نثر الأبيات / دلالة المضمون / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2 Q1: the column shows «0.5» beside «يرمي…» and «0.5» beside «والفاعل ضمير مستتر…» just above «صموتا…» (which has no
  mark of its own); Part 2 must total 06, so Q1 = 1 ⇒ read as one 0.5 per underlined word (يرمي with its فاعل / صموتا) —
  to be confirmed by the owner. Q2 «0.5», Q3 «0,5». Q4: each image «01» (type + explanation) + «0,5» (effect) ⇒ four
  elements. Q5 «2×0.5» = scansion (writing, symbols, feet) / the metre (الرّمل). The scheme prints the prosody symbols in
  visual right-to-left order — written here left-to-right, the usual notation.
- Part 3 «1 + 2 + 1» = مفهوم الالتزام / مدى التزام الأدباء المحدثين به / دعم الإجابة بالأمثلة: the scheme gives only these
  criteria (no model content) and the question asks for an evaluation supported by examples from reality ⇒ three deferred
  essay_builder elements (rule 11 / rule 3: no correct option can be taken from the scheme).
- Distractors avoid arguable alternatives: no «إذا الفجائيّة» for «وإذا البارود عربد» (a nominal sentence follows), no
  «حال» for «يأكل الغاب السّحيقة» (نعت لـ«سراج»), no «تشبيه» variants for the type of «قدمي الدّامي دروب شائكات».
- Deferred: Q4 (3) and Part 3 (4) = 7 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2009-lang-p1"
PAPER = 1
STREAMS = ["LANG"]
DOCX_ID = "14_ieafXTNAhSJNNjvpaJ6zhpx6Y8GuB5"
DOCX_TITLE = "بكالوريا العربية 2009 شعبة لغات..docx"
PDF_ID = "1D9RGabxYDDVaF4uMCHcauHBo6PWoLlA5"
OFFICIAL_ID = "1AZvhhY5HIlsd9JddB3UOrML7NJO8tKVA"
CORR_ID = "1Ya6TzMEk96GuxLVjHCyiZIu8RRzQh3hy"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    0: "على المترشح أن يختار أحد الموضوعين الآتيين:",
    1: "الموضوع الأول",
    2: "النّـــــص:",
    3: "ساعة الصّفر",
    4: "العيونُ الحُمْرُ نشوى في تحَدّ تعبُر اللّحظة للنّصر المُؤكَّد.",
    5: "الزُّنُود الصُّلب جيل عربي صَوَّب الإفْناء للطَّاغي وسدّد.",
    6: "الصُّدور العُريُ تطوي سِرَّ خلقي، سِرَّ إبداعي، وآمالي الطَّليقة.",
    7: "قدمي الدَّامي دروبٌ شائكاتٌ، وسِرَاجٌ يأكل الغابَ السَّحيقَة.",
    8: "... وإذا رعد الشفاه السُّود يرمي طلقة الصفر فتنسابُ الدَّقيقة.",
    9: "وإذا البارود عَرْبَدْ.",
    10: "والذُّرى حولي تُرَدّدْ:",
    11: "ساعة الصفر انفجارات عميقهْ",
    12: "يقظة الإنسان، ميلاد الحقيقهْ",
    13: "...",
    14: "إن تَزُرنا أيُّها النجم المغامر.",
    15: "نُطلق الأقمار من غضبة ثائر.",
    16: "نعتقِ الأسرَارَ من صمت الحناجر.",
    17: "وغدا حين تُواريك خناجر.",
    18: "ودماء، وعطور.. أحمل المنجل فَالحَصْدُ لَهيبٌ ومخاطر.",
    19: "وأعبر الدرب صَموتًا في بلادي، فتُرابي ثورة، فوج مخاطر.",
    20: "لم يزلْ باروده رعدًا يُعربد",
    21: "لم تزل أجراسه حولي تردد:",
    22: "ساعة الصّفر انطلاقاتُ مشَاعِر",
    23: "يقظة الإنسان، ميلاد الجزائر.",
    24: "-محمّد الصَّالح باوية –",
    26: "الأسئلة:",
    27: "أوّلا- البناء الفكري: (10 نقاط)",
    28: "ما الموضوع الذي استهوى الشاعر في هذه القصيدة مع التوضيح؟",
    29: "ما المعنى الذي تفيده عبارتا: «العيونُ الحمر»، و «الصُّدور العُري»؟",
    30: "ما المقصود بالحقيقة؟ ولـِمَ ربط الشاعر بينها وبين يقظة الإنسان؟",
    31: "انثر المقطع الأخير من النص: «إن تزرنا أيّها النجم المغامر..........ميلاد الجزائر».",
    32: "ثانيا- البناء اللّغوي: (06 نقاط)",
    33: "أعرب ما تحته سطر.",
    34: "ما وظيفة «إذا» في قول الشاعر: «وإذا البارودُ عَرْبَدْ»؟",
    35: "ما محل جملة: «يأكل الغابَ السحيقة» من الإعراب؟",
    36: "في العبارتين الآتيتين صورتان بیانیتان. حدّد نوعيهما، وبيّن أثرهما في المعنى:",
    37: "«وإذا البارود عربد»، «قدمي الدَّامي دُرُوبٌ شائكاتٌ»",
    38: "قطع السطر الأوَّل ثم اذكر بحره.",
    39: "ثالثا- التّقويم النقدي: (04 نقاط)",
    40: "فكرة الالتزام في الأدب الحديث هي حصيلة النظريات الَّنقديّة الحديثة. ما مفهومها؟ وما مدى التزام الأديب الحديث بها؟ دعّم إجابتك بأمثلة من الواقع.",
}


NQ_BAD, NQ_OK = "\u0627\u0644\u0651\u064e\u0646\u0642\u062f", "\u0627\u0644\u0646\u0651\u0642\u062f"  # «الَّنقد» (docx) ⇒ «النّقد»


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2, P3 = PARAS[27], PARAS[32], PARAS[39]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and PARAS[1] == "الموضوع الأول"
POEM_LINES = [PARAS[i] for i in range(4, 24)]
assert POEM_LINES[0].startswith("العيونُ") and POEM_LINES[-1].startswith("يقظة الإنسان") and POEM_LINES[9] == "..."
DOCS = [
    {"id": "d-title", "kind": "text", "caption": "عنوان النّصّ", "text": PARAS[3]},
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(POEM_LINES)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[24]},
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


q("q1", "1", P1, J(28), 2, [el("q1-e1", "الموضوع الّذي استهوى الشّاعر", 1), el("q1-e2", "التّوضيح", 1)])
q("q2", "2", P1, J(29), 2, [el("q2-e1", "معنى «العيون الحمر»", 1), el("q2-e2", "معنى «الصّدور العري»", 1)])
q("q3", "3", P1, J(30), 3, [el("q3-e1", "المقصود بالحقيقة", 1.5), el("q3-e2", "سبب الرّبط بينها وبين يقظة الإنسان", 1.5)])
q("q4", "4", P1, J(31), 3, [el("q4-e1", "النّثر: تقنية نثر الأبيات", 1), el("q4-e2", "النّثر: دلالة المضمون", 1), el("q4-e3", "النّثر: سلامة اللّغة", 1)])
q("q5", "1", P2, J(33), 1, [el("q5-e1", "إعراب «يرمي»", 0.5), el("q5-e2", "إعراب «صموتا»", 0.5)])
q("q6", "2", P2, J(34), 0.5, [el("q6-e1", "وظيفة «إذا»", 0.5)])
q("q7", "3", P2, J(35), 0.5, [el("q7-e1", "محلّ جملة «يأكل الغاب السّحيقة»", 0.5)])
q("q8", "4", P2, _fix(PARAS[36], "بیانیتان", "بيانيتان") + "\n" + PARAS[37], 3,
  [el("q8-e1", "«وإذا البارود عربد»: النّوع والشّرح", 1), el("q8-e2", "«وإذا البارود عربد»: الأثر في المعنى", 0.5),
   el("q8-e3", "«قدمي الدّامي دروب شائكات»: النّوع والشّرح", 1), el("q8-e4", "«قدمي الدّامي دروب شائكات»: الأثر في المعنى", 0.5)])
q("q9", "5", P2, J(38), 1, [el("q9-e1", "تقطيع السّطر الأوّل", 0.5), el("q9-e2", "البحر", 0.5)])
q("q10", "التّعليمة", P3, _fix(PARAS[40], NQ_BAD, NQ_OK), 4,
  [el("q10-e1", "مفهوم الالتزام في الأدب الحديث", 1), el("q10-e2", "مدى التزام الأدباء المحدثين به", 2), el("q10-e3", "دعم الإجابة بالأمثلة", 1)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "الموضوع الّذي استهوى الشّاعر في هذه القصيدة هو موضوع الثّورة الجزائريّة المجيدة، لمعايشة الشّاعر التّجربة."
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي استهوى الشّاعر في قصيدة «ساعة الصّفر»؟",
   {"options": ["موضوع الثّورة الجزائريّة المجيدة", "موضوع الحنين إلى القرية والطّفولة", "موضوع وصف الطّبيعة الجزائريّة", "موضوع الغربة في المهجر"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "وضّح: لماذا استهوى هذا الموضوع الشّاعرَ؟",
   {"text": "استهواه موضوع الثّورة الجزائريّة المجيدة لـ____ الشّاعر ____.", "bank": ["معايشة", "التّجربة", "جهل", "الأسطورة"]},
   {"blanks": [["معايشة"], ["التّجربة"]]}, Q1_EXPL, 1, "ar.comprehension.explain")
EXP_EXPL = ("«العيونُ الحمرُ»: رمز للإصرار الّذي يمثّله جيل الغضب المؤمن بالنّصر. «الصّدور العُري»: رمز الإصرار والتّضحية، فالصّدور العارية "
            "تتحدّى رصاص العدوّ مكشوفة.")
st("s03", "q2", "q2-e1", "mcq", "ما المعنى الّذي تفيده عبارة «العيونُ الحمرُ»؟",
   {"options": ["رمز للإصرار الّذي يمثّله جيل الغضب المؤمن بالنّصر", "رمز لليأس من تحقيق النّصر", "رمز للخوف من بطش المستعمر", "رمز للمرض والإرهاق"]},
   {"correct": 0}, EXP_EXPL, 1, "ar.comprehension.explain")
st("s04", "q2", "q2-e2", "mcq", "ما المعنى الّذي تفيده عبارة «الصّدور العُريُ»؟",
   {"options": ["رمز الإصرار والتّضحية", "رمز الفقر والحرمان", "رمز الاستسلام للعدوّ", "رمز البرد وقسوة الطّبيعة"]},
   {"correct": 0}, EXP_EXPL, 0.5, "ar.comprehension.explain")
st("s05", "q2", "q2-e2", "fill_blank", "أكمل شرح العبارة:",
   {"text": "فالصّدور ____ تتحدّى ____ العدوّ مكشوفة.", "bank": ["العارية", "رصاص", "الخائفة", "صداقة"]},
   {"blanks": [["العارية"], ["رصاص"]]}, EXP_EXPL, 0.5, "ar.comprehension.explain", "b")
TRUTH_EXPL = ("ربط الشّاعر بين يقظة الإنسان وميلاد الحقيقة، لأنّ اليقظة تكون عادة بعد نوم عميق استولى الاستعمار فيه على البلاد والعباد، "
              "ومن ثمّة فهذه اليقظة تدفع بالوطنيّين إلى رفض هذا الواقع الأليم وتصحيحه بالثّورة المسلّحة والّتي تؤدّي إلى الاستقلال. "
              "فالحقيقة إذًا هي الاستقلال والانعتاق.")
st("s06", "q3", "q3-e1", "mcq", "ما المقصود بالحقيقة في قوله: «يقظة الإنسان، ميلاد الحقيقهْ»؟",
   {"options": ["الاستقلال والانعتاق", "الموت والفناء", "الحقائق العلميّة الّتي يكتشفها الإنسان", "حقيقة الحلم والخيال"]},
   {"correct": 0}, TRUTH_EXPL, 1, "ar.comprehension.explain")
st("s07", "q3", "q3-e1", "fill_blank", "أكمل:",
   {"text": "فالحقيقة إذًا هي الاستقلال و____.", "bank": ["الانعتاق", "الاستسلام", "الخضوع"]},
   {"blanks": [["الانعتاق"]]}, TRUTH_EXPL, 0.5, "ar.comprehension.explain", "b")
st("s08", "q3", "q3-e2", "mcq", "لِمَ ربط الشّاعر بين الحقيقة ويقظة الإنسان؟",
   {"options": ["لأنّ اليقظة تكون عادة بعد نوم عميق استولى الاستعمار فيه على البلاد والعباد، فتدفع الوطنيّين إلى رفض الواقع الأليم وتصحيحه",
                "لأنّ الإنسان لا يدرك الحقيقة إلاّ في أحلامه", "لأنّ اليقظة تعني الاستسلام للواقع والرّضا به", "لأنّ الحقيقة لا تظهر إلاّ في الصّباح الباكر"]},
   {"correct": 0}, TRUTH_EXPL, 0.75, "ar.comprehension.link")
st("s09", "q3", "q3-e2", "ordering", "رتّب حلقات الرّبط بين يقظة الإنسان وميلاد الحقيقة كما في الإجابة النّموذجيّة.",
   {"items": ["نوم عميق استولى الاستعمار فيه على البلاد والعباد", "يقظة تدفع بالوطنيّين إلى رفض الواقع الأليم",
              "تصحيح الواقع بالثّورة المسلّحة", "الاستقلال"]},
   {"order": [0, 1, 2, 3]}, TRUTH_EXPL, 0.75, "ar.comprehension.link", "b")
PROSE_SPEC = {"task": "نثر المقطع الأخير من النّصّ («إن تزرنا أيّها النّجم المغامر… ميلاد الجزائر»)",
              "text": "محمّد الصّالح باوية، ساعة الصّفر (بكالوريا 2009، لغات أجنبيّة، الموضوع الأوّل)",
              "scheme": "نثر الأبيات «3×1»: يراعى فيه احترام تقنية نثر الأبيات، دلالة المضمون وسلامة اللّغة", "model_example": None}
PROSE_EXPL = "نثر الأبيات: يراعى فيه احترام تقنية نثر الأبيات (1)، دلالة المضمون (1) وسلامة اللّغة (1). لا يقدّم التّصحيح نموذجًا للنّثر."
for sid, eid, crit, ind, pts in [("s10", "q4-e1", "التّقنية", "احترام تقنية نثر الأبيات", 1), ("s11", "q4-e2", "المضمون", "دلالة المضمون", 1),
                                 ("s12", "q4-e3", "سلامة اللّغة", "سلامة اللّغة", 1)]:
    essay(sid, "q4", eid, "نثر المقطع الأخير من قصيدة «ساعة الصّفر»", crit, ind, pts, PROSE_SPEC, PROSE_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s13", "q5", "q5-e1", "mcq", "ما إعراب «يرمي» في قوله: «وإذا رعد الشّفاه السّود يرمي طلقة الصّفر»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل، والفاعل ضمير مستتر تقديره «هو»",
                "فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها التّعذّر، والفاعل ضمير مستتر تقديره «هو»",
                "فعل مضارع مجزوم وعلامة جزمه حذف حرف العلّة، والفاعل ضمير مستتر تقديره «هو»",
                "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره، والفاعل «طلقة»"]},
   {"correct": 0}, "يرمي: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل، والفاعل ضمير مستتر تقديره «هو».",
   0.5, "ar.grammar.irab")
st("s14", "q5", "q5-e2", "mcq", "ما إعراب «صموتًا» في قوله: «وأعبر الدّرب صموتًا في بلادي»؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة", "نعت منصوب وعلامة نصبه الفتحة الظّاهرة",
                "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة"]},
   {"correct": 0}, "صموتًا: حال منصوبة وعلامة نصبها الفتحة الظّاهرة.", 0.5, "ar.grammar.irab")
st("s15", "q6", "q6-e1", "mcq", "ما وظيفة «إذا» في قول الشّاعر: «وإذا البارودُ عربدْ»؟",
   {"options": ["ظرف لما يستقبل من الزّمان", "ظرف لما مضى من الزّمان", "حرف شرط جازم", "اسم استفهام"]},
   {"correct": 0}, "وظيفة «إذا» في قول الشّاعر: «وإذا البارود عربد»: ظرف لما يستقبل من الزّمان.", 0.5, "ar.grammar.conditional")
st("s16", "q7", "q7-e1", "mcq", "ما محلّ جملة «يأكل الغابَ السّحيقة» من الإعراب في قوله: «وسراجٌ يأكل الغابَ السّحيقة»؟",
   {"options": ["جملة فعليّة في محلّ رفع نعت لـ«سراج»", "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب مفعول به",
                "جملة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "جملة «يأكل الغاب السّحيقة»: جملة فعليّة في محلّ رفع نعت لـ«سراج».", 0.5, "ar.grammar.sentence_case")
IMG1 = ("«وإذا البارود عربد»: استعارة مكنيّة، حيث شبّه البارود بإنسان وحذف المشبّه به وأبقى شيئًا من لوازمه «عربد» على سبيل الاستعارة المكنيّة. "
        "وأثرها البلاغيّ: تقوية المعنى وتجسيده وتوضيحه.")
st("s17", "q8", "q8-e1", "mcq", "ما نوع الصّورة البيانيّة في «وإذا البارود عربد»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن صفة"]},
   {"correct": 0}, IMG1, 0.5, "ar.rhetoric.metaphor")
st("s18", "q8", "q8-e1", "fill_blank", "أكمل شرح الصّورة في «وإذا البارود عربد»:",
   {"text": "شبّه البارود بـ____ وحذف المشبّه به وأبقى شيئًا من لوازمه «____».", "bank": ["إنسان", "عربد", "رعد", "البارود"]},
   {"blanks": [["إنسان"], ["عربد"]]}, IMG1, 0.5, "ar.rhetoric.metaphor", "b")
st("s19", "q8", "q8-e2", "mcq", "ما أثر الاستعارة في «وإذا البارود عربد» في المعنى؟",
   {"options": ["تقوية المعنى وتجسيده وتوضيحه", "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ تطرب له الأذن", "إظهار المعنى بذكر ضدّه"]},
   {"correct": 0}, IMG1, 0.5, "ar.rhetoric.effect")
IMG2 = ("«قدمي الدّامي دروب شائكات»: تشبيه بليغ، حيث شبّه القدم الدّامي بدروب شائكة، وحذف الأداة ووجه الشّبه، وأبقى على المشبّه والمشبّه به. "
        "وأثره البلاغيّ: توضيح المعنى وتوكيده.")
st("s20", "q8", "q8-e3", "mcq", "ما نوع الصّورة البيانيّة في «قدمي الدّامي دروبٌ شائكاتٌ»؟",
   {"options": ["تشبيه بليغ", "استعارة مكنيّة", "استعارة تصريحيّة", "كناية عن موصوف"]},
   {"correct": 0}, IMG2, 0.5, "ar.rhetoric.simile")
st("s21", "q8", "q8-e3", "matching", "اشرح التّشبيه في «قدمي الدّامي دروبٌ شائكاتٌ»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به", "المحذوف من أركان التّشبيه"], "rights": ["القدم الدّامي", "دروب شائكة", "الأداة ووجه الشّبه", "الغاب السّحيقة"]},
   {"pairs": [0, 1, 2]}, IMG2, 0.5, "ar.rhetoric.simile", "b")
st("s22", "q8", "q8-e4", "mcq", "ما أثر التّشبيه في «قدمي الدّامي دروبٌ شائكاتٌ» في المعنى؟",
   {"options": ["توضيح المعنى وتوكيده", "تشخيص الجماد وبثّ الحياة فيه", "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, IMG2, 0.5, "ar.rhetoric.effect")
PRO_EXPL = ("التّقطيع: «ال عيونل / حم رنشوى / في تحددن / تع برل لح / ظتلن نص / رل مؤك كد» = /0//0/0 /0//0/0 /0//0/0 /0//0/0 ///0/0 /0//0/0 "
            "= فاعلاتن فاعلاتن فاعلاتن فاعلاتن فعلاتن فاعلاتن. القصيدة من بحر الرّمل. "
            "(يطبع التّصحيح الرّموز بترتيب بصريّ من اليمين؛ كُتبت هنا من اليسار كالمعتاد.)")
st("s23", "q9", "q9-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر الأوّل «العيونُ الحُمْرُ نشوى في تحَدّ تعبُر اللّحظة للنّصر المُؤكَّد»:",
   {"text": "ال عيونل / حم رنشوى / ____ / تع برل لح / ____ / رل مؤك كد", "bank": ["في تحددن", "ظتلن نص", "في تحدن", "ظتلنن نص"]},
   {"blanks": [["في تحددن"], ["ظتلن نص"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s24", "q9", "q9-e1", "mcq", "ما رموز السّطر الأوّل وتفعيلاته؟",
   {"options": ["/0//0/0 /0//0/0 /0//0/0 /0//0/0 ///0/0 /0//0/0 = فاعلاتن فاعلاتن فاعلاتن فاعلاتن فعلاتن فاعلاتن",
                "/0//0/0 /0//0/0 /0//0/0 /0//0/0 /0//0/0 /0//0/0 = فاعلاتن فاعلاتن فاعلاتن فاعلاتن فاعلاتن فاعلاتن",
                "/0/0//0 /0/0//0 /0/0//0 /0/0//0 //0//0 /0/0//0 = مستفعلن مستفعلن مستفعلن مستفعلن متفعلن مستفعلن",
                "/0//0 /0//0 /0//0 /0//0 ///0 /0//0 = فاعلن فاعلن فاعلن فاعلن فعلن فاعلن"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s25", "q9", "q9-e2", "mcq", "من أيّ بحر القصيدة؟",
   {"options": ["الرّمل", "الرّجز", "المتدارك", "الكامل"]}, {"correct": 0}, PRO_EXPL, 0.5, "ar.prosody")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_SPEC = {"task": "مفهوم الالتزام في الأدب الحديث، ومدى التزام الأديب الحديث به، مع أمثلة من الواقع", "question": _fix(PARAS[40], NQ_BAD, NQ_OK),
             "scheme": "مفهوم الالتزام في الأدب الحديث (1) – مدى التزام الأدباء المحدثين به (2) – دعم الإجابة بالأمثلة (1)؛ لا يقدّم التّصحيح نموذجًا للإجابة",
             "model_example": None}
CRIT_EXPL = "يُقيَّم الجواب وفق ثلاثة معايير: مفهوم الالتزام في الأدب الحديث (1)، مدى التزام الأدباء المحدثين به (2)، دعم الإجابة بالأمثلة (1)."
for sid, eid, crit, ind, pts in [("s26", "q10-e1", "المفهوم", "مفهوم الالتزام في الأدب الحديث", 1),
                                 ("s27", "q10-e2", "مدى الالتزام", "مدى التزام الأدباء المحدثين بفكرة الالتزام", 2),
                                 ("s28", "q10-e3", "الأمثلة", "دعم الإجابة بأمثلة من الواقع", 1)]:
    essay(sid, "q10", eid, "فكرة الالتزام في الأدب الحديث", crit, ind, pts, CRIT_SPEC, CRIT_EXPL, "ar.literature.trend")

TITLE = "بكالوريا 2009 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (محمّد الصّالح باوية: ساعة الصّفر)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2009، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
         f"مولَّد من ملفّ docx ومقابَل سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: «بیانیتان» (ياء فارسيّة) ← «بيانيتان»، «الَّنقديّة» ← «النّقديّة». "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1، صورة ممسوحة قُرئت مصوّرة؛ رموز التّقطيع مكتوبة هنا من اليسار). "
         "البناء اللّغويّ س1: قُرئت العلامتان 0.5 + 0.5 لكلمتي «يرمي» و«صموتا» (مجموع المحور 06). "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. مؤجَّل (essay_builder): نثر المقطع س4 (3×1) والتّقويم النّقديّ (1 + 2 + 1، معايير دون نموذج).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
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
