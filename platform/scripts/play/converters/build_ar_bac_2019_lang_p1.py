"""Conversion: BAC 2019 (session عاديّة) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (نازك الملائكة، «الغلام»).
Exam (most faithful source): gdrive 1vEFP2eO9tX-4aGYJbRRzhR1POIv2ZVit (بكالوريا العربية 2019 شعبة لغات.docx);
same paper as PDF (owner's retyped copy): gdrive 1APk5GHKFzPhvdl2nUeZTpyfHvE9vu6Yz (BAC 2019 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1Ypn1Kr-KCPPNHAPtDDCLJf4ewC2mjtrq (01_الموضوع.pdf, pages 1–2, read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 15EshNlI6DO8-o34Tks3znMKOE4kuNEoL (02_التصحيح.pdf, pages 1–2).

Method (same as the BAC 2020–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; outer whitespace / direction marks trimmed, incl. a trailing RLM after question 3). The free-verse poem
sits in a two-cell table (stanzas -1- to -3- / -4- and -5-); the second cell also holds the reference and the glossary,
which are split into their own documents. Each cell is kept line by line (empty lines dropped). The docx matches the
official paper (spacing/diacritics only, e.g. «وسديً» for «وسدىً», kept as in the docx). The correction PDF's text layer is
reversed presentation-form Arabic, so the mark scheme was read from the rendered pages (150 dpi; scansion re-read at 300 dpi).
Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- No summary question in this paper ⇒ every element is interactive (no deferred points).
- «ما تحته خطّ»: underlined in docx and official paper: «الغلام» (المقطع 2), «مصلّين» (المقطع 4).
- Q1: 0.5 the symbolic character (الغلام) + «4×0.25» features («ملمحين مادّيّين وملمحين معنويّين»); the scheme lists only one
  clearly material feature (بياض الجبين) among five ⇒ one element of 1; the steps do not ask to classify material/moral.
- Q2: 01 meaning + «4×0.25» examples. Q3: 0.25 yes + 0.75 explanation + «2×0.25» two quotations ⇒ three elements.
- Q4: «3×0.5» form + «3×0.5» content (three of those listed each) ⇒ one element per side.
- Q5: 01 type (وصفيّ، with its reason) + «4×0.25» two indicators with examples («تُقبل مؤشّرات أخرى» ⇒ distractors are
  indicators of other types only).
- Part 2 Q2: «الغلام» after «ذاك» is «بدل من اسم الإشارة» in the scheme; «نعت» and «عطف بيان» are not used as distractors.
- Part 2 Q3: «2×0.25» type (إنشائيّ طلبيّ بصيغة الأمر, one element) + 0.5 purpose (الالتماس).
- Part 2 Q4: one 0.75 line per image (type + explanation + effect) ⇒ one element each, three steps inside.
- Part 2 Q5: «4×0.25» without labels, with «0.25 للكتابة العروضيّة + الرّموز» ⇒ one element of 1 with four steps
  (writing+symbols, feet, foot/metre, change). Scansion as in the scheme: أَفْسِحُدْدَرْ | بَلَهُوْلِلْ | قَاْدِمِصْصَاْ | فِشْشُعُوْرِي =
  /0//0/0 ///0/0 /0//0/0 /0//0/0 = فاعلاتن فعلاتن فاعلاتن فاعلاتن, بحر الرّمل, فاعلاتن → فعلاتن (حذف الثّاني السّاكن).
- Part 3 (04): 01 the phenomenon + «4×0.5» four causes (four listed) + «4×0.25» four poets («يكتفى بذكر أربعة أعلام») ⇒
  interactive (closed model content, as in the BAC 2020 converters).
"""
import json, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2019-lang-p1"
PAPER = 1
STREAMS = ["LANG"]
DOCX_ID = "1vEFP2eO9tX-4aGYJbRRzhR1POIv2ZVit"
DOCX_TITLE = "بكالوريا العربية 2019 شعبة لغات.docx"
PDF_ID = "1APk5GHKFzPhvdl2nUeZTpyfHvE9vu6Yz"
OFFICIAL_ID = "1Ypn1Kr-KCPPNHAPtDDCLJf4ewC2mjtrq"
CORR_ID = "15EshNlI6DO8-o34Tks3znMKOE4kuNEoL"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من فقرات ملفّ docx بـ python-docx: تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
POEM_A = '-1-\n(أَفسِحُوا الدّربَ له)، للقادم الصّافي الشعورِ\nللغلامِ المرهفِ السّابح في بحرٍ أريجِ\nذي الجبينِ الأبيض السّارق أسرار الثّلوجِ\nإنّه جاء إلينا عابرا خصبَ المرورِ\nإنّه أهدأ من ماءِ الغديرِ\nفاحذروا أن تجرحوه بالضجيج\n-2-\nإنّه ذاك الغلام الدَّائمُ الحزنِ الخجولُ\nساكنُ الأمسيةِ الغرقى بأحزانٍ خفيّه\nوالزّوايا الغَيْهبيّاتِ السُّكونِ الشّفقيّه\nأبدًا يجرحُه النَّوْح ويُضنيهِ العويلُ\nفليكنْ من صمتِنا ظِلٌّ ظليلُ\nيتلقاه وأحضانٌ خفيّه\n-3-\nوهو يحيا في الدّموع الخُرْسِ في بعضِ العيونِ\nوله كوخٌ خَفيٌ شِيدَ في عُمقٍ سحيقٍ\nضائعٌ (يعرفه الباكون) في صمتٍ عميقِ\nوسديً يبحثُ عنه الألم الخشْنُ الرّنينِ\nإنّه يقتاتُ أسرار السّكونِ\nوأسىً مختبئًا خلفَ العروقِ'
POEM_B = '-4-\nنحن هيّأنا له حبًا وتقديسًا ونجوَى\nوتهيّأنا للُقياه عيونًا وشِفاهًا\nوسنلقاه، مصلّين كما نلقى إلهًا\nوسنهديه انفجارَ الأَدمُعِ العَذبةِ سلوى\nوسنحْبُوهُ أسىً أقوى وأقوى\nوسنُعطيه عُيونًا وجِباهًا\n-5-\nإنّه أجمل من أفراحنا، من كلّ حب\nإنه زنبقةٌ ألقى بها الموتُ علَينا\nلم تزلْ دافئةً ترعَشُ في شوقِ يَدينَا\nوسنُعطيها مكانا عَطِرًا في كلّ قلب\nوشَذَى حُزنٍ عَميقِ القعرِ خصبِ\nإنّه مِنّا... وقد عاد إليْنا..'
REF1 = 'ديوان نازك الملائكة، المجلد الثاني ص:311-312-313\nدار العودة - بيروت-'
GLOSS1 = 'الشّرح اللغوي: أريج: رائحة طيّبة. الغيهبيّات: م: غيهب وهو الظّلمة.    الزّنبقة: نوع من الزّهور ترمز إلى النّقاء.'
P1A = 'أوّلا- البناء الفكري: (10 نقاط)'
P1B = 'ثانيا- البناء اللّغوي: (06 نقاط)'
P1C = 'ثالثا- التّقويم النقدي: (04 نقاط)'
QT1 = ['بَنت الشّاعرة قصيدتها على شخصية رامزة، فِيم تجلّت؟ اُذكر بعض ملامحها الماديّة والمعنويّة.', 'وظّفت الشاعرة الضَّمير الجَمعيّ في التّعبير عن الحالة الشّعُوريّة السّائدة، ما دلالة ذلك؟ مثّل لذلك\nمن النّصّ.', 'هل يعكس المعجم اللّغوي السّائد نفسيّة الشّاعرة؟ وضّح ذلك مستنداً إلى شواهد من النّصّ.', 'اشتملت القصيدة في شكلها ومضمونها على بعض مظاهر التجديد، اُذكرها.', 'ما النّمط الغالب على النّص؟ استخرج مؤشرين من مؤشراته.', 'سمّ الحقل المعجمي للألفاظ التالية: (النّوحُ - العَويل - البَاكون - الأَدمُع - الموت).', 'أعرب:\nإعرابَ مفردات: - "الغلام" في المقطع الثاني.\n"مصلّين" في المقطع الرّابع.\nإعراب جمل:     -   (أفسِحُوا الدَّرْبَ له) في المقطع الأوّل.\n(يعرفه الباكون) في المقطع الثالث.', 'حَدّد نوع الأسلوب وبيّنْ غرضه في العبارة التالية: «فاحذَروا أن تَجرحُوه بالضّجيج».', 'ما نوع الصّورتين البيانّتين التّاليتين؟ اشرحهما مبيّنا سِرّ بلاغتهما:\n(أسًى مُختبئا) في المقطع الثالث.\n(إنّه زنبقة) في المقطع الخامس.', 'حلّل السّطرَ الأوّل من المقطع الأول عَروضِيًا وبين مَا طرأ على التَّفعيلة من تغيُّرَاتٍ.', '- تحدّث عن هذه الظاهرة، مُبرزا أهمّ أسبابها واذكر بعض أعلَامِها.']
CRIT1 = '«ظاهرة الحزن والألم من الظواهر التي ضمّنها الشعراءُ قصَائدهم في العصر الحديث، فأضحت سِمةً\nبارزةً في عهدهم».'


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
    {"id": "d-poem-a", "kind": "text", "caption": "النّصّ (1)", "text": POEM_A},
    {"id": "d-poem-b", "kind": "text", "caption": "النّصّ (2)", "text": POEM_B},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": REF1},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": GLOSS1},
]
D = TEXT_DOCS
CRIT_DOCS = [{"id": "d-crit", "kind": "text", "caption": "القول", "text": CRIT1}]

