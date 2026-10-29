"""Conversion: BAC 2019 (session عاديّة) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (سليمان العيسى، «نتفرّج»).
Exam (most faithful source): gdrive 1G-67LqKesHvGWDjUDGzlaK3cCgfb21LH (بكالوريا العربية 2019 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's retyped copy): gdrive 1AK7pLFSWijO2V0LpUK575V0Xk8BGUBjr (BAC 2019 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1j7jgdCen7SxETV0oiHjRtnz4W5WXkmzP (01_الموضوع.pdf, pages 1–2, read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1aLXDBz9Mg39gHPVxPnAk1-VWSEXjG7OO (02_التصحيح.pdf, pages 1–2).

Method (same as the BAC 2020–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; outer whitespace / direction marks trimmed). The free-verse poem sits in a two-cell table (right
column: stanzas 1–2, left column: stanzas 3–4, separated by «***» as on the paper); each cell is kept line by line (empty
lines dropped, the indentation before «***» trimmed). The docx matches the official paper (spacing/diacritics only).
The correction PDF's text layer is reversed presentation-form Arabic, so the mark scheme was read from the rendered pages
(150 dpi; the scansion table re-read at 300 dpi). Every mark comes from the official scheme; correct options and
explanations condense its wording.

Conversion notes / points for the owner's review:
- Q1: «2×0.5» the aim (إحياء الضّمير العربيّ وإيقاظ الهمم / الحثّ على الصّمود والتّصدّي; one element) + 0.5 why Gaza.
- Q2, Q3: 0.5 + 0.5 (the two demands of each question). Q4: three 0.5 lines (committed + why / link with his national
  tendency / justification) ⇒ three elements.
- Q5: 0.5 type + 0.5 justification + «2×0.25» indicators + «2×0.25» examples («يكتفي الممتحن بذكر مؤشّرين مع التّمثيل»).
- Q6 (تلخيص المقطعين) «3×01» = الحجم / المضمون / سلامة اللّغة ⇒ three deferred essay_builder elements (the scheme's
  summary is «نموذج للاستئناس», kept as the model).
- Q5 examples: the scheme lists «الإضافات: (زنبقة الموت، حجارته، أمّتي)», but the poem has «يا أمِّي» (no «أمّتي»);
  the matching step uses only «زنبقة الموت، حجارته».
- Part 2 Q1: «2×0.25» per field (two words each, four listed for المعاناة, three for الاستكانة) ⇒ one element per field.
- Part 2 Q2: «3×0.25» per word = plural, pattern, kind ⇒ three elements per word.
- Part 2 Q3: «2×0.25» per word: the scheme does not say how the two quarters split («يجري»: verb + subject;
  «الثّكلى»: one line) ⇒ one element of 0.5 per word; sentences 0.5 each.
- Part 2 Q4 (تهتزّ عواصم): three 0.25 lines = type (مجاز عقليّ علاقته المكانيّة) / explanation / effect. «استعارة
  مكنيّة» and «مجاز مرسل» are not used as distractors (they could be argued); the distractors differ in the relation or kind.
- Part 2 Q5 (تقطيع): three 0.25 lines with «0.25 للكتابة العروضيّة والرّموز» ⇒ elements: writing+symbols / foot / metre.
  Scansion as in the scheme: نَتَفَرْ | رَجُ يَحْ | تَرِقُلْ | جَسَدُو = ///0 ///0 ///0 ///0 = فَعِلُنْ ×4, «فعلن» متغيّر «فاعلن»,
  بحر المتدارك (المحدث). «الخبب» is not used as a distractor.
- Part 3 (أ 02 / ب 02): the scheme gives only «نموذج للاستئناس» and «يستشهد الممتحن بما أمكنه من أبيات» ⇒ both deferred
  as essay_builder (rule 11); the models are kept in the spec.
"""
import json, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2019-lit-p1"
PAPER = 1
STREAMS = ["LIT"]
DOCX_ID = "1G-67LqKesHvGWDjUDGzlaK3cCgfb21LH"
DOCX_TITLE = "بكالوريا العربية 2019 شعبة اداب وفلسفة.docx"
PDF_ID = "1AK7pLFSWijO2V0LpUK575V0Xk8BGUBjr"
OFFICIAL_ID = "1j7jgdCen7SxETV0oiHjRtnz4W5WXkmzP"
CORR_ID = "1aLXDBz9Mg39gHPVxPnAk1-VWSEXjG7OO"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من فقرات ملفّ docx بـ python-docx: تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
TITLE1 = 'نتفرّج'
POEM_A = 'نتفَرّجُ.. يحترقُ الجسدُ\nفي غزّةَ، في الأرض الثّكلى\nفي كلّ مكان يتّقدُ\nيتساقط أطفالٌ قتلى\nويقاتل أطفالٌ جُدُدُ\nوالأمّة.. ماذا يعنينا؟\nالأمّة.. مَيْتٌ يتفرّجْ\n***\nيهتزُّ العالم من غضبِ\nتهتزُّ عواصمُ، تَنفعِلُ\nوشوارعُ فيها تَشتَعِلُ\nما يجري في الأرض الثّكلَى\nقمعًا، نسفًا، ذبحًا، قتلا\nلبّتهُ براكينُ الغضبِ\nإلّا في عالمنا العربي\nماذا يعنينا؟ نتفرّجْ'
POEM_B = 'يا قدسُ، ويا رامَ الله\nيا زنْبقَةَ الموت الأغْلَى\nيا أروع ما تَلِدُ الدُّنيا\nشَمخاتِ رؤوسٍ وجِباهِ\nلا تنتظري شيئًا مِنَّا\nمِنْ هذا المَيْتِ على الحِقَبِ\nمن عَالَمِنا الْعَربِي..\nماذا يعنينا؟ نتفرّج\n***\nيا أرضًا تُدعى المحتلّة\nيا أمِّي، يا أرضي الثّكْلَى\nالجسد الضَّخمُ العربيُّ\nسيّان: أَمَيْتٌ أمْ حَيُّ!\nوَطَنٌ تَنتَظِرُ حِجَارتُهُ\nيا غزّةُ.. أنْتِ شَرارَتُهُ\nهل يبقى أبدًا يتفرّجْ؟'
REF1 = 'سليمان العيسى. ديوان "أنا والقدس"، 2009.\nوزارة الثّقافة - الهيئة العامّة السّوريّة للكتاب - دمشق. ص: 83-85 (بتصرف)'
P1A = 'أوّلا- البناء الفكري: (10 نقاط)'
P1B = 'ثانيا- البناء اللّغوي: (06 نقاط)'
P1C = 'ثالثا- التّقويم النقدي: (04 نقاط)'
QT1 = ['صوَّر الشّاعر معاناة الشّعب الفلسطيني. ما هدفه من ذلك؟ ولماذا ركّز على غزّة؟', 'استياء الشّاعر بارز في القصيدة. إلامَ تعزو ذلك؟ وما علاقته بنفسيّة الشّاعر؟', 'لماذا نعَتَ الشّاعر الوطن العربيّ بالجسد الضّخم؟ وما دلالة تكرار لفظة "نتفرّج"؟', 'الالتزام من مميّزات الشّعر العربِيّ الحديث. هل يبدو لك الشاعر ملتزمًا؟ وما علاقة التزامه بنزعته؟ علّل.', 'تبنّى الشّاعر نمطًا مسايرا لطبيعة موضوع القصيدة. دُلَّ عليه مع التَّعليل. أذكُر مؤشرين مع التمثيل.', 'لخّص بأسلوبك الخاصّ معاني المقطعين: الثاني الذي يبتدئ من قوله: (يهتزّ العالم من غضب)،\nوالثّالث الذي يبتدئ من قوله: (يا قدسُ ويا رام الله).', 'في النّص حقلان معجميّان: حقل المعاناة، وحقل الاستكانة والخذلان. مثّل لكلٍّ منهما من النّصّ.', 'هاتِ الجمع من المفردتين الآتيتين، مبيّنًا الوزن والنّوع: (العالم)، (الجسَد).', 'أعرب ما يلي إعراب مفردات: "يجري" و "الثّكلى" في قوله: "ما يجري في الأرض الثكلى".\nثم بيّنْ المحل الإعرابيّ للجملتين: (نتفرّج) في قوله: " نَتفرّجُ.. يحترق الجسد" و(يتفرّج) في   قوله: "الأمّة ميت يتفرّج".', 'في العبارة الآتية صورة بيانية: (تهتزّ عواصم). اشرحها مبيّنا نوعها وسرّ بلاغتها.', 'قطّع قول الشّاعر: " نَتَفَرّجُ.. يحترِقُ الجسَدُ"، وحدّد التفعيلة والبحر.', 'المطلوب:\nأ-   هل كان لهذه القضيّة صدى في الشعر العربيّ الحديث؟ علِّل مستشهدًا بما درستَ.', 'ب-  تحدّث عن دور الشّعر العربيّ في معالجة قضايا الأمّة.']
CRIT1 = '«إنَّ القضيّة الفلسطينيّة قضيّة مؤلمة، ساكنة في قلب كلّ عربيّ خاصّة الذين خدموا قضايا أمّتهم العربيّة».'


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
    {"id": "d-title", "kind": "text", "caption": "العنوان", "text": TITLE1},
    {"id": "d-poem-a", "kind": "text", "caption": "النّصّ (1)", "text": POEM_A},
    {"id": "d-poem-b", "kind": "text", "caption": "النّصّ (2)", "text": POEM_B},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": REF1},
]
D = TEXT_DOCS
CRIT_DOCS = [{"id": "d-crit", "kind": "text", "caption": "القول", "text": CRIT1}]

