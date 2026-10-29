"""Conversion: BAC 2009 (session عاديّة، جوان 2009) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (إيليا أبو ماضي، «خذ ما استطعت»).
Exam source: the official ONEC paper gdrive 1I3G9wriYDGwdRWNKio6GAOeatH5GJBQ3 (01_الموضوع.pdf, pages 1–2; scanned at 300 dpi,
no text layer); same scan under gdrive 1KK-e_SdmXvoy8soWeMT8N5wKQRgHhz2r, owner's copy gdrive 1_2hxdC9bNmJW5FZSmhx8rlws8i7V-4vA
(BAC 2009 - اللغة العربية - الشعب العلمية.pdf, image-only).
Official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1iLHfDBvaBhyn9WUFi94_G24a-chknV0p (02_التصحيح.pdf, pages 1–2).

NO 2009 DOCX EXISTS: the files given for this unit — gdrive 1v-CBr9F9mu6ecdYWzlFIaS4Moi0gW1pc («بكالوريا لغة عربية 2010 علوم
تجريبية.docx») and its PDF 1462CU2EwZYXHOuFdR4IbrHJFzW3d5A5c — are the BAC 2010 paper (توفيق الحكيم «فنّ الأدب» / مفدي زكرياء),
whose headers read «بكالوريا 2010»; a Drive search found no other 2009 text export. The verbatim strings below were therefore
TRANSCRIBED BY HAND from the ONEC scan (native 300-dpi page images, line crops enlarged ×3–4 for the diacritics), keeping the
printed spelling, diacritics, punctuation and spacing of punctuation as far as the scan shows them («خُذ»، «دمنَةً خُبثها»،
«لَو السَّماء طَوَت عنَّا دَراريها؟»، «تُؤَاسيك ، أو»، «فيْ النَّصَّ»…). Residual risk: a hand transcription can differ from the
original typing in invisible ways (order of stacked marks, tatweel vs dash in «ــ», number of spaces) — the owner should
compare it once with the paper. The verses are not numbered on the paper; the row labels «1-»…«9-» are added only so the poem
renders as numbered verses (the questions cite «البيت الثّاني» and the scheme cites verses by number). Underline from the
scan: «منحبسٌ» (ب7); bracketed sentence (استطعت) (ب1).
The correction is a scanned PDF (no text layer), read from the native page images (198 dpi, crops). Every mark comes from
the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC header «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» (scheme «الشّعب المشتركة») ⇒ SCI, MATH, TM, GE.
  This paper has two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «0.75 + 0.75» = what he calls to / what he warns against. Q2 «1 + 1» = the romantic influence / its explanation.
  Q3 «0.5 + 0.5 + 2×0.5» = the contemplation of nature / the symbols (الوردة والماء ↔ الدّمنة) / two example verses (verses
  2 and 6 in the scheme; other verses may be acceptable ⇒ one element of 1, the steps ask only which of verses with no nature
  imagery cannot illustrate it). Q4 «1 + 1» = water / money. Q5 «1 + 0.5» = the value / the verses (1، 2، 3، و6).
  Q6 (تلخيص) «3×1» = حجم التّلخيص / دلالته على المضمون / سلامة اللّغة وجودة الأسلوب ⇒ three deferred essay_builder elements.
- Part 2: Q1 «1» («منحبس»: خبر مرفوع). Q2 «1» ((استطعت) صلة الموصول). Q3 «1 + 0.5» = the call/urging / the poet's aim.
  Q4 «6×0.5» over the two patterns (الأمريّ الإيعازيّ الغالب ‹its reason, its indicator› + الحجاجيّ خادم له ‹two indicators›)
  ⇒ six elements: النّمط الأوّل / سبب غلبته / مؤشّره / النّمط الثّاني ودوره / مؤشّر أ / مؤشّر ب — the split of the «6×0.5» is
  the converter's reading of the scheme's six statements, to be confirmed by the owner. Q5 «3×0.5» = the image / its type with
  explanation (تشبيه) / its rhetoric.
- Distractors avoid arguable alternatives: no «الرّمزيّ» for the school (the scheme speaks of «رموز»), no «الوصفيّ» or
  «الحجاجيّ» among the dominant-pattern distractors, no «لا دمنةً خبثها…» among the image distractors (it is also in verse 2),
  no verse 4/5/7/8 as «not illustrating the value» (they speak of hoarding and could be argued).
- Deferred: Q6 summary (3 points).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2009-sci-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE"]
OFFICIAL_ID = "1I3G9wriYDGwdRWNKio6GAOeatH5GJBQ3"
OFFICIAL_TITLE = "01_الموضوع.pdf"
OWNER_PDF_ID = "1_2hxdC9bNmJW5FZSmhx8rlws8i7V-4vA"
WRONG_DOCX_ID = "1v-CBr9F9mu6ecdYWzlFIaS4Moi0gW1pc"
CORR_ID = "1iLHfDBvaBhyn9WUFi94_G24a-chknV0p"

# ── النّصوص الحرفيّة (منسوخة يدويًّا من صورة الموضوع الرّسميّ؛ لا يوجد ملفّ docx لموضوع 2009) ──
INTRO = "قال الشاعر إيليا أبو ماضي:"
POEM = [
    ["1-", "خُذ ما (استطعت) من الدنيا وأهليها", "لكن تعلّم قليلا كيف تعطيها"],
    ["2-", "كن وردة طيبها حتى لسارقها", "لا دمنَةً خُبثها حتى لساقيها"],
    ["3-", "أكان في الكون نور نستضيء به", "لَو السَّماء طَوَت عنَّا دَراريها؟"],
    ["4-", "يا عابد المال، قُل لي هل وجدت به", "روحا تُؤَاسيك ، أو روحا تؤاسيها؟"],
    ["5-", "حتّامَ يا صاح تُخفيه وتَطمره", "كأنّما هو سَوءَات تُواريها؟"],
    ["6-", "انظر إلى الماء إنّ البذل شيمته", "يأتي الحقولَ فيَرويها ويُحييها"],
    ["7-", "فما تعكّر إلاّ وهوَ منحبسٌ", "والنّفس كالماء تَحكيه ويحكيها"],
    ["8-", "والسّجن للماء يؤذيه ويفسده", "والسّجن للنّفس يؤذيها ويضنيها"],
    ["9-", "أرسلت قولي تمثيلا وتشبيها", "لعلّ في القول تذكيرا وتنبيها"],
]
GLOSS = ("شرح المفردات: دمنة : نبات خبيث كريه الرائحة.   ــ دراريها: ج: دريّ: وهو الكوكب اللامع .\n"
         "صاح: ترخيم (يا صاحبي).   ــ سوءات تواريها: عيوب تخفيها.   ــ تحكيه: تشبهه.")
P1 = "أ ــ البناء الفكريّ:(12 نقطة)"
P2 = "ب ــ البناء اللغويّ: (08 نقاط)"
QT = {
    1: "إلامَ يدعو الشاعر الإنسانَ؟ وممَّ يحذّره؟",
    2: "علامَ يدل توظيف الشاعر لمظاهر الطبيعة في قصيدته؟ وضّح.",
    3: "النّص يعكس النّزعة التأمّليّة للشاعر. وضّح ذلك بأمثلة من القصيدة.",
    4: "بين المال والماء تشابه في نظر الشّاعر وضّح ذلك.",
    5: "في النّص قيمة إنسانيّة. أبرزها مع التوضيح.",
    6: "لخّص مضمون النّص.",
    7: "أعرب ما تحته سطر.",
    8: "بيّن المحلّ الإعرابيّ للجملة المحصورة بين قوسين.",
    9: "بمَ تفسّر غلبة أفعال الأمر في النّص؟",
    10: "فيْ النَّصَّ نمطان تعبيريان. اذكرهما مبيّنا مؤشّرات كلٍّ منهما كما تجلّت في النّص.",
    11: "استخرج الصورة البيانيّة الواردة في البيت الثاني ثم بيّن نوعها وبلاغتها.",
}
assert len(POEM) == 9 and "(استطعت)" in POEM[0][1] and POEM[6][1].endswith("منحبسٌ")
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": INTRO},
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-gloss", "kind": "text", "caption": "شرح المفردات", "text": GLOSS},
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


q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "ما يدعو إليه الشّاعر الإنسان", 0.75), el("q1-e2", "ما يحذّره منه", 0.75)])
q("q2", "2", P1, QT[2], 2, [el("q2-e1", "دلالة توظيف مظاهر الطّبيعة", 1), el("q2-e2", "التّوضيح", 1)])
q("q3", "3", P1, QT[3], 2, [el("q3-e1", "تجلّي النّزعة التّأمّليّة", 0.5), el("q3-e2", "رموز الطّبيعة في القصيدة", 0.5),
                           el("q3-e3", "أمثلة من القصيدة (2×0.5)", 1)])
q("q4", "4", P1, QT[4], 2, [el("q4-e1", "الماء في نظر الشّاعر", 1), el("q4-e2", "المال في نظر الشّاعر", 1)])
q("q5", "5", P1, QT[5], 1.5, [el("q5-e1", "القيمة الإنسانيّة وتوضيحها", 1), el("q5-e2", "الأبيات الّتي تجلّت فيها", 0.5)])
q("q6", "6", P1, QT[6], 3, [el("q6-e1", "التّلخيص: الحجم", 1), el("q6-e2", "التّلخيص: الدّلالة على المضمون", 1),
                           el("q6-e3", "التّلخيص: سلامة اللّغة وجودة الأسلوب", 1)])
q("q7", "1", P2, QT[7], 1, [el("q7-e1", "إعراب «منحبس» (ب7)", 1)])
q("q8", "2", P2, QT[8], 1, [el("q8-e1", "محلّ جملة (استطعت) (ب1)", 1)])
q("q9", "3", P2, QT[9], 1.5, [el("q9-e1", "دلالة كثرة أفعال الأمر", 1), el("q9-e2", "غاية الشّاعر من ذلك", 0.5)])
q("q10", "4", P2, QT[10], 3, [el("q10-e1", "النّمط الأوّل (الغالب)", 0.5), el("q10-e2", "سبب غلبته", 0.5), el("q10-e3", "مؤشّر النّمط الأوّل", 0.5),
                             el("q10-e4", "النّمط الثّاني ودوره", 0.5), el("q10-e5", "مؤشّر النّمط الثّاني (أ)", 0.5), el("q10-e6", "مؤشّر النّمط الثّاني (ب)", 0.5)])
q("q11", "5", P2, QT[11], 1.5, [el("q11-e1", "استخراج الصّورة", 0.5), el("q11-e2", "نوعها وشرحها", 0.5), el("q11-e3", "بلاغتها", 0.5)])

# ── أ: البناء الفكريّ ──
Q1_EXPL = ("يدعو الشّاعر الإنسان إلى فضيلة الكرم والعطاء في هذه الحياة وأن يسعى إلى أن يعمّ خيره جميع إخوانه من البشر، "
           "ويحذّره من رذيلة الشّحّ وشرّ عبادة المال.")
st("s01", "q1", "q1-e1", "mcq", "إلامَ يدعو الشّاعر الإنسان؟",
   {"options": ["إلى فضيلة الكرم والعطاء، وأن يسعى إلى أن يعمّ خيره جميع إخوانه من البشر", "إلى جمع المال وادّخاره للأيّام الصّعبة",
                "إلى اعتزال النّاس والانقطاع عن الدّنيا", "إلى الزّهد في العمل وترك السّعي"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "mcq", "ممَّ يحذّره؟",
   {"options": ["من رذيلة الشّحّ وشرّ عبادة المال", "من الإسراف في العطاء للغرباء", "من التّأمّل في مظاهر الطّبيعة", "من مخالطة الفقراء"]},
   {"correct": 0}, Q1_EXPL, 0.75, "ar.comprehension.idea")
Q2_EXPL = ("يدلّ توظيف الشّاعر لمظاهر الطّبيعة في قصيدته على تأثّره بالمذهب الرّومانسيّ، الّذي يولي اهتمامًا كبيرًا بالطّبيعة ويوظّفها "
           "في شكل رموز يعبّر بها عن تجربته الشّعريّة.")
st("s03", "q2", "q2-e1", "mcq", "علامَ يدلّ توظيف الشّاعر لمظاهر الطّبيعة في قصيدته؟",
   {"options": ["على تأثّره بالمذهب الرّومانسيّ", "على تأثّره بالمذهب الكلاسيكيّ (الإحيائيّ)", "على تأثّره بالمذهب الواقعيّ", "على تأثّره بمذهب الصّنعة البديعيّة"]},
   {"correct": 0}, Q2_EXPL, 1, "ar.literature.trend")
st("s04", "q2", "q2-e2", "fill_blank", "وضّح: أكمل.",
   {"text": "المذهب الرّومانسيّ يولي اهتمامًا كبيرًا بـ____ ويوظّفها في شكل ____ يعبّر بها عن تجربته الشّعريّة.", "bank": ["الطّبيعة", "رموز", "المدينة", "حكم"]},
   {"blanks": [["الطّبيعة"], ["رموز"]]}, Q2_EXPL, 1, "ar.literature.features")
Q3_EXPL = ("نزعة الشّاعر التّأمّليّة تتجلّى من خلال لجوئه إلى الطّبيعة وتأمّله فيها واستلهامه منها عبرًا ودروسًا كثيرة، فوجد أنّها خير ما يجسّد "
           "معاني العطاء والسّخاء بلا مقابل؛ فالوردة والماء يمثّلان النّفس الكريمة السّخيّة، والدّمنة بخضرائها تمثّل النّفس البخيلة. يقول الشّاعر: "
           "«كن وردة طيبها حتّى لسارقها / لا دمنةً خبثها حتّى لساقيها»، «انظر إلى الماء إنّ البذل شيمته / يأتي الحقول فيرويها…».")
st("s05", "q3", "q3-e1", "mcq", "فيمَ تتجلّى نزعة الشّاعر التّأمّليّة؟",
   {"options": ["في لجوئه إلى الطّبيعة وتأمّله فيها واستلهامه منها عبرًا ودروسًا كثيرة", "في وصفه لحياة المدينة وصخبها",
                "في حنينه إلى وطنه الأوّل وذكرياته", "في سرده لأحداث حياته الماضية"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.explain")
st("s06", "q3", "q3-e2", "matching", "طابق كلّ رمز من رموز الطّبيعة بما يمثّله في القصيدة.",
   {"lefts": ["الوردة والماء", "الدّمنة بخضرائها"], "rights": ["النّفس الكريمة السّخيّة", "النّفس البخيلة", "النّفس الحائرة القلقة"]},
   {"pairs": [0, 1]}, Q3_EXPL, 0.5, "ar.comprehension.image")
VERSE = {i + 1: f"«{r[1]} / {r[2]}»" for i, r in enumerate(POEM)}
st("s07", "q3", "q3-e3", "mcq", "أيّ هذه الأبيات يمثّل للنّزعة التّأمّليّة بتأمّل الوردة والدّمنة؟",
   {"options": [VERSE[2], VERSE[1], VERSE[4], VERSE[9]]}, {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.evidence")
st("s08", "q3", "q3-e3", "mcq", "وأيّها يمثّل لها بتأمّل الماء وعطائه؟",
   {"options": [VERSE[6], VERSE[1], VERSE[4], VERSE[9]]}, {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.evidence", "b")
Q4_EXPL = ("بين الماء والمال تشابه في نظر الشّاعر: فالماء هو عنصر الحياة، وهو نعمة تعود بالنّفع والخير على الإنسان وباقي الكائنات، ولا يكون كذلك "
           "إلاّ إذا كان جاريًا غير منحبس، فالماء الرّاكد يؤذي النّفس. كذلك المال إذا أُنفق على مستحقّيه نفع، وإذا حُبس كان شرًّا على صاحبه لأنّه بخيل مذموم.")
st("s09", "q4", "q4-e1", "mcq", "متى يكون الماء نعمة تعود بالنّفع والخير على الإنسان وباقي الكائنات في نظر الشّاعر؟",
   {"options": ["إذا كان جاريًا غير منحبس", "إذا كان راكدًا محفوظًا", "إذا خُزّن في السّجون والسّدود", "إذا قلّ وندر"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.link")
st("s10", "q4", "q4-e1", "fill_blank", "أكمل:",
   {"text": "الماء هو عنصر ____، أمّا الماء ____ فيؤذي النّفس.", "bank": ["الحياة", "الرّاكد", "الموت", "الجاري"]},
   {"blanks": [["الحياة"], ["الرّاكد"]]}, Q4_EXPL, 0.5, "ar.comprehension.link", "b")
st("s11", "q4", "q4-e2", "mcq", "وكيف يشبه المالُ الماءَ في نظر الشّاعر؟",
   {"options": ["إذا أُنفق على مستحقّيه نفع، وإذا حُبس كان شرًّا على صاحبه", "إذا ادُّخر نفع صاحبه، وإذا أُنفق ضاع", "لا ينفع المال في كلّ الأحوال",
                "إذا كثر أفسد صاحبه، وإذا قلّ أصلحه"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.link")
st("s12", "q4", "q4-e2", "fill_blank", "أكمل:",
   {"text": "إذا حُبس المال كان شرًّا على صاحبه لأنّه ____ ____.", "bank": ["بخيل", "مذموم", "كريم", "محمود"]},
   {"blanks": [["بخيل"], ["مذموم"]]}, Q4_EXPL, 0.5, "ar.comprehension.link", "b")
Q5_EXPL = ("القيمة الإنسانيّة: تتجلّى من خلال دعوة الشّاعر إلى البذل والعطاء ونشر الخير بين النّاس جميعًا دون مقابل، وتحذيره من البخل والشّحّ. "
           "وهي قيم إنسانيّة قد تجلّت في الأبيات (1، 2، 3، و6).")
st("s13", "q5", "q5-e1", "mcq", "ما القيمة الإنسانيّة الّتي تبرز في النّصّ؟",
   {"options": ["الدّعوة إلى البذل والعطاء ونشر الخير بين النّاس جميعًا دون مقابل، والتّحذير من البخل والشّحّ", "الدّعوة إلى الحرّيّة ومقاومة المستعمر",
                "الدّعوة إلى طلب العلم والمعرفة", "الدّعوة إلى برّ الوالدين وصلة الرّحم"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.comprehension.values")
st("s14", "q5", "q5-e1", "fill_blank", "وضّح القيمة: أكمل.",
   {"text": "يدعو الشّاعر إلى البذل والعطاء ونشر ____ بين النّاس جميعًا دون ____، ويحذّر من البخل والشّحّ.", "bank": ["الخير", "مقابل", "الشّرّ", "سبب"]},
   {"blanks": [["الخير"], ["مقابل"]]}, Q5_EXPL, 0.5, "ar.comprehension.values", "b")
st("s15", "q5", "q5-e2", "mcq", "في أيّ الأبيات تجلّت هذه القيمة كما تذكر الإجابة النّموذجيّة؟",
   {"options": ["الأبيات (1، 2، 3، و6)", "البيت التّاسع وحده", "البيتان السّابع والثّامن فقط", "البيت الخامس وحده"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.comprehension.evidence")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "إيليا أبو ماضي، «خذ ما استطعت» (بكالوريا 2009، الشّعب العلميّة، الموضوع الأوّل)",
            "scheme": "«3×1»: يراعي المترشّح تقنيات التّلخيص: حجم التّلخيص – دلالته على المضمون – سلامة اللّغة وجودة الأسلوب", "model_example": None}
SUM_EXPL = "تلخيص النّصّ: يراعي المترشّح تقنيات التّلخيص: حجم التّلخيص (1)، دلالته على المضمون (1)، سلامة اللّغة وجودة الأسلوب (1)."
for sid, eid, crit, ind, pts in [("s16", "q6-e1", "الحجم", "حجم التّلخيص", 1), ("s17", "q6-e2", "المضمون", "دلالته على المضمون", 1),
                                 ("s18", "q6-e3", "اللّغة والأسلوب", "سلامة اللّغة وجودة الأسلوب", 1)]:
    essay(sid, "q6", eid, "تلخيص قصيدة إيليا أبو ماضي", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ب: البناء اللّغويّ ──
IRAB_EXPL = "منحبسٌ: خبر مرفوع، وعلامة رفعه الضّمّة الظّاهرة على آخره."
st("s19", "q7", "q7-e1", "mcq", "ما إعراب «منحبسٌ» في قوله: «فما تعكّر إلاّ وهوَ منحبسٌ»؟",
   {"options": ["خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "نعت مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "حال منصوبة وعلامة نصبها الفتحة", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
st("s20", "q7", "q7-e1", "fill_blank", "أكمل إعراب «منحبسٌ»:",
   {"text": "منحبسٌ: خبر ____، وعلامة رفعه ____ الظّاهرة على آخره.", "bank": ["مرفوع", "الضّمّة", "منصوب", "الفتحة"]},
   {"blanks": [["مرفوع"], ["الضّمّة"]]}, IRAB_EXPL, 0.5, "ar.grammar.irab", "b")
REL_EXPL = "«استطعتَ»: جملة فعليّة صلة الموصول لا محلّ لها من الإعراب."
st("s21", "q8", "q8-e1", "mcq", "ما المحلّ الإعرابيّ لجملة (استطعت) في قوله: «خذ ما (استطعت) من الدّنيا وأهليها»؟",
   {"options": ["جملة فعليّة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب مفعول به", "جملة فعليّة في محلّ نصب حال",
                "جملة جواب شرط لا محلّ لها من الإعراب"]},
   {"correct": 0}, REL_EXPL, 0.5, "ar.grammar.sentence_case")
st("s22", "q8", "q8-e1", "fill_blank", "أكمل:",
   {"text": "(استطعت): جملة ____ صلة ____ لا محلّ لها من الإعراب.", "bank": ["فعليّة", "الموصول", "اسميّة", "الشّرط"]},
   {"blanks": [["فعليّة"], ["الموصول"]]}, REL_EXPL, 0.5, "ar.grammar.sentence_case", "b")
CMD_EXPL = ("كثرة أفعال الأمر (خذ، تعلّم، كن، انظر…) تدلّ على الدّعوة والحثّ والنّصح؛ فالشّاعر يدعو أخاه الإنسان إلى التّحلّي بهذه القيم الإنسانيّة "
            "الّتي بها يَسعد ويُسعد غيره.")
st("s23", "q9", "q9-e1", "mcq", "بمَ تفسّر غلبة أفعال الأمر (خذ، تعلّم، كن، انظر…) في النّصّ؟",
   {"options": ["تدلّ على الدّعوة والحثّ والنّصح", "تدلّ على التّعجيز والتّحدّي", "تدلّ على السّخرية والاستهزاء", "تدلّ على التّمنّي والتّحسّر"]},
   {"correct": 0}, CMD_EXPL, 1, "ar.rhetoric.insha")
st("s24", "q9", "q9-e2", "fill_blank", "أكمل غاية الشّاعر:",
   {"text": "فالشّاعر يدعو أخاه الإنسان إلى ____ بهذه القيم الإنسانيّة الّتي بها يَسعد ويُسعد ____.", "bank": ["التّحلّي", "غيره", "التّخلّي", "نفسه"]},
   {"blanks": [["التّحلّي"], ["غيره"]]}, CMD_EXPL, 0.5, "ar.comprehension.purpose")
TYPE_EXPL = ("نمطا النّصّ: النّمط الأمريّ (الإيعازيّ): وهو الغالب لأنّ الشّاعر كان بصدد حثّ الإنسان ودعوته إلى ضرورة التّحلّي بصفات العطاء والسّخاء والبذل "
             "جاعلًا الطّبيعة قدوة له، ومن خصائصه غلبة أفعال الأمر: (خذ، تعلّم، كن، قل، انظر…). النّمط الحجاجيّ: وكان هذا النّمط خادمًا للنّمط الأمريّ، "
             "فقد وظّفه الشّاعر للإقناع بما يدعو إليه، ومن خصائصه: أ- حشد الأدلّة والأمثلة الحسّيّة المقنعة من الواقع (الأبيات 2، 3، 4، 6)؛ "
             "ب- توظيف أدوات التّوكيد: (إنّ).")
st("s25", "q10", "q10-e1", "mcq", "ما النّمط التّعبيريّ الغالب في النّصّ؟",
   {"options": ["النّمط الأمريّ (الإيعازيّ)", "النّمط السّرديّ", "النّمط الحواريّ", "النّمط التّفسيريّ"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s26", "q10", "q10-e2", "mcq", "لماذا كان النّمط الأمريّ هو الغالب؟",
   {"options": ["لأنّ الشّاعر كان بصدد حثّ الإنسان ودعوته إلى التّحلّي بصفات العطاء والسّخاء والبذل جاعلًا الطّبيعة قدوة له",
                "لأنّ الشّاعر يروي قصّة وقعت له في الماضي", "لأنّ الشّاعر يحاور شخصيّات متعدّدة", "لأنّ الشّاعر يشرح ظاهرة علميّة شرحًا محايدًا"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s27", "q10", "q10-e3", "mcq", "ما مؤشّر النّمط الأمريّ في النّصّ؟",
   {"options": ["غلبة أفعال الأمر: (خذ، تعلّم، كن، قل، انظر…)", "غلبة الأفعال الماضية الدّالّة على تتابع الأحداث", "كثرة أسماء الأعلام والأمكنة",
                "كثرة المصطلحات العلميّة"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s28", "q10", "q10-e4", "mcq", "ما النّمط الثّاني في النّصّ، وما دوره؟",
   {"options": ["النّمط الحجاجيّ، وكان خادمًا للنّمط الأمريّ، وظّفه الشّاعر للإقناع بما يدعو إليه", "النّمط السّرديّ، وظّفه الشّاعر لرواية تجربته",
                "النّمط الحواريّ، وظّفه الشّاعر لعرض وجهات نظر متعدّدة", "النّمط التّفسيريّ، وظّفه الشّاعر لشرح ظاهرة علميّة"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s29", "q10", "q10-e5", "mcq", "ما المؤشّر الأوّل للنّمط الحجاجيّ كما تجلّى في الأبيات (2، 3، 4، 6)؟",
   {"options": ["حشد الأدلّة والأمثلة الحسّيّة المقنعة من الواقع", "تتابع الأحداث في الزّمن", "الحوار بين الشّخصيّات", "وصف الأماكن وصفًا دقيقًا"]},
   {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s30", "q10", "q10-e6", "fill_blank", "أكمل المؤشّر الثّاني للنّمط الحجاجيّ:",
   {"text": "توظيف أدوات ____ مثل: (____).", "bank": ["التّوكيد", "إنّ", "النّفي", "لم"]},
   {"blanks": [["التّوكيد"], ["إنّ"]]}, TYPE_EXPL, 0.5, "ar.text.type")
IMG_EXPL = ("الصّورة البيانيّة الواردة في البيت الثّاني وردت في قوله: «كن وردة طيبها حتّى لسارقها»، وهي تشبيه، حيث شبّه الشّاعر الإنسان السّخيّ بالوردة "
            "الفوّاحة الّتي تهب رائحتها حتّى لمن يؤذيها. بلاغتها: توضيح المعنى وتقريبه إلى الذّهن، وفيها دعوة إلى أخذ العبرة من الطّبيعة في التّحلّي "
            "بالقيم الإنسانيّة النّبيلة.")
st("s31", "q11", "q11-e1", "mcq", "ما الصّورة البيانيّة الواردة في البيت الثّاني كما في الإجابة النّموذجيّة؟",
   {"options": ["«كن وردة طيبها حتّى لسارقها»", "«لو السّماء طوت عنّا دراريها»", "«انظر إلى الماء إنّ البذل شيمته»", "«والسّجن للماء يؤذيه ويفسده»"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s32", "q11", "q11-e2", "mcq", "ما نوع الصّورة في «كن وردة طيبها حتّى لسارقها»، وما شرحها؟",
   {"options": ["تشبيه: شبّه الشّاعر الإنسان السّخيّ بالوردة الفوّاحة الّتي تهب رائحتها حتّى لمن يؤذيها",
                "استعارة مكنيّة: شبّه الشّاعر الوردة بإنسان يسرق", "استعارة تصريحيّة: شبّه الشّاعر الطّيب بالمال المسروق",
                "مجاز مرسل علاقته الجزئيّة: أطلق الوردة وأراد البستان"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s33", "q11", "q11-e3", "mcq", "ما بلاغة التّشبيه في «كن وردة طيبها حتّى لسارقها»؟",
   {"options": ["توضيح المعنى وتقريبه إلى الذّهن، وفيها دعوة إلى أخذ العبرة من الطّبيعة في التّحلّي بالقيم الإنسانيّة النّبيلة",
                "تقديم الحقيقة مصحوبة بالدّليل عليها", "تشخيص المعنويّ وبثّ الحياة فيه", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")

TITLE = "بكالوريا 2009 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (إيليا أبو ماضي: خذ ما استطعت)"
NOTES = ("موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2009، شعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة: gdrive:{OFFICIAL_ID} ({OFFICIAL_TITLE}، ص1–2، صورة ممسوحة)، ونسخة صاحب المنصّة gdrive:{OWNER_PDF_ID}. "
         f"لا يوجد ملفّ docx لموضوع 2009: الملفّ المقدَّم gdrive:{WRONG_DOCX_ID} هو موضوع بكالوريا 2010؛ لذلك نُسخ النّصّ الحرفيّ يدويًّا من صورة الموضوع "
         "الرّسميّ (300 نقطة في البوصة، مع تكبير الحركات)، ويُستحسن أن يقابله صاحب المنصّة بالورقة مرّة واحدة. ترقيم الأبيات «1-»…«9-» مضاف للعرض فقط. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
         "البناء اللّغويّ س4: «6×0.5» قُسّمت على عبارات الإجابة السّتّ (اجتهاد يُراجَع). مؤجَّل (essay_builder): التّلخيص س6 (3×1).")
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
