"""Conversion: BAC 2010 (session عاديّة، جوان 2010) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (إيليا أبو ماضي، «أنت للأرض أوّلا وأخيرا»).
Exam (most faithful source): gdrive 1fWdlC6P2Ot_NvyVugoPqTHE-blwHVist (بكالوريا العربية 2010 شعبة اللغات.docx);
same paper as PDF (owner's copy): gdrive 1RSOaz8wWGXoTp7-FRrsTeplNT2jzDVzE (بكالوريا العربية 2010 شعبة اللغات.pdf);
official ONEC paper: gdrive 16QpgypTST-u9nsT5f1gmCKy4PQczh97D (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1PePHLgVjGYt6BYv_FFVMVoWfESsTRqk- (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2010_sci_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx (paragraph and
cell text read exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by script;
every verbatim string of the JSON was re-checked programmatically against the docx (only the documented fixes differ). The
docx was compared verse by verse and question by question with the official ONEC paper (scanned, native 1555×2280 px page
images). The correction is a scanned PDF read from the page images. Every mark comes from the official scheme; correct
options and explanations condense its wording.

Docx vs ONEC paper:
- Poem: the same fourteen verses in the same order; the docx table stores each verse as [عجز, (empty), «n-صدر»] with a
  correct 1–14 numbering (the ONEC paper does not number the verses) ⇒ rows written [n-, صدر, عجز].
- Defects fixed from the ONEC paper (each asserted to occur once): verse 14 a stray line of letters after «وحولا» in the
  عجز cell («\nعإأاا») removed; Part 2 Q4 «من الروابط» اذكر» (stray closing guillemet) ⇒ «من الروابط، اذكر» (ONEC «الروابط ،
  اذكر»); Part 2 Q5 «من مؤثراته» ⇒ «من مؤشراته» (ONEC «من مؤشّراته»).
- Part 3: the docx splits the instruction over two lines (paragraphs 22–23) ⇒ joined with a space.
- Other differences are diacritics / spelling / labels only (docx kept): «فتـفيــــا» (as on the ONEC paper), «-  إيليا أبو
  ماضي -» (ONEC «إيليا أبو ماضي»), «ثالثا- التّقويم النقدي» (ONEC «ثالثا – التّقويم النّقديّ للنّصّ»)…
- Underlined on both: «إذا» (ب6) and «يبالي» (ب10); in brackets: «(هل شفيتم مع البكاء غليلا؟)» (ب7) and «(يتغنّى)» (ب10) —
  the targets of Part 2 Q1, named in the step prompts.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «لغات أجنبيّة» ⇒ LANG.
- «n×m» rule (as in the 2011–2023 converters): exactly the listed distinct items, or the distinct demands of the question ⇒
  one element per item; interchangeable items (more listed, «…», «يكتفي المترشّح بذكر…») ⇒ one element; one word ⇒ one element.
- Q1 «2×0.75» = the two statements of the truth. Q2 «01». Q3 «01 + 2×0.5» = اغتنام فرصة الحياة / الدّعوة إلى التّفاؤل /
  نبذ التّشاؤم. Q4 «2×0.5 + 0.5» = the romantic school / nature as a source of inspiration / examples from the text
  («يكتفي المترشّح بذكر بعض هذه العناصر» ⇒ the multi-select distractors are elements absent from the poem). Q5 «0.5 + 0.5 +
  0.75» = what it suggests / «نعم» / the justification. Q6 (نثر الأبيات 1–4) «3×0.75» = تقنية النّثر / دلالة المضمون /
  سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2: Q1 «إذا» 2×0.25; «يبالي» «0.25+0.5» on one line without saying which part earns which ⇒ one element of 0.75 (steps
  0.5 the verb + 0.25 its subject); each sentence 0.5. Q2 «0.5 + 0.5» = the imperative «اِشْفِ» / the reason for the
  hamzat al-waṣl. Q3 «2×0.5» = the image and its type (تشبيه بليغ) / its explanation and significance (الخير والجمال) — to be
  confirmed by the owner. Q4 «3×0.25» three connectors among those listed («…») ⇒ one element. Q5 «0.5 + 2×0.25» = الإيعازيّ
  الأمريّ + two indicators among three ⇒ one element of 0.5.
- Part 3 «4×01» = exactly the four statements of the scheme (الشّعر رسالة تخدم الخير والجمال والإنسان — with the school, مدرسة
  الرّابطة القلميّة —; the call to goodness; the call to beauty; the service of man) ⇒ four elements.
- Distractors avoid arguable alternatives: no «حال / خبر ثانٍ» for (يتغنّى), no «الوصفيّ / الحجاجيّ» for the type, no
  «الرّومانسيّة / أبولّو» among the schools, no connector or nature element that occurs in the poem.
- Deferred (essay_builder): Q6 نثر (3×0.75 = 2.25 points).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2010-lang-p1"
PAPER = 1
STREAMS = ["LANG"]
DOCX_ID = "1fWdlC6P2Ot_NvyVugoPqTHE-blwHVist"
DOCX_TITLE = "بكالوريا العربية 2010 شعبة اللغات.docx"
PDF_ID = "1RSOaz8wWGXoTp7-FRrsTeplNT2jzDVzE"
OFFICIAL_ID = "16QpgypTST-u9nsT5f1gmCKy4PQczh97D"
CORR_ID = "1PePHLgVjGYt6BYv_FFVMVoWfESsTRqk-"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
# الجدول 0 في docx: صفوف [العجز، خليّة فارغة، «رقم-الصّدر»]
# @@BEGIN-GENERATED@@
PARAS = {
    3: '-  إيليا أبو ماضي -',
    5: 'الأسئلة:',
    6: 'أوّلا- البناء الفكري: (10 نقاط)',
    7: 'ما الحقيقة التي يريد الشاعر إثباتها في بداية النّص؟',
    8: 'من المقصود ب «القوم» في البيت السَّابع؟',
    9: 'ما مضمون الرّسالة التي وجّهها الشّاعر؟',
    10: 'استعان الشاعر في تجسيد تجربته الشعوريّة بالطبيعة، بم تفسّر ذلك؟ مثل لإجابتك من النصّ.',
    11: 'بِم توحي إليك عبارة «كن هزارا في عشّه يتغنّى»؟ وهل تعكس نظرة الشاعر إلى الحياة؟ علّل.',
    12: 'أنثر الأبيات من 1 إلى 4.',
    14: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    15: 'أعرب ما تحته سطر إعراب مفردات وما بين قوسين إعراب جمل.',
    16: 'إِيت بفعل الأمر من الفعل «شفيتم» مع المخاطَب المفرد، واضبط حركة النطق به مبيّنا السبب.',
    17: 'استخرج صورة بيانيّة من البيت الثاني عشر، ثم ادرسها.',
    18: 'اعتمد الشاعر في بناء نصّه على جملة من الروابط» اذكر ثلاثة منها.',
    19: 'حدّد النمط البارز في النص مع ذكر مؤشرين من مؤثراته.',
    21: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    22: 'جسّدت القصيدة دور الشعر عند المدرسة الفنيّة التي ينتمي إليها الشاعر. وضّح ذلك معتمدا على ما',
    23: 'درست في هذا الباب.',
}
POEM_RAW = [
    ['كنــــــت ملكاً أو كنــــت عبدا ذليــــــلا', '', '1-أنت لــــــلأرض أوّلا وأخيــــــــــــــــــرا'],
    ['فلمـــــــــــــاذا تـــــراود المـــــــــــستحـــــيـــــلا؟', '', '2-لا خلـــــود تحت السّـــــماء لــــحيّ'],
    ['آفــــــة النـــــجم أن يخـــاف الأُفــــــولا', '', '3-كـــــلّ نجــــم إلــــى الأُفول ولكــــــــن'],
    ['كن حكيمــــــــا واسبق إليــــــــه الذّبــــولا', '', '4-غايـــــة الــــورد في الرّيــــاض ذبول'],
    ['فتـفيــــــــــــــا بـــــــــــــــــه إلى أن يحـــــــــــولا', '', '5-وإذا مــا وجــدت في الأرض ظلاً'],
    ['مطـــرا في السُّهول يحيـــــــي السُّهــــولا', '', '6-وتـــوقــع إذا السّمـــــــــاء اكفهــــــــــــرّت'],
    ['(هــــل شــــفيتم مع البكـاء غـليلا؟)', '', '7-قــــــل لــــقوم يستنزفــــون المـــــــــــــآقي'],
    ['فـــــــأريحوا أهــــــل الـــــــعقـــول الـــــــعقــــــولا', '', '8-مــــا أتينــــا إلــــى الحيــــــاة لنـــــــــشقى'],
    ['أخــــــــــــذته الهمـــــــوم أخـــــــذا وبيــــــــــلا', '', '9-كـــــــــلّ مــن يجمـــع الهمـــــوم عليه'],
    ['ومــــــــــع الكبــــــــــل لا يبـــــــالي الكبــولا', '', '10-كــــــن هــــزارا في عشـــــه (يتغنى)'],
    ['وبــــــوما في اللـــــيل يبـــكي الطلـــــــــولا', '', '11-لاغـــرابا يطارد الدّود في الأرض'],
    ['رقراقــــــــا فيسقي من جانبيه الحقــــولا', '', '12-كــــــن غديــــــرا يسيــــــر في الأرض'],
    ['كـــــــل شخص وكـــــلَّ شـــــــيء مثــــــيلا', '', '13-تستـــــــــــحم النّجــــــوم فــــــــيه ويلقـــــى'],
    ['تــــــستحيل الميــــــاه فـــــــــيه وحـــــــــــــــولا\nعإأاا', '', '14-لا وعــــــاء يقيّـــــد المــــــــــاء حتــــــى'],
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
    if _n == 14:
        _ajz = _fix_re(_ajz, r"\n[ء-ي]{1,6}$", "")  # سطر حروف زائد في خليّة docx
    assert "\n" not in _sadr and "\n" not in _ajz, _n
    POEM.append([f"{_n}-", _sadr, _ajz])
assert len(POEM) == 14

DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[3]},
]
P1, P2, P3 = PARAS[6], PARAS[14], PARAS[21]
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


q("q1", "1", P1, PARAS[7], 1.5, [el("q1-e1", "الحقيقة: الإنسان سائر إلى الزّوال والفناء", 0.75), el("q1-e2", "الحقيقة: لا خلود في الأرض لكائن", 0.75)])
q("q2", "2", P1, PARAS[8], 1, [el("q2-e1", "المقصود بـ«القوم»", 1)])
q("q3", "3", P1, PARAS[9], 2, [el("q3-e1", "الدّعوة إلى اغتنام فرصة الحياة", 1), el("q3-e2", "الدّعوة إلى التّفاؤل", 0.5), el("q3-e3", "نبذ التّشاؤم", 0.5)])
q("q4", "4", P1, PARAS[10], 1.5, [el("q4-e1", "الانتماء إلى المدرسة الرّومانسيّة", 0.5), el("q4-e2", "الطّبيعة مصدر إلهام عندها", 0.5),
                                  el("q4-e3", "التّمثيل من النّصّ", 0.5)])
q("q5", "5", P1, PARAS[11], 1.75, [el("q5-e1", "إيحاء العبارة", 0.5), el("q5-e2", "هل تعكس نظرة الشّاعر إلى الحياة", 0.5), el("q5-e3", "التّعليل", 0.75)])
q("q6", "6", P1, PARAS[12], 2.25, [el("q6-e1", "نثر الأبيات 1–4: احترام تقنية النّثر", 0.75), el("q6-e2", "نثر الأبيات 1–4: دلالة المضمون", 0.75),
                                   el("q6-e3", "نثر الأبيات 1–4: سلامة اللّغة", 0.75)])
q("q7", "1", P2, PARAS[15], 2.25, [el("q7-e1", "إعراب «إذا» (ب6)", 0.5), el("q7-e2", "إعراب «يبالي» (ب10) (0.25+0.5)", 0.75),
                                   el("q7-e3", "محلّ جملة (هل شفيتم مع البكاء غليلا؟)", 0.5), el("q7-e4", "محلّ جملة (يتغنّى)", 0.5)])
q("q8", "2", P2, PARAS[16], 1, [el("q8-e1", "فعل الأمر مضبوطًا", 0.5), el("q8-e2", "سبب الضّبط (همزة الوصل)", 0.5)])
q("q9", "3", P2, PARAS[17], 1, [el("q9-e1", "الصّورة ونوعها", 0.5), el("q9-e2", "شرحها ودلالتها", 0.5)])
q("q10", "4", P2, _fix(PARAS[18], "الروابط» ", "الروابط، "), 0.75, [el("q10-e1", "ثلاثة من الرّوابط (3×0.25)", 0.75)])
q("q11", "5", P2, _fix(PARAS[19], "مؤثراته", "مؤشراته"), 1, [el("q11-e1", "النّمط البارز", 0.5), el("q11-e2", "مؤشّران (2×0.25)", 0.5)])
q("q12", "التّعليمة", P3, PARAS[22] + " " + PARAS[23], 4,
  [el("q12-e1", "الشّعر رسالة تخدم الخير والجمال والإنسان (الرّابطة القلميّة)", 1), el("q12-e2", "الشّعر رسالة تدعو إلى الخير", 1),
   el("q12-e3", "الشّعر رسالة تدعو إلى الجمال", 1), el("q12-e4", "الشّعر رسالة تخدم الإنسان", 1)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "الحقيقة الّتي يريد الشّاعر إثباتها في بداية النّصّ: الإنسان سائر إلى الزّوال والفناء؛ لا خلود في الأرض لكائن (2×0.75)."
st("s01", "q1", "q1-e1", "mcq", "ما الحقيقة الّتي يريد الشّاعر إثباتها في بداية النّصّ؟",
   {"options": ["الإنسان سائر إلى الزّوال والفناء", "الإنسان خالد في الأرض لا يفنى", "الملوك وحدهم يخلدون بذكرهم", "السّعادة لا تُنال إلّا بالمُلك"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل الوجه الثّاني من هذه الحقيقة:",
   {"text": "لا ____ في الأرض لـ____.", "bank": ["خلود", "كائن", "موت", "فناء"]},
   {"blanks": [["خلود"], ["كائن"]]}, Q1_EXPL, 0.75, "ar.comprehension.idea")
st("s03", "q2", "q2-e1", "mcq", "من المقصود بـ«القوم» في البيت السّابع؟",
   {"options": ["المتشائمون والمنغمسون في الأحزان حتّى الثّمالة", "المتفائلون المقبلون على الحياة", "الحكماء الّذين يسبقون إلى الذّبول", "الملوك والعبيد"]},
   {"correct": 0}, "المقصود بـ«القوم» في البيت السّابع هم المتشائمون والمنغمسون في الأحزان حتّى الثّمالة.", 1, "ar.comprehension.explain")
Q3_EXPL = "مضمون الرّسالة هو: الدّعوة إلى اغتنام فرصة الحياة دقيقة دقيقة ولحظة لحظة (01)؛ الدّعوة إلى التّفاؤل ونبذ التّشاؤم (2×0.5)."
st("s04", "q3", "q3-e1", "mcq", "ما مضمون الرّسالة الّتي وجّهها الشّاعر؟ (الشّقّ الأوّل)",
   {"options": ["الدّعوة إلى اغتنام فرصة الحياة دقيقة دقيقة ولحظة لحظة", "الدّعوة إلى الزّهد في الحياة واعتزالها", "الدّعوة إلى البكاء على ما فات",
                "الدّعوة إلى طلب الخلود"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.idea")
st("s05", "q3", "q3-e1", "fill_blank", "أكمل:",
   {"text": "الدّعوة إلى ____ فرصة الحياة دقيقة دقيقة و____ لحظة.", "bank": ["اغتنام", "لحظة", "تضييع", "ساعة"]},
   {"blanks": [["اغتنام"], ["لحظة"]]}, Q3_EXPL, 0.5, "ar.comprehension.idea", "b")
st("s06", "q3", "q3-e2", "mcq", "وإلامَ يدعو الشّاعر أيضًا في رسالته؟",
   {"options": ["إلى التّفاؤل", "إلى الحزن", "إلى العزلة", "إلى الخوف من المستقبل"]}, {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.idea")
st("s07", "q3", "q3-e3", "fill_blank", "أكمل:",
   {"text": "و____ التّشاؤم.", "bank": ["نبذ", "تمجيد", "نشر"]}, {"blanks": [["نبذ"]]}, Q3_EXPL, 0.5, "ar.comprehension.idea")
Q4_EXPL = ("تفسَّر استعانة الشّاعر في تجسيد تجربته الشّعوريّة بالطّبيعة: بانتمائه إلى المدرسة الرّومانسيّة الّتي تولي اهتمامًا كبيرًا بالطّبيعة على أنّها "
           "مصدر إلهام لديهم (2×0.5). من أمثلة ذلك في النّصّ: «الأرض، السّماء، الرّياض، المطر، الهزار، الغراب، الغدير، النّجوم…» (يكتفي المترشّح بذكر "
           "بعض هذه العناصر) (0.5).")
st("s08", "q4", "q4-e1", "mcq", "بمَ تفسّر استعانة الشّاعر بالطّبيعة في تجسيد تجربته الشّعوريّة؟",
   {"options": ["بانتمائه إلى المدرسة الرّومانسيّة", "بانتمائه إلى مدرسة الإحياء والبعث", "بعيشه في البادية بعيدًا عن المدن", "بتقليده لشعراء العصر الجاهليّ"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.literature.trend")
st("s09", "q4", "q4-e2", "fill_blank", "أكمل:",
   {"text": "الّتي تولي اهتمامًا كبيرًا بالطّبيعة على أنّها مصدر ____ لديهم.", "bank": ["إلهام", "خوف", "رزق"]},
   {"blanks": [["إلهام"]]}, Q4_EXPL, 0.5, "ar.literature.trend")
st("s10", "q4", "q4-e3", "multi", "مثّل لإجابتك من النّصّ: أيّ عناصر الطّبيعة الآتية وظّفها الشّاعر؟ (اختر كلّ ما يصحّ)",
   {"options": ["الأرض", "السّماء", "الرّياض", "المطر", "الهزار", "الغدير", "الجبال", "البحر", "الصّحراء"]},
   {"correct": [0, 1, 2, 3, 4, 5]}, Q4_EXPL + " أمّا الجبال والبحر والصّحراء فلم ترد في القصيدة.", 0.5, "ar.comprehension.evidence")
Q5_EXPL = ("توحي العبارة بالتّفاؤل والإقبال على الحياة بروح مرحة تنشد الجمال (0.5). نعم، إنّها تعكس نظرة الشّاعر إلى الحياة (0.5). "
           "التّعليل: القصيدة تعكس النّزعة التّفاؤليّة عند الشّاعر، ومعلوم أنّ إيليا أبا ماضي قد نظم قصائد عديدة تدعو إلى التّفاؤل (0.75).")
st("s11", "q5", "q5-e1", "mcq", "بمَ توحي عبارة «كن هزارًا في عشّه يتغنّى»؟",
   {"options": ["بالتّفاؤل والإقبال على الحياة بروح مرحة تنشد الجمال", "بالحزن والتّشاؤم", "بالخوف من المستقبل", "بالعزلة والانطواء على النّفس"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.comprehension.explain")
st("s12", "q5", "q5-e2", "mcq", "وهل تعكس هذه العبارة نظرة الشّاعر إلى الحياة؟",
   {"options": ["نعم، إنّها تعكس نظرة الشّاعر إلى الحياة", "لا، فالشّاعر متشائم في القصيدة كلّها", "لا، فهي نظرة القوم الّذين يخاطبهم"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.comprehension.link")
st("s13", "q5", "q5-e3", "fill_blank", "علّل:",
   {"text": "القصيدة تعكس النّزعة ____ عند الشّاعر، ومعلوم أنّ إيليا أبا ماضي قد نظم قصائد عديدة تدعو إلى ____.",
    "bank": ["التّفاؤليّة", "التّفاؤل", "التّشاؤميّة", "التّشاؤم"]},
   {"blanks": [["التّفاؤليّة"], ["التّفاؤل"]]}, Q5_EXPL, 0.75, "ar.comprehension.link")
NATHR_SPEC = {"task": "نثر الأبيات من 1 إلى 4", "text": "قصيدة إيليا أبي ماضي (بكالوريا 2010، لغات أجنبيّة، الموضوع الأوّل)",
              "scheme": "«يراعى فيه ما يلي: احترام تقنية النّثر – دلالة المضمون – سلامة اللّغة» 3×0.75", "model_example": None}
NATHR_EXPL = "نثر الأبيات من 1 إلى 4: يراعى فيه احترام تقنية النّثر، دلالة المضمون، سلامة اللّغة (3×0.75). لا يقدّم التّصحيح نموذجًا."
for _sid, _eid, _crit in [("s14", "q6-e1", "احترام تقنية النّثر"), ("s15", "q6-e2", "دلالة المضمون"), ("s16", "q6-e3", "سلامة اللّغة")]:
    essay(_sid, "q6", _eid, "نثر الأبيات 1–4 من قصيدة إيليا أبي ماضي", _crit, _crit, 0.75, NATHR_SPEC, NATHR_EXPL, "ar.writing.forms")
# ── ثانيًا: البناء اللّغويّ ──
st("s17", "q7", "q7-e1", "mcq", "ما إعراب «إذا» (ما تحته سطر) في قوله: «وتوقّع إذا السّماء اكفهرّت»؟",
   {"options": ["ظرف لما يستقبل من الزّمان خافض لشرطه متعلّق بجوابه، مبنيّ على السّكون في محلّ نصب على الظّرفيّة، وهو مضاف",
                "حرف فجاءة مبنيّ على السّكون لا محلّ له من الإعراب", "ظرف لما مضى من الزّمان مبنيّ على السّكون في محلّ نصب، وهو مضاف",
                "اسم شرط جازم مبنيّ على السّكون في محلّ نصب"]},
   {"correct": 0}, "إذا: ظرف لما يستقبل من الزّمان خافض لشرطه متعلّق بجوابه مبنيّ على السّكون في محلّ نصب على الظّرفيّة وهو مضاف (2×0.25).", 0.5,
   "ar.grammar.irab")
YB_EXPL = "يبالي: فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل، والفاعل ضمير مستتر تقديره هو (0.25+0.5)."
st("s18", "q7", "q7-e2", "mcq", "ما إعراب «يبالي» (ما تحته سطر) في قوله: «ومع الكبل لا يبالي الكبولا»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الياء منع من ظهورها الثّقل", "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "فعل مضارع مجزوم بـ«لا» النّاهية وعلامة جزمه حذف حرف العلّة", "فعل مضارع منصوب وعلامة نصبه الفتحة المقدّرة على الياء"]},
   {"correct": 0}, YB_EXPL, 0.5, "ar.grammar.irab")
st("s19", "q7", "q7-e2", "fill_blank", "أكمل إعراب فاعل «يبالي»:",
   {"text": "والفاعل ضمير ____ تقديره ____.", "bank": ["مستتر", "هو", "متّصل", "هي"]},
   {"blanks": [["مستتر"], ["هو"]]}, YB_EXPL, 0.25, "ar.grammar.irab", "b")
st("s20", "q7", "q7-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (هل شفيتم مع البكاء غليلا؟) في قوله: «قل لقوم يستنزفون المآقي (هل شفيتم مع البكاء غليلا؟)»؟",
   {"options": ["جملة مقول القول في محلّ نصب مفعول به", "جملة في محلّ جرّ نعت لـ«قوم»", "جملة في محلّ رفع خبر", "جملة صلة موصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "«هل شفيتم مع البكاء غليلا؟»: جملة مقول القول في محلّ نصب مفعول به.", 0.5, "ar.grammar.sentence_case")
st("s21", "q7", "q7-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (يتغنّى) في قوله: «كن هزارًا في عشّه (يتغنّى)»؟",
   {"options": ["جملة فعليّة في محلّ نصب نعت", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة صلة موصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "«يتغنّى»: جملة فعليّة في محلّ نصب نعت.", 0.5, "ar.grammar.sentence_case")
AMR_EXPL = "يَشْفِي ← شْفِ ← اِشْفِ (0.5). التّعليل: جيء بهمزة الوصل لأنّه لا يجوز الابتداء بساكن في اللّغة العربيّة (0.5)."
st("s22", "q8", "q8-e1", "mcq", "ما فعل الأمر من الفعل «شفيتم» مع المخاطب المفرد، مضبوطًا بالشّكل؟",
   {"options": ["اِشْفِ", "اِشْفِي", "اُشْفُ", "شَفِّ"]}, {"correct": 0}, AMR_EXPL, 0.5, "ar.morphology")
st("s23", "q8", "q8-e2", "mcq", "لماذا جيء بهمزة الوصل في أوّل فعل الأمر «اِشْفِ»؟",
   {"options": ["لأنّه لا يجوز الابتداء بساكن في اللّغة العربيّة", "لأنّ الفعل ماضٍ رباعيّ", "للدّلالة على التّعدية", "لأنّ الفعل معتلّ الآخر"]},
   {"correct": 0}, AMR_EXPL, 0.5, "ar.morphology")
IMG_EXPL = ("الصّورة البيانيّة: «كن غديرًا…» تشبيه بليغ، إذ شبّه الشّاعر الإنسان الّذي يدعوه إلى التّفاؤل بالغدير الّذي ينساب ماؤه رقراقًا في الجداول "
            "فيسقي الحقول وتستحمّ فيه النّجوم. وفي هذا التّعبير دلالة على الخير من جهة، والجمال من جهة ثانية (2×0.5).")
st("s24", "q9", "q9-e1", "mcq", "استخرج صورة بيانيّة من البيت الثّاني عشر وحدّد نوعها.",
   {"options": ["«كن غديرًا…»: تشبيه بليغ", "«كن غديرًا…»: استعارة مكنيّة", "«كن غديرًا…»: كناية عن موصوف"]}, {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s25", "q9", "q9-e2", "fill_blank", "ادرس الصّورة: أكمل.",
   {"text": "شبّه الشّاعر ____ الّذي يدعوه إلى التّفاؤل بالغدير الّذي ينساب ماؤه رقراقًا، وفي هذا التّعبير دلالة على ____ من جهة، و____ من جهة ثانية.",
    "bank": ["الإنسان", "الخير", "الجمال", "الشّرّ", "القبح", "الطّائر"]},
   {"blanks": [["الإنسان"], ["الخير"], ["الجمال"]]}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s26", "q10", "q10-e1", "multi", "اعتمد الشّاعر في بناء نصّه على جملة من الرّوابط. أيّ ممّا يلي منها؟ (اختر كلّ ما يصحّ)",
   {"options": ["لكن", "إذا ما", "«لا» العاطفة (لا غرابا يطارد الدّود)", "حروف العطف", "حروف الجرّ", "ثمّ", "لأنّ", "بل"]},
   {"correct": [0, 1, 2, 3, 4]}, "الرّوابط هي: ولكن… إذا ما… «لا» العاطفة (لا غرابا يطارد الدّود)… حروف العطف والجرّ (3×0.25). أمّا «ثمّ، لأنّ، بل» فلم ترد في النّصّ.",
   0.75, "ar.cohesion.connectors")
TYPE_EXPL = ("النّمط البارز في النّصّ هو الإيعازيّ الأمريّ (0.5)، من مؤشّراته: صيغ الأمر والنّهي؛ المضمون الإرشاديّ؛ توظيف ضمائر المخاطب "
             "(يكتفي المترشّح بذكر مؤشّرين) (2×0.25).")
st("s27", "q11", "q11-e1", "mcq", "حدّد النّمط البارز في النّصّ.",
   {"options": ["الإيعازيّ الأمريّ", "السّرديّ", "الحواريّ", "التّفسيريّ"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s28", "q11", "q11-e2", "multi", "ما مؤشّرات هذا النّمط في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["صيغ الأمر والنّهي", "المضمون الإرشاديّ", "توظيف ضمائر المخاطب", "كثرة الأفعال الماضية والظّروف", "الحوار بين الشّخصيّات"]},
   {"correct": [0, 1, 2]}, TYPE_EXPL, 0.5, "ar.text.type")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_EXPL = ("جسّدت القصيدة دور الشّعر عند مدرسة الرّابطة القلميّة، ويتمثّل ذلك فيما يأتي: الشّعر رسالة تخدم الخير والجمال والإنسان؛ الشّعر رسالة تدعو إلى الخير "
             "وتتمثّل في دعوة الشّاعر القارئ إلى أن يكون ساعيًا إلى الخير مثل الغدير؛ الشّعر رسالة تدعو إلى الجمال ويتجلّى ذلك في دعوته إلى الإقبال على الحياة "
             "بتفاؤل والتّمتّع بجمالها (البيت الرّابع والبيت العاشر)؛ الشّعر رسالة تخدم الإنسان ويتجلّى ذلك في النّصائح القيّمة الّتي أسداها الشّاعر للمتلقّي "
             "أينما كان (4×01).")
st("s29", "q12", "q12-e1", "mcq", "ما المدرسة الفنّيّة الّتي ينتمي إليها الشّاعر وجسّدت القصيدة دور الشّعر عندها؟",
   {"options": ["الرّابطة القلميّة", "مدرسة الإحياء والبعث", "مدرسة الدّيوان", "العصبة الأندلسيّة"]}, {"correct": 0}, CRIT_EXPL, 0.5, "ar.literature.trend")
st("s30", "q12", "q12-e1", "fill_blank", "أكمل دور الشّعر عند هذه المدرسة:",
   {"text": "الشّعر رسالة تخدم ____ و____ و____.", "bank": ["الخير", "الجمال", "الإنسان", "السّلطان", "المال", "القبيلة"]},
   {"blanks": [["الخير"], ["الجمال"], ["الإنسان"]]}, CRIT_EXPL, 0.5, "ar.literature.features", "b")
st("s31", "q12", "q12-e2", "mcq", "الشّعر رسالة تدعو إلى الخير. كيف جسّدت القصيدة ذلك؟",
   {"options": ["في دعوة الشّاعر القارئ إلى أن يكون ساعيًا إلى الخير مثل الغدير", "في دعوته إلى البكاء على الأطلال", "في دعوته إلى اعتزال النّاس",
                "في وصفه للحروب والمعارك"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.features")
st("s32", "q12", "q12-e3", "fill_blank", "الشّعر رسالة تدعو إلى الجمال. أكمل:",
   {"text": "ويتجلّى ذلك في دعوته إلى ____ على الحياة بـ____ والتّمتّع بجمالها (البيت الرّابع والبيت العاشر).",
    "bank": ["الإقبال", "تفاؤل", "الإدبار", "تشاؤم"]},
   {"blanks": [["الإقبال"], ["تفاؤل"]]}, CRIT_EXPL, 1, "ar.literature.features")
st("s33", "q12", "q12-e4", "mcq", "الشّعر رسالة تخدم الإنسان. فيمَ يتجلّى ذلك في القصيدة؟",
   {"options": ["في النّصائح القيّمة الّتي أسداها الشّاعر للمتلقّي أينما كان", "في مدح الملوك والأمراء", "في الفخر بالقبيلة والنّسب", "في وصف الأطلال والدّيار"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.literature.features")

TITLE = "بكالوريا 2010 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (إيليا أبو ماضي: أنت للأرض أوّلا وأخيرا)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2010، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّب من الموضوع الرّسميّ: حُذف سطر حروف زائد في خليّة البيت 14، «الروابط» اذكر» ← «الروابط، اذكر» (البناء اللّغويّ س4)، «مؤثراته» ← «مؤشراته» (س5). "
         "العلامات من الإجابة النّموذجيّة الرّسميّة (ص1–2، صورة ممسوحة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "«يبالي» 0.25+0.5 في سطر واحد ⇒ عنصر واحد (0.75). مؤجَّل (essay_builder): نثر الأبيات 1–4 (3×0.75).")
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
