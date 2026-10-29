"""Conversion: BAC 2019 (session عاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (إيليا أبو ماضي، «أيلول»).
Exam (most faithful source): gdrive 1dq9rWXm5_tH1FAenNytv0hXRBIoHYVws (بكالوريا العربية 2019 علوم تجريبية.docx);
same paper as PDF (owner's retyped copy): gdrive 1v6WwbxMieAQ3LaP_dycDErBcceOPjT1d (BAC 2019 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1_Do5yXwiul_Q_ZRld2B8LrUqs6cYuaFm (01_الموضوع.pdf, pages 1–2, read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1wl30Lc7mftCYHQBj851JXF3wTYVx3VyX (02_التصحيح.pdf, pages 1–2).

Method (same as the BAC 2020–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly, tatweel kept; outer whitespace / direction marks trimmed) and re-checked programmatically against it.
The poem table keeps one row per verse: [number, صدر, عجز]; the docx writes the number glued to the صدر («1-الحُسنُ…»), it
is split into its own column, and a soft line break inside the صدر of verse 2 («وفـــي⏎ الرُّبى») is read as a space.
The correction PDF's text layer is reversed presentation-form Arabic, so the mark scheme was read from the rendered pages
(150 dpi, fully legible). Every mark comes from the official scheme; correct options and explanations condense its wording.

DEFECT IN THE OWNER'S COPY (to review): verse 5 reads «لا تحسب الأنهار ماء رقصـــــا» in the docx (and its PDF); the official
paper (page 1, re-read at 300 dpi) has «ماء راقصــا» (the metre and the i'rab of the underlined «ماء» as «مفعول به ثان» need
«راقصا»). The only change to the docx text: «رقصـــــا» → «راقصـــــا» in that hemistich.

Conversion notes / points for the owner's review:
- Streams: the official header lists «علوم تجريبية، رياضيات، تسيير واقتصاد، تقني رياضي» (one common paper) ⇒ SCI, MATH, GE, TM.
- «ما تحته خطّ»: underlined in docx and official paper: «منظرا» (ب2), «ماء» (ب5); sentences (يمشي) ب2 and (تهمّ) ب7.
- Rule used for «n×m» lines (as in the BAC 2020 converters): a list of interchangeable items (any k of those listed) is one
  element; distinct demands (type / explanation / effect, dominant / serving type…) are one element each.
- Q1: «2×0.5» content (one element) + «2×0.5» addressees (الإنسان عامّة، المتشائم خاصّة; one element) + «2×0.5» opinion:
  «إجابة استئناسيّة… تُقبل كلّ إجابة معلّلة» ⇒ position (0.5) and justification (0.5) deferred as essay_builder (rule 11).
- Q2: «01 + 0.5» per side (effect + example; «يكتفي الممتحن بذكر مثالين») ⇒ four elements.
- Q3: «2×0.5» school (الرّابطة القلميّة ذات الاتّجاه الرّومانسيّ) + «2×0.5» two principles (seven listed) + «2×0.5» examples.
- Q4 (تلخيص) «3×01» = الإلمام بالمضمون / الحجم / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2 Q1: «2×0.5» the two types (وصفيّ غالب، أمريّ إيعازيّ خادم) + «4×0.25» per type (two indicators with examples).
- Part 2 Q3: one «0.75» line per sentence (type + purpose, no split given) ⇒ one element each, two steps inside.
- Part 2 Q4: «3×0.25» per image (type, explanation, effect) ⇒ six elements. For «العطر أنفاس الثّرى» the scheme says
  «تشبيه بليغ»; «استعارة مكنيّة» is not used as a distractor there (it could be argued for «أنفاس الثّرى»).
"""
import json, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2019-sci-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1dq9rWXm5_tH1FAenNytv0hXRBIoHYVws"
DOCX_TITLE = "بكالوريا العربية 2019 علوم تجريبية.docx"
PDF_ID = "1v6WwbxMieAQ3LaP_dycDErBcceOPjT1d"
OFFICIAL_ID = "1_Do5yXwiul_Q_ZRld2B8LrUqs6cYuaFm"
CORR_ID = "1wl30Lc7mftCYHQBj851JXF3wTYVx3VyX"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من فقرات ملفّ docx بـ python-docx: تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
POEM = [['1-', 'الحُسنُ حولك في الوهاد وفي الــذُّرى', 'فانْــظر، ألست ترى الجَمالَ كما أرى؟'], ['2-', '"أيلـــولُ" (يمشي) فـــي الحـــقول وفـــي الرُّبى', 'والأرض فـــــي "أيلـــولَ" أحسن منــــــظرا'], ['3-', 'شهــــــــرٌ يــــــــــوزِّع فـــــــي الطّـــــــبيعة فــــنَّـــه', 'شجــــــــرًا يُصَـــــــفِّـــقُ أو سَنّـــــــــا مُتفـــــــــــــجِّرا'], ['4-', 'فالنُّـــــورُ سِحـــــرٌ دافِـــقٌ، والمــــاء شِعرٌ', 'رائــــــــــقٌ، والعطـــــــــر أنفــــــــــاسُ الثّـــــــــــــــرى'], ['5-', 'لا تحـــــســب الأنهــــــــار مــــــاء رقصـــــا', 'هـــــــذي أغانــــــيه استحَــــــــــــــالت أنهُـــــــــــــــرا'], ['6-', 'وانظر إلى الأشجار تخلعُ أخضــــرا', 'عنـــــــــــها وتلـــــــــبس أحمــــــــرا أو أصفــــــــرا'], ['7-', 'فكأنّــــــــــما نــــــــــــــــــارٌ هنـــــــــــــــاك خفيَّـــــــــــة', 'تَنحَـــــــــــلُّ حـــــــــين (تَهُـــــمُّ) أن تستـشعِرا'], ['8-', 'وتــــــذوبُ أصبــــــاغاً كألــوان الضُّحى', 'وتمـــــــــــوجُ ألحــــــــــــانا وتســــــــــري عنْبـــــــــــرا'], ['9-', 'صـــــــــورٌ وأطيـــــــــــافٌ تلـــــــــــــوحُ خفـــــــيفة', 'وكأنّــــــــها صــــــورٌ نَـــــــراها فــــــــي الكَـــــرَى'], ['10-', 'لله مـــــن " أيلـــــــول" شهــــرٍ ســـــــاحرٍ!', 'سبَـــــــــقَ الشُّهـــــــورَ وإن أتَــــــى مُتأخـــــــرا'], ['11-', 'مَـــن ذا يُدَبِّـــــج أو يَحُـــوكُ كوَشْـــــــيِهِ', 'أو مَـــــــن يُصَـــــوّرُ مثلـــــما قــــد صــــــوّرا؟'], ['12-', 'لَمَـــست أصـــابعُه السَّمـــاء، فَوَجْهُها', 'ضـــــــاح ومَـــــــرَّ علــــــــى التُّــــــراب فنـــــــوّرا'], ['13-', 'رَدَّ الجَــــــلالَ إلـــــى الحيــــــــاة وردّنِـــــــي', 'مــــن أرض "نيويورك" إلــــى "أم القــرى"']]
REF1 = '-إيليا أبو ماضي - تبر وتراب - ط:03 - 1978\n- دار العلم للملايين - بيروت- لبنان - ص71/72/73- (بتصرّف).'
GLOSS1 = 'الشرح اللغوي: الوهاد: المنخفضات / الذُّرى: جمع ذُروة: أعلى كل شيء.\nأيلول: شهر سبتمبر/ الكرى: النّوم / يدبّج: يزيّن / وشْيِه: زخرفته.'
P1A = 'أوّلا- البناء الفكري: (12 نقاط)'
P1B = 'ثانيا- البناء اللّغوي: (08 نقاط)'
QT1 = ['تحمل القصيدة في طيّاتها خطابًا، ما مضمونه؟ إلى من يوجّهه الشّاعر؟ أَبْدِ رأيك فيه مع التّعليل.', 'تعكس القصيدة أثر شهر «أيلول» على نفسيّة الشّاعر والطّبيعة معًا، وضّح ذلك مع التمثيل من القصيدة.', 'إلى أيّة مدرسة أدبيّة ينتمي الشّاعر؟ استخرج مبدأين بارزين لها مع التمثيل من النّص.', 'لخّص مضمون النّص مراعيًا التقنية.', 'في النّص نمطان أحدهما غالب والآخر خادم له. حدّدهما، واُذكر مؤشّرين لكل واحدٍ منهما مع التمثيل.', 'أعرب:\nأ-إعرابَ مفردات:\n«منظرا» الواردة في عجز البيت الثاني.\n«ماء» الواردة في صدر البيت الخامس.\nب-إعراب جمل:\n(يمشي) الواردة في صدر البيت الثّاني.\n(تهمّ) الواردة في عجز البيت السّابع.', 'حدّد نوع الأسلوب وغرضه البلاغي في قول الشّاعر:\n(لله من أيلول شهر ساحر!) الوارد في صدر البيت العاشر.\n(من ذا يدبّج أو يحوك كوشيه؟) الوارد في صدر البيت الحادي عشر.', 'في العبارتين التاليتين صورتان بيانيّتان. بيّن نوعهما واشرحهما، ثم قف على سرّ بلاغة كلّ منهما:\n(العطر أنفاس الثّرى) الواردة في عجز البيت الرّابع.\n(الأشجار تخلع أخضرا) الواردة في صدر البيت السّادس.']


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