q("q1", "1", P1A, QT1[0], 1.5, [el("q1-e1", "هدف الشّاعر من تصوير المعاناة (2×0.5)", 1), el("q1-e2", "سبب تركيزه على غزّة", 0.5)], D)
q("q2", "2", P1A, QT1[1], 1, [el("q2-e1", "ما يُعزى إليه استياء الشّاعر", 0.5), el("q2-e2", "علاقته بنفسيّة الشّاعر", 0.5)], D)
q("q3", "3", P1A, QT1[2], 1, [el("q3-e1", "سبب نعت الوطن العربيّ بالجسد الضّخم", 0.5), el("q3-e2", "دلالة تكرار «نتفرّج»", 0.5)], D)
q("q4", "4", P1A, QT1[3], 1.5, [el("q4-e1", "التزام الشّاعر", 0.5), el("q4-e2", "علاقة التزامه بنزعته", 0.5), el("q4-e3", "التّعليل", 0.5)], D)
q("q5", "5", P1A, QT1[4], 2, [el("q5-e1", "النّمط المساير لموضوع القصيدة", 0.5), el("q5-e2", "التّعليل", 0.5),
                              el("q5-e3", "مؤشّران (2×0.25)", 0.5), el("q5-e4", "التّمثيل لهما (2×0.25)", 0.5)], D)
