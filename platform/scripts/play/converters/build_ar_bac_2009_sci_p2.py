"""Conversion: BAC 2009 (session عاديّة، جوان 2009) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (أحمد أمين، «الحقّ والواجب»).
Exam source: the official ONEC paper gdrive 1I3G9wriYDGwdRWNKio6GAOeatH5GJBQ3 (01_الموضوع.pdf, pages 3–4; scanned at 300 dpi,
no text layer); same scan under gdrive 1KK-e_SdmXvoy8soWeMT8N5wKQRgHhz2r, owner's copy gdrive 1_2hxdC9bNmJW5FZSmhx8rlws8i7V-4vA
(image-only).
Official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1iLHfDBvaBhyn9WUFi94_G24a-chknV0p (02_التصحيح.pdf, pages 3–4).

NO 2009 DOCX EXISTS: the files given for this unit — gdrive 1v-CBr9F9mu6ecdYWzlFIaS4Moi0gW1pc («بكالوريا لغة عربية 2010 علوم
تجريبية.docx») and its PDF 1462CU2EwZYXHOuFdR4IbrHJFzW3d5A5c — are the BAC 2010 paper; a Drive search found no other 2009 text
export. The verbatim strings below were therefore TRANSCRIBED BY HAND from the ONEC scan (native 300-dpi page images, line crops
enlarged ×3 for the diacritics), keeping the printed spelling, diacritics and punctuation spacing as far as the scan shows them
(«حقٌّ»، «أَن يحترموا» / «أنَ يستعمل» / «أنَ استعمل» / «أنِ أعمل» as printed, «فاستطيع»، «اتبع» without hamza, «( كان لي بيت)»،
«( ينفّذ الواجب )» and «و(هو عامر)» — the last two printed in a faint outline font but legible at 300 dpi). The printed line
wraps are joined with a space into the paper's two paragraphs. Residual risk: a hand transcription can differ from the original
typing in invisible ways (order of stacked marks, tatweel vs dash in «ــ», number of spaces) — the owner should compare it once
with the paper. Underlines from the scan: «متلازمان» (§1), «البيت» (§1 «هذا البيت»).
The correction is a scanned PDF (no text layer), read from the native page images (198 dpi, crops). Every mark comes from the
official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC header «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» (scheme «الشّعب المشتركة») ⇒ SCI, MATH, TM, GE.
  Two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «1». Q2 «2×0.5 + 2×0.5» = for each duty: whose duty / its content ⇒ four elements. Q3 «2×1» with «تنبيه: يكتفي
  المترشّح بذكر مثال واحد» = the two duties of the chosen example ⇒ two elements; the steps use the house example (the first
  one of the scheme) and say so in the prompt, so the other accepted example is never marked wrong. Q4 «2×0.5» = القانون
  الوضعيّ / القانون الأخلاقيّ. Q5 «2×1» (no contradiction / the positive law is sometimes insufficient) + «0.5» the opinion
  («يبدي المترشّح رأيه مع الإقناع» ⇒ deferred essay_builder, rule 11). Q6 «0.5» (فنّ المقال) + «4×0.25» four features listed
  (the question asks for «ميزة بارزة»; the scheme lists four ⇒ one element of 1). Q7 (تلخيص): the column prints «0.5 / 1 / 0.5»
  one row above «دلالة المضمون / احترام تقنية التّلخيص / جودة الأسلوب وسلامة اللّغة» ⇒ read as 0.5 / 1 / 0.5 in that order
  (to be confirmed by the owner) ⇒ three deferred essay_builder elements.
- Part 2: Q1 «0.5 + 0.5» one per word. Q2 «3×0.5» one per sentence. Q3 «2×1» = the two reasons. Q4 «4×0.5» one per
  expression. Q5 «0.5» the pattern (التّفسيريّ) + «4×0.25» four indicators listed ⇒ one element of 1.
- Distractors avoid arguable alternatives: no «نعت» / «عطف بيان» for «البيت» after «هذا» (the scheme says بدل), no «جملة
  الشّرط لا محلّ لها» for «كان لي بيت» (the scheme says مضاف إليه), no «القاضي / المحاكم» as the wrong executor of the
  first duty, no «الرّأي العامّ / صاحب الحقّ» as the wrong answer for the second.
- Deferred: Q5 opinion (0.5) + Q7 summary (2) = 2.5 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2009-sci-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE"]
OFFICIAL_ID = "1I3G9wriYDGwdRWNKio6GAOeatH5GJBQ3"
OFFICIAL_TITLE = "01_الموضوع.pdf"
OWNER_PDF_ID = "1_2hxdC9bNmJW5FZSmhx8rlws8i7V-4vA"
WRONG_DOCX_ID = "1v-CBr9F9mu6ecdYWzlFIaS4Moi0gW1pc"
CORR_ID = "1iLHfDBvaBhyn9WUFi94_G24a-chknV0p"

# ── النّصوص الحرفيّة (منسوخة يدويًّا من صورة الموضوع الرّسميّ، سطرًا سطرًا كما طُبعت؛ لا يوجد ملفّ docx لموضوع 2009) ──
LINES_1 = [
    "الحق والواجب متلازمان ، فمتى كان لشخص حقٌّ كان هناك واجب، بل الواقع أنّ كلّ حقّ يستلزم",
    "واجبين: واجبا على النّاس أَن يحترموا حقّ ذي الحقّ ولا يعترضوا له أثناء فعله، وواجبا على ذي الحقّ",
    "نفسه، وهو أنَ يستعمل حقّه في خيره وخير النّاس ، فمثلا إذا ( كان لي بيت) فهو حقّ لي، وذلك يستلزم",
    "واجبين: واجبا على النّاس ألاّ يتعدّوا على هذا البيت بضرر، وأن يحترموا حقّي في ملكيته، وواجبا عليّ",
    "وهو أنَ استعمل البيت في خيري وخير النّاس، فإذا أشعلت فيه نارا أريد إحراقه، أو آذيت النّاس بإيجاره",
    "لعمل مقلق للراحة لم أكن أدّيت ما وجب عليّ، وهكذا .",
]
LINES_2 = [
    "ولكنّ جهة التنفيذ في الواجبين ليست واحدة ؛ فالذي ( ينفّذ الواجب ) الأوّل هو القانون الوضعيّ",
    "ــ غالبا ــ فإذا تعدّى أحد على بيتي فغصبه منّي كان القانون الوضعيّ هو الذي يحميني ، فاستطيع أن",
    "أرفع الأمر إلى المحاكم ، والقاضي يلزمه بمراعاة حقّي وينفّذ ما يجب عليه، أمّا الواجب الثاني ــ وهو",
    "الواجب عليّ في استعمال حقّي على أحسن وجه ــ فليس الذي ينفّذه هو القانون الوضعيّ ــ غالبا ــ",
    "وإنّما يأمر به القانون الأخلاقيّ ، ويترك تنفيذه إلى ذي الحقّ نفسه، وإلى الرأي العام ، فلو أنّي هدمت",
    "بيتي و(هو عامر) ، أو أتلفت هندسته ، أو تركته مهجورا لا أسْكُنه ولا أُسكنه لم يتدخل القانون الوضعيّ",
    "في ذلك وإنّما يتدخل القانون الأخلاقيّ ، فيأمرني أنِ أعمل الواجب عليّ من استعمال بيتي لخيري وخير",
    "النّاس، ويلومني إذا لم اتبع ذلك، وكذلك يلومني الرأي العام، فإذا قال القانون الوضعيّ : « لكلّ مالك أن",
    "يتصرّف في ملكه كيف يشاء »  فإنّ الأخلاق تقول:« ليس للمالك أن يتصرّف في ملكه إلاّ بما فيه الخير",
    "له وللنّاس».",
]
TEXT = " ".join(LINES_1) + "\n" + " ".join(LINES_2)
AUTHOR = "أحمد أمين"
P1 = "أ ــ البناء الفكريّ: (12 نقطة)"
P2 = "ب ــ البناء اللغويّ: (08 نقاط)"
QT = {
    1: "ما العلاقة بين الحقّ والواجب كما وردت في النّص؟",
    2: "ما هما واجبا الحقّ كما بيّنهما الكاتب؟",
    3: "استخرج من النّص مثالا عزّز به الكاتب وجهة نظره.",
    4: "إلى من تعود مسؤولية تنفيذ الواجب في نظر أحمد أمين ؟",
    5: "هل يتعارض القانون الوضعيّ مع القانون الأخلاقيّ؟ وأيّهما أجدر بحلّ مشاكل النّاس في نظرك؟",
    6: "إلى أيّ نوع من أنواع النّثر ينتمي هذا النّص؟ اذكر ميزة بارزة من ميزاته.",
    7: "لخّص مضمون النّص بأسلوبك الخاص.",
    8: "أعرب ما تحته سطر.",
    9: "بيّن المحلّ الإعرابيّ للجمل المحصورة بين قوسين.",
    10: "يكاد النّص يخلو من الخيال بمَ تعلّل ذلك؟",
    11: ("ميّز فيما يأتي التعابير الحقيقيّة من التعابير المجازيّة مع التعليل:\n- « قال القانون الوضعيّ ».\n- « كان لي بيت ».\n"
         "- « أشعلت فيه نارا ».\n- « القانون الوضعيّ هو الذي يحميني »."),
    12: "ما النّمط التعبيريّ الغالب على النّص؟علّل.",
}
assert TEXT.count("( كان لي بيت)") == 1 and TEXT.count("( ينفّذ الواجب )") == 1 and TEXT.count("و(هو عامر)") == 1
assert "متلازمان" in TEXT and "هذا البيت" in TEXT
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": TEXT},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": AUTHOR},
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


q("q1", "1", P1, QT[1], 1, [el("q1-e1", "العلاقة بين الحقّ والواجب", 1)])
q("q2", "2", P1, QT[2], 2, [el("q2-e1", "الواجب الأوّل: على مَن يقع", 0.5), el("q2-e2", "الواجب الأوّل: مضمونه", 0.5),
                           el("q2-e3", "الواجب الثّاني: على مَن يقع", 0.5), el("q2-e4", "الواجب الثّاني: مضمونه", 0.5)])
q("q3", "3", P1, QT[3], 2, [el("q3-e1", "المثال: الواجب الأوّل", 1), el("q3-e2", "المثال: الواجب الثّاني", 1)])
q("q4", "4", P1, QT[4], 1, [el("q4-e1", "القانون الوضعيّ", 0.5), el("q4-e2", "القانون الأخلاقيّ", 0.5)])
q("q5", "5", P1, QT[5], 2.5, [el("q5-e1", "التّعارض بين القانونين في نظر الكاتب", 1), el("q5-e2", "قصور القانون الوضعيّ أحيانًا", 1),
                             el("q5-e3", "أيّ القانونين أجدر (رأي المترشّح)", 0.5)])
q("q6", "6", P1, QT[6], 1.5, [el("q6-e1", "نوع النّثر", 0.5), el("q6-e2", "ميزات المقال في النّصّ (4×0.25)", 1)])
q("q7", "7", P1, QT[7], 2, [el("q7-e1", "التّلخيص: دلالة المضمون", 0.5), el("q7-e2", "التّلخيص: احترام تقنية التّلخيص", 1),
                           el("q7-e3", "التّلخيص: جودة الأسلوب وسلامة اللّغة", 0.5)])
q("q8", "1", P2, QT[8], 1, [el("q8-e1", "إعراب «متلازمان»", 0.5), el("q8-e2", "إعراب «البيت»", 0.5)])
q("q9", "2", P2, QT[9], 1.5, [el("q9-e1", "محلّ جملة (كان لي بيت)", 0.5), el("q9-e2", "محلّ جملة (ينفّذ الواجب)", 0.5),
                             el("q9-e3", "محلّ جملة (هو عامر)", 0.5)])
q("q10", "3", P2, QT[10], 2, [el("q10-e1", "السّبب الأوّل", 1), el("q10-e2", "السّبب الثّاني", 1)])
q("q11", "4", P2, QT[11], 2, [el("q11-e1", "«قال القانون الوضعيّ»", 0.5), el("q11-e2", "«كان لي بيت»", 0.5),
                             el("q11-e3", "«أشعلت فيه نارا»", 0.5), el("q11-e4", "«القانون الوضعيّ هو الذي يحميني»", 0.5)])
q("q12", "5", P2, QT[12], 1.5, [el("q12-e1", "النّمط الغالب وتعليله", 0.5), el("q12-e2", "مؤشّراته (4×0.25)", 1)])

# ── أ: البناء الفكريّ ──
REL_EXPL = "العلاقة بين الحقّ والواجب كما وردت في النّصّ هي علاقة تلازم، كلّ منهما يستدعي الآخر."
st("s01", "q1", "q1-e1", "mcq", "ما العلاقة بين الحقّ والواجب كما وردت في النّصّ؟",
   {"options": ["علاقة تلازم", "علاقة تعارض", "علاقة انفصال", "علاقة تفاضل"]}, {"correct": 0}, REL_EXPL, 0.5, "ar.comprehension.link")
st("s02", "q1", "q1-e1", "fill_blank", "وضّح هذه العلاقة:",
   {"text": "كلّ منهما ____ الآخر.", "bank": ["يستدعي", "ينفي", "يلغي"]}, {"blanks": [["يستدعي"]]}, REL_EXPL, 0.5, "ar.comprehension.link", "b")
DUT_EXPL = ("للحقّ — في نظر الكاتب — واجبان هما: واجب النّاس نحو صاحب الحقّ، وهو أن يحترموا حقّه ويقرّوا له به؛ "
            "وواجب صاحب الحقّ نفسه، وهو أن يستعمل حقّه في الخير لنفسه وللنّاس.")
st("s03", "q2", "q2-e1", "mcq", "على مَن يقع الواجب الأوّل من واجبي الحقّ؟",
   {"options": ["على النّاس نحو صاحب الحقّ", "على الدّولة نحو المواطنين", "على الأبناء نحو آبائهم", "على التّجّار نحو زبائنهم"]},
   {"correct": 0}, DUT_EXPL, 0.5, "ar.comprehension.details")
st("s04", "q2", "q2-e2", "fill_blank", "أكمل مضمون واجب النّاس نحو صاحب الحقّ:",
   {"text": "وهو أن ____ حقّه و____ له به.", "bank": ["يحترموا", "يقرّوا", "ينكروا", "يغتصبوا"]},
   {"blanks": [["يحترموا"], ["يقرّوا"]]}, DUT_EXPL, 0.5, "ar.comprehension.details")
st("s05", "q2", "q2-e3", "mcq", "وعلى مَن يقع الواجب الثّاني؟",
   {"options": ["على صاحب الحقّ نفسه", "على النّاس جميعًا", "على القانون الوضعيّ", "على الجيران وحدهم"]},
   {"correct": 0}, DUT_EXPL, 0.5, "ar.comprehension.details")
st("s06", "q2", "q2-e4", "mcq", "ما مضمون واجب صاحب الحقّ نفسه؟",
   {"options": ["أن يستعمل حقّه في الخير لنفسه وللنّاس", "أن يتصرّف في ملكه كيف يشاء", "أن يتنازل عن حقّه لغيره", "أن يكتم حقّه عن النّاس"]},
   {"correct": 0}, DUT_EXPL + " أمّا «لكلّ مالك أن يتصرّف في ملكه كيف يشاء» فهو قول القانون الوضعيّ.", 0.5, "ar.comprehension.details")
EX_EXPL = ("من الأمثلة الّتي عزّز بها الكاتب وجهة نظره: مثل حقّ ملكيّة البيت الّذي يستلزم واجبين: أ- واجب النّاس، وهو احترامهم لهذه الملكيّة، وعدم "
           "اعتدائهم على البيت؛ ب- واجب صاحب البيت، وهو أن يستعمله في الخير، وألاّ يستخدمه فيما يؤذي النّاس. ومثل تنفيذ الواجب بين القانون الوضعيّ "
           "والقانون الأخلاقيّ. (يكتفي المترشّح بذكر مثال واحد.)")
st("s07", "q3", "q3-e1", "mcq", "في مثال ملكيّة البيت الّذي عزّز به الكاتب وجهة نظره، ما واجب النّاس؟",
   {"options": ["احترامهم لهذه الملكيّة، وعدم اعتدائهم على البيت", "أن يشاركوا صاحبه في سكناه", "أن يدفعوا له أجرة سنويّة", "أن يحرسوه له ليلًا ونهارًا"]},
   {"correct": 0}, EX_EXPL, 0.5, "ar.comprehension.evidence")
st("s08", "q3", "q3-e1", "fill_blank", "أكمل من النّصّ واجب النّاس في هذا المثال:",
   {"text": "واجبا على النّاس ألاّ ____ على هذا البيت بضرر، وأن يحترموا حقّي في ____.", "bank": ["يتعدّوا", "ملكيته", "يسكنوا", "هندسته"]},
   {"blanks": [["يتعدّوا"], ["ملكيته"]]}, EX_EXPL, 0.5, "ar.comprehension.evidence", "b")
st("s09", "q3", "q3-e2", "mcq", "وفي المثال نفسه، ما واجب صاحب البيت؟",
   {"options": ["أن يستعمله في الخير، وألاّ يستخدمه فيما يؤذي النّاس", "أن يتصرّف فيه كيف يشاء", "أن يبيعه لمن يدفع أكثر", "أن يغلقه في وجه النّاس"]},
   {"correct": 0}, EX_EXPL, 0.5, "ar.comprehension.evidence")
st("s10", "q3", "q3-e2", "multi", "أيّ الأفعال الآتية يُخلّ بها صاحب البيت بواجبه كما يذكر النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["أن يُشعل فيه نارًا يريد إحراقه", "أن يؤجّره لعمل مقلق للرّاحة", "أن يهدمه وهو عامر", "أن يسكنه ويعتني به", "أن يستعمله لخيره وخير النّاس"]},
   {"correct": [0, 1, 2]}, EX_EXPL, 0.5, "ar.comprehension.evidence", "b")
EXE_EXPL = ("تعود مسؤوليّة تنفيذ الواجب عند «أحمد أمين» إلى قانونين: القانون الوضعيّ والقانون الأخلاقيّ؛ فالّذي ينفّذ الواجب الأوّل (حماية ملكيّة البيت) "
            "هو القانون الوضعيّ — غالبًا —، أمّا الواجب الثّاني (استعمال الحقّ على أحسن وجه) فيأمر به القانون الأخلاقيّ.")
st("s11", "q4", "q4-e1", "mcq", "مَن ينفّذ الواجب الأوّل (احترام ملكيّة البيت وحمايتها) في نظر أحمد أمين؟",
   {"options": ["القانون الوضعيّ", "القانون الأخلاقيّ", "صاحب البيت نفسه", "الجيران"]}, {"correct": 0}, EXE_EXPL, 0.5, "ar.comprehension.details")
st("s12", "q4", "q4-e2", "mcq", "ومَن يأمر بالواجب الثّاني (استعمال الحقّ على أحسن وجه)؟",
   {"options": ["القانون الأخلاقيّ", "القانون الوضعيّ", "القاضي والمحاكم", "الشّرطة"]}, {"correct": 0}, EXE_EXPL, 0.5, "ar.comprehension.details")
LAW_EXPL = ("لا يرى الكاتب تعارضًا بين القانون الوضعيّ والقانون الأخلاقيّ، إنّما اعتبر القانون الوضعيّ قاصرًا — أحيانًا — في حلّ الإشكالات الدّقيقة "
            "الّتي يكون القانون الأخلاقيّ أولى بها. أيّ القانونين أجدر بحلّ مشاكل النّاس؟ يبدي المترشّح رأيه مع الإقناع.")
st("s13", "q5", "q5-e1", "mcq", "هل يتعارض القانون الوضعيّ مع القانون الأخلاقيّ في نظر الكاتب؟",
   {"options": ["لا يرى الكاتب تعارضًا بينهما", "نعم، يراهما متناقضين لا يجتمعان", "يرى أنّ القانون الوضعيّ يُغني عن القانون الأخلاقيّ",
                "يرى أنّ القانون الأخلاقيّ يلغي القانون الوضعيّ"]},
   {"correct": 0}, LAW_EXPL, 1, "ar.comprehension.idea")
st("s14", "q5", "q5-e2", "fill_blank", "أكمل موقف الكاتب:",
   {"text": "إنّما اعتبر القانون الوضعيّ ____ — أحيانًا — في حلّ الإشكالات ____ الّتي يكون القانون الأخلاقيّ أولى بها.",
    "bank": ["قاصرًا", "الدّقيقة", "كافيًا", "البسيطة"]},
   {"blanks": [["قاصرًا", "قاصرا"], ["الدّقيقة"]]}, LAW_EXPL, 1, "ar.comprehension.explain")
essay("s15", "q5", "q5-e3", "أيّ القانونين أجدر بحلّ مشاكل النّاس؟", "إبداء الرّأي", "يبدي المترشّح رأيه مع الإقناع", 0.5,
      {"task": "إبداء الرّأي: أيّ القانونين (الوضعيّ أم الأخلاقيّ) أجدر بحلّ مشاكل النّاس", "question": QT[5],
       "scheme": "«0.5»: أيّ القانونين أجدر بحلّ مشاكل النّاس في نظرك؟ يبدي المترشّح رأيه مع الإقناع"},
      LAW_EXPL, "ar.comprehension.opinion")
ART_EXPL = ("يصنَّف النّصّ ضمن فنّ المقال، ومن خصائصه البارزة في النّصّ: ورود النّصّ في شكل قطعة نثريّة محدودة الطّول تعالج موضوعًا محدّدًا "
            "«الحقّ والواجب»؛ خضوع النّصّ للتّدرّج في عرض الأفكار؛ شيوع روح التّحليل، والتّفصيل بعد الإجمال؛ استعمال وسائل الإيضاح والإقناع.")
st("s16", "q6", "q6-e1", "mcq", "إلى أيّ نوع من أنواع النّثر ينتمي هذا النّصّ؟",
   {"options": ["فنّ المقال", "القصّة القصيرة", "الرّواية", "المسرحيّة"]}, {"correct": 0}, ART_EXPL, 0.5, "ar.literature.prose")
st("s17", "q6", "q6-e2", "multi", "أيّ ممّا يلي من خصائص المقال البارزة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["ورود النّصّ في شكل قطعة نثريّة محدودة الطّول تعالج موضوعًا محدّدًا", "خضوع النّصّ للتّدرّج في عرض الأفكار",
                "شيوع روح التّحليل، والتّفصيل بعد الإجمال", "استعمال وسائل الإيضاح والإقناع", "تعدّد الشّخصيّات وتنامي الأحداث", "الالتزام بالوزن والقافية"]},
   {"correct": [0, 1, 2, 3]}, ART_EXPL, 1, "ar.literature.features")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ بالأسلوب الخاصّ", "text": "أحمد أمين، الحقّ والواجب (بكالوريا 2009، الشّعب العلميّة، الموضوع الثّاني)",
            "scheme": "يراعى فيه: دلالة المضمون (0.5) – احترام تقنية التّلخيص (1) – جودة الأسلوب وسلامة اللّغة (0.5)", "model_example": None}
SUM_EXPL = "تلخيص النّصّ: يراعى فيه دلالة المضمون (0.5)، احترام تقنية التّلخيص (1)، جودة الأسلوب وسلامة اللّغة (0.5)."
for sid, eid, crit, ind, pts in [("s18", "q7-e1", "المضمون", "دلالة المضمون", 0.5), ("s19", "q7-e2", "التّقنية", "احترام تقنية التّلخيص", 1),
                                 ("s20", "q7-e3", "اللّغة والأسلوب", "جودة الأسلوب وسلامة اللّغة", 0.5)]:
    essay(sid, "q7", eid, "تلخيص مقال أحمد أمين", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ب: البناء اللّغويّ ──
IRAB_EXPL = "متلازمان: خبر مرفوع وعلامة رفعه الألف لأنّه مثنّى. البيت: بدل من اسم الإشارة مجرور وعلامة جرّه الكسرة."
st("s21", "q8", "q8-e1", "mcq", "ما إعراب «متلازمان» في قوله: «الحقّ والواجب متلازمان»؟",
   {"options": ["خبر مرفوع وعلامة رفعه الألف لأنّه مثنّى", "خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة", "مبتدأ مؤخّر مرفوع وعلامة رفعه الألف لأنّه مثنّى",
                "حال منصوبة وعلامة نصبها الياء لأنّه مثنّى"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
st("s22", "q8", "q8-e2", "mcq", "ما إعراب «البيت» في قوله: «ألاّ يتعدّوا على هذا البيت بضرر»؟",
   {"options": ["بدل من اسم الإشارة مجرور وعلامة جرّه الكسرة", "مضاف إليه مجرور وعلامة جرّه الكسرة", "اسم مجرور بحرف الجرّ «على» وعلامة جرّه الكسرة",
                "مفعول به منصوب وعلامة نصبه الفتحة"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.badal")
SENT_EXPL = ("«كان لي بيت»: جملة فعليّة في محلّ جرّ مضاف إليه. «ينفّذ الواجب»: جملة فعليّة صلة الموصول لا محلّ لها من الإعراب. "
             "«هو عامر»: جملة اسميّة في محلّ نصب حال.")
st("s23", "q9", "q9-e1", "mcq", "ما المحلّ الإعرابيّ لجملة (كان لي بيت) في قوله: «فمثلا إذا (كان لي بيت) فهو حقّ لي»؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب حال", "جملة جواب شرط لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, SENT_EXPL, 0.5, "ar.grammar.sentence_case")
st("s24", "q9", "q9-e2", "mcq", "ما المحلّ الإعرابيّ لجملة (ينفّذ الواجب) في قوله: «فالذي (ينفّذ الواجب) الأوّل هو القانون الوضعيّ»؟",
   {"options": ["جملة فعليّة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ رفع نعت", "جملة فعليّة في محلّ نصب حال"]},
   {"correct": 0}, SENT_EXPL, 0.5, "ar.grammar.sentence_case")
st("s25", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (هو عامر) في قوله: «فلو أنّي هدمت بيتي و(هو عامر)»؟",
   {"options": ["جملة اسميّة في محلّ نصب حال", "جملة اسميّة في محلّ رفع نعت", "جملة اسميّة في محلّ رفع خبر", "جملة اسميّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, SENT_EXPL, 0.5, "ar.grammar.sentence_case")
IMAG_EXPL = ("يكاد النّصّ يخلو من الخيال، ويرجع ذلك إلى: أنّ النّصّ مقال موضوعيّ تسوده روح علميّة ممّا جعل أسلوبه أقرب إلى الأسلوب العلميّ المباشر؛ "
             "وأنّ هدف النّصّ الإقناع ومخاطبة العقل، لا التّأثير في العواطف.")
st("s26", "q10", "q10-e1", "mcq", "بمَ تعلّل خلوّ النّصّ تقريبًا من الخيال؟",
   {"options": ["النّصّ مقال موضوعيّ تسوده روح علميّة ممّا جعل أسلوبه أقرب إلى الأسلوب العلميّ المباشر", "الكاتب يجهل فنون البيان",
                "النّصّ قصّة واقعيّة تروي أحداثًا", "الكاتب كتب نصّه على عجل"]},
   {"correct": 0}, IMAG_EXPL, 1, "ar.rhetoric.style")
st("s27", "q10", "q10-e2", "fill_blank", "أكمل السّبب الثّاني:",
   {"text": "هدف النّصّ ____ ومخاطبة ____، لا التّأثير في العواطف.", "bank": ["الإقناع", "العقل", "الإمتاع", "القلب"]},
   {"blanks": [["الإقناع"], ["العقل"]]}, IMAG_EXPL, 1, "ar.rhetoric.style")
EXPR_EXPL = ("«قال القانون الوضعيّ»: عبارة مجازيّة لأنّ القانون لا يقول. «كان لي بيت»: عبارة حقيقيّة تعني ملكيّة البيت لصاحبه. «أشعلت فيه نارا»: عبارة حقيقيّة "
             "تدلّ على حدث يمكن حصوله. «القانون الوضعيّ هو الّذي يحميني»: عبارة مجازيّة، ذلك أنّ الّذي يحمي فعلًا هم القائمون على تطبيق القانون وليس القانون ذاته.")
st("s28", "q11", "q11-e1", "mcq", "«قال القانون الوضعيّ»: ميّز العبارة مع التّعليل.",
   {"options": ["عبارة مجازيّة لأنّ القانون لا يقول", "عبارة حقيقيّة لأنّ القانون يقول أحكامه فعلًا", "عبارة حقيقيّة تدلّ على حدث يمكن حصوله"]},
   {"correct": 0}, EXPR_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s29", "q11", "q11-e2", "mcq", "«كان لي بيت»: ميّز العبارة مع التّعليل.",
   {"options": ["عبارة حقيقيّة تعني ملكيّة البيت لصاحبه", "عبارة مجازيّة لأنّ البيت لا يُملك", "عبارة مجازيّة لأنّ المقصود بالبيت الوطن"]},
   {"correct": 0}, EXPR_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s30", "q11", "q11-e3", "mcq", "«أشعلت فيه نارا»: ميّز العبارة مع التّعليل.",
   {"options": ["عبارة حقيقيّة تدلّ على حدث يمكن حصوله", "عبارة مجازيّة لأنّ النّار هنا نار الفتنة", "عبارة مجازيّة لأنّ البيت لا يحترق"]},
   {"correct": 0}, EXPR_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s31", "q11", "q11-e4", "mcq", "«القانون الوضعيّ هو الّذي يحميني»: ميّز العبارة مع التّعليل.",
   {"options": ["عبارة مجازيّة، لأنّ الّذي يحمي فعلًا هم القائمون على تطبيق القانون وليس القانون ذاته", "عبارة حقيقيّة لأنّ القانون يحمي بنفسه",
                "عبارة حقيقيّة تعني ملكيّة البيت لصاحبه"]},
   {"correct": 0}, EXPR_EXPL, 0.5, "ar.rhetoric.metonymy")
TYPE_EXPL = ("النّمط الغالب على النّصّ هو النّمط التّفسيريّ، ذلك أنّ الكاتب يفسّر علاقة الحقّ بالواجب. ومن مؤشّراته: التّركيز على الموضوعيّة وتجنّب الذّاتيّة؛ "
             "تحديد الموضوع أو الإشكاليّة وهي «علاقة الحقّ بالواجب»؛ شرح الفكرة بالاستناد إلى الشّواهد والأمثلة والأدلّة (مثل البيت)؛ استخدام أساليب "
             "التّأكيد مثل: «وإنّما يأمر به القانون الأخلاقيّ»، «فإنّ الأخلاق تقول…».")
st("s32", "q12", "q12-e1", "mcq", "ما النّمط التّعبيريّ الغالب على النّصّ، ولماذا؟",
   {"options": ["النّمط التّفسيريّ، لأنّ الكاتب يفسّر علاقة الحقّ بالواجب", "النّمط السّرديّ، لأنّ الكاتب يروي قصّة بيته",
                "النّمط الوصفيّ، لأنّ الكاتب يصف البيت وهندسته", "النّمط الحواريّ، لأنّ الكاتب يحاور القاضي"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s33", "q12", "q12-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط التّفسيريّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّركيز على الموضوعيّة وتجنّب الذّاتيّة", "تحديد الموضوع أو الإشكاليّة: «علاقة الحقّ بالواجب»",
                "شرح الفكرة بالاستناد إلى الشّواهد والأمثلة والأدلّة (مثل البيت)", "استخدام أساليب التّأكيد: «وإنّما يأمر به القانون الأخلاقيّ»",
                "تتابع الأحداث وتطوّرها في الزّمن", "كثرة الصّور البيانيّة والتّعبير عن العواطف"]},
   {"correct": [0, 1, 2, 3]}, TYPE_EXPL, 1, "ar.text.type")

TITLE = "بكالوريا 2009 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (أحمد أمين: الحقّ والواجب)"
NOTES = ("موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2009، شعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة: gdrive:{OFFICIAL_ID} ({OFFICIAL_TITLE}، ص3–4، صورة ممسوحة)، ونسخة صاحب المنصّة gdrive:{OWNER_PDF_ID}. "
         f"لا يوجد ملفّ docx لموضوع 2009: الملفّ المقدَّم gdrive:{WRONG_DOCX_ID} هو موضوع بكالوريا 2010؛ لذلك نُسخ النّصّ الحرفيّ يدويًّا من صورة الموضوع "
         "الرّسميّ (300 نقطة في البوصة، مع تكبير الحركات) ووُصلت أسطره في فقرتيه، ويُستحسن أن يقابله صاحب المنصّة بالورقة مرّة واحدة. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص3–4، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
         "التّلخيص س7: العلامات 0.5/1/0.5 مطبوعة أعلى بسطر من معاييرها فقُرئت بالتّرتيب (اجتهاد يُراجَع). "
         "مؤجَّل (essay_builder): الرّأي في س5 (0.5) والتّلخيص س7 (2).")
LOG_NOTE = ("تحويل من صورة الموضوع الرّسميّ (منسوخ يدويًّا لغياب docx لسنة 2009) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ "
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
        "source_id": f"gdrive-{OFFICIAL_ID}-p{PAPER}",
        "kind": "BAC", "year": 2009, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": f"https://drive.google.com/file/d/{OFFICIAL_ID}/view",
        "original_file_ref": f"gdrive:{OFFICIAL_ID} ({OFFICIAL_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T17:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
