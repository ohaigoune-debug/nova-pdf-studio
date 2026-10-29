"""Conversion: BAC 2008 (دورة جوان 2008، الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الأوّل
(آل عمران 134 «الذين ينفقون في السرّاء والضرّاء…» + مفهوم العبادة وأثرها في مكافحة الانحراف والجريمة).
PILOT for subject ISL (CONVERSION_GUIDE.md, Appendix A). Usage:
  python3 scripts/play/converters/build_isl_bac_2008_p1.py content/play-exams/sets/3AS/ISL/isl-bac-2008-p1.json
  python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/ISL/isl-bac-2008-p1.json   (ONCE)

Sources (owner's Drive):
- Paper: gdrive 1OI6h7IQuoHjWALqj5BU710U3HHmURt_i («الموضوع.pdf», 2 pages: p1 = الموضوع الأوّل, p2 = الموضوع الثّاني).
- Official model answer + mark scheme: gdrive 1S1PAGrP7AXlx5PyKvHr_JHNedsmINXEe («التصحيح.pdf», p1 = الموضوع الأوّل).
Both PDFs are scans with NO text layer (one 1-bit page image each, ~593×892 px = 96 ppi native). Drive's read_file_content
gives an OCR export with scrambled columns and dropped diacritics; it was used only as a helper. Every verbatim string and
every mark below was TRANSCRIBED FROM THE PAGE IMAGES (pdftoppm -r 150, then Lanczos crops enlarged ×3–×12).

Transcription decisions (owner to check once against the paper):
- Streams: header «جميـــــع الشعب» ⇒ SCI, MATH, TM, GE, LIT, LANG (the six 2008 streams).
- The verse is printed as a Mushaf-font image whose hamzat al-wasl marks sit ABOVE (after a fatha: ٱلَّذِينَ، وَٱلْكَٰظِمِينَ…),
  BELOW (after a kasra: فِى ٱلسَّرَّآءِ، عَنِ ٱلنَّاسِ) or MIDDLE (after a damma: يُحِبُّ ٱلْمُحْسِنِينَ) — the Warsh-mushaf
  convention. Unicode has no code point for the below/middle positions, so every hamzat al-wasl is written ٱ (U+0671).
  Sukun is written ْ (U+0652): its exact shape (circle vs. dotless head of khah ۡ) cannot be told apart at 96 ppi.
  The final yā' of «فِى» is printed dotless (returned stroke) ⇒ ى (U+0649). Dagger alif ٰ in «وَٱلْكَٰظِمِينَ» is visible.
  Ayah marker printed as a rosette with «١٣٤»; ornate brackets ﴿ … ﴾ (repo convention U+FD3F … U+FD3E). Line breaks of
  the three printed lines are layout and are joined with spaces.
- UNREAD (not transcribed, flagged): a small pause-like mark (shape of a tiny «صـ») above the last letter of «ٱلنَّاسِ»
  and another above the end of «ٱلْمُحْسِنِينَ». At 96 ppi it cannot be identified (ۖ / ۗ / Maghribi «صه» …), so it is
  left out rather than guessed. Nothing in the questions or the correction depends on it.
- Reference printed «[ال عمران / 134]» (no hamza/madda on «ال»), kept as printed.
- Q2 is printed «ذ كر الله» with a clear space between ذ and كر (compare «اذكر» on the next line, no gap) ⇒ kept.
- «وبيّن» (Q2) and «بيّن» (part 2): the shadda is legible, the vowel drawn with it (kasra vs fatha) is not ⇒ shadda only.
  Tanween position in «شرحًا» / «ثلاثًا» (before vs. on the alif) is not distinguishable ⇒ written on the letter before alif.
- Part label «الجزء الأوّل» etc. copied as printed «الجزء الأول: (14 نقطة)» / «الجزء الثاني: (06 نقاط)».

Rubric reading (correction p1, one rubric element per mark line of the «التنقيط» column; n×m lines stay ONE element
labelled (n×m) and their steps split the mark by sub-item, as the exemplar does for «أربعة مظاهر (0.5 لكلّ مظهر)»):
- Q1 (05): «2×1 / 1 / 2» beside «الترغيب في الإنفاق. – تملك النفس عند الغضب.» / «العفو عند المقدرة.» / «محبة الله عز
  وجل للمحسنين.» ⇒ elements 2 (two mcq of 1) + 1 + 2 (one mcq of 2: a single idea, no faithful second step).
  DECISION: «اشرح الآية شرحًا موجزا» is INTERACTIVE, not essay_builder: the correction fixes the content
  («يراعى في الشّرح النّقاط التّالية») and marks each point, like «اشرح البيت» in the AR exemplar. Each step asks which
  idea a quoted part of the verse carries; the right option is the correction's own wording.
- Q2 (06): «3 × 0.5» القيم (الإحسان – التكافل الاجتماعي – العفو) ⇒ one element 1.5 (multi, 3 of 6; distractors are values
  absent from the verse, never arguable ones such as الكرم/الحلم). «3 × 01.5» بيان أهميتها ⇒ one element 4.5, two steps
  of 0.75 per value from the correction's sentences (mcq + fill_blank / ordering of the circles of التكافل).
  (The correction's heading reads «بيان أهميتهما» — dual — typo of the source, not reused.)
- Q3 (03): «3 × 01» الفوائد ⇒ one element 3: multi (3 of 6) 1.5 + fill_blank 1.5 on the correction's wording.
- Part 2 (06): «2×1» مفهوم العبادة ⇒ one element 2: mcq on its scope (1) + fill_blank on «استجابة لأمر الله… إرادته» (1).
  «4 × 01» أثر العبادة في مكافحة الجريمة ⇒ one element 4: multi (4 of 7) 2 + fill_blank 2.
- No item of this topic is open (no «ناقش» / «برأيك» / «تقبل كل إجابة»): 0 deferred points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "isl-bac-2008-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE", "LIT", "LANG"]
PAPER_ID = "1OI6h7IQuoHjWALqj5BU710U3HHmURt_i"
PAPER_TITLE = "الموضوع.pdf"
CORR_ID = "1S1PAGrP7AXlx5PyKvHr_JHNedsmINXEe"
CORR_TITLE = "التصحيح.pdf"

# ── النّصوص الحرفيّة (منسوخة من صورة الورقة الرّسميّة، ص1) ──
INTRO = "قال الله تعالى:"
VERSE = ("﴿ ٱلَّذِينَ يُنفِقُونَ فِى ٱلسَّرَّآءِ وَٱلضَّرَّآءِ وَٱلْكَٰظِمِينَ ٱلْغَيْظَ وَٱلْعَافِينَ عَنِ ٱلنَّاسِ "
         "وَٱللَّهُ يُحِبُّ ٱلْمُحْسِنِينَ ١٣٤ ﴾")
REF = "[ال عمران / 134]"
P1 = "الجزء الأول: (14 نقطة)"
P2 = "الجزء الثاني: (06 نقاط)"
QT = {
    1: "اشرح الآية شرحًا موجزا.",
    2: "ذ كر الله في الآية الكريمة مجموعة من القيم.\nــ اذكر ثلاثًا منها، وبيّن أهميتها من الناحية الإنسانية.",
    3: "استخرج من الآية ثلاث فوائد.",
    4: "للعبادة أثر في مكافحة الانحراف والجريمة. بيّن مفهوم العبادة وأثرها في مكافحة ظاهرة الانحراف والإجرام.",
}
# مقاطع الآية المقتبسة في الخطوات: تُقتطع من النّصّ المنسوخ نفسه (لا من الذّاكرة)
SEG_INFAQ = "ٱلَّذِينَ يُنفِقُونَ فِى ٱلسَّرَّآءِ وَٱلضَّرَّآءِ"
SEG_KAZM = "وَٱلْكَٰظِمِينَ ٱلْغَيْظَ"
SEG_AFW = "وَٱلْعَافِينَ عَنِ ٱلنَّاسِ"
SEG_HUBB = "وَٱللَّهُ يُحِبُّ ٱلْمُحْسِنِينَ"
for _seg in (SEG_INFAQ, SEG_KAZM, SEG_AFW, SEG_HUBB):
    assert _seg in VERSE, _seg
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "التقديم", "text": INTRO},
    {"id": "d-verse", "kind": "text", "caption": "الآية الكريمة", "text": VERSE},
    {"id": "d-ref", "kind": "text", "caption": "التوثيق", "text": REF},
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


q("q1", "1", P1, QT[1], 5, [el("q1-e1", "الترغيب في الإنفاق، وتملّك النفس عند الغضب (2×1)", 2), el("q1-e2", "العفو عند المقدرة", 1),
                           el("q1-e3", "محبة الله عزّ وجلّ للمحسنين", 2)])
q("q2", "2", P1, QT[2], 6, [el("q2-e1", "القيم الثلاث المستخلصة من الآية (3×0.5)", 1.5),
                           el("q2-e2", "بيان أهميتها من الناحية الإنسانية (3×1.5)", 4.5)])
q("q3", "3", P1, QT[3], 3, [el("q3-e1", "ثلاث فوائد من الآية (3×1)", 3)])
q("q4", "—", P2, QT[4], 6, [el("q4-e1", "مفهوم العبادة (2×1)", 2), el("q4-e2", "أثر العبادة في مكافحة الجريمة (4×1)", 4)], docs=[])

# ── الجزء الأوّل — 1. الشّرح الموجز ──
Q1_EXPL = ("الشّرح الموجز للآية (الإجابة النّموذجيّة): يراعى في الشّرح النّقاط التّالية: الترغيب في الإنفاق – تملّك النّفس عند الغضب – "
           "العفو عند المقدرة – محبّة الله عزّ وجلّ للمحسنين.")
st("s01", "q1", "q1-e1", "mcq", f"إلامَ يدعو قوله تعالى: «{SEG_INFAQ}»؟",
   {"options": ["الترغيب في الإنفاق", "التحذير من الإنفاق في أوقات الشدّة", "الترغيب في ادّخار المال للأزمات", "النهي عن الإنفاق على غير الأقارب"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.values")
st("s02", "q1", "q1-e1", "mcq", f"ما المعنى الذي يدلّ عليه قوله تعالى: «{SEG_KAZM}»؟",
   {"options": ["تملّك النفس عند الغضب", "إظهار الغضب والانتقام من المسيء", "كتمان الأسرار عن الناس", "الصبر على الجوع والعطش"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.vocab", "b")
st("s03", "q1", "q1-e2", "mcq", f"ما المعنى الذي يدلّ عليه قوله تعالى: «{SEG_AFW}»؟",
   {"options": ["العفو عند المقدرة", "العفو عن المسيء عند العجز عن معاقبته", "مطالبة الناس بحقوقه كاملة دون تسامح", "الإعراض عن الناس واعتزالهم"]},
   {"correct": 0}, Q1_EXPL, 1, "isl.vocab")
st("s04", "q1", "q1-e3", "mcq", f"ماذا يفيد ختم الآية بقوله تعالى: «{SEG_HUBB}»؟",
   {"options": ["محبة الله عزّ وجلّ للمحسنين", "أنّ محبّة الله خاصّة بالأغنياء دون غيرهم", "أنّ الإحسان مقصور على إنفاق المال",
                "أنّ الله يحبّ من ينتقم لنفسه"]},
   {"correct": 0}, Q1_EXPL, 2, "isl.values")
# ── 2. القيم وأهمّيّتها ──
Q2_EXPL = "القيم الثّلاث المستخلصة من الآية (الإجابة النّموذجيّة): الإحسان – التّكافل الاجتماعيّ – العفو."
IHSAN_EXPL = ("الإحسان: للإحسان أهمّيّة كبرى من النّاحية الإنسانيّة فهو الأسلوب العمليّ في تقديم الخير للآخرين من موقع الحقّ الذي يمتلكونه "
              "في ذلك، لأنّ الله يحبّ أن تنطلق العلاقات بين النّاس على أساس حبّ الخير وروح العطاء.")
TAKAFUL_EXPL = ("التّكافل الاجتماعيّ: التّكافل في الإسلام يتدرّج ليشمل الإنسانيّة جمعاء، حيث يبدأ المسلم بدائرته الذّاتيّة ثمّ الأسريّة "
                "ثمّ محيطه الاجتماعيّ.")
AFW_EXPL = "العفو: ينشر المودّة بين النّاس، ويرتقي بصاحبه إلى درجات السّموّ الأخلاقيّ."
st("s05", "q2", "q2-e1", "multi", "اختر ثلاثًا من القيم التي ذكرها الله في الآية الكريمة.",
   {"options": ["الإحسان", "التكافل الاجتماعي", "العفو", "الأمانة", "برّ الوالدين", "طلب العلم"]},
   {"correct": [0, 1, 2]}, Q2_EXPL, 1.5, "isl.values")
st("s06", "q2", "q2-e2", "mcq", "الإحسان: على أيّ أساس يحبّ الله أن تنطلق العلاقات بين الناس؟",
   {"options": ["على أساس حبّ الخير وروح العطاء", "على أساس المصلحة والمنفعة المتبادلة", "على أساس القوّة والغلبة", "على أساس النسب والقرابة وحدهما"]},
   {"correct": 0}, IHSAN_EXPL, 0.75, "isl.values")
st("s07", "q2", "q2-e2", "fill_blank", "أكمل بيان أهمية الإحسان من الناحية الإنسانية:",
   {"text": "للإحسان أهمية كبرى من الناحية الإنسانية، فهو الأسلوب ____ في تقديم الخير للآخرين من موقع ____ الذي يمتلكونه في ذلك.",
    "bank": ["العمليّ", "الحقّ", "النظريّ", "الفضل"]},
   {"blanks": [["العمليّ"], ["الحقّ"]]}, IHSAN_EXPL, 0.75, "isl.values", "b")
st("s08", "q2", "q2-e2", "mcq", "التكافل الاجتماعي: إلى أيّ مدى يتدرّج التكافل في الإسلام؟",
   {"options": ["حتى يشمل الإنسانية جمعاء", "يقتصر على أفراد الأسرة الواحدة", "يقتصر على أهل الحيّ أو القرية", "يقتصر على الفقراء من الأقارب"]},
   {"correct": 0}, TAKAFUL_EXPL, 0.75, "isl.values", "c")
st("s09", "q2", "q2-e2", "ordering", "رتّب الدوائر التي يتدرّج فيها التكافل في الإسلام كما بدأ بها المسلم:",
   {"items": ["دائرة المسلم الذاتية", "دائرته الأسرية", "محيطه الاجتماعي", "الإنسانية جمعاء"]},
   {"order": [0, 1, 2, 3]}, TAKAFUL_EXPL, 0.75, "isl.values", "d")
st("s10", "q2", "q2-e2", "mcq", "العفو: إلامَ يرتقي العفو بصاحبه؟",
   {"options": ["إلى درجات السموّ الأخلاقي", "إلى الغنى والثراء", "إلى المناصب والجاه", "إلى الشهرة بين الناس"]},
   {"correct": 0}, AFW_EXPL, 0.75, "isl.values", "e")
st("s11", "q2", "q2-e2", "fill_blank", "أكمل بيان أهمية العفو من الناحية الإنسانية:",
   {"text": "العفو ينشر ____ بين الناس، ويرتقي بصاحبه إلى درجات السموّ الأخلاقي.", "bank": ["المودّة", "العداوة", "الخوف"]},
   {"blanks": [["المودّة"]]}, AFW_EXPL, 0.75, "isl.values", "f")
# ── 3. الفوائد ──
Q3_EXPL = ("استخراج ثلاث فوائد من الآية (الإجابة النّموذجيّة): الاعتدال في الإنفاق من صفات المحسنين – العفو من شيم المؤمنين – "
           "الإحسان ذروة العبادة.")
st("s12", "q3", "q3-e1", "multi", "أيّ ممّا يلي من الفوائد المستخرجة من الآية؟ (اختر ثلاثًا)",
   {"options": ["الاعتدال في الإنفاق من صفات المحسنين", "العفو من شيم المؤمنين", "الإحسان ذروة العبادة", "الإنفاق مقصور على أوقات الرخاء",
                "الانتقام من المسيء من صفات المحسنين", "كظم الغيظ ضعف في الشخصية"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 1.5, "isl.values")
st("s13", "q3", "q3-e1", "fill_blank", "أكمل الفوائد الثلاث المستخرجة من الآية:",
   {"text": "الاعتدال في ____ من صفات المحسنين. العفو من شيم ____. الإحسان ____ العبادة.",
    "bank": ["الإنفاق", "المؤمنين", "ذروة", "الإمساك", "المنافقين", "بداية"]},
   {"blanks": [["الإنفاق"], ["المؤمنين"], ["ذروة"]]}, Q3_EXPL, 1.5, "isl.values", "b")
# ── الجزء الثّاني: مفهوم العبادة وأثرها ──
IBADA_EXPL = ("مفهوم العبادة (الإجابة النّموذجيّة): اسم يطلق على كلّ ما يصدر عن المسلم من أقوال وأفعال وأحاسيس، استجابة لأمر الله "
              "تعالى وتطابقًا مع إرادته ومشيئته.")
st("s14", "q4", "q4-e1", "mcq", "ما الذي يشمله مفهوم العبادة؟",
   {"options": ["كلّ ما يصدر عن المسلم من أقوال وأفعال وأحاسيس", "الصلاة والصيام والحجّ دون غيرها من الأعمال",
                "الأفعال الظاهرة دون الأقوال والأحاسيس", "ما يؤدّيه المسلم في المسجد فقط"]},
   {"correct": 0}, IBADA_EXPL, 1, "isl.concept")
st("s15", "q4", "q4-e1", "fill_blank", "أكمل مفهوم العبادة:",
   {"text": "العبادة اسم يطلق على كلّ ما يصدر عن المسلم من أقوال وأفعال وأحاسيس، استجابةً لأمر ____ تعالى، وتطابقًا مع ____ ومشيئته.",
    "bank": ["الله", "إرادته", "الناس", "هواه"]},
   {"blanks": [["الله"], ["إرادته"]]}, IBADA_EXPL, 1, "isl.concept", "b")
ATHAR_EXPL = ("أثر العبادة في مكافحة الجريمة (الإجابة النّموذجيّة): تقوية الصّلة بالله، وتحقيق معنى العبوديّة له تعالى – اعتبار الكفّ عن "
              "الجريمة قربة من القربات – استقامة سلوك الفرد – الامتثال لأوامر الله ونواهيه.")
st("s16", "q4", "q4-e2", "multi", "من آثار العبادة في مكافحة الانحراف والجريمة (اختر أربعة):",
   {"options": ["تقوية الصلة بالله، وتحقيق معنى العبودية له تعالى", "اعتبار الكفّ عن الجريمة قربة من القربات", "استقامة سلوك الفرد",
                "الامتثال لأوامر الله ونواهيه", "اعتزال الفرد للمجتمع وانقطاعه عنه", "الاكتفاء بالعقوبات الرادعة دون تربية النفس",
                "التساهل مع المنحرفين وترك نصحهم"]},
   {"correct": [0, 1, 2, 3]}, ATHAR_EXPL, 2, "isl.concept")
st("s17", "q4", "q4-e2", "fill_blank", "أكمل آثار العبادة في مكافحة الجريمة:",
   {"text": "تقوية ____ بالله وتحقيق معنى العبودية له تعالى، واعتبار ____ عن الجريمة قربة من القربات، واستقامة ____ الفرد، "
            "والامتثال لأوامر الله و____.",
    "bank": ["الصلة", "الكفّ", "سلوك", "نواهيه", "القطيعة", "الإقدام", "ثروة"]},
   {"blanks": [["الصلة"], ["الكفّ"], ["سلوك"], ["نواهيه"]]}, ATHAR_EXPL, 2, "isl.concept", "b")

TITLE = "بكالوريا 2008 (دورة جوان، الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الأوّل (آل عمران 134 / مفهوم العبادة وأثرها)"
NOTES = ("موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2008، «جميع الشّعب»، المدّة ساعتان ونصف) "
         f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، ص1 = الموضوع الأوّل). الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان في ملفّ مستقلّ: "
         f"gdrive:{CORR_ID} ({CORR_TITLE}، ص1). "
         "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): الملفّان مسح ضوئيّ بلا طبقة نصّ (96 نقطة في البوصة)، قُرئا مصوّرين بتكبير؛ "
         "نصّ OCR من Drive استُعمل مساعدًا فقط. "
         "الآية مطبوعة بخطّ مصحف (رواية ورش: علامة همزة الوصل فوق الألف أو تحتها أو وسطها حسب حركة ما قبلها)؛ نُقلت بالرّسم العثمانيّ "
         "بالحرف ٱ لكلّ همزات الوصل (لا رمز يونيكود للوضعين السّفليّ والأوسط)، والسّكون ْ، والياء غير المنقوطة في «فِى»، والألف الخنجريّة في «وَٱلْكَٰظِمِينَ». "
         "لم تُنقل علامتان صغيرتان (تشبهان «صـ» صغيرة، يُرجَّح أنّهما علامتا وقف) فوق آخر «ٱلنَّاسِ» وآخر «ٱلْمُحْسِنِينَ» لتعذّر تمييزهما في الصّورة: يراجعهما صاحب المنصّة. "
         "التّوثيق كما طُبع «[ال عمران / 134]». "
         "فروق OCR/الصّورة: الآية في OCR بلا همزات وصل ولا ضبط كامل و«المسنين ه )» بدل «ٱلْمُحْسِنِينَ ١٣٤ ﴾»، وسقط القوس الأوّل من التّوثيق؛ "
         "«ذكر الله» في OCR وفي الصّورة «ذ كر الله» بفراغ ظاهر (نُقلت كما طُبعت)؛ «شرحا/ثلاثا/وبين/بين» في OCR وفي الصّورة «شرحًا/ثلاثًا/وبيّن/بيّن»؛ "
         "الشّرطة «ــ» قبل «اذكر» ساقطة في OCR؛ «(06) نقاط)» في OCR وفي الصّورة «(06 نقاط)». في «بيّن» الشّدّة مقروءة والحركة معها غير مميّزة فنُقلت الشّدّة وحدها. "
         "التّصحيح: OCR فصل العلامات عن أسطرها، والصّورة واضحة: س1 «2×1 / 1 / 2» = 05؛ س2 «3×0.5» + «3×01.5» = 06؛ س3 «3×01» = 03؛ "
         "الجزء الثّاني «2×1» + «4×01» = 06؛ المجموع 20. عنوان التّصحيح «بيان أهميتهما» (مثنّى) خطأ في المصدر. "
         "قرارات التّحويل: عنصر واحد لكلّ سطر علامة في عمود التّنقيط (سطر n×m عنصر واحد تقسم خطواته علامته)؛ «اشرح الآية شرحًا موجزا» "
         "تفاعليّ لأنّ التّصحيح يحدّد نقاط الشّرح ويعلّمها (خطوة لكلّ نقطة بلفظ التّصحيح)، ويمكن تحويله إلى essay_builder إن فضّل صاحب المنصّة؛ "
         "المشتّتات قيم/فوائد غائبة عن الآية أو مناقضة لها، لا قيمًا قابلة للنّقاش. لا عنصر مفتوحًا في هذا الموضوع: النّقاط المؤجَّلة 0.")
LOG_NOTE = ("تحويل من صورتي الموضوع والإجابة النّموذجيّة الرّسميّين (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة "
            "النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة؛ نسخ الآية بالرّسم العثمانيّ يحتاج مقابلة بالورقة.")

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
