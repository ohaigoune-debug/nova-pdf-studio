"""Conversion: BAC 2015 (session عاديّة، جوان 2015) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (قصيدة «شعراء الأرض المحتلّة»).
Exam (most faithful source): gdrive 1lnB0EveGFULkEW1SYNHD-NWCTtVzBssq (بكالوريا العربية 2015 شعبة علوم تجريبية.docx);
same paper as PDF (owner's retyped copy): gdrive 1j0F06FDir_-ziJe7C_PODl4Feu_mm7oL (BAC 2015 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1CJcmkoCsZcH8xqOxja271Joc6XyqWemv (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «عناصر الإجابة»): gdrive 1LDaYPTWwcuGXX4Awo8a1FDDMcccl5aa9 (02_التصحيح.pdf, page 1).

Method (as build_ar_bac_2018_lit_p1.py / build_ar_bac_2019_lit_p1.py): PARAS / POEM_RAW below were generated from the .docx with
python-docx (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed; the free-verse
poem sits in a two-cell table whose cells are kept line by line) and every verbatim string of the JSON was re-checked
programmatically against the docx. The docx was compared page by page with the official ONEC paper (rendered at 150 dpi):
same poem, same line breaks, same questions. The correction is a scanned PDF, read from the rendered page (150 dpi, then
300 dpi crops). Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE
  (the docx header says «علوم تجريبية» only).
- The paper (docx and ONEC alike) introduces the poem with «قال الشاعر محمود درويش»; kept verbatim. The poem is usually
  attributed to Nizar Qabbani (it greets «محمود الدرويش» in stanza 3) — no step asks about the author; to be checked by the owner.
- Docx vs ONEC: «(12 نقاط)» (ONEC «نقطة»), «أوّلا-/ثانيا-» (ONEC «أ-/ب-»), «والاستكانة» (ONEC «والإستكانة») — docx kept.
  The poem is cut into its three stanzas («-1-», «-2-», «-3-») as three text documents (stanza 2 runs over both table cells).
- Rule for «n×m» lines (as in the 2017–2023 converters): interchangeable items (more listed than required) ⇒ one element;
  exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1 «3×0.5» = addressee / content / motive. Q2 «4×0.5» (unlabelled) = the two kinds of poets and the qualities of each
  ⇒ four elements. Q3 «4×0.5» = whom he prefers / whom he condemns / an example for each.
- Q4 «2×0.75» for «وضّحه مبديًا رأيك فيه»: the scheme only says «اعتراف… من خلال المقطع الثّاني» and «يذكر المترشّح بعض
  العبارات من المقطع الثّاني ويعلّق عليها» ⇒ 0.75 showing the confession in stanza 2 (interactive) + 0.75 comment/opinion
  (deferred essay_builder, rule 11) — split to be confirmed by the owner.
- Q5 «01 + 2×0.5» = the type (1) + two indicators among four listed (one element of 1). The scheme's example list for
  «النّعوت والإضافات» contains «القمر», which is not in the poem ⇒ not used.
- Q6 (تلخيص) «3×01» = المحافظة على أفكار النّصّ وتسلسلها / اعتماد الأسلوب الخاصّ وسلامة اللّغة / الإيجاز ⇒ three deferred elements.
- Part 2 Q1 «4×0.25»: four phrases among the listed ones («…») ⇒ one element of 1. Q2 «4×0.5» one element per item.
  Q3 «2×01» = one element per style (form + purpose). Q4 «01». Q5 «2×01» = one element per image (type, explanation and
  effect not split by the scheme ⇒ steps 0.25 / 0.5 / 0.25).
- Distractors avoid alternatives the scheme or usage could accept: no «حال» for (نمتطى فوق وسائدنا) (خبر ما زال), no
  «مجاز مرسل»/«كناية» for «يسير على قدميه القبر», no «استعارة» for «نركب أحصنة من خشب»; «الإشادة» is not a distractor of «التّنويه».
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2015-sci-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1lnB0EveGFULkEW1SYNHD-NWCTtVzBssq"
DOCX_TITLE = "بكالوريا العربية 2015 شعبة علوم تجريبية.docx"
PDF_ID = "1j0F06FDir_-ziJe7C_PODl4Feu_mm7oL"
OFFICIAL_ID = "1CJcmkoCsZcH8xqOxja271Joc6XyqWemv"
CORR_ID = "1LDaYPTWwcuGXX4Awo8a1FDDMcccl5aa9"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx بين قوسين) ──
PARAS = {
    2: 'النّـــــص: قال الشاعر محمود درويش:',
    4: 'أوّلا- البناء الفكري: (12 نقاط)',
    5: 'مَنْ يخاطِبُ الشَّاعِر في هذه القصيدة؟ ومَا مضمون هذا الخطاب؟ وما الدافع إليه؟',
    6: 'تحدّث الشّاعر عن صنفين من الشعراء. اذكرهما، وعدّد أوصافهما.',
    7: 'مَنْ فضَّل الشاعر؟ وَبِمَنْ ندّد؟ مَثل مِنَ النَّص.',
    8: 'اعتراف الشّاعر بتقصيره ظاهر في النّص. وَضحه مُبدياً رأيك فيه.',
    9: 'ما النمط الغَالب عَلى النّص؟ اذكر مؤشّرين له مع التمثيل.',
    10: 'لَخّص مَضمون النّص.',
    11: 'ثانيا- البناء اللّغوي: (08 نقاط)',
    12: 'في النّص حَقل دلالي للعجز والاستكانة. حدّد من العبارات في النّص ما يدل عليه.',
    13: 'أعرب لفظة "شَجَرَ" في السطر الثاني من المقطع الأول، ولفظة " لو" الواردة في السطر الثامن من المقطع الثالث إعراب مفردات.',
    14: 'وبيّن المحل الإعرابي للجملتين الواردتين بين قوسين في المقطع الثاني والثالث.',
    15: 'استخرج من المقطع الثاني أسلوبين إنشائيين مختلفين، مَحددًا صيغتيهما وغرضيهما البلاغيين.',
    16: 'تكرّرت في النّص عبارة "شعراء الأرض المحتلة". عَلامَ يدل ذلك؟',
    17: 'في العبارتين الآتيتين صورتان بيانيتان. اشرحهما مبينًا نوعيهما وسرّ بلاغتهما:',
    18: '"...كيف يسيرُ على قدميه القبر".',
    19: '" نركب أحصنةً من خَشَب".',
}
# الجدول 0 في docx: خليّتان (اليمنى ثمّ اليسرى)، سطرًا سطرًا.
POEM_RAW = [
    ['-1-', 'شعراء الأرض المحتلّة', 'يا شجر الورد النّابت من أحشاء', 'الجمر', 'يا مطرا يسقط..، رغم الظلم،', 'ورغم القهر', 'نتعلَّم منكم كيف يغنّي الغارق من', 'أعماق البئر', 'نتعلّم.. كيف يسير على قدميه القبر', 'نتعلَّم كيف يكون الشّعر..', 'فلدينا.. قد مات الشّعراء، ومات', 'الشّعر..', 'والشّاعر يعمل حوذيا لأمير القصر..', 'يمسح للحاكم معطفه، ويصبّ له', 'أقداح الخمر', '-2-', 'شعراء الأرض المحتلة..', 'يا ضوء الشّمس الهارب من ثقب', 'الأبواب', 'يا كلّ الأسماء المحفورة في ريش', 'الأهداب', 'ماذا نخبركم يا أحباب؟', 'عن أدب النّكسة، شعر النّكسة،'],
    ['يا أحباب', 'ما زلنا منذ حزيران.. نحن الكُتّاب', '(نمتطى فوق وسائدنا)', 'نلهو بالصّرف وبالإعراب', 'يطأ الإرهاب جماجمنا', 'ونقبّل أقدام الإرهاب', 'نركب أحصنة من خشب', 'ونقاتل أشباحا وسراب..', 'وننادي: يا ربّ الأرباب', 'نحن الضعفاء، وأنت المنتصر الغلاّب', 'نحن الفقراء، وأنت الرزّاق الوهّاب', 'نحن الجبناء، وأنت الغفّار التوّاب', '-3-', 'شعراء الأرض المحتلة.. سلاما', 'محمود الدرويش.. سلاما', 'توفيق الزياد.. سلاما', 'يا فدوى طوقان.. سلاما', 'يا من (تبرون على الأضلاع الأقلاما..)', 'نتعلم منكم، كيف نفجّر في الكلمات', 'الألغاما', 'لو أن الشعراء لدينا..', 'يقفون أمام قصائدكم..', 'لبدوا.. أقزاما.. أقزاما..'],
]
LINES = POEM_RAW[0] + POEM_RAW[1]
_i2, _i3 = LINES.index('-2-'), LINES.index('-3-')
STANZAS = [LINES[:_i2], LINES[_i2:_i3], LINES[_i3:]]
assert [s[0] for s in STANZAS] == ['-1-', '-2-', '-3-'] and [len(s) for s in STANZAS] == [15, 20, 11]
assert STANZAS[0][2].startswith('يا شجر') and STANZAS[2][8].startswith('لو أن')  # «السّطر الثّاني من المقطع الأوّل»، «السّطر الثّامن من المقطع الثّالث»

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
P1, P2 = PARAS[4], PARAS[11]
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[2]},
    {"id": "d-poem-1", "kind": "text", "caption": "النّصّ (1)", "text": "\n".join(STANZAS[0])},
    {"id": "d-poem-2", "kind": "text", "caption": "النّصّ (2)", "text": "\n".join(STANZAS[1])},
    {"id": "d-poem-3", "kind": "text", "caption": "النّصّ (3)", "text": "\n".join(STANZAS[2])},
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


q("q1", "1", P1, J(5), 1.5, [el("q1-e1", "المخاطَب في القصيدة", 0.5), el("q1-e2", "مضمون الخطاب", 0.5), el("q1-e3", "الدّافع إليه", 0.5)])
q("q2", "2", P1, J(6), 2, [el("q2-e1", "الصّنف الأوّل: الشّعراء الملتزمون", 0.5), el("q2-e2", "الصّنف الثّاني: شعراء القصر", 0.5),
                           el("q2-e3", "أوصاف الصّنف الأوّل", 0.5), el("q2-e4", "أوصاف الصّنف الثّاني", 0.5)])
q("q3", "3", P1, J(7), 2, [el("q3-e1", "مَن فضّل الشّاعر", 0.5), el("q3-e2", "بمَن ندّد", 0.5),
                           el("q3-e3", "التّمثيل لوصف الشّعراء الملتزمين", 0.5), el("q3-e4", "التّمثيل لنعت الشّعراء الخونة", 0.5)])
q("q4", "4", P1, J(8), 1.5, [el("q4-e1", "توضيح اعتراف الشّاعر بتقصيره (المقطع الثّاني)", 0.75), el("q4-e2", "التّعليق وإبداء الرّأي", 0.75)])
q("q5", "5", P1, J(9), 2, [el("q5-e1", "النّمط الغالب", 1), el("q5-e2", "مؤشّران مع التّمثيل (2×0.5)", 1)])
q("q6", "6", P1, J(10), 3, [el("q6-e1", "التّلخيص: المحافظة على أفكار النّصّ وتسلسلها", 1), el("q6-e2", "التّلخيص: الأسلوب الخاصّ وسلامة اللّغة", 1),
                            el("q6-e3", "التّلخيص: الإيجاز", 1)])
q("q7", "1", P2, J(12), 1, [el("q7-e1", "عبارات حقل العجز والاستكانة (4×0.25)", 1)])
q("q8", "2", P2, J(13, 14), 2, [el("q8-e1", "إعراب «شجر»", 0.5), el("q8-e2", "إعراب «لو»", 0.5),
                                el("q8-e3", "محلّ جملة (نمتطى فوق وسائدنا)", 0.5), el("q8-e4", "محلّ جملة (تبرون على الأضلاع الأقلاما)", 0.5)])
q("q9", "3", P2, J(15), 2, [el("q9-e1", "الأسلوب الأوّل: الصّيغة والغرض", 1), el("q9-e2", "الأسلوب الثّاني: الصّيغة والغرض", 1)])
q("q10", "4", P2, J(16), 1, [el("q10-e1", "دلالة تكرار «شعراء الأرض المحتلّة»", 1)])
q("q11", "5", P2, J(17, 18, 19), 2, [el("q11-e1", "«يسير على قدميه القبر»: النّوع والشّرح وسرّ البلاغة", 1),
                                     el("q11-e2", "«نركب أحصنة من خشب»: النّوع والشّرح وسرّ البلاغة", 1)])

# ── أ- البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "مَن يخاطب الشّاعر في هذه القصيدة؟",
   {"options": ["«شعراء الأرض المحتلّة»", "الحكّام العرب", "المستعمر الصّهيونيّ", "الشّعب الفلسطينيّ"]},
   {"correct": 0}, "المخاطَب هو: «شعراء الأرض المحتلّة».", 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "ما مضمون خطاب الشّاعر لشعراء الأرض المحتلّة؟",
   {"options": ["التّنويه بشعراء المقاومة الفلسطينيّة، والتّنديد بالشّعراء المنحرفين عن رسالة الشّعر", "رثاء شعراء المقاومة والتّحسّر على موتهم",
                "مدح الحكّام العرب على نصرتهم لفلسطين", "وصف جمال الطّبيعة في الأرض المحتلّة"]},
   {"correct": 0}, "مضمون هذا الخطاب هو: التّنويه بشعراء المقاومة الفلسطينيّة، والتّنديد بالشّعراء المنحرفين عن رسالة الشّعر.", 0.25, "ar.comprehension.idea")
st("s03", "q1", "q1-e2", "fill_blank", "أكمل مضمون الخطاب:",
   {"text": "____ بشعراء المقاومة الفلسطينيّة، و____ بالشّعراء المنحرفين عن رسالة الشّعر.", "bank": ["التّنويه", "التّنديد", "الرّثاء", "التّبرير"]},
   {"blanks": [["التّنويه"], ["التّنديد"]]}, "«مضمون هذا الخطاب هو: التّنويه بشعراء المقاومة الفلسطينيّة، والتّنديد بالشّعراء المنحرفين عن رسالة الشّعر».", 0.25, "ar.comprehension.idea", "b")
st("s04", "q1", "q1-e3", "mcq", "ما الدّافع إلى هذا الخطاب؟",
   {"options": ["حال الأمّة العربيّة المتخاذلة عن نصرة فلسطين، خاصّة الشّعراء", "انتصار العرب في حرب حزيران", "رغبة الشّاعر في التّقرّب من الحكّام", "حنين الشّاعر إلى طفولته"]},
   {"correct": 0}, "والدّافع إليه: حال الأمّة العربيّة المتخاذلة عن نصرة فلسطين، خاصّة الشّعراء.", 0.5, "ar.comprehension.purpose")
Q2_EXPL = ("صنّف الشّاعر الشّعراء العرب صنفين هما: الشّعراء الملتزمون، وشعراء القصر. أوصاف الصّنف الأوّل: (المقاومة – التّضحية – الصّبر – التّفاؤل)؛ "
           "أوصاف الصّنف الثّاني: (التّملّق – الذّلّ – الخضوع – الخيانة – الجبن…).")
st("s05", "q2", "q2-e1", "mcq", "تحدّث الشّاعر عن صنفين من الشّعراء. ما الصّنف الّذي يمثّله «شعراء الأرض المحتلّة»؟",
   {"options": ["الشّعراء الملتزمون", "شعراء القصر", "الشّعراء المتكسّبون بالمديح", "شعراء الغزل"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.details")
st("s06", "q2", "q2-e2", "mcq", "وما الصّنف الثّاني الّذي يمثّله الشّاعر الّذي «يعمل حوذيا لأمير القصر»؟",
   {"options": ["شعراء القصر", "الشّعراء الملتزمون", "شعراء المقاومة", "شعراء المهجر"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.details")
st("s07", "q2", "q2-e3", "multi", "اختر أوصاف الصّنف الأوّل (الشّعراء الملتزمين). (اختر كلّ ما يصحّ)",
   {"options": ["المقاومة", "التّضحية", "الصّبر", "التّفاؤل", "التّملّق", "الخضوع"]},
   {"correct": [0, 1, 2, 3]}, Q2_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q2", "q2-e4", "mcq", "أيّ مجموعة من الأوصاف تنطبق على الصّنف الثّاني (شعراء القصر)؟",
   {"options": ["التّملّق – الذّلّ – الخضوع – الخيانة – الجبن", "المقاومة – التّضحية – الصّبر – التّفاؤل", "الحكمة – الزّهد – الورع", "الفخر – الحماسة – الإقدام"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.details")
Q3_EXPL = ("فضّل الشّاعر شعراء الأرض المحتلّة الملتزمين، وندّد بالشّعراء الخونة المتملّقين. التّمثيل من النّصّ: وصف الشّعراء الملتزمين بـ(شجر الورد – المطر – ضوء الشّمس…)، "
           "ونعت الشّعراء الخونة بـ(يعمل حوذيا – يمسح للحاكم معطفه – يصبّ له أقداح الخمر…).")
st("s09", "q3", "q3-e1", "mcq", "مَن فضّل الشّاعر؟",
   {"options": ["شعراء الأرض المحتلّة الملتزمين", "شعراء القصر المتملّقين", "الحكّام العرب", "الكتّاب العرب منذ حزيران"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s10", "q3", "q3-e2", "mcq", "وبمَن ندّد؟",
   {"options": ["بالشّعراء الخونة المتملّقين", "بشعراء المقاومة الفلسطينيّة", "بمحمود الدرويش وفدوى طوقان", "بالشّعراء الملتزمين"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s11", "q3", "q3-e3", "multi", "اختر العبارات الّتي وصف بها الشّاعر الشّعراء الملتزمين. (اختر كلّ ما يصحّ)",
   {"options": ["«يا شجر الورد النّابت من أحشاء الجمر»", "«يا مطرا يسقط..، رغم الظلم»", "«يا ضوء الشّمس الهارب من ثقب الأبواب»",
                "«والشّاعر يعمل حوذيا لأمير القصر»", "«يمسح للحاكم معطفه»"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
st("s12", "q3", "q3-e4", "fill_blank", "أكمل ما نعت به الشّاعر الشّعراء الخونة:",
   {"text": "والشّاعر يعمل ____ لأمير القصر.. يمسح للحاكم ____، ويصبّ له أقداح ____", "bank": ["حوذيا", "معطفه", "الخمر", "حارسا", "سيفه", "اللّبن"]},
   {"blanks": [["حوذيا"], ["معطفه"], ["الخمر"]]}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
Q4_EXPL = ("اعتراف الشّاعر بتقصيره ظاهر في النّصّ من خلال المقطع الثّاني (يذكر المترشّح بعض العبارات من المقطع الثّاني ويعلّق عليها)، "
           "ومنها: «نلهو بالصّرف وبالإعراب»، «نركب أحصنة من خشب»، «ونقاتل أشباحا وسراب..».")
st("s13", "q4", "q4-e1", "mcq", "في أيّ مقطع من القصيدة يظهر اعتراف الشّاعر بتقصيره؟",
   {"options": ["المقطع الثّاني", "المقطع الأوّل", "المقطع الثّالث"]},
   {"correct": 0}, Q4_EXPL, 0.25, "ar.comprehension.details")
st("s14", "q4", "q4-e1", "multi", "اختر من العبارات ما يدلّ على اعتراف الشّاعر بتقصيره. (اختر كلّ ما يصحّ)",
   {"options": ["«نلهو بالصّرف وبالإعراب»", "«نركب أحصنة من خشب»", "«ونقاتل أشباحا وسراب..»", "«يا ضوء الشّمس الهارب من ثقب الأبواب»", "«توفيق الزياد.. سلاما»"]},
   {"correct": [0, 1, 2]}, Q4_EXPL + " أمّا «يا ضوء الشّمس…» و«توفيق الزياد.. سلاما» فتحيّة وثناء على شعراء الأرض المحتلّة.", 0.5, "ar.comprehension.evidence", "b")
essay("s15", "q4", "q4-e2", "اعتراف الشّاعر بتقصيره", "التّعليق وإبداء الرّأي",
      "يعلّق المترشّح على عبارات من المقطع الثّاني ويبدي رأيه معلَّلًا في اعتراف الشّاعر بتقصيره", 0.75,
      {"task": "إبداء الرّأي", "question": PARAS[8], "scheme": "2×0.75؛ ملاحظة التّصحيح: يذكر المترشّح بعض العبارات من المقطع الثّاني ويعلّق عليها"},
      Q4_EXPL + " والرّأي من إنشاء المترشّح (رأي معلَّل).", "ar.comprehension.opinion")
st("s16", "q5", "q5-e1", "mcq", "ما النّمط الغالب على قصيدة «شعراء الأرض المحتلّة»؟",
   {"options": ["الوصفيّ", "السّرديّ", "التّفسيريّ", "الإيعازيّ"]},
   {"correct": 0}, "يغلب على النّصّ النّمط الوصفيّ.", 1, "ar.text.type")
Q5_EXPL = ("المؤشّرات: النّعوت والإضافات (المحتلّة، النّابت، الشّمس…)، اسميّة الجمل (نحن الضّعفاء، نحن الجبناء)، الأفعال المضارعة (يسقط، يغنّي، نتعلّم…)، "
           "الصّور البيانيّة (مات الشّعر، يمسح للحاكم معطفه…). يكفي ذكر مؤشّرين مع التّمثيل.")
st("s17", "q5", "q5-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["النّعوت والإضافات", "اسميّة الجمل", "الأفعال المضارعة", "الصّور البيانيّة", "تسلسل الأحداث في الزّمن", "أدوات التّعليل والاستنتاج"]},
   {"correct": [0, 1, 2, 3]}, Q5_EXPL + " أمّا تسلسل الأحداث فمؤشّر سرديّ، وأدوات التّعليل والاستنتاج مؤشّر تفسيريّ/حجاجيّ.", 0.5, "ar.text.type")
st("s18", "q5", "q5-e2", "matching", "طابق كلّ مؤشّر من مؤشّرات الوصف بأمثلته من النّصّ.",
   {"lefts": ["النّعوت والإضافات", "اسميّة الجمل", "الأفعال المضارعة", "الصّور البيانيّة"],
    "rights": ["(المحتلّة، النّابت، الشّمس)", "(نحن الضّعفاء، نحن الجبناء)", "(يسقط، يغنّي، نتعلّم)", "(مات الشّعر، يمسح للحاكم معطفه)", "(لأنّ، إذن، بما أنّ)"]},
   {"pairs": [0, 1, 2, 3]}, Q5_EXPL, 0.5, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "قصيدة «شعراء الأرض المحتلّة» (بكالوريا 2015، الشّعب العلميّة، الموضوع الأوّل)",
            "scheme": "تلخيص مضمون النّصّ: يراعي فيه المترشّح المحافظة على أفكار النّصّ وتسلسلها، اعتماد الأسلوب الخاصّ وسلامة اللّغة، الإيجاز (3×01)"}
SUM_EXPL = "يراعي المترشّح في تلخيص مضمون النّصّ: المحافظة على أفكار النّصّ وتسلسلها، اعتماد الأسلوب الخاصّ وسلامة اللّغة، الإيجاز (نقطة لكلّ معيار)."
for sid, eid, crit, ind in [("s19", "q6-e1", "المحافظة على الأفكار", "المحافظة على أفكار النّصّ وتسلسلها"),
                            ("s20", "q6-e2", "الأسلوب وسلامة اللّغة", "اعتماد الأسلوب الخاصّ وسلامة اللّغة"),
                            ("s21", "q6-e3", "الإيجاز", "الإيجاز")]:
    essay(sid, "q6", eid, "تلخيص مضمون قصيدة «شعراء الأرض المحتلّة»", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ب- البناء اللّغويّ ──
FIELD_EXPL = "العبارات الدّالّة على حقل العجز والاستكانة: (ما زلنا منذ حزيران، نمتطى فوق وسائدنا، نلهو بالصّرف وبالإعراب، نركب أحصنة من خشب…)."
st("s22", "q7", "q7-e1", "multi", "أيّ العبارات الآتية تدلّ على حقل العجز والاستكانة؟ (اختر كلّ ما يصحّ)",
   {"options": ["«ما زلنا منذ حزيران»", "«نمتطى فوق وسائدنا»", "«نلهو بالصّرف وبالإعراب»", "«نركب أحصنة من خشب»",
                "«يا شجر الورد النّابت من أحشاء الجمر»", "«كيف نفجّر في الكلمات الألغاما»"]},
   {"correct": [0, 1, 2, 3]}, FIELD_EXPL + " أمّا العبارتان الأخريان فوصف لشعراء الأرض المحتلّة.", 0.5, "ar.cohesion.effect")
st("s23", "q7", "q7-e1", "fill_blank", "أكمل من عبارات حقل العجز والاستكانة:",
   {"text": "نلهو بالصّرف و____ — نركب أحصنة من ____", "bank": ["بالإعراب", "خشب", "بالسّيوف", "حديد"]},
   {"blanks": [["بالإعراب"], ["خشب"]]}, FIELD_EXPL, 0.5, "ar.cohesion.effect", "b")
st("s24", "q8", "q8-e1", "mcq", "ما إعراب «شَجَرَ» في قوله: «يا شجر الورد النّابت من أحشاء الجمر»؟",
   {"options": ["منادى منصوب وعلامة نصبه الفتحة الظّاهرة على آخره، وهو مضاف", "منادى مبنيّ على الضّمّ في محلّ نصب",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "منادى مبنيّ على الفتح في محلّ نصب"]},
   {"correct": 0}, "«شجر»: منادى منصوب وعلامة نصبه الفتحة الظّاهرة على آخره، وهو مضاف.", 0.5, "ar.grammar.irab")
st("s25", "q8", "q8-e2", "mcq", "ما إعراب «لو» في قوله: «لو أن الشعراء لدينا.. يقفون أمام قصائدكم.. لبدوا.. أقزاما»؟",
   {"options": ["حرف امتناع لامتناع، حرف شرط غير جازم مبنيّ على السّكون لا محلّ له من الإعراب", "حرف شرط جازم مبنيّ على السّكون لا محلّ له من الإعراب",
                "اسم شرط غير جازم مبنيّ على السّكون في محلّ نصب ظرف زمان", "حرف مصدريّ مبنيّ على السّكون لا محلّ له من الإعراب"]},
   {"correct": 0}, "«لو»: حرف امتناع لامتناع، حرف شرط غير جازم مبنيّ على السّكون لا محلّ له من الإعراب.", 0.5, "ar.grammar.conditional")
st("s26", "q8", "q8-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (نمتطى فوق وسائدنا) في المقطع الثّاني؟",
   {"options": ["جملة فعليّة في محلّ نصب خبر «ما زال»", "جملة فعليّة في محلّ نصب مفعول به", "جملة فعليّة في محلّ جرّ مضاف إليه",
                "جملة فعليّة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "(نمتطى فوق وسائدنا): جملة فعليّة في محلّ نصب خبر «ما زال» («ما زلنا منذ حزيران..»).", 0.5, "ar.grammar.sentence_case")
st("s27", "q8", "q8-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (تبرون على الأضلاع الأقلاما..) في المقطع الثّالث؟",
   {"options": ["جملة فعليّة صلة موصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "(تبرون على الأضلاع الأقلاما): جملة فعليّة صلة موصول («مَن») لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
STY_EXPL = ("التّمثيل لأسلوبين إنشائيّين مختلفين: «شعراء الأرض المحتلّة…»: أسلوب إنشائيّ طلبيّ بصيغة النّداء وغرضه التّنويه والإشادة؛ "
            "«ماذا نخبركم يا أحباب؟»: أسلوب إنشائيّ طلبيّ بصيغة الاستفهام وغرضه التّحسّر.")
st("s28", "q9", "q9-e1", "mcq", "ما صيغة الأسلوب الإنشائيّ في «شعراء الأرض المحتلّة..» في مطلع المقطع الثّاني؟",
   {"options": ["أسلوب إنشائيّ طلبيّ بصيغة النّداء", "أسلوب إنشائيّ طلبيّ بصيغة الأمر", "أسلوب إنشائيّ غير طلبيّ بصيغة التّعجّب", "أسلوب خبريّ"]},
   {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.insha")
st("s29", "q9", "q9-e1", "mcq", "ما الغرض البلاغيّ من النّداء في «شعراء الأرض المحتلّة..»؟",
   {"options": ["التّنويه والإشادة", "التّهكّم والسّخرية", "التّحذير", "الاستغاثة"]},
   {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.insha", "b")
st("s30", "q9", "q9-e2", "fill_blank", "أكمل تحديد صيغة الأسلوب في قوله: «ماذا نخبركم يا أحباب؟»",
   {"text": "«ماذا نخبركم…؟»: أسلوب إنشائيّ ____ بصيغة ____.", "bank": ["طلبيّ", "الاستفهام", "غير طلبيّ", "التّعجّب"]},
   {"blanks": [["طلبيّ"], ["الاستفهام"]]}, STY_EXPL, 0.5, "ar.rhetoric.insha")
st("s31", "q9", "q9-e2", "mcq", "ما الغرض البلاغيّ من الاستفهام في «ماذا نخبركم يا أحباب؟»؟",
   {"options": ["التّحسّر", "الفخر والاعتزاز", "التّهديد والوعيد", "المدح والثّناء"]},
   {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.insha", "b")
REP_EXPL = "كرّر الشّاعر عبارة (شعراء الأرض المحتلّة) في النّصّ في مستهلّ كلّ مقطع للدّلالة على وحدة النّصّ وانسجامه؛ بحيث وظّفها في ربط الوحدات والأفكار."
st("s32", "q10", "q10-e1", "mcq", "علامَ يدلّ تكرار عبارة «شعراء الأرض المحتلّة» في مستهلّ كلّ مقطع؟",
   {"options": ["على وحدة النّصّ وانسجامه؛ إذ وظّفها الشّاعر في ربط الوحدات والأفكار", "على تفكّك النّصّ وتعدّد موضوعاته",
                "على عجز الشّاعر عن إيجاد ألفاظ جديدة", "على سخرية الشّاعر من شعراء الأرض المحتلّة"]},
   {"correct": 0}, REP_EXPL, 0.5, "ar.cohesion.effect")
st("s33", "q10", "q10-e1", "fill_blank", "أكمل:",
   {"text": "كرّر الشّاعر عبارة (شعراء الأرض المحتلّة) في مستهلّ كلّ ____ للدّلالة على وحدة النّصّ و____؛ بحيث وظّفها في ربط الوحدات و____.",
    "bank": ["مقطع", "انسجامه", "الأفكار", "سطر", "تفكّكه", "القوافي"]},
   {"blanks": [["مقطع"], ["انسجامه"], ["الأفكار"]]}, REP_EXPL, 0.5, "ar.cohesion.effect", "b")
IMG1 = "«يسير على قدميه القبر»: نوعها استعارة مكنيّة، حيث شبّه القبر بالإنسان، حذف المشبّه به وأبقى على صفة من صفاته وهي السّير. بلاغتها: زادته وضوحًا، وجسّدته في قالب محسوس."
st("s34", "q11", "q11-e1", "mcq", "ما نوع الصّورة البيانيّة في «كيف يسير على قدميه القبر»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "تشبيه تمثيليّ"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.metaphor")
st("s35", "q11", "q11-e1", "fill_blank", "اشرح الصّورة في «كيف يسير على قدميه القبر»:",
   {"text": "شبّه القبر بـ____، حذف المشبّه به، وأبقى على صفة من صفاته وهي ____.", "bank": ["الإنسان", "السّير", "البيت", "الصّمت"]},
   {"blanks": [["الإنسان"], ["السّير"]]}, IMG1, 0.5, "ar.rhetoric.metaphor", "b")
st("s36", "q11", "q11-e1", "mcq", "ما سرّ بلاغة الصّورة في «كيف يسير على قدميه القبر»؟",
   {"options": ["زادت المعنى وضوحًا، وجسّدته في قالب محسوس", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين المعنيين"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.effect", "c")
IMG2 = "«نركب أحصنة من خشب»: نوعها كناية عن صفة العجز والاستكانة، فهو تعبير حقيقيّ يُراد منه لازم المعنى. بلاغتها: إيضاح المعنى وتقريبه."
st("s37", "q11", "q11-e2", "mcq", "ما نوع الصّورة البيانيّة في «نركب أحصنةً من خشب»؟",
   {"options": ["كناية عن صفة العجز والاستكانة", "كناية عن موصوف", "كناية عن نسبة", "تشبيه بليغ"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.metonymy")
st("s38", "q11", "q11-e2", "fill_blank", "اشرح الكناية في «نركب أحصنةً من خشب»:",
   {"text": "هي تعبير ____ يُراد منه ____ المعنى.", "bank": ["حقيقيّ", "لازم", "مجازيّ", "ظاهر"]},
   {"blanks": [["حقيقيّ"], ["لازم"]]}, IMG2, 0.5, "ar.rhetoric.metonymy", "b")
st("s39", "q11", "q11-e2", "mcq", "ما سرّ بلاغة الكناية في «نركب أحصنةً من خشب»؟",
   {"options": ["إيضاح المعنى وتقريبه", "تشخيص الجماد وبثّ الحياة فيه", "المبالغة بادّعاء التّطابق بين المشبّه والمشبّه به", "تحسين العبارة بالجرس الموسيقيّ"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.effect", "c")

TITLE = "بكالوريا 2015 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (قصيدة «شعراء الأرض المحتلّة»)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2015، شعب علوم تجريبيّة ورياضيات وتقني رياضي وتسيير واقتصاد) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "العلامات من عناصر الإجابة وسلّم التّنقيط الرّسميّين (ص1، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
         "الورقة تنسب القصيدة إلى «محمود درويش» (كما في الموضوع الرّسميّ) وأُبقي ذلك حرفيًّا، ولا خطوة تسأل عن الشّاعر؛ للمراجعة. "
         "قُسّمت القصيدة إلى مقاطعها الثّلاثة. س4 «2×0.75»: توضيح الاعتراف من المقطع الثّاني (تفاعليّ) + التّعليق وإبداء الرّأي (مؤجَّل)؛ "
         "التّلخيص س6 مؤجّل (essay_builder) بمعاييره الثّلاثة (3×01). كلمة «القمر» في أمثلة النّعوت في التّصحيح ليست في النّصّ فلم تُستعمل.")
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