q("q6", "6", P1A, QT1[5], 3, [el("q6-e1", "التّلخيص: الحجم", 1), el("q6-e2", "التّلخيص: المضمون", 1), el("q6-e3", "التّلخيص: سلامة اللّغة", 1)], D)
q("q7", "1", P1B, QT1[6], 1, [el("q7-e1", "حقل المعاناة: لفظتان (2×0.25)", 0.5), el("q7-e2", "حقل الاستكانة والخذلان: لفظتان (2×0.25)", 0.5)], D)
q("q8", "2", P1B, QT1[7], 1.5, [el("q8-e1", "«العالم»: الجمع", 0.25), el("q8-e2", "«العالم»: الوزن", 0.25), el("q8-e3", "«العالم»: النّوع", 0.25),
                                el("q8-e4", "«الجسد»: الجمع", 0.25), el("q8-e5", "«الجسد»: الوزن", 0.25), el("q8-e6", "«الجسد»: النّوع", 0.25)], D)
q("q9", "3", P1B, QT1[8], 2, [el("q9-e1", "إعراب «يجري» (2×0.25)", 0.5), el("q9-e2", "إعراب «الثّكلى» (2×0.25)", 0.5),
                              el("q9-e3", "محلّ جملة (نتفرّج)", 0.5), el("q9-e4", "محلّ جملة (يتفرّج)", 0.5)], D)
q("q10", "4", P1B, QT1[9], 0.75, [el("q10-e1", "(تهتزّ عواصم): النّوع", 0.25), el("q10-e2", "(تهتزّ عواصم): الشّرح", 0.25), el("q10-e3", "(تهتزّ عواصم): سرّ البلاغة", 0.25)], D)
q("q11", "5", P1B, QT1[10], 0.75, [el("q11-e1", "الكتابة العروضيّة والرّموز", 0.25), el("q11-e2", "التّفعيلة", 0.25), el("q11-e3", "البحر", 0.25)], D)
q("q12", "أ", P1C, QT1[11], 2, [el("q12-e1", "صدى القضيّة الفلسطينيّة في الشّعر العربيّ الحديث مع التّعليل والاستشهاد", 2)], D + CRIT_DOCS)
q("q13", "ب", P1C, QT1[12], 2, [el("q13-e1", "دور الشّعر العربيّ في معالجة قضايا الأمّة", 2)], D + CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "multi", "ما هدف الشّاعر من تصوير معاناة الشّعب الفلسطينيّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["إحياء الضّمير العربيّ وإيقاظ الهمم", "الحثّ على الصّمود والتّصدّي", "الدّعوة إلى الاستسلام وقبول الأمر الواقع",
                "تسلية القارئ وإمتاعه بالوصف", "مدح الأنظمة العربيّة على مواقفها"]},
   {"correct": [0, 1]}, "هدفه من تصويرها هو إحياء الضّمير العربيّ وإيقاظ الهمم من جهة، والحثّ على الصّمود والتّصدّي من جهة أخرى.", 0.5, "ar.comprehension.purpose")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل هدف الشّاعر:",
   {"text": "هدفه هو إحياء ____ العربيّ وإيقاظ ____ من جهة، والحثّ على الصّمود و____ من جهة أخرى.",
    "bank": ["الضّمير", "الهمم", "التّصدّي", "الاستسلام", "الفتنة"]},
   {"blanks": [["الضّمير"], ["الهمم"], ["التّصدّي"]]}, "«هدفه من تصويرها هو إحياء الضّمير العربيّ وإيقاظ الهمم من جهة، والحثّ على الصّمود والتّصدّي من جهة أخرى».", 0.5, "ar.comprehension.purpose", "b")