q("q1", "1", P1A, QT1[0], 1.5, [el("q1-e1", "الشّخصيّة الرّامزة", 0.5), el("q1-e2", "ملامحها المادّيّة والمعنويّة (4×0.25)", 1)], D)
q("q2", "2", P1A, QT1[1], 2, [el("q2-e1", "دلالة توظيف الضّمير الجمعيّ", 1), el("q2-e2", "التّمثيل من النّصّ (4×0.25)", 1)], D)
q("q3", "3", P1A, QT1[2], 1.5, [el("q3-e1", "هل يعكس المعجم نفسيّة الشّاعرة", 0.25), el("q3-e2", "التّوضيح", 0.75), el("q3-e3", "شاهدان من النّصّ (2×0.25)", 0.5)], D)
q("q4", "4", P1A, QT1[3], 3, [el("q4-e1", "مظاهر التّجديد في الشّكل (3×0.5)", 1.5), el("q4-e2", "مظاهر التّجديد في المضمون (3×0.5)", 1.5)], D)
q("q5", "5", P1A, QT1[4], 2, [el("q5-e1", "النّمط الغالب", 1), el("q5-e2", "مؤشّران مع التّمثيل (4×0.25)", 1)], D)
q("q6", "1", P1B, QT1[5], 0.5, [el("q6-e1", "الحقل المعجميّ", 0.5)], D)
q("q7", "2", P1B, QT1[6], 2, [el("q7-e1", "إعراب «الغلام»", 0.5), el("q7-e2", "إعراب «مصلّين»", 0.5),
                              el("q7-e3", "محلّ جملة (أفسحوا الدّرب له)", 0.5), el("q7-e4", "محلّ جملة (يعرفه الباكون)", 0.5)], D)
