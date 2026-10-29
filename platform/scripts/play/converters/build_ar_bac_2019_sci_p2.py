"""Conversion: BAC 2019 (session عاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (الفضيل الورتلانيّ، «الجزائر الثّائرة»).
Exam (most faithful source): gdrive 1dq9rWXm5_tH1FAenNytv0hXRBIoHYVws (بكالوريا العربية 2019 علوم تجريبية.docx);
same paper as PDF (owner's retyped copy): gdrive 1v6WwbxMieAQ3LaP_dycDErBcceOPjT1d (BAC 2019 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1_Do5yXwiul_Q_ZRld2B8LrUqs6cYuaFm (01_الموضوع.pdf, pages 3–4, read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1wl30Lc7mftCYHQBj851JXF3wTYVx3VyX (02_التصحيح.pdf, pages 3–4).

Method (same as the BAC 2020–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; outer whitespace / direction marks trimmed; the invisible RLM inside the text «اليوم ‏ -بحمد الله -» and
inside question «(اللّغة - الأمّة ‏- المدرسة - القوانين)» is kept as in the docx). The correction PDF's text layer is
reversed presentation-form Arabic, so the mark scheme was read from the rendered pages (150 dpi, fully legible). Every mark
comes from the official scheme; correct options and explanations condense its wording. The docx text matches the official
paper (only diacritic/spacing differences, e.g. «تخْضَعْ» for «تَخْضَعُ»; kept as in the docx). The docx question 3 has no
«أ-/ب-» labels (the official paper has them); kept as in the docx.

Conversion notes / points for the owner's review:
- Streams: the official header lists «علوم تجريبية، رياضيات، تسيير واقتصاد، تقني رياضي» ⇒ SCI, MATH, GE, TM.
- «ما تحته خطّ»: underlined in docx and official paper: «مَظهر» (paragraph 1), «لغة» (paragraph 2).
- Q1: 01 the idea + two importance lines of 0.5 each (both required) ⇒ three elements.
- Q2: «3×0.50» the colonizer's plan (three listed, one element) + 01 the people's reaction.
- Q3: «2×0.5» type «مقال اجتماعيّ» (one element, two steps: genre + kind) + three 0.5 lines for features («ثلاثًا منها»
  among five ⇒ one element of 1.5) + 01 type of discourse «تفسيريّ» + two 0.5 lines for indicators (two of seven ⇒ one element).
- Q4 (تلخيص) «3×01» = الإلمام بالمضمون / الحجم / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2 Q2: the scheme writes the sentence as «(كان للغة سلطان)» (the paper: «كان للمنطق سلطان») and calls it «جملة اسميّة في
  محلّ جرّ مضاف إليه»; the steps keep the scheme's wording and their distractors differ only in the محلّ.
- Part 2 Q3: six 0.5 lines = for each image: type, explanation, effect ⇒ six elements; for (إنّما تُرمى…) the type and
  the explanation are the one line «كناية عن صفة الاستهانة» (0.5 + 0.5).
- Part 2 Q4: two 0.5 lines (two cohesion devices among five) ⇒ one element + «2×0.5» examples ⇒ one element.
"""
import json, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2019-sci-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1dq9rWXm5_tH1FAenNytv0hXRBIoHYVws"
DOCX_TITLE = "بكالوريا العربية 2019 علوم تجريبية.docx"
PDF_ID = "1v6WwbxMieAQ3LaP_dycDErBcceOPjT1d"
OFFICIAL_ID = "1_Do5yXwiul_Q_ZRld2B8LrUqs6cYuaFm"
CORR_ID = "1wl30Lc7mftCYHQBj851JXF3wTYVx3VyX"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من فقرات ملفّ docx بـ python-docx: تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
TEXT2 = '«إنَّ اللّغة مَظهر مقدّس من مظاهر كرامة الأمّة التي تحترم نفسها، وعنوان من عناوين مجدها ووجودها... واللّغة العربيّة ليست لغة الجزائريّين وحدهم. وإنَّما هي لغة الأمّة العربيّة كافّة، وعنوان كرامتها ووجودها، فَمن أهانها إنَّما يُهين العربَ أجمعين، هذا هو المنطق يوم (كان للمنطق سلطان)، وعلى هذا الأساس أتحدّث اليوم إلى العرب عمّا أصاب لغتهم من ازدراء وإهانة في عُقْرِ دارها بالجزائر، وما ألحقه الفرنسيُّون بها في أرضها...\nاحتلّ الفرنسيُّون الجزائر... فوجدوا أهلها يدينون بالإسلام، ويتكلّمون بالعربيّة ويقدّسونها... فعزَّ على المستعمرين أن يكون لهذه الأمّة مقَدّساتٌ أو مقوّمات حياة، لأنّهم بيّتوا قتلها وإفناءها أو مَسْخَهَا على الأقلّ، فرأوا أن يصوّبوا أوّل ضربة حازمة إلى اللّغة، مظهر كرامة الأمّة و عنوان بقائها، فأصدروا قانونا يجعل اللّغة الفرنسيّة في الجزائر هي اللغة الرسميّة وحدها، وصيّروها لغة المدرسة ابتداءً من روضة الأطفال إلى الصّفوف العالية في الجامعة و جعلوها لغة المعاملة العامّة... إنّما الذي يعزُّ – و لا شك على القارئ - تصديقه هو أنّ الفرنسيّين "الديمقراطيين" قد أصدروا قانونا آخر يعتبرون اللّغة العربيّة بين أهلها لغة أجنبيّة، وهذا ما حصل بالذات، ولم يقف الأمْر عند هذا الحد، بل تجاوزه إلى اصطناع كل أنواع الإهانات لها، فكلّ مدرسة أهليّة للعربيّة (- إذا سمح بفتحها - ) إنَّما تخْضَعْ لقانون الصّحف الأجنبيّة، وإذا كَتبْت أنت إلى صديق لك رسالةً في الجزائر، وجعلت العنوان بالعربيّة، إنَّما ترمى في سلَّة المُهملات...لا يَحْسُن بي أَنْ أفارق القارئ العربيَّ قبل تطمينه على لغته ومظهر كرامته، فأؤكّد أنها اليوم \u200f -بحمد الله - في ألف خير، لأنَّ أهل الجزائر قد داسوا تلك القوانين الحقيرة بأقدامهم، واستهانوا بكلّ تعذيب يصيبهم في سبيلها، فرحّبوا بالسّجون والغرامات وبكل مؤلم من أجل لغتهم، فما زالوا كذلك حتّى عجزت بربريّة الاستعمار أمام إرادة الجزائريين الجبارة فسكتت مرغمة، ولو كانت قوانينها لاتزال نظرياً قائمة لكنّها غير منفذّة.\n... إنَّ وظيفتي هنا هي أَنْ أشكوَ إلى العرب ما أصاب لغتهم وعنوان مجدهم من إهانة ومطاردة، ثمّ لا أوصيهم بماذا يصنعون مع المجرمين لأنّهم أدرى».'
REF2 = 'الأستاذ: الفضيل الورتلاني- الجزائر الثّائرة -\nدار الهدى، الجزائر، 2009، ص96 وما بعدها -(بتصرّف)'
P2A = 'أوّلا- البناء الفكري: (12 نقاط)'
P2B = 'ثانيا- البناء اللّغوي: (08 نقاط)'
QT2 = ['ما هي الفكرة التي عالجها الكاتب في النّص؟ وما أهميّتها بالنسبة للأمّة في رأيه؟', 'وضع المستعمر خطة لضرب أحد مقوّمَات الأمة. وضّحها، وبيّن ردَّ فعل الشعب الجزائريّ إزاءها.', 'بيّن ما يلي:\nنوع النّص مع ذكر ثلاثٍ من خصائصه.\nنمطه مع ذكر مؤشّرين اثنين من مؤشّراته.', 'لَخّص مضمون النّص بأسلوبك الخاص.', 'حدّد الحقل الدلالي للألفاظ التالية: (اللّغة - الأمّة \u200f- المدرسة - القوانين).', 'أعرب:\nإعرابَ مفردات:\n«مظهر» الواردة في الفقرة الأولى.\n«لغة» الواردة في الفقرة الثانية.\nإعراب جمل:\n(كان للمنطق سلطان) الواردة في الفقرة الأولى.\n(إذا سُمِح بفتحها) الواردة في الفقرة الثانية.', 'بيّن مع الشّرح نوع الصّورة البيانيّة وبلاغتها في قوله:\n(إنَّما تُرمى في سلّة المُهملات).\n(فرحّبوا بالسّجون).', 'حَدّدْ في الفقرة الثانية مظهريْن من مظاهر الاتّساق مع التمثيل.']