st("s03", "q1", "q1-e2", "mcq", "لماذا ركّز الشّاعر على غزّة؟",
   {"options": ["لأنّها قلب المعاناة ورمز المقاومة وعنوان التّحدّي", "لأنّها مسقط رأس الشّاعر", "لأنّها أبعد المدن عن الاحتلال", "لأنّها عاصمة الوطن العربيّ"]},
   {"correct": 0}, "ركّز على غزّة لأنّها قلب المعاناة ورمز المقاومة وعنوان التّحدّي.", 0.5, "ar.comprehension.explain")
st("s04", "q2", "q2-e1", "mcq", "إلامَ يُعزى استياء الشّاعر البارز في القصيدة؟",
   {"options": ["إلى سكوت الأنظمة العربيّة إزاء ما يحدث في فلسطين", "إلى غضب العالم وثورة شوارعه", "إلى بُعده عن وطنه", "إلى عجز أطفال غزّة عن القتال"]},
   {"correct": 0}, "استياء الشّاعر بارز في القصيدة، ونعزو ذلك إلى سكوت الأنظمة العربيّة إزاء ما يحدث في فلسطين.", 0.5, "ar.comprehension.link")
st("s05", "q2", "q2-e2", "fill_blank", "أكمل علاقة الاستياء بنفسيّة الشّاعر:",
   {"text": "تتمثّل في ____ و____ لما آلت إليه الأوضاع في فلسطين عامّة وغزّة خاصّة، وكذا ____ وخذلان الأمّة العربيّة.",
    "bank": ["التّأسّف", "التّحسّر", "استكانة", "الفرح", "يقظة"]},
   {"blanks": [["التّأسّف"], ["التّحسّر"], ["استكانة"]]}, "أمّا علاقته بنفسيّة الشّاعر فتتمثّل في التّأسّف والتّحسّر لما آلت إليه الأوضاع في فلسطين عامّة وغزّة خاصّة، وكذا استكانة وخذلان الأمّة العربيّة.", 0.5, "ar.comprehension.emotion")
st("s06", "q3", "q3-e1", "mcq", "لماذا نعت الشّاعر الوطن العربيّ بالجسد الضّخم؟",
   {"options": ["ليبيّن شساعة مساحته وتعدّد دوله وكثرة شعبه، ورغم ذلك لم يستطع مواجهة الكيان الصّهيونيّ ولم يستمت في الدّفاع عن فلسطين",
                "ليفتخر بقوّة الوطن العربيّ وانتصاراته على المحتلّ", "ليصف جمال طبيعة الوطن العربيّ", "ليبيّن أنّ الوطن العربيّ حيّ نشيط يدافع عن فلسطين"]},
   {"correct": 0}, "نعته بالجسد الضّخم ليبيّن شساعة مساحته وتعدّد دوله وكثرة شعبه، ورغم ذلك لم يستطع مواجهة الكيان الصّهيونيّ، ولم يستمت في الدّفاع عن فلسطين الّتي تعتبر جزءًا منه.", 0.5, "ar.comprehension.image")
st("s07", "q3", "q3-e2", "multi", "ما دلالة تكرار لفظة «نتفرّج»؟ (اختر كلّ ما يصحّ)",
   {"options": ["الاستكانة", "التّخاذل", "العجز", "الحماسة", "التّحدّي"]},
   {"correct": [0, 1, 2]}, "دلالة تكرار لفظة «نتفرّج»: الاستكانة والتّخاذل والعجز.", 0.5, "ar.comprehension.explain")