q("q8", "3", P1B, QT1[7], 1, [el("q8-e1", "نوع الأسلوب (2×0.25)", 0.5), el("q8-e2", "غرضه", 0.5)], D)
q("q9", "4", P1B, QT1[8], 1.5, [el("q9-e1", "(أسًى مختبئًا): النّوع والشّرح والبلاغة", 0.75), el("q9-e2", "(إنّه زنبقة): النّوع والشّرح والبلاغة", 0.75)], D)
q("q10", "5", P1B, QT1[9], 1, [el("q10-e1", "التّحليل العروضيّ وتغيّرات التّفعيلة (4×0.25)", 1)], D)
q("q11", "-", P1C, QT1[10], 4, [el("q11-e1", "الحديث عن الظّاهرة", 1), el("q11-e2", "أهمّ أسبابها (4×0.5)", 2), el("q11-e3", "بعض أعلامها (4×0.25)", 1)], D + CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "فيمَ تجلّت الشّخصيّة الرّامزة الّتي بنت عليها الشّاعرة قصيدتها؟",
   {"options": ["في الغلام", "في الشّاعرة نفسها", "في الباكين", "في الكوخ الخفيّ"]},
   {"correct": 0}, "بنت الشّاعرة قصيدتها على شخصيّة رامزة تجلّت في الغلام.", 0.5, "ar.comprehension.image")
st("s02", "q1", "q1-e2", "multi", "أيّ ممّا يلي من ملامح الغلام المادّيّة والمعنويّة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["بياض الجبين", "صفاء الشّعور", "الإحساس المرهف", "الهدوء", "الحزن والخجل", "القسوة والغلظة", "الصّخب والضّجيج"]},
   {"correct": [0, 1, 2, 3, 4]}, "من ملامحه المادّيّة والمعنويّة: بياض الجبين – صفاء الشّعور – الإحساس المرهف – الهدوء – الحزن والخجل… (يكتفي الممتحن بذكر ملمحين مادّيّين وملمحين معنويّين).", 0.5, "ar.comprehension.details")
