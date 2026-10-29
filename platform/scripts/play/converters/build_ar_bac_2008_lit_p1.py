"""Conversion: BAC 2008 (session عاديّة، جوان 2008) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (إيليا أبو ماضي، «كم تشتكي»).
Exam (most faithful source): gdrive 1Z48IhsfM18BggVDT782C0cBJ1iars5zr (file titled «.اختبار اللغة العربية دورة 2018.pdf.docx» — its
content is the 2008 paper, checked against the ONEC paper; year and stream come from the ONEC paper and the correction);
same paper as PDF (owner's copy): gdrive 1wrDR73YuePFL_eKMLkQc51yd-ebUa3XN (BAC 2008 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1uTEmSjvlXbd3xfIzedfijg5JAxcdP72m (01_الموضوع.pdf, pages 1–2, image-only scan at 96 ppi);
official mark scheme (ONEC «الإجابة وسلّم التّنقيط»): gdrive 1ZoDy-bNz9hZnuUi_pOAgFtC7vFWx9-bu (02_التصحيح.pdf, page 1).

Method (as build_ar_bac_2008_sci_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx and spliced
into this file by script (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed;
the poem table is read as rows [عجز, (empty), «n- صدر»], the verse number is split off the صدر). Every verbatim string of the
JSON is built from PARAS / POEM_RAW and was re-checked programmatically against the docx. The docx was compared verse by verse
and question by question with the ONEC paper (page images enlarged ×2–×6). The correction PDF has no text layer; the scheme
was read from its page image (enlarged ×2; the scansion line ×4). Every mark comes from the official scheme; correct options
and explanations condense its wording.

Docx defect fixed from the ONEC paper: verse 10 «يضحّك» (shadda: «makes laugh», breaks the metre) ⇒ «يضحَك» (ONEC «يضحَك»).
Other differences are diacritics / spelling / punctuation / labels only (docx kept): «الى» (ONEC «إلى»), Q6 «اُنثر الأبيات
من 1 الى: 5.» (ONEC «أنثر الأبيات من: 1 إلى: 5.»), part labels «أوّلا-/ثانيا-/ثالثا-» (ONEC «I/II/III ـ»).

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «آداب وفلسفة» ⇒ LIT.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item; an unsplit mark ⇒ one element.
- Q1 «02», Q2 «02», Q3 «01», Q4 «01,5», Q5 «01,5»: one element each. Q6 (نثر الأبيات 1–5) «2×01» = تقنية النّثر / سلامة
  اللّغة ⇒ two deferred essay_builder elements.
- Part 2 Q1 «3×0,5» with five قرائن listed and «تعتبر الإجابة كاملة إذا تضمّنت ثلاث قرائن مختلفة» ⇒ one element of 1.5.
  Q2: «0,5» «لاهيًا» + «2×0,5» beside «شاخ الزّمان: جملة فعليّة، واقعة مقول القول، في محلّ نصب مفعول به» (one answer, parts
  not labelled ⇒ one element of 1, two steps). Q3 «0,5 / 0,5 / 0,5» = the image with its type / its explanation / its effect
  (the scheme also accepts «الشّمس فوقك عسجد»: the steps ask about the صدر image and the explanation names both).
  Q4 «0,5 / 0,5 / 0,5» = the scansion / the تفعيلة «مُتَفاعِلُن (ستّ مرّات)» / the change «تسكين الثّاني المتحرّك». The scheme
  prints the symbols in visual right-to-left order; written here left-to-right (the usual notation). It does not name the
  metre or the زحاف, so the steps do not either.
- Part 3 Q1 «02»: the scheme accepts «القيمة الإنسانيّة (الدّعوة إلى التّفاؤل)» or «القيمة الفنّيّة (تشخيص الطّبيعة، الوحدة
  العضويّة، سهولة اللّفظ…)» ⇒ one element, steps on both; distractors are values / features absent from the poem.
  Q2 «02»: «الاتّجاه الرّومانسيّ: البعد الإنسانيّ، تشخيص الطّبيعة… الخ» ⇒ one element; the example verse of تشخيص الطّبيعة
  (ب10) is the converter's illustration (the scheme gives none) — owner to confirm.
- Distractors avoid what the scheme or usage could accept: no اسم موصول / شرط / توكيد among the قرائن distractors (all occur in
  the poem), no «مُسْتَفْعِلُن» for the تفعيلة, no personifying verse (ب5، ب8–11) among the example distractors, no «الشّمس فوقك
  عسجد» as a wrong image.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2008-lit-p1"
PAPER = 1
STREAMS = ["LIT"]
DOCX_ID = "1Z48IhsfM18BggVDT782C0cBJ1iars5zr"
DOCX_TITLE = ".اختبار اللغة العربية دورة 2018.pdf.docx"
PDF_ID = "1wrDR73YuePFL_eKMLkQc51yd-ebUa3XN"
OFFICIAL_ID = "1uTEmSjvlXbd3xfIzedfijg5JAxcdP72m"
CORR_ID = "1ZoDy-bNz9hZnuUi_pOAgFtC7vFWx9-bu"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    0: "على المترشح أن يختار أحد الموضوعين الآتيين:",
    1: "الموضوع الأول",
    2: "النّـــــص:",
    3: "قال إيليا أبو ماضي:",
    4: "إيليا أبو ماضي – الجداول-",
    8: "الأسئلة:",
    9: "أوّلا- البناء الفكري: (10 نقاط)",
    10: "لمن يتوجّه الشّاعر بالخطاب؟",
    11: "ما الذي دفعه الى نظم هذه القصيدة؟",
    12: "لِمَ وظّف الشَّاعر كثيرًا ضمير المخاطب؟",
    13: "أمتشائم هو أم متفائل؟ وضّح.",
    14: "ما العلاقة التي تربط بين البيتين الأول والأخير؟ وضّح.",
    15: "اُنثر الأبيات من 1 الى: 5.",
    16: "ثانيا- البناء اللّغوي: (06 نقاط)",
    17: "ما القرائن اللّغوِيّة التي اعتمدها الشَّاعر في الرَّبط بين الأبيات؟",
    18: "أعرب \"لاهيًا\" إعراب مفردات، و \"شاخ الزمان\" إعراب جمل.",
    19: "في البيت الثالث صورة بيانية، استخرجها، ثُّم اشرحها، وبين أثرها البلاغي.",
    20: "قطّع البيت الأوَّل تقطيعا عروضيا، وحدّد تفعيلاته، وبيّن المتغيّرات الطّارئة عليها.",
    21: "ثالثا- التّقويم النقدي: (04 نقاط)",
    23: "انطوى النّص على قيم متعددة. اذكر قيمة بارزة فيه ووضّحها.",
    24: "جسّدت القصيدة مظاهر التّجديد في الشّعر العربي الحديث؛ اذكر هذه المظاهر مع التّمثيل.",
    33: "انتهــى الموضوع الأول",
}
# جدول القصيدة في docx: صفوف [العجز، (فارغة)، «رقم- الصّدر»] (تخطيط RTL)؛ إذا دُمجت خليّة الصّدر على العمودين الأيمنين قُرئت مرّة واحدة.
# هنا: [«رقم- الصّدر»، العجز]
POEM_RAW = [
    ["1- كم تشتكي وتقول إنّك مُعـدم", "والأرض ملكُك والسّمَا والأنجـمُ"],
    ["2-ولك الحقُولُ وزهرها وأريـجُها", "ونسيمُهـا والبلبـل المترنِّمُ"],
    ["3-والماء حـولك فضّـة رقراقـة", "والشّمسُ فوقك عسـجـد يـتضـرَّمُ"],
    ["4-والنّورُ يبني في السّفوح وفي الذّرى", "دورًا مزخرفة وحينـا يَهْــــدِمُ"],
    ["5-هشّت لك الدنيا فمالك واجما!", "وتبسّمت فَعَلام لا تتبسّمُ؟"],
    ["6-إن كنت مكتئبًا لعزٍّ قد مضَى", "هيهـات يرجعُـه إليـك تَنَـدُّم"],
    ["7-أو كُنتَ جاوزت الشّباب فلا تقُـلْ", "شَاخَ الزّمـانُ، فإنـّه لا يهـــــــرمُ"],
    ["8-انظُرْ فما زالتْ تطل من الثّرى", "صورٌ تكاد لحسنِهـا تَتَكلّـمُ"],
    ["9-ما بين أشجـار كأن غصونهـا", "أيـدٍ تصفق تارة وتسلمُ"],
    ["10-والجَدْوَل الجَدْلانُ يضحّك لاهيًا", "والنّرجس الولهـان مُـغْـفٍ يحلُمُ"],
    ["11-صُـوَرٌ وآيـات تفيض بشاشـة", "حتَّى كأنّ الله فيهـا يـبسِمُ"],
    ["12-فامشِ بعقلك فوقها مُتَفَهِمًا", "إنَّ الـمَـلاحَـة ملك مـن يتفهّـمُ"],
    ["13-وترى الحقيقةَ هَيكَلاً مُتجَسّدًا", "فتعافهـا لـوسـاوسَ تُتَوهَّـمُ"],
    ["14-يـا مَنْ يَحنُّ إلى غـدٍ في يومهِ", "قَد بِعتَ ما تـدري بما لا تعلـمُ"],
]


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


POEM = []
for _sadr, _ajz in POEM_RAW:
    _m = re.match(r"^(\d+)-\s*(.+)$", _sadr)
    assert _m and "\n" not in _sadr and "\n" not in _ajz, _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 15)]
# تصويب من الموضوع الرّسميّ: «يضحّك» (بالشّدّة) ← «يضحَك» (ب10)
POEM[9][1] = _fix(POEM[9][1], "يضحّك", "يضحَك")
assert POEM[0][1].startswith("كم تشتكي") and POEM[6][2].startswith("شَاخَ الزّمـانُ") and POEM[9][1].endswith("لاهيًا")

P1, P2, P3 = PARAS[9], PARAS[16], PARAS[21]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and PARAS[3] == "قال إيليا أبو ماضي:"
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[3]},
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[4]},
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


q("q1", "1", P1, PARAS[10], 2, [el("q1-e1", "المخاطَب في النّصّ", 2)])
q("q2", "2", P1, PARAS[11], 2, [el("q2-e1", "الدّافع إلى نظم القصيدة", 2)])
q("q3", "3", P1, PARAS[12], 1, [el("q3-e1", "سبب توظيف ضمير المخاطب", 1)])
q("q4", "4", P1, PARAS[13], 1.5, [el("q4-e1", "تفاؤل الشّاعر أو تشاؤمه مع التّوضيح", 1.5)])
q("q5", "5", P1, PARAS[14], 1.5, [el("q5-e1", "العلاقة بين البيتين الأوّل والأخير", 1.5)])
q("q6", "6", P1, PARAS[15], 2, [el("q6-e1", "النّثر: تقنية النّثر", 1), el("q6-e2", "النّثر: سلامة اللّغة", 1)])
q("q7", "1", P2, PARAS[17], 1.5, [el("q7-e1", "ثلاث قرائن لغويّة مختلفة (3×0,5)", 1.5)])
q("q8", "2", P2, PARAS[18], 1.5, [el("q8-e1", "إعراب «لاهيًا»", 0.5), el("q8-e2", "إعراب جملة «شاخ الزّمان» (2×0,5)", 1)])
q("q9", "3", P2, PARAS[19], 1.5, [el("q9-e1", "استخراج الصّورة ونوعها", 0.5), el("q9-e2", "شرحها", 0.5), el("q9-e3", "أثرها البلاغيّ", 0.5)])
q("q10", "4", P2, PARAS[20], 1.5, [el("q10-e1", "التّقطيع العروضيّ", 0.5), el("q10-e2", "التّفعيلات", 0.5), el("q10-e3", "المتغيّرات الطّارئة", 0.5)])
q("q11", "1", P3, PARAS[23], 2, [el("q11-e1", "قيمة بارزة في النّصّ وتوضيحها", 2)])
q("q12", "2", P3, PARAS[24], 2, [el("q12-e1", "مظاهر التّجديد مع التّمثيل", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "يتوجّه الشّاعر بالكلام إلى الإنسان – ضيّق الأفق – الّذي يتذمّر من سعة الحياة، ويرمقها بنظرة الفقير المعدم."
st("s01", "q1", "q1-e1", "mcq", "لمن يتوجّه الشّاعر بالخطاب؟",
   {"options": ["إلى الإنسان ضيّق الأفق الّذي يتذمّر من سعة الحياة", "إلى الإنسان المتفائل الرّاضي بحياته", "إلى الطّبيعة الّتي يناجيها",
                "إلى حبيبته الغائبة"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "يتوجّه الشّاعر بالكلام إلى الإنسان الّذي يتذمّر من سعة الحياة، ويرمقها بنظرة ____ ____.", "bank": ["الفقير", "المعدم", "الغنيّ", "الرّاضي"]},
   {"blanks": [["الفقير"], ["المعدم"]]}, Q1_EXPL, 1, "ar.comprehension.details", "b")
Q2_EXPL = ("الدّافع إلى نظم هذه القصيدة هو واقع الكثيرين من النّاس الّذين ينظرون إلى الحياة نظرة سوداويّة ملؤها الإحباط والتّشاؤم، وهو من خلال "
           "هذه الأبيات يدعوهم إلى التّمتّع بالحياة، فكلّ ما فيها ملك للإنسان.")
st("s03", "q2", "q2-e1", "mcq", "ما الّذي دفع الشّاعر إلى نظم هذه القصيدة؟",
   {"options": ["واقع الكثيرين من النّاس الّذين ينظرون إلى الحياة نظرة سوداويّة ملؤها الإحباط والتّشاؤم", "رغبته في مدح أحد الأغنياء",
                "رثاء صديق عزيز فقده", "فخره بأمجاد قومه"]},
   {"correct": 0}, Q2_EXPL, 1, "ar.comprehension.purpose")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل:",
   {"text": "وهو من خلال هذه الأبيات يدعوهم إلى ____ بالحياة، فكلّ ما فيها ____ للإنسان.", "bank": ["التّمتّع", "ملك", "الزّهد", "عبء"]},
   {"blanks": [["التّمتّع"], ["ملك"]]}, Q2_EXPL, 1, "ar.comprehension.purpose", "b")
Q3_EXPL = ("وظّف الشّاعر كثيرًا ضمير المخاطب: تشتكي، أنت، لك، كنت، ترى… لأنّ التّأثير يكون أقوى عند مخاطبة الفرد، ودليل على حضوره، ويحقّق "
           "التّلاؤم بين الشّاعر والنّزعة الفرديّة، وهي خاصّيّة من خصائص المدرسة الرّومانسيّة.")
st("s05", "q3", "q3-e1", "multi", "لِمَ وظّف الشّاعر كثيرًا ضمير المخاطب؟ (اختر كلّ ما يصحّ)",
   {"options": ["لأنّ التّأثير يكون أقوى عند مخاطبة الفرد", "لأنّه دليل على حضور المخاطَب", "لأنّه يحقّق التّلاؤم بين الشّاعر والنّزعة الفرديّة",
                "لأنّه يخاطب جماعة غائبة", "لأنّه يفخر بنفسه أمام قومه"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 0.5, "ar.cohesion.reference")
st("s06", "q3", "q3-e1", "multi", "أيّ الكلمات الآتية من النّصّ فيها ضمير المخاطب؟ (اختر كلّ ما يصحّ)",
   {"options": ["تشتكي", "لك", "كنت", "ترى", "يهدم", "تكاد", "الزّمان"]},
   {"correct": [0, 1, 2, 3]}, Q3_EXPL, 0.5, "ar.cohesion.reference", "b")
Q4_EXPL = ("الشّاعر ذو نظرة تفاؤليّة إلى الحياة، فهو يدعو الإنسان المتبرّم من الحياة إلى التّأمّل في ما حوله؛ فكلّ الّذي يراه ملك له، من أرض، "
           "وسماء، ونجوم، وماء…")
st("s07", "q4", "q4-e1", "mcq", "أمتشائم هو أم متفائل؟",
   {"options": ["متفائل: ذو نظرة تفاؤليّة إلى الحياة", "متشائم: ذو نظرة سوداويّة إلى الحياة", "لا هذا ولا ذاك: لا يبالي بالحياة"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.emotion")
st("s08", "q4", "q4-e1", "fill_blank", "وضّح:",
   {"text": "فهو يدعو الإنسان المتبرّم من الحياة إلى ____ في ما حوله؛ فكلّ الّذي يراه ____ له.", "bank": ["التّأمّل", "ملك", "الهروب", "غريب"]},
   {"blanks": [["التّأمّل"], ["ملك"]]}, Q4_EXPL, 0.5, "ar.comprehension.explain", "b")
st("s09", "q4", "q4-e1", "multi", "ممّا يراه الإنسان ملكًا له كما يوضّح الشّاعر: (اختر كلّ ما يصحّ)",
   {"options": ["الأرض", "السّماء", "النّجوم", "الماء", "القصور", "الجاه", "الكنوز المدفونة"]},
   {"correct": [0, 1, 2, 3]}, Q4_EXPL, 0.5, "ar.comprehension.details", "c")
Q5_EXPL = ("العلاقة الّتي تربط بين البيت الأوّل والبيت الأخير هي: أنّ البيت الأخير هو نتيجة حتميّة لما قبله، فالإنسان القنوط، والمتبرّم من الحياة "
           "– رغم ما فيها من أنعم – إنسان لا يعيش الواقع، فهو كالّذي يحنّ إلى غد في يومه، وبهذا فهو يبيع حاضرًا بغائب، ويستبدل ما يملك بما لا يملك.")
st("s10", "q5", "q5-e1", "mcq", "ما العلاقة الّتي تربط بين البيتين الأوّل والأخير؟",
   {"options": ["البيت الأخير نتيجة حتميّة لما قبله", "البيت الأخير يناقض البيت الأوّل", "لا علاقة بينهما، فكلّ بيت مستقلّ بمعناه",
                "البيت الأخير تكرار لفظيّ للبيت الأوّل"]},
   {"correct": 0}, Q5_EXPL, 0.75, "ar.comprehension.link")
st("s11", "q5", "q5-e1", "fill_blank", "وضّح:",
   {"text": "فالإنسان القنوط المتبرّم من الحياة إنسان لا يعيش ____، فهو كالّذي يحنّ إلى غدٍ في يومه، وبهذا فهو يبيع ____ بغائب.",
    "bank": ["الواقع", "حاضرًا", "الخيال", "ماضيًا"]},
   {"blanks": [["الواقع"], ["حاضرًا", "حاضرا"]]}, Q5_EXPL, 0.75, "ar.comprehension.link", "b")
NTH_SPEC = {"task": "نثر الأبيات", "scope": "الأبيات من 1 إلى 5", "text": "قصيدة إيليا أبو ماضي «كم تشتكي» (بكالوريا 2008، آداب وفلسفة، الموضوع الأوّل)",
            "scheme": "نثر الأبيات: يراعي المترشّح تقنية النّثر وسلامة اللّغة (2×01)", "model_example": None}
NTH_EXPL = "نثر الأبيات: يراعي المترشّح تقنية النّثر (01) وسلامة اللّغة (01). لا تقدّم الإجابة النّموذجيّة نموذجًا للنّثر."
essay("s12", "q6", "q6-e1", "نثر الأبيات من 1 إلى 5", "تقنية النّثر", "تقنية النّثر", 1, NTH_SPEC, NTH_EXPL, "ar.writing.summary")
essay("s13", "q6", "q6-e2", "نثر الأبيات من 1 إلى 5", "سلامة اللّغة", "سلامة اللّغة", 1, NTH_SPEC, NTH_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
QR_EXPL = ("القرائن اللّغويّة الّتي اعتمدها الشّاعر في الرّبط بين الأبيات هي: حروف العطف، ودلالتها: العطف والجمع لإظهار تعدّد وكثرة النّعم – حروف "
           "الجرّ (اللاّم، من، في، إلى…) – الظّروف: فوق، قدّام، حول، بين – ضمير المخاطب: الّذي حقّق الرّبط بين الأبيات والمعاني – الأضداد: «يبني ≠ يهدم»، "
           "«تبسّمت ≠ لا تتبسّم»، «مضى ≠ يرجع»… تعتبر الإجابة كاملة إذا تضمّنت ثلاث قرائن مختلفة.")
st("s14", "q7", "q7-e1", "multi", "ما القرائن اللّغويّة الّتي اعتمدها الشّاعر في الرّبط بين الأبيات؟ (اختر كلّ ما يصحّ)",
   {"options": ["حروف العطف", "حروف الجرّ", "الظّروف", "ضمير المخاطب", "الأضداد", "أسماء الإشارة", "الاستثناء بـ«إلاّ»"]},
   {"correct": [0, 1, 2, 3, 4]}, QR_EXPL + " ولا أثر في النّصّ لأسماء الإشارة ولا للاستثناء بـ«إلاّ».", 0.75, "ar.cohesion.connectors")
st("s15", "q7", "q7-e1", "matching", "طابق كلّ قرينة بأمثلتها من النّصّ.",
   {"lefts": ["حروف الجرّ", "الظّروف", "الأضداد"],
    "rights": ["اللاّم، من، في، إلى", "فوق، حول، بين", "يبني ≠ يهدم، تبسّمت ≠ لا تتبسّم", "يا، أيا، هيا"]},
   {"pairs": [0, 1, 2]}, QR_EXPL, 0.75, "ar.cohesion.connectors", "b")
st("s16", "q8", "q8-e1", "mcq", "ما إعراب «لاهيًا» في قوله: «والجدول الجذلان يضحك لاهيًا»؟",
   {"options": ["حال منصوبة، وعلامة نصبها الفتحة الظّاهرة على آخرها", "مفعول به منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره",
                "خبر منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره", "نعت منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "لاهيًا: حال منصوبة، وعلامة نصبها الفتحة الظّاهرة على آخرها.", 0.5, "ar.grammar.irab")
SH_EXPL = "«شاخ الزّمان»: جملة فعليّة، واقعة مقول القول، في محلّ نصب مفعول به (بعد «فلا تقل»)."
st("s17", "q8", "q8-e2", "mcq", "ما نوع جملة «شاخ الزّمان»؟",
   {"options": ["جملة فعليّة", "جملة اسميّة", "شبه جملة"]},
   {"correct": 0}, SH_EXPL, 0.5, "ar.grammar.sentence_case")
st("s18", "q8", "q8-e2", "mcq", "ما محلّ جملة «شاخ الزّمان» من الإعراب في قوله: «فلا تقل: شاخ الزّمان»؟",
   {"options": ["واقعة مقول القول، في محلّ نصب مفعول به", "في محلّ رفع خبر", "في محلّ جرّ مضاف إليه", "صلة الموصول، لا محلّ لها من الإعراب"]},
   {"correct": 0}, SH_EXPL, 0.5, "ar.grammar.sentence_case", "b")
IMG_EXPL = ("«الماء حولك فضّة»: تشبيه بليغ – حُذفت فيه الأداة ووجه الشّبه، وتُرك المشبّه والمشبّه به – حيث شبّه الماء بالفضّة لاشتراكهما في الصّفاء. "
            "وكذلك في قوله: «الشّمس فوقك عسجد». وبلاغة هذه الصّورة البيانيّة الزّيادة في جمال المعنى وتقويته وتوضيحه.")
st("s19", "q9", "q9-e1", "mcq", "استخرج الصّورة البيانيّة من صدر البيت الثّالث، وحدّد نوعها:",
   {"options": ["«الماء حولك فضّة»: تشبيه بليغ", "«الماء حولك فضّة»: استعارة مكنيّة", "«الماء حولك فضّة»: استعارة تصريحيّة", "«حولك»: مجاز مرسل"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s20", "q9", "q9-e2", "matching", "اشرح الصّورة «الماء حولك فضّة»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به", "وجه الشّبه (محذوف)"], "rights": ["الماء", "الفضّة", "الصّفاء", "السّفوح"]},
   {"pairs": [0, 1, 2]}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s21", "q9", "q9-e3", "mcq", "ما الأثر البلاغيّ لهذه الصّورة؟",
   {"options": ["الزّيادة في جمال المعنى وتقويته وتوضيحه", "تقديم الحقيقة مصحوبة بالدّليل عليها", "إحداث جرس موسيقيّ في العبارة",
                "إبراز المعنى بذكر ضدّه"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")
PRO_EXPL = ("تقطيع البيت الأوّل في الإجابة النّموذجيّة: «كمْ تشتكي / وتقولُ إنْـ / ـنكَ مُعدَمُ // والأرضُ مِلْـ / ـكُكَ والسّما / والأنجُمُ» = "
            "/0/0//0 ///0//0 ///0//0 // /0/0//0 ///0//0 /0/0//0. التّفعيلة هي: مُتَفاعِلُنْ (ستّ مرّات). والتّغيير هو تسكين الثّاني المتحرّك: "
            "مُتَفاعِلُنْ صارت مُتْفاعِلُنْ (في التّفعيلات الأولى والرّابعة والسّادسة). (يطبع التّصحيح الرّموز بترتيب بصريّ من اليمين؛ كُتبت هنا من اليسار.)")
st("s22", "q10", "q10-e1", "mcq", "ما رموز صدر البيت الأوّل: «كم تشتكي / وتقول إنْـ / ـنك معدم»؟",
   {"options": ["/0/0//0 ///0//0 ///0//0", "///0//0 ///0//0 ///0//0", "/0/0//0 /0/0//0 ///0//0", "///0//0 /0/0//0 ///0//0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s23", "q10", "q10-e1", "mcq", "ما رموز عجز البيت الأوّل: «والأرض ملْـ / ـكك والسّما / والأنجم»؟",
   {"options": ["/0/0//0 ///0//0 /0/0//0", "///0//0 ///0//0 /0/0//0", "/0/0//0 /0/0//0 /0/0//0", "/0/0//0 ///0//0 ///0//0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s24", "q10", "q10-e2", "mcq", "ما تفعيلة البيت الأوّل؟",
   {"options": ["مُتَفاعِلُنْ (ستّ مرّات)", "فاعِلاتُنْ (ستّ مرّات)", "مَفاعِيلُنْ (أربع مرّات)", "فَعُولُنْ (ثماني مرّات)"]},
   {"correct": 0}, PRO_EXPL, 0.5, "ar.prosody")
st("s25", "q10", "q10-e3", "mcq", "ما التّغيير الطّارئ على التّفعيلة؟",
   {"options": ["تسكين الثّاني المتحرّك: مُتَفاعِلُنْ صارت مُتْفاعِلُنْ", "حذف الثّاني السّاكن", "حذف الرّابع السّاكن", "حذف السّبب الخفيف من آخر التّفعيلة"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s26", "q10", "q10-e3", "multi", "أيّ تفعيلات البيت طرأ عليها هذا التّغيير؟ (اختر كلّ ما يصحّ)",
   {"options": ["الأولى", "الثّانية", "الثّالثة", "الرّابعة", "الخامسة", "السّادسة"]},
   {"correct": [0, 3, 5]}, PRO_EXPL, 0.25, "ar.prosody", "b")
# ── ثالثًا: التّقويم النّقديّ ──
VAL_EXPL = ("قيم النّصّ: انطوى النّصّ على قيم متعدّدة منها: القيمة الإنسانيّة: مثل الدّعوة إلى التّفاؤل. أو: القيمة الفنّيّة وتتمثّل في أسلوب الكاتب "
            "المعتمد على: تشخيص الطّبيعة، الوحدة العضويّة، سهولة اللّفظ… الخ.")
st("s27", "q11", "q11-e1", "mcq", "اذكر قيمة إنسانيّة بارزة في النّصّ:",
   {"options": ["الدّعوة إلى التّفاؤل", "الدّعوة إلى الزّهد في الدّنيا", "الدّعوة إلى الجهاد", "الحنين إلى الماضي المجيد"]},
   {"correct": 0}, VAL_EXPL, 1, "ar.comprehension.values")
st("s28", "q11", "q11-e1", "multi", "وضّح القيمة الفنّيّة: علامَ يعتمد أسلوب الشّاعر في هذا النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["تشخيص الطّبيعة", "الوحدة العضويّة", "سهولة اللّفظ", "الغموض والرّمز", "تعدّد القوافي", "الإكثار من المحسّنات البديعيّة المتكلّفة"]},
   {"correct": [0, 1, 2]}, VAL_EXPL + " أمّا القصيدة فموحّدة القافية (الميم)، سهلة الألفاظ.", 1, "ar.literature.features", "b")
REN_EXPL = "جسّدت القصيدة مظاهر التّجديد في الشّعر العربيّ الحديث، ومنها: الاتّجاه الرّومانسيّ: البعد الإنسانيّ، تشخيص الطّبيعة… الخ."
st("s29", "q12", "q12-e1", "mcq", "إلى أيّ اتّجاه تنتمي مظاهر التّجديد الّتي جسّدتها القصيدة؟",
   {"options": ["الاتّجاه الرّومانسيّ", "الاتّجاه الإحيائيّ (المحافظ)", "الاتّجاه الرّمزيّ", "الاتّجاه الواقعيّ"]},
   {"correct": 0}, REN_EXPL, 0.5, "ar.literature.trend")
st("s30", "q12", "q12-e1", "multi", "اذكر مظاهر التّجديد: أيّ ممّا يلي منها في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["البعد الإنسانيّ", "تشخيص الطّبيعة", "الوقوف على الأطلال", "المديح والتّكسّب", "المعارضات الشّعريّة"]},
   {"correct": [0, 1]}, REN_EXPL, 0.75, "ar.literature.renewal", "b")
st("s31", "q12", "q12-e1", "mcq", "مثّل لتشخيص الطّبيعة من القصيدة:",
   {"options": ["«والجدول الجذلان يضحك لاهيًا … والنّرجس الولهان مغفٍ يحلم»", "«إن كنت مكتئبًا لعزٍّ قد مضى … هيهات يرجعه إليك تندّم»",
                "«أو كنت جاوزت الشّباب فلا تقل … شاخ الزّمان، فإنّه لا يهرم»", "«يا من يحنّ إلى غدٍ في يومه … قد بعت ما تدري بما لا تعلم»"]},
   {"correct": 0}, REN_EXPL + " (التّمثيل: الجدول «يضحك» والنّرجس «يحلم» — من إعداد التّحويل، إذ لا تذكر الإجابة النّموذجيّة مثالًا.)", 0.75,
   "ar.literature.renewal", "c")

TITLE = "بكالوريا 2008 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (إيليا أبو ماضي: كم تشتكي)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، شعبة آداب وفلسفة) في Drive صاحب المنصّة "
         "(ملفّ docx معنون خطأً «دورة 2018»، ومحتواه موضوع 2008)؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: «يضحّك» ← «يضحَك» (ب10). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1، صورة ممسوحة قُرئت مكبَّرة؛ "
         "رموز التّقطيع مكتوبة هنا من اليسار). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. مؤجَّل (essay_builder): نثر الأبيات 1–5 س6 (2×01).")
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