# ── تصحيح خلل نسخة docx من الموضوع الرّسميّ (01_الموضوع.pdf، ص1): «رقصا» ← «راقصا» في صدر البيت الخامس ──
assert POEM[4][0] == "5-" and POEM[4][1].count("رقصـــــا") == 1
POEM[4][1] = POEM[4][1].replace("رقصـــــا", "راقصـــــا")

TEXT_DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "النّصّ", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": REF1},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": GLOSS1},
]
D = TEXT_DOCS

q("q1", "1", P1A, QT1[0], 3, [el("q1-e1", "مضمون الخطاب (2×0.5)", 1), el("q1-e2", "المخاطَب (2×0.5)", 1),
                              el("q1-e3", "إبداء الرّأي: الموقف", 0.5), el("q1-e4", "إبداء الرّأي: التّعليل", 0.5)], D)
q("q2", "2", P1A, QT1[1], 3, [el("q2-e1", "أثر «أيلول» على نفسيّة الشّاعر", 1), el("q2-e2", "التّمثيل لأثره على نفسيّة الشّاعر", 0.5),
                              el("q2-e3", "أثر «أيلول» على الطّبيعة", 1), el("q2-e4", "التّمثيل لأثره على الطّبيعة", 0.5)], D)
q("q3", "3", P1A, QT1[2], 3, [el("q3-e1", "المدرسة الأدبيّة (2×0.5)", 1), el("q3-e2", "مبدآن بارزان (2×0.5)", 1),
                              el("q3-e3", "التّمثيل لهما من النّصّ (2×0.5)", 1)], D)
