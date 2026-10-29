"""Conversion: BAC 2009 (session عاديّة، جوان 2009) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (أمل دنقل).
STATUS: BLOCKED — the only copy of the 2009 Arabic paper in Drive is a scan whose right edge is masked by a black band: the
first letter(s) of every line of the right column of the poem are hidden (see BLOCKER below). Nothing hidden is guessed.

Sources (Drive, read-only):
- official ONEC paper (Arabic): gdrive 1A5uo1kzMgZQm24d6K0ewrHFeleIlxMJD, MISLABELLED «2009 - اللغة الإنجليزية - آداب وفلسفة -
  الدورة العادية - الموضوع.pdf» (4 pages, 198-dpi scan, no text layer); the owner's copy gdrive 1cg3niV_mwDL83--ibO_IJwqAH0PAhnQu
  («BAC 2009 - اللغة العربية - آداب وفلسفة.pdf», 8 page images) is the same scan with the same masked edge;
- official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1R-VN5F_dfYxdNtNT46WtSDT4RotBwuaN (02_التصحيح.pdf, pages 1–2),
  fully legible.
- NOT usable: the «01_الموضوع.pdf» of the same 2009 folder (gdrive 1h4G070KILHT9IyGAWHxQ7PW_hOqLLGAs, and its copy
  1-y36vbwpDQnmyaWpHw1KYP7amKXZDNye) is the ENGLISH exam of آداب وفلسفة; the docx/PDF given for this unit (gdrive
  1RZGrKrjqxBIOuQ-f1piFardXlyZgoTTH «بكالوريا العربية 2010 شعبة آداب وفلسفة.docx» / 1tLMsMhfsfvq64mvdxLYVMoaKlb0FmUDz) are the BAC
  2010 paper. No 2009 text export exists in Drive.

BLOCKER (right-column lines of the poem, as visible on the scan; «[…]» = hidden by the black band):
  ل1 «[…]الشّمس تلك التي تطلع الآن، أم أنها العين؟»   ل2 «[…]ن القتيل – التي تتأمل شاخصة»   ل3 «[…]ه (يترسّب شيئا فشيئا)»
  ل6 «[…]هرة شرّ.»   ل9 «[…]ي الشّمس أم أنّها التّاج؟»   ل10 «[…]ا الذي يتنقّل فوق الرؤوس إلى أن يعودْ»
  ل11 «[…]ى مفرق الفارس العربيِّ الشّهيدْ»   ل12 «[…]ول لكم، (أيّها النّاس، كونوا أناسا).»
  Restored ONLY where an official source quotes the hidden word: ل4 «ويخضرّ» (scheme Q5 «الروابط: … "ويخضرّ – فتطلع…"»),
  ل5 «فتطلع» (same line of the scheme), ل7 «وكفّان» (paper, Part 2 Q5 quotes the whole line). Plausible readings such as
  «عين القتيل»، «دمه»، «وزهرة»، «أهي»، «إلى مفرق»، «أقول» are NOT used. The left column (third stanza) and the questions are fully
  legible. To unblock: supply an uncropped copy of the paper, fill HIDDEN below, rebuild (the set then turns NEEDS_HUMAN_REVIEW).

Method: the verbatim strings were TRANSCRIBED BY HAND from the scan (native page images, crops enlarged ×2), keeping printed
spelling and diacritics as far as the scan shows them. The correction is a scanned PDF, read from its native page images.
Every mark comes from the official scheme; correct options and explanations condense its wording; no step quotes a hidden part.

Conversion notes / points for the owner's review:
- Streams: ONEC paper header «آداب وفلسفة» ⇒ LIT. The poem's three stanzas («الفقرة الأولى/الثّانية/الثّالثة» in the questions)
  are the right column (two stanzas separated by «****») then the left column.
- Rule for «n×m» lines (as in the 2011–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «3×0,5» = the call (المقاومة والثّورة) / its aim (تحرير الأرض وعموم الأمن…) / the evidence (one witness, «يكتفي المترشّح
  بشاهد واحد») — the converter's reading of the three demands. Q2 «4×0,25» one per word + the common link. Q3 «1».
  Q4 «0,5 + 2×0,25» per stanza (pattern + two indicators) ⇒ six elements. Q5 «3×0,5» one per cohesion device. Q6 (تلخيص)
  «3×1» = احترام التّقنية / منهجيّة العرض / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2: Q1 «6×0,25» = three words of حقل الثّورة (seven listed, «يختار المترشّح ثلاثا منها») + the three words of حقل
  السّلم ⇒ two elements of 0.75. Q2 «4×0,25» one per particle (أم، إلى، إلى، اللام). Q3 «2×0,25» (شاخصة، النّاس) +
  «2×0,5» (the two sentences). Q4 «2×0,25» per image (type / rhetoric). Q5 «0,5» scansion + «2×0,25» (المتقارب / وجه
  التّجديد). Symbols written left-to-right (the scheme prints them in visual right-to-left order).
- Part 3: «3» مفهوم الالتزام في الشّعر (interactive, from the scheme) + «1» إبداء الرّأي (deferred essay_builder, rule 11).
- Deferred: Q6 (3) + opinion (1) = 4 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2009-lit-p1"
PAPER = 1
STREAMS = ["LIT"]
OFFICIAL_ID = "1A5uo1kzMgZQm24d6K0ewrHFeleIlxMJD"
OFFICIAL_TITLE = "2009 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الموضوع.pdf"
OWNER_PDF_ID = "1cg3niV_mwDL83--ibO_IJwqAH0PAhnQu"
WRONG_ONEC_ID = "1h4G070KILHT9IyGAWHxQ7PW_hOqLLGAs"
WRONG_DOCX_ID = "1RZGrKrjqxBIOuQ-f1piFardXlyZgoTTH"
CORR_ID = "1R-VN5F_dfYxdNtNT46WtSDT4RotBwuaN"

# ── ما خفي تحت الشّريط الأسود (None = غير مقروء؛ يُملأ من نسخة سليمة فقط) ──
HIDDEN = {1: None, 2: None, 3: None, 6: None, 9: None, 10: None, 11: None, 12: None}
GAP = "[…]"
# ── النّصوص الحرفيّة (منسوخة يدويًّا من صورة الموضوع الرّسميّ) ──
RIGHT_VISIBLE = {
    1: "الشّمس تلك التي تطلع الآن، أم أنها العين؟",
    2: "ن القتيل – التي تتأمل شاخصة",
    3: "ه (يترسّب شيئا فشيئا)",
    4: "ويخضرّ  شيئا فشيئا",            # «ويخضرّ» من الإجابة النّموذجيّة (س5 من البناء الفكريّ)
    5: "فتطلع من كل بقعة دم: فم قرمزيّ",  # «فتطلع» من الإجابة النّموذجيّة (س5 من البناء الفكريّ)
    6: "هرة شرّ.",
    7: "وكفّان قابضتان على منجل من حديد",  # السّطر كاملًا في البناء اللّغويّ س5 من الموضوع نفسه
    8: "****",
    9: "ي الشّمس أم أنّها التّاج؟",
    10: "ا الذي يتنقّل فوق الرؤوس إلى أن يعودْ",
    11: "ى مفرق الفارس العربيِّ الشّهيدْ",
    12: "ول لكم، (أيّها النّاس، كونوا أناسا).",
    13: "****",
}
LEFT = [
    "هي النّار، وهي اللسان الذي يتكلّم بالحقّ",
    "أنّ الجروحَ يطهّرها الكيّ",
    "والسّيفَ يصقله الكيرُ",
    "والخبزَ ينضجه الوهجُ.",
    "كونوا لها الحَطَبَ المُشتهى، والقلوب الحجارة.",
    "كونوا إلى أن تعود السّماوات زرقاء",
    "والصّحراء بتولا",
    "تسير عليها النّجوم محمّلة بسلال الورد.",
]
AUTHOR = "\" أمل دنقل\"."
RIGHT = [(HIDDEN[n] + v if HIDDEN.get(n) else (GAP + v if n in HIDDEN else v)) for n, v in sorted(RIGHT_VISIBLE.items())]
BLOCKED = any(v is None for v in HIDDEN.values())
P1 = "أولا : البناء الفكري: (10 نقاط)"
P2 = "ثانيا : البناء اللغوي: (06 نقاط)"
P3 = "ثالثا : التقويم النقدي: (04 نقاط)"
QT = {
    1: "إلاَمَ يدعو الشاعر العرب في هذه القصيدة؟ ولماذا هذه الدعوة؟ استشهد من النّص بما يعزّز إجابتك.",
    2: "تأمّل الكلمات الآتية: الكيُّ – الكيرُ – الوهَجُ.\nبمَ توحي لك؟ ما الجامع بينها؟",
    3: "ما الفكرة التي تتضمّنها الأسطر الأربعة الأخيرة؟",
    4: "ما النّمط المستعمل في الفقرتين الأولى والثالثة؟ أُذكر خاصيّتين لكلّ نمط مع التمثيل.",
    5: "استخرج من النّص ثلاثة مظاهر من مظاهر الاتّساق.",
    6: "لخّص مضمون الفقرة الأولى والثانية من النّص.",
    7: "الثورة والسلم حقلان دلاليان بارزان في النّص، مثّل لكل حقل بثلاث مفردات.",
    8: "استخرج من الفقرة الثانية حروف المعاني، واذكر دلالتها.",
    9: "أعرب ما تحته خط إعراب مفردات، و ما بين قوسين إعراب جمل.",
    10: "في العبارتين الآتيتين صورتان بيانيتان أُذكرهما وبين وجه بلاغتهما.\n\" كونوا لها الحطب \" – \" تسير عليها النّجوم \".",
    11: "قطّع قول الشاعر:\" وكفّان قابضتان على منجل من حديد\"، وسمِّ بحرهُ؛ وبيّن وجه التّجديد فيه.",
    12: "الالتزام ظاهرة أدبية جديدة ارتبطت بالشّعر العربي الحديث، وضّح مفهوم الالتزام في الشّعر، وبيّن رأيك فيه.",
}
assert len(RIGHT) == 13 and RIGHT[7] == "****" and RIGHT[12] == "****" and len(LEFT) == 8
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(RIGHT + LEFT)},
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


q("q1", "1", P1, QT[1], 1.5, [el("q1-e1", "ما يدعو إليه الشّاعر العرب", 0.5), el("q1-e2", "سبب الدّعوة", 0.5), el("q1-e3", "الاستشهاد", 0.5)])
q("q2", "2", P1, QT[2], 1, [el("q2-e1", "إيحاء «الكيّ»", 0.25), el("q2-e2", "إيحاء «الكير»", 0.25), el("q2-e3", "إيحاء «الوهج»", 0.25),
                           el("q2-e4", "الجامع بينها", 0.25)])
q("q3", "3", P1, QT[3], 1, [el("q3-e1", "فكرة الأسطر الأربعة الأخيرة", 1)])
q("q4", "4", P1, QT[4], 2, [el("q4-e1", "نمط الفقرة الأولى", 0.5), el("q4-e2", "الفقرة الأولى: المؤشّر الأوّل", 0.25),
                           el("q4-e3", "الفقرة الأولى: المؤشّر الثّاني", 0.25), el("q4-e4", "نمط الفقرة الثّالثة", 0.5),
                           el("q4-e5", "الفقرة الثّالثة: المؤشّر الأوّل", 0.25), el("q4-e6", "الفقرة الثّالثة: المؤشّر الثّاني", 0.25)])
q("q5", "5", P1, QT[5], 1.5, [el("q5-e1", "التّكرار", 0.5), el("q5-e2", "الإحالة بالضّمير", 0.5), el("q5-e3", "الرّوابط", 0.5)])
q("q6", "6", P1, QT[6], 3, [el("q6-e1", "التّلخيص: احترام التّقنية", 1), el("q6-e2", "التّلخيص: منهجيّة العرض", 1), el("q6-e3", "التّلخيص: سلامة اللّغة", 1)])
q("q7", "1", P2, QT[7], 1.5, [el("q7-e1", "ثلاث مفردات من حقل الثّورة (3×0,25)", 0.75), el("q7-e2", "ثلاث مفردات من حقل السّلم (3×0,25)", 0.75)])
q("q8", "2", P2, QT[8], 1, [el("q8-e1", "«أم» ودلالتها", 0.25), el("q8-e2", "«إلى» (إلى أن يعود) ودلالتها", 0.25),
                           el("q8-e3", "«إلى» الثّانية ودلالتها", 0.25), el("q8-e4", "اللّام ودلالتها", 0.25)])
q("q9", "3", P2, QT[9], 1.5, [el("q9-e1", "إعراب «شاخصة»", 0.25), el("q9-e2", "إعراب «النّاس»", 0.25),
                             el("q9-e3", "محلّ جملة (يترسّب شيئا فشيئا)", 0.5), el("q9-e4", "محلّ جملة (أيّها النّاس، كونوا أناسا)", 0.5)])
q("q10", "4", P2, QT[10], 1, [el("q10-e1", "«كونوا لها الحطب»: النّوع", 0.25), el("q10-e2", "«كونوا لها الحطب»: البلاغة", 0.25),
                             el("q10-e3", "«تسير عليها النّجوم»: النّوع", 0.25), el("q10-e4", "«تسير عليها النّجوم»: البلاغة", 0.25)])
q("q11", "5", P2, QT[11], 1, [el("q11-e1", "التّقطيع", 0.5), el("q11-e2", "البحر", 0.25), el("q11-e3", "وجه التّجديد", 0.25)])
q("q12", "التّعليمة", P3, QT[12], 4, [el("q12-e1", "مفهوم الالتزام في الشّعر", 3), el("q12-e2", "إبداء الرّأي", 1)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("الشّاعر يدعو العرب إلى المقاومة والثّورة ضدّ الظّلم ورفض الاحتلال، وذلك من أجل تحرير الأرض وعموم الأمن والرّفاه والسّلم. "
           "الاستشهاد: هي النّار – السّيف يصقله الكير – كونوا لها الحطب – الوهج – القلوب الحجارة؛ إلى أن تعود السّماوات زرقاء – والصّحراء بتولا "
           "تسير عليها النّجوم محمّلة بسلال الورد (يكتفي المترشّح بشاهد واحد).")
st("s01", "q1", "q1-e1", "mcq", "إلامَ يدعو الشّاعر العرب في هذه القصيدة؟",
   {"options": ["إلى المقاومة والثّورة ضدّ الظّلم ورفض الاحتلال", "إلى الصّبر والاستسلام للأمر الواقع", "إلى الهجرة بحثًا عن الأمان",
                "إلى التّفاوض مع المحتلّ"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "ولماذا هذه الدّعوة؟ أكمل.",
   {"text": "من أجل ____ الأرض وعموم الأمن والرّفاه و____.", "bank": ["تحرير", "السّلم", "بيع", "الحرب"]},
   {"blanks": [["تحرير"], ["السّلم"]]}, Q1_EXPL, 0.5, "ar.comprehension.purpose")
st("s03", "q1", "q1-e3", "matching", "استشهد: طابق كلّ فكرة بشاهد عليها من النّصّ.",
   {"lefts": ["الدّعوة إلى الثّورة والمقاومة", "الغاية: الأمن والرّفاه والسّلم"],
    "rights": ["«كونوا لها الحَطَبَ المُشتهى»", "«كونوا إلى أن تعود السّماوات زرقاء»", "«أم أنّها التّاج؟»"]},
   {"pairs": [0, 1]}, Q1_EXPL, 0.5, "ar.comprehension.evidence")
Q2_EXPL = ("توحي الكلمات بـ: الكيّ: العلاج الأنجع والأنسب (الكفاح المسلّح بدل السّياسة)؛ الكير: تأجّج نار الثّورة؛ الوهج: لهيب الثّورة، "
           "القوّة والقدرة على الحرق. والجامع بين هذه الكلمات هي النّار الّتي توحي بالثّورة.")
for sid, eid, word, opts in [("s04", "q2-e1", "الكيّ", ["العلاج الأنجع والأنسب (الكفاح المسلّح بدل السّياسة)", "الألم الّذي يجب تجنّبه", "العقاب الظّالم", "الحلّ السّياسيّ والتّفاوض"]),
                             ("s05", "q2-e2", "الكير", ["تأجّج نار الثّورة", "خمود الثّورة وانطفاؤها", "صناعة الأدوات المنزليّة", "برودة المشاعر"]),
                             ("s06", "q2-e3", "الوهج", ["لهيب الثّورة، القوّة والقدرة على الحرق", "ضعف الثّائرين", "نور الصّباح الهادئ", "الحزن والانكسار"])]:
    st(sid, "q2", eid, "mcq", f"بمَ توحي كلمة «{word}» في النّصّ؟", {"options": opts}, {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.explain")
st("s07", "q2", "q2-e4", "mcq", "ما الجامع بين الكلمات: الكيّ – الكير – الوهج؟",
   {"options": ["النّار الّتي توحي بالثّورة", "الماء الّذي يوحي بالحياة", "التّراب الّذي يوحي بالوطن", "الهواء الّذي يوحي بالحرّيّة"]},
   {"correct": 0}, Q2_EXPL, 0.25, "ar.cohesion.effect")
Q3_EXPL = "فكرة الأسطر الأربعة الأخيرة هي: الثّورة طريق الحرّيّة والأمن والخير للأمّة العربيّة."
st("s08", "q3", "q3-e1", "mcq", "ما الفكرة الّتي تتضمّنها الأسطر الأربعة الأخيرة («كونوا لها الحطب المشتهى… بسلال الورد»)؟",
   {"options": ["الثّورة طريق الحرّيّة والأمن والخير للأمّة العربيّة", "الحنين إلى الصّحراء وحياة البداوة", "وصف جمال السّماء والنّجوم",
                "رثاء الفارس العربيّ الشّهيد"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.idea")
st("s09", "q3", "q3-e1", "fill_blank", "أكمل الفكرة:",
   {"text": "الثّورة طريق ____ والأمن و____ للأمّة العربيّة.", "bank": ["الحرّيّة", "الخير", "العبوديّة", "الشّرّ"]},
   {"blanks": [["الحرّيّة"], ["الخير"]]}, Q3_EXPL, 0.5, "ar.comprehension.idea", "b")
TYPE_EXPL = ("النّمط المستعمل في الفقرة الأولى هو الوصف: المؤشّر الأوّل: النّعوت (يترسّب – يخضرّ – فم قرمزيّ)؛ المؤشّر الثّاني: التّصوير المتحرّك "
             "(تتأمّل – يترسّب – يخضرّ – تطلع). والنّمط المستعمل في الفقرة الثّالثة هو الإخبار والإيعاز: المؤشّر الأوّل: جمل إخباريّة (أنّ السّيف "
             "يصقله الكير)؛ المؤشّر الثّاني: (كونوا لها الحطب) إيعاز.")
st("s10", "q4", "q4-e1", "mcq", "ما النّمط المستعمل في الفقرة الأولى؟",
   {"options": ["الوصف", "السّرد", "الحجاج", "التّفسير"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s11", "q4", "q4-e2", "mcq", "ما المؤشّر الأوّل للوصف في الفقرة الأولى كما في الإجابة النّموذجيّة؟",
   {"options": ["النّعوت (يترسّب – يخضرّ – فم قرمزيّ)", "أفعال الأمر (كونوا)", "الجمل الإخباريّة المؤكّدة (أنّ السّيف يصقله الكير)", "أدوات الشّرط"]},
   {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
st("s12", "q4", "q4-e3", "fill_blank", "أكمل المؤشّر الثّاني للوصف في الفقرة الأولى:",
   {"text": "التّصوير ____ (تتأمّل – يترسّب – يخضرّ – تطلع).", "bank": ["المتحرّك", "الثّابت", "الصّامت"]},
   {"blanks": [["المتحرّك"]]}, TYPE_EXPL, 0.25, "ar.text.type")
st("s13", "q4", "q4-e4", "mcq", "ما النّمط المستعمل في الفقرة الثّالثة؟",
   {"options": ["الإخبار والإيعاز", "السّرد", "الحوار", "الوصف وحده"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s14", "q4", "q4-e5", "mcq", "مثّل لمؤشّر الإخبار (الجمل الإخباريّة) في الفقرة الثّالثة:",
   {"options": ["«والسّيفَ يصقله الكيرُ»", "«كونوا لها الحَطَبَ المُشتهى»", "«أم أنّها التّاج؟»", "«كونوا إلى أن تعود السّماوات زرقاء»"]},
   {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
st("s15", "q4", "q4-e6", "mcq", "ومثّل لمؤشّر الإيعاز في الفقرة الثّالثة:",
   {"options": ["«كونوا لها الحَطَبَ»", "«والخبزَ ينضجه الوهجُ»", "«هي النّار، وهي اللسان الذي يتكلّم بالحقّ»", "«أنّ الجروحَ يطهّرها الكيّ»"]},
   {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
COH_EXPL = ("ثلاثة مظاهر من مظاهر الاتّساق: أ. التّكرار: (هي الشّمس – كونوا – شيئا فشيئا)؛ ب. الإحالة بالضّمير: (هي: العائدة على الشّمس – العين – النّار)؛ "
            "ج. الرّوابط: (الواو – الفاء – إلى … إلخ): «ويخضرّ – فتطلع – إلى أن يعود».")
st("s16", "q5", "q5-e1", "mcq", "ما مظهر الاتّساق الّذي تمثّله الألفاظ: (هي الشّمس – كونوا – شيئا فشيئا)؟",
   {"options": ["التّكرار", "الإحالة بالضّمير", "الحذف", "الاستبدال"]}, {"correct": 0}, COH_EXPL, 0.5, "ar.cohesion.effect")
st("s17", "q5", "q5-e2", "mcq", "علامَ يعود الضّمير «هي» في قوله: «هي النّار، وهي اللسان الذي يتكلّم بالحقّ» كما في الإجابة النّموذجيّة؟",
   {"options": ["على الشّمس – العين – النّار", "على الصّحراء", "على القلوب الحجارة", "على السّماوات"]}, {"correct": 0}, COH_EXPL, 0.5, "ar.cohesion.reference")
st("s18", "q5", "q5-e3", "multi", "أيّ ممّا يلي من الرّوابط الّتي حقّقت الاتّساق في النّصّ كما في الإجابة النّموذجيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الواو (ويخضرّ)", "الفاء (فتطلع)", "إلى (إلى أن يعود)", "لكنّ", "ثمّ"]},
   {"correct": [0, 1, 2]}, COH_EXPL + " (لا ترد «لكنّ» ولا «ثمّ» في النّصّ.)", 0.5, "ar.cohesion.connectors")
SUM_SPEC = {"task": "تلخيص مضمون الفقرتين الأولى والثّانية من القصيدة", "text": "أمل دنقل (بكالوريا 2009، آداب وفلسفة، الموضوع الأوّل)",
            "scheme": "«3×1»: احترام التّقنية – منهجيّة العرض – سلامة اللّغة", "model_example": None}
SUM_EXPL = "التّلخيص: يراعى فيه ما يلي: احترام التّقنية (1)، منهجيّة العرض (1)، سلامة اللّغة (1)."
for sid, eid, crit, ind, pts in [("s19", "q6-e1", "التّقنية", "احترام التّقنية", 1), ("s20", "q6-e2", "المنهجيّة", "منهجيّة العرض", 1),
                                 ("s21", "q6-e3", "سلامة اللّغة", "سلامة اللّغة", 1)]:
    essay(sid, "q6", eid, "تلخيص الفقرتين الأولى والثّانية من قصيدة أمل دنقل", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
FLD_EXPL = ("الحقلان الدّلاليّان: أ. حقل الثّورة: (القتيل – الشّهيد – النّار – الجروح – السّيف – الحطب – الحجارة) (يختار المترشّح ثلاثًا منها)؛ "
            "ب. حقل السّلم: (السّماوات زرقاء – بتولا – سلال الورد).")
st("s22", "q7", "q7-e1", "multi", "أيّ المفردات الآتية تنتمي إلى حقل الثّورة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الشّهيد", "النّار", "السّيف", "الحطب", "بتولا", "سلال الورد"]},
   {"correct": [0, 1, 2, 3]}, FLD_EXPL, 0.75, "ar.cohesion.effect")
st("s23", "q7", "q7-e2", "multi", "أيّ المفردات الآتية تنتمي إلى حقل السّلم في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["السّماوات زرقاء", "بتولا", "سلال الورد", "الجروح", "القتيل"]},
   {"correct": [0, 1, 2]}, FLD_EXPL, 0.75, "ar.cohesion.effect")
PART_EXPL = "حروف المعاني: أم: الإضراب. إلى: الغاية. إلى: النّهاية في المكان. اللّام: التّخصيص، والتّبليغ."
st("s24", "q8", "q8-e1", "mcq", "ما دلالة «أم» في قوله: «الشّمس أم أنّها التّاج؟»",
   {"options": ["الإضراب", "التّعليل", "التّشبيه", "الاستعلاء"]}, {"correct": 0}, PART_EXPL, 0.25, "ar.cohesion.connectors")
st("s25", "q8", "q8-e2", "mcq", "ما دلالة «إلى» في قوله: «فوق الرؤوس إلى أن يعودْ»؟",
   {"options": ["الغاية", "المصاحبة", "الظّرفيّة", "التّعليل"]}, {"correct": 0}, PART_EXPL, 0.25, "ar.cohesion.connectors")
st("s26", "q8", "q8-e3", "mcq", "ما دلالة حرف الجرّ «إلى» الثّاني في الفقرة الثّانية (… مفرق الفارس العربيّ الشّهيد) كما في الإجابة النّموذجيّة؟",
   {"options": ["النّهاية في المكان", "النّهاية في الزّمان", "المصاحبة", "التّعليل"]}, {"correct": 0}, PART_EXPL, 0.25, "ar.cohesion.connectors")
st("s27", "q8", "q8-e4", "mcq", "ما دلالة اللّام في «لكم» في قوله: «… لكم، (أيّها النّاس، كونوا أناسا)»؟",
   {"options": ["التّخصيص، والتّبليغ", "التّعليل", "الملكيّة", "الاستحقاق"]}, {"correct": 0}, PART_EXPL, 0.25, "ar.cohesion.connectors")
IRAB_EXPL = ("شاخصةً: حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها. النّاسُ: بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره. "
             "«يترسّب شيئا فشيئا»: جملة فعليّة في محلّ رفع خبر. «أيّها النّاسُ كونوا أناسًا»: جملة مقول القول في محلّ نصب مفعول به.")
st("s28", "q9", "q9-e1", "mcq", "ما إعراب «شاخصة» في قوله: «التي تتأمل شاخصة»؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة", "نعت مرفوع وعلامة رفعه الضّمّة",
                "خبر مرفوع وعلامة رفعه الضّمّة"]},
   {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.irab")
st("s29", "q9", "q9-e2", "mcq", "ما إعراب «النّاسُ» في قوله: «أيّها النّاسُ، كونوا أناسا»؟",
   {"options": ["بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "منادى مبنيّ على الضّمّ في محلّ نصب", "مبتدأ مرفوع وعلامة رفعه الضّمّة",
                "فاعل مرفوع وعلامة رفعه الضّمّة"]},
   {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.badal")
st("s30", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (يترسّب شيئا فشيئا)؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع نعت", "جملة استئنافيّة لا محلّ لها من الإعراب"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.sentence_case")
st("s31", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (أيّها النّاس، كونوا أناسا)؟",
   {"options": ["جملة مقول القول في محلّ نصب مفعول به", "جملة في محلّ رفع خبر", "جملة في محلّ جرّ مضاف إليه", "جملة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.sentence_case")
IMG_EXPL = ("«كونوا لها الحطب»: تشبيه بليغ، حيث ساوى بين طرفي التّشبيه لتقوية المعنى وجمع بين ما لا يجتمع في الواقع فأثار الدّهشة والإعجاب. "
            "«تسير عليها النّجوم»: استعارة مكنيّة، جسّد المعنى المجرّد فزاده وضوحًا، وشخّص النّجوم فأدهش المتلقّي وأثار فيه الإحساس والإعجاب.")
st("s32", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في «كونوا لها الحطب»؟",
   {"options": ["تشبيه بليغ", "استعارة مكنيّة", "كناية عن صفة", "مجاز مرسل"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.simile")
st("s33", "q10", "q10-e2", "mcq", "ما وجه بلاغة التّشبيه في «كونوا لها الحطب»؟",
   {"options": ["ساوى بين طرفي التّشبيه لتقوية المعنى، وجمع بين ما لا يجتمع في الواقع فأثار الدّهشة والإعجاب", "تقديم الحقيقة مصحوبة بالدّليل عليها",
                "إحداث جرس موسيقيّ تطرب له الأذن", "إظهار المعنى بذكر ضدّه"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
st("s34", "q10", "q10-e3", "mcq", "ما نوع الصّورة البيانيّة في «تسير عليها النّجوم»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن موصوف"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s35", "q10", "q10-e4", "fill_blank", "أكمل وجه بلاغة الاستعارة في «تسير عليها النّجوم»:",
   {"text": "جسّد المعنى المجرّد فزاده وضوحًا، و____ النّجوم فأدهش المتلقّي وأثار فيه الإحساس و____.", "bank": ["شخّص", "الإعجاب", "أخفى", "النّفور"]},
   {"blanks": [["شخّص"], ["الإعجاب"]]}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
PRO_EXPL = ("التّقطيع: «وَكَفْفَا / نِ قَابِـ / ضَتَانِ / عَلَى مِنْـ / جَلِنْ مِنْ / حَدِيدْ» = //0/0 //0/ //0/ //0/0 //0/0 //00 = فعولن فعولُ فعولُ فعولن فعولن فعولْ. "
            "بحر المتقارب. وجه التّجديد هو التّصرّف في عدد تفعيلات المتقارب في السّطر الواحد. "
            "(يطبع التّصحيح الرّموز بترتيب بصريّ من اليمين؛ كُتبت هنا من اليسار كالمعتاد.)")
st("s36", "q11", "q11-e1", "fill_blank", "أكمل الكتابة العروضيّة لقوله: «وكفّان قابضتان على منجل من حديد»:",
   {"text": "وَكَفْفَا / نِ قَابِـ / ____ / عَلَى مِنْـ / ____ / حَدِيدْ", "bank": ["ضَتَانِ", "جَلِنْ مِنْ", "ضَتَانِ عَلَى", "جَلِ نِ"]},
   {"blanks": [["ضَتَانِ"], ["جَلِنْ مِنْ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s37", "q11", "q11-e1", "mcq", "ما رموز السّطر وتفعيلاته؟",
   {"options": ["//0/0 //0/ //0/ //0/0 //0/0 //00 = فعولن فعولُ فعولُ فعولن فعولن فعولْ", "/0//0 /0//0 /0//0 /0//0 /0//0 /0//0 = فاعلن فاعلن فاعلن فاعلن فاعلن فاعلن",
                "//0/0 //0/0 //0/0 //0/0 //0/0 //0/0 = فعولن فعولن فعولن فعولن فعولن فعولن", "///0//0 ///0//0 = متفاعلن متفاعلن"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s38", "q11", "q11-e2", "mcq", "ما بحر هذا السّطر؟",
   {"options": ["المتقارب", "المتدارك", "الرّجز", "الكامل"]}, {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s39", "q11", "q11-e3", "mcq", "ما وجه التّجديد فيه؟",
   {"options": ["التّصرّف في عدد تفعيلات المتقارب في السّطر الواحد", "الالتزام بالشّطرين المتساويين والقافية الموحّدة", "المزج بين بحرين مختلفين في السّطر",
                "التّخلّي عن الوزن كلّيًّا"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.literature.renewal")
# ── ثالثًا: التّقويم النّقديّ ──
COM_EXPL = ("مفهوم الالتزام في الشّعر: الالتزام في الشّعر هو أن يتناول الشّاعر قضايا أمّته وشعبه، ويتبنّاها مدافعًا عنها سياسيّة كانت أو اجتماعيّة: "
            "(القهر والتّسلّط، مظاهر البؤس والتّخلّف، بناء الحياة والإنسان). إبداء الرّأي: للمترشّح إبداء رأيه الشّخصيّ بالتّركيز على الرّأي المشفوع بالحجج.")
st("s40", "q12", "q12-e1", "mcq", "ما مفهوم الالتزام في الشّعر؟",
   {"options": ["أن يتناول الشّاعر قضايا أمّته وشعبه، ويتبنّاها مدافعًا عنها سياسيّة كانت أو اجتماعيّة", "أن يلتزم الشّاعر بالوزن والقافية ونظام الشّطرين",
                "أن ينصرف الشّاعر إلى التّعبير عن ذاته ومشاعره الخاصّة", "أن يتّبع الشّاعر مذهب الفنّ للفنّ"]},
   {"correct": 0}, COM_EXPL, 1, "ar.literature.trend")
st("s41", "q12", "q12-e1", "fill_blank", "أكمل المفهوم:",
   {"text": "الالتزام في الشّعر هو أن ____ الشّاعر قضايا أمّته وشعبه، و____ مدافعًا عنها.", "bank": ["يتناول", "يتبنّاها", "يتجاهل", "يهجرها"]},
   {"blanks": [["يتناول"], ["يتبنّاها"]]}, COM_EXPL, 1, "ar.literature.trend", "b")
st("s42", "q12", "q12-e1", "multi", "أيّ القضايا الآتية يتناولها الشّعر الملتزم كما تذكر الإجابة النّموذجيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["القهر والتّسلّط", "مظاهر البؤس والتّخلّف", "بناء الحياة والإنسان", "مدح الحكّام طمعًا في العطاء", "التّغنّي بالخمرة واللّهو"]},
   {"correct": [0, 1, 2]}, COM_EXPL, 1, "ar.literature.trend", "c")
essay("s43", "q12", "q12-e2", "الالتزام في الشّعر العربيّ الحديث", "إبداء الرّأي", "إبداء الرّأي الشّخصيّ المشفوع بالحجج", 1,
      {"task": "إبداء الرّأي في الالتزام في الشّعر", "question": QT[12],
       "scheme": "إبداء الرّأي «1»: للمترشّح إبداء رأيه الشّخصيّ بالتّركيز على الرّأي المشفوع بالحجج"},
      COM_EXPL, "ar.comprehension.opinion")

TITLE = "بكالوريا 2009 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (أمل دنقل)"
NOTES = ((("محجوبة (BLOCKED): " if BLOCKED else "") +
          "موضوع البكالوريا الرّسميّ (دورة جوان 2009، شعبة آداب وفلسفة) موجود في Drive صاحب المنصّة صورةً ممسوحة فقط: "
          f"gdrive:{OFFICIAL_ID} (عنوانه خطأً «اللغة الإنجليزية»)، ونسخة صاحب المنصّة gdrive:{OWNER_PDF_ID}؛ والحافّة اليمنى في المسحتين مغطّاة بشريط أسود "
          "يُخفي الحرف أو الحرفين الأوّلين من أسطر العمود الأيمن للقصيدة (الأسطر 1، 2، 3، 6، 9، 10، 11، 12؛ عُلّمت بـ «[…]»). "
          "أُكملت من المصادر الرّسميّة فقط: «ويخضرّ» و«فتطلع» (الإجابة النّموذجيّة) و«وكفّان» (س5 من البناء اللّغويّ). "
          f"لا يُستعمل: «01_الموضوع.pdf» في مجلّد 2009 gdrive:{WRONG_ONEC_ID} (هو موضوع اللّغة الإنجليزيّة)، وملفّ docx المقدَّم gdrive:{WRONG_DOCX_ID} (موضوع 2010). "
          "لرفع الحجب: نسخة سليمة من الموضوع ثمّ ملء HIDDEN في المحوّل وإعادة البناء. "
          "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، مقروءة كاملة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
          "مؤجَّل (essay_builder): التّلخيص س6 (3×1) والرّأي في التّقويم النّقديّ (1)."))
LOG_NOTE = ("تحويل من صورة الموضوع الرّسميّ (منسوخ يدويًّا؛ أطراف أسطر العمود الأيمن مخفيّة في المسح فالمجموعة محجوبة) والإجابة النّموذجيّة الرّسميّة؛ "
            "العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")

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
    "status": "BLOCKED" if BLOCKED else "NEEDS_HUMAN_REVIEW",
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
    "review_log": [{"at": "2026-10-29T18:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(doc["status"], len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
