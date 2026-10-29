"""Conversion: BAC 2010 (session عاديّة، جوان 2010) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (البوصيريّ، «وافاك بالذّنب العظيم المذنب»).
Exam (most faithful source): gdrive 1tSmkVykpy9bgNa5W_uqyx9ZH_LMOE5Ol (بكالوريا العربية 2010 شعبة آداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 12tEe6aM2c6DCvHEIAmAz46OqiNur6yEv (بكالوريا العربية 2010 شعبة آداب وفلسفة.pdf);
official ONEC paper: gdrive 1BRXPDxrrapBoE3sVN-euYLi-LPGvUpSr (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1EaBUuqauL2Kltkr-OctmAM7yR7_5fh55 (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2010_sci_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx (paragraph and
cell text read exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by script;
every verbatim string of the JSON was re-checked programmatically against the docx (only the documented fixes differ). The
docx was compared verse by verse and question by question with the official ONEC paper (scanned, native 1555×2280 px page
images, crops enlarged up to ×3). The correction is a scanned PDF read from the page images. Every mark comes from the
official scheme; correct options and explanations condense its wording.

Docx vs ONEC paper:
- Poem: the same fourteen verses in the same order; the docx table stores each verse as [عجز, (empty), «n-صدر»] with a
  correct 1–14 numbering (the ONEC paper does not number the verses) ⇒ rows written [n-, صدر, عجز].
- Defects fixed from the ONEC paper (each asserted to occur once): verse 3 «في نعمــــــاتـه» ⇒ «نعمــــــائـه» (ت for ئ;
  ONEC «في نعمائه»); verse 11 a line break inside the صدر («فضلـــــه\n فبحـــاره») removed; verse 14 the word «رحلتي»
  repeated on an extra line of the cell («في رحلتي\n رحلتي») removed.
- Part 3: the docx splits the question over two lines (paragraphs 22–23) ⇒ joined with a space.
- Other differences are diacritics / spelling / labels only (docx kept): «أوّلا- البناء الفكري: (10 نقاط)» (ONEC «البناء
  الفكريّ: (10نقاط)»), «ثالثا- التّقويم النقدي» (ONEC «التّقويم النّقديّ للنّصّ»), «أنثر» (ONEC «أنثُر»)…
- Underlined on both: «لولا جهلُه» (ب2) and «إذْ» (ب3) — the targets of Part 2 Q1, named in the step prompts.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «آداب وفلسفة» ⇒ LIT.
- «n×m» rule (as in the 2011–2023 converters): exactly the listed distinct items, or the distinct demands of the question ⇒
  one element per item; interchangeable items (more listed, or «من…» / «…») ⇒ one element; one word's i'rab ⇒ one element.
- Q1 «2×1» = the confession of his sins / his self-reproach and shame. Q2 «2×0.75» for the one field «الغفلة والغواية»
  ⇒ one element of 1.5 (its two terms are not separate answers). Q3 «3 × 2×0.25» (limits + title of each unit) ⇒ two
  elements by demand, the division (0.75) and the titles (0.75), as in build_ar_bac_2011_sci_p1.py. Q4 «2×0.5» = the two
  emotions. Q5 (نثر الأبيات 8–12) «2×1» = المضمون / أسلوب المترشّح ⇒ two deferred essay_builder elements. Q6 «0.5 + 3×0.5»
  = الوصفيّ + exactly the three indicators listed (no «السّرديّ» distractor for the type).
- Part 2: Q1 «لولا» 2×0.25, «جهل» 2×0.25, «الهاء» 0.25, «إذْ» 2×0.25 (no «تعليل» reading offered for «إذ»). Q2 0.75.
  Q3 «2×0.25» = the form / its pattern; the scheme gives «خلائق … أو عوالم» «على وزن مفاعل» — the text also has «معاصي،
  المنايا، مذاهبه» (also صيغ منتهى الجموع), so these are not used as distractors, nor «فعائل / فواعل» for the pattern.
  Q4 «0.25 + 0.5 + 0.25» = «ردْ واقتبس» / إنشائيّ بصيغة الأمر / التّرغيب والنّصح. Q5 per image «3×0.25» = extraction /
  explanation / effect; for the second image the scheme gives only the extraction («شموسه ما تغرب» أو «بحاره ما تنتهي»)
  and the type («وكلتاهما استعارة تصريحيّة») ⇒ its explanation step asks for the type only and its effect (0.25) is
  deferred (essay_builder, no model answer in the scheme). Q6 0.5.
- Part 3 «3×0.5 + 2×0.5 + 3×0.5» = exactly the three reasons listed (one element each) + two features among those listed
  («من خصائص…» ⇒ one element) + exactly the three statements on al-Būṣīrī's standing (one element each).
- Deferred (essay_builder): Q5 نثر (1 + 1) + the effect of the second image (0.25) = 2.25 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2010-lit-p1"
PAPER = 1
STREAMS = ["LIT"]
DOCX_ID = "1tSmkVykpy9bgNa5W_uqyx9ZH_LMOE5Ol"
DOCX_TITLE = "بكالوريا العربية 2010 شعبة آداب وفلسفة.docx"
PDF_ID = "12tEe6aM2c6DCvHEIAmAz46OqiNur6yEv"
OFFICIAL_ID = "1BRXPDxrrapBoE3sVN-euYLi-LPGvUpSr"
CORR_ID = "1EaBUuqauL2Kltkr-OctmAM7yR7_5fh55"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
# الجدول 0 في docx: صفوف [العجز، خليّة فارغة، «رقم-الصّدر»]
# @@BEGIN-GENERATED@@
PARAS = {
    3: '-البوصيريّ -',
    5: 'الأسئلة:',
    6: 'أوّلا- البناء الفكري: (10 نقاط)',
    7: 'بِمَ يعترف الشاعر في البيت الأوّل؟',
    8: 'حدّد المجال الدلاليّ للكلمات الآتية: (جهل - ذنب -\u200f يخوض - يلعب).',
    9: 'قسم النّص إلى وحداته الفكريّة ثم ضَعْ عنوانًا مناسبا لكلّ وحدة.',
    10: 'في النّصّ عاطفتان متباينتان، وضّحهما.',
    11: 'أنثر الأبيات من 08 إلى 12.',
    12: 'ما النّمط الغالب في القصيدة؟ علّل حكمك.',
    13: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    14: 'أعرب ما تحته خط.',
    15: 'ما دلالة الأفعال الماضية في انسجام النصّ؟',
    16: 'استخرج صيغة منتهى الجُموع محدّدًا وزنها.',
    17: 'ما نوع الأسلوب في صدر البيت الحادي عشر وما غرضه البلاغي؟',
    18: 'في البيت الحادي عشر صورتان بيانيّتان، استخرجهما مع شرحهما محدّدا بلاغتهما.',
    19: 'ما علاقة البيت الأول بالأخير؟',
    20: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    22: 'لماذا شاعت المدائح النبويّة في عصر الشاعر؟ ما هي خصائصها الفنّية؟ وما منزلة',
    23: 'البوصيري في عصره؟',
}
POEM_RAW = [
    ['خجــــــلاً يُعنـــــف نفســـــه ويُؤَنــــــبُ', '', '1-وافــــاك بالذّنـب العـــظيـم المُذنـب'],
    ['ما كـــان في الدُّنيـا يخوض ويَلعبُ', '', '2-لَعِبــــت به الدنيـــا ولولا جهلــه'],
    ['إذْ بـــــات في نعمــــــاتـه يتقلَّــــبُ', '', '3-لزِم التَّقلــب في معــــاصي ربـِّهِ'],
    ['شرهـــــا علـى أمثالـهـــــا يتوثــــــــبُ', '', '4-يستغفــرُ الله الذنــــوبَ وقلبُـــه'],
    ['فكــأن معـترك المنـايــــا مَلعـــــبُ', '', '5-أضحى بمـعتركِ المنايــا لاهـيًــا'],
    ['إلاَّ إلى حـــرَمٍ بطيبـــة مَـــهـرَبُ', '', '6-ضــاقت مذاهبــه علــيه فمالــــه'],
    ['فكــــــأنــــــه بذنوبــــــــــه يتقــــــــرَّب', '', '7-وقَفَــــــتْ بجــاه المصطفى آمالُـــــهُ'],
    ['مقــداره إلـى القلــــوب محبّـــــــب', '', '8-بشر سعيدٌ في النفــــوس معظّـــمٌ'],
    ['وبيــان منطقــه تشرف يعـــــــرب', '', '9-بجمـــال صـــورتـه تمـــدّح آدم'],
    ['ولفضلـه فضل الخلائـق ينســـب', '', '10-مصبـــاح كل فضيلــة وإمـــامــها'],
    ['ما تنتـهي وشموسه ما تغــــــــرب', '', '11-رِدْ واقـــــتــبـس من فضلـــــه\n فبحـــاره'],
    ['في الوجـــــــــود منـــــــــوّر مطيّـــــــب', '', '12-ملأ العوالــــــــم علمــــــه وثنــــــاؤه'],
    ['في القلب تحــدُو بي إليه وتجـــذُب', '', '13-أشتـــــاق إلى الحــرم الشريف بِلوْعَة'],
    ['زاد ولا غير اشتيـــــــــــاق مركــــــــب', '', '14-مـــا لي ســوى ذكرى لــه في رحلتي\n رحلتي'],
]
# @@END-GENERATED@@


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


def _fix_re(s, pattern, repl):
    out, n = re.subn(pattern, repl, s)
    assert n == 1, (pattern, s[:40])
    return out


POEM = []
for _n, (_ajz, _mid, _right) in enumerate(POEM_RAW, 1):
    _m = re.match(r"^(\d+)-\s*", _right)
    assert _m and int(_m.group(1)) == _n and not _mid, _right
    _sadr = _right[_m.end():]
    if _n == 3:
        _ajz = _fix_re(_ajz, r"(نعم)(ـ*)ا(ت)(ـ*ه)", r"\1\2ائ\4")  # «نعماته» ← «نعمائه» (الموضوع الرّسميّ)
    if _n == 11:
        _sadr = _fix(_sadr, "\n", "")
    if _n == 14:
        _sadr = _fix(_sadr, "\n رحلتي", "")
    assert "\n" not in _sadr and "\n" not in _ajz, _n
    POEM.append([f"{_n}-", _sadr, _ajz])
assert len(POEM) == 14

DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[3]},
]
P1, P2, P3 = PARAS[6], PARAS[13], PARAS[20]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")


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


q("q1", "1", P1, PARAS[7], 2, [el("q1-e1", "اعتراف الشّاعر بذنوبه", 1), el("q1-e2", "تأنيب نفسه وخجله منها", 1)])
q("q2", "2", P1, PARAS[8], 1.5, [el("q2-e1", "المجال الدّلاليّ (2×0.75)", 1.5)])
q("q3", "3", P1, PARAS[9], 1.5, [el("q3-e1", "تقسيم النّصّ إلى وحداته الفكريّة (3×0.25)", 0.75), el("q3-e2", "عناوين الوحدات (3×0.25)", 0.75)])
q("q4", "4", P1, PARAS[10], 1, [el("q4-e1", "العاطفة الأولى", 0.5), el("q4-e2", "العاطفة الثّانية", 0.5)])
q("q5", "5", P1, PARAS[11], 2, [el("q5-e1", "نثر الأبيات 8–12: المضمون", 1), el("q5-e2", "نثر الأبيات 8–12: أسلوب المترشّح", 1)])
q("q6", "6", P1, PARAS[12], 2, [el("q6-e1", "النّمط الغالب", 0.5), el("q6-e2", "التّعليل: كثرة الأوصاف والنّعوت", 0.5),
                                el("q6-e3", "التّعليل: كثرة الصّور البيانيّة", 0.5), el("q6-e4", "التّعليل: كثرة الأفعال المضارعة", 0.5)])
q("q7", "1", P2, PARAS[14], 1.75, [el("q7-e1", "إعراب «لولا» (ب2)", 0.5), el("q7-e2", "إعراب «جهل» (ب2)", 0.5), el("q7-e3", "إعراب الهاء في «جهله»", 0.25),
                                   el("q7-e4", "إعراب «إذْ» (ب3)", 0.5)])
q("q8", "2", P2, PARAS[15], 0.75, [el("q8-e1", "دلالة الأفعال الماضية", 0.75)])
q("q9", "3", P2, PARAS[16], 0.5, [el("q9-e1", "استخراج صيغة منتهى الجموع", 0.25), el("q9-e2", "وزنها", 0.25)])
q("q10", "4", P2, PARAS[17], 1, [el("q10-e1", "الأسلوب في صدر البيت 11", 0.25), el("q10-e2", "نوعه", 0.5), el("q10-e3", "غرضه البلاغيّ", 0.25)])
q("q11", "5", P2, PARAS[18], 1.5, [el("q11-e1", "الصّورة الأولى: استخراجها", 0.25), el("q11-e2", "الصّورة الأولى: شرحها", 0.25),
                                   el("q11-e3", "الصّورة الأولى: بلاغتها", 0.25), el("q11-e4", "الصّورة الثّانية: استخراجها", 0.25),
                                   el("q11-e5", "الصّورة الثّانية: شرحها (نوعها)", 0.25), el("q11-e6", "الصّورة الثّانية: بلاغتها", 0.25)])
q("q12", "6", P2, PARAS[19], 0.5, [el("q12-e1", "علاقة البيت الأوّل بالأخير", 0.5)])
q("q13", "التّعليمة", P3, PARAS[22] + " " + PARAS[23], 4,
  [el("q13-e1", "سبب الشّيوع: تردّي الأحوال السّياسيّة", 0.5), el("q13-e2", "سبب الشّيوع: ردّ فعل عن تيّار الفساد الأخلاقيّ", 0.5),
   el("q13-e3", "سبب الشّيوع: وسيلة للإصلاح والوعظ", 0.5), el("q13-e4", "خصائص المدائح الفنّيّة (2×0.5)", 1),
   el("q13-e5", "منزلة البوصيريّ: من مشاهير شعراء المدائح", 0.5), el("q13-e6", "منزلته: اشتهر بالبردة", 0.5),
   el("q13-e7", "منزلته: مرجع المتعبّد وطالب القدوة", 0.5)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "يعترف الشّاعر في البيت الأوّل بذنوبه (1)، وتأنيب نفسه وخجله منها (1)."
st("s01", "q1", "q1-e1", "mcq", "بمَ يعترف الشّاعر في البيت الأوّل؟",
   {"options": ["بذنوبه", "بفضل الدّنيا عليه", "بعجزه عن قول الشّعر", "بحنينه إلى أهله"]}, {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل ما يعترف به الشّاعر أيضًا في البيت الأوّل:",
   {"text": "____ نفسه و____ منها.", "bank": ["تأنيب", "خجله", "مدح", "فخره"]},
   {"blanks": [["تأنيب"], ["خجله"]]}, Q1_EXPL, 1, "ar.comprehension.details")
FIELD_EXPL = "المجال الدّلاليّ للكلمات (جهل – ذنب – يخوض – يلعب): «الغفلة والغواية» (2×0.75)."
st("s03", "q2", "q2-e1", "mcq", "حدّد المجال الدّلاليّ للكلمات: (جهل – ذنب – يخوض – يلعب).",
   {"options": ["الغفلة والغواية", "التّوبة والاستغفار", "المدح والثّناء", "الشّوق والحنين"]}, {"correct": 0}, FIELD_EXPL, 0.75, "ar.cohesion.effect")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل المجال الدّلاليّ:",
   {"text": "____ و____", "bank": ["الغفلة", "الغواية", "الهداية", "اليقظة"]},
   {"blanks": [["الغفلة"], ["الغواية"]]}, FIELD_EXPL, 0.75, "ar.cohesion.effect", "b")
UNITS_EXPL = ("تقسيم النّصّ إلى وحداته الفكريّة وعنونتها: [1–6] إقرار بالذّنب وندم عليه؛ [7–12] مدح الرّسول صلّى الله عليه وسلّم؛ "
              "[13–14] شوق الشّاعر إلى الحرم الشّريف (لكلّ وحدة 2×0.25).")
st("s05", "q3", "q3-e1", "mcq", "كيف يُقسَّم النّصّ إلى وحداته الفكريّة؟",
   {"options": ["[1–6]، [7–12]، [13–14]", "[1–4]، [5–10]، [11–14]", "[1–7]، [8–11]، [12–14]", "[1–3]، [4–12]، [13–14]"]},
   {"correct": 0}, UNITS_EXPL, 0.75, "ar.comprehension.idea")
st("s06", "q3", "q3-e2", "matching", "ضع عنوانًا مناسبًا لكلّ وحدة: طابق كلّ وحدة بعنوانها.",
   {"lefts": ["الأبيات [1–6]", "الأبيات [7–12]", "الأبيات [13–14]"],
    "rights": ["إقرار بالذّنب وندم عليه", "مدح الرّسول صلّى الله عليه وسلّم", "شوق الشّاعر إلى الحرم الشّريف", "رثاء الصّحابة"]},
   {"pairs": [0, 1, 2]}, UNITS_EXPL, 0.75, "ar.writing.title")
EMO_EXPL = "في النّصّ عاطفتان متباينتان هما: الشّعور بالذّنب والنّدم؛ الحبّ والإعجاب وإجلال النّبيّ صلّى الله عليه وسلّم (2×0.5)."
st("s07", "q4", "q4-e1", "mcq", "في النّصّ عاطفتان متباينتان. ما العاطفة الّتي تسود مطلع القصيدة؟",
   {"options": ["الشّعور بالذّنب والنّدم", "الفخر والاعتزاز", "الحنين إلى الوطن", "السّخط على الدّهر"]}, {"correct": 0}, EMO_EXPL, 0.5, "ar.comprehension.emotion")
st("s08", "q4", "q4-e2", "mcq", "وما العاطفة الثّانية المباينة لها؟",
   {"options": ["الحبّ والإعجاب وإجلال النّبيّ صلّى الله عليه وسلّم", "الغضب والنّقمة", "اليأس والقنوط", "الحسرة على الشّباب"]},
   {"correct": 0}, EMO_EXPL, 0.5, "ar.comprehension.emotion")
NATHR_SPEC = {"task": "نثر الأبيات من 08 إلى 12", "text": "قصيدة البوصيريّ (بكالوريا 2010، آداب وفلسفة، الموضوع الأوّل)",
              "scheme": "«تراعى تقنية النّثر (المضمون + أسلوب المترشّح)» 2×1", "model_example": None}
NATHR_EXPL = "نثر الأبيات من 8 إلى 12: تراعى تقنية النّثر (المضمون 1 + أسلوب المترشّح 1). لا يقدّم التّصحيح نموذجًا."
essay("s09", "q5", "q5-e1", "نثر الأبيات 8–12 من قصيدة البوصيريّ", "المضمون", "الوفاء بمضمون الأبيات 8–12", 1, NATHR_SPEC, NATHR_EXPL, "ar.writing.forms")
essay("s10", "q5", "q5-e2", "نثر الأبيات 8–12 من قصيدة البوصيريّ", "أسلوب المترشّح", "أسلوب المترشّح في النّثر", 1, NATHR_SPEC, NATHR_EXPL, "ar.writing.forms")
TYPE_EXPL = ("النّمط الغالب على النّصّ: الوصفيّ (0.5). التّعليل: كثرة الأوصاف والنّعوت (العظيم – يتقلّب – يتوثّب)؛ كثرة الصّور البيانيّة "
             "(يعنّف نفسه – لعبت به الدّنيا)؛ كثرة الأفعال المضارعة (يلعب – يؤنّب – يتوثّب) (3×0.5).")
st("s11", "q6", "q6-e1", "mcq", "ما النّمط الغالب في القصيدة؟",
   {"options": ["الوصفيّ", "الحجاجيّ", "الحواريّ", "التّفسيريّ"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s12", "q6", "q6-e2", "fill_blank", "علّل حكمك: أكمل المؤشّر الأوّل.",
   {"text": "كثرة ____ و____ (العظيم – يتقلّب – يتوثّب).", "bank": ["الأوصاف", "النّعوت", "الحوار", "الأرقام"]},
   {"blanks": [["الأوصاف"], ["النّعوت"]]}, TYPE_EXPL, 0.5, "ar.text.type")
st("s13", "q6", "q6-e3", "mcq", "«يعنّف نفسه»، «لعبت به الدّنيا»: أيّ مؤشّر من مؤشّرات النّمط الوصفيّ تمثّله هاتان العبارتان؟",
   {"options": ["كثرة الصّور البيانيّة", "كثرة الحوار", "كثرة الأرقام والإحصاءات", "كثرة أدوات الرّبط المنطقيّ"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s14", "q6", "q6-e4", "mcq", "«يلعب – يؤنّب – يتوثّب»: أيّ مؤشّر من مؤشّرات النّمط الوصفيّ تمثّله هذه الألفاظ؟",
   {"options": ["كثرة الأفعال المضارعة", "كثرة الأفعال الماضية", "كثرة أفعال الأمر", "كثرة المصادر"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
# ── ثانيًا: البناء اللّغويّ ──
st("s15", "q7", "q7-e1", "mcq", "ما إعراب «لولا» (ما تحته خطّ) في قوله: «ولولا جهلُه ما كان في الدّنيا يخوض ويلعب»؟",
   {"options": ["حرف امتناع لوجود مبنيّ على السّكون لا عمل له", "حرف امتناع لامتناع مبنيّ على السّكون لا عمل له",
                "حرف تحضيض مبنيّ على السّكون لا محلّ له من الإعراب", "اسم شرط جازم مبنيّ على السّكون"]},
   {"correct": 0}, "لولا: حرف امتناع لوجود مبنيّ على السّكون لا عمل له (2×0.25).", 0.5, "ar.grammar.irab")
st("s16", "q7", "q7-e2", "mcq", "ما إعراب «جهل» من «جهلُه» (ما تحته خطّ) في البيت الثّاني؟",
   {"options": ["مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة، وهو مضاف", "خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة، وهو مضاف",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة، وهو مضاف", "نائب فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة، وهو مضاف"]},
   {"correct": 0}, "جهل: مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة وهو مضاف (2×0.25).", 0.5, "ar.grammar.irab")
st("s17", "q7", "q7-e3", "fill_blank", "أكمل إعراب الهاء في «جهله»:",
   {"text": "الهاء: ضمير متّصل مبنيّ في محلّ ____ مضاف إليه.", "bank": ["جرّ", "نصب", "رفع"]},
   {"blanks": [["جرّ"]]}, "الهاء: ضمير متّصل مبنيّ في محلّ جرّ مضاف إليه (0.25).", 0.25, "ar.grammar.irab")
st("s18", "q7", "q7-e4", "mcq", "ما إعراب «إذْ» (ما تحته خطّ) في قوله: «إذْ بات في نعمائه يتقلّب»؟",
   {"options": ["ظرفيّة زمانيّة مبنيّة على السّكون في محلّ نصب، وهي مضاف", "ظرف لما يستقبل من الزّمان مبنيّ على السّكون في محلّ نصب، وهو مضاف",
                "حرف مفاجأة مبنيّ على السّكون لا محلّ له من الإعراب", "ظرف مكان مبنيّ على السّكون في محلّ نصب"]},
   {"correct": 0}, "إذْ: ظرفيّة زمانيّة مبنيّة على السّكون في محلّ نصب وهي مضاف (2×0.25).", 0.5, "ar.grammar.irab")
st("s19", "q8", "q8-e1", "mcq", "ما دلالة الأفعال الماضية في انسجام النّصّ؟",
   {"options": ["صوّرت حالة الشّاعر قبل التّوبة", "صوّرت أمل الشّاعر في المستقبل", "عبّرت عن شوق الشّاعر الحاضر إلى الحرم",
                "دلّت على استمرار الشّاعر في المعاصي إلى اليوم"]},
   {"correct": 0}, "دلالة الأفعال الماضية: صوّرت حالة الشّاعر قبل التّوبة.", 0.75, "ar.cohesion.effect")
PL_EXPL = ("صيغة منتهى الجموع: خلائق على وزن مفاعل أو عوالم على وزن مفاعل (2×0.25). "
           "(في النّصّ صيغ أخرى لم يذكرها الحلّ، مثل «معاصي، المنايا، مذاهبه»، فلم تُجعل مشتّتات.)")
st("s20", "q9", "q9-e1", "mcq", "أيّ هذه الألفاظ من النّصّ صيغة منتهى الجموع؟",
   {"options": ["خلائق", "الذّنوب", "آمال", "النّفوس"]}, {"correct": 0}, PL_EXPL, 0.25, "ar.morphology")
st("s21", "q9", "q9-e2", "mcq", "على أيّ وزن جاءت «خلائق» كما في الحلّ؟",
   {"options": ["مفاعل", "أفعال", "فُعول", "مفاعيل"]}, {"correct": 0}, PL_EXPL, 0.25, "ar.morphology")
STY_EXPL = "نوع الأسلوب في صدر البيت 11: «ردْ واقتبس» (0.25): أسلوب إنشائيّ بصيغة الأمر (0.5)، غرضه التّرغيب والنّصح (0.25)."
st("s22", "q10", "q10-e1", "mcq", "ما العبارة الّتي تحمل الأسلوب الإنشائيّ في صدر البيت الحادي عشر؟",
   {"options": ["«ردْ واقتبس»", "«من فضله»", "«فبحاره»"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
st("s23", "q10", "q10-e2", "mcq", "ما نوع الأسلوب في «ردْ واقتبس»؟",
   {"options": ["أسلوب إنشائيّ بصيغة الأمر", "أسلوب إنشائيّ بصيغة النّهي", "أسلوب خبريّ", "أسلوب إنشائيّ بصيغة الاستفهام"]},
   {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.insha")
st("s24", "q10", "q10-e3", "mcq", "وما غرضه البلاغيّ؟",
   {"options": ["التّرغيب والنّصح", "التّعجيز", "التّهديد والوعيد", "التّحقير"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
IMG1_EXPL = ("الصّورة الأولى: (اقتبس من فضله). شرحها: شبّه الفضل وهو شيء معنويّ بالنّار وهي شيء مادّيّ، حذف المشبّه به وأشار إليه بأحد لوازمه (اقتبس) "
             "على سبيل الاستعارة المكنيّة. بلاغتها: جسّدت سعة فضل الرّسول صلّى الله عليه وسلّم (3×0.25).")
st("s25", "q11", "q11-e1", "mcq", "ما الصّورة البيانيّة الأولى في البيت الحادي عشر؟",
   {"options": ["«اقتبس من فضله»", "«ملأ العوالم علمه»", "«مصباح كلّ فضيلة»"]}, {"correct": 0},
   IMG1_EXPL + " أمّا «ملأ العوالم علمه» و«مصباح كلّ فضيلة» ففي البيتين 12 و10.", 0.25, "ar.rhetoric.metaphor")
st("s26", "q11", "q11-e2", "fill_blank", "اشرح الصّورة الأولى:",
   {"text": "شبّه ____ وهو شيء معنويّ بـ____ وهي شيء مادّيّ، حذف المشبّه به وأشار إليه بأحد لوازمه (اقتبس) على سبيل الاستعارة المكنيّة.",
    "bank": ["الفضل", "النّار", "الدّنيا", "الذّنب"]},
   {"blanks": [["الفضل"], ["النّار"]]}, IMG1_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s27", "q11", "q11-e3", "mcq", "ما بلاغة الصّورة الأولى؟",
   {"options": ["جسّدت سعة فضل الرّسول صلّى الله عليه وسلّم", "أكّدت ضعف الشّاعر وعجزه", "أحدثت جرسًا موسيقيًّا", "قرّرت حقيقة تاريخيّة"]},
   {"correct": 0}, IMG1_EXPL, 0.25, "ar.rhetoric.effect")
IMG2_EXPL = ("الصّورة الثّانية: (شموسه ما تغرب) أو (بحاره ما تنتهي)، وكلتاهما استعارة تصريحيّة (3×0.25). "
             "لا يذكر التّصحيح شرحها ولا بلاغتها بأكثر من ذلك.")
st("s28", "q11", "q11-e4", "mcq", "ما الصّورة البيانيّة الثّانية في البيت الحادي عشر؟",
   {"options": ["«بحاره ما تنتهي» أو «شموسه ما تغرب»", "«بجمال صورته تمدّح آدم»", "«في القلب تحدو بي إليه وتجذب»"]},
   {"correct": 0}, IMG2_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s29", "q11", "q11-e5", "mcq", "ما نوع الصّورة في «بحاره ما تنتهي» و«شموسه ما تغرب»؟",
   {"options": ["استعارة تصريحيّة", "استعارة مكنيّة", "تشبيه بليغ", "كناية عن صفة"]}, {"correct": 0}, IMG2_EXPL, 0.25, "ar.rhetoric.metaphor")
essay("s30", "q11", "q11-e6", "بلاغة الصّورة الثّانية في البيت الحادي عشر («بحاره ما تنتهي» / «شموسه ما تغرب»)", "البلاغة",
      "تحديد بلاغة الصّورة الثّانية (لا يقدّم التّصحيح نموذجًا لها)", 0.25,
      {"task": "تحديد بلاغة الاستعارة التّصريحيّة", "question": PARAS[18], "scheme": "3×0.25 للصّورة الثّانية؛ الحلّ يذكر الاستخراج والنّوع فقط"},
      IMG2_EXPL, "ar.rhetoric.effect")
st("s31", "q12", "q12-e1", "mcq", "ما علاقة البيت الأوّل بالأخير؟",
   {"options": ["علاقة تكامليّة: البيت الأخير يكمّل البيت الأوّل", "علاقة تضادّ وتناقض", "علاقة ترادف: البيت الأخير يكرّر معنى الأوّل بلفظ آخر",
                "لا علاقة بينهما"]},
   {"correct": 0}, "علاقة البيت الأوّل بالأخير علاقة تكامليّة، فالبيت الأخير يكمّل البيت الأوّل.", 0.5, "ar.cohesion.effect")
# ── ثالثًا: التّقويم النّقديّ ──
WHY_EXPL = ("شاعت المدائح النّبويّة في عصر الشّاعر أي عصر الضّعف لـ: تردّي أحوال المجتمع السّياسيّة؛ ردّ فعل عن تيّار الفساد الأخلاقيّ؛ "
            "اتّخذ الشّعراء المدائح وسيلة للإصلاح والوعظ (3×0.5).")
st("s32", "q13", "q13-e1", "mcq", "من أسباب شيوع المدائح النّبويّة في عصر الشّاعر (عصر الضّعف):",
   {"options": ["تردّي أحوال المجتمع السّياسيّة", "ازدهار الحياة السّياسيّة واستقرارها", "رعاية الحكّام للشّعر الغزليّ", "انتشار الطّباعة والصّحافة"]},
   {"correct": 0}, WHY_EXPL, 0.5, "ar.literature.context")
st("s33", "q13", "q13-e2", "mcq", "ومن أسباب شيوعها أيضًا أنّها كانت ردّ فعل عن…",
   {"options": ["تيّار الفساد الأخلاقيّ", "تيّار التّجديد في الشّعر", "انتشار فنّ المسرح", "ازدهار شعر الحماسة"]}, {"correct": 0}, WHY_EXPL, 0.5, "ar.literature.context")
st("s34", "q13", "q13-e3", "fill_blank", "أكمل سببًا آخر:",
   {"text": "اتّخذ الشّعراء المدائح وسيلة لـ____ و____.", "bank": ["الإصلاح", "الوعظ", "اللّهو", "الهجاء"]},
   {"blanks": [["الإصلاح"], ["الوعظ"]]}, WHY_EXPL, 0.5, "ar.literature.context")
FEAT_EXPL = "من خصائص المدائح الفنّيّة في هذا العصر: الإكثار من المحسّنات البديعيّة (الزّخرفة) والتّقليد والاقتباس (2×0.5)."
st("s35", "q13", "q13-e4", "multi", "ما خصائص المدائح النّبويّة الفنّيّة في عصر الشّاعر؟ (اختر كلّ ما يصحّ)",
   {"options": ["الإكثار من المحسّنات البديعيّة (الزّخرفة)", "التّقليد", "الاقتباس", "التّحرّر من الوزن والقافية", "اعتماد شعر التّفعيلة",
                "توظيف الأساطير الإغريقيّة"]},
   {"correct": [0, 1, 2]}, FEAT_EXPL, 1, "ar.literature.features")
RANK_EXPL = ("منزلة الشّاعر: هو من مشاهير شعراء المدائح؛ اشتهر أكثر بقصيدته (البردة) الّتي ترجمت إلى عدّة لغات؛ صارت بمثابة المرجع الّذي يعود إليه "
             "المتعبّد وطالب القدوة (3×0.5).")
st("s36", "q13", "q13-e5", "mcq", "ما منزلة البوصيريّ في عصره؟",
   {"options": ["هو من مشاهير شعراء المدائح", "هو من شعراء الغزل الماجن", "هو شاعر مغمور لم يعرفه معاصروه", "هو من روّاد الشّعر الحرّ"]},
   {"correct": 0}, RANK_EXPL, 0.5, "ar.literature.context")
st("s37", "q13", "q13-e6", "fill_blank", "أكمل:",
   {"text": "اشتهر البوصيريّ أكثر بقصيدته (____) الّتي تُرجمت إلى عدّة ____.", "bank": ["البردة", "لغات", "المعلّقة", "مدن"]},
   {"blanks": [["البردة"], ["لغات"]]}, RANK_EXPL, 0.5, "ar.literature.context")
st("s38", "q13", "q13-e7", "mcq", "وإلامَ صارت قصيدته؟",
   {"options": ["بمثابة المرجع الّذي يعود إليه المتعبّد وطالب القدوة", "نصًّا منسيًّا لا يُروى", "مثالًا لشعر الهجاء", "أنشودة للمجالس اللّاهية"]},
   {"correct": 0}, RANK_EXPL, 0.5, "ar.literature.context")

TITLE = "بكالوريا 2010 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (البوصيريّ: وافاك بالذّنب العظيم المذنب)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2010، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: «نعماته» ← «نعمائه» (ب3)، وحُذف سطر زائد داخل صدر البيت 11 وكلمة «رحلتي» المكرّرة في خليّة البيت 14. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، صورة ممسوحة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): نثر الأبيات 8–12 (المضمون 1 + أسلوب المترشّح 1)، وبلاغة الصّورة الثّانية في البيت 11 (0.25) لأنّ الحلّ لا يذكرها.")
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
    for qq in Q:
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for d in qq["documents"]:
            assert d.get("text") or d.get("table"), (qq["id"], d["id"])
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
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
        "kind": "BAC", "year": 2010, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
