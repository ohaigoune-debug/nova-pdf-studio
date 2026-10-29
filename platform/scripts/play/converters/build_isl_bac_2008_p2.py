"""Conversion: BAC 2008 (دورة جوان 2008، الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الثّاني
(حديث النّعمان بن بشير في العدل بين الأولاد، أخرجه البخاريّ + الإجماع: تعريفه وأنواعه ومثالان عنه).
PILOT for subject ISL (CONVERSION_GUIDE.md, Appendix A). Usage:
  python3 scripts/play/converters/build_isl_bac_2008_p2.py content/play-exams/sets/3AS/ISL/isl-bac-2008-p2.json
  python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/ISL/isl-bac-2008-p2.json   (ONCE)

Sources (owner's Drive):
- Paper: gdrive 1OI6h7IQuoHjWALqj5BU710U3HHmURt_i («الموضوع.pdf», 2 pages: p1 = الموضوع الأوّل, p2 = الموضوع الثّاني).
- Official model answer + mark scheme: gdrive 1S1PAGrP7AXlx5PyKvHr_JHNedsmINXEe («التصحيح.pdf», p2 = الموضوع الثّاني).
Both PDFs are scans with NO text layer (one 1-bit page image each, 96 ppi native). Drive's read_file_content OCR export
(scrambled columns, dropped diacritics, garbage marks such as «55», «22-», «བ་ | on» for page 2 of the correction) was
used only as a helper. Every verbatim string and every mark below was TRANSCRIBED FROM THE PAGE IMAGES (pdftoppm -r 150,
then Lanczos/bicubic crops enlarged ×3–×14 for the diacritics).

Transcription decisions (owner to check once against the paper):
- Streams: header «جميـــــع الشعب» (page 1 of the same paper) ⇒ SCI, MATH, TM, GE, LIT, LANG.
- Hadith copied with every diacritic visible on the scan: «عامرٍ»، «سمعتُ»، «النّعمان»، «بنَ بشيرٍ»، «أعْطَانِي أبِي عطيّةً»،
  «عَمْرَةُ بنتُ رواحةَ»، «لا أرضَى حتّى تُشْهِدَ رسولَ الله»، «إِنّي أعْطَيْتُ»، «عمرةَ»، «عَطيّةً»، «أُشهدَك»، «أعْطَيْتَ سائرَ ولدِك
  مثْلَ هذا؟»، «فاتَّقُوا»، «أولادِكم.قال:» (no space after the full stop, as printed)، «فرجعَ فردَّ عطيّته.))». «على» and «فأتى»
  are printed with a dotless final yā'. «وسلم» has no shadda in both occurrences.
- Kashida: the matn is set in justified lines and Word stretched several words to fill them («وســـلم»، «عَطيّـــةً»،
  «فـــأمرتني»، «قـــال»، «فـــاتّقوا»، «واعـــدلوا بـــين»). These are justification elongations, not typed tatweel, and are NOT
  transcribed. The free-standing dashes «ــ أخرجه البخاري ــ»، «ــ مع الدليل ــ»، «ــ عرّفْهُ» are kept as «ــ».
- Uncertain marks (kept minimal, flagged): over «النّعمان»، «صلّى» (×2)، «إِنّي»، «بيّن» (Q2)، «وبَيّن»/«عرّفْهُ» (part 2) the
  shadda is legible but the vowel drawn with it (fatha/kasra) is not at 96 ppi ⇒ shadda only.
- Q2 printed with a space before «؟» («بينهم ؟») ⇒ kept.
- Correction p2 «توريث الجدة السدس»: the «د» is faded (OCR reads «السنس»); the image shows no dot over it ⇒ «السدس».
- The correction's mark column header on p2 is printed «التنفيط» (typo of the source), not reused.

Rubric reading (correction p2, one rubric element per mark line of the «التنقيط» column; n×m lines stay ONE element
labelled (n×m) and their steps split the mark by sub-item):
- Q1 (05): «2×1 / 2 / 1» beside «مشروعية منح الأولاد الهدايا والعطايا. – توثيق الهدايا والعطايا بالإشهاد عليها.» /
  «الأمر بتقوى الله عز وجل والعدل بين الأولاد.» / «رجوع الوالد في عطيته لولده.» ⇒ elements 2 (two mcq of 1) + 2 (mcq
  «تقوى الله» 1 + mcq «العدل بين الأولاد» 1: the two halves of the correction's sentence) + 1.
  DECISION (as in p1): «اشرح الحديث الشريف شرحا موجزا» is INTERACTIVE because the correction fixes and marks each point.
- Q2 (06): «0.5» حكم العدل (وجوب العدل بين الأبناء) + «0.5» الدّليل («(اتقوا الله واعدلوا بين أولادكم) - الحديث -»; the
  option quotes the paper's own text «فاتَّقُوا الله، واعدلوا بين أولادِكم», distractors are other sentences of the same
  hadith that are not evidence for the ruling; «أعْطَيْتَ سائرَ ولدِك مثْلَ هذا؟» and «فرجعَ فردَّ عطيّته» are deliberately
  NOT used as distractors because they can be argued as supporting evidence) + «5 × 01» خمسة مخاطر ⇒ one element 5:
  multi (5 of 8) 2.5 + fill_blank 2.5.
- Q3 (03): «3×01» الفوائد ⇒ one element 3: multi (3 of 6) 1.5 + fill_blank 1.5.
- Part 2 (06): «01» التّعريف (mcq with near-miss definitions 0.5 + fill_blank 0.5) + «2 ×0.5» الأنواع ⇒ one element 1
  (multi 2 of 4) + «2×01» بيان النّوعين ⇒ one element 2 (mcq الصّريح 1 + mcq السّكوتيّ 1) + «2×01» مثالان ⇒ one element 2
  (multi 1 + fill_blank 1).
- No item of this topic is open (no «ناقش» / «برأيك» / «تقبل كل إجابة»): 0 deferred points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "isl-bac-2008-p2"
PAPER = 2
STREAMS = ["SCI", "MATH", "TM", "GE", "LIT", "LANG"]
PAPER_ID = "1OI6h7IQuoHjWALqj5BU710U3HHmURt_i"
PAPER_TITLE = "الموضوع.pdf"
CORR_ID = "1S1PAGrP7AXlx5PyKvHr_JHNedsmINXEe"
CORR_TITLE = "التصحيح.pdf"

# ── النّصوص الحرفيّة (منسوخة من صورة الورقة الرّسميّة، ص2) ──
ISNAD = "عن عامرٍ، قال سمعتُ النّعمان بنَ بشيرٍ رضي الله عنهما، وهو على المنبر يقول:"
MATN = ("(( أعْطَانِي أبِي عطيّةً، فقالت عَمْرَةُ بنتُ رواحةَ: لا أرضَى حتّى تُشْهِدَ رسولَ الله صلّى الله عليه وسلم، "
        "فأتى رسولَ الله صلّى الله عليه وسلم، فقال: إِنّي أعْطَيْتُ ابني من عمرةَ بنت رواحة عَطيّةً، فأمرتني أن أُشهدَك يا رسولَ الله، "
        "قال: أعْطَيْتَ سائرَ ولدِك مثْلَ هذا؟ قال: لا، قال: فاتَّقُوا الله، واعدلوا بين أولادِكم.قال: فرجعَ فردَّ عطيّته.))")
REF = "ــ أخرجه البخاري ــ"
P1 = "الجزء الأول: (14 نقطة)"
P2 = "الجزء الثاني: (06 نقاط)"
QT = {
    1: "اشرح الحديث الشريف شرحا موجزا.",
    2: "بيّن حكم العدل بين الأبناء ــ مع الدليل ــ، ثم اذكر خمسة مخاطر في التفريق بينهم ؟",
    3: "استخرج ثلاث فوائد من الحديث الشريف.",
    4: "من مصادر التشريع الإسلامي: الإجماع.\nــ عرّفْهُ، وبَيّن أنواعه ومثالَيْن عنه.",
}
# مقاطع الحديث المقتبسة في الخطوات: تُقتطع من النّصّ المنسوخ نفسه
Q_ATA = "أعْطَانِي أبِي عطيّةً"
Q_ISHHAD = "لا أرضَى حتّى تُشْهِدَ رسولَ الله صلّى الله عليه وسلم"
Q_AMARATNI = "فأمرتني أن أُشهدَك يا رسولَ الله"
Q_DALIL = "فاتَّقُوا الله، واعدلوا بين أولادِكم"
for _seg in (Q_ATA, Q_ISHHAD, Q_AMARATNI, Q_DALIL):
    assert _seg in MATN, _seg
DOCS = [
    {"id": "d-hadith", "kind": "text", "caption": "الحديث الشريف", "text": f"{ISNAD}\n{MATN}"},
    {"id": "d-ref", "kind": "text", "caption": "التخريج", "text": REF},
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


q("q1", "1", P1, QT[1], 5, [el("q1-e1", "مشروعية منح الأولاد الهدايا والعطايا، وتوثيقها بالإشهاد عليها (2×1)", 2),
                           el("q1-e2", "الأمر بتقوى الله عزّ وجلّ والعدل بين الأولاد", 2), el("q1-e3", "رجوع الوالد في عطيته لولده", 1)])
q("q2", "2", P1, QT[2], 6, [el("q2-e1", "حكم العدل بين الأبناء", 0.5), el("q2-e2", "الدليل", 0.5),
                           el("q2-e3", "مخاطر التفريق بين الأبناء (5×1)", 5)])
q("q3", "3", P1, QT[3], 3, [el("q3-e1", "ثلاث فوائد من الحديث (3×1)", 3)])
q("q4", "—", P2, QT[4], 6, [el("q4-e1", "تعريف الإجماع", 1), el("q4-e2", "أنواع الإجماع (2×0.5)", 1),
                           el("q4-e3", "بيان النوعين (2×1)", 2), el("q4-e4", "مثالان عن الإجماع (2×1)", 2)], docs=[])

# ── الجزء الأوّل — 1. الشّرح الموجز ──
Q1_EXPL = ("الشّرح الموجز للحديث (الإجابة النّموذجيّة): يراعى في الشّرح النّقاط التّالية: مشروعيّة منح الأولاد الهدايا والعطايا – توثيق "
           "الهدايا والعطايا بالإشهاد عليها – الأمر بتقوى الله عزّ وجلّ والعدل بين الأولاد – رجوع الوالد في عطيّته لولده.")
st("s01", "q1", "q1-e1", "mcq", f"ماذا يُستفاد من قول النّعمان: «{Q_ATA}» في شرح الحديث؟",
   {"options": ["مشروعية منح الأولاد الهدايا والعطايا", "تحريم منح الأولاد الهدايا والعطايا", "وجوب منح الأولاد عطية في كلّ مناسبة",
                "أنّ عطية الوالد لولده لا تصحّ إلا بإذن القاضي"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.ruling")
st("s02", "q1", "q1-e1", "mcq", f"ما الذي يدلّ عليه قول عمرة بنت رواحة: «{Q_ISHHAD}»؟",
   {"options": ["توثيق الهدايا والعطايا بالإشهاد عليها", "تحريم الهدايا بين الأقارب", "أنّ الإشهاد يكون على البيع دون الهبة",
                "أنّ الأمّ هي التي تتولّى قسمة مال الأسرة"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.ruling", "b")
st("s03", "q1", "q1-e2", "mcq", "بمَ بدأ النبيّ صلّى الله عليه وسلّم أمره لوالد النّعمان؟",
   {"options": ["بتقوى الله عزّ وجلّ", "بالإكثار من الصلاة والصيام", "بالتصدّق بالعطية على الفقراء", "بالاستئذان من أمّ الولد"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.ruling")
st("s04", "q1", "q1-e2", "mcq", "وبمَ أمره في معاملة أولاده؟",
   {"options": ["بالعدل بين الأولاد", "بتفضيل الولد الأكبر في العطية", "بإعطاء العطية كلّها لأمّهم", "بترك العطية للأولاد مطلقًا"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.ruling", "b")
st("s05", "q1", "q1-e3", "mcq", "ماذا فعل والد النّعمان بعد أمر النبيّ صلّى الله عليه وسلّم؟",
   {"options": ["رجع في عطيته لولده", "زاد في عطية النّعمان", "أبقى العطية للنّعمان وحده", "أعطى العطية لأمّ النّعمان"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.ruling")
# ── 2. الحكم والدّليل والمخاطر ──
HUKM_EXPL = "حكم العدل بين الأبناء (الإجابة النّموذجيّة): وجوب العدل بين الأبناء. الدّليل: (اتّقوا الله واعدلوا بين أولادكم) – الحديث –."
st("s06", "q2", "q2-e1", "mcq", "ما حكم العدل بين الأبناء؟",
   {"options": ["وجوب العدل بين الأبناء", "استحباب العدل بين الأبناء دون وجوب", "إباحة تفضيل بعض الأبناء على بعض في العطية",
                "كراهة التسوية بين الأبناء في العطية"]},
   {"correct": 0}, HUKM_EXPL, 0.5, "isl.ruling")
st("s07", "q2", "q2-e2", "mcq", "ما الدليل من الحديث على وجوب العدل بين الأبناء؟",
   {"options": [f"«{Q_DALIL}»", f"«{Q_ISHHAD}»", f"«{Q_ATA}»", f"«{Q_AMARATNI}»"]},
   {"correct": 0}, HUKM_EXPL, 0.5, "isl.evidence")
MAKHATIR_EXPL = ("مخاطر التّفريق بين الأبناء (الإجابة النّموذجيّة): الشّعور بالظّلم – العقوق – قطع الأرحام – انتشار العداوة والبغضاء بينهم – "
                 "الأزمات النّفسيّة والمشاكل الحياتيّة.")
st("s08", "q2", "q2-e3", "multi", "من مخاطر التفريق بين الأبناء (اختر خمسة):",
   {"options": ["الشعور بالظلم", "العقوق", "قطع الأرحام", "انتشار العداوة والبغضاء بينهم", "الأزمات النفسية والمشاكل الحياتية",
                "برّ الأبناء بآبائهم", "تقوية المحبّة بين الإخوة", "تماسك الأسرة واستقرارها"]},
   {"correct": [0, 1, 2, 3, 4]}, MAKHATIR_EXPL, 2.5, "isl.values")
st("s09", "q2", "q2-e3", "fill_blank", "أكمل مخاطر التفريق بين الأبناء:",
   {"text": "الشعور بـ____، و____، وقطع ____، وانتشار العداوة و____ بينهم، والأزمات ____ والمشاكل الحياتية.",
    "bank": ["الظلم", "العقوق", "الأرحام", "البغضاء", "النفسية", "البرّ", "المودّة", "الاقتصادية"]},
   {"blanks": [["الظلم"], ["العقوق"], ["الأرحام"], ["البغضاء"], ["النفسية"]]}, MAKHATIR_EXPL, 2.5, "isl.values", "b")
# ── 3. الفوائد ──
Q3_EXPL = ("استخراج ثلاث فوائد من الحديث (الإجابة النّموذجيّة): مشروعيّة الهبة – مشروعيّة الإشهاد على الهبة – وجوب الرّجوع إلى الصّواب "
           "إذا تبيّن الخطأ.")
st("s10", "q3", "q3-e1", "multi", "أيّ ممّا يلي من الفوائد المستخرجة من الحديث؟ (اختر ثلاثًا)",
   {"options": ["مشروعية الهبة", "مشروعية الإشهاد على الهبة", "وجوب الرجوع إلى الصواب إذا تبيّن الخطأ", "تحريم الهبة للأولاد",
                "جواز تفضيل بعض الأولاد في العطية", "منع الوالد من الرجوع في عطيته لولده"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 1.5, "isl.ruling")
st("s11", "q3", "q3-e1", "fill_blank", "أكمل الفوائد الثلاث المستخرجة من الحديث:",
   {"text": "مشروعية ____، ومشروعية ____ على الهبة، و____ الرجوع إلى الصواب إذا تبيّن الخطأ.",
    "bank": ["الهبة", "الإشهاد", "وجوب", "الوصية", "الكتمان", "تحريم"]},
   {"blanks": [["الهبة"], ["الإشهاد"], ["وجوب"]]}, Q3_EXPL, 1.5, "isl.ruling", "b")
# ── الجزء الثّاني: الإجماع ──
TARIF = "اتفاق جميع المجتهدين من المسلمين في عصر من العصور بعد وفاة الرسول صلّى الله عليه وسلّم على حكم من الأحكام الشرعية العملية"
TARIF_EXPL = f"تعريف الإجماع (الإجابة النّموذجيّة): {TARIF}."
st("s12", "q4", "q4-e1", "mcq", "ما تعريف الإجماع؟",
   {"options": [TARIF, "اتفاق أكثر المجتهدين من المسلمين في عصر من العصور على حكم من الأحكام الشرعية العملية",
                "اتفاق الصحابة في حياة الرسول صلّى الله عليه وسلّم على حكم من الأحكام الشرعية", "اتفاق عامّة المسلمين على حكم من الأحكام العقدية"]},
   {"correct": 0}, TARIF_EXPL, 0.5, "isl.concept")
st("s13", "q4", "q4-e1", "fill_blank", "أكمل تعريف الإجماع:",
   {"text": "اتفاق ____ المجتهدين من المسلمين في عصر من العصور ____ وفاة الرسول صلّى الله عليه وسلّم على حكم من الأحكام الشرعية ____.",
    "bank": ["جميع", "بعد", "العملية", "أكثر", "قبل", "العقدية"]},
   {"blanks": [["جميع"], ["بعد"], ["العملية"]]}, TARIF_EXPL, 0.5, "isl.concept", "b")
ANWA_EXPL = ("أنواع الإجماع (الإجابة النّموذجيّة): الإجماع الصّريح – الإجماع السّكوتيّ. الصّريح: اتّفاق المجتهدين على قول أو فعل بشكل صريح. "
             "السّكوتيّ: أن يقول أو يعمل أحد المجتهدين بقول أو عمل، فيعلم الباقون بذلك، فلا يظهرون معارضة ما.")
SARIH = "اتفاق المجتهدين على قول أو فعل بشكل صريح"
SUKUTI = "أن يقول أو يعمل أحد المجتهدين بقول أو عمل، فيعلم الباقون بذلك، فلا يظهرون معارضة ما"
st("s14", "q4", "q4-e2", "multi", "ما نوعا الإجماع؟ (اختر اثنين)",
   {"options": ["الإجماع الصريح", "الإجماع السكوتي", "القياس الجليّ", "المصلحة المرسلة"]},
   {"correct": [0, 1]}, ANWA_EXPL, 1, "isl.concept")
st("s15", "q4", "q4-e3", "mcq", "ما المقصود بالإجماع الصريح؟",
   {"options": [SARIH, SUKUTI, "أن يصرّح مجتهد واحد برأيه فيأخذ به الحاكم", "اتفاق أكثر المجتهدين مع مخالفة بعضهم صراحة"]},
   {"correct": 0}, ANWA_EXPL, 1, "isl.concept")
st("s16", "q4", "q4-e3", "mcq", "ما المقصود بالإجماع السكوتي؟",
   {"options": [SUKUTI, SARIH, "أن يسكت جميع المجتهدين عن المسألة فلا يقول فيها أحد شيئًا", "اتفاق عامّة المسلمين على حكم دون المجتهدين"]},
   {"correct": 0}, ANWA_EXPL, 1, "isl.concept", "b")
AMTHILA_EXPL = "مثالان عن الإجماع (الإجابة النّموذجيّة): إجماع الصّحابة على توريث الجدّة السّدس – إجماعهم على جمع القرآن في مصحف واحد."
st("s17", "q4", "q4-e4", "multi", "اختر مثالين عن الإجماع:",
   {"options": ["إجماع الصحابة على توريث الجدّة السدس", "إجماعهم على جمع القرآن في مصحف واحد", "اختلاف المجتهدين في حكم مسألة واحدة",
                "رأي فقيه واحد خالفه فيه سائر المجتهدين"]},
   {"correct": [0, 1]}, AMTHILA_EXPL, 1, "isl.concept")
st("s18", "q4", "q4-e4", "fill_blank", "أكمل المثالين عن الإجماع:",
   {"text": "إجماع الصحابة على توريث الجدّة ____، وإجماعهم على جمع القرآن في ____ واحد.", "bank": ["السدس", "مصحف", "الثلث", "مجلس"]},
   {"blanks": [["السدس"], ["مصحف"]]}, AMTHILA_EXPL, 1, "isl.concept", "b")

TITLE = ("بكالوريا 2008 (دورة جوان، الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الثّاني "
         "(حديث النّعمان بن بشير في العدل بين الأولاد / الإجماع)")
NOTES = ("موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، «جميع الشّعب»، المدّة ساعتان ونصف) "
         f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، ص2 = الموضوع الثّاني). الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان في ملفّ مستقلّ: "
         f"gdrive:{CORR_ID} ({CORR_TITLE}، ص2). "
         "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): الملفّان مسح ضوئيّ بلا طبقة نصّ (96 نقطة في البوصة)، قُرئا مصوّرين بتكبير؛ "
         "نصّ OCR من Drive استُعمل مساعدًا فقط. "
         "الحديث منسوخ بكلّ ما يظهر من ضبط؛ التّمديد في الأسطر المضبوطة (وســـلم، عَطيّـــةً، فـــأمرتني، قـــال، فـــاتّقوا، واعـــدلوا بـــين) "
         "تمديد ضبط للسّطر من محرّر النّصوص لا حرف تطويل، فلم يُنقل؛ أمّا الشّرطات «ــ» المستقلّة فنُقلت. "
         "في «النّعمان» و«صلّى» و«إِنّي» و«بيّن» و«وبَيّن» و«عرّفْهُ» الشّدّة مقروءة والحركة معها غير مميّزة فنُقلت الشّدّة وحدها. "
         "فروق OCR/الصّورة: OCR أسقط معظم الضّبط («عن عامر، قال سمعت النعمان بن بشير» وفي الصّورة «عن عامرٍ، قال سمعتُ النّعمان بنَ بشيرٍ»، "
         "«أبي» وفي الصّورة «أبِي»، «إنّي أَعْطَيْتُ» وفي الصّورة «إِنّي أعْطَيْتُ»، «فرجع فرد عطيته» وفي الصّورة «فرجعَ فردَّ عطيّته»)، وأضاف مسافة "
         "بعد «أولادكم.» وليست في الصّورة، وأسقط شرطتي «ــ أخرجه البخاري ــ» و«ــ مع الدليل ــ»، وكتب «عرفه، وبين» وفي الصّورة «عرّفْهُ، وبَيّن». "
         "التّصحيح: علامات الصّفحة 2 في OCR مشوّهة («55»، «22-»، «བ་ | on»)، والصّورة واضحة: س1 «2×1 / 2 / 1» = 05؛ س2 «0.5 + 0.5 + 5×01» = 06؛ "
         "س3 «3×01» = 03؛ الجزء الثّاني «01 + 2×0.5 + 2×01 + 2×01» = 06؛ المجموع 20. «السدس» في التّصحيح باهتة (OCR: «السنس»). "
         "قرارات التّحويل: عنصر واحد لكلّ سطر علامة في عمود التّنقيط (سطر n×m عنصر واحد تقسم خطواته علامته)؛ «اشرح الحديث شرحا موجزا» "
         "تفاعليّ لأنّ التّصحيح يحدّد نقاط الشّرح ويعلّمها، ويمكن تحويله إلى essay_builder إن فضّل صاحب المنصّة؛ مشتّتات الدّليل جمل أخرى من "
         "الحديث لا تدلّ على الحكم (واستُبعدت «أعْطَيْتَ سائرَ ولدِك مثْلَ هذا؟» و«فرجعَ فردَّ عطيّته» لأنّهما قد تُعدّان دليلًا). "
         "لا عنصر مفتوحًا في هذا الموضوع: النّقاط المؤجَّلة 0.")
LOG_NOTE = ("تحويل من صورتي الموضوع والإجابة النّموذجيّة الرّسميّين (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة "
            "النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة؛ ضبط الحديث المنسوخ يحتاج مقابلة بالورقة.")

# ── تدقيق محلّيّ قبل الكتابة (المهارات من src/server/play/exams/skills.ts؛ التّطبيع نسخة من normalizeArabic في src/server/lib/arabic.ts) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(isl\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) >= 6, "skills.ts not parsed"


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
        "source_id": f"gdrive-{PAPER_ID}-p{PAPER}",
        "kind": "BAC", "year": 2008, "level": "3AS", "streams": STREAMS, "subject": "ISL", "term": None, "paper": PAPER,
        "title": TITLE,
        "original_url": f"https://drive.google.com/file/d/{PAPER_ID}/view",
        "original_file_ref": f"gdrive:{PAPER_ID} ({PAPER_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} ({CORR_TITLE})",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
pathlib.Path(OUT).parent.mkdir(parents=True, exist_ok=True)
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