q("q4", "4", P1A, QT1[3], 3, [el("q4-e1", "التّلخيص: الإلمام بالمضمون", 1), el("q4-e2", "التّلخيص: الحجم", 1),
                              el("q4-e3", "التّلخيص: سلامة اللّغة", 1)], D)
q("q5", "1", P1B, QT1[4], 3, [el("q5-e1", "النّمط الغالب", 0.5), el("q5-e2", "النّمط الخادم", 0.5),
                              el("q5-e3", "مؤشّرا النّمط الوصفيّ مع التّمثيل (4×0.25)", 1), el("q5-e4", "مؤشّرا النّمط الأمريّ الإيعازيّ مع التّمثيل (4×0.25)", 1)], D)
q("q6", "2", P1B, QT1[5], 2, [el("q6-e1", "إعراب «منظرا» (ب2)", 0.5), el("q6-e2", "إعراب «ماء» (ب5)", 0.5),
                              el("q6-e3", "محلّ جملة (يمشي) (ب2)", 0.5), el("q6-e4", "محلّ جملة (تهمّ) (ب7)", 0.5)], D)
q("q7", "3", P1B, QT1[6], 1.5, [el("q7-e1", "(لله من أيلول شهر ساحر!): النّوع والغرض", 0.75), el("q7-e2", "(من ذا يدبّج أو يحوك كوشيه؟): النّوع والغرض", 0.75)], D)
q("q8", "4", P1B, QT1[7], 1.5, [el("q8-e1", "(العطر أنفاس الثّرى): النّوع", 0.25), el("q8-e2", "(العطر أنفاس الثّرى): الشّرح", 0.25),
                                el("q8-e3", "(العطر أنفاس الثّرى): سرّ البلاغة", 0.25), el("q8-e4", "(الأشجار تخلع أخضرا): النّوع", 0.25),
                                el("q8-e5", "(الأشجار تخلع أخضرا): الشّرح", 0.25), el("q8-e6", "(الأشجار تخلع أخضرا): سرّ البلاغة", 0.25)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ما مضمون الخطاب الّذي تحمله القصيدة في طيّاتها؟",
   {"options": ["دعوة الشّاعر إلى تأمّل الطّبيعة في شهر «أيلول» لتغيير نظرتنا المتشائمة إلى هذا الفصل",
                "دعوة الشّاعر إلى الحزن على انقضاء فصل الصّيف", "الإشادة بالحياة في المدن الصّناعيّة الحديثة", "التّحذير من تقلّبات الطّبيعة ومخاطرها"]},
   {"correct": 0}, "تضمّنت القصيدة خطابًا يتمحور حول دعوة الشّاعر إلى تأمّل الطّبيعة في شهر «أيلول»، لتغيير نظرتنا المتشائمة والسّوداويّة إلى هذا الفصل.", 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل مضمون الخطاب:",
   {"text": "يتمحور الخطاب حول دعوة الشّاعر إلى ____ الطّبيعة في شهر «أيلول»، لتغيير نظرتنا ____ والسّوداويّة إلى هذا الفصل.",
    "bank": ["تأمّل", "المتشائمة", "هجر", "المتفائلة"]},
   {"blanks": [["تأمّل"], ["المتشائمة"]]}, "«تضمّنت القصيدة خطابًا يتمحور حول دعوة الشّاعر إلى تأمّل الطّبيعة في شهر «أيلول»، لتغيير نظرتنا المتشائمة والسّوداويّة إلى هذا الفصل».", 0.5, "ar.comprehension.idea", "b")
st("s03", "q1", "q1-e2", "multi", "إلى من يوجّه الشّاعر خطابه؟ (اختر كلّ ما يصحّ)",
   {"options": ["إلى الإنسان عامّة", "إلى المتشائم خاصّة", "إلى شهر «أيلول»", "إلى الأشجار والأنهار", "إلى أهل «أمّ القرى» وحدهم"]},
   {"correct": [0, 1]}, "يوجّه الشّاعر خطابه إلى الإنسان عامّة، والمتشائم خاصّة.", 1, "ar.comprehension.details")
OPINION_SPEC = {"task": "إبداء الرّأي مع التّعليل", "question": QT1[0],
                "model": "إجابة استئناسيّة: الشّاعر محقّ فيما دعا إليه حسب البيئة الّتي كان يصفها في نيويورك، إذ في «أيلول» تتجدّد الطّبيعة وتتغيّر ألوانها (شهر يوزّع في الطّبيعة فنّه)، ممّا استهوى الشّاعر، لذلك لابدّ أن نغيّر نظرتنا إليه كفصل كئيب موحش… (ملاحظة: تُقبل كلّ إجابة معلّلة)."}
OPINION_EXPL = "رأي الممتحن مع التّعليل (إجابة استئناسيّة): الشّاعر محقّ فيما دعا إليه… ملاحظة: تُقبل كلّ إجابة معلّلة."
essay("s04", "q1", "q1-e3", "رأيك في خطاب الشّاعر", "الموقف", "إبداء موقف واضح من خطاب الشّاعر", 0.5, OPINION_SPEC, OPINION_EXPL, "ar.comprehension.opinion")
essay("s05", "q1", "q1-e4", "رأيك في خطاب الشّاعر", "التّعليل", "تعليل الموقف بحجّة مناسبة (تُقبل كلّ إجابة معلّلة)", 0.5, OPINION_SPEC, OPINION_EXPL, "ar.comprehension.opinion")
st("s06", "q2", "q2-e1", "mcq", "ما أثر شهر «أيلول» على نفسيّة الشّاعر؟",
   {"options": ["الشّاعر متفائل بشهر «أيلول» معجب بسحره وتجدّد الطّبيعة فيه", "الشّاعر حزين لأنّ «أيلول» يُذبل الطّبيعة ويُعرّيها",
                "الشّاعر خائف من تقلّبات «أيلول» وعواصفه", "الشّاعر غير مبالٍ بتعاقب الشّهور"]},
   {"correct": 0}, "أثر «أيلول» على نفسيّة الشّاعر: الشّاعر متفائل بشهر «أيلول» معجب بسحره وتجدّد الطّبيعة فيه.", 0.5, "ar.comprehension.emotion")
st("s07", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "الشّاعر ____ بشهر «أيلول» ____ بسحره وتجدّد الطّبيعة فيه.", "bank": ["متفائل", "معجب", "متشائم", "ضجر"]},
   {"blanks": [["متفائل"], ["معجب"]]}, "«الشّاعر متفائل بشهر «أيلول» معجب بسحره وتجدّد الطّبيعة فيه».", 0.5, "ar.comprehension.emotion", "b")