def el(i, label, pts):
    return {"id": i, "label": label, "max_points": pts, "verified": False}


Q = []
def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill=None, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
              "prompt": f"{title} — معيار {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": ind}},
              "answer": {"type": "essay_builder", "spec": {"rubric": ind}}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


TEXT_DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": TEXT2},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": REF2},
]
D = TEXT_DOCS

q("q1", "1", P2A, QT2[0], 2, [el("q1-e1", "الفكرة الّتي عالجها الكاتب", 1), el("q1-e2", "أهمّيّتها: عنوان مجد الأمّة ووجودها", 0.5),
                              el("q1-e3", "أهمّيّتها: مظهر كرامتها", 0.5)], D)
q("q2", "2", P2A, QT2[1], 2.5, [el("q2-e1", "خطّة المستعمر لضرب اللّغة (3×0.5)", 1.5), el("q2-e2", "ردّ فعل الشّعب الجزائريّ", 1)], D)
q("q3", "3", P2A, QT2[2], 4.5, [el("q3-e1", "نوع النّصّ (2×0.5)", 1), el("q3-e2", "ثلاث من خصائصه (3×0.5)", 1.5),
                                el("q3-e3", "نمط النّصّ", 1), el("q3-e4", "مؤشّران من مؤشّراته (2×0.5)", 1)], D)
