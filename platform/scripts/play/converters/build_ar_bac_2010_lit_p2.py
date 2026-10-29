"""Conversion: BAC 2010 (session عاديّة، جوان 2010) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (أحمد أمين، «فيض الخاطر»: نعمة الخصومة على الأدب).
Exam (most faithful source): gdrive 1tSmkVykpy9bgNa5W_uqyx9ZH_LMOE5Ol (بكالوريا العربية 2010 شعبة آداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 12tEe6aM2c6DCvHEIAmAz46OqiNur6yEv (بكالوريا العربية 2010 شعبة آداب وفلسفة.pdf);
official ONEC paper: gdrive 1BRXPDxrrapBoE3sVN-euYLi-LPGvUpSr (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1EaBUuqauL2Kltkr-OctmAM7yR7_5fh55 (02_التصحيح.pdf, page 3).

Method (as build_ar_bac_2010_sci_p1.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by script; every verbatim
string of the JSON was re-checked programmatically against the docx. The docx was compared line by line with the official
ONEC paper (scanned, native 1555×2280 px page images). The correction is a scanned PDF read from the page image (crops at
native resolution). Every mark comes from the official scheme; correct options and explanations condense its wording.

Docx vs ONEC paper:
- Same six paragraphs; the docx splits the third one over three lines (paragraphs 28–30) ⇒ joined with a space.
- No word-level defect found; differences are diacritics / punctuation / labels only (docx kept): «نقمةٌ» (ONEC «نقمةً»),
  «- أوّل الأمر-» (ONEC «ـــ أوّل الأمر ـــ»), «أوّلا- البناء الفكري» (ONEC «أ – البناء الفكريّ»), «ثالثا- التّقويم النقدي»
  (ONEC «ج – التّقويم النّقديّ للنّصّ»)…
- Underlined on both: «لولا الخصومة» (third paragraph) and «إذا» (in «فإذا هم حذرون»); in brackets: «(هي التي تنتج الأديب)»
  and «(فالفضل في ذلك للنقد)» — the targets of Part 2 Q1–Q2, named in the step prompts.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «آداب وفلسفة» ⇒ LIT.
- «n×m» rule (as in the 2011–2023 converters): exactly the listed distinct items, or the distinct demands of the question ⇒
  one element per item; interchangeable items (more listed, «…») ⇒ one element.
- Q1 «2×0.75» = فضل النّقد على الأدب / علاقة الخصومة بالنّقد. Q2 «2×0.5» = the two reasons + «2×0.25» «ثمّ يبدي المترشّح
  رأيه إيجابا أو سلبا مع التّعليل» ⇒ the opinion and its justification are two deferred essay_builder elements (rule 11).
  Q3 «4×0.5» = فنّ الهجاء / شعر النّقائض / the example of جرير والفرزدق / أهاجي بشّار وأبي نواس وابن الرّوميّ (no «جرير
  والأخطل» distractor: the text names their نقائض too). Q4 «2×0.5 + 0.5». Q5 «3 × 2×0.25» = the two camps / the nature of
  the conflict (أدبيّ فنّيّ + منافسة في الإجادة والإمتاع) / its benefit (رقيّ الأدب وتجديده + توجّه الأدباء وجهة جديدة) ⇒
  six elements. Q6 (تلخيص) «4×0.5» with three criteria («الفهم الصّحيح للمضمون + تقنية التّلخيص + سلامة اللّغة») that cannot
  be matched to four half-points ⇒ one deferred essay_builder element of 2.
- Part 2: Q1 the marks column prints «2×0.25» beside «لولا» and «2×0.25» between «الخصومة» and «إذا» (part total 6 = 1 + 1 +
  2 + 2) ⇒ «لولا» 0.5, «الخصومة» 0.25, «إذا» 0.25 — to be confirmed by the owner. Q2 «2×0.5» one per sentence. Q3 «2×0.5 +
  2×0.5» = المسند «يكسب» + its function / المسند إليه «الأدب» + its function. Q4 «4×0.5» = the question's four demands
  (استخراج / النّوع: كناية عن صفة / الشّرح: غزارة الإنتاج الأدبيّ والإبداع فيه / القيمة: إبراز فضل النّقد على الأدب).
- Part 3 «4×0.25 + 4×0.25 + 4×0.5» = the definition (four parts of one definition ⇒ one element) + four of the five-plus
  writers listed («…» ⇒ one element) + «ومن أهمّ خصائصه» four features (non-exhaustive ⇒ one element).
- Distractors avoid arguable alternatives: no «ظرف مكان» for the إذا of surprise, no «استعارة» for the image (the scheme says
  كناية عن صفة), no «اعتراضيّة» reading that the scheme would accept.
- Deferred (essay_builder): Q2 opinion + justification (0.25 + 0.25) and Q6 summary (2) = 2.5 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2010-lit-p2"
PAPER = 2
STREAMS = ["LIT"]
DOCX_ID = "1tSmkVykpy9bgNa5W_uqyx9ZH_LMOE5Ol"
DOCX_TITLE = "بكالوريا العربية 2010 شعبة آداب وفلسفة.docx"
PDF_ID = "12tEe6aM2c6DCvHEIAmAz46OqiNur6yEv"
OFFICIAL_ID = "1BRXPDxrrapBoE3sVN-euYLi-LPGvUpSr"
CORR_ID = "1EaBUuqauL2Kltkr-OctmAM7yR7_5fh55"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
# @@BEGIN-GENERATED@@
PARAS = {
    26: '«كانت الخصومة بين الأدباء دائما نعمة على الأدب وإن كانت نقمةٌ أحيانا على الأدباء أنفسهم. فالخصومة - أوّل الأمر- في كثير من الأحيان (هي التي تنتج الأديب) وتهيّج مشاعره، وتطلق لسانه.',
    27: 'إنّ الخصومة هي التي أورثتنا بابا كبيرا من أبواب الأدب هو باب الهجاء، فلولا الخصومة ما كانت لنا نقائضُ جرير والفرزدق ونقائض جرير والأخطل، ولا كانت أهاجي بشار وأبي نواس وابن الرومي وغيرهم من الهجائين....',
    28: 'إنّ الروايات الكثيرة في الأدب العربيّ التي وضعت لنقد كاتب والهزء به وبآرائه؛ والتي',
    29: 'وضعت لنقد فكرة والسخرية بها وبواضعيها ومؤيّديها، كلّ هذه ما كانت تكون لولا الخصومة',
    30: 'الأدبيّة، وكلّها ثروة كبيرة من ثروة الأدب لا غنى عنها، ولا حياة له بدونها.',
    31: 'وبعد هذا كلّه فما النقد؟ أليس هو خصومة شريفة وغير شريفة أحيانا؟ إن كان النقد في قليل من أوقاته مدحا وتقريضا فهو في كثير من أحيانه عيب وتجريح. وليس يشك شاكٌّ في نعمة النّقد على الأدب، فهو الذي بخصومته يهاجم الأدباء في شدّة وعنف فيبيّن أغاليطهم، ويوضح ضعفهم، ويظهر عيوبهم، فإذا هم حذرون يجيدون خوف النّقد، ويحاولون أن يتبرأوا من العيوب خوف النَّقد، وينشدون الكمال خوف النَّقد، فإذا خرج نتاجهم كاملا أو قريبا من الكمال (فالفضل في ذلك للنقد).',
    32: 'وفي كلّ عصر تنشأ خصومة حادّة عنيفة بين رجال الأدب من أنصار القديم وأنصار الجديد يتجادلون ويتسابّون، وجدالهم وسبابهم أدب، وينقسم النّاس إلى معسكرين: أنصار المجدّدين وأنصار المحافظين، ويحمل كلّ فريق أقلامهم فيجيدون ويمتعون، فيكسب الأدب من هذه المعارك مكسبا مزدوجا، مكسبا من ناحية ما يقال في هذه المعارك من هجاء وتعنيف وسبّ وخصام، ومكسبا من ناحية ما يكسبه المجدّدون -\u200f غالبا - من توجيه الأدب وجهة جديدة، وإدخال عناصر فيه جديدة.',
    33: 'ولولا ذلك لظلّ هيكل الأدب كهيكل الأهرام تمر عليها الدّهور والأعوام وهي هي في شكلها ومادتها، ولكان أدبنا اليوم هو الأدب الجاهلي، ولكان أدب الغرب اليوم هو أدب القرون الوسطى، فلولا ثورة المجدّدين والخصومة بين الأدباء لما تقدم الأدب خطوة، ولظل على حالته كما تركه الأوّلون... هذا في إجمال نعمةُ الخصومة على الأدب.»',
    34: 'من كتاب فيض الخاطر ج 3\u200f - أحمد أمين -\u200f بتصرف.',
    35: 'الأسئلة:',
    36: 'أوّلا- البناء الفكري: (10 نقاط)',
    37: 'ما القضية التي شغلت بال الكاتب في النّص؟',
    38: 'لِمَ اعتبر الكاتب الخصومة بين الأدباء نعمة؟ هل توافقه على ذلك؟ علّل.',
    39: 'فيمَ تمثّلت ثمرة الخصومة في الأدب العربيّ القديم؟ وضّح ذلك بأمثلة من النص.',
    40: 'ما فضل النّقد على الأدب حسب رأي الكاتب؟',
    41: 'أدّت الخصومة بين الأدباء إلى انقسامهم إلى معسكرين حدّدهما، ما طبيعة الصّراع بينهما؟ وما فائدة هذا الصّراع على الأدب؟',
    42: 'لخّص مضمون النّص بأسلوبك الخاص.',
    43: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    44: 'أعرب ما تحته سطر في النّص.',
    45: 'بين المحلّ الإعرابيّ للجملتين المحصورتين بين قوسين.',
    46: 'حدد في العبارة التالية المسند والمسند إليه مبيّنا الوظيفة الإعرابيّة لكل منهما: «فيكسبُ الأدب من هذه المعارك مكسبا مزدوجا».',
    47: 'استخرج من العبارة التالية: "ويحمل كلّ فريق أقلامهم فيجيدون ويمتعون" صورة بيانيّة، اذكر نوعها ثم اشرحها مبرزا قيمتها البلاغيّة.',
    48: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    49: 'النّص من فنّ المقال، عرّفه ثم اذكر أبرز أعلامه وأهم خصائصه.',
}
# @@END-GENERATED@@

JS = lambda *ix: " ".join(PARAS[i] for i in ix)  # أسطر الفقرة الواحدة في docx
TEXT_PARAS = [JS(26), JS(27), JS(28, 29, 30), JS(31), JS(32), JS(33)]
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(TEXT_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[34]},
]
P1, P2, P3 = PARAS[36], PARAS[43], PARAS[48]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and PARAS[34].startswith("من كتاب فيض الخاطر")


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


q("q1", "1", P1, PARAS[37], 1.5, [el("q1-e1", "القضيّة: فضل النّقد على الأدب", 0.75), el("q1-e2", "القضيّة: علاقة الخصومة بالنّقد", 0.75)])
q("q2", "2", P1, PARAS[38], 1.5, [el("q2-e1", "الخصومة تهيّج مشاعر الأديب وتطلق لسانه", 0.5), el("q2-e2", "الخصومة وسيلة هامّة من وسائل تطوّر الأدب", 0.5),
                                  el("q2-e3", "إبداء الرّأي (الموافقة أو عدمها)", 0.25), el("q2-e4", "تعليل الرّأي", 0.25)])
q("q3", "3", P1, PARAS[39], 2, [el("q3-e1", "ثمرة الخصومة: ظهور فنّ الهجاء", 0.5), el("q3-e2", "ثمرة الخصومة: شعر النّقائض", 0.5),
                                el("q3-e3", "مثال النّقائض: جرير والفرزدق", 0.5), el("q3-e4", "مثال الأهاجي: بشّار وأبو نواس وابن الرّوميّ", 0.5)])
q("q4", "4", P1, PARAS[40], 1.5, [el("q4-e1", "النّقد يبيّن أغاليط الأدباء", 0.5), el("q4-e2", "يوضّح ضعفهم وعيوبهم", 0.5),
                                  el("q4-e3", "يدفعهم إلى تجويد أدبهم والسّعي إلى الكمال", 0.5)])
q("q5", "5", P1, PARAS[41], 1.5, [el("q5-e1", "المعسكر الأوّل: أنصار القديم", 0.25), el("q5-e2", "المعسكر الثّاني: أنصار الجديد", 0.25),
                                  el("q5-e3", "طبيعة الصّراع: أدبيّ فنّيّ", 0.25), el("q5-e4", "طبيعة الصّراع: منافسة في الإجادة والإمتاع", 0.25),
                                  el("q5-e5", "فائدته: رقيّ الأدب وتجديده مبنى ومعنى", 0.25), el("q5-e6", "فائدته: توجّه الأدباء وجهة جديدة", 0.25)])
q("q6", "6", P1, PARAS[42], 2, [el("q6-e1", "تلخيص مضمون النّصّ (4×0.5: المضمون، تقنية التّلخيص، سلامة اللّغة)", 2)])
q("q7", "1", P2, PARAS[44], 1, [el("q7-e1", "إعراب «لولا»", 0.5), el("q7-e2", "إعراب «الخصومة»", 0.25), el("q7-e3", "إعراب «إذا»", 0.25)])
q("q8", "2", P2, PARAS[45], 1, [el("q8-e1", "محلّ جملة (هي التي تنتج الأديب)", 0.5), el("q8-e2", "محلّ جملة (فالفضل في ذلك للنقد)", 0.5)])
q("q9", "3", P2, PARAS[46], 2, [el("q9-e1", "المسند", 0.5), el("q9-e2", "الوظيفة الإعرابيّة للمسند", 0.5), el("q9-e3", "المسند إليه", 0.5),
                                el("q9-e4", "الوظيفة الإعرابيّة للمسند إليه", 0.5)])
q("q10", "4", P2, PARAS[47], 2, [el("q10-e1", "استخراج الصّورة", 0.5), el("q10-e2", "نوعها", 0.5), el("q10-e3", "شرحها", 0.5), el("q10-e4", "قيمتها البلاغيّة", 0.5)])
q("q11", "التّعليمة", P3, PARAS[49], 4, [el("q11-e1", "تعريف المقال (4×0.25)", 1), el("q11-e2", "أبرز أعلامه (4×0.25)", 1), el("q11-e3", "أهمّ خصائصه (4×0.5)", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "القضيّة الّتي شغلت بال الكاتب في النّصّ هي: فضل النّقد على الأدب وعلاقة الخصومة بالنّقد (2×0.75)."
st("s01", "q1", "q1-e1", "mcq", "ما القضيّة الّتي شغلت بال الكاتب في النّصّ؟ (الشّقّ الأوّل)",
   {"options": ["فضل النّقد على الأدب", "تاريخ الشّعر الجاهليّ", "أثر الحروب في الأدب", "سيرة جرير والفرزدق"]}, {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل الشّقّ الثّاني من القضيّة:",
   {"text": "علاقة ____ بـ____.", "bank": ["الخصومة", "النّقد", "الصّداقة", "الشّعر"]},
   {"blanks": [["الخصومة"], ["النّقد"]]}, Q1_EXPL, 0.75, "ar.comprehension.idea")
Q2_EXPL = ("اعتبر الكاتب الخصومة بين الأدباء نعمة لكونها تهيّج مشاعر الأديب وتطلق لسانه، كما أنّها وسيلة هامّة من وسائل تطوّر الأدب (2×0.5). "
           "ثمّ يبدي المترشّح رأيه إيجابًا أو سلبًا مع التّعليل (2×0.25).")
st("s03", "q2", "q2-e1", "fill_blank", "لمَ اعتبر الكاتب الخصومة بين الأدباء نعمة؟ أكمل:",
   {"text": "لكونها ____ مشاعر الأديب و____ لسانه.", "bank": ["تهيّج", "تطلق", "تخمد", "تعقد"]},
   {"blanks": [["تهيّج"], ["تطلق"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s04", "q2", "q2-e2", "mcq", "وما السّبب الآخر الّذي جعله يعدّها نعمة؟",
   {"options": ["أنّها وسيلة هامّة من وسائل تطوّر الأدب", "أنّها تؤلّف بين الأدباء وتمنع الخلاف", "أنّها تُبعد الأدباء عن النّقد", "أنّها تحفظ الأدب على حالته الأولى"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.explain")
OP_SPEC = {"task": "إبداء الرّأي في اعتبار الخصومة بين الأدباء نعمة مع التّعليل", "question": PARAS[38],
           "scheme": "«ثمّ يبدي المترشّح رأيه إيجابا أو سلبا مع التّعليل» (2×0.25)"}
OP_EXPL = "يبدي المترشّح رأيه إيجابًا أو سلبًا مع التّعليل (الرّأي 0.25 + التّعليل 0.25)؛ يُقبل الرّأيان."
essay("s05", "q2", "q2-e3", "موافقة الكاتب في أنّ الخصومة بين الأدباء نعمة", "الرّأي", "يبدي المترشّح رأيه إيجابًا أو سلبًا", 0.25, OP_SPEC, OP_EXPL,
      "ar.comprehension.opinion")
essay("s06", "q2", "q2-e4", "موافقة الكاتب في أنّ الخصومة بين الأدباء نعمة", "التّعليل", "تعليل الرّأي", 0.25, OP_SPEC, OP_EXPL, "ar.comprehension.opinion")
Q3_EXPL = ("تمثّلت ثمرة الخصومة في الأدب العربيّ القديم في ظهور فنّ الهجاء ثمّ شعر النّقائض كالّذي كان بين جرير والفرزدق، كما نجده في أهاجي بشّار "
           "وأبي نواس وابن الرّوميّ (4×0.5).")
st("s07", "q3", "q3-e1", "mcq", "فيمَ تمثّلت ثمرة الخصومة في الأدب العربيّ القديم أوّلًا؟",
   {"options": ["ظهور فنّ الهجاء", "ظهور فنّ المقال", "ظهور الرّواية", "ظهور الشّعر الحرّ"]}, {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s08", "q3", "q3-e2", "fill_blank", "أكمل الثّمرة الثّانية:",
   {"text": "ثمّ ظهور شعر ____.", "bank": ["النّقائض", "التّفعيلة", "المهجر"]}, {"blanks": [["النّقائض"]]}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s09", "q3", "q3-e3", "mcq", "مثّل الكاتب لشعر النّقائض بما كان بين…",
   {"options": ["جرير والفرزدق", "بشّار وأبي نواس", "أبي تمّام والبحتريّ", "شوقي وحافظ"]}, {"correct": 0},
   Q3_EXPL + " (ويذكر النّصّ أيضًا نقائض جرير والأخطل.)", 0.5, "ar.comprehension.evidence")
st("s10", "q3", "q3-e4", "multi", "ومن أصحاب الأهاجي الّذين ذكرهم الكاتب مثالًا: (اختر كلّ ما يصحّ)",
   {"options": ["بشّار", "أبو نواس", "ابن الرّوميّ", "المتنبّي", "البحتريّ"]}, {"correct": [0, 1, 2]}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
Q4_EXPL = ("فضل النّقد على الأدب حسب رأي الكاتب يكمن في: أنّه يبيّن أغاليط الأدباء، ويوضّح ضعفهم وعيوبهم (2×0.5)، ممّا يدفعهم إلى تجويد أدبهم "
           "والسّعي إلى تحقيق الكمال أو الاقتراب منه (0.5).")
st("s11", "q4", "q4-e1", "mcq", "ما فضل النّقد على الأدب حسب رأي الكاتب؟ إنّه…",
   {"options": ["يبيّن أغاليط الأدباء", "يمدح الأدباء ويقرّظهم في كلّ أحواله", "يُسكت الأدباء ويثبّط هممهم", "يحفظ الأدب من كلّ تغيير"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.details")
st("s12", "q4", "q4-e2", "fill_blank", "أكمل:",
   {"text": "ويوضّح ____ و____.", "bank": ["ضعفهم", "عيوبهم", "قوّتهم", "محاسنهم"]},
   {"blanks": [["ضعفهم"], ["عيوبهم"]]}, Q4_EXPL, 0.5, "ar.comprehension.details")
st("s13", "q4", "q4-e3", "mcq", "وإلامَ يدفع النّقدُ الأدباءَ بذلك؟",
   {"options": ["إلى تجويد أدبهم والسّعي إلى تحقيق الكمال أو الاقتراب منه", "إلى ترك الكتابة نهائيًّا", "إلى تقليد القدماء دون تجديد",
                "إلى مهاجمة النّقّاد والانتقام منهم"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.link")
Q5_EXPL = ("أدّت الخصومة بين الأدباء إلى انقسامهم إلى معسكرين هما: أنصار القديم (أي المقلّدون أو المحافظون)، وأنصار الجديد (أي المجدّدون) (2×0.25). "
           "وطبيعة الصّراع بينهما أنّه صراع أدبيّ فنّيّ، فكلّ فريق يسعى إلى منافسة الآخر في الإجادة والإمتاع (2×0.25). "
           "وتتمثّل فائدة هذا الصّراع في رقيّ الأدب وتجديده مبنى ومعنى، إضافة إلى توجّه الأدباء وجهة جديدة (2×0.25).")
st("s14", "q5", "q5-e1", "mcq", "أدّت الخصومة بين الأدباء إلى انقسامهم إلى معسكرين. ما المعسكر الأوّل؟",
   {"options": ["أنصار القديم (المقلّدون أو المحافظون)", "أنصار السّلطة", "النّقّاد الأجانب", "عامّة القرّاء"]}, {"correct": 0}, Q5_EXPL, 0.25, "ar.comprehension.details")
st("s15", "q5", "q5-e2", "fill_blank", "أكمل المعسكر الثّاني:",
   {"text": "أنصار ____ (أي ____).", "bank": ["الجديد", "المجدّدون", "القديم", "المحافظون"]},
   {"blanks": [["الجديد"], ["المجدّدون", "المجددين", "المجدّدين"]]}, Q5_EXPL, 0.25, "ar.comprehension.details")
st("s16", "q5", "q5-e3", "mcq", "ما طبيعة الصّراع بين المعسكرين؟",
   {"options": ["صراع أدبيّ فنّيّ", "صراع سياسيّ على السّلطة", "صراع قبليّ عشائريّ", "صراع مادّيّ على المال"]}, {"correct": 0}, Q5_EXPL, 0.25, "ar.comprehension.explain")
st("s17", "q5", "q5-e4", "fill_blank", "أكمل:",
   {"text": "فكلّ فريق يسعى إلى منافسة الآخر في ____ و____.", "bank": ["الإجادة", "الإمتاع", "الإقصاء", "التّشهير"]},
   {"blanks": [["الإجادة"], ["الإمتاع"]]}, Q5_EXPL, 0.25, "ar.comprehension.explain")
st("s18", "q5", "q5-e5", "mcq", "ما فائدة هذا الصّراع على الأدب؟",
   {"options": ["رقيّ الأدب وتجديده مبنى ومعنى", "جمود الأدب وثباته على حاله", "انصراف النّاس عن الأدب", "عودة الأدب إلى العصر الجاهليّ"]},
   {"correct": 0}, Q5_EXPL, 0.25, "ar.comprehension.explain")
st("s19", "q5", "q5-e6", "fill_blank", "أكمل فائدة أخرى:",
   {"text": "توجّه الأدباء ____ جديدة.", "bank": ["وجهة", "عودة", "رجعة"]}, {"blanks": [["وجهة"]]}, Q5_EXPL, 0.25, "ar.comprehension.explain")
essay("s20", "q6", "q6-e1", "تلخيص مضمون نصّ أحمد أمين (نعمة الخصومة على الأدب)", "الفهم الصّحيح للمضمون + تقنية التّلخيص + سلامة اللّغة",
      "يراعى في إجابة المترشّح الفهم الصّحيح للمضمون + تقنية التّلخيص + سلامة اللّغة", 2,
      {"task": "تلخيص مضمون النّصّ بالأسلوب الخاصّ", "text": "أحمد أمين، فيض الخاطر (بكالوريا 2010، آداب وفلسفة، الموضوع الثّاني)",
       "scheme": "«4×0.5» مع ثلاثة معايير دون توزيع (المضمون، تقنية التّلخيص، سلامة اللّغة)", "model_example": None},
      "التّلخيص (4×0.5): يراعى في إجابة المترشّح الفهم الصّحيح للمضمون + تقنية التّلخيص + سلامة اللّغة. لا يقدّم التّصحيح نموذجًا.", "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s21", "q7", "q7-e1", "mcq", "ما إعراب «لولا» (ما تحته سطر) في قوله: «كلّ هذه ما كانت تكون لولا الخصومة الأدبيّة»؟",
   {"options": ["حرف امتناع لوجود يتضمّن معنى الشّرط مبنيّ على السّكون لا محلّ له من الإعراب", "حرف امتناع لامتناع مبنيّ على السّكون لا محلّ له من الإعراب",
                "حرف تحضيض مبنيّ على السّكون لا محلّ له من الإعراب", "اسم شرط جازم مبنيّ على السّكون في محلّ رفع مبتدأ"]},
   {"correct": 0}, "لولا: حرف امتناع لوجود يتضمّن معنى الشّرط مبنيّ على السّكون لا محلّ له من الإعراب (2×0.25).", 0.5, "ar.grammar.irab")
st("s22", "q7", "q7-e2", "mcq", "ما إعراب «الخصومة» (ما تحته سطر) في قوله: «لولا الخصومة الأدبيّة»؟",
   {"options": ["مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "نائب فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "الخصومة: مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.25, "ar.grammar.irab")
st("s23", "q7", "q7-e3", "mcq", "ما إعراب «إذا» (ما تحته سطر) في قوله: «فإذا هم حذرون يجيدون خوف النّقد»؟",
   {"options": ["حرف فجاءة مبنيّ على السّكون لا محلّ له من الإعراب", "ظرف لما يستقبل من الزّمان يتضمّن معنى الشّرط مبنيّ على السّكون في محلّ نصب",
                "ظرف لما مضى من الزّمان مبنيّ على السّكون في محلّ نصب", "حرف شرط جازم مبنيّ على السّكون لا محلّ له من الإعراب"]},
   {"correct": 0}, "إذا: حرف فجاءة مبنيّ على السّكون لا محلّ له من الإعراب.", 0.25, "ar.grammar.irab")
st("s24", "q8", "q8-e1", "mcq", "ما المحلّ الإعرابيّ لجملة (هي التي تنتج الأديب) في قوله: «فالخصومة – أوّل الأمر – في كثير من الأحيان (هي التي تنتج الأديب)»؟",
   {"options": ["جملة اسميّة في محلّ رفع خبر للمبتدأ (الخصومة)", "جملة اسميّة في محلّ نصب حال", "جملة اسميّة في محلّ جرّ نعت", "جملة اسميّة صلة موصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "(هي التي تنتج الأديب): جملة اسميّة في محلّ رفع خبر للمبتدأ (الخصومة).", 0.5, "ar.grammar.sentence_case")
st("s25", "q8", "q8-e2", "mcq", "ما المحلّ الإعرابيّ لجملة (فالفضل في ذلك للنقد) في قوله: «فإذا خرج نتاجهم كاملا… (فالفضل في ذلك للنقد)»؟",
   {"options": ["جملة جواب الشّرط غير الجازم لا محلّ لها من الإعراب", "جملة جواب شرط جازم مقترنة بالفاء في محلّ جزم", "جملة في محلّ رفع خبر", "جملة في محلّ نصب حال"]},
   {"correct": 0}, "(فالفضل في ذلك للنقد): جملة جواب الشّرط غير الجازم لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
MUS_EXPL = ("في «فيكسب الأدب من هذه المعارك مكسبا مزدوجا»: المسند هو «يكسب» وهو فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره (2×0.5)؛ "
            "المسند إليه هو «الأدب» وهو فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره (2×0.5).")
st("s26", "q9", "q9-e1", "mcq", "حدّد المسند في العبارة: «فيكسب الأدب من هذه المعارك مكسبا مزدوجا».",
   {"options": ["يكسب", "الأدب", "مكسبا", "مزدوجا"]}, {"correct": 0}, MUS_EXPL, 0.5, "ar.grammar.rules")
st("s27", "q9", "q9-e2", "mcq", "ما الوظيفة الإعرابيّة للمسند «يكسب»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فعل مضارع منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "فعل مضارع مجزوم وعلامة جزمه السّكون", "فعل ماضٍ مبنيّ على الفتح"]}, {"correct": 0}, MUS_EXPL, 0.5, "ar.grammar.irab")
st("s28", "q9", "q9-e3", "fill_blank", "أكمل: المسند إليه في العبارة هو…",
   {"text": "«____»", "bank": ["الأدب", "مكسبا", "المعارك"]}, {"blanks": [["الأدب"]]}, MUS_EXPL, 0.5, "ar.grammar.rules")
st("s29", "q9", "q9-e4", "mcq", "ما الوظيفة الإعرابيّة للمسند إليه «الأدب»؟",
   {"options": ["فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "نائب فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, MUS_EXPL, 0.5, "ar.grammar.irab")
IMG_EXPL = ("الصّورة البيانيّة: الكناية في قوله: «ويحمل كلّ فريق أقلامهم فيجيدون ويمتعون». وهي كناية عن صفة تتمثّل في غزارة الإنتاج الأدبيّ والإبداع فيه. "
            "وذلك لإبراز فضل النّقد على الأدب دائمًا (4×0.5).")
st("s30", "q10", "q10-e1", "mcq", "أين تكمن الصّورة البيانيّة في العبارة: «ويحمل كلّ فريق أقلامهم فيجيدون ويمتعون»؟",
   {"options": ["في قوله: «يحمل كلّ فريق أقلامهم فيجيدون ويمتعون»", "في لفظة «فريق» وحدها", "في لفظة «يمتعون» وحدها"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s31", "q10", "q10-e2", "mcq", "ما نوع هذه الصّورة؟",
   {"options": ["كناية عن صفة", "كناية عن موصوف", "كناية عن نسبة", "تشبيه بليغ"]}, {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s32", "q10", "q10-e3", "fill_blank", "اشرح الصّورة:",
   {"text": "كناية عن صفة تتمثّل في ____ الإنتاج الأدبيّ و____ فيه.", "bank": ["غزارة", "الإبداع", "قلّة", "التّقليد"]},
   {"blanks": [["غزارة"], ["الإبداع"]]}, IMG_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s33", "q10", "q10-e4", "mcq", "ما القيمة البلاغيّة لهذه الصّورة؟",
   {"options": ["إبراز فضل النّقد على الأدب دائمًا", "إثارة الشّفقة على الأدباء", "تقرير حقيقة علميّة", "إحداث جرس موسيقيّ"]}, {"correct": 0}, IMG_EXPL, 0.5,
   "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
DEF_EXPL = ("تعريف المقال: المقال قطعة نثريّة محدودة الطّول تكتب أساسًا لتنشر على صفحات جريدة أو مجلّة، وتتناول جانبًا من جوانب موضوع ما "
            "بطريقة تجمع بين الإقناع والإمتاع (4×0.25).")
st("s34", "q11", "q11-e1", "mcq", "عرّف فنّ المقال.",
   {"options": ["قطعة نثريّة محدودة الطّول تكتب أساسًا لتنشر على صفحات جريدة أو مجلّة، وتتناول جانبًا من جوانب موضوع ما بطريقة تجمع بين الإقناع والإمتاع",
                "قصيدة شعريّة تتناول موضوعًا واحدًا", "حكاية نثريّة طويلة متعدّدة الشّخصيّات والأحداث", "نصّ حواريّ يُكتب ليُمثَّل على خشبة المسرح"]},
   {"correct": 0}, DEF_EXPL, 0.5, "ar.literature.prose")
st("s35", "q11", "q11-e1", "fill_blank", "أكمل تعريف المقال:",
   {"text": "قطعة ____ محدودة الطّول تكتب أساسًا لتنشر على صفحات جريدة أو مجلّة، وتتناول جانبًا من جوانب موضوع ما بطريقة تجمع بين ____ و____.",
    "bank": ["نثريّة", "الإقناع", "الإمتاع", "شعريّة", "الإطالة", "الغموض"]},
   {"blanks": [["نثريّة", "نثرية"], ["الإقناع"], ["الإمتاع"]]}, DEF_EXPL, 0.5, "ar.literature.prose", "b")
st("s36", "q11", "q11-e2", "multi", "من أبرز أعلام فنّ المقال: (اختر كلّ ما يصحّ)",
   {"options": ["طه حسين", "عبّاس محمود العقّاد", "أحمد أمين", "مصطفى صادق الرّافعي", "محمّد البشير الإبراهيمي", "امرؤ القيس", "المتنبّي"]},
   {"correct": [0, 1, 2, 3, 4]},
   "من أبرز أعلامه: الدّكتور طه حسين، والأستاذ عبّاس محمود العقّاد، والأستاذ أحمد أمين، ومصطفى صادق الرّافعي، والشّيخ محمّد البشير الإبراهيمي… (4×0.25). "
   "أمّا امرؤ القيس والمتنبّي فشاعران قديمان.", 1, "ar.literature.prose")
CHAR_EXPL = ("ومن أهمّ خصائصه ما يلي: السّهولة والوضوح؛ التّركيز والإيجاز؛ وحدة الموضوع؛ الهيكل أو التّصميم (المقدّمة – العرض – الخاتمة… إلخ) (4×0.5).")
st("s37", "q11", "q11-e3", "multi", "من أهمّ خصائص المقال: (اختر كلّ ما يصحّ)",
   {"options": ["السّهولة والوضوح", "التّركيز والإيجاز", "وحدة الموضوع", "الهيكل أو التّصميم (المقدّمة – العرض – الخاتمة)", "الوزن والقافية",
                "تعدّد الشّخصيّات والأحداث", "الإطالة والاستطراد"]},
   {"correct": [0, 1, 2, 3]}, CHAR_EXPL, 1, "ar.literature.features")
st("s38", "q11", "q11-e3", "fill_blank", "أكمل خصائص المقال:",
   {"text": "السّهولة و____، التّركيز و____، وحدة ____، الهيكل أو التّصميم.", "bank": ["الوضوح", "الإيجاز", "الموضوع", "الغموض", "الإطالة", "الشّخصيّات"]},
   {"blanks": [["الوضوح"], ["الإيجاز"], ["الموضوع"]]}, CHAR_EXPL, 1, "ar.literature.features", "b")

TITLE = "بكالوريا 2010 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (أحمد أمين: نعمة الخصومة على الأدب)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2010، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "وُصلت أسطر الفقرة الثّالثة المقطوعة في docx. العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص3، صورة ممسوحة). "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. البناء اللّغويّ س1: «لولا» 2×0.25، و«2×0.25» بين «الخصومة» و«إذا» (0.25 لكلّ منهما). "
         "مؤجَّل (essay_builder): الرّأي وتعليله في س2 (0.25 + 0.25) والتّلخيص س6 (2، أربعة أنصاف بثلاثة معايير دون توزيع).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
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
