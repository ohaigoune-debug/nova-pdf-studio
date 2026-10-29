"""Conversion: BAC 2010 (session عاديّة، جوان 2010) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (مفدي زكرياء، «إنّ الجزائر في الوجود رسالة»).
Exam (most faithful source): gdrive 1U-ucd85xNww3mWZCy5_tAHdAyoRwDnXF (بكالوريا لغة عربية 2010 علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1l6WePwleEKBlR4I_U1xdqPuSgfA-Uio- (بكالوريا لغة عربية 2010 علوم تجريبية.pdf);
official ONEC paper: gdrive 1om7xSzhZiKOwnhKG-exFTpcNkcfNAGbn (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة وسلّم التّنقيط»): gdrive 1bp1dwK6BB9GZaQNN9OB2wsRAB2IrKdrw (02_التصحيح.pdf, page 2).

Method (as build_ar_bac_2010_sci_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx (paragraph and
cell text read exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by script;
every verbatim string of the JSON was re-checked programmatically against the docx (the documented fixes reverted). The docx
was compared verse by verse and question by question with the official ONEC paper (scanned, native 1557×2272 px page
images, crops enlarged up to ×2.5). The correction is a scanned PDF read from the page image. Every mark comes from the
official scheme; correct options and explanations condense its wording.

Docx vs ONEC paper:
- Poem: the same fifteen verses in the same order. The docx table stores each verse as [عجز, (empty), «n- صدر»] but its
  numbering is defective («10-» twice, so the last verse is «14-») while the questions count fifteen verses («البيتين (14)
  و(15)»); the ONEC paper does not number the verses ⇒ the docx numbers are dropped and the rows are written [n-, صدر, عجز]
  with n = 1…15 (row labels only; verse text untouched).
- Defects fixed from the ONEC paper (asserted to occur once): verse 4 «فأيقضتْ» ⇒ «فأيقظتْ»; verse 9 the stray «\n\n\nب»
  after «إدماجه» (a lone letter on extra lines in the docx cell) removed.
- Other differences are diacritics / spelling / labels only (docx kept): verse 9 «ان يبلعا» (ONEC «أن يُبْلَعَا»), verse 15
  «الأجْيلِ» (as printed on the ONEC paper), «أوّلا- البناء الفكري: (12 نقاط)» (ONEC «البناء الفكريّ: (12 نقطة)»)…

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE.
  Two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8 (no التّقويم النّقديّ), as on the ONEC paper.
- «n×m» rule (as in the 2011–2023 converters): exactly the required / listed distinct items, or the distinct demands of the
  question ⇒ one element per item; interchangeable items (more listed or «…» accepted) ⇒ one element.
- Q1 «3×0.5» (رسالة / قطعة قدسيّة / قصيدة أزليّة) and Q2 «3×0.5» (إيقاظ الشّعب / تحريك الضّمير / التفاف الشّعب حول
  الثّورة) ⇒ three elements each. Q3 «3×0.5 + 01» = التّشتيت / الإدماج / الإبعاد عن الدّين + the people's stance (الرّفض
  والتّرفّع والتّحدّي). The verse cues in the Q3 prompts (ب8، ب9، ب10) are ours. Q4 «2×01» = اللّغة العربيّة / الآلام (no
  «الدّين / النّسب / التّاريخ / العروبة» distractors: the text mentions them). Q5 «1.5» = verse 5. Q6 «2×0.5 + 2×0.5 +
  2×0.5» = the two tendencies (ثوريّة، دينيّة) + two examples of each, among several («…») ⇒ one element per tendency's
  examples. No «وطنيّة / قوميّة» distractors for the tendencies.
- Part 2: Q1 «1.5». Q2 «3 × 2×0.25» = pronoun + referent for each group of verses ⇒ six elements (no «القصيدة» distractor
  for the referent of «هي» in ب1–5, «أبياتها» in ب3 could be read so). Q3 «3×0.5» for the sentence that has a case, with
  «على التّلميذ أن يستخرج واحدة منها فقط» ⇒ read as the sentence / its function / the reason (one element each), + «2×0.5»
  for the sentence without a case = the sentence / the reason — to be confirmed by the owner. Q4 «2×0.5» = style / purpose.
  Q5 «0.5 + 0.5 + 0.5» = the image / its explanation (with its type) / its effect.
- Nothing deferred.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2010-sci-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "1U-ucd85xNww3mWZCy5_tAHdAyoRwDnXF"
DOCX_TITLE = "بكالوريا لغة عربية 2010 علوم تجريبية.docx"
PDF_ID = "1l6WePwleEKBlR4I_U1xdqPuSgfA-Uio-"
OFFICIAL_ID = "1om7xSzhZiKOwnhKG-exFTpcNkcfNAGbn"
CORR_ID = "1bp1dwK6BB9GZaQNN9OB2wsRAB2IrKdrw"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
# الجدول 0 في docx: صفوف [العجز، خليّة فارغة، «رقم- الصّدر»]
# @@BEGIN-GENERATED@@
PARAS = {
    41: '- مفدي زكرياء-',
    42: 'الأسئلة:',
    43: 'أوّلا- البناء الفكري: (12 نقاط)',
    44: 'كيف اعتبر الشَّاعر الجزائر؟',
    45: 'للشعر الثوريّ دور فعَّال في الثورة الجزائريّة. وضح ذلك من النّص.',
    46: 'نهج الاستعمار سياسة خاصة مع الشعب الجزائري. وضّحها مبرزا موقف الشعب منها.',
    47: 'أشار الشَّاعر إلى عاملين من عوامل وحدة الأمّة العربيّة. وضّحهما من النّص.',
    48: 'قال المتنبي: أنا الذي نظر الأعمى إلى أدبي      وأسمعت كلماتي من به صممُ.',
    49: 'هات نظير هذا المعنى من النّص.',
    50: 'يعكس النّص نزعتين. أبرزهما مع التمثيل.',
    51: 'ثانيا- البناء اللّغوي: (08 نقاط)',
    52: 'في أيّ حقل دلاليّ تضع الألفاظ الآتية: ربّك - قدسيّة - العقيدة - الإيمان؟',
    53: 'تكرّر ضمير في الأبيات من (1) إلى (5) وآخر في الأبيات من (6) إلى (8) وآخر في البيتين (14) و(15). عيّن هذه الضمائر ومدلولاتها في النص.',
    54: 'هات من البيت الأوّل جملة لا محلّ لها من الإعراب، وأخرى لها محل من الإعراب معللا السبب.',
    55: 'ما نوع الأسلوب في البيت الثامن وما غرضه البلاغيّ؟',
    56: 'في عجز البيت الثاني صورة بيانيّة، اشرحها ثم بين بلاغتها.',
}
POEM_RAW = [
    ['الشعب حـــــرَّرها وربُّك وقَّعــــــــــا', '', '1- إنّ الجزائر في الوجودِ رسالةٌ'],
    ['في الكون لحَّنها الرصاصُ ووقّعـــــــــا', '', '2- إنَّ الجزائر قطعة قدسِيّةٌ'],
    ['حمراءُ كان لها (نوفمبر) مطلعــــــــا', '', '3-وقصـــــيدة أزلــــــيّة أبياتهــــــــا'],
    ['شعبا إلى التَّحرير شمَّر مُسرعَــــــــا', '', '4- غنَّى بها حرُّ الضمير، فأيقضتْ'],
    ['ورأى بها الأعمى الطريق الأنصعَــــــا', '', '5- سمع الأصم رنينَها، فعَنا لهــا'],
    ['فانصب مذ سمع النّدا وتطوَّعَــــــا', '', '6- شعبٌ دعاه إلى الخلاص بُناته'],
    ['كالشَّامخـــــات، تمنــــعا وترفعًـــــا', '', '7- واستقبل الأحداثَ منها ساخرًا'],
    ['فأبى مع التاريخ أن يتصدعـــــا', '', '8- وأراده المستعمرون عناصرا'],
    ['فأبـــــت عروبتُه لـــــــه ان يبلـــعـــــا', '', '9- واستدرجوه فدبَّروا إدماجه\n\n\nب'],
    ['فأبى مع الإيمــــان أن يتزعزعـــــا', '', '10- وعن العقيدة زوَّروا تحريفه'],
    ['أسبــــــابُه بالعُــــــرب أن تتقطَّعــــــا', '', '10- وتعمدوا قطع الطريق فلم تُرِدْ'],
    ['ألـــمٌ، فأَوْرَق روحــــــهُ وتفرَّعَـــــا', '', '11- نسب بدنيا العرب زكَّى غرسه'],
    ['إن رنَّ هــــــذا، رنَّ ذاك ورجَّعـــــا', '', '12- سببٌ بأوتار القلوب عروقُه'],
    ['وَهَن الزمـــــــــان حِيالها وتضَعْضَعَـــــا', '', '13- تلك العروبةُ إن تُثر أعصابُها'],
    ['والجــــرح وحَّـــــد في هـــــــــواها المَــــنزَعَـــــا', '', '14-الضَّاد في الأجْيلِ خلَّد مجدها'],
]
# @@END-GENERATED@@


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


POEM = []
for _n, (_ajz, _mid, _right) in enumerate(POEM_RAW, 1):
    assert not _mid and "\n" not in _ajz, _n
    _m = re.match(r"^\d+-\s*", _right)
    assert _m, _right
    _sadr = _right[_m.end():]
    if _n == 4:
        _sadr = _fix(_sadr, "فأيقضتْ", "فأيقظتْ")
    if _n == 9:
        _sadr = _fix(_sadr, "\n\n\nب", "")
    assert "\n" not in _sadr, _n
    POEM.append([f"{_n}-", _sadr, _ajz])
_bare = lambda s: re.sub("[ً-ْـ]", "", s)
assert len(POEM) == 15 and _bare(POEM[0][1]).endswith("رسالة") and _bare(POEM[14][2]).endswith("المنزعا")
assert [r[0] for r in POEM_RAW].count("") == 0 and [r[2][:3] for r in POEM_RAW].count("10-") == 2  # ترقيم docx المعيب

DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[41]},
]
P1, P2 = PARAS[43], PARAS[51]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and PARAS[41] == "- مفدي زكرياء-"


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


q("q1", "1", P1, PARAS[44], 1.5, [el("q1-e1", "الجزائر رسالة", 0.5), el("q1-e2", "الجزائر قطعة قدسيّة", 0.5), el("q1-e3", "الجزائر قصيدة أزليّة", 0.5)])
q("q2", "2", P1, PARAS[45], 1.5, [el("q2-e1", "دور الشّعر الثّوريّ: إيقاظ الشّعب", 0.5), el("q2-e2", "دوره: تحريك الضّمير", 0.5),
                                  el("q2-e3", "دوره: التفاف الشّعب حول الثّورة", 0.5)])
q("q3", "3", P1, PARAS[46], 2.5, [el("q3-e1", "سياسة الاستعمار: محاولة التّشتيت", 0.5), el("q3-e2", "سياسة الاستعمار: الإدماج", 0.5),
                                  el("q3-e3", "سياسة الاستعمار: الإبعاد عن الدّين", 0.5), el("q3-e4", "موقف الشّعب منها", 1)])
q("q4", "4", P1, PARAS[47], 2, [el("q4-e1", "العامل الأوّل: اللّغة العربيّة", 1), el("q4-e2", "العامل الثّاني: الآلام", 1)])
q("q5", "5", P1, PARAS[48] + "\n" + PARAS[49], 1.5, [el("q5-e1", "نظير معنى بيت المتنبّي في النّصّ", 1.5)])
q("q6", "6", P1, PARAS[50], 3, [el("q6-e1", "النّزعة الأولى", 0.5), el("q6-e2", "النّزعة الثّانية", 0.5),
                                el("q6-e3", "تمثيل النّزعة الثّوريّة (2×0.5)", 1), el("q6-e4", "تمثيل النّزعة الدّينيّة (2×0.5)", 1)])
q("q7", "1", P2, PARAS[52], 1.5, [el("q7-e1", "الحقل الدّلاليّ", 1.5)])
q("q8", "2", P2, PARAS[53], 1.5, [el("q8-e1", "الضّمير في الأبيات 1–5", 0.25), el("q8-e2", "مدلوله (عائده)", 0.25),
                                  el("q8-e3", "الضّمير في الأبيات 6–8", 0.25), el("q8-e4", "مدلوله (عائده)", 0.25),
                                  el("q8-e5", "الضّمير في البيتين 14 و15", 0.25), el("q8-e6", "مدلوله (عائده)", 0.25)])
q("q9", "3", P2, PARAS[54], 2.5, [el("q9-e1", "جملة لها محلّ من الإعراب (ب1)", 0.5), el("q9-e2", "محلّها", 0.5), el("q9-e3", "تعليل أنّ لها محلًّا", 0.5),
                                  el("q9-e4", "جملة لا محلّ لها من الإعراب (ب1)", 0.5), el("q9-e5", "تعليل أنّها لا محلّ لها", 0.5)])
q("q10", "4", P2, PARAS[55], 1, [el("q10-e1", "نوع الأسلوب في البيت الثّامن", 0.5), el("q10-e2", "غرضه البلاغيّ", 0.5)])
q("q11", "5", P2, PARAS[56], 1.5, [el("q11-e1", "الصّورة البيانيّة في عجز البيت الثّاني", 0.5), el("q11-e2", "شرحها", 0.5), el("q11-e3", "بلاغتها", 0.5)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "اعتبر الشّاعر الجزائر رسالة، وقطعة قدسيّة، وقصيدة أزليّة (3×0.5)."
st("s01", "q1", "q1-e1", "fill_blank", "كيف اعتبر الشّاعر الجزائر في البيت الأوّل؟ أكمل:",
   {"text": "اعتبر الشّاعر الجزائر في الوجود ____.", "bank": ["رسالة", "مستعمرة", "غنيمة"]},
   {"blanks": [["رسالة"]]}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "وبمَ اعتبرها في البيت الثّاني؟",
   {"options": ["قطعة قدسيّة", "أرضًا منسيّة", "غنيمة للمستعمرين", "صحراء قاحلة"]}, {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s03", "q1", "q1-e3", "mcq", "وبمَ اعتبرها في البيت الثّالث؟",
   {"options": ["قصيدة أزليّة", "قصيدة رثاء حزينة", "حكاية منسيّة", "أغنية عابرة"]}, {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.details")
Q2_EXPL = "للشّعر الثّوريّ دور فعّال في الثّورة الجزائريّة ويتمثّل في: إيقاظ الشّعب، وتحريك الضّمير، والتفاف الشّعب حول الثّورة (3×0.5)."
st("s04", "q2", "q2-e1", "fill_blank", "أكمل الدّور الأوّل للشّعر الثّوريّ في الثّورة الجزائريّة:",
   {"text": "____ الشّعب.", "bank": ["إيقاظ", "تنويم", "تخويف"]}, {"blanks": [["إيقاظ"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s05", "q2", "q2-e2", "mcq", "وما الدّور الثّاني للشّعر الثّوريّ في الثّورة؟",
   {"options": ["تحريك الضّمير", "تخدير الضّمير", "إلهاء الشّعب عن الثّورة", "مدح المستعمر"]}, {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s06", "q2", "q2-e3", "fill_blank", "أكمل الدّور الثّالث للشّعر الثّوريّ:",
   {"text": "____ الشّعب حول الثّورة.", "bank": ["التفاف", "انفضاض", "ابتعاد"]}, {"blanks": [["التفاف"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain")
Q3_EXPL = ("السّياسة الّتي نهجها الاستعمار مع الشّعب الجزائريّ هي: محاولة التّشتيت، والإدماج، وإبعاده عن الدّين (3×0.5). "
           "موقف الشّعب من هذه السّياسة هو الرّفض والتّرفّع والتّحدّي (01).")
st("s07", "q3", "q3-e1", "mcq", "ما السّياسة الاستعماريّة الّتي يشير إليها قوله: «وأراده المستعمرون عناصرا… فأبى مع التّاريخ أن يتصدّعا»؟",
   {"options": ["محاولة التّشتيت", "محاولة التّعليم والتّثقيف", "محاولة التّعمير والبناء", "منح الحرّيّة"]}, {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q3", "q3-e2", "fill_blank", "أكمل سياسة أخرى نهجها الاستعمار مع الشّعب الجزائريّ (البيت التّاسع):",
   {"text": "«واستدرجوه فدبّروا إدماجه»: سياسة ____.", "bank": ["الإدماج", "الاستقلال", "التّحرير"]}, {"blanks": [["الإدماج"]]}, Q3_EXPL, 0.5,
   "ar.comprehension.details")
st("s09", "q3", "q3-e3", "mcq", "وما السّياسة الّتي يشير إليها قوله: «وعن العقيدة زوّروا تحريفه»؟",
   {"options": ["إبعاده عن الدّين", "تعليمه أصول دينه", "حماية عقيدته", "تقريبه من إخوانه العرب"]}, {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s10", "q3", "q3-e4", "multi", "ما موقف الشّعب من هذه السّياسة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الرّفض", "التّرفّع", "التّحدّي", "الاستسلام", "القبول", "الحياد"]}, {"correct": [0, 1, 2]}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s11", "q3", "q3-e4", "fill_blank", "أكمل موقف الشّعب:",
   {"text": "الرّفض و____ و____.", "bank": ["التّرفّع", "التّحدّي", "الخضوع", "التّردّد"]},
   {"blanks": [["التّرفّع"], ["التّحدّي"]]}, Q3_EXPL, 0.5, "ar.comprehension.details", "b")
Q4_EXPL = "من عوامل وحدة الأمّة العربيّة كما ورد في النّصّ: اللّغة العربيّة والآلام (2×01)."
st("s12", "q4", "q4-e1", "mcq", "ما عامل وحدة الأمّة العربيّة الّذي يشير إليه قوله: «الضّاد… خلّد مجدها»؟",
   {"options": ["اللّغة العربيّة", "الثّروات الاقتصاديّة", "القوّة العسكريّة", "المصالح التّجاريّة"]}, {"correct": 0}, Q4_EXPL, 1, "ar.comprehension.details")
st("s13", "q4", "q4-e2", "mcq", "وما العامل الثّاني الّذي يشير إليه قوله: «والجرح وحّد في هواها المنزعا»؟",
   {"options": ["الآلام", "الثّروات الاقتصاديّة", "الحدود الجغرافيّة", "المصالح التّجاريّة"]}, {"correct": 0}, Q4_EXPL, 1, "ar.comprehension.details")
Q5_EXPL = "نظير معنى بيت المتنبّي في النّصّ هو البيت الخامس: «سمع الأصمّ رنينها، فعنا لها… ورأى بها الأعمى الطّريق الأنصعا»."
st("s14", "q5", "q5-e1", "mcq", "قال المتنبّي: «أنا الّذي نظر الأعمى إلى أدبي… وأسمعت كلماتي من به صمم». أيّ أبيات النّصّ يحمل نظير هذا المعنى؟",
   {"options": ["البيت الخامس: «سمع الأصمّ رنينها، فعنا لها… ورأى بها الأعمى الطّريق الأنصعا»", "البيت الأوّل: «إنّ الجزائر في الوجود رسالة…»",
                "البيت الثّالث عشر: «سبب بأوتار القلوب عروقه…»", "البيت السّابع: «واستقبل الأحداث منها ساخرًا…»"]},
   {"correct": 0}, Q5_EXPL, 1, "ar.literature.intertext")
st("s15", "q5", "q5-e1", "fill_blank", "أكمل البيت الخامس الّذي يحمل نظير معنى بيت المتنبّي:",
   {"text": "سمع ____ رنينها، فعنا لها… ورأى بها ____ الطّريق الأنصعا", "bank": ["الأصمّ", "الأعمى", "الأبكم", "البصير"]},
   {"blanks": [["الأصمّ"], ["الأعمى"]]}, Q5_EXPL, 0.5, "ar.literature.intertext", "b")
Q6_EXPL = ("النّزعتان هما: نزعة ثوريّة ونزعة دينيّة (2×0.5). التّمثيل من النّصّ: النّزعة الثّوريّة تظهر في لغة الشّاعر كعبارة: لحّنها الرّصاص، "
           "إلى التّحرير شمّرا… (2×0.5)؛ النّزعة الدّينيّة تظهر في تشبّعه بالثّقافة الإسلاميّة: قطعة قدسيّة، أزليّة، العقيدة، الإيمان… (2×0.5).")
st("s16", "q6", "q6-e1", "mcq", "يعكس النّصّ نزعتين. ما النّزعة الّتي تظهر في لغة الشّاعر (الرّصاص، التّحرير…)؟",
   {"options": ["نزعة ثوريّة", "نزعة رومانسيّة حالمة", "نزعة تشاؤميّة", "نزعة غزليّة"]}, {"correct": 0}, Q6_EXPL, 0.5, "ar.literature.trend")
st("s17", "q6", "q6-e2", "mcq", "وما النّزعة الّتي تظهر في تشبّع الشّاعر بالثّقافة الإسلاميّة؟",
   {"options": ["نزعة دينيّة", "نزعة رومانسيّة حالمة", "نزعة وجوديّة", "نزعة تشاؤميّة"]}, {"correct": 0}, Q6_EXPL, 0.5, "ar.literature.trend")
st("s18", "q6", "q6-e3", "multi", "اختر من النّصّ ما يمثّل النّزعة الثّوريّة. (اختر كلّ ما يصحّ)",
   {"options": ["لحّنها الرّصاص", "إلى التّحرير شمّر", "قطعة قدسيّة", "العقيدة", "الإيمان"]}, {"correct": [0, 1]},
   Q6_EXPL + " أمّا «قطعة قدسيّة، العقيدة، الإيمان» فتمثّل النّزعة الدّينيّة.", 1, "ar.comprehension.evidence")
st("s19", "q6", "q6-e4", "fill_blank", "أكمل أمثلة النّزعة الدّينيّة من النّصّ:",
   {"text": "قطعة ____، ____، العقيدة، ____.", "bank": ["قدسيّة", "أزليّة", "الإيمان", "الرّصاص", "التّحرير"]},
   {"blanks": [["قدسيّة"], ["أزليّة"], ["الإيمان"]]}, Q6_EXPL, 1, "ar.comprehension.evidence")
# ── ثانيًا: البناء اللّغويّ ──
st("s20", "q7", "q7-e1", "mcq", "في أيّ حقل دلاليّ تضع الألفاظ: ربّك – قدسيّة – العقيدة – الإيمان؟",
   {"options": ["الحقل الدّينيّ", "حقل الثّورة والحرب", "حقل الطّبيعة", "حقل الموسيقى والغناء"]}, {"correct": 0},
   "تُدرج الألفاظ (ربّك، قدسيّة، العقيدة، الإيمان) ضمن الحقل الدّينيّ.", 1.5, "ar.cohesion.effect")
PRON_EXPL = ("الضّمير في الأبيات من 1 إلى 5 هو ضمير الغائب المفرد المؤنّث «هي» يعود على الجزائر؛ الضّمير في الأبيات من 6 إلى 8 هو ضمير الغائب المفرد "
             "المذكّر «هو» يعود على الشّعب؛ الضّمير في البيتين الأخيرين هو ضمير الغائب المفرد المؤنّث «هي» يعود على العروبة (لكلّ منها 2×0.25).")
st("s21", "q8", "q8-e1", "mcq", "ما الضّمير المتكرّر في الأبيات من (1) إلى (5)؟",
   {"options": ["ضمير الغائب المفرد المؤنّث «هي»", "ضمير الغائب المفرد المذكّر «هو»", "ضمير المتكلّم «أنا»", "ضمير الغائبين «هم»"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s22", "q8", "q8-e2", "mcq", "على من يعود ضمير الغائب المفرد المؤنّث في الأبيات من (1) إلى (5)؟",
   {"options": ["على الجزائر", "على الشّعب", "على العروبة", "على المستعمرين"]}, {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s23", "q8", "q8-e3", "fill_blank", "أكمل الضّمير المتكرّر في الأبيات من (6) إلى (8):",
   {"text": "ضمير الغائب المفرد ____ «____».", "bank": ["المذكّر", "هو", "المؤنّث", "هي"]},
   {"blanks": [["المذكّر"], ["هو"]]}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s24", "q8", "q8-e4", "mcq", "على من يعود ضمير الغائب المفرد المذكّر «هو» في الأبيات من (6) إلى (8)؟",
   {"options": ["على الشّعب", "على الجزائر", "على الشّاعر", "على التّاريخ"]}, {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s25", "q8", "q8-e5", "mcq", "ما الضّمير المتكرّر في البيتين (14) و(15)؟",
   {"options": ["ضمير الغائب المفرد المؤنّث «هي»", "ضمير الغائب المفرد المذكّر «هو»", "ضمير المتكلّمين «نحن»", "ضمير الغائبين «هم»"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s26", "q8", "q8-e6", "fill_blank", "أكمل مدلول الضّمير في البيتين الأخيرين:",
   {"text": "ضمير الغائب المفرد المؤنّث «هي» يعود على ____.", "bank": ["العروبة", "الجزائر", "الثّورة"]},
   {"blanks": [["العروبة"]]}, PRON_EXPL, 0.25, "ar.cohesion.reference")
HAS_EXPL = ("الجمل الّتي لها محلّ من الإعراب في البيت الأوّل: «الشّعب حرّرها»: لأنّها تؤوّل بمفرد «مُحَرَّرَة» وهي واقعة صفة؛ «حرّرها»: تؤوّل بمفرد "
            "«مُحَرِّرُها» وهي واقعة خبرًا للمبتدأ (الشّعب)؛ «ربّك وقّعا»: جملة معطوفة على جملة لها محلّ من الإعراب. ملاحظة: على التّلميذ أن يستخرج واحدة منها فقط (3×0.5).")
st("s27", "q9", "q9-e1", "multi", "أيّ الجمل الآتية من البيت الأوّل لها محلّ من الإعراب؟ (اختر كلّ ما يصحّ؛ يكفي التّلميذَ استخراج واحدة)",
   {"options": ["الشّعب حرّرها", "حرّرها", "ربّك وقّعا", "إنّ الجزائر في الوجود رسالة"]}, {"correct": [0, 1, 2]}, HAS_EXPL, 0.5, "ar.grammar.sentence_case")
st("s28", "q9", "q9-e2", "matching", "طابق كلّ جملة بوظيفتها الإعرابيّة.",
   {"lefts": ["الشّعب حرّرها", "حرّرها", "ربّك وقّعا"],
    "rights": ["واقعة صفة", "واقعة خبرًا للمبتدأ (الشّعب)", "معطوفة على جملة لها محلّ من الإعراب", "واقعة مفعولًا به"]},
   {"pairs": [0, 1, 2]}, HAS_EXPL, 0.5, "ar.grammar.sentence_case")
st("s29", "q9", "q9-e3", "mcq", "ما تعليل أنّ للجملتين «الشّعب حرّرها» و«حرّرها» محلًّا من الإعراب؟",
   {"options": ["لأنّهما تؤوّلان بمفرد («مُحَرَّرَة»، «مُحَرِّرُها»)", "لأنّهما ابتدائيّتان", "لأنّهما صلة موصول", "لأنّهما جواب شرط غير جازم"]},
   {"correct": 0}, HAS_EXPL, 0.5, "ar.grammar.sentence_case")
NOT_EXPL = "الجملة الّتي لا محلّ لها من الإعراب الواردة في البيت الأوّل: «إنّ الجزائر في الوجود رسالة»؛ التّعليل: لأنّها ابتدائيّة ولا يمكن تأويلها بمفرد (2×0.5)."
st("s30", "q9", "q9-e4", "mcq", "ما الجملة الّتي لا محلّ لها من الإعراب في البيت الأوّل؟",
   {"options": ["إنّ الجزائر في الوجود رسالة", "الشّعب حرّرها", "حرّرها", "ربّك وقّعا"]}, {"correct": 0}, NOT_EXPL, 0.5, "ar.grammar.sentence_case")
st("s31", "q9", "q9-e5", "fill_blank", "أكمل تعليل أنّها لا محلّ لها من الإعراب:",
   {"text": "لأنّها ____ ولا يمكن تأويلها بـ____.", "bank": ["ابتدائيّة", "مفرد", "اعتراضيّة", "جملة"]},
   {"blanks": [["ابتدائيّة", "ابتدائية"], ["مفرد"]]}, NOT_EXPL, 0.5, "ar.grammar.sentence_case")
STY_EXPL = "الأسلوب في البيت الثّامن خبريّ، غرضه الفخر والاعتزاز (2×0.5)."
st("s32", "q10", "q10-e1", "mcq", "ما نوع الأسلوب في البيت الثّامن: «وأراده المستعمرون عناصرا… فأبى مع التّاريخ أن يتصدّعا»؟",
   {"options": ["خبريّ", "إنشائيّ طلبيّ", "إنشائيّ غير طلبيّ"]}, {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.style")
st("s33", "q10", "q10-e2", "mcq", "وما غرضه البلاغيّ؟",
   {"options": ["الفخر والاعتزاز", "الرّثاء والتّحسّر", "الاستعطاف", "النّصح والإرشاد"]}, {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.style")
IMG_EXPL = ("الصّورة البيانيّة في عجز البيت الثّاني هي: «لحّنها الرّصاص» (0.5). شرحها: شبّه الرّصاص بالملحّن، حيث حذف المشبّه به ورمز إليه بفعل «لحّن» "
            "وذكر المشبّه (الرّصاص) على سبيل الاستعارة المكنيّة (0.5). بلاغتها: تشخيص المعنى، وتقويته والتّأكيد على صدق الشّعور (0.5).")
st("s34", "q11", "q11-e1", "fill_blank", "حدّد الصّورة البيانيّة الواردة في عجز البيت الثّاني:",
   {"text": "«____ الرّصاص»", "bank": ["لحّنها", "حرّرها", "رنينها"]}, {"blanks": [["لحّنها"]]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s35", "q11", "q11-e2", "fill_blank", "اشرح الصّورة:",
   {"text": "شبّه ____ بالملحّن، حيث حذف المشبّه به ورمز إليه بفعل «____»، وذكر المشبّه على سبيل الاستعارة ____.",
    "bank": ["الرّصاص", "لحّن", "المكنيّة", "الشّعب", "حرّر", "التّصريحيّة"]},
   {"blanks": [["الرّصاص"], ["لحّن"], ["المكنيّة"]]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s36", "q11", "q11-e3", "mcq", "ما بلاغة هذه الصّورة؟",
   {"options": ["تشخيص المعنى، وتقويته، والتّأكيد على صدق الشّعور", "تقديم الحقيقة مصحوبة بدليلها", "الإيجاز بحذف أداة التّشبيه ووجه الشّبه",
                "إحداث جرس موسيقيّ بتكرار الحروف"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")

TITLE = "بكالوريا 2010 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (مفدي زكرياء: إنّ الجزائر في الوجود رسالة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2010، شعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4، صورة ممسوحة)، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. ترقيم الأبيات في docx معيب («10-» مكرّر) والموضوع الرّسميّ غير مرقّم ⇒ رُقّمت الأبيات 1–15 كما تعدّها الأسئلة. "
         "صُوّب من الموضوع الرّسميّ: «فأيقضتْ» ← «فأيقظتْ» (ب4)، وحُذف حرف «ب» زائد في خليّة البيت 9. العلامات من الإجابة وسلّم التّنقيط الرّسميّين (ص2، صورة ممسوحة). "
         "المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8 (لا تقويم نقديّ). البناء اللّغويّ س3: «3×0.5» للجملة ذات المحلّ (يكفي استخراج واحدة: الجملة، وظيفتها، التّعليل) "
         "و«2×0.5» للجملة الّتي لا محلّ لها. لا خطوات مؤجّلة.")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
            "الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات والإحالات إلى الأبيات في أسئلة س3 من إعداد التّحويل وتحتاج مراجعة.")

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