q("q4", "4", P2A, QT2[3], 3, [el("q4-e1", "التّلخيص: الإلمام بالمضمون", 1), el("q4-e2", "التّلخيص: الحجم", 1),
                              el("q4-e3", "التّلخيص: سلامة اللّغة", 1)], D)
q("q5", "1", P2B, QT2[4], 1, [el("q5-e1", "الحقل الدّلاليّ", 1)], D)
q("q6", "2", P2B, QT2[5], 2, [el("q6-e1", "إعراب «مظهر»", 0.5), el("q6-e2", "إعراب «لغة»", 0.5),
                              el("q6-e3", "محلّ جملة (كان للمنطق سلطان)", 0.5), el("q6-e4", "محلّ جملة (إذا سُمح بفتحها)", 0.5)], D)
q("q7", "3", P2B, QT2[6], 3, [el("q7-e1", "(إنّما تُرمى في سلّة المهملات): النّوع", 0.5), el("q7-e2", "(إنّما تُرمى في سلّة المهملات): الشّرح", 0.5),
                              el("q7-e3", "(إنّما تُرمى في سلّة المهملات): البلاغة", 0.5), el("q7-e4", "(فرحّبوا بالسّجون): النّوع", 0.5),
                              el("q7-e5", "(فرحّبوا بالسّجون): الشّرح", 0.5), el("q7-e6", "(فرحّبوا بالسّجون): البلاغة", 0.5)], D)
