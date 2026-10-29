"""Conversion: BAC 2008 (session عاديّة، جوان 2008) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (محمود سامي البارودي، «تأوّب طيف»).
Exam (most faithful source): gdrive 1w07KJcwuwdHy57-7LM4YFjvJlKHTl-3L (اختبار دورة 2008 لغات.docx);
same paper as PDF (owner's copy): gdrive 1Ls03xKi3n6jNyiluEq1hePOk-RsEyZ2i (BAC 2008 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1cTjX_N42_rBummb48gwwCHSddqGOU3uF (01_الموضوع.pdf, pages 1–2, image-only scan at 96 ppi);
official mark scheme (ONEC «الإجابة وسلّم التّنقيط»): gdrive 19y6tLEx8dK5wcqeKRAu6JB-EP2IGGgRy (02_التصحيح.pdf, page 1).

Method (as build_ar_bac_2008_sci_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx and spliced
into this file by script (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed;
the poem table is read as rows [عجز, (empty), «n- صدر»], the verse number is split off the صدر). Every verbatim string of the
JSON is built from PARAS / POEM_RAW (fixes applied with _fix, each asserted to occur once) and was re-checked programmatically
against the docx. The docx was compared verse by verse and question by question with the ONEC paper (page images enlarged
×2–×6). The correction PDF has no text layer; the scheme was read from its page image (enlarged ×2). Every mark comes from
the official scheme; correct options and explanations condense its wording.

Docx defects fixed from the ONEC paper:
- verse 4 صدر «وجدا ومـالـه» ⇒ «وجدا ومـا لـه» (ONEC «ومـا لـه»: «وما له سوى نزوات الشّوق…», two words);
- verse 4 عجز «سوی» typed with the Farsi yeh U+06CC ⇒ «سوى».
Other differences are diacritics / spelling / labels only (docx kept): «علىّ» (ONEC «عليّ»), the docx numbers the verses 1–11
(the ONEC paper does not; the questions say «البيت العاشر», «البيت الأخير»), part labels «أوّلا-/ثانيا-/ثالثا-» (ONEC
«ـ البناء الفكريّ… ـ التّقويم النّقديّ للنّصّ»). Underlines (docx and ONEC): «أحبّـتي» (ب6), «أصابني» (ب9); bracketed
sentences (الليل ضارب) ب2, (التفت عليه الضمائر) ب6, (فالصّبـر فيه المعـاذر) ب11.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «لغات أجنبيّة» ⇒ LANG.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item; an unsplit mark ⇒ one element.
- Q1 «1,5», Q2 «1,5», Q3 «2»: one element each (two steps for the two demands). Q4 «2×0,5» = the meaning / the case.
  Q5 (نثر أبيات القصيدة) «04» with two criteria (دلالة المضمون، سلامة اللّغة) and no split ⇒ one deferred element of 4 with
  one essay_builder step per criterion (2 + 2, our split, as build_ar_bac_2018_lit_p1.py).
- Part 2 Q1 «4×0,25» = exactly the four words ⇒ four elements. Q2 marks as printed beside the lines: «2×0,5» أحبّتي (أحبّة /
  الياء), «2×0,25» beside «أصاب: فعل ماضٍ… والفاعل ضمير مستتر» (two elements), «0,5» beside «النّون: نون الوقاية», «0,25»
  beside «الياء: … مفعول به», then «3×0,25» for the three bracketed sentences ⇒ nine elements (sum 3; the 0.5 for نون الوقاية
  vs 0.25 for the object ياء is read from the marks' positions — owner to confirm). Q3 «2×0,5» = the explanation of the
  conditional link / its expressive value. Q4 «2×0,5» = the image «كالحِلم» / its type: the scheme does not name the type, it
  says «الشّاعر ينفي أن يكون الحلم عند العاجز يشبه الحلم عند القادر» ⇒ the correct option is «تشبيه» with that wording —
  owner to confirm.
- Part 3 «2×2» = «وظّف الشّاعر الحكمة في الأبيات الثّلاثة الأخيرة وهو متأثّر في ذلك بشعراء الحكمة مثل أبي العلاء والمتنبّي…»
  (interactive: the verses + the poets) / «يبرز المترشّح رأيه في التّأثّر» (deferred essay_builder, rule 11).
- Distractors avoid what the scheme or usage could accept: no «الكسرة المقدّرة» variant for «أحبّة» (the scheme says «علامة
  جرّه الكسرة»), no «معطوفة/استئنافيّة» for (الليل ضارب), no verse 8 («فكلّ امرئ يومًا إلى الله صائر») among the non-wisdom
  verses, no wisdom poet (زهير، أبو تمّام…) among the poet distractors, no Qur'anic verse about death or return to God among
  the source distractors.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2008-lang-p1"
PAPER = 1
STREAMS = ["LANG"]
DOCX_ID = "1w07KJcwuwdHy57-7LM4YFjvJlKHTl-3L"
DOCX_TITLE = "اختبار دورة 2008 لغات.docx"
PDF_ID = "1Ls03xKi3n6jNyiluEq1hePOk-RsEyZ2i"
OFFICIAL_ID = "1cTjX_N42_rBummb48gwwCHSddqGOU3uF"
CORR_ID = "19y6tLEx8dK5wcqeKRAu6JB-EP2IGGgRy"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    0: "على المترشح أن يختار أحد الموضوعين الآتيين:",
    1: "الموضوع الأول",
    2: "النّـــــص:",
    3: "قال البارودي:",
    5: "الأسئلة:",
    6: "أوّلا- البناء الفكري: (10 نقاط)",
    7: "ما الذي زار الشاعر؟ وعمَّ يدل ذلك؟",
    8: "الشاعر في محنته غير راض. ما العبارة الدالة على ذلك؟",
    9: "تشيع في النص الروح الدينية، أين تجدها؟ وما مصدرها؟",
    10: "بين معنى الحلم، والحالة التي يكون فيها مستحسنا أكثر.",
    11: "انثر أبيات القصيدة.",
    13: "ثانيا- البناء اللّغوي: (06 نقاط)",
    14: "بم توحي الألفاظ الآتية؟: «طيف ـ زاجر ــ الدياجر ــ الخطب».",
    15: "أعرب ما تحته خط، وبين المحل الإعرابي للجمل المحصورة بين قوسين.",
    16: "في البيت الأخير تلازم شرطي وضّحه وبيّن قيمته التعبيرية.",
    17: "في البيت العاشر صورة بيانية. حددها وبين نوعها.",
    19: "ثالثا- التّقويم النقدي: (04 نقاط)",
    20: "يميل البارودي إلى توظيف الحكمة في شعره. دُلَّ على مواطن ذلك في النص، ذاكرا الشعراء الذين تأثر بهم، مبديا رأيك في هذا التأثر.",
}
# جدول القصيدة في docx: صفوف [العجز، (فارغة)، «رقم- الصّدر»] (تخطيط RTL)؛ إذا دُمجت خليّة الصّدر على العمودين الأيمنين قُرئت مرّة واحدة.
# هنا: [«رقم- الصّدر»، العجز]
POEM_RAW = [
    ["1-تأوّب طيف من \" سميـرة \" زائـر", "وما الطّيف إلاّ ما تُريـه الخواطـر"],
    ["2-طوى سدفة الظلماء و(الليل ضارب)", "بأرواقه والنجـم بالأفـق حـائـر"],
    ["3-فيـا لك من طيـف ألـم ودونه", "محيـط من البحر الجنوبيّ زاخـر"],
    ["4-تخطّى إليّ الأرض وجدا ومـالـه", "سوی نزوات الشوق حادٍ وزاجر"],
    ["5-ألـم ولم يلبـث وسـار ولَيْـته", "أقـام ولو طالت علىّ الدياجـر"],
    ["6-فيـا بعـد ما بيني وبين أحبّـتي", "ويا قرب ما (التفت عليه الضمائر)"],
    ["7-ولولا أمـاني النفس وهي حياتها", "لما طـار لي فوق البسيطة طائـر"],
    ["8-فإن تكـن الأيـام فرّقن بينــنا", "فكلُّ امرئ يوما إلى الله صـائـر"],
    ["9-صبرت على كره لمـا قد أصابني", "ومن لم يجد مندوحة فهو صابـر"],
    ["10-وما الحِلم عند الخطب والمرء عاجز", "بمستحسن كالحِلم والمرء قـادر"],
    ["11-ولكن إذا قلَّ النَّصيـر وأعوزت", "دواعي المنى (فالصّبـر فيه المعـاذر)"],
]


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


POEM = []
for _sadr, _ajz in POEM_RAW:
    _m = re.match(r"^(\d+)-\s*(.+)$", _sadr)
    assert _m and "\n" not in _sadr and "\n" not in _ajz, _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 12)]
# تصويبات من الموضوع الرّسميّ (انظر التّوثيق أعلاه)
POEM[3][1] = _fix(POEM[3][1], "ومـالـه", "ومـا لـه")
POEM[3][2] = _fix(POEM[3][2], "ی", "ى")
assert POEM[5][1].endswith("أحبّـتي") and POEM[8][1].endswith("أصابني") and "(الليل ضارب)" in POEM[1][1] and "(فالصّبـر" in POEM[10][2]

P1, P2, P3 = PARAS[6], PARAS[13], PARAS[19]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and PARAS[3] == "قال البارودي:"
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[3]},
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
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


q("q1", "1", P1, PARAS[7], 1.5, [el("q1-e1", "زائر الشّاعر ودلالة الزّيارة", 1.5)])
q("q2", "2", P1, PARAS[8], 1.5, [el("q2-e1", "العبارة الدّالّة على عدم رضا الشّاعر", 1.5)])
q("q3", "3", P1, PARAS[9], 2, [el("q3-e1", "موطن الرّوح الدّينيّة ومصدرها", 2)])
q("q4", "4", P1, PARAS[10], 1, [el("q4-e1", "معنى الحلم", 0.5), el("q4-e2", "الحالة الّتي يكون فيها مستحسنًا أكثر", 0.5)])
q("q5", "5", P1, PARAS[11], 4, [el("q5-e1", "نثر الأبيات (دلالة المضمون وسلامة اللّغة)", 4)])
q("q6", "1", P2, PARAS[14], 1, [el("q6-e1", "إيحاء «طيف»", 0.25), el("q6-e2", "إيحاء «زاجر»", 0.25), el("q6-e3", "إيحاء «الدّياجر»", 0.25),
                               el("q6-e4", "إيحاء «الخطب»", 0.25)])
q("q7", "2", P2, PARAS[15], 3,
  [el("q7-e1", "إعراب «أحبّة» من «أحبّتي»", 0.5), el("q7-e2", "إعراب الياء في «أحبّتي»", 0.5), el("q7-e3", "إعراب «أصاب»", 0.25),
   el("q7-e4", "فاعل «أصاب»", 0.25), el("q7-e5", "النّون في «أصابني»", 0.5), el("q7-e6", "الياء في «أصابني»", 0.25),
   el("q7-e7", "محلّ جملة (اللّيل ضارب)", 0.25), el("q7-e8", "محلّ جملة (التفت عليه الضّمائر)", 0.25), el("q7-e9", "محلّ جملة (فالصّبر فيه المعاذر)", 0.25)])
q("q8", "3", P2, PARAS[16], 1, [el("q8-e1", "توضيح التّلازم الشّرطيّ", 0.5), el("q8-e2", "قيمته التّعبيريّة", 0.5)])
q("q9", "4", P2, PARAS[17], 1, [el("q9-e1", "تحديد الصّورة", 0.5), el("q9-e2", "نوعها", 0.5)])
q("q10", "1", P3, PARAS[20], 4, [el("q10-e1", "مواطن الحكمة في النّصّ والشّعراء الّذين تأثّر بهم", 2), el("q10-e2", "الرّأي في هذا التّأثّر", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "زار الشّاعر طيف ابنته سميرة. ويدلّ ذلك على شوقه إليها."
st("s01", "q1", "q1-e1", "mcq", "ما الّذي زار الشّاعر؟",
   {"options": ["طيف ابنته سميرة", "ابنته سميرة نفسها عائدة من سفرها", "صديق قديم", "رسول من أهله"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "mcq", "وعمَّ يدلّ ذلك؟",
   {"options": ["على شوقه إليها", "على غضبه منها", "على نسيانه لها", "على فرحه بانتهاء محنته"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.emotion", "b")
Q2_EXPL = "العبارة الدّالّة على عدم رضا الشّاعر هي: «صبرت على كره لما قد أصابني»."
st("s03", "q2", "q2-e1", "mcq", "الشّاعر في محنته غير راضٍ. ما العبارة الدّالّة على ذلك؟",
   {"options": ["«صبرت على كره لما قد أصابني»", "«وما الطّيف إلاّ ما تريه الخواطر»", "«طوى سدفة الظّلماء واللّيل ضارب»", "«ولولا أماني النّفس وهي حياتها»"]},
   {"correct": 0}, Q2_EXPL, 1, "ar.comprehension.evidence")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل العبارة من النّصّ:",
   {"text": "«صبرت على ____ لما قد أصابني»", "bank": ["كره", "رضا", "فرح"]},
   {"blanks": [["كره"]]}, Q2_EXPL, 0.5, "ar.comprehension.evidence", "b")
Q3_EXPL = "تشيع الرّوح الدّينيّة في قول الشّاعر: «فكلّ امرئ يومًا إلى الله صائر». ومصدرها الآية الكريمة: ﴿كلّ نفس ذائقة الموت﴾."
st("s05", "q3", "q3-e1", "mcq", "أين تجد الرّوح الدّينيّة في النّصّ؟",
   {"options": ["في قوله: «فكلّ امرئ يومًا إلى الله صائر»", "في قوله: «تأوّب طيف من سميرة زائر»", "في قوله: «طوى سدفة الظّلماء واللّيل ضارب»",
                "في قوله: «لما طار لي فوق البسيطة طائر»"]},
   {"correct": 0}, Q3_EXPL, 1, "ar.comprehension.evidence")
st("s06", "q3", "q3-e1", "mcq", "وما مصدرها؟",
   {"options": ["الآية الكريمة: ﴿كلّ نفس ذائقة الموت﴾", "الحديث الشّريف: «إنّما الأعمال بالنّيّات»", "قول المتنبّي: «على قدر أهل العزم تأتي العزائم»",
                "المثل العربيّ: «الصّبر مفتاح الفرج»"]},
   {"correct": 0}, Q3_EXPL, 1, "ar.literature.intertext", "b")
HL_EXPL = "الحِلم معناه الصّفح والعفو، ويكون مستحسنًا أكثر عند المقدرة."
st("s07", "q4", "q4-e1", "mcq", "ما معنى «الحِلم» في البيت العاشر؟",
   {"options": ["الصّفح والعفو", "الرّؤيا في المنام", "الغضب والانتقام", "العلم والمعرفة"]},
   {"correct": 0}, HL_EXPL, 0.5, "ar.comprehension.explain")
st("s08", "q4", "q4-e2", "mcq", "ما الحالة الّتي يكون فيها الحِلم مستحسنًا أكثر؟",
   {"options": ["عند المقدرة", "عند العجز", "عند الغضب الشّديد", "في حال الفقر"]},
   {"correct": 0}, HL_EXPL, 0.5, "ar.comprehension.explain")
NTH_SPEC = {"task": "نثر أبيات القصيدة", "scope": "الأبيات 1–11", "text": "قصيدة البارودي «تأوّب طيف» (بكالوريا 2008، لغات أجنبيّة، الموضوع الأوّل)",
            "scheme": "يراعى في نثر الأبيات دلالة المضمون وسلامة اللّغة — 04 (دون تفصيل؛ قُسّمت هنا نقطتين لكلّ معيار للتّدريب)", "model_example": None}
NTH_EXPL = "يراعى في نثر الأبيات دلالة المضمون وسلامة اللّغة (04 نقاط للسّؤال دون تفصيل؛ قُسّمت هنا نقطتين لكلّ معيار للتّدريب)."
essay("s09", "q5", "q5-e1", "نثر أبيات قصيدة البارودي", "المضمون", "دلالة المضمون", 2, NTH_SPEC, NTH_EXPL, "ar.writing.summary", "a")
essay("s10", "q5", "q5-e1", "نثر أبيات قصيدة البارودي", "سلامة اللّغة", "سلامة اللّغة", 2, NTH_SPEC, NTH_EXPL, "ar.writing.summary", "b")
# ── ثانيًا: البناء اللّغويّ ──
LEX_EXPL = ("الألفاظ: «طيف» توحي بالشّوق – «زاجر» توحي بالقلق – «الدّياجر» توحي بتحمّل المشاقّ والمتاعب في سبيل تحقيق الأماني – «الخطب» توحي "
            "بعظمة المصيبة وشدّة المعاناة.")
st("s11", "q6", "q6-e1", "mcq", "بمَ توحي لفظة «طيف»؟",
   {"options": ["بالشّوق", "بالفرح", "بالغضب", "بالقوّة"]}, {"correct": 0}, LEX_EXPL, 0.25, "ar.comprehension.explain")
st("s12", "q6", "q6-e2", "mcq", "بمَ توحي لفظة «زاجر»؟",
   {"options": ["بالقلق", "بالطّمأنينة", "بالفرح", "بالشّجاعة"]}, {"correct": 0}, LEX_EXPL, 0.25, "ar.comprehension.explain")
st("s13", "q6", "q6-e3", "mcq", "بمَ توحي لفظة «الدّياجر»؟",
   {"options": ["بتحمّل المشاقّ والمتاعب في سبيل تحقيق الأماني", "بالرّاحة والهناء", "بجمال اللّيل وسكونه", "بالنّصر القريب"]},
   {"correct": 0}, LEX_EXPL, 0.25, "ar.comprehension.explain")
st("s14", "q6", "q6-e4", "mcq", "بمَ توحي لفظة «الخطب»؟",
   {"options": ["بعظمة المصيبة وشدّة المعاناة", "بالبلاغة والفصاحة", "بالزّواج والخِطبة", "بالرّخاء والسّعة"]},
   {"correct": 0}, LEX_EXPL, 0.25, "ar.comprehension.explain")
AH_EXPL = "أحبّتي: مضاف إليه مجرور وعلامة جرّه الكسرة، وهو مضاف. الياء: ضمير متّصل مبنيّ على السّكون في محلّ جرّ مضاف إليه."
st("s15", "q7", "q7-e1", "mcq", "ما إعراب «أحبّة» من «أحبّتي» في قوله: «فيا بعد ما بيني وبين أحبّتي»؟",
   {"options": ["مضاف إليه مجرور وعلامة جرّه الكسرة، وهو مضاف", "اسم مجرور بحرف الجرّ وعلامة جرّه الكسرة، وهو مضاف",
                "مفعول به منصوب وعلامة نصبه الفتحة المقدّرة، وهو مضاف", "مبتدأ مرفوع وعلامة رفعه الضّمّة المقدّرة، وهو مضاف"]},
   {"correct": 0}, AH_EXPL, 0.5, "ar.grammar.irab")
st("s16", "q7", "q7-e2", "mcq", "ما إعراب الياء في «أحبّتي»؟",
   {"options": ["ضمير متّصل مبنيّ على السّكون في محلّ جرّ مضاف إليه", "ضمير متّصل مبنيّ على السّكون في محلّ نصب مفعول به",
                "ضمير متّصل مبنيّ على السّكون في محلّ رفع فاعل", "حرف لا محلّ له من الإعراب"]},
   {"correct": 0}, AH_EXPL, 0.5, "ar.grammar.irab")
AS_EXPL = ("أصابني: أصاب: فعل ماضٍ مبنيّ على الفتح، والفاعل ضمير مستتر تقديره هو. النّون: نون الوقاية، حرف مبنيّ على الكسر لا محلّ له من الإعراب. "
           "الياء: ضمير متّصل مبنيّ على السّكون في محلّ نصب مفعول به.")
st("s17", "q7", "q7-e3", "mcq", "ما إعراب «أصاب» في قوله: «صبرت على كره لما قد أصابني»؟",
   {"options": ["فعل ماضٍ مبنيّ على الفتح", "فعل ماضٍ مبنيّ على السّكون", "فعل ماضٍ مبنيّ على الضّمّ", "فعل مضارع مرفوع"]},
   {"correct": 0}, AS_EXPL, 0.25, "ar.grammar.irab")
st("s18", "q7", "q7-e4", "mcq", "ما فاعل «أصاب» في «لما قد أصابني»؟",
   {"options": ["ضمير مستتر تقديره هو", "الياء", "نون الوقاية", "ضمير مستتر تقديره أنا"]},
   {"correct": 0}, AS_EXPL, 0.25, "ar.grammar.irab")
st("s19", "q7", "q7-e5", "mcq", "ما إعراب النّون في «أصابني»؟",
   {"options": ["نون الوقاية، حرف مبنيّ على الكسر لا محلّ له من الإعراب", "نون النّسوة، ضمير متّصل مبنيّ في محلّ رفع فاعل",
                "نون التّوكيد الخفيفة، حرف مبنيّ على السّكون لا محلّ له من الإعراب", "نون الرّفع في الأفعال الخمسة"]},
   {"correct": 0}, AS_EXPL, 0.5, "ar.grammar.irab")
st("s20", "q7", "q7-e6", "fill_blank", "أكمل إعراب الياء في «أصابني»:",
   {"text": "الياء: ضمير متّصل مبنيّ على السّكون في محلّ ____ ____ به.", "bank": ["نصب", "مفعول", "جرّ", "مضاف"]},
   {"blanks": [["نصب"], ["مفعول"]]}, AS_EXPL, 0.25, "ar.grammar.irab")
st("s21", "q7", "q7-e7", "mcq", "ما محلّ جملة (اللّيل ضارب) من الإعراب في قوله: «طوى سدفة الظّلماء و(اللّيل ضارب)»؟",
   {"options": ["جملة اسميّة في محلّ نصب حال", "جملة اسميّة في محلّ رفع خبر", "جملة اسميّة في محلّ جرّ مضاف إليه", "جملة اسميّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "«اللّيل ضارب»: جملة اسميّة في محلّ نصب حال.", 0.25, "ar.grammar.sentence_case")
st("s22", "q7", "q7-e8", "mcq", "ما محلّ جملة (التفت عليه الضّمائر) من الإعراب في قوله: «ويا قرب ما (التفت عليه الضّمائر)»؟",
   {"options": ["جملة صلة الموصول لا محلّ لها من الإعراب", "جملة في محلّ رفع خبر", "جملة في محلّ نصب حال", "جملة في محلّ جرّ نعت"]},
   {"correct": 0}, "«التفت عليه الضّمائر»: جملة صلة الموصول لا محلّ لها من الإعراب.", 0.25, "ar.grammar.sentence_case")
st("s23", "q7", "q7-e9", "mcq", "ما محلّ جملة (فالصّبر فيه المعاذر) من الإعراب في البيت الأخير؟",
   {"options": ["جملة جواب الشّرط غير الجازم لا محلّ لها من الإعراب", "جملة جواب شرط جازم مقترنة بالفاء في محلّ جزم", "جملة في محلّ جرّ مضاف إليه",
                "جملة في محلّ رفع خبر"]},
   {"correct": 0}, "«فالصّبر فيه المعاذر»: جملة جواب الشّرط غير الجازم لا محلّ لها من الإعراب.", 0.25, "ar.grammar.sentence_case")
TL_EXPL = "قلّة النّصير وفقدان الأمل يستلزمان الصّبر، وقيمته التّعبيريّة تتمثّل في ضرورة التّحلّي بالصّبر عند الشّدائد."
st("s24", "q8", "q8-e1", "fill_blank", "وضّح التّلازم الشّرطيّ في البيت الأخير:",
   {"text": "قلّة ____ وفقدان الأمل يستلزمان ____.", "bank": ["النّصير", "الصّبر", "المال", "الغضب"]},
   {"blanks": [["النّصير"], ["الصّبر"]]}, TL_EXPL, 0.5, "ar.grammar.conditional")
st("s25", "q8", "q8-e2", "mcq", "ما القيمة التّعبيريّة لهذا التّلازم الشّرطيّ؟",
   {"options": ["ضرورة التّحلّي بالصّبر عند الشّدائد", "الدّعوة إلى الانتقام من الأعداء", "التّعبير عن اليأس والاستسلام", "الحثّ على طلب النّصير من النّاس"]},
   {"correct": 0}, TL_EXPL, 0.5, "ar.grammar.conditional")
IMG_EXPL = "الصّورة البيانيّة هي: «كالحِلم»؛ الشّاعر ينفي أن يكون الحِلم عند العاجز يشبه الحِلم عند القادر."
st("s26", "q9", "q9-e1", "mcq", "حدّد الصّورة البيانيّة في البيت العاشر:",
   {"options": ["«كالحِلم» في قوله: «بمستحسن كالحِلم والمرء قادر»", "«عند الخطب»", "«والمرء عاجز»"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s27", "q9", "q9-e2", "mcq", "وما نوعها؟",
   {"options": ["تشبيه: الشّاعر ينفي أن يكون الحِلم عند العاجز يشبه الحِلم عند القادر", "استعارة مكنيّة", "كناية عن صفة", "مجاز مرسل"]},
   {"correct": 0}, IMG_EXPL + " (لا تسمّي الإجابة النّموذجيّة نوع التّشبيه.)", 0.5, "ar.rhetoric.simile")
# ── ثالثًا: التّقويم النّقديّ ──
WIS_EXPL = ("وظّف الشّاعر الحكمة في الأبيات الثّلاثة الأخيرة وهو متأثّر في ذلك بشعراء الحكمة مثل أبي العلاء والمتنبّي… يبرز المترشّح رأيه في التّأثّر.")
st("s28", "q10", "q10-e1", "multi", "دلّ على مواطن الحكمة في النّصّ: (اختر كلّ ما يصحّ)",
   {"options": ["البيت التّاسع: «صبرت على كره لما قد أصابني…»", "البيت العاشر: «وما الحلم عند الخطب والمرء عاجز…»",
                "البيت الحادي عشر: «ولكن إذا قلّ النّصير وأعوزت…»", "البيت الأوّل: «تأوّب طيف من سميرة زائر…»",
                "البيت الثّاني: «طوى سدفة الظّلماء واللّيل ضارب…»", "البيت الثّالث: «فيا لك من طيف ألمّ ودونه…»"]},
   {"correct": [0, 1, 2]}, WIS_EXPL, 1, "ar.literature.hikma")
st("s29", "q10", "q10-e1", "multi", "اذكر من الشّعراء الّذين تأثّر بهم البارودي في توظيف الحكمة: (اختر كلّ ما يصحّ)",
   {"options": ["أبو العلاء المعرّي", "المتنبّي", "عمر بن أبي ربيعة", "جميل بثينة", "نزار قبّاني"]},
   {"correct": [0, 1]}, WIS_EXPL + " أمّا عمر بن أبي ربيعة وجميل بثينة فشاعرا غزل، ونزار قبّاني متأخّر عن البارودي.", 1, "ar.literature.hikma", "b")
essay("s30", "q10", "q10-e2", "تأثّر البارودي بشعراء الحكمة", "إبداء الرّأي", "يبرز المترشّح رأيه في التّأثّر", 2,
      {"task": "إبداء الرّأي في تأثّر البارودي بشعراء الحكمة", "question": PARAS[20], "scheme": "«يبرز المترشّح رأيه في التّأثّر» (2×2: المواطن والشّعراء + الرّأي)",
       "model_example": None},
      WIS_EXPL, "ar.comprehension.opinion")

TITLE = "بكالوريا 2008 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (البارودي: تأوّب طيف)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: «ومـالـه» ← «ومـا لـه» و«سوی» بالياء الفارسيّة ← «سوى» (ب4). ترقيم الأبيات من docx (الموضوع الرّسميّ بلا ترقيم). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1، صورة ممسوحة قُرئت مكبَّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): نثر الأبيات س5 (04) والرّأي في التّقويم النّقديّ (2).")
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