st("s03", "q1", "q1-e2", "matching", "طابق كلّ ملمح من ملامح الغلام بما يدلّ عليه في النّصّ.",
   {"lefts": ["بياض الجبين", "صفاء الشّعور", "الهدوء", "الحزن والخجل"],
    "rights": ["«ذي الجبينِ الأبيض»", "«للقادم الصّافي الشّعورِ»", "«إنّه أهدأ من ماءِ الغديرِ»", "«الدَّائمُ الحزنِ الخجولُ»"]},
   {"pairs": [0, 1, 2, 3]}, "بياض الجبين (ذي الجبين الأبيض)، صفاء الشّعور (الصّافي الشّعور)، الهدوء (أهدأ من ماء الغدير)، الحزن والخجل (الدّائم الحزن الخجول).", 0.5, "ar.comprehension.evidence", "b")
st("s04", "q2", "q2-e1", "mcq", "ما دلالة توظيف الشّاعرة الضّمير الجمعيّ في التّعبير عن الحالة الشّعوريّة السّائدة؟",
   {"options": ["الدّلالة على أنّ الحزن والألم ظاهرة جماعيّة", "الدّلالة على أنّ الشّاعرة تتحدّث عن نفسها فقط", "الدّلالة على تعظيم الشّاعرة لنفسها", "الدّلالة على فرح جماعيّ بقدوم الغلام"]},
   {"correct": 0}, "وظّفت الشّاعرة الضّمير الجمعيّ في التّعبير عن الحالة الشّعوريّة السّائدة للدّلالة على أنّ الحزن والألم ظاهرة جماعيّة.", 0.5, "ar.cohesion.reference")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "وظّفت الشّاعرة الضّمير الجمعيّ للدّلالة على أنّ الحزن والألم ظاهرةٌ ____.", "bank": ["جماعيّة", "فرديّة", "عابرة"]},
   {"blanks": [["جماعيّة"]]}, "«للدّلالة على أنّ الحزن والألم ظاهرةٌ جماعيّة».", 0.5, "ar.cohesion.reference", "b")
st("s06", "q2", "q2-e2", "multi", "أيّ الأقوال الآتية من النّصّ وُظّف فيها الضّمير الجمعيّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["«نحن هيّأنا له حبًّا»", "«وسنهديه انفجارَ الأدمعِ»", "«وسنحبُوه أسًى أقوى»", "«إنّه أجمل من أفراحنا»", "«وله كوخٌ خفيٌّ»", "«ذي الجبينِ الأبيض»"]},
   {"correct": [0, 1, 2, 3]}, "التّمثيل من النّصّ: (نحن هيّأنا له حبًّا – سنهديه انفجار الأدمع – وسنحبوه أسًى أقوى – أجمل من أفراحنا…).", 1, "ar.cohesion.reference")
st("s07", "q3", "q3-e1", "mcq", "هل يعكس المعجم اللّغويّ السّائد نفسيّة الشّاعرة؟",
   {"options": ["نعم، يعكس نفسيّتها الكئيبة", "لا، فهو معجم فرح وبهجة", "لا علاقة للمعجم بنفسيّة الشّاعرة"]},
   {"correct": 0}, "المعجم اللّغويّ يعكس نفسيّة الشّاعرة الكئيبة.", 0.25, "ar.comprehension.emotion")
st("s08", "q3", "q3-e2", "fill_blank", "أكمل التّوضيح:",
   {"text": "المعجم اللّغويّ يعكس نفسيّة الشّاعرة ____ المترجمة لألم وحزن ____ في أعماقها جرّاء الأوضاع الّتي يشهدها مجتمعها وتعيشها ____.",
    "bank": ["الكئيبة", "متربّعين", "أمّتها", "المتفائلة", "عابرين", "أسرتها"]},
   {"blanks": [["الكئيبة"], ["متربّعين"], ["أمّتها"]]}, "«المعجم اللّغويّ يعكس نفسيّة الشّاعرة الكئيبة المترجمة لألم وحزن متربّعين في أعماقها جرّاء الأوضاع الّتي يشهدها مجتمعها وتعيشها أمّتها».", 0.75, "ar.comprehension.emotion")
st("s09", "q3", "q3-e3", "multi", "اختر من النّصّ شواهد على هذا المعجم الحزين. (اختر كلّ ما يصحّ)",
   {"options": ["«بأحزانٍ خفيّه»", "«يجرحُه النَّوْح»", "«ويُضنيهِ العويلُ»", "«يحيا في الدّموع»", "«مكانا عَطِرًا في كلّ قلب»", "«أهدأ من ماءِ الغديرِ»"]},
   {"correct": [0, 1, 2, 3]}, "ويظهر ذلك في قولها: (أحزان خفيّه – يجرحه النّوح – يضنيه العويل – يحيا في الدّموع – يبحث عنه الألم – شذا حزن عميق…). يُكتفى بإيراد شاهدين.", 0.5, "ar.comprehension.evidence")
