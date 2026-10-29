"""Conversion: BAC 2015 (session عاديّة، جوان 2015) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (أحمد أمين، البيت والأخلاق).
Exam (most faithful source): gdrive 1lnB0EveGFULkEW1SYNHD-NWCTtVzBssq (بكالوريا العربية 2015 شعبة علوم تجريبية.docx);
same paper as PDF (owner's retyped copy): gdrive 1j0F06FDir_-ziJe7C_PODl4Feu_mm7oL (BAC 2015 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1CJcmkoCsZcH8xqOxja271Joc6XyqWemv (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «عناصر الإجابة»): gdrive 1LDaYPTWwcuGXX4Awo8a1FDDMcccl5aa9 (02_التصحيح.pdf, page 2).

Method (as build_ar_bac_2018_lit_p1.py / build_ar_bac_2019_lit_p1.py): PARAS below were generated from the .docx with
python-docx (paragraph text read exactly; only outer whitespace and outer direction marks trimmed) and every verbatim string
of the JSON was re-checked programmatically against the docx. The docx was compared page by page with the official ONEC
paper (rendered at 150 dpi): same text (three paragraphs, same underlined/bracketed targets), same questions. The correction
is a scanned PDF, read from the rendered page (150 dpi, then 300 dpi crops). Every mark comes from the official scheme;
correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE.
- Docx vs ONEC: Q1 reads «عَم يتحدّث الكاتب في هذا النّص؟ إلآم يهدف؟» (ONEC «عَمَّ … وإلامَ يهدف؟»), «(12 نقاط)» (ONEC «نقطة»),
  «بمأواه، ذلك» (ONEC «بمأواه؛ ذلك») — spelling/punctuation variants, docx kept.
- Rule for «n×m» lines (as in the 2017–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×01» = topic / aim. Q2 «2×1.25» = the comparison (the human's bond is stronger) / the writer's justification.
- Q3 «2×01» for «ما أهمّ الدّروس…؟ اذكرها في فقرة وجيزة من إنشائك» (unlabelled) ⇒ 1 the lessons (interactive) + 1 the
  paragraph of the candidate's own writing (deferred essay_builder, rule 11) — split to be confirmed by the owner.
- Q4 «2×1.25» = the meaning (interactive) + the opinion («على المترشّح إبداء رأيه فيه» ⇒ deferred essay_builder).
- Q5 «01 + 2×01» = the type (1) + two indicators among the three listed («للمترشّح ذكر مؤشّرات أخرى») ⇒ one element of 2;
  the steps only use the scheme's three indicators (no textual examples are given by the scheme).
- Part 2 Q1 «01». Q2 «4×0.5» one element per item. Q3 «01». Q4 «3×0.5»: three connectors among the four listed (الواو،
  هذه، الضّمائر، التّكرار) ⇒ one element of 1.5; the multi-select distractors are connectors absent from paragraph 2 (ثمّ، لكنّ),
  so that no connector really present there (e.g. الفاء) is marked wrong. Q5 «2×1.25» = one element per image.
- «إنّما هو كالثّوب الجميل»: the scheme says «تشبيه عاديّ» ⇒ no «تشبيه مرسل/مجمل/تامّ/تمثيليّ» distractor; «خشونة القول»
  (استعارة مكنيّة) has no «كناية» distractor; «الصّوت» (بدل) has no «نعت/عطف بيان» distractor; Q5 type has no «الحجاجيّ» distractor.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2015-sci-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1lnB0EveGFULkEW1SYNHD-NWCTtVzBssq"
DOCX_TITLE = "بكالوريا العربية 2015 شعبة علوم تجريبية.docx"
PDF_ID = "1j0F06FDir_-ziJe7C_PODl4Feu_mm7oL"
OFFICIAL_ID = "1CJcmkoCsZcH8xqOxja271Joc6XyqWemv"
CORR_ID = "1LDaYPTWwcuGXX4Awo8a1FDDMcccl5aa9"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    22: '"...إن علاقة الإنسان ببيته أقوى من علاقة الحيوان بمأواه، ذلك لأنّ حاجة الحيوان الصّغير إلى أبويه قليلة إذا (قيست بحاجة الطّفل)، فصغار الطّيور مثلا بعد أسابيع قليلة تقوى وتطير، وتفارق عشّها وتستقل بنفسها، وتبني لها عشّا خاصًا بها، وتضعف علاقتها بآبائها إن كان ثمَّ علاقة. أمّا الطّفل فلا بدّ له من سنين طويلة حتّى يستطيع أن يستقل بنفسه، وإذا استقلّ فلا تزال العلاقة بينه وبين أسرته قويّة متينة وسبب ذلك أنَّ بناء الإنسان أكثر تركّبا، ومطالب الحياة لديه أكثر تعقدا، فهو يحتاج إلى زمن أطول حتّى يتسلّح للكفاح في هذا العالم، ويؤدّي واجبه.',
    23: 'في هذا البيت يتعلّم الطفل أهمّ دروس الحياة، ولو خرج إلى العالم قبل أن يستكمل تربيته المنزلية لكان متوحّشا، فالبيت في الحقيقة هو أكبر مُمدّن له. في هذا البيت يتعلّم كثيرا من الدروس فمن حبّه لإخوته وأخواته ووالديه يتعلّم درس حب الحياة وحب وطنه، وَمِنْ طاعته لوالديه يتعلّم طاعة قوانين البلاد وقوانين الأخلاق. يجب على كل فرد في الأسرة أن يعمل على أن يكون بيته أسعد مكان، فخشونة المعاملة وخشونة القول والإساءة وإثارة الشّحناء ونحو ذلك، كل هذه إذا كانت خارج البيت رذيلة، فهي في البيت أرذل.',
    24: 'ومما يُؤسَفُ له أنَّ كثيرا من النّاس يتجمّلون في أخلاقهم مع أصدقائهم وَمَنْ (يتعاملون معهم) فإذا حلّوا في بيتهم، تبدّلت أخلاقهم إلى قسوة وخشونة وفظاظة، وانقلب ذلك الصوت الهادئ المؤدب إلى هجر في القول وسوء في الأدب. والحق أن أدلّ شيء على الأخلاق الحقيقية هو خلق البيت لا خلُق الشارع، فخلق الشارع خلق التّصنّع، والاختلاف في المعاملة بين أهل بيته وَمَنْ في الخارج يدل على أن الخلُق الجميل ليس شيئا في نفسه، وإنّما هو كالثوب الجميل يلبسه إذا خرج ويخلعه إذا عاد!".',
    25: '- أحمد أمين –',
    27: 'أوّلا- البناء الفكري: (12 نقاط)',
    28: 'عَم يتحدّث الكاتب في هذا النّص؟ إلآم يهدف؟',
    29: 'عقد الكاتب مقارنة بين علاقة الحيوان بمأواه، والإنسان ببيته. وضّحها بأسلوبك الخاص.',
    30: 'ما أهم الدروس التي يتلقاها الطّفل في البيت في نظر الكاتب؟',
    31: 'اذكرها في فقرة وجيزة من إنشائك.',
    32: 'ختم الكاتب نصّه بعبارة "وإنّما هو كالثوب الجميل يلبسه إذا خرج ويخلعه إذا عاد".',
    33: 'ما المقصود بهذه العبارة؟ وما رأيك فيها؟',
    34: 'ما النّمط الغالب على النّص؟ اذكر مؤشرين له مع التمثيل من النّص.',
    35: 'ثانيا- البناء اللّغوي: (08 نقاط)',
    36: 'ما الحقل الدّلالي الذي تنتمي إليه الألفاظ التالية: "يتعلّم - الدّروس - تربيته - طاعة"؟',
    37: 'أعرب لفظة "تعقدا" في الفقرة الأولى، ولفظة "الصّوت" في الفقرة الثالثة إعراب مفردات.',
    38: 'وبيّن المحل الإعرابي للجملتين الواردتين بين قوسين في الفقرة الأولى والثالثة.',
    39: 'خلا النّص من الأسلوب الإنشائي. وضّح سبب ذلك.',
    40: 'استخرج من الفقرة الثانية ثلاثة روابط مختلفة حققت الاتّساق والانسجام.',
    41: 'في العبارتين التاليتين صورتان بيانيتان. اشرحهما مبيّنا نوعيهما وسرّ بلاغتهما:',
    42: '"خشونة القول".',
    43: '"إنما هو كالثوب الجميل".',
}
assert PARAS[27].startswith("أوّلا") and PARAS[35].startswith("ثانيا") and PARAS[25].endswith("–")

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2 = PARAS[27], PARAS[35]
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": J(22, 23, 24)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[25]},
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


q("q1", "1", P1, J(28), 2, [el("q1-e1", "موضوع النّصّ", 1), el("q1-e2", "هدف الكاتب", 1)])
q("q2", "2", P1, J(29), 2.5, [el("q2-e1", "المقارنة: علاقة الإنسان ببيته أقوى من علاقة الحيوان بمأواه", 1.25), el("q2-e2", "تبرير الكاتب لذلك", 1.25)])
q("q3", "3", P1, J(30, 31), 2, [el("q3-e1", "أهمّ الدّروس الّتي يتلقّاها الطّفل في البيت", 1), el("q3-e2", "صياغتها في فقرة وجيزة من إنشاء المترشّح", 1)])
q("q4", "4", P1, J(32, 33), 2.5, [el("q4-e1", "المقصود بالعبارة", 1.25), el("q4-e2", "الرّأي فيها", 1.25)])
q("q5", "5", P1, J(34), 3, [el("q5-e1", "النّمط الغالب", 1), el("q5-e2", "مؤشّران مع التّمثيل (2×01)", 2)])
q("q6", "1", P2, J(36), 1, [el("q6-e1", "الحقل الدّلاليّ", 1)])
q("q7", "2", P2, J(37, 38), 2, [el("q7-e1", "إعراب «تعقدا»", 0.5), el("q7-e2", "إعراب «الصّوت»", 0.5),
                                el("q7-e3", "محلّ جملة (قيست بحاجة الطّفل)", 0.5), el("q7-e4", "محلّ جملة (يتعاملون معهم)", 0.5)])
q("q8", "3", P2, J(39), 1, [el("q8-e1", "سبب خلوّ النّصّ من الأسلوب الإنشائيّ", 1)])
q("q9", "4", P2, J(40), 1.5, [el("q9-e1", "ثلاثة روابط مختلفة حقّقت الاتّساق والانسجام (3×0.5)", 1.5)])
q("q10", "5", P2, J(41, 42, 43), 2.5, [el("q10-e1", "«خشونة القول»: النّوع والشّرح وسرّ البلاغة", 1.25),
                                       el("q10-e2", "«إنّما هو كالثّوب الجميل»: النّوع والشّرح وسرّ البلاغة", 1.25)])

# ── أ- البناء الفكريّ ──
Q1_EXPL = "يتحدّث الكاتب في هذا النّصّ عن أهمّيّة الأسرة في حياة الفرد وسلوكه، ويهدف إلى بناء الفرد الصّالح في إطار الأسرة المتماسكة."
st("s01", "q1", "q1-e1", "mcq", "عمَّ يتحدّث أحمد أمين في هذا النّصّ؟",
   {"options": ["عن أهمّيّة الأسرة في حياة الفرد وسلوكه", "عن حياة الطّيور وطرق بنائها لأعشاشها", "عن آداب الشّارع والطّريق", "عن أهمّيّة المدرسة في تكوين الطّفل"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل موضوع النّصّ:",
   {"text": "يتحدّث الكاتب عن أهمّيّة ____ في حياة الفرد و____.", "bank": ["الأسرة", "سلوكه", "المدرسة", "ثروته"]},
   {"blanks": [["الأسرة"], ["سلوكه"]]}, Q1_EXPL, 0.5, "ar.comprehension.idea", "b")
st("s03", "q1", "q1-e2", "mcq", "إلامَ يهدف الكاتب في هذا النّصّ؟",
   {"options": ["إلى بناء الفرد الصّالح في إطار الأسرة المتماسكة", "إلى دعوة الأبناء إلى الاستقلال المبكّر عن أسرهم",
                "إلى المقارنة بين أنواع الطّيور وأعشاشها", "إلى تزيين البيوت وتجميلها"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.purpose")
st("s04", "q1", "q1-e2", "fill_blank", "أكمل هدف الكاتب:",
   {"text": "يهدف الكاتب إلى بناء الفرد ____ في إطار الأسرة ____.", "bank": ["الصّالح", "المتماسكة", "الغنيّ", "المتفكّكة"]},
   {"blanks": [["الصّالح"], ["المتماسكة"]]}, Q1_EXPL, 0.5, "ar.comprehension.purpose", "b")
Q2_EXPL = "علاقة الإنسان ببيته هي علاقة ارتباط متين ومستمرّ، فهي أقوى من علاقة الحيوان بمأواه. ويبرّر الكاتب ذلك بأنّ بناء الإنسان أكثر تعقيدًا وحاجاته أكبر."
st("s05", "q2", "q2-e1", "mcq", "كيف يرى الكاتب علاقة الإنسان ببيته مقارنةً بعلاقة الحيوان بمأواه؟",
   {"options": ["علاقة ارتباط متين ومستمرّ، فهي أقوى من علاقة الحيوان بمأواه", "علاقة ضعيفة تنتهي بعد أسابيع قليلة كعلاقة الطّيور بأعشاشها",
                "علاقة مساوية لعلاقة الحيوان بمأواه", "علاقة مؤقّتة تنقطع حين يستقلّ الإنسان بنفسه"]},
   {"correct": 0}, Q2_EXPL, 0.75, "ar.comprehension.link")
st("s06", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "علاقة الإنسان ببيته هي علاقة ارتباط ____ و____، فهي أقوى من علاقة الحيوان بمأواه.", "bank": ["متين", "مستمرّ", "ضعيف", "مؤقّت"]},
   {"blanks": [["متين"], ["مستمرّ"]]}, Q2_EXPL, 0.5, "ar.comprehension.link", "b")
st("s07", "q2", "q2-e2", "mcq", "بمَ يبرّر الكاتب قوّة علاقة الإنسان ببيته؟",
   {"options": ["بأنّ بناء الإنسان أكثر تعقيدًا وحاجاته أكبر", "بأنّ الإنسان أقوى جسدًا من الحيوان", "بأنّ بيوت النّاس أجمل من أعشاش الطّيور",
                "بأنّ الحيوان لا يحتاج إلى أبويه إطلاقًا"]},
   {"correct": 0}, Q2_EXPL, 0.75, "ar.comprehension.link")
st("s08", "q2", "q2-e2", "fill_blank", "أكمل تبرير الكاتب:",
   {"text": "لأنّ بناء الإنسان أكثر ____ وحاجاته ____.", "bank": ["تعقيدًا", "أكبر", "بساطةً", "أقلّ"]},
   {"blanks": [["تعقيدًا"], ["أكبر"]]}, Q2_EXPL, 0.5, "ar.comprehension.link", "b")
Q3_EXPL = "ينظر الكاتب إلى البيت على أنّه أكبر مدرسة للحياة، تعلّمه الأخلاق والتّمدّن، وتعدّه لحبّ الوطن وطاعة قوانين البلاد."
st("s09", "q3", "q3-e1", "multi", "ما أهمّ الدّروس الّتي يتلقّاها الطّفل في البيت في نظر الكاتب؟ (اختر كلّ ما يصحّ)",
   {"options": ["الأخلاق", "التّمدّن", "حبّ الوطن", "طاعة قوانين البلاد", "التّصنّع في المعاملة", "الاستقلال المبكّر عن الأسرة"]},
   {"correct": [0, 1, 2, 3]}, Q3_EXPL, 0.5, "ar.comprehension.values")
st("s10", "q3", "q3-e1", "fill_blank", "أكمل:",
   {"text": "ينظر الكاتب إلى البيت على أنّه أكبر ____ للحياة، تعلّمه الأخلاق و____، وتعدّه لحبّ الوطن و____ قوانين البلاد.",
    "bank": ["مدرسة", "التّمدّن", "طاعة", "سجن", "التّصنّع", "مخالفة"]},
   {"blanks": [["مدرسة"], ["التّمدّن"], ["طاعة"]]}, Q3_EXPL, 0.5, "ar.comprehension.values", "b")
essay("s11", "q3", "q3-e2", "أهمّ الدّروس الّتي يتلقّاها الطّفل في البيت", "فقرة وجيزة من إنشاء المترشّح",
      "صياغة الدّروس (الأخلاق، التّمدّن، حبّ الوطن، طاعة قوانين البلاد) في فقرة وجيزة بأسلوب المترشّح", 1,
      {"task": "فقرة وجيزة من إنشاء المترشّح", "question": J(30, 31), "model": Q3_EXPL, "scheme": "2×01 (دون تفصيل)"},
      Q3_EXPL + " والفقرة من إنشاء المترشّح.", "ar.writing.sentence")
Q4_EXPL = "المقصود بعبارة «وإنّما هو كالثّوب الجميل يلبسه إذا…» هو التّصنّع الّذي يبديه الإنسان في الشّارع على خلاف خلقه داخل البيت، فأصبح كالثّوب يلبسه ويخلعه."
st("s12", "q4", "q4-e1", "mcq", "ما المقصود بعبارة «وإنّما هو كالثّوب الجميل يلبسه إذا خرج ويخلعه إذا عاد»؟",
   {"options": ["التّصنّع الّذي يبديه الإنسان في الشّارع على خلاف خلقه داخل البيت", "حرص الإنسان على اختيار ثيابه الجميلة عند الخروج",
                "ثبات أخلاق الإنسان داخل البيت وخارجه", "تواضع الإنسان مع أصدقائه وتكبّره على الغرباء"]},
   {"correct": 0}, Q4_EXPL, 0.75, "ar.comprehension.explain")
st("s13", "q4", "q4-e1", "fill_blank", "أكمل شرح العبارة:",
   {"text": "هو ____ الّذي يبديه الإنسان في الشّارع على خلاف ____ داخل البيت، فأصبح كالثّوب يلبسه ويخلعه.", "bank": ["التّصنّع", "خلقه", "الصّدق", "ثوبه"]},
   {"blanks": [["التّصنّع"], ["خلقه"]]}, Q4_EXPL, 0.5, "ar.comprehension.explain", "b")
essay("s14", "q4", "q4-e2", "عبارة «وإنّما هو كالثّوب الجميل…»", "إبداء الرّأي",
      "يبدي المترشّح رأيه في العبارة مع التّعليل", 1.25,
      {"task": "إبداء الرّأي", "question": J(32, 33), "scheme": "«على المترشّح إبداء رأيه فيه» (2×1.25: المقصود + الرّأي)"},
      Q4_EXPL + " والرّأي من إنشاء المترشّح (على المترشّح إبداء رأيه فيه).", "ar.comprehension.opinion")
st("s15", "q5", "q5-e1", "mcq", "ما النّمط الغالب على نصّ أحمد أمين؟",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]},
   {"correct": 0}, "النّمط الغالب على النّصّ تفسيريّ.", 1, "ar.text.type")
Q5_EXPL = ("من مؤشّرات النّمط التّفسيريّ: 1) الشّرح والتّفسير (اختيار عبارات دالّة على الشّرح)، 2) التّفصيل بعد الإجمال (يظهر في الفقرة الأولى)، "
           "3) التّعليل والتّدليل والاستنتاج. وللمترشّح ذكر مؤشّرات أخرى.")
st("s16", "q5", "q5-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط التّفسيريّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الشّرح والتّفسير", "التّفصيل بعد الإجمال", "التّعليل والتّدليل والاستنتاج", "الحوار بين الشّخصيّات", "تتابع الأحداث في الزّمن",
                "كثرة الأساليب الإنشائيّة"]},
   {"correct": [0, 1, 2]}, Q5_EXPL + " أمّا الحوار وتتابع الأحداث فليسا من مؤشّرات هذا النّصّ، والنّصّ خالٍ من الأسلوب الإنشائيّ.", 1, "ar.text.type")
st("s17", "q5", "q5-e2", "fill_blank", "أكمل مؤشّرات النّمط التّفسيريّ:",
   {"text": "الشّرح و____؛ التّفصيل بعد ____ (يظهر في الفقرة الأولى)؛ التّعليل والتّدليل و____.",
    "bank": ["التّفسير", "الإجمال", "الاستنتاج", "السّرد", "الحوار", "التّشويق"]},
   {"blanks": [["التّفسير"], ["الإجمال"], ["الاستنتاج"]]}, Q5_EXPL, 1, "ar.text.type", "b")
# ── ب- البناء اللّغويّ ──
st("s18", "q6", "q6-e1", "mcq", "ما الحقل الدّلاليّ الّذي تنتمي إليه الألفاظ: «يتعلّم – الدّروس – تربيته – طاعة»؟",
   {"options": ["التّربية – الأخلاق", "الطّبيعة", "الحرب والكفاح", "الحزن والأسى"]},
   {"correct": 0}, "الحقل الدّلاليّ الّذي تنتمي إليه الألفاظ (يتعلّم – الدّروس – تربيته – طاعة): التّربية – الأخلاق.", 1, "ar.cohesion.effect")
st("s19", "q7", "q7-e1", "mcq", "ما إعراب «تعقدا» في قوله: «ومطالب الحياة لديه أكثر تعقدا»؟",
   {"options": ["تمييز اسم التّفضيل منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها",
                "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول لأجله منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«تعقدا»: تمييز اسم التّفضيل («أكثر») منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s20", "q7", "q7-e2", "mcq", "ما إعراب «الصّوت» في قوله: «وانقلب ذلك الصوت الهادئ المؤدب»؟",
   {"options": ["بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة",
                "مبتدأ مؤخّر مرفوع وعلامة رفعه الضّمّة الظّاهرة", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة"]},
   {"correct": 0}, "«الصّوت»: بدل من اسم الإشارة («ذلك») مرفوع وعلامة رفعه الضّمّة الظّاهرة.", 0.5, "ar.grammar.badal")
st("s21", "q7", "q7-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (قيست بحاجة الطّفل) في الفقرة الأولى؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة جواب شرط غير جازم لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(قيست بحاجة الطّفل): جملة فعليّة في محلّ جرّ مضاف إليه (بعد «إذا»).", 0.5, "ar.grammar.sentence_case")
st("s22", "q7", "q7-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (يتعاملون معهم) في الفقرة الثّالثة؟",
   {"options": ["جملة فعليّة صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(يتعاملون معهم): جملة فعليّة صلة موصول («مَن») لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
INSHA_EXPL = "سبب خلوّ النّصّ من الأسلوب الإنشائيّ هو عدم مناسبته للنّمط التّفسيريّ الّذي يغلب عليه الشّرح والتّفسير."
st("s23", "q8", "q8-e1", "mcq", "لماذا خلا النّصّ من الأسلوب الإنشائيّ؟",
   {"options": ["لعدم مناسبته للنّمط التّفسيريّ الّذي يغلب عليه الشّرح والتّفسير", "لأنّ الكاتب يخاطب الأطفال وحدهم",
                "لأنّ النّصّ قصيدة موزونة", "لأنّ الكاتب يروي قصّة متسلسلة الأحداث"]},
   {"correct": 0}, INSHA_EXPL, 0.5, "ar.rhetoric.style")
st("s24", "q8", "q8-e1", "fill_blank", "أكمل:",
   {"text": "سبب خلوّ النّصّ من الأسلوب الإنشائيّ هو عدم مناسبته للنّمط ____ الّذي يغلب عليه الشّرح و____.", "bank": ["التّفسيريّ", "التّفسير", "السّرديّ", "الحوار"]},
   {"blanks": [["التّفسيريّ"], ["التّفسير"]]}, INSHA_EXPL, 0.5, "ar.rhetoric.style", "b")
LINK_EXPL = ("الرّوابط في الفقرة الثّانية: «الواو» حقّقت الاتّساق بين الجمل السّابقة واللّاحقة؛ «هذه» اسم إشارة يعود على مشار إليه سابق ربط بين معنيين وحقّق الانسجام بينهما؛ "
             "الضّمائر (المنفصلة والمتّصلة)؛ التّكرار (لفظة البيت). يكفي ثلاثة روابط.")
st("s25", "q9", "q9-e1", "multi", "أيّ ممّا يلي من الرّوابط الّتي حقّقت الاتّساق والانسجام في الفقرة الثّانية؟ (اختر كلّ ما يصحّ)",
   {"options": ["الواو", "اسم الإشارة «هذه»", "الضّمائر المنفصلة والمتّصلة", "تكرار لفظة «البيت»", "«ثمّ»", "«لكنّ»"]},
   {"correct": [0, 1, 2, 3]}, LINK_EXPL + " أمّا «ثمّ» و«لكنّ» فلم تردا في الفقرة الثّانية.", 0.75, "ar.cohesion.connectors")
st("s26", "q9", "q9-e1", "matching", "طابق كلّ رابط بدوره في الفقرة الثّانية.",
   {"lefts": ["«الواو»", "«هذه»", "التّكرار"],
    "rights": ["حقّقت الاتّساق بين الجمل السّابقة واللّاحقة", "اسم إشارة يعود على مشار إليه سابق، ربط بين معنيين وحقّق الانسجام بينهما", "تكرار لفظة «البيت»",
               "أداة استدراك تربط بين معنيين متضادّين"]},
   {"pairs": [0, 1, 2]}, LINK_EXPL, 0.75, "ar.cohesion.connectors", "b")
IMG1 = "«خشونة القول»: استعارة مكنيّة؛ حيث شبّه القول بشيء مادّيّ وأعطاه صفة الخشونة فحذف المشبّه به. بلاغتها: تقوية المعنى وتجسيده."
st("s27", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في «خشونة القول»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "تشبيه تمثيليّ"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.metaphor")
st("s28", "q10", "q10-e1", "fill_blank", "اشرح الصّورة في «خشونة القول»:",
   {"text": "شبّه القول بشيء ____ وأعطاه صفة ____، فحذف المشبّه به.", "bank": ["مادّيّ", "الخشونة", "معنويّ", "اللّين"]},
   {"blanks": [["مادّيّ"], ["الخشونة"]]}, IMG1, 0.5, "ar.rhetoric.metaphor", "b")
st("s29", "q10", "q10-e1", "mcq", "ما سرّ بلاغة الصّورة في «خشونة القول»؟",
   {"options": ["تقوية المعنى وتجسيده", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين المعنيين"]},
   {"correct": 0}, IMG1, 0.5, "ar.rhetoric.effect", "c")
IMG2 = "«إنّما هو كالثّوب الجميل…»: تشبيه عاديّ، شبّه خلق التّصنّع بالثّوب الجميل. بلاغتها: تقوية المعنى وإيضاحه من خلال تقريب الصّورة."
st("s30", "q10", "q10-e2", "mcq", "ما نوع الصّورة البيانيّة في «إنّما هو كالثّوب الجميل»؟",
   {"options": ["تشبيه عاديّ", "تشبيه بليغ", "استعارة تصريحيّة", "كناية عن صفة"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.simile")
st("s31", "q10", "q10-e2", "matching", "حدّد أركان التّشبيه في «إنّما هو كالثّوب الجميل»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه", "أداة التّشبيه", "المشبّه به"], "rights": ["خلق التّصنّع (الضّمير «هو»)", "الكاف", "الثّوب الجميل", "البيت"]},
   {"pairs": [0, 1, 2]}, IMG2, 0.5, "ar.rhetoric.simile", "b")
st("s32", "q10", "q10-e2", "mcq", "ما سرّ بلاغة التّشبيه في «إنّما هو كالثّوب الجميل»؟",
   {"options": ["تقوية المعنى وإيضاحه من خلال تقريب الصّورة", "تشخيص المعنويّ وبثّ الحياة فيه", "إثبات الصّفة مصحوبة بدليلها", "إحداث جرس موسيقيّ في العبارة"]},
   {"correct": 0}, IMG2, 0.5, "ar.rhetoric.effect", "c")

TITLE = "بكالوريا 2015 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (أحمد أمين: البيت والأخلاق)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2015، شعب علوم تجريبيّة ورياضيات وتقني رياضي وتسيير واقتصاد) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "العلامات من عناصر الإجابة وسلّم التّنقيط الرّسميّين (ص2، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
         "س1 في docx «عَم … إلآم يهدف؟» (في الرّسميّ «عَمَّ … وإلامَ يهدف؟») فأُبقي docx. س3 «2×01»: الدّروس (تفاعليّ) + الفقرة من إنشاء المترشّح (مؤجَّلة)؛ "
         "س4 «2×1.25»: المقصود (تفاعليّ) + الرّأي (مؤجَّل، «على المترشّح إبداء رأيه فيه»). الرّوابط «3×0.5» ثلاثة من أربعة فعنصر واحد.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) وعناصر الإجابة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."

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