st("s08", "q4", "q4-e1", "mcq", "هل يبدو الشّاعر ملتزمًا؟",
   {"options": ["نعم، لأنّه مهتمّ بقضايا وطنه العربيّ الكبير وعلى رأسها قضيّة فلسطين الجريحة", "لا، لأنّه يكتفي بوصف مشاعره الذّاتيّة",
                "لا، لأنّه لم يذكر فلسطين صراحة", "نعم، لأنّه التزم بنظام الشّطرين والقافية الموحّدة"]},
   {"correct": 0}, "يبدو الشّاعر ملتزمًا لأنّه مهتمّ بقضايا وطنه العربيّ الكبير وعلى رأسها قضيّة فلسطين الجريحة.", 0.5, "ar.literature.features")
st("s09", "q4", "q4-e2", "mcq", "ما علاقة التزام الشّاعر بنزعته؟",
   {"options": ["التزامه نابع من نزعته القوميّة", "التزامه نابع من نزعته الذّاتيّة الفرديّة", "التزامه نابع من نزعته الصّوفيّة", "لا علاقة لالتزامه بنزعته"]},
   {"correct": 0}, "التزام الشّاعر نابع من نزعته القوميّة.", 0.5, "ar.literature.trend")
st("s10", "q4", "q4-e3", "fill_blank", "أكمل التّعليل:",
   {"text": "سخّر الشّاعر ____ لخدمة قضايا أمّته وأهمّها القضيّة الفلسطينيّة، معتبرًا إيّاها ____ لا يتجزّأ من اهتماماته وخدماته لوطنه العربيّ.",
    "bank": ["قلمه", "جزءًا", "ماله", "شأنًا غريبًا"]},
   {"blanks": [["قلمه"], ["جزءًا"]]}, "«فسخّر قلمه لخدمة قضايا أمّته وأهمّها القضيّة الفلسطينيّة معتبرًا إيّاها جزءًا لا يتجزّأ من اهتماماته وخدماته لوطنه العربيّ».", 0.5, "ar.literature.trend")
st("s11", "q5", "q5-e1", "mcq", "ما النّمط المساير لطبيعة موضوع القصيدة؟",
   {"options": ["الوصفيّ", "السّرديّ", "الحجاجيّ", "التّفسيريّ"]},
   {"correct": 0}, "النّمط الوصفيّ هو النّمط المساير لطبيعة موضوع القصيدة.", 0.5, "ar.text.type")
st("s12", "q5", "q5-e2", "mcq", "علّل اعتماد الشّاعر النّمط الوصفيّ.",
   {"options": ["لأنّه بصدد تصوير معاناة الشّعب الفلسطينيّ وفضح جرائم المحتلّ، ووقوف الأمّة العربيّة موقف المتفرّج تجاه هذه القضيّة المحوريّة",
                "لأنّه يروي أحداث حياته الشّخصيّة بالتّسلسل", "لأنّه يقدّم الحجج لإقناع خصمه", "لأنّه يشرح ظاهرة علميّة"]},
   {"correct": 0}, "لأنّ الشّاعر بصدد تصوير معاناة الشّعب الفلسطينيّ وفضح جرائم المحتلّ، ووقوف الأمّة العربيّة موقف المتفرّج تجاه هذه القضيّة المحوريّة…", 0.5, "ar.text.type")
st("s13", "q5", "q5-e3", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["النّعوت", "الإضافات", "التّشبيه", "الأفعال المضارعة الدّالّة على الاستمرار", "أدوات التّعليل والاستنتاج", "تسلسل الأحداث بالأفعال الماضية"]},
   {"correct": [0, 1, 2, 3]}, "من مؤشّراته: النّعوت، الإضافات، التّشبيه، الأفعال المضارعة الدّالّة على الاستمرار. يكتفي الممتحن بذكر مؤشّرين مع التّمثيل.", 0.5, "ar.text.type")
st("s14", "q5", "q5-e4", "matching", "طابق كلّ مؤشّر من مؤشّرات الوصف بأمثلته من القصيدة.",
   {"lefts": ["النّعوت", "الإضافات", "التّشبيه", "الأفعال المضارعة الدّالّة على الاستمرار"],
    "rights": ["(جُدُد، الثّكلى، العربيّ)", "(زنبقة الموت، حجارته)", "(أنتِ شرارته)", "(نتفرّج، يجري، تهتزّ)"]},
   {"pairs": [0, 1, 2, 3]}, "النّعوت: (جدد، الثّكلى، العربيّ)؛ الإضافات: (زنبقة الموت، حجارته…)؛ التّشبيه: (أنت شرارته)؛ الأفعال المضارعة الدّالّة على الاستمرار: (نتفرّج، يجري، تهتزّ).", 0.5, "ar.text.type")