q("q8", "4", P2B, QT2[7], 2, [el("q8-e1", "مظهرا الاتّساق (2×0.5)", 1), el("q8-e2", "التّمثيل (2×0.5)", 1)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ما الفكرة الّتي عالجها الكاتب في النّصّ؟",
   {"options": ["قيمة اللّغة العربيّة في الأمّة الجزائريّة وموقف الاستعمار الفرنسيّ منها", "تاريخ احتلال فرنسا للجزائر ومراحله",
                "دعوة الجزائريّين إلى تعلّم اللّغة الفرنسيّة", "فضل المدرسة الفرنسيّة على التّعليم في الجزائر"]},
   {"correct": 0}, "عالج الكاتب في النّصّ قيمة اللّغة العربيّة في الأمّة الجزائريّة وموقف الاستعمار الفرنسيّ منها.", 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل الفكرة الّتي عالجها الكاتب:",
   {"text": "عالج الكاتب ____ اللّغة العربيّة في الأمّة الجزائريّة و____ الاستعمار الفرنسيّ منها.", "bank": ["قيمة", "موقف", "صعوبة", "خوف"]},
   {"blanks": [["قيمة"], ["موقف"]]}, "«عالج الكاتب في النّصّ قيمة اللّغة العربيّة في الأمّة الجزائريّة وموقف الاستعمار الفرنسيّ منها».", 0.5, "ar.comprehension.idea", "b")
st("s03", "q1", "q1-e2", "mcq", "ممّا تتمثّل فيه أهمّيّة اللّغة بالنّسبة للأمّة في رأي الكاتب أنّها:",
   {"options": ["عنوان مجد الأمّة ووجودها", "وسيلة للتّجارة مع الأمم الأخرى", "أداة لتعلّم العلوم الحديثة فحسب", "تراث قديم لا صلة له بالحاضر"]},
   {"correct": 0}, "تتمثّل أهمّيّتها في أنّها: عنوان مجد الأمّة ووجودها، ومظهر كرامتها.", 0.5, "ar.comprehension.details")
st("s04", "q1", "q1-e3", "fill_blank", "أكمل:",
   {"text": "واللّغة في رأي الكاتب ____ كرامة الأمّة.", "bank": ["مظهر", "عائق", "سبب ضعف"]},
   {"blanks": [["مظهر"]]}, "تتمثّل أهمّيّتها في أنّها: عنوان مجد الأمّة ووجودها، ومظهر كرامتها («إنّ اللّغة مظهر مقدّس من مظاهر كرامة الأمّة…»).", 0.5, "ar.comprehension.details")
st("s05", "q2", "q2-e1", "multi", "أيّ ممّا يلي من خطّة المستعمر لضرب اللّغة العربيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["جعل اللّغة الفرنسيّة اللّغة الرّسميّة في المدرسة والإدارة والمعاملة", "إهانة اللّغة العربيّة واعتبارها أجنبيّة بين أهلها",
                "إخضاع فتح المدارس الأهليّة للرّخصة من السّلطات الاستعماريّة", "فتح مدارس عربيّة حرّة في كلّ القرى", "اعتماد العربيّة لغة رسميّة إلى جانب الفرنسيّة"]},
   {"correct": [0, 1, 2]}, "خطّة المستعمر لضرب اللّغة: جعل اللّغة الفرنسيّة اللّغة الرّسميّة في المدرسة والإدارة والمعاملة، إهانة اللّغة العربيّة واعتبارها أجنبيّة بين أهلها، إخضاع فتح المدارس الأهليّة للرّخصة من السّلطات الاستعماريّة.", 1, "ar.comprehension.details")
st("s06", "q2", "q2-e1", "fill_blank", "أكمل من النّصّ:",
   {"text": "أصدر المستعمرون قانونًا يجعل اللّغة ____ في الجزائر هي اللّغة الرّسميّة وحدها، وقانونًا آخر يعتبرون اللّغة العربيّة بين أهلها لغة ____.",
    "bank": ["الفرنسيّة", "أجنبيّة", "العربيّة", "رسميّة"]},
   {"blanks": [["الفرنسيّة"], ["أجنبيّة"]]}, "«فأصدروا قانونا يجعل اللّغة الفرنسيّة في الجزائر هي اللغة الرسميّة وحدها… قد أصدروا قانونا آخر يعتبرون اللّغة العربيّة بين أهلها لغة أجنبيّة».", 0.5, "ar.comprehension.evidence", "b")