st("s10", "q4", "q4-e1", "multi", "ما مظاهر التّجديد في شكل القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["اعتماد نوع جديد من الشّعر (شعر التّفعيلة)", "عدم الالتزام بعدد ثابت من التّفعيلات", "التّنويع في القافية",
                "الالتزام بنظام الشّطرين المتناظرين", "وحدة الرّويّ في القصيدة كلّها"]},
   {"correct": [0, 1, 2]}, "مظاهر التّجديد في الشّكل: اعتماد نوع جديد من الشّعر (شعر التّفعيلة) – عدم الالتزام بعدد ثابت من التّفعيلات – التّنويع في القافية…", 1, "ar.literature.renewal")
st("s11", "q4", "q4-e1", "fill_blank", "أكمل:",
   {"text": "من مظاهر التّجديد في الشّكل: اعتماد شعر ____، والتّنويع في ____.", "bank": ["التّفعيلة", "القافية", "الشّطرين", "الغرض"]},
   {"blanks": [["التّفعيلة"], ["القافية"]]}, "«اعتماد نوع جديد من الشّعر (شعر التّفعيلة) – عدم الالتزام بعدد ثابت من التّفعيلات – التّنويع في القافية».", 0.5, "ar.literature.renewal", "b")
st("s12", "q4", "q4-e2", "multi", "ما مظاهر التّجديد في مضمون القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["اعتماد الرّمز", "بروز الصّورة الشّعريّة", "اللّغة الانسيابيّة المعبّرة عن العواطف الجيّاشة", "بروز عنصر الحزن والألم", "الوحدة العضويّة",
                "المقدّمة الطّلليّة", "تعدّد الأغراض في القصيدة الواحدة"]},
   {"correct": [0, 1, 2, 3, 4]}, "مظاهر التّجديد في المضمون: اعتماد الرّمز – بروز الصّورة الشّعريّة – اللّغة الانسيابيّة المعبّرة عن العواطف الجيّاشة – بروز عنصر الحزن والألم – الوحدة العضويّة… (يُكتفى بذكر ثلاث خصائص لكلّ عنصر).", 1, "ar.literature.renewal")
st("s13", "q4", "q4-e2", "fill_blank", "أكمل:",
   {"text": "ومن مظاهر التّجديد في المضمون: اعتماد ____، والوحدة ____.", "bank": ["الرّمز", "العضويّة", "الطّلل", "البيت"]},
   {"blanks": [["الرّمز"], ["العضويّة"]]}, "«المضمون: اعتماد الرّمز… الوحدة العضويّة».", 0.5, "ar.literature.renewal", "b")
st("s14", "q5", "q5-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["الوصفيّ", "السّرديّ", "الحجاجيّ", "الإيعازيّ"]},
   {"correct": 0}, "النّمط الغالب: وصفيّ لأنّها وصفت لنا حالة شعوريّة جماعيّة…", 0.5, "ar.text.type")
st("s15", "q5", "q5-e1", "mcq", "لماذا غلب النّمط الوصفيّ على النّصّ؟",
   {"options": ["لأنّ الشّاعرة وصفت لنا حالة شعوريّة جماعيّة", "لأنّ الشّاعرة روت أحداثًا متسلسلة في الزّمن", "لأنّ الشّاعرة قدّمت حججًا لإقناع القارئ", "لأنّ الشّاعرة شرحت ظاهرة علميّة"]},
   {"correct": 0}, "النّمط الغالب: وصفيّ لأنّها وصفت لنا حالة شعوريّة جماعيّة…", 0.5, "ar.text.type", "b")
st("s16", "q5", "q5-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["النّعوت", "أفعال الحالة والحركة", "أدوات التّعليل والاستنتاج", "تسلسل الأحداث بأفعال الماضي"]},
   {"correct": [0, 1]}, "من مؤشّراته: النّعوت، أفعال الحالة والحركة (تُقبل مؤشّرات أخرى للوصف يذكرها الممتحن).", 0.5, "ar.text.type")
st("s17", "q5", "q5-e2", "matching", "طابق كلّ مؤشّر بأمثلته من النّصّ.",
   {"lefts": ["النّعوت", "أفعال الحالة والحركة"], "rights": ["(القادم – الصّافي – الخجول)", "(يحيا – تهيّأنا)", "(أفسحوا – فاحذروا)"]},
   {"pairs": [0, 1]}, "النّعوت: (القادم – الصّافي – الخجول)؛ أفعال الحالة والحركة: (يحيا – تهيّأنا…)؛ أمّا (أفسحوا – فاحذروا) فأفعال أمر.", 0.5, "ar.text.type", "b")