st("s08", "q2", "q2-e2", "fill_blank", "أكمل الشّاهدين الدّالّين على أثر «أيلول» في نفسيّة الشّاعر:",
   {"text": "«شهرٌ يوزّع في الطّبيعة ____» – «لله من «أيلول» شهرٍ ____!»", "bank": ["فنَّه", "ساحرٍ", "لونَه", "حزينٍ"]},
   {"blanks": [["فنَّه"], ["ساحرٍ"]]}, "ويتجلّى ذلك في قوله: (شهر يوزّع في الطّبيعة فنّه – لله من «أيلول» شهر ساحر! – من ذا الّذي يدبّج ويحوك كوشيه…). يكتفي الممتحن بذكر مثالين من النّصّ.", 0.5, "ar.comprehension.evidence")
st("s09", "q2", "q2-e3", "mcq", "ما أثر شهر «أيلول» على الطّبيعة؟",
   {"options": ["تتغيّر مناظرها لتصبح لوحة فنّيّة تسحر الألباب كتلك الّتي يراها النّائم في حلمه", "تذبل وتفقد ألوانها فتصير موحشة كئيبة",
                "تبقى على حالها لا يطرأ عليها تغيير", "تثور عواصفها فتُخيف الإنسان"]},
   {"correct": 0}, "أثر «أيلول» على الطّبيعة: تتغيّر مناظرها لتصبح لوحة فنّيّة تسحر الألباب كتلك الّتي يراها النّائم في حلمه.", 0.5, "ar.comprehension.image")