SUM_SPEC = {"task": "تلخيص المقطعين الثّاني والثّالث", "text": "قصيدة سليمان العيسى «نتفرّج» (بكالوريا 2019، آداب وفلسفة، الموضوع الأوّل)",
            "model_example": "(ثارت مدن العالم، وخرجت شعوبها إلى الشّوارع تنديدًا بما يحدث في الأرض المحتلّة من قتل وتنكيل، بيد أنّ وطننا العربيّ بقي متفرّجًا، فاصمُدي يا قدس، وقرّري مصيرك بنفسك…) (نموذج للاستئناس)"}
SUM_EXPL = "تلخيص المقطعين الثّاني والثّالث: يراعي الممتحن الحجم – المضمون – سلامة اللّغة (نقطة لكلّ معيار)؛ والتّلخيص المقترح في الحلّ نموذج للاستئناس."
for i, (crit, ind) in enumerate([("الحجم", "مراعاة حجم التّلخيص"), ("المضمون", "ملاءمة المضمون لمعاني المقطعين"), ("سلامة اللّغة", "سلامة اللّغة")]):
    essay(f"s{15 + i}", "q6", f"q6-e{i + 1}", "تلخيص المقطعين الثّاني والثّالث من قصيدة «نتفرّج»", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s18", "q7", "q7-e1", "multi", "أيّ الألفاظ الآتية من حقل المعاناة؟ (اختر كلّ ما يصحّ)",
   {"options": ["قمعًا", "نسفًا", "ذبحًا", "قتلا", "نتفرّج", "مَيْتٌ"]},
   {"correct": [0, 1, 2, 3]}, "حقل المعاناة: (قمعًا، نسفًا، ذبحًا، قتلا)؛ أمّا (نتفرّج، ميت) فمن حقل الاستكانة والخذلان. يُكتفى بلفظتين لكلّ حقل.", 0.5, "ar.cohesion.effect")
st("s19", "q7", "q7-e2", "multi", "أيّ الألفاظ الآتية من حقل الاستكانة والخذلان؟ (اختر كلّ ما يصحّ)",
   {"options": ["نتفرّج", "مَيْتٌ", "لا تنتظري شيئًا", "ذبحًا", "يتّقد"]},
   {"correct": [0, 1, 2]}, "حقل الاستكانة والخذلان: (نتفرّج، ميت، لا تنتظري شيئًا)؛ و(ذبحًا) من حقل المعاناة. يُكتفى بلفظتين لكلّ حقل.", 0.5, "ar.cohesion.effect")
st("s20", "q8", "q8-e1", "mcq", "ما جمع «العالَم»؟",
   {"options": ["عوالم", "عُلماء", "معالم", "أعلام"]},
   {"correct": 0}, "«العالم» جمعها «عوالم».", 0.25, "ar.morphology")
st("s21", "q8", "q8-e2", "mcq", "ما وزن (قياس) «عوالم»؟",
   {"options": ["فواعل", "مفاعل", "أفاعل", "فعائل"]},
   {"correct": 0}, "قياسها «فواعل».", 0.25, "ar.morphology")
st("s22", "q8", "q8-e3", "mcq", "ما نوع الجمع «عوالم»؟",
   {"options": ["صيغة منتهى الجموع", "جمع قلّة", "جمع مؤنّث سالم", "اسم جمع"]},
   {"correct": 0}, "نوعها «صيغة منتهى الجموع».", 0.25, "ar.morphology")
st("s23", "q8", "q8-e4", "fill_blank", "هاتِ جمع «الجسد»:",
   {"text": "الجسد ← ____", "bank": ["أجساد", "مجاسد", "جسدان"]},
   {"blanks": [["أجساد"]]}, "«الجسد» جمعها «أجساد».", 0.25, "ar.morphology")
st("s24", "q8", "q8-e5", "mcq", "ما وزن (قياس) «أجساد»؟",
   {"options": ["أفعال", "أفعُل", "أفعِلة", "فِعال"]},
   {"correct": 0}, "قياسها «أفعال».", 0.25, "ar.morphology")
st("s25", "q8", "q8-e6", "mcq", "ما نوع الجمع «أجساد»؟",
   {"options": ["جمع قلّة", "صيغة منتهى الجموع", "جمع مذكّر سالم", "اسم جمع"]},
   {"correct": 0}, "نوعها «جمع قلّة».", 0.25, "ar.morphology")
