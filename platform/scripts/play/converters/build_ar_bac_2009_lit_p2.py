"""Conversion: BAC 2009 (session عاديّة، جوان 2009) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (ميخائيل نعيمة).
STATUS: BLOCKED — the only copy of the 2009 Arabic paper in Drive is a scan whose right edge is masked by a black band that
hides the first letters of the text lines. All hidden fragments but ONE are quoted by official sources (see below); the
remaining one (line 11, «[…]عاصير») is not, so nothing is guessed and the set stays BLOCKED.

Sources (Drive, read-only):
- official ONEC paper (Arabic): gdrive 1A5uo1kzMgZQm24d6K0ewrHFeleIlxMJD, MISLABELLED «2009 - اللغة الإنجليزية - آداب وفلسفة -
  الدورة العادية - الموضوع.pdf» (pages 3–4, 198-dpi scan, no text layer); the owner's copy gdrive 1cg3niV_mwDL83--ibO_IJwqAH0PAhnQu
  is the same scan with the same masked edge;
- official mark scheme: gdrive 1R-VN5F_dfYxdNtNT46WtSDT4RotBwuaN (02_التصحيح.pdf, pages 2–4), fully legible.
- NOT usable: «01_الموضوع.pdf» of the 2009 folder (gdrive 1h4G070KILHT9IyGAWHxQ7PW_hOqLLGAs) is the ENGLISH exam; the docx/PDF given
  for this unit (gdrive 1RZGrKrjqxBIOuQ-f1piFardXlyZgoTTH / 1tLMsMhfsfvq64mvdxLYVMoaKlb0FmUDz) are the BAC 2010 paper.

Hidden line starts and how each was restored (official sources only):
  ل2 «تبدو» (paper Part 2 Q4 «تبدو لي سرابا»; scheme Q2 «تبدو لي سرابا في سراب») — ل3 «خلوة» (scheme Q4 «سأجده في خلوة مع
  نفسي») — ل4 «غريب» (scheme Part 3 «والغريب عن نفسه غريب عن كل شيء») — ل6 «فمواسم» (scheme Q5 «فمواسم للفوتبول») — ل7 «أفخم»
  (paper Part 2 Q4 «عن أفخم السيّارات») — ل8 «هرج» (scheme Q5 «من هرج ومرج») — ل9 «وتضليل» (scheme Q5 «من تخدير وتضليل») —
  ل12 «أن يضمنوك» (scheme Part 3 «لكنهم لا يستطيعون أن يضمنوك ضد الحزن») — ل13 «لفي» (scheme Q4 «إنّ نفسي لفي أمسّ الحاجة»).
  UNRESOLVED: ل11 «[…]عاصير والنّار، وضدّ الزّلازل…» (no source quotes it; «والأعاصير» is likely but not attested) ⇒ HIDDEN[11].
  Also hidden by the band but structural only: the question numbers «1–6» of Part 1 and the start of its heading «[أو]لا»
  (written «أولا : البناء الفكري: (10 نقاط)» exactly as the identical heading of paper 1) and of «[الأ]سئلـة:». The underline of
  «تبدو» (line 2) is hidden; the scheme lists it among the underlined words (المدينة، تبدو، سرابا، نفسي).
To unblock: confirm HIDDEN[11] from an uncropped copy, rebuild (the set then turns NEEDS_HUMAN_REVIEW).

Method: the verbatim strings were TRANSCRIBED BY HAND from the scan (native page images, crops enlarged ×1.6), keeping printed
spelling and diacritics as far as the scan shows them; printed line wraps joined with a space into the three paragraphs.
The correction is a scanned PDF, read from its native page images. Every mark comes from the official scheme; correct
options and explanations condense its wording; no step quotes the unresolved fragment.

Conversion notes / points for the owner's review:
- Streams: ONEC paper header «آداب وفلسفة» ⇒ LIT.
- Q1 «1 + 1» = the issue / the evidence («للمترشّح أن يجد عبارات أخرى» ⇒ the evidence step offers only text phrases that are
  correct and invented non-text phrases as distractors). Q2 «4×0,25» four phrases listed (the question asks three) ⇒ one
  element of 1. Q3 «1». Q4 «3×0,5» = the answer (مجرّد خواطر) + the justification (two phrases, «وللمترشّح الحرّيّة في اختيار
  عبارات أخرى») ⇒ 0.5 + 1. Q5 «3×0,5» = the pattern (مزج بين التّفسير والوصف) / الإجمال ثمّ التّفصيل with example / the
  description inside the detail with example. Q6 (تلخيص) «3×1» = احترام التّقنية / منهجيّة العرض / سلامة اللّغة ⇒ deferred.
- Part 2: Q1 «4×0,25» (17 words listed, «يكتفي المترشّح بأربع») ⇒ one element. Q2 «4×0,25» one per word + «0,5» the link with
  the writer's stance. Q3 «0,5» the vowelling + «4×0,25» one i'rab per word + «2×0,25» one per sentence. Q4 «0,5 + 0,25» per
  image (type / rhetoric).
- Part 3 «2 + 2» = the explanation (four features) / the witnesses from the text ⇒ interactive (the scheme gives both).
- Distractors avoid arguable alternatives: no «خبر» for «سرابا» (the scheme says حال), no «نعت / عطف بيان» for «المدينة»
  after «هذه» (بدل), no «الحجاجيّ» for the pattern.
- Deferred: Q6 summary (3 points).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2009-lit-p2"
PAPER = 2
STREAMS = ["LIT"]
OFFICIAL_ID = "1A5uo1kzMgZQm24d6K0ewrHFeleIlxMJD"
OFFICIAL_TITLE = "2009 - اللغة الإنجليزية - آداب وفلسفة - الدورة العادية - الموضوع.pdf"
OWNER_PDF_ID = "1cg3niV_mwDL83--ibO_IJwqAH0PAhnQu"
WRONG_ONEC_ID = "1h4G070KILHT9IyGAWHxQ7PW_hOqLLGAs"
WRONG_DOCX_ID = "1RZGrKrjqxBIOuQ-f1piFardXlyZgoTTH"
CORR_ID = "1R-VN5F_dfYxdNtNT46WtSDT4RotBwuaN"

HIDDEN = {11: None}  # بداية السّطر 11 المخفيّة تحت الشّريط الأسود (None = غير مقروءة؛ لا تُملأ إلاّ من نسخة سليمة)
GAP = "[…]"
# ── النّصوص الحرفيّة (منسوخة يدويًّا من صورة الموضوع الرّسميّ، سطرًا سطرًا؛ ما أُكمل من المصادر الرّسميّة موثّق أعلاه) ──
LINES = {
    1: "<< سئمتُ هذه المدينة الأمريكية الغارقة في العجاج الذي يثيره ركضها وراء أشياء وأشياء",
    2: "تبدو لي سرابا في سراب. إنّ ما (أفتّشُ عنه) لم أجده أبدا في ذلك العجاج أو السّراب، سأجده في",
    3: "خلوة مع نفسي هناك في لبنان... هناك أفتح قلبي للفور وأجمع شتات نفسي، والغريب عن نفسه",
    4: "غريب عن كلِّ شيء.",
    5: "مالي وللملاهي التي يخلقها لهم الدّولار لينسيهم ما هم فيه من بؤس وفراغ وسوءِ حالٍ؟",
    6: "فمواسم للفوتبْول، ومواسمُ للبايسبْول، ومواسم للمصارعة والملاكمة وإعلانات تسيل اللّعاب عن",
    7: "أفخم السيارات، وأمتع السّهرات، وأحدثِ الأزياء والاختراعات... ناهيك بالأعياد وما يرافقها من",
    8: "هرج ومرج، وبالمعابدِ وما بالمعابد من رياء وتمويهٍ، وبالمدارس وما بالمدارس من تخدير",
    9: "وتضليلٍ.",
    10: "ها هنا يحتال القوم حتّى على الزّمان، يضمنون لك جميع ما تملك ضدّ السّرقة والتّلف",
    11: "عاصير والنّار، وضدّ الزّلازل والنّوازلِ... لا حبّا بك، بل شغفا بالدّولار، ولكنّهم (لا يستطيعون)",
    12: "أن يضمنوك ضدّ الحزن والغضب والشّك والقلق والسّأم، وأوجاع القلب والفكر والرّوح... إنّ نفسي",
    13: "لفي أمسّ الحاجة إلى الاستجمام في عزلة ليس للدّولار فيها مثل ذلك السلطان.>>",
}
L = {n: ((HIDDEN[n] or GAP) + v if n in HIDDEN else v) for n, v in LINES.items()}
BLOCKED = any(v is None for v in HIDDEN.values())
TEXT = "\n".join(" ".join(L[i] for i in rng) for rng in (range(1, 5), range(5, 10), range(10, 14)))
AUTHOR = "ميخائيل نعيمة"
P1 = "أولا : البناء الفكري: (10 نقاط)"
P2 = "ثانيا : البناء اللغوي: (06 نقاط)"
P3 = "ثالثا : التقويم النقدي: (04 نقاط)"
QT = {
    1: "ما القضية التي شغلت الكاتب في هذا النص؟ استشهد بعبارتين منه.",
    2: "أين تلمس نبرة النّقد والسّخرية من القضية التي يتناولها الكاتب؟\nوضّح إجابتك بثلاث جمل من النّص.",
    3: "ما الرّسالة الاجتماعية التي يريد الكاتب إيصالها إلى المجتمع العربي؟",
    4: "هل اعتمد الكاتب في نصّه هذا على تعليل أحكامه، أم هي مُجرّد خواطر روّح بها عن نفسه؟\nعلّل إجابتك من النص.",
    5: "ما النّمط المعتمد في النّص؟ أُذكر خاصيتين منه، مع التّمثيل.",
    6: "لخّص مضمون النصّ.",
    7: "في النّص حقل دلالي يدل على رفض الكاتب للظّاهرة الحضارية التي ينتقدها. مثّل لذلك بأربعة ألفاظ.",
    8: "بمَ توحي لك الألفاظ الآتية: الهرجُ – الرّياء – التّمويهُ – التّخدير؟\nوهل لها علاقة بموقف الكاتب؟",
    9: "اضبط بالشّكل الحركة الإعرابية لما تحته خط مع بيان إعرابه، وبيِّن المحل الإعرابي للجملتين الواقعتين ما بين قوسين.",
    10: "في العبارتين الآتيتين صورتان بيانيتان، أُذكرهما، وبيّن وجه بلاغتهما:\n- \" تبدو لي سرابا \"   –   \" تُسيلُ اللّعابَ عن أفخم السيّارات \"",
    11: ("تميّزت المقالة الحديثة بالتّخلّص من الصّنعة اللّفظية، واهتمّت بجلاء الفكرة ووضوح العبارة وحملت على عاتقها هدفًا رساليًا. "
         "وضّح هذا القول مدعّما إجابتك بشواهد من النّص."),
}
assert TEXT.count("(أفتّشُ عنه)") == 1 and TEXT.count("(لا يستطيعون)") == 1 and TEXT.startswith("<<") and TEXT.endswith(">>")
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


q("q1", "1", P1, QT[1], 2, [el("q1-e1", "القضيّة الّتي شغلت الكاتب", 1), el("q1-e2", "الاستشهاد بعبارتين", 1)])
q("q2", "2", P1, QT[2], 1, [el("q2-e1", "مواطن نبرة النّقد والسّخرية (4×0,25)", 1)])
q("q3", "3", P1, QT[3], 1, [el("q3-e1", "الرّسالة الاجتماعيّة", 1)])
q("q4", "4", P1, QT[4], 1.5, [el("q4-e1", "تعليل أحكام أم مجرّد خواطر", 0.5), el("q4-e2", "التّعليل من النّصّ (2×0,5)", 1)])
q("q5", "5", P1, QT[5], 1.5, [el("q5-e1", "النّمط المعتمد", 0.5), el("q5-e2", "الخاصّيّة الأولى: الإجمال ثمّ التّفصيل", 0.5),
                             el("q5-e3", "الخاصّيّة الثّانية: الوصف داخل التّفصيل", 0.5)])
q("q6", "6", P1, QT[6], 3, [el("q6-e1", "التّلخيص: احترام التّقنية", 1), el("q6-e2", "التّلخيص: منهجيّة العرض", 1), el("q6-e3", "التّلخيص: سلامة اللّغة", 1)])
q("q7", "1", P2, QT[7], 1, [el("q7-e1", "أربعة ألفاظ من الحقل الدّالّ على الرّفض (4×0,25)", 1)])
q("q8", "2", P2, QT[8], 1.5, [el("q8-e1", "إيحاء «الهرج»", 0.25), el("q8-e2", "إيحاء «الرّياء»", 0.25), el("q8-e3", "إيحاء «التّمويه»", 0.25),
                             el("q8-e4", "إيحاء «التّخدير»", 0.25), el("q8-e5", "علاقتها بموقف الكاتب", 0.5)])
q("q9", "3", P2, QT[9], 2, [el("q9-e1", "الضّبط بالشّكل", 0.5), el("q9-e2", "إعراب «المدينة»", 0.25), el("q9-e3", "إعراب «تبدو»", 0.25),
                           el("q9-e4", "إعراب «سرابا»", 0.25), el("q9-e5", "إعراب «نفسي»", 0.25), el("q9-e6", "محلّ جملة (أفتّش عنه)", 0.25),
                           el("q9-e7", "محلّ جملة (لا يستطيعون)", 0.25)])
q("q10", "4", P2, QT[10], 1.5, [el("q10-e1", "«تبدو لي سرابا»: النّوع", 0.5), el("q10-e2", "«تبدو لي سرابا»: البلاغة", 0.25),
                               el("q10-e3", "«تسيل اللّعاب عن أفخم السّيّارات»: النّوع", 0.5), el("q10-e4", "«تسيل اللّعاب…»: البلاغة", 0.25)])
q("q11", "التّعليمة", P3, QT[11], 4, [el("q11-e1", "توضيح القول (خصائص المقالة الحديثة)", 2), el("q11-e2", "الشّواهد من النّصّ", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("القضيّة الّتي شغلت بال الكاتب هي المدنيّة الأمريكيّة الصّاخبة والمغرية بماديّاتها. الاستشهاد: «سئمتُ هذه المدينة الأمريكية الغارقة في العجاج…»، "
           "«مالي وللملاهي الّتي يخلقها لهم الدّولار…» (للمترشّح أن يجد عبارات أخرى من النّصّ مناسبة).")
st("s01", "q1", "q1-e1", "mcq", "ما القضيّة الّتي شغلت الكاتب في هذا النّصّ؟",
   {"options": ["المدنيّة الأمريكيّة الصّاخبة والمغرية بماديّاتها", "تطوّر صناعة السّيّارات في أمريكا", "التّنافس الرّياضيّ بين الأمم", "الهجرة من لبنان إلى أمريكا وأسبابها"]},
   {"correct": 0}, Q1_EXPL, 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "multi", "أيّ العبارتين الآتيتين من النّصّ تصلحان شاهدًا على هذه القضيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["«سئمتُ هذه المدينة الأمريكية الغارقة في العجاج»", "«مالي وللملاهي التي يخلقها لهم الدّولار»", "«ما أجمل هذه المدينة وما أبهى أضواءها!»",
                "«الدّولار يضمن للنّفس راحتها وسكينتها»"]},
   {"correct": [0, 1]}, Q1_EXPL + " (العبارتان الأخريان ليستا من النّصّ وتناقضان موقف الكاتب.)", 1, "ar.comprehension.evidence")
Q2_EXPL = ("نلمس نبرة النّقد والسّخرية في القضيّة الّتي يتناولها الكاتب من خلال قوله: (يثيره ركضها – تبدو لي سرابا في سراب – مالي وللملاهي؟ – "
           "يحتال القوم حتّى على الزّمان).")
st("s03", "q2", "q2-e1", "multi", "أين تلمس نبرة النّقد والسّخرية؟ اختر الجمل الدّالّة عليها كما في الإجابة النّموذجيّة. (اختر كلّ ما يصحّ)",
   {"options": ["«يثيره ركضها»", "«تبدو لي سرابا في سراب»", "«مالي وللملاهي؟»", "«يحتال القوم حتّى على الزّمان»",
                "«هناك أفتح قلبي للفور وأجمع شتات نفسي»", "«سأجده في خلوة مع نفسي هناك في لبنان»"]},
   {"correct": [0, 1, 2, 3]}, Q2_EXPL + " أمّا «هناك أفتح قلبي…» و«سأجده في خلوة…» فحديث عن راحة نفسه بعيدًا عن هذه المدينة.", 1, "ar.comprehension.evidence")
Q3_EXPL = ("الرّسالة الاجتماعيّة الّتي يريد الكاتب إيصالها للمجتمع العربيّ هي عدم الانبهار بهذه المدنيّة المزيّفة، الكاذبة، البرّاقة. كما يدعونا إلى الاعتزاز "
           "بأصولنا وقيمنا الحضاريّة، وعدم الانسلاخ عن جذورنا.")
st("s04", "q3", "q3-e1", "mcq", "ما الرّسالة الاجتماعيّة الّتي يريد الكاتب إيصالها إلى المجتمع العربيّ؟",
   {"options": ["عدم الانبهار بهذه المدنيّة المزيّفة، الكاذبة، البرّاقة", "تقليد الحضارة الأمريكيّة في كلّ مظاهرها", "الهجرة إلى أمريكا لتحقيق الثّراء",
                "الإقبال على الملاهي والرّياضة للتّرويح عن النّفس"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.values")
st("s05", "q3", "q3-e1", "fill_blank", "أكمل الرّسالة:",
   {"text": "كما يدعونا إلى ____ بأصولنا وقيمنا الحضاريّة، وعدم ____ عن جذورنا.", "bank": ["الاعتزاز", "الانسلاخ", "التّخلّي", "الانبهار"]},
   {"blanks": [["الاعتزاز"], ["الانسلاخ"]]}, Q3_EXPL, 0.5, "ar.comprehension.values", "b")
Q4_EXPL = ("هي مجرّد خواطر روّح بها الكاتب عن نفسه، ويبدو هذا من خلال بعض العبارات مثل: «سئمتُ هذه المدينة الأمريكية»، «سأجده في خلوة مع نفسي»، "
           "«مالي وللملاهي؟»، «إنّ نفسي لفي أمسّ الحاجة» (وللمترشّح الحرّيّة في اختيار عبارات أخرى).")
st("s06", "q4", "q4-e1", "mcq", "هل اعتمد الكاتب في نصّه على تعليل أحكامه، أم هي مجرّد خواطر روّح بها عن نفسه؟",
   {"options": ["هي مجرّد خواطر روّح بها الكاتب عن نفسه", "اعتمد على تعليل أحكامه بالأدلّة والإحصاءات العلميّة", "هي قصّة يرويها الكاتب عن أحداث وقعت لغيره",
                "هي حوار بين الكاتب وصديق له"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.literature.prose")
st("s07", "q4", "q4-e2", "multi", "علّل من النّصّ: أيّ العبارات الآتية من النّصّ تدلّ على أنّها خواطر ذاتيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["«سئمتُ هذه المدينة الأمريكية»", "«سأجده في خلوة مع نفسي»", "«إنّ نفسي لفي أمسّ الحاجة إلى الاستجمام»",
                "«وتؤكّد الإحصاءات الرّسميّة أنّ…»", "«والدّليل العلميّ على ذلك ما يلي…»"]},
   {"correct": [0, 1, 2]}, Q4_EXPL + " (العبارتان الأخيرتان ليستا من النّصّ.)", 1, "ar.comprehension.evidence")
Q5_EXPL = ("النّمط المعتمد هو مزجٌ بين التّفسير والوصف، وذلك من خلال الإجمال ثمّ التّفصيل؛ مثال: (مالي وللملاهي …… وسوء حال؟) إجمال، "
           "(فمواسم للفوتبول ….. من تخدير وتضليل) تفصيل. ونجد داخل هذا التّفصيل وصفًا، مثال: (ما يرافقها من هرج ومرج – ما بالمعابد من رياء وتمويه).")
st("s08", "q5", "q5-e1", "mcq", "ما النّمط المعتمد في النّصّ؟",
   {"options": ["مزج بين التّفسير والوصف", "السّرد", "الحوار", "الأمر والإيعاز"]}, {"correct": 0}, Q5_EXPL, 0.5, "ar.text.type")
st("s09", "q5", "q5-e2", "fill_blank", "أكمل الخاصّيّة الأولى:",
   {"text": "يعتمد الكاتب على ____ ثمّ ____: «مالي وللملاهي … وسوء حال؟» ثمّ «فمواسم للفوتبول … من تخدير وتضليل».", "bank": ["الإجمال", "التّفصيل", "الحوار", "السّرد"]},
   {"blanks": [["الإجمال"], ["التّفصيل"]]}, Q5_EXPL, 0.5, "ar.text.type")
st("s10", "q5", "q5-e3", "mcq", "ونجد داخل هذا التّفصيل وصفًا. مثّل له كما في الإجابة النّموذجيّة:",
   {"options": ["«ما يرافقها من هرج ومرج – ما بالمعابد من رياء وتمويه»", "«ولكنّهم لا يستطيعون»", "«إنّ ما أفتّش عنه لم أجده أبدا»", "«ميخائيل نعيمة»"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.text.type")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "ميخائيل نعيمة (بكالوريا 2009، آداب وفلسفة، الموضوع الثّاني)",
            "scheme": "«3×1»: احترام التّقنية – منهجيّة العرض – سلامة اللّغة", "model_example": None}
SUM_EXPL = "التّلخيص: يراعى فيه: احترام التّقنية (1)، منهجيّة العرض (1)، سلامة اللّغة (1)."
for sid, eid, crit, ind, pts in [("s11", "q6-e1", "التّقنية", "احترام التّقنية", 1), ("s12", "q6-e2", "المنهجيّة", "منهجيّة العرض", 1),
                                 ("s13", "q6-e3", "سلامة اللّغة", "سلامة اللّغة", 1)]:
    essay(sid, "q6", eid, "تلخيص نصّ ميخائيل نعيمة", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
FLD_EXPL = ("المفردات الدّالّة على رفض الكاتب للمدنيّة الأمريكيّة: سئمت – الغارقة – سراب – بؤس – فراغ – سوء – هرج – مرج – رياء – تمويه – تضليل – "
            "تخدير – يحتال – الشّكّ – القلق – السّأم – أوجاع (يكتفي المترشّح بأربع منها).")
st("s14", "q7", "q7-e1", "multi", "أيّ الألفاظ الآتية من الحقل الدّالّ على رفض الكاتب للظّاهرة الحضاريّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["سئمت", "سراب", "رياء", "تمويه", "تضليل", "لبنان", "الاستجمام"]},
   {"correct": [0, 1, 2, 3, 4]}, FLD_EXPL, 1, "ar.cohesion.effect")
SUG_EXPL = ("الألفاظ توحي بـ: الهرج = التّزاحم والحركيّة المتواصلة دون قصد؛ الرّياء = الحضارة الكاذبة؛ التّمويه = الظّهور بمظهر كاذب – الخداع؛ "
            "التّخدير = الزّيف – التّضليل – شلّ الفكر – الإيهام. وهي تعبّر عن موقف الكاتب الرّافض لهذه الحضارة وضجره منها باعتباره غريبًا عن هذا المجتمع.")
MEAN = ["التّزاحم والحركيّة المتواصلة دون قصد", "الحضارة الكاذبة", "الظّهور بمظهر كاذب – الخداع", "الزّيف – التّضليل – شلّ الفكر – الإيهام"]
for k, (sid, eid, word) in enumerate([("s15", "q8-e1", "الهرج"), ("s16", "q8-e2", "الرّياء"), ("s17", "q8-e3", "التّمويه"), ("s18", "q8-e4", "التّخدير")]):
    st(sid, "q8", eid, "mcq", f"بمَ توحي لفظة «{word}» في النّصّ؟", {"options": [MEAN[k]] + [m for j, m in enumerate(MEAN) if j != k]},
       {"correct": 0}, SUG_EXPL, 0.25, "ar.comprehension.explain")
st("s19", "q8", "q8-e5", "mcq", "وهل لهذه الألفاظ علاقة بموقف الكاتب؟",
   {"options": ["نعم، تعبّر عن موقف الكاتب الرّافض لهذه الحضارة وضجره منها باعتباره غريبًا عن هذا المجتمع", "لا علاقة لها بموقفه، فهي ألفاظ محايدة",
                "نعم، تعبّر عن إعجابه بهذه الحضارة", "نعم، تعبّر عن رغبته في البقاء في هذا المجتمع"]},
   {"correct": 0}, SUG_EXPL, 0.5, "ar.comprehension.opinion")
IRAB_EXPL = ("الضّبط بالشّكل: المدينةَ – تبدُو – سرابًا – نفسِي. الإعراب: المدينة: بدل من اسم الإشارة منصوب. تبدو: فعل مضارع مرفوع وعلامة رفعه الضّمّة "
             "المقدّرة على الواو. سرابا: حال منصوبة وعلامة نصبها الفتحة الظّاهرة. نفسي: نفس: اسم إنّ منصوب وعلامة نصبه الفتحة، وحرّك بالكسرة لاشتغال "
             "المحلّ بالياء، وهو مضاف، الياء: ضمير متّصل في محلّ جرّ بالإضافة. (أفتّش عنه): صلة موصول لا محلّ لها من الإعراب. (لا يستطيعون): جملة فعليّة "
             "في محلّ رفع خبر لكنّ.")
st("s20", "q9", "q9-e1", "mcq", "اضبط بالشّكل الحركة الإعرابيّة للكلمات الّتي تحتها خطّ (المدينة – تبدو – سرابا – نفسي):",
   {"options": ["المدينةَ – تبدُو – سرابًا – نفسِي", "المدينةِ – تبدُو – سرابٌ – نفسَي", "المدينةُ – تبدَو – سرابًا – نفسُي", "المدينةَ – تبدِي – سرابٍ – نفسِي"]},
   {"correct": 0}, IRAB_EXPL, 0.5, "ar.grammar.irab")
st("s21", "q9", "q9-e2", "mcq", "ما إعراب «المدينة» في قوله: «سئمتُ هذه المدينة الأمريكية»؟",
   {"options": ["بدل من اسم الإشارة منصوب", "مفعول به منصوب", "مضاف إليه مجرور", "مبتدأ مرفوع"]}, {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.badal")
st("s22", "q9", "q9-e3", "mcq", "ما إعراب «تبدو» في قوله: «تبدو لي سرابا في سراب»؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على الواو", "فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة",
                "فعل مضارع منصوب وعلامة نصبه الفتحة المقدّرة", "فعل مضارع مجزوم وعلامة جزمه حذف حرف العلّة"]},
   {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.irab")
st("s23", "q9", "q9-e4", "mcq", "ما إعراب «سرابا» في قوله: «تبدو لي سرابا في سراب»؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة", "تمييز منصوب وعلامة نصبه الفتحة الظّاهرة",
                "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة"]},
   {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.irab")
st("s24", "q9", "q9-e5", "mcq", "ما إعراب «نفس» من «نفسي» في قوله: «إنّ نفسي لفي أمسّ الحاجة»؟",
   {"options": ["اسم إنّ منصوب وعلامة نصبه الفتحة، وحرّك بالكسرة لاشتغال المحلّ بالياء، وهو مضاف", "خبر إنّ مرفوع وعلامة رفعه الضّمّة المقدّرة، وهو مضاف",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة المقدّرة، وهو مضاف", "مفعول به منصوب وعلامة نصبه الفتحة المقدّرة، وهو مضاف"]},
   {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.nawasikh")
st("s25", "q9", "q9-e6", "mcq", "ما المحلّ الإعرابيّ لجملة (أفتّش عنه) في قوله: «إنّ ما (أفتّشُ عنه) لم أجده أبدا»؟",
   {"options": ["صلة موصول لا محلّ لها من الإعراب", "في محلّ رفع خبر إنّ", "في محلّ نصب حال", "في محلّ نصب مفعول به"]},
   {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.sentence_case")
st("s26", "q9", "q9-e7", "mcq", "ما المحلّ الإعرابيّ لجملة (لا يستطيعون) في قوله: «ولكنّهم (لا يستطيعون)»؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر لكنّ", "جملة فعليّة في محلّ نصب اسم لكنّ", "جملة استئنافيّة لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب حال"]},
   {"correct": 0}, IRAB_EXPL, 0.25, "ar.grammar.sentence_case")
IMG_EXPL = ("أ. «تبدو لي سرابا»: تشبيه بليغ، سوّى الكاتب بين نتاج الحضارة الأمريكيّة و«السّراب» فقوّى المعنى وجمع بين طرفي التّشبيه وهما لا يجتمعان واقعًا، "
            "فأثار الإعجاب. ب. «تُسيل اللّعاب عن أفخم السّيّارات»: كناية عن صفة الإثارة والإغراء، فصوّر الكاتب المعنى تصويرًا حسّيًّا مرئيًّا ممّا يجعله قريبًا من الذّهن.")
st("s27", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في «تبدو لي سرابا»؟",
   {"options": ["تشبيه بليغ", "استعارة مكنيّة", "كناية عن صفة", "مجاز مرسل"]}, {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.simile")
st("s28", "q10", "q10-e2", "mcq", "ما وجه بلاغة التّشبيه في «تبدو لي سرابا»؟",
   {"options": ["سوّى بين نتاج الحضارة الأمريكيّة والسّراب فقوّى المعنى، وجمع بين طرفين لا يجتمعان واقعًا فأثار الإعجاب", "تقديم الحقيقة مصحوبة بالدّليل عليها",
                "إحداث جرس موسيقيّ تطرب له الأذن", "تشخيص الجماد وبثّ الحياة فيه"]},
   {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
st("s29", "q10", "q10-e3", "mcq", "ما نوع الصّورة البيانيّة في «تُسيل اللّعاب عن أفخم السّيّارات»؟",
   {"options": ["كناية عن صفة الإثارة والإغراء", "تشبيه بليغ", "استعارة تصريحيّة", "مجاز مرسل علاقته المحلّيّة"]}, {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metonymy")
st("s30", "q10", "q10-e4", "fill_blank", "أكمل وجه بلاغة الكناية:",
   {"text": "صوّر الكاتب المعنى تصويرًا ____ مرئيًّا ممّا يجعله ____ من الذّهن.", "bank": ["حسّيًّا", "قريبًا", "مجرّدًا", "بعيدًا"]},
   {"blanks": [["حسّيًّا", "حسيا"], ["قريبًا", "قريبا"]]}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_EXPL = ("نلاحظ من خلال النّصّ ما يلي: عدم اعتماد المحسّنات اللّفظيّة كالجناس والسّجع وغيرهما؛ وضوح الأفكار باعتماد المفردات السّهلة، والجمل البسيطة؛ "
             "الاهتمام بالموضوع؛ أسلوب التّرسّل. الشّواهد: توظيف المفردات السّهلة مثل: سئمت – الغارقة – رياء – تمويه – الحزن – الغضب…؛ والجمل البسيطة مثل: "
             "«إنّ نفسي لفي أمسّ الحاجة إلى الاستجمام»؛ وتبدو الرّسالة واضحة من خلال عدم الاغترار بمظاهر الحضارة الغربيّة والتّمسّك بالجذور: «والغريب عن نفسه "
             "غريب عن كلّ شيء»، «لكنّهم لا يستطيعون أن يضمنوك ضدّ الحزن والغضب والشّكّ والقلق والسّأم».")
st("s31", "q11", "q11-e1", "multi", "وضّح القول: أيّ ممّا يلي من خصائص المقالة الحديثة الّتي نلاحظها في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["عدم اعتماد المحسّنات اللّفظيّة كالجناس والسّجع", "وضوح الأفكار باعتماد المفردات السّهلة والجمل البسيطة", "الاهتمام بالموضوع",
                "أسلوب التّرسّل", "الإكثار من السّجع والجناس", "الغموض والإغراب في الألفاظ"]},
   {"correct": [0, 1, 2, 3]}, CRIT_EXPL, 1, "ar.literature.features")
st("s32", "q11", "q11-e1", "fill_blank", "أكمل:",
   {"text": "تخلّصت المقالة الحديثة من ____ اللّفظيّة، واعتمدت المفردات ____ والجمل البسيطة، وأسلوب ____.",
    "bank": ["المحسّنات", "السّهلة", "التّرسّل", "الغريبة", "التّكلّف"]},
   {"blanks": [["المحسّنات"], ["السّهلة"], ["التّرسّل"]]}, CRIT_EXPL, 1, "ar.literature.features", "b")
st("s33", "q11", "q11-e2", "matching", "ادعم إجابتك بشواهد: طابق كلّ خاصّيّة بشاهدها من النّصّ.",
   {"lefts": ["المفردات السّهلة", "الجمل البسيطة", "وضوح الرّسالة (عدم الاغترار بالحضارة الغربيّة والتّمسّك بالجذور)"],
    "rights": ["سئمت – الغارقة – رياء – تمويه", "«إنّ نفسي لفي أمسّ الحاجة إلى الاستجمام»", "«والغريب عن نفسه غريب عن كلّ شيء»", "السّجع والجناس المتكلّفان"]},
   {"pairs": [0, 1, 2]}, CRIT_EXPL, 1, "ar.comprehension.evidence")
st("s34", "q11", "q11-e2", "mcq", "ما الهدف الرّساليّ الّذي حمله المقال كما يظهر في شواهده؟",
   {"options": ["عدم الاغترار بمظاهر الحضارة الغربيّة والتّمسّك بالجذور", "الدّعوة إلى الهجرة نحو المدن الكبرى", "الإشادة بالدّولار وسلطانه",
                "التّرويج للرّياضة والملاهي"]},
   {"correct": 0}, CRIT_EXPL, 1, "ar.comprehension.values", "b")

TITLE = "بكالوريا 2009 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (ميخائيل نعيمة)"
NOTES = ((("محجوبة (BLOCKED): " if BLOCKED else "") +
          "موضوع البكالوريا الرّسميّ (دورة جوان 2009، شعبة آداب وفلسفة) موجود في Drive صاحب المنصّة صورةً ممسوحة فقط: "
          f"gdrive:{OFFICIAL_ID} (عنوانه خطأً «اللغة الإنجليزية»، ص3–4)، ونسخة صاحب المنصّة gdrive:{OWNER_PDF_ID}؛ والحافّة اليمنى مغطّاة بشريط أسود "
          "يُخفي أوائل أسطر النّصّ. أُكملت من المصادر الرّسميّة (الأسئلة والإجابة النّموذجيّة): تبدو، خلوة، غريب، فمواسم، أفخم، هرج، وتضليل، أن يضمنوك، لفي. "
          "بقي غير مقروء: أوّل السّطر 11 «[…]عاصير والنّار» (لا يقتبسه أيّ مصدر رسميّ). "
          f"لا يُستعمل: «01_الموضوع.pdf» في مجلّد 2009 gdrive:{WRONG_ONEC_ID} (موضوع اللّغة الإنجليزيّة)، وملفّ docx المقدَّم gdrive:{WRONG_DOCX_ID} (موضوع 2010). "
          "لرفع الحجب: تأكيد بداية السّطر 11 من نسخة سليمة وملء HIDDEN في المحوّل ثمّ إعادة البناء. "
          "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص2–4). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
          "مؤجَّل (essay_builder): التّلخيص س6 (3×1)."))
LOG_NOTE = ("تحويل من صورة الموضوع الرّسميّ (منسوخ يدويًّا؛ أوائل الأسطر المخفيّة أُكملت من الأسئلة والإجابة النّموذجيّة إلاّ واحدًا فالمجموعة محجوبة) "
            "والإجابة النّموذجيّة الرّسميّة؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة.")

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