# ── ثانيًا: البناء اللّغويّ ──
st("s18", "q6", "q6-e1", "mcq", "ما الحقل المعجميّ للألفاظ: (النّوح – العويل – الباكون – الأدمع – الموت)؟",
   {"options": ["حقل الحزن والألم", "حقل الطّبيعة", "حقل الفرح", "حقل الحرب"]},
   {"correct": 0}, "الحقل المعجميّ للألفاظ (النّوح – العويل – الباكون – الأدمع – الموت) هو حقل الحزن والألم.", 0.5, "ar.cohesion.effect")
st("s19", "q7", "q7-e1", "mcq", "ما إعراب «الغلام» في قولها: «إنّه ذاك الغلام الدّائم الحزن الخجول»؟",
   {"options": ["بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "خبر «إنّ» مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«الغلامُ»: بدل من اسم الإشارة مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.5, "ar.grammar.badal")
st("s20", "q7", "q7-e2", "fill_blank", "أكمل إعراب «مصلّين» في قولها: «وسنلقاه مصلّين كما نلقى إلهًا»:",
   {"text": "مصلّين: ____ منصوب وعلامة نصبه ____ لأنّه جمع مذكّر سالم.", "bank": ["حال", "الياء", "مفعول به", "الفتحة", "نعت"]},
   {"blanks": [["حال"], ["الياء"]]}, "«مُصلّين»: حال منصوب وعلامة نصبه الياء لأنّه جمع مذكّر سالم.", 0.5, "ar.grammar.irab")
st("s21", "q7", "q7-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (أفسحوا الدّرب له) في المقطع الأوّل؟",
   {"options": ["جملة ابتدائيّة لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب مفعول به", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال"]},
   {"correct": 0}, "(أفسحوا الدّرب له): جملة ابتدائيّة لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s22", "q7", "q7-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (يعرفه الباكون) في قولها: «ضائعٌ يعرفه الباكون في صمت عميق»؟",
   {"options": ["جملة فعليّة في محلّ رفع صفة", "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب مفعول به", "جملة فعليّة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "(يعرفه الباكون): جملة فعليّة في محلّ رفع صفة.", 0.5, "ar.grammar.sentence_case")
st("s23", "q8", "q8-e1", "fill_blank", "أكمل نوع الأسلوب في قولها: «فاحذروا أن تجرحوه بالضّجيج»:",
   {"text": "أسلوب ____ طلبيّ تحقّق بصيغة ____.", "bank": ["إنشائيّ", "الأمر", "خبريّ", "النّهي"]},
   {"blanks": [["إنشائيّ"], ["الأمر"]]}, "«فاحذروا أن تجرحوه بالضّجيج»: إنشائيّ طلبيّ تحقّق بصيغة الأمر.", 0.5, "ar.rhetoric.insha")
st("s24", "q8", "q8-e2", "mcq", "ما الغرض البلاغيّ للأمر في «فاحذروا أن تجرحوه بالضّجيج»؟",
   {"options": ["الالتماس", "الدّعاء", "التّهديد", "التّعجيز"]},
   {"correct": 0}, "غرضه البلاغيّ هو الالتماس.", 0.5, "ar.rhetoric.insha")
st("s25", "q9", "q9-e1", "mcq", "ما نوع الصّورة البيانيّة في (أسًى مختبئًا)؟",
   {"options": ["استعارة مكنيّة", "تشبيه بليغ", "كناية عن صفة", "مجاز مرسل"]},
   {"correct": 0}, "(أسًى مختبئًا): استعارة مكنيّة.", 0.25, "ar.rhetoric.metaphor")
st("s26", "q9", "q9-e1", "fill_blank", "أكمل شرح الصّورة في (أسًى مختبئًا):",
   {"text": "شبّه ____ بالإنسان، فحذف هذا الأخير وأبقى على شيء من لوازمه (____).", "bank": ["الأسى", "مختبئًا", "العروق", "الغلام"]},
   {"blanks": [["الأسى"], ["مختبئًا"]]}, "شرحها: شبّه الأسى بالإنسان، فحذف هذا الأخير وأبقى على شيء من لوازمه (مختبئًا).", 0.25, "ar.rhetoric.metaphor", "b")
st("s27", "q9", "q9-e1", "mcq", "فيمَ يكمن الأثر البلاغيّ للاستعارة في (أسًى مختبئًا)؟",
   {"options": ["في الإيجاز والتّشخيص", "في إثبات الصّفة مصحوبة بالدّليل", "في جعل المشبّه والمشبّه به كأنّهما شيء واحد", "في إحداث جرس موسيقيّ"]},
   {"correct": 0}, "يكمن أثرها البلاغيّ في الإيجاز والتّشخيص…", 0.25, "ar.rhetoric.effect", "c")
st("s28", "q9", "q9-e2", "mcq", "ما نوع الصّورة البيانيّة في (إنّه زنبقة)؟",
   {"options": ["تشبيه بليغ", "استعارة تصريحيّة", "تشبيه مرسل مفصّل", "كناية عن موصوف"]},
   {"correct": 0}, "(إنّه زنبقة): تشبيه بليغ.", 0.25, "ar.rhetoric.simile")
st("s29", "q9", "q9-e2", "matching", "اشرح الصّورة: حدّد أركان التّشبيه في (إنّه زنبقة).",
   {"lefts": ["المشبّه", "المشبّه به", "المحذوف"], "rights": ["الغلام (الضّمير في «إنّه»)", "الزّنبقة", "أداة التّشبيه ووجه الشّبه", "الموت"]},
   {"pairs": [0, 1, 2]}, "شرحها: شبّهت الشّاعرة الغلام بالزّنبقة، وحذفت أداة التّشبيه ووجه الشّبه.", 0.25, "ar.rhetoric.simile", "b")
st("s30", "q9", "q9-e2", "mcq", "فيمَ يكمن الأثر البلاغيّ للتّشبيه في (إنّه زنبقة)؟",
   {"options": ["في توضيح المعنى وتشخيصه وجعل المشبّه والمشبّه به كأنّهما شيء واحد", "في الإيجاز بحذف المشبّه به",
                "في إثبات الصّفة مصحوبة بالدّليل", "في إحداث جرس موسيقيّ"]},
   {"correct": 0}, "ويكمن أثرها البلاغيّ في توضيح المعنى وتشخيصه وجعل المشبّه والمشبّه به كأنّهما شيء واحد.", 0.25, "ar.rhetoric.effect", "c")
PRO_EXPL = ("التّقطيع: «أَفْسِحُدْدَرْ | بَلَهُوْلِلْ | قَاْدِمِصْصَاْ | فِشْشُعُوْرِي» = /0//0/0 ///0/0 /0//0/0 /0//0/0 = فاعلاتن فعلاتن فاعلاتن فاعلاتن. "
            "بُنيت القصيدة على تفعيلة «فاعلاتن» من بحر الرّمل، وهو من البحور الصّافية المعتمدة في شعر التّفعيلة. التّغيّرات: فاعلاتن ← فعلاتن (حذف الثّاني السّاكن).")
st("s31", "q10", "q10-e1", "mcq", "ما الكتابة العروضيّة والرّموز الصّحيحة للسّطر «أفسحوا الدّربَ له للقادم الصّافي الشّعورِ»؟",
   {"options": ["أَفْسِحُدْدَرْ بَلَهُوْلِلْ قَاْدِمِصْصَاْ فِشْشُعُوْرِي: /0//0/0 ///0/0 /0//0/0 /0//0/0", "أَفْسِحُدْدَرْ بَلَهُوْلِلْ قَاْدِمِصْصَاْ فِشْشُعُوْرِي: /0//0/0 /0//0/0 /0//0/0 /0//0/0",
                "أَفْسِحُ الدَّرْ بَلَهُوْ لِلْقَا دِمِ الصّاْ فِي الشُّعُوْرِ: /0//0/0 ///0/0 /0//0/0 /0//0", "أَفْسِحُدْدَرْ بَلَهُوْلِلْ قَاْدِمِصْصَاْ فِشْشُعُوْرِي: ///0/0 ///0/0 /0//0/0 ///0/0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s32", "q10", "q10-e1", "mcq", "ما تفعيلات السّطر الأوّل؟",
   {"options": ["فاعلاتن فعلاتن فاعلاتن فاعلاتن", "فاعلاتن فاعلاتن فاعلاتن فاعلاتن", "فعلاتن فعلاتن فاعلاتن فاعلاتن", "مستفعلن مستفعلن مستفعلن مستفعلن"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s33", "q10", "q10-e1", "mcq", "على أيّ تفعيلة بُنيت القصيدة، ومن أيّ بحر؟",
   {"options": ["«فاعلاتن» من بحر الرّمل", "«فاعلن» من بحر المتدارك", "«مستفعلن» من بحر الرّجز", "«متفاعلن» من بحر الكامل"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "c")
st("s34", "q10", "q10-e1", "fill_blank", "بيّن ما طرأ على التّفعيلة من تغيّرات في السّطر الأوّل:",
   {"text": "«فاعلاتن» ← «____» بحذف ____ السّاكن.", "bank": ["فعلاتن", "الثّاني", "فاعلن", "الرّابع"]},
   {"blanks": [["فعلاتن"], ["الثّاني"]]}, PRO_EXPL, 0.25, "ar.prosody", "d")
# ── ثالثًا: التّقويم النّقديّ ──
st("s35", "q11", "q11-e1", "mcq", "ما المقصود بظاهرة الحزن والألم الّتي ضمّنها الشّعراء قصائدهم في العصر الحديث؟",
   {"options": ["ردّة فعل غير متوقّع يسبّب لصاحبه الشّعور بالبؤس، ويجعله كئيبًا انطوائيًّا قليل النّشاط، وقد يوصله إلى عدم الاطمئنان والضّغط النّفسيّ والإحباط",
                "حالة فرح دائم تدفع صاحبها إلى النّشاط والتّفاؤل", "غرض شعريّ قديم يقتصر على رثاء الملوك", "ظاهرة لغويّة تتعلّق بكثرة الألفاظ الغريبة"]},
   {"correct": 0}, "الحزن والألم هو ردّة فعل غير متوقّع يسبّب لصاحبه الشّعور بالبؤس، ويجعله كئيبًا انطوائيًّا قليل النّشاط، وقد يوصل صاحبه إلى عدم الاطمئنان والضّغط النّفسيّ والإحباط…", 1, "ar.literature.trend")
st("s36", "q11", "q11-e2", "multi", "ما أهمّ أسباب ظاهرة الحزن والألم في الشّعر الحديث؟ (اختر كلّ ما يصحّ)",
   {"options": ["اصطدام الأفكار المثاليّة بالواقع", "سوء الأحوال الاجتماعيّة والسّياسيّة", "الاستياء من واقع الحضارة الغربيّة", "تتابع النّكبات والهزائم",
                "رخاء العيش واستقرار الأوطان", "انتصارات الأمّة المتتالية"]},
   {"correct": [0, 1, 2, 3]}, "من أسبابها: اصطدام الأفكار المثاليّة بالواقع، سوء الأحوال الاجتماعيّة والسّياسيّة، الاستياء من واقع الحضارة الغربيّة، تتابع النّكبات والهزائم…", 1, "ar.literature.trend")
st("s37", "q11", "q11-e2", "fill_blank", "أكمل أسباب الظّاهرة:",
   {"text": "اصطدام الأفكار ____ بالواقع، وسوء الأحوال الاجتماعيّة و____، والاستياء من واقع الحضارة ____، وتتابع النّكبات و____.",
    "bank": ["المثاليّة", "السّياسيّة", "الغربيّة", "الهزائم", "الواقعيّة", "الانتصارات"]},
   {"blanks": [["المثاليّة"], ["السّياسيّة"], ["الغربيّة"], ["الهزائم"]]}, "«اصطدام الأفكار المثاليّة بالواقع – سوء الأحوال الاجتماعيّة والسّياسيّة – الاستياء من واقع الحضارة الغربيّة – تتابع النّكبات والهزائم…».", 1, "ar.literature.trend", "b")
st("s38", "q11", "q11-e3", "multi", "أيّ هؤلاء من أعلام ظاهرة الحزن والألم في الشّعر الحديث؟ (اختر كلّ ما يصحّ)",
   {"options": ["صلاح عبد الصّبور", "أمل دنقل", "فدوى طوقان", "بدر شاكر السّيّاب", "زهير بن أبي سلمى", "عمر بن أبي ربيعة"]},
   {"correct": [0, 1, 2, 3]}, "من أعلامها: صلاح عبد الصّبور – أمل دنقل – فدوى طوقان – البيّاتي – السّيّاب – خليل حاوي… (يُكتفى بذكر أربعة أعلام)؛ أمّا زهير وعمر بن أبي ربيعة فشاعران قديمان.", 1, "ar.literature.trend")

TITLE = "بكالوريا 2019 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (نازك الملائكة: الغلام)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2019، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. الموضوع الرّسميّ للمقارنة: gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين "
         "(الصّفحتان 1–2، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة؛ التّقطيع بدقّة 300). ما تحته خطّ في docx والموضوع الرّسميّ: «الغلام» و«مصلّين». "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. لا تلخيص في هذا الموضوع، فكلّ العناصر تفاعليّة. "
         "س1: يطلب الحلّ «ملمحين مادّيّين وملمحين معنويّين» ولا يذكر إلّا ملمحًا مادّيًّا واحدًا صريحًا (بياض الجبين) — للمراجعة.")
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