st("s07", "q2", "q2-e2", "mcq", "ما ردّ فعل الشّعب الجزائريّ إزاء خطّة المستعمر؟",
   {"options": ["رفض قوانين الإدارة الفرنسيّة وتحمّل الأذى في سبيل الحفاظ على لغته", "الخضوع للقوانين الفرنسيّة والتّخلّي عن العربيّة",
                "الهجرة الجماعيّة إلى البلاد العربيّة", "الاكتفاء بالشّكوى إلى الإدارة الفرنسيّة"]},
   {"correct": 0}, "ردّ فعل الشّعب: رفض قوانين الإدارة الفرنسيّة وتحمّل الأذى في سبيل الحفاظ على لغته.", 0.5, "ar.comprehension.details")
st("s08", "q2", "q2-e2", "fill_blank", "أكمل الشّاهد من النّصّ:",
   {"text": "«لأنَّ أهل الجزائر قد ____ تلك القوانين الحقيرة بأقدامهم… فرحّبوا بالسّجون و____ وبكل مؤلم من أجل لغتهم».",
    "bank": ["داسوا", "الغرامات", "احترموا", "المكافآت"]},
   {"blanks": [["داسوا"], ["الغرامات"]]}, "«لأنَّ أهل الجزائر قد داسوا تلك القوانين الحقيرة بأقدامهم، واستهانوا بكلّ تعذيب يصيبهم في سبيلها، فرحّبوا بالسّجون والغرامات وبكل مؤلم من أجل لغتهم».", 0.5, "ar.comprehension.evidence", "b")
st("s09", "q3", "q3-e1", "mcq", "إلى أيّ فنّ نثريّ ينتمي النّصّ؟",
   {"options": ["المقال", "الخطابة", "القصّة القصيرة", "المقامة"]},
   {"correct": 0}, "نوع النّصّ: مقال اجتماعيّ.", 0.5, "ar.literature.genre")
st("s10", "q3", "q3-e1", "mcq", "ما نوع هذا المقال؟",
   {"options": ["مقال اجتماعيّ", "مقال علميّ", "مقال أدبيّ نقديّ", "مقال فلسفيّ"]},
   {"correct": 0}, "نوع النّصّ: مقال اجتماعيّ.", 0.5, "ar.literature.genre", "b")
st("s11", "q3", "q3-e2", "multi", "أيّ ممّا يلي من خصائص المقال؟ (اختر كلّ ما يصحّ)",
   {"options": ["معالجة موضوع واحد", "المنهجيّة (مقدّمة – عرض – خاتمة)", "صغر الحجم", "المباشرة والوضوح", "يسر اللّغة والعناية بالفكرة",
                "الالتزام بالوزن والقافية", "تعدّد الشّخصيّات وتنامي الأحداث"]},
   {"correct": [0, 1, 2, 3, 4]}, "خصائصه: معالجة موضوع واحد، المنهجيّة (مقدّمة – عرض – خاتمة)، صغر الحجم، المباشرة والوضوح، يسر اللّغة والعناية بالفكرة. على الممتحن أن يذكر ثلاثًا منها.", 1, "ar.literature.prose")
st("s12", "q3", "q3-e2", "ordering", "من خصائص المقال المنهجيّة: رتّب عناصرها.",
   {"items": ["المقدّمة", "العرض", "الخاتمة"]},
   {"order": [0, 1, 2]}, "المنهجيّة (مقدّمة – عرض – خاتمة).", 0.5, "ar.literature.prose", "b")
st("s13", "q3", "q3-e3", "mcq", "ما نمط النّصّ؟",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]},
   {"correct": 0}, "النّمط: تفسيريّ.", 1, "ar.text.type")
st("s14", "q3", "q3-e4", "multi", "أيّ ممّا يلي من مؤشّرات النّمط التّفسيريّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["أدوات التّفسير", "الأسباب والنّتائج", "الجمل الخبريّة", "التّفصيل بعد الإجمال", "الحوار بين الشّخصيّات", "تتابع الأحداث في الزّمن"]},
   {"correct": [0, 1, 2, 3]}, "المؤشّران (يذكر الممتحن مؤشّرين فقط): أدوات التّفسير، الشّرح والمناقشة، التّمثيل والشّواهد، الأسباب والنّتائج، الجمل الخبريّة، التّفصيل بعد الإجمال، التّسلسل المنطقيّ للمعلومات.", 0.5, "ar.text.type")
