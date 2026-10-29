"""Conversion: BAC 2008 (session عاديّة، جوان 2008) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (إيليا أبو ماضي، «أقبل العيد ولكن»).
Exam (most faithful source): gdrive 1jiQFft2dvpdd8TK-BrBcblmvPQQm3a3G (اختبار اللغة العربية 2008 علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1B_-mczZ_WMrv2bHifGWm4xQkxU9U1FyT (BAC 2008 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1gwKbg3oZbrFX6Nf46jkpatkMFPfKDRiV (01_الموضوع.pdf, pages 1–2, image-only scan at 96 ppi);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1kOohNk66gvjOX6_V7YKIeWy-YtLT0zeQ (02_التصحيح.pdf, page 1).

Method (as the BAC 2011–2023 converters): PARAS / POEM_RAW below were generated from the .docx with python-docx and spliced
into this file by script (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed; the
poem table is read as rows [عجز, (empty), «n- صدر»] from the RTL 3-column layout — in rows 6, 10, 11 and 12 the صدر cell is
merged over the two right columns and read once; the verse number is split off the صدر). Every verbatim string of the JSON
is built from PARAS / POEM_RAW (the fixes below are applied with _fix, each asserted to occur once) and was re-checked
programmatically against the docx. The docx was compared verse by verse and question by question with the ONEC paper (page
images extracted at their native 96 ppi and enlarged ×2–×6 for doubtful words). The correction PDF has no text layer; the
scheme was read from its page image (enlarged ×2–×8). Every mark comes from the official scheme; correct options and
explanations condense its wording.

Docx defects fixed from the ONEC paper:
- the docx opens the text with «قال البارودي:» (a line copied from another paper: the poem is by إيليا أبو ماضي, the ONEC
  paper has only «النّصّ:» and the signature «إيليا أبو ماضي / من ديوان الخمائل») ⇒ dropped;
- verse 9 عجز «فإذا في المغصـن نُضُره» ⇒ «فإذا في الغصـن نُضُره» (ONEC «الغُصن»);
- verse 12 صدر «ولا ـتجــ…ـعــل» carries a stray tatweel before the ت (ONEC «ولا تجـــعل») ⇒ «ولا تجــ…ـعــل»;
- verses 4 and 10: «شكوی», «استوی» are typed with the Farsi yeh U+06CC ⇒ Arabic alif maqsura «شكوى», «استوى»;
- reference «من ديوان الحمائل» ⇒ «من ديوان الخمائل» (ONEC; Abu Madi's collection «الخمائل»);
- Part 2 Q1 «" بكي "» ⇒ «" بكى "» (ONEC «بكى»; the question is about the alif of the verb).
Other differences are diacritics / tatweel / labels only (docx kept): «بــُـكـــرهُ» (ONEC «بُكرَه»), «(12 نقاط)» (ONEC
«(12 نقطة)»), «أوّلا-/ثانيا-» (ONEC «ـ البناء الفكريّ»), verse numbers «1-» (the ONEC paper numbers its verses too).

Conversion notes / points for the owner's review:
- Streams: ONEC paper «علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد»; correction «ع.تج، تس.اق، ريا، تقني.ريا» ⇒ SCI,
  MATH, TM, GE. This 2008 paper has two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item; an unsplit mark ⇒ one element.
- Q1 «03» (topic + the words, not split) ⇒ one element of 3, three steps. Q2 «02» and Q3 «03» ⇒ one element each.
- Q4 (تلخيص) «2×02» = دلالة المضمون / سلامة اللّغة ⇒ two deferred essay_builder elements.
- Part 2 Q1 «3×01» = the type (ناقصان) / the origin of the alif (واويّ، يائيّ) / the dual forms with the reason (يكسوان،
  يبكيان: رُدّت الألف إلى أصلها) ⇒ three elements. Q2 «0,5». Q3: «01» beside «فقدت في البحر إبره» (نعت) and «01,5» beside
  «استوى ماء وخضره» (جواب الشّرط غير الجازم) — read from their position in the marks column (sum 2.5 checks with the part
  total 8). Q4 «2×01» = the type (استعارة مكنيّة) / its rhetoric.
- Distractors avoid what the scheme or usage could accept: no «الظّرفيّة» for «على», no «حال»/«استئنافيّة» for the نعت
  sentence, no «كناية»/«مجاز مرسل» for «كساها الهمّ صفره», no optimism word among the pessimism words.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2008-sci-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1jiQFft2dvpdd8TK-BrBcblmvPQQm3a3G"
DOCX_TITLE = "اختبار اللغة العربية 2008 علوم تجريبية.docx"
PDF_ID = "1B_-mczZ_WMrv2bHifGWm4xQkxU9U1FyT"
OFFICIAL_ID = "1gwKbg3oZbrFX6Nf46jkpatkMFPfKDRiV"
CORR_ID = "1kOohNk66gvjOX6_V7YKIeWy-YtLT0zeQ"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    0: "على المترشح أن يختار أحد الموضوعين الآتيين:",
    1: "الموضوع الأول",
    2: "النّـــــص:",
    3: "قال البارودي:",
    4: "إيليا أبو ماضي",
    5: "من ديوان الحمائل",
    7: "الأسئلة:",
    8: "أوّلا- البناء الفكري: (12 نقاط)",
    9: "ما الموضوع الذي شغل بال الشاعر في هذه القصيدة؟ وضّح إجابتك بألفاظ دالة على ذلك من النص.",
    10: "إلام يدعو أبو ماضي الإنسانَ العابس؟",
    11: "يعكس النص نزعة الشاعر الإنسانية ونظرته إلى العلاقات بين الناس. أبرز ذلك مع التمثيل.",
    12: "لخّص مضمون القصيدة.",
    13: "ثانيا- البناء اللّغوي: (08 نقاط)",
    14: "ما نوع الفعلين المعتلين \" كسا \" و \" بكي \"؟، وما أصل الألف فيهما؟ أسندهما إلى ألف الاثنين في المضارع المذكر الغائب موضّحا الفرق بينهما مع التعليل.",
    15: "ما المعنى الذي أفاده حرف الجر \" على \" في قول الشاعر \" رفّت على القـفر \"؟",
    16: "بين محل الجملتين الآتيتين من الإعراب: \" فقدت في البحر إبره \" و \" استوى ماء وخضره \".",
    17: "في الشطر الثاني من البيت الثالث صورة بيانية. ما نوعها؟ وما بلاغتها؟",
}
# جدول القصيدة في docx: صفوف [العجز، (فارغة)، «رقم- الصّدر»] (تخطيط RTL)؛ إذا دُمجت خليّة الصّدر على العمودين الأيمنين قُرئت مرّة واحدة.
# هنا: [«رقم- الصّدر»، العجز]
POEM_RAW = [
    ["1-أقبل العيـد ولـكـن", "ليس في النَّاس الـمــسره"],
    ["2-لا أرى إلا وجُـوها", "كالحاتٍ مكـفـهـره"],
    ["3-وخـدودًا باهــــــتــــــاتٍ", "قد كساها الهمُّ صُـفـره"],
    ["4-ليس للقـوم حـديـثٌ", "غير شكوی مُستمـره"],
    ["5- لا تسـل ماذا عَراهـم", "كلُّهـم يـجهل أمـــــــره"],
    ["6-كلُّهم يبكي على الأمــــــــــــــــــــــــــــــــــــــــــس", "ويخشى شـرَّ بــُـكـــرهُ"],
    ["7- فهم مثـل عـــجوزٍ", "فقدت في البحر إبـره"],
    ["8- أيُّها الشاكي الليـالي", "إنَّما الغبطـةُ فِـكــره"],
    ["9- تلمسُ الغصن الـمُعرَّى", "فإذا في المغصـن نُضُره"],
    ["10- وإذا رفت على القفــــــــــــــــــــــــر", "استوی مـاء وخُـضـره"],
    ["11- أيُّها العابس لن تُعـــــــــــــــــــــــــــــطى", "على التقطيب أُجـــــرة"],
    ["12- لا تكن مـرًّا ولا ـتجــــــــــــــــــــــــــــــــــعــــــل", "حيـاة الغيـر مُـــــــرَّه"],
    ["13- فتهلَّل وتــــرنــَّــــــم", "فالفـتى العابـس صـخـرَه"],
]


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


# تصويبات من الموضوع الرّسميّ (عيوب في docx؛ انظر التّوثيق أعلاه)
FARSI_YEH, ALIF_MAQSURA = "ی", "ى"
POEM = []
for _sadr, _ajz in POEM_RAW:
    _m = re.match(r"^(\d+)-\s*(.+)$", _sadr)
    assert _m and "\n" not in _sadr and "\n" not in _ajz, _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 14)]
POEM[3][2] = _fix(POEM[3][2], FARSI_YEH, ALIF_MAQSURA)
POEM[8][2] = _fix(POEM[8][2], "المغصـن", "الغصـن")
POEM[9][2] = _fix(POEM[9][2], FARSI_YEH, ALIF_MAQSURA)
POEM[11][1] = _fix(POEM[11][1], "ولا ـتج", "ولا تج")
assert not any(FARSI_YEH in c for r in POEM for c in r)
assert POEM[2][2].startswith("قد كساها") and POEM[6][2].startswith("فقدت في البحر") and POEM[9][2].startswith("استوى")
assert PARAS[3] == "قال البارودي:" and PARAS[4] == "إيليا أبو ماضي"  # سطر «قال البارودي:» غير موجود في الموضوع الرّسميّ ⇒ لا يُنقل
REF = PARAS[4] + "\n" + _fix(PARAS[5], "الحمائل", "الخمائل")

P1, P2 = PARAS[8], PARAS[13]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا")
DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": REF},
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


q("q1", "1", P1, PARAS[9], 3, [el("q1-e1", "الموضوع الّذي شغل بال الشّاعر والألفاظ الدّالّة عليه", 3)])
q("q2", "2", P1, PARAS[10], 2, [el("q2-e1", "ما يدعو إليه الشّاعر الإنسان العابس", 2)])
q("q3", "3", P1, PARAS[11], 3, [el("q3-e1", "نزعة الشّاعر الإنسانيّة ونظرته مع التّمثيل", 3)])
q("q4", "4", P1, PARAS[12], 4, [el("q4-e1", "التّلخيص: دلالة المضمون", 2), el("q4-e2", "التّلخيص: سلامة اللّغة", 2)])
q("q5", "1", P2, _fix(PARAS[14], "\" بكي \"", "\" بكى \""), 3,
  [el("q5-e1", "نوع الفعلين", 1), el("q5-e2", "أصل الألف فيهما", 1), el("q5-e3", "إسنادهما إلى ألف الاثنين مع التّعليل", 1)])
q("q6", "2", P2, PARAS[15], 0.5, [el("q6-e1", "معنى «على» في «رفّت على القفر»", 0.5)])
q("q7", "3", P2, PARAS[16], 2.5, [el("q7-e1", "محلّ جملة «فقدت في البحر إبره»", 1), el("q7-e2", "محلّ جملة «استوى ماء وخضره»", 1.5)])
q("q8", "4", P2, PARAS[17], 2, [el("q8-e1", "نوع الصّورة", 1), el("q8-e2", "بلاغتها", 1)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "الموضوع الّذي شغل بال الشّاعر في هذه القصيدة هو روح التّشاؤم السّائدة في نفوس النّاس. الألفاظ الدّالّة على ذلك: كالحات – مكفهرّة – شكوى – يبكي – يخشى."
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي شغل بال الشّاعر في هذه القصيدة؟",
   {"options": ["روح التّشاؤم السّائدة في نفوس النّاس", "فرحة النّاس بقدوم العيد", "الحنين إلى الوطن والأهل", "وصف جمال الطّبيعة في الرّبيع"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "multi", "وضّح إجابتك: أيّ الألفاظ الآتية من النّصّ تدلّ على ذلك؟ (اختر كلّ ما يصحّ)",
   {"options": ["كالحات", "مكفهرّة", "شكوى", "يبكي", "يخشى", "تهلّل", "ترنّم", "نضرة"]},
   {"correct": [0, 1, 2, 3, 4]}, Q1_EXPL + " أمّا «تهلّل، ترنّم، نضرة» فألفاظ تفاؤل يدعو إليها الشّاعر.", 1, "ar.comprehension.evidence", "b")
st("s03", "q1", "q1-e1", "matching", "طابق كلّ لفظ دالّ على التّشاؤم بالبيت الّذي ورد فيه.",
   {"lefts": ["كالحات مكفهرّة", "شكوى", "يبكي، يخشى"], "rights": ["البيت الثّاني", "البيت الرّابع", "البيت السّادس", "البيت الثّالث عشر"]},
   {"pairs": [0, 1, 2]}, Q1_EXPL + " والبيت الثّالث عشر دعوة إلى التّهلّل والتّرنّم.", 1, "ar.comprehension.evidence", "c")
Q2_EXPL = "يدعو الشّاعر الإنسان العابس إلى التّفاؤل ونبذ التّشاؤم."
st("s04", "q2", "q2-e1", "mcq", "إلامَ يدعو أبو ماضي الإنسانَ العابس؟",
   {"options": ["إلى التّفاؤل ونبذ التّشاؤم", "إلى البكاء على الأمس والخوف من الغد", "إلى العزلة عن النّاس", "إلى الثّورة على الأغنياء"]},
   {"correct": 0}, Q2_EXPL, 1, "ar.comprehension.idea")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "يدعو الشّاعر الإنسان العابس إلى ____ ونبذ ____.", "bank": ["التّفاؤل", "التّشاؤم", "العزلة", "الصّبر"]},
   {"blanks": [["التّفاؤل"], ["التّشاؤم"]]}, Q2_EXPL, 1, "ar.comprehension.idea", "b")
Q3_EXPL = ("يعكس النّصّ نزعة الشّاعر الإنسانيّة ونظرته إلى الحياة بمنظار التّفاؤل. يبرز ذلك في قوله: «الغبطة فكره… في الغصن نضره… ماء وخضره… "
           "تهلّل وترنّم».")
st("s06", "q3", "q3-e1", "mcq", "ما النّزعة الّتي يعكسها النّصّ في نظرة الشّاعر إلى العلاقات بين النّاس؟",
   {"options": ["النّزعة الإنسانيّة", "النّزعة القبليّة", "النّزعة الصّوفيّة الزّهديّة", "النّزعة الثّوريّة"]},
   {"correct": 0}, Q3_EXPL, 1, "ar.comprehension.values")
st("s07", "q3", "q3-e1", "fill_blank", "أكمل:",
   {"text": "ينظر الشّاعر إلى الحياة بمنظار ____.", "bank": ["التّفاؤل", "التّشاؤم", "اليأس"]},
   {"blanks": [["التّفاؤل"]]}, Q3_EXPL, 1, "ar.comprehension.values", "b")
st("s08", "q3", "q3-e1", "multi", "أبرز ذلك مع التّمثيل: أيّ العبارات الآتية يبرز فيها ذلك؟ (اختر كلّ ما يصحّ)",
   {"options": ["«إنّما الغبطة فكره»", "«فإذا في الغصن نضره»", "«استوى ماء وخضره»", "«فتهلّل وترنّم»",
                "«لا أرى إلاّ وجوها كالحات مكفهرّه»", "«كلّهم يبكي على الأمس»", "«ليس للقوم حديث غير شكوى مستمرّه»"]},
   {"correct": [0, 1, 2, 3]}, Q3_EXPL, 1, "ar.comprehension.evidence", "c")
SUM_SPEC = {"task": "تلخيص مضمون القصيدة", "text": "قصيدة إيليا أبو ماضي «أقبل العيد ولكن» (بكالوريا 2008، الشّعب العلميّة، الموضوع الأوّل)",
            "scheme": "يراعى في التّلخيص دلالة المضمون وسلامة اللّغة (2×02)", "model_example": None}
SUM_EXPL = "يراعى في التّلخيص دلالة المضمون (02) وسلامة اللّغة (02). لا تقدّم الإجابة النّموذجيّة نموذجًا للتّلخيص."
essay("s09", "q4", "q4-e1", "تلخيص مضمون قصيدة «أقبل العيد ولكن»", "المضمون", "دلالة المضمون", 2, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
essay("s10", "q4", "q4-e2", "تلخيص مضمون قصيدة «أقبل العيد ولكن»", "سلامة اللّغة", "سلامة اللّغة", 2, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
V_EXPL = "الفعلان «كسا» و«بكى» ناقصان، الأوّل واويّ والثّاني يائيّ. وإسنادهما إلى المثنّى كالآتي: يكسوان ويبكيان، رُدّت الألف إلى أصلها."
st("s11", "q5", "q5-e1", "mcq", "ما نوع الفعلين المعتلّين «كسا» و«بكى»؟",
   {"options": ["ناقصان", "مثالان", "أجوفان", "لفيفان مفروقان"]},
   {"correct": 0}, V_EXPL, 1, "ar.morphology")
st("s12", "q5", "q5-e2", "matching", "ما أصل الألف في كلّ فعل؟ طابق.",
   {"lefts": ["كسا", "بكى"], "rights": ["واويّ (أصل الألف واو)", "يائيّ (أصل الألف ياء)", "الألف أصليّة غير منقلبة"]},
   {"pairs": [0, 1]}, V_EXPL, 1, "ar.morphology")
st("s13", "q5", "q5-e3", "fill_blank", "أسند الفعلين إلى ألف الاثنين في المضارع المذكّر الغائب:",
   {"text": "كسا ← هما ____ — بكى ← هما ____", "bank": ["يكسوان", "يبكيان", "يكسيان", "يبكوان"]},
   {"blanks": [["يكسوان"], ["يبكيان"]]}, V_EXPL, 0.5, "ar.morphology")
st("s14", "q5", "q5-e3", "mcq", "علّل الفرق بين «يكسوان» و«يبكيان».",
   {"options": ["رُدّت الألف إلى أصلها: الواو في «يكسوان» والياء في «يبكيان»", "قُلبت الألف ياءً في الفعلين", "حُذفت الألف لالتقاء السّاكنين",
                "قُلبت الألف واوًا في الفعلين"]},
   {"correct": 0}, V_EXPL, 0.5, "ar.morphology", "b")
st("s15", "q6", "q6-e1", "mcq", "ما المعنى الّذي أفاده حرف الجرّ «على» في قول الشّاعر: «رفّت على القفر»؟",
   {"options": ["الاستعلاء", "التّعليل", "المصاحبة", "الاستدراك"]},
   {"correct": 0}, "المعنى الّذي أفاده حرف الجرّ «على» هو الاستعلاء.", 0.5, "ar.cohesion.connectors")
st("s16", "q7", "q7-e1", "mcq", "ما محلّ جملة «فقدت في البحر إبره» من الإعراب في قوله: «فهم مثل عجوزٍ فقدت في البحر إبره»؟",
   {"options": ["جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة في محلّ رفع خبر", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "«فقدت في البحر إبره»: جملة فعليّة في محلّ جرّ نعت (لـ«عجوزٍ»).", 1, "ar.grammar.sentence_case")
COND_EXPL = "«استوى ماء وخضره»: جملة جواب الشّرط غير الجازم لا محلّ لها من الإعراب (الأداة «إذا»، وجملة الشّرط «رفّت على القفر»)."
st("s17", "q7", "q7-e2", "mcq", "ما محلّ جملة «استوى ماء وخضره» من الإعراب في قوله: «وإذا رفّت على القفر استوى ماء وخضره»؟",
   {"options": ["جملة جواب الشّرط غير الجازم لا محلّ لها من الإعراب", "جملة جواب شرط جازم مقترنة بالفاء في محلّ جزم",
                "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, COND_EXPL, 0.75, "ar.grammar.sentence_case")
st("s18", "q7", "q7-e2", "matching", "حلّل أسلوب الشّرط في البيت العاشر: طابق كلّ ركن بما يقابله.",
   {"lefts": ["أداة الشّرط", "جملة الشّرط", "جملة جواب الشّرط"], "rights": ["إذا", "رفّت على القفر", "استوى ماء وخضره", "فتهلّل وترنّم"]},
   {"pairs": [0, 1, 2]}, COND_EXPL, 0.75, "ar.grammar.conditional", "b")
IMG_EXPL = "الصّورة البيانيّة في قول الشّاعر: «كساها الهمّ صفره» استعارة مكنيّة، وبلاغتها تتمثّل في تصوير المتشائم الّذي يكسو وجهه الشّحوب والاصفرار."
st("s19", "q8", "q8-e1", "mcq", "ما نوع الصّورة البيانيّة في الشّطر الثّاني من البيت الثّالث: «قد كساها الهمّ صفره»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "تشبيه تمثيليّ"]},
   {"correct": 0}, IMG_EXPL, 1, "ar.rhetoric.metaphor")
st("s20", "q8", "q8-e2", "mcq", "ما بلاغة الصّورة في «قد كساها الهمّ صفره»؟",
   {"options": ["تصوير المتشائم الّذي يكسو وجهه الشّحوب والاصفرار", "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ في العبارة",
                "إبراز المعنى بذكر ضدّه"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
st("s21", "q8", "q8-e2", "fill_blank", "أكمل بلاغة الصّورة:",
   {"text": "تتمثّل بلاغتها في تصوير ____ الّذي يكسو وجهه ____ والاصفرار.", "bank": ["المتشائم", "الشّحوب", "المتفائل", "الإشراق"]},
   {"blanks": [["المتشائم"], ["الشّحوب"]]}, IMG_EXPL, 0.5, "ar.rhetoric.effect", "b")

TITLE = "بكالوريا 2008 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (إيليا أبو ماضي: أقبل العيد ولكن)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، شعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: حُذف سطر «قال البارودي:» (ليس في الموضوع الرّسميّ؛ القصيدة لإيليا أبي ماضي)، «المغصـن» ← «الغصـن» (ب9)، "
         "«ولا ـتجـ» ← «ولا تجـ» (ب12)، «شكوی/استوی» بالياء الفارسيّة ← «شكوى/استوى»، «الحمائل» ← «الخمائل»، «بكي» ← «بكى» (البناء اللّغويّ س1). "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1، صورة ممسوحة قُرئت مكبَّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
         "علامتا س3 من البناء اللّغويّ (01 للنّعت، 01,5 لجواب الشّرط) مقروءتان من موضعهما في عمود العلامات. مؤجَّل (essay_builder): التّلخيص س4 (2×02).")
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