st("s26", "q9", "q9-e1", "mcq", "ما إعراب «يجري» في قوله: «ما يجري في الأرض الثّكلى»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل", "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "فعل مضارع مجزوم وعلامة جزمه حذف حرف العلّة", "فعل مضارع منصوب وعلامة نصبه الفتحة المقدّرة على الياء"]},
   {"correct": 0}, "«يجري»: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل، والفاعل ضمير مستتر تقديره «هو».", 0.25, "ar.grammar.irab")
st("s27", "q9", "q9-e1", "mcq", "ما فاعل «يجري»؟",
   {"options": ["ضمير مستتر تقديره «هو»", "«الأرض»", "«ما»", "ضمير مستتر تقديره «هي»"]},
   {"correct": 0}, "والفاعل ضمير مستتر تقديره «هو».", 0.25, "ar.grammar.irab", "b")
st("s28", "q9", "q9-e2", "fill_blank", "أكمل إعراب «الثّكلى» في قوله: «في الأرض الثّكلى»:",
   {"text": "الثّكلى: ____ مجرورة وعلامة جرّها الكسرة ____ على الألف المقصورة منع من ظهورها ____.",
    "bank": ["صفة", "المقدّرة", "التّعذّر", "مضاف إليه", "الظّاهرة", "الثّقل"]},
   {"blanks": [["صفة"], ["المقدّرة"], ["التّعذّر"]]}, "«الثّكلى»: صفة مجرورة وعلامة جرّها الكسرة المقدّرة على الألف المقصورة منع من ظهورها التّعذّر.", 0.5, "ar.grammar.irab")
st("s29", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (نتفرّج) في قوله: «نتفرّجُ.. يحترق الجسد»؟",
   {"options": ["جملة ابتدائيّة لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع صفة"]},
   {"correct": 0}, "(نتفرّج): جملة ابتدائيّة لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s30", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (يتفرّج) في قوله: «الأمّة ميْتٌ يتفرّج»؟",
   {"options": ["جملة فعليّة في محلّ رفع صفة", "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب مفعول به", "جملة ابتدائيّة لا محلّ لها من الإعراب"]},
   {"correct": 0}, "(يتفرّج): جملة فعليّة في محلّ رفع صفة (لـ«ميْتٌ»).", 0.5, "ar.grammar.sentence_case")
st("s31", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في (تهتزّ عواصم)؟",
   {"options": ["مجاز عقليّ علاقته المكانيّة", "مجاز عقليّ علاقته الزّمانيّة", "تشبيه بليغ", "كناية عن موصوف"]},
   {"correct": 0}, "(تهتزّ عواصم): مجاز عقليّ، علاقته المكانيّة.", 0.25, "ar.rhetoric.metonymy")
st("s32", "q10", "q10-e2", "fill_blank", "أكمل شرح الصّورة في (تهتزّ عواصم):",
   {"text": "أُسند الفعل لغير ____، فالمقصود ____ العواصم الّذين احتجّوا وليس العواصم.", "bank": ["فاعله", "أهل", "مفعوله", "مباني"]},
   {"blanks": [["فاعله"], ["أهل"]]}, "أُسند الفعل لغير فاعله، فالمقصود أهل العواصم الّذين احتجّوا وليس العواصم.", 0.25, "ar.rhetoric.metonymy")