st("s10", "q2", "q2-e3", "fill_blank", "أكمل:",
   {"text": "تتغيّر ____ الطّبيعة لتصبح لوحة ____ تسحر الألباب، كتلك الّتي يراها النّائم في حلمه.", "bank": ["مناظر", "فنّيّة", "قوانين", "باهتة"]},
   {"blanks": [["مناظر"], ["فنّيّة"]]}, "«أثر «أيلول» على الطّبيعة: تتغيّر مناظرها لتصبح لوحة فنّيّة تسحر الألباب كتلك الّتي يراها النّائم في حلمه».", 0.5, "ar.comprehension.image", "b")
st("s11", "q2", "q2-e4", "multi", "أيّ الأمثلة الآتية من القصيدة يتجلّى فيها أثر «أيلول» على الطّبيعة؟ (اختر كلّ ما يصحّ)",
   {"options": ["«فالنّورُ سحرٌ دافقٌ»", "«والماءُ شعرٌ رائقٌ»", "«ردّ الجلالَ إلى الحياة»", "«مَن ذا يُدبّج أو يحوكُ كوَشْيِه»", "«لله من «أيلول» شهرٍ ساحرٍ!»"]},
   {"correct": [0, 1, 2]}, "يتجلّى أثره على الطّبيعة في قوله: (النّور سحر دافق – الماء شعر رائق – الأنهار ماء راقص – ردّ الجلال إلى الحياة…)؛ أمّا «لله من أيلول شهر ساحر!» و«من ذا يدبّج…» فمثّل بهما الحلّ لأثره على نفسيّة الشّاعر.", 0.5, "ar.comprehension.evidence")
st("s12", "q3", "q3-e1", "mcq", "إلى أيّة مدرسة أدبيّة ينتمي إيليا أبو ماضي؟",
   {"options": ["مدرسة الرّابطة القلميّة", "مدرسة الإحياء والبعث", "جماعة الدّيوان", "جماعة أبولو"]},
   {"correct": 0}, "ينتمي الشّاعر إيليا أبو ماضي إلى مدرسة الرّابطة القلميّة ذات الاتّجاه الرّومانسيّ.", 0.5, "ar.literature.trend")
st("s13", "q3", "q3-e1", "mcq", "ما الاتّجاه الّذي تنتمي إليه مدرسة الرّابطة القلميّة؟",
   {"options": ["الاتّجاه الرّومانسيّ", "الاتّجاه الكلاسيكيّ الإحيائيّ", "الاتّجاه الواقعيّ", "الاتّجاه الرّمزيّ"]},
   {"correct": 0}, "مدرسة الرّابطة القلميّة ذات الاتّجاه الرّومانسيّ.", 0.5, "ar.literature.trend", "b")
st("s14", "q3", "q3-e2", "multi", "أيّ ممّا يلي من مبادئ مدرسة الرّابطة القلميّة البارزة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["النّزعة التّأمّليّة", "التّغنّي بالطّبيعة والاستلهام من عناصرها", "سهولة اللّغة وبساطتها", "الدّعوة إلى التّفاؤل والبعد عن التّشاؤم",
                "محاكاة القدماء في بناء القصيدة ومعجمها", "الإكثار من الألفاظ الغريبة الجزلة"]},
   {"correct": [0, 1, 2, 3]}, "من مبادئها البارزة في النّصّ: النّزعة التّأمّليّة، التّغنّي بالطّبيعة والاستلهام من عناصرها، سهولة اللّغة وبساطتها، توظيف الخيال والبعد عن التّكلّف، الدّعوة إلى التّفاؤل والبعد عن التّشاؤم، النّزعة الإنسانيّة، الوحدة العضويّة. يستخرج الممتحن مبدأين بارزين مع التّمثيل.", 1, "ar.literature.trend")