st("s15", "q3", "q3-e4", "fill_blank", "أكمل من مؤشّرات النّمط التّفسيريّ:",
   {"text": "الشّرح و____، والتّمثيل و____، والتّسلسل ____ للمعلومات.", "bank": ["المناقشة", "الشّواهد", "المنطقيّ", "الوصف", "الحوار", "الزّمنيّ"]},
   {"blanks": [["المناقشة"], ["الشّواهد"], ["المنطقيّ"]]}, "من المؤشّرات: الشّرح والمناقشة، التّمثيل والشّواهد، التّسلسل المنطقيّ للمعلومات.", 0.5, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص", "text": "نصّ الفضيل الورتلانيّ في اللّغة العربيّة بالجزائر (بكالوريا 2019، الشّعب العلميّة، الموضوع الثّاني)", "style": "بأسلوب المترشّح الخاصّ"}
SUM_EXPL = "تلخيص مضمون النّصّ: يراعي فيه الممتحن الإلمام بالمضمون، الحجم، سلامة اللّغة (نقطة لكلّ معيار)."
for i, (crit, ind) in enumerate([("الإلمام بالمضمون", "الإلمام بمضمون النّصّ"), ("الحجم", "مراعاة حجم التّلخيص"), ("سلامة اللّغة", "سلامة اللّغة")]):
    essay(f"s{16 + i}", "q4", f"q4-e{i + 1}", "تلخيص نصّ الفضيل الورتلانيّ", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s19", "q5", "q5-e1", "mcq", "ما الحقل الدّلاليّ للألفاظ: (اللّغة – الأمّة – المدرسة – القوانين)؟",
   {"options": ["الحقل الاجتماعيّ", "الحقل الدّينيّ", "حقل الطّبيعة", "الحقل الاقتصاديّ"]},
   {"correct": 0}, "الحقل الدّلاليّ للألفاظ المذكورة: اجتماعيّ.", 1, "ar.cohesion.effect")
st("s20", "q6", "q6-e1", "mcq", "ما إعراب «مظهر» في قوله: «إنّ اللّغة مظهر مقدّس…»؟",
   {"options": ["خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "اسم «إنّ» منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "نعت مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "«مظهرٌ»: خبر (إنّ) مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.5, "ar.grammar.nawasikh")
st("s21", "q6", "q6-e2", "fill_blank", "أكمل إعراب «لغة» في قوله: «يعتبرون اللّغة العربيّة بين أهلها لغة أجنبيّة»:",
   {"text": "لغةً: ____ منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", "bank": ["مفعول به ثان", "مفعول به أوّل", "حال", "تمييز"]},
   {"blanks": [["مفعول به ثان"]]}, "«لغةً»: مفعول به ثان منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s22", "q6", "q6-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (كان للمنطق سلطان) في قوله: «هذا هو المنطق يوم كان للمنطق سلطان»؟",
   {"options": ["جملة اسميّة في محلّ جرّ مضاف إليه", "جملة اسميّة في محلّ نصب حال", "جملة اسميّة في محلّ رفع خبر", "جملة اسميّة لا محلّ لها من الإعراب، استئنافيّة"]},
   {"correct": 0}, "(كان للمنطق سلطان): جملة اسميّة في محلّ جرّ مضاف إليه (بعد الظّرف «يوم»).", 0.5, "ar.grammar.sentence_case")
st("s23", "q6", "q6-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (إذا سُمح بفتحها) في قوله: «فكلّ مدرسة أهليّة للعربيّة (- إذا سمح بفتحها -) إنّما تخضع…»؟",
   {"options": ["جملة اعتراضيّة لا محلّ لها من الإعراب", "جملة في محلّ رفع نعت لـ«مدرسة»", "جملة في محلّ نصب حال", "جملة في محلّ رفع خبر"]},
   {"correct": 0}, "(إذا سُمح بفتحها): جملة اعتراضيّة لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s24", "q7", "q7-e1", "mcq", "ما نوع الصّورة البيانيّة في (إنّما تُرمى في سلّة المهملات)؟",
   {"options": ["كناية", "استعارة مكنيّة", "تشبيه بليغ", "مجاز مرسل"]},
   {"correct": 0}, "(إنّما ترمى في سلّة المهملات): كناية عن صفة الاستهانة.", 0.5, "ar.rhetoric.metonymy")
st("s25", "q7", "q7-e2", "mcq", "اشرح الكناية: عمَّ كنّى الكاتب بقوله (إنّما تُرمى في سلّة المهملات)؟",
   {"options": ["كناية عن صفة الاستهانة", "كناية عن موصوف هو المستعمر", "كناية عن صفة الكرم", "كناية عن صفة الشّجاعة"]},
   {"correct": 0}, "كناية عن صفة الاستهانة (بالرّسائل الّتي يُكتب عنوانها بالعربيّة).", 0.5, "ar.rhetoric.metonymy")
st("s26", "q7", "q7-e3", "mcq", "ما بلاغة الكناية في (إنّما تُرمى في سلّة المهملات)؟",
   {"options": ["إعطاء الحقيقة مصحوبة بالدّليل", "تشخيص المعنويّ في صورة محسوسة", "الإيجاز بحذف أداة التّشبيه ووجه الشّبه", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "بلاغتها: إعطاء الحقيقة مصحوبة بالدّليل.", 0.5, "ar.rhetoric.effect")
st("s27", "q7", "q7-e4", "mcq", "ما نوع الصّورة البيانيّة في (فرحّبوا بالسّجون)؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل"]},
   {"correct": 0}, "(فرحّبوا بالسّجون): استعارة مكنيّة.", 0.5, "ar.rhetoric.metaphor")
st("s28", "q7", "q7-e5", "fill_blank", "أكمل شرح الصّورة في (فرحّبوا بالسّجون):",
   {"text": "شبّه الكاتب ____ بالضّيف، وحذف المشبّه به، ودلّ عليه بأحد لوازمه (____).", "bank": ["السّجن", "رحّب", "الغرامات", "داسوا"]},
   {"blanks": [["السّجن"], ["رحّب"]]}, "شبّه الكاتب السّجن بالضّيف، وحذف المشبّه به، ودلّ عليه بأحد لوازمه (رحّب).", 0.5, "ar.rhetoric.metaphor")
st("s29", "q7", "q7-e6", "mcq", "ما بلاغة الاستعارة في (فرحّبوا بالسّجون)؟",
   {"options": ["توكيد المعنى وتوضيحه وترسيخه في ذهن المتلقّي", "إعطاء الحقيقة مصحوبة بالدّليل",
                "إيهام المتلقّي بالتّطابق بين المشبّه والمشبّه به", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "بلاغتها: توكيد المعنى وتوضيحه وترسيخه في ذهن المتلقّي.", 0.5, "ar.rhetoric.effect")
st("s30", "q8", "q8-e1", "multi", "أيّ ممّا يلي من مظاهر الاتّساق في الفقرة الثّانية؟ (اختر كلّ ما يصحّ)",
   {"options": ["حروف العطف", "حروف الجرّ", "الضّمائر", "الأسماء الموصولة", "الشّرط", "الوزن والقافية", "السّجع المتكلَّف"]},
   {"correct": [0, 1, 2, 3, 4]}, "مظاهر الاتّساق (يكتفي الممتحن بذكر مظهرين مع التّمثيل): حروف العطف، حروف الجرّ، الضّمائر، الأسماء الموصولة، الشّرط.", 1, "ar.cohesion.connectors")
st("s31", "q8", "q8-e2", "matching", "طابق كلّ مظهر من مظاهر الاتّساق بأمثلته من الفقرة الثّانية.",
   {"lefts": ["حروف العطف", "حروف الجرّ", "الضّمائر", "الأسماء الموصولة", "الشّرط"],
    "rights": ["(الواو، أو، الفاء، بل)", "(على، إلى، في، اللّام)", "(واو الجماعة، هم، الهاء، أنت)", "(الّذي، ما)", "(إذا)"]},
   {"pairs": [0, 1, 2, 3, 4]}, "حروف العطف: (الواو، أو، الفاء، بل)؛ حروف الجرّ: (على، إلى، في، اللّام)؛ الضّمائر: (واو الجماعة، هم، الهاء، أنت…)؛ الأسماء الموصولة: (الّذي، ما)؛ الشّرط: (إذا). ويمثّل الممتحن بما يراه مناسبًا من النّصّ.", 1, "ar.cohesion.connectors")

TITLE = "بكالوريا 2019 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (الفضيل الورتلانيّ: الجزائر الثّائرة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2019، الشّعب العلميّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. الموضوع الرّسميّ للمقارنة: gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين "
         "(الصّفحتان 3–4، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة). الشّعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد. "
         "ما تحته خطّ في docx والموضوع الرّسميّ: «مَظهر» (الفقرة الأولى) و«لغة» (الفقرة الثّانية). الحلّ يكتب الجملة «(كان للغة سلطان)» ويعربها «جملة اسميّة في محلّ جرّ مضاف إليه» — اعتُمد نصّه. "
         "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. مؤجَّل (essay_builder): التّلخيص س4 (3×01).")
LOG_NOTE = "تحويل من نسخة الموضوع (docx) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive، مع مقابلة الموضوع الرّسميّ؛ العلامات من سلّم التّنقيط؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."


# ── تدقيق محلّيّ قبل الكتابة (مهارات src/server/play/exams/skills.ts؛ نسخة من normalizeArabic في src/server/lib/arabic.ts) ──
SKILLS = {"ar.comprehension.link", "ar.comprehension.evidence", "ar.comprehension.purpose", "ar.comprehension.image", "ar.comprehension.details",
          "ar.comprehension.explain", "ar.comprehension.idea", "ar.literature.tradition", "ar.literature.renewal", "ar.literature.context",
          "ar.text.type", "ar.grammar.irab", "ar.grammar.sentence_case", "ar.grammar.maqsur", "ar.grammar.mamnu", "ar.grammar.rules",
          "ar.morphology", "ar.rhetoric.metaphor", "ar.rhetoric.simile", "ar.rhetoric.metonymy", "ar.rhetoric.effect", "ar.rhetoric.badi",
          "ar.prosody", "ar.cohesion.connectors", "ar.cohesion.reference", "ar.cohesion.effect", "ar.writing.integration", "ar.writing.summary",
          "ar.comprehension.emotion", "ar.comprehension.opinion", "ar.comprehension.values", "ar.grammar.conditional", "ar.grammar.styles",
          "ar.literature.features", "ar.literature.genre", "ar.literature.prose", "ar.literature.trend", "ar.rhetoric.insha", "ar.rhetoric.style",
          "ar.grammar.naat", "ar.grammar.badal", "ar.grammar.nawasikh"}


def _norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub("[ً-ْٰـ]", "", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _check():
    els = {e["id"]: e["max_points"] for qq in Q for e in qq["rubric_elements"]}
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els, (s["id"], s["rubric_element_id"])
        assert s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
            assert (3 <= len(p["options"]) <= 4) if t == "mcq" else len(p["options"]) >= 3, (s["id"], "option count")
            if t == "multi":
                assert 0 < len(a["correct"]) < len(p["options"]) and len(set(a["correct"])) == len(a["correct"]), s["id"]
            else:
                assert 0 <= a["correct"] < len(p["options"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(p["bank"]) > len(a["blanks"]), (s["id"], "no distractor in bank")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2, s["id"]
            assert len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]), s["id"]
            assert all(0 <= i < len(p["rights"]) for i in a["pairs"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            # الإجابة الصّحيحة لا تظهر في عنوان وثيقة (القاعدة 12)
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, mx in els.items():
        assert abs(got.get(eid, 0) - mx) < 1e-9, (eid, got.get(eid), mx)
    assert abs(sum(qq["rubric_total"] for qq in Q) - 20) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - 20) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"


_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p{PAPER}",
        "kind": "BAC", "year": 2019, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