st("s33", "q10", "q10-e3", "mcq", "ما سرّ بلاغة الصّورة في (تهتزّ عواصم)؟",
   {"options": ["الإيجاز والمهارة في إشغال ذهن المتلقّي بالبحث والتّأمّل في شموليّة الاحتجاج", "إثبات الصّفة مصحوبة بالدّليل",
                "إيهام المتلقّي بالتّطابق بين المشبّه والمشبّه به", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "بلاغته: الإيجاز والمهارة في إشغال ذهن المتلقّي بالبحث والتّأمّل في شموليّة الاحتجاج.", 0.25, "ar.rhetoric.effect")
PRO_EXPL = "التّقطيع: «نَتَفَرْ | رَجُ يَحْ | تَرِقُلْ | جَسَدُو» = ///0 ///0 ///0 ///0 = فعلن فعلن فعلن فعلن. التّفعيلة: «فعلن» وهي متغيّر تفعيلة «فاعلن» الّتي هي أساس بحر المتدارك (المحدث)."
st("s34", "q11", "q11-e1", "mcq", "ما الكتابة العروضيّة والرّموز الصّحيحة لقوله: «نَتَفَرّجُ.. يحترِقُ الجسَدُ»؟",
   {"options": ["نَتَفَرْ رَجُ يَحْ تَرِقُلْ جَسَدُو: ///0 ///0 ///0 ///0", "نَتَفَرْ رَجُ يَحْ تَرِقُلْ جَسَدُو: /0//0 ///0 ///0 ///0",
                "نَتَفَرْ رَجُ يَحْ تَرِقُ الْ جَسَدُ: ///0 ///0 /0/0 ///", "نَتَفَرْ رَجُ يَحْ تَرِقُلْ جَسَدُو: ///0 /0/0 ///0 /0/0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s35", "q11", "q11-e2", "mcq", "ما التّفعيلة الّتي بُني عليها السّطر؟",
   {"options": ["«فعِلن» وهي متغيّر تفعيلة «فاعلن»", "«فاعلاتن» وهي تفعيلة الرّمل", "«مستفعلن» وهي تفعيلة الرّجز", "«متفاعلن» وهي تفعيلة الكامل"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s36", "q11", "q11-e3", "mcq", "ما بحر السّطر؟",
   {"options": ["المتدارك (المحدث)", "الرّمل", "الرّجز", "الكامل"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
# ── ثالثًا: التّقويم النّقديّ (نموذج للاستئناس ⇒ مؤجَّل) ──
CRIT_A_SPEC = {"task": "تعليل مع الاستشهاد", "question": QT1[11], "quotation": CRIT1,
               "model": "نموذج للاستئناس: كان للقضيّة الفلسطينيّة صدًى واسع في الشّعر العربيّ الحديث لكونه عاصر نكبة فلسطين؛ والمتصفّح لدواوين الشّعر العربيّ الحديث يكتشف أنّ القضيّة الفلسطينيّة حاضرة بقوّة… (يستشهد الممتحن بما أمكنه من أبيات من القصائد الّتي تناولت القضيّة الفلسطينيّة)."}
essay("s37", "q12", "q12-e1", "صدى القضيّة الفلسطينيّة في الشّعر العربيّ الحديث", "التّعليل والاستشهاد",
      "إثبات الصّدى وتعليله بالاستشهاد بأبيات من القصائد الّتي تناولت القضيّة الفلسطينيّة", 2, CRIT_A_SPEC,
      "نموذج للاستئناس: كان للقضيّة الفلسطينيّة صدًى واسع في الشّعر العربيّ الحديث لكونه عاصر نكبة فلسطين… ويستشهد الممتحن بما أمكنه من أبيات من القصائد الّتي تناولت القضيّة.", "ar.literature.context")
CRIT_B_SPEC = {"task": "تحدّث عن", "question": QT1[12], "quotation": CRIT1,
               "model": "نموذج للاستئناس: إدراكًا منهم بفداحة الخطب نظر الشّعراء إلى القضيّة الفلسطينيّة بعين الجدّ لتسطير معاناتها للأجيال بلغة ناريّة تلهب المشاعر وتشحذ الهمم وتحيي موات النّفوس وتنبّه من الغفلة، وتدعو إلى نصرة القضيّة بمقاومة المحتلّ للذّود عن العرض وتحرير الأرض ورفع معنويّات الأمّة العربيّة والتّحذير من أن يزدادوا ذلّة ومسكنة… ومن هؤلاء: نزار قبّاني، محمود درويش، أحمد سحنون، سليمان العيسى…"}
essay("s38", "q13", "q13-e1", "دور الشّعر العربيّ في معالجة قضايا الأمّة", "المضمون",
      "بيان دور الشّعر في معالجة قضايا الأمّة (تسطير المعاناة، شحذ الهمم، الدّعوة إلى النّصرة…) مع ذكر بعض الشّعراء", 2, CRIT_B_SPEC,
      "نموذج للاستئناس: نظر الشّعراء إلى القضيّة الفلسطينيّة بعين الجدّ لتسطير معاناتها للأجيال بلغة ناريّة تلهب المشاعر وتشحذ الهمم… ومن هؤلاء: نزار قبّاني، محمود درويش، أحمد سحنون، سليمان العيسى…", "ar.literature.context")

TITLE = "بكالوريا 2019 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (سليمان العيسى: نتفرّج)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2019، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. الموضوع الرّسميّ للمقارنة: gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين "
         "(الصّفحتان 1–2، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة؛ جدول التّقطيع بدقّة 300). "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. مؤجَّل (essay_builder): التّلخيص س6 (3×01) والتّقويم النّقديّ (أ 02، ب 02) لأنّ الحلّ «نموذج للاستئناس».")
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