st("s15", "q3", "q3-e3", "matching", "طابق كلّ مبدأ بمثاله من النّصّ.",
   {"lefts": ["النّزعة التّأمّليّة", "التّغنّي بالطّبيعة والاستلهام من عناصرها", "سهولة اللّغة وبساطتها"],
    "rights": ["«وانظرْ إلى الأشجار…»", "«الوهاد – الذّرى – الحقول – الرّبى»", "«ساحر – يصفّق»", "«من أرض «نيويورك» إلى «أمّ القرى»»"]},
   {"pairs": [0, 1, 2]}, "النّزعة التّأمّليّة (انظر إلى الأشجار – انظر ألست ترى الجمال…)، التّغنّي بالطّبيعة (الوهاد – الذّرى – الحقول – الرّبى…)، سهولة اللّغة وبساطتها (ساحر – يمشي – يصفّق…).", 1, "ar.literature.trend")
SUM_SPEC = {"task": "تلخيص", "text": "قصيدة إيليا أبي ماضي في «أيلول» (بكالوريا 2019، الشّعب العلميّة، الموضوع الأوّل)"}
SUM_EXPL = "تلخيص مضمون النّصّ: يراعي فيه الممتحن الإلمام بالمضمون، الحجم، سلامة اللّغة (نقطة لكلّ معيار)."
for i, (crit, ind) in enumerate([("الإلمام بالمضمون", "الإلمام بمضمون النّصّ"), ("الحجم", "مراعاة حجم التّلخيص"), ("سلامة اللّغة", "سلامة اللّغة")]):
    essay(f"s{16 + i}", "q4", f"q4-e{i + 1}", "تلخيص قصيدة «أيلول» لإيليا أبي ماضي", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s19", "q5", "q5-e1", "mcq", "ما النّمط الغالب في القصيدة؟",
   {"options": ["الوصفيّ", "السّرديّ", "الحجاجيّ", "التّفسيريّ"]},
   {"correct": 0}, "في النّصّ نمطان: الغالب هو الوصفيّ، والخادم له أمريّ إيعازيّ.", 0.5, "ar.text.type")
st("s20", "q5", "q5-e2", "mcq", "ما النّمط الخادم للنّمط الغالب في القصيدة؟",
   {"options": ["الأمريّ الإيعازيّ", "السّرديّ", "الحواريّ", "التّفسيريّ"]},
   {"correct": 0}, "الخادم للنّمط الوصفيّ هو النّمط الأمريّ الإيعازيّ.", 0.5, "ar.text.type")
st("s21", "q5", "q5-e3", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["توظيف النّعوت", "توظيف الأحوال", "الإكثار من الصّور البيانيّة", "توظيف أفعال الأمر والنّهي", "تتابع الأحداث في الزّمن"]},
   {"correct": [0, 1, 2]}, "مؤشّرات النّمط الوصفيّ: توظيف النّعوت، توظيف الأحوال، الإكثار من الصّور البيانيّة؛ أمّا الأمر والنّهي فمن مؤشّرات النّمط الأمريّ الإيعازيّ.", 0.5, "ar.text.type")
st("s22", "q5", "q5-e3", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط الوصفيّ بمثاله.",
   {"lefts": ["توظيف النّعوت", "توظيف الأحوال", "الإكثار من الصّور البيانيّة"],
    "rights": ["«سنًا متفجّرا»", "«تلوحُ خفيفة»", "««أيلول» يمشي»", "«لا تحسب…»"]},
   {"pairs": [0, 1, 2]}, "توظيف النّعوت (سنا متفجّرا)، توظيف الأحوال (تلوح خفيفة)، الإكثار من الصّور البيانيّة («أيلول» يمشي – النّور سحر…)؛ و«لا تحسب…» نهي من مؤشّرات النّمط الأمريّ.", 0.5, "ar.text.type", "b")
st("s23", "q5", "q5-e4", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الأمريّ الإيعازيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["توظيف الأساليب الإنشائيّة الطّلبيّة كالأمر والنّهي", "توظيف ضمائر المخاطب", "توظيف النّعوت والأحوال", "الإكثار من الأفعال الماضية السّرديّة"]},
   {"correct": [0, 1]}, "مؤشّرات النّمط الأمريّ الإيعازيّ: توظيف الأساليب الإنشائيّة الطّلبيّة كالأمر (انظر…) والنّهي (لا تحسب…)، توظيف ضمائر المخاطب (الحسن حولك…).", 0.5, "ar.text.type")
st("s24", "q5", "q5-e4", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط الأمريّ الإيعازيّ بمثاله.",
   {"lefts": ["الأمر", "النّهي", "ضمائر المخاطب"], "rights": ["«فانظرْ، ألستَ ترى الجمال…»", "«لا تحسب الأنهار…»", "«الحسن حولك…»", "«تلوحُ خفيفة»"]},
   {"pairs": [0, 1, 2]}, "الأمر (انظر…)، النّهي (لا تحسب…)، ضمائر المخاطب (الحسن حولك…)؛ و«تلوح خفيفة» حال من مؤشّرات الوصف.", 0.5, "ar.text.type", "b")
st("s25", "q6", "q6-e1", "mcq", "ما إعراب «منظرا» في عجز البيت الثّاني: «والأرض في «أيلولَ» أحسن منظرا»؟",
   {"options": ["تمييز اسم تفضيل منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "حال منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«منظرًا»: تمييز اسم تفضيل منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s26", "q6", "q6-e2", "fill_blank", "أكمل إعراب «ماء» في صدر البيت الخامس: «لا تحسب الأنهار ماءً راقصا»:",
   {"text": "ماءً: مفعول به ____ منصوب وعلامة نصبه ____ الظّاهرة على آخره.", "bank": ["ثان", "الفتحة", "أوّل", "الألف"]},
   {"blanks": [["ثان"], ["الفتحة"]]}, "«ماءً»: مفعول به ثان منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s27", "q6", "q6-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (يمشي) في صدر البيت الثّاني؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر المبتدأ «أيلول»", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع نعت", "جملة فعليّة لا محلّ لها من الإعراب، استئنافيّة"]},
   {"correct": 0}, "(يمشي): جملة فعليّة في محلّ رفع خبر المبتدأ «أيلول».", 0.5, "ar.grammar.sentence_case")
st("s28", "q6", "q6-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (تهمّ) في عجز البيت السّابع: «تنحلّ حين تهمّ أن تستشعرا»؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(تهمّ): جملة فعليّة في محلّ جرّ مضاف إليه (بعد الظّرف «حين»).", 0.5, "ar.grammar.sentence_case")
st("s29", "q7", "q7-e1", "mcq", "ما نوع الأسلوب في قوله: (لله من أيلول شهر ساحر!)؟",
   {"options": ["أسلوب إنشائيّ نوعه التّعجّب", "أسلوب إنشائيّ نوعه النّداء", "أسلوب إنشائيّ نوعه الاستفهام", "أسلوب خبريّ"]},
   {"correct": 0}, "(لله من «أيلول» شهر ساحر!): أسلوب إنشائيّ نوعه التّعجّب غرضه التّعظيم.", 0.25, "ar.rhetoric.insha")
st("s30", "q7", "q7-e1", "mcq", "ما الغرض البلاغيّ للتّعجّب في (لله من أيلول شهر ساحر!)؟",
   {"options": ["التّعظيم", "التّحقير", "التّمنّي", "النّفي والإنكار"]},
   {"correct": 0}, "غرضه التّعظيم.", 0.5, "ar.rhetoric.insha")
st("s31", "q7", "q7-e2", "mcq", "ما نوع الأسلوب في قوله: (من ذا يدبّج أو يحوك كوشيه؟)؟",
   {"options": ["أسلوب إنشائيّ نوعه استفهام", "أسلوب إنشائيّ نوعه تعجّب", "أسلوب إنشائيّ نوعه أمر", "أسلوب خبريّ"]},
   {"correct": 0}, "(من ذا يدبّج أو يحوك كوشيه؟): أسلوب إنشائيّ نوعه استفهام غرضه النّفي والإنكار.", 0.25, "ar.rhetoric.insha")
st("s32", "q7", "q7-e2", "mcq", "ما الغرض البلاغيّ للاستفهام في (من ذا يدبّج أو يحوك كوشيه؟)؟",
   {"options": ["النّفي والإنكار", "التّعظيم", "التّمنّي", "التّحسّر"]},
   {"correct": 0}, "غرضه النّفي والإنكار: لا أحد يدبّج أو يحوك مثل وشي «أيلول».", 0.5, "ar.rhetoric.insha")
st("s33", "q8", "q8-e1", "mcq", "ما نوع الصّورة البيانيّة في (العطر أنفاس الثّرى)؟",
   {"options": ["تشبيه بليغ", "تشبيه مرسل مجمل", "كناية عن صفة", "مجاز مرسل"]},
   {"correct": 0}, "(العطر أنفاس): تشبيه بليغ.", 0.25, "ar.rhetoric.simile")
st("s34", "q8", "q8-e2", "matching", "اشرح الصّورة: حدّد أركان التّشبيه في (العطر أنفاس الثّرى).",
   {"lefts": ["المشبّه", "المشبّه به", "المحذوف"], "rights": ["العطر", "أنفاس", "أداة التّشبيه ووجه الشّبه", "الثّرى"]},
   {"pairs": [0, 1, 2]}, "المشبّه (العطر)، المشبّه به (أنفاس)، حذف أداة التّشبيه ووجه الشّبه.", 0.25, "ar.rhetoric.simile")
st("s35", "q8", "q8-e3", "mcq", "ما سرّ بلاغة التّشبيه في (العطر أنفاس الثّرى)؟",
   {"options": ["توضيح الصّورة وتقريبها إلى الذّهن وتقوية المعنى، وإبراز تأثير شهر «أيلول» على الطّبيعة", "إثبات الصّفة مصحوبة بالدّليل",
                "إحداث جرس موسيقيّ تطرب له الأذن", "الإيجاز وإشغال ذهن المتلقّي بالبحث عن العلاقة"]},
   {"correct": 0}, "أثرها البلاغيّ والمعنويّ: توضيح الصّورة وتقريبها إلى الذّهن وتقوية المعنى وإبراز تأثير شهر «أيلول» على الطّبيعة.", 0.25, "ar.rhetoric.effect")
st("s36", "q8", "q8-e4", "mcq", "ما نوع الصّورة البيانيّة في (الأشجار تخلع أخضرا)؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن موصوف"]},
   {"correct": 0}, "(الأشجار تخلع أخضرا): استعارة مكنيّة.", 0.25, "ar.rhetoric.metaphor")
st("s37", "q8", "q8-e5", "fill_blank", "أكمل شرح الصّورة في (الأشجار تخلع أخضرا):",
   {"text": "شبّه الشّاعر ____ بإنسان يخلع ثوبه، فحذف المشبّه به (الإنسان) وأشار إليه بقرينة دالّة (____).", "bank": ["الأشجار", "تخلع", "الأوراق", "أخضرا"]},
   {"blanks": [["الأشجار"], ["تخلع"]]}, "شبّه الأشجار بإنسان يخلع ثوبه فحذف المشبّه به (الإنسان) وأشار إليه بقرينة دالّة (تخلع).", 0.25, "ar.rhetoric.metaphor")
st("s38", "q8", "q8-e6", "mcq", "ما سرّ بلاغة الاستعارة في (الأشجار تخلع أخضرا)؟",
   {"options": ["تشخيص المعنى وتقويته وتأكيده، وإبراز تأمّل الشّاعر في تغيّر لون الأشجار", "إيهام المتلقّي بالتّطابق بين المشبّه والمشبّه به",
                "إثبات الصّفة مصحوبة بالدّليل", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "أثرها البلاغيّ والمعنويّ: تشخيص المعنى وتقويته وتأكيده، وإبراز تأمّل الشّاعر في تغيّر لون الأشجار.", 0.25, "ar.rhetoric.effect")

TITLE = "بكالوريا 2019 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (إيليا أبو ماضي: أيلول)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2019، الشّعب العلميّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. الموضوع الرّسميّ للمقارنة: gdrive:{OFFICIAL_ID} (01_الموضوع.pdf). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين "
         "(الصّفحتان 1–2، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة). رأس التّصحيح الرّسميّ: «علوم تجريبيّة + تسيير واقتصاد + رياضيات + تقني رياضي» فاعتُمدت الشّعب الأربع. "
         "خلل في نسخة docx: «لا تحسب الأنهار ماء رقصا» والموضوع الرّسميّ «ماء راقصا» فصُحّحت الكلمة وحدها — للمراجعة. "
         "ما تحته خطّ في docx والموضوع الرّسميّ: «منظرا» (ب2) و«ماء» (ب5). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
         "مؤجَّل (essay_builder): إبداء الرّأي في س1 (الموقف 0.5 + التّعليل 0.5، «تُقبل كلّ إجابة معلّلة») والتّلخيص س4 (3×01).")
LOG_NOTE = "تحويل من نسخة الموضوع (docx) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive، مع مقابلة الموضوع الرّسميّ (تصحيح «رقصا» ← «راقصا»)؛ العلامات من سلّم التّنقيط؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."


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
