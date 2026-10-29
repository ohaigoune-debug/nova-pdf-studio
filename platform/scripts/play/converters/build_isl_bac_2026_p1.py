"""Conversion: BAC 2026 (الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الأوّل
(النّحل 89–91 «وَنَزَّلْنَا عَلَيْك ٱلْكِتَٰبَ…» + وضعيّة: امرأة ورثت من زوجها فوقفت نصفه وبادلت الباقي بعملة أجنبيّة).
Pattern of the ISL pilot (build_isl_bac_2008_p1.py, CONVERSION_GUIDE.md Appendix A). Usage:
  python3 scripts/play/converters/build_isl_bac_2026_p1.py content/play-exams/sets/3AS/ISL/isl-bac-2026-p1.json
  python3 scripts/play/shuffle_exam_set.py content/play-exams/sets/3AS/ISL/isl-bac-2026-p1.json   (ONCE)

Sources (owner's Drive):
- Paper: gdrive 1UW8apgER15DEf9aJWSZQCVbDVRHxbzMt («2026 - العلوم الإسلامية - جميع الشعب - الدورة العادية - الموضوع.pdf», 2 pages:
  p1 = الموضوع الأوّل, p2 = الموضوع الثّاني).
- Official model answer + mark scheme: gdrive 1txkvht7dulcviXGBOzfVOsdbDszOlvYj («… - الحل.pdf», 4 pages: p1–2 = الموضوع الأوّل).
- Combined copy gdrive 16MnlnMgACkCIEsciS6TFTTkV43r8874S («BAC-2026-عادية-الموضوع-والتصحيح.pdf») opened only to confirm it is the
  same paper and correction (see NOTES); not used as a source.
Both PDFs are Word exports WITH a text layer (pdffonts: Traditional/Simplified Arabic, Times New Roman, and two Mushaf glyph fonts
«P277»/«BSML» for the Quran). The Quran is set as one glyph per word (codes U+FB51…U+FBB1 in the text layer), so the verse has NO usable
text: it was TRANSCRIBED FROM THE PAGE IMAGE (pdftoppm -r 1200…2400 crops located with `pdftotext -bbox`). The ordinary text was taken
from the image and checked against `pdftotext -raw/-bbox` (its visual-order output reverses Arabic, splits lam-alif and puts every
diacritic and space glyph as a separate «ّ»/mark token, so it only decided dashes «-»/«–», spaces and tatweel). Marks: correction image.

Transcription decisions (owner to check once against the paper):
- Streams: header «الشعبة: جميع الشعب» ⇒ SCI, MATH, TM, GE, LIT, LANG.
- The verse is printed in a Warsh (رواية ورش) Mushaf font: «يَامُرُ» (no hamza), «وَٱلِاحْسَٰنِ»/«ٱلَايْمَٰنَ» (naql), imala dots under
  «وَبُشْرٜىٰ»، «ٱلْقُرْبٜىٰ»، «وَيَنْهٜىٰ». Encoding (pilot conventions + what this print shows): every hamzat al-wasl ⇒ ٱ (U+0671);
  sukun (drawn as the dotless head of khah) ⇒ ْ (U+0652); the small CIRCLE over a silent letter («وَأَوْفُوا۟»، «تَنقُضُوا۟»، «وَإِيتَآءِى۟»)
  ⇒ ۟ (U+06DF small high rounded zero); the big imala dot under a letter ⇒ ٜ (U+065C); final/returned dotless yā' ⇒ ى (U+0649);
  dagger alif ⇒ ٰ; staggered (mutatabi') tanween drawn by the font ⇒ ordinary tanween. Ayah rosettes print Western digits 89/90/91.
- NOT transcribed (flagged): the small waqf «ص» printed above «لِلْمُسْلِمِينَ»، «ٱلْقُرْبٜىٰ»، «وَٱلْبَغْىِ»، «تَذَّكَّرُونَ»، «عَٰهَدتُّمْ»، «كَفِيلًا»،
  «تَفْعَلُونَ» (Unicode U+08D5 is not rendered by the platform fonts). The final kaf of «عَلَيْك» shows only its top stroke and no
  separate fatha at 2400 dpi ⇒ written without vowel (owner to check).
- The verse quoted again in Q3 uses the same glyph codes (ﭯ…ﭴ) as the verse ⇒ the same transcription is reused.
- Justification tatweel of the Word text («تشــير»، «ميـراثها»…) is not transcribed; «جـ-» keeps its tatweel (typed label, present
  in the text layer). «لبناءعيادة» is printed without a space (no space glyph in the text layer) ⇒ kept.

Rubric reading (correction p1–2, one rubric element per mark line of the «مجزأة» column; n×m lines stay ONE element):
- Q1 01: 0.5 الوسيلة + 0.5 محلّ الشّاهد. Closed alternative in the correction («يمكن قبول وسيلة إثارة العقل والوجدان، محلّ الشّاهد
  ﴿يَعِظُكُمْ لَعَلَّكُمْ تَذَّكَّرُونَ﴾») ⇒ interactive; neither the alternative means nor its evidence is used as a distractor.
- Q2 03: one line «0.5x6» (2 values × value/classification/effect) ⇒ one element, six 0.5 steps for the two values the correction
  lists first (العدل، التكافل الاجتماعي); the third accepted value (الأمانة) is never a distractor; «يكتفى بذكر أثر واحد» ⇒ the effect
  mcq has ONE of the listed effects as right option and none of the others among the distractors.
- Q3 03.5: 0.5 الخاصّيّة + 01 تعريف الإسلام بمعناه الخاصّ (mcq 0.5 + fill_blank 0.5) + «0.5x4» العلاقة (one multi of 2: the engine's
  per-item partial grading reproduces 0.5 per relation; no fill_blank because the four words have no context of their own).
- Q4 02.5: five 0.5 lines (الجانب، كيف تحقّقه، القسم، محلّ الشّاهد، المرتبة). The correction also accepts «المقاصد الضّروريّة / ﴿وَيَنْهٜىٰ…﴾ /
  الأولى»: the section is asked as a matching of the correction's two evidences to their sections; the evidence and rank steps name
  «المقاصد التّحسينيّة» explicitly, and no accepted evidence is a distractor.
- Q5 02 «0.5x4» حكمان وفائدتان + «يقبل أيّ حكم أو فائدة صحيحة» ⇒ OPEN ⇒ deferred essay_builder (2 steps of 1: الحكمان / الفائدتان).
- Part 2 Q1 05: 01 الاسم (الوقف) + 01 التّعريف (mcq + fill_blank) + «0.5x4» المقارنة (one matching of the 4 table cells: share of pairs =
  0.5 each) + 0.5 السّبب + 0.5 طريق الميراث. Q2 01.5: 0.5 الحكم + 01 التّعليل (mcq + fill_blank). Q3 01.5: 01 التّصحيح (mcq + fill_blank)
  + 0.5 التّسمية.
- Deferred points: 2 (Q5).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "isl-bac-2026-p1"
YEAR = 2026
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE", "LIT", "LANG"]
PAPER_ID = "1UW8apgER15DEf9aJWSZQCVbDVRHxbzMt"
PAPER_TITLE = "2026 - العلوم الإسلامية - جميع الشعب - الدورة العادية - الموضوع.pdf"
CORR_ID = "1txkvht7dulcviXGBOzfVOsdbDszOlvYj"
CORR_TITLE = "2026 - العلوم الإسلامية - جميع الشعب - الدورة العادية - الحل.pdf"
COMBINED_ID = "16MnlnMgACkCIEsciS6TFTTkV43r8874S"

# ── النّصوص الحرفيّة (منسوخة من صورة الورقة الرّسميّة، ص1) ──
INTRO = "قَالَ تَعَالَىٰ:"
VERSE = ("﴿ وَنَزَّلْنَا عَلَيْك ٱلْكِتَٰبَ تِبْيَٰنًا لِّكُلِّ شَىْءٍ وَهُدًى وَرَحْمَةً وَبُشْرٜىٰ لِلْمُسْلِمِينَ 89 "
         "إِنَّ ٱللَّهَ يَامُرُ بِٱلْعَدْلِ وَٱلِاحْسَٰنِ وَإِيتَآءِى۟ ذِى ٱلْقُرْبٜىٰ وَيَنْهٜىٰ عَنِ ٱلْفَحْشَآءِ وَٱلْمُنكَرِ وَٱلْبَغْىِ "
         "يَعِظُكُمْ لَعَلَّكُمْ تَذَّكَّرُونَ 90 وَأَوْفُوا۟ بِعَهْدِ ٱللَّهِ إِذَا عَٰهَدتُّمْ وَلَا تَنقُضُوا۟ ٱلَايْمَٰنَ بَعْدَ تَوْكِيدِهَا "
         "وَقَدْ جَعَلْتُمُ ٱللَّهَ عَلَيْكُمْ كَفِيلًا إِنَّ ٱللَّهَ يَعْلَمُ مَا تَفْعَلُونَ 91 ﴾")
REF = "[سورة النّحل]"
P1 = "الجزء الأوّل: (12 نقطة)"
P2 = "الجزء الثّاني: (08 نقاط)"
SEG_TIBYAN = "وَنَزَّلْنَا عَلَيْك ٱلْكِتَٰبَ تِبْيَٰنًا لِّكُلِّ شَىْءٍ"
SEG_HUDA = "وَهُدًى وَرَحْمَةً وَبُشْرٜىٰ لِلْمُسْلِمِينَ"
SEG_ADL = "إِنَّ ٱللَّهَ يَامُرُ بِٱلْعَدْلِ"
SEG_ADL_FULL = "إِنَّ ٱللَّهَ يَامُرُ بِٱلْعَدْلِ وَٱلِاحْسَٰنِ وَإِيتَآءِى۟ ذِى ٱلْقُرْبٜىٰ"
SEG_QURBA = "وَإِيتَآءِى۟ ذِى ٱلْقُرْبٜىٰ"
SEG_NAHY = "وَيَنْهٜىٰ عَنِ ٱلْفَحْشَآءِ وَٱلْمُنكَرِ وَٱلْبَغْىِ"
SEG_WAZ = "يَعِظُكُمْ لَعَلَّكُمْ تَذَّكَّرُونَ"
SEG_AHD = "وَأَوْفُوا۟ بِعَهْدِ ٱللَّهِ إِذَا عَٰهَدتُّمْ"
SEG_KAFIL = "وَقَدْ جَعَلْتُمُ ٱللَّهَ عَلَيْكُمْ كَفِيلًا"
SEG_ILM = "إِنَّ ٱللَّهَ يَعْلَمُ مَا تَفْعَلُونَ"
for _seg in (SEG_TIBYAN, SEG_HUDA, SEG_ADL, SEG_ADL_FULL, SEG_QURBA, SEG_NAHY, SEG_WAZ, SEG_AHD, SEG_KAFIL, SEG_ILM):
    assert _seg in VERSE, _seg
V = lambda s: f"﴿ {s} ﴾"  # آية في خيار أو شرح: بين القوسين المزخرفين كما في الورقة

QT = {
    1: "أشارت الآيات إلى وسيلةٍ من وسائل تثبيت العقيدة الإسلاميّة، استخرجها مع تحديد مَحلّ الشّاهد.",
    2: "تضمّنت الآيات قيمتين من القيم القرآنيّة التي درستَ، استخلصهما ثمّ صنّفهما مع ذكر أثرٍ لكلّ واحدة منهما.",
    3: (f"في قوله تعالى: {V(SEG_TIBYAN)} إشارة إلى خاصيّة من خصائص الرّسالة الخاتمة:\n"
        "أ-استنبطها، ثمّ عرّف الإسلام بمعناه الخاصّ.\n"
        "ب-اذكر علاقة الرّسالة الخاتمة بما سبقها من الرّسالات السّماويّة."),
    4: ("تشير الآياتُ إلى جانبٍ من جوانب منهج الإسلام في محاربة الانحراف والجريمة، وإلى قِسمٍ من أقسام مقاصد الشّريعة الإسلاميّة:\n"
        "أ- اذكر هذا الجانب، مبيّنا كيفيّة تحقيقه من خلال ما جاء في هذه الآيات.\n"
        "ب- استخرج هذا القسم من المقاصد مُبرزا محلّ الشّاهد عليه، ثمّ بيّن مرتبته."),
    5: "استخرج من الآيات حُكمَين وفائدتين.",
    6: ("يُعتبر التبرّعُ الذي قامت به المرأة عملا صالحا حثّ عليه الشّرع:\n"
        "أ- سَمِّ هذا النوع من التبرّع، ثمّ عرّفه اصطلاحا.\n"
        "ب- قارن بينه وبين الميراثِ من حيث: - زمنُ التنفيذ - جهةُ الاستحقاق.\n"
        "جـ- حدِّد السّبب الذي استحقّت به المرأة هذا الميراث، ثمّ بيّن طريق ميراثها."),
    7: "بيّن حكم المبادلة التي قامت بها المرأة مع التّعليل.",
    8: "لو طلبت منك المرأة تصحيح هذه المبادلة، بِم تنصحها؟ وماذا نسمّيها عندئذ؟",
}
SANAD = ("ورِثت امرأةٌ من زوجِها مبلغا بالعملة المحلّيّة، فتبرّعت بنِصفه لبناءعيادة طبّيّة للأطفال، وبادلت ما بقي منه "
         "بعملة أجنبيّة على أن يتمّ التّسليم بعد أسبوع.")
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "التقديم", "text": INTRO},
    {"id": "d-verse", "kind": "text", "caption": "الآيات الكريمة", "text": VERSE},
    {"id": "d-ref", "kind": "text", "caption": "التوثيق", "text": REF},
]
DOCS2 = [{"id": "d-sanad", "kind": "text", "caption": "السند", "text": SANAD}]


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


def deferred(sid, qid, eid, prompt, spec, answer_spec, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": "essay_builder", "prompt": prompt,
              "payload": {"type": "essay_builder", "spec": spec}, "answer": {"type": "essay_builder", "spec": answer_spec},
              "explanation": expl, "points": pts, "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False,
              "review_status": "needs_engine_support"})


# إجابات يقبلها التّصحيح ولا يجوز أن تظهر مشتّتًا (step id → صيغ)
ACCEPTED = {}

q("q1", "1", P1, QT[1], 1, [el("q1-e1", "الوسيلة المشار إليها", 0.5), el("q1-e2", "تحديد محلّ الشّاهد", 0.5)])
q("q2", "2", P1, QT[2], 3, [el("q2-e1", "القيمتان وتصنيفهما وأثر لكلّ منهما (0.5×6)", 3)])
q("q3", "3", P1, QT[3], 3.5, [el("q3-e1", "أ- الخاصّيّة المشار إليها", 0.5), el("q3-e2", "تعريف الإسلام بمعناه الخاصّ", 1),
                             el("q3-e3", "ب- علاقة الرّسالة الخاتمة بما سبقها (0.5×4)", 2)])
q("q4", "4", P1, QT[4], 2.5, [el("q4-e1", "أ- الجانب المشار إليه", 0.5), el("q4-e2", "بيان كيف تحقّقه الآيات", 0.5),
                             el("q4-e3", "ب- قسم المقاصد", 0.5), el("q4-e4", "محلّ الشّاهد عليه", 0.5), el("q4-e5", "مرتبته", 0.5)])
q("q5", "5", P1, QT[5], 2, [el("q5-e1", "حكمان وفائدتان (0.5×4)", 2)])
q("q6", "1", P2, QT[6], 5, [el("q6-e1", "أ- تسمية التبرّع", 1), el("q6-e2", "تعريفه اصطلاحا", 1),
                            el("q6-e3", "ب- المقارنة بينه وبين الميراث (0.5×4)", 2), el("q6-e4", "جـ- سبب استحقاق الميراث", 0.5),
                            el("q6-e5", "بيان طريق ميراثها", 0.5)], docs=DOCS2)
q("q7", "2", P2, QT[7], 1.5, [el("q7-e1", "حكم المبادلة", 0.5), el("q7-e2", "التّعليل", 1)], docs=DOCS2)
q("q8", "3", P2, QT[8], 1.5, [el("q8-e1", "تصحيح المعاملة", 1), el("q8-e2", "تسميتها عندئذ", 0.5)], docs=DOCS2)

# ── 1. وسيلة تثبيت العقيدة ──
Q1_EXPL = (f"الإجابة النّموذجيّة: الوسيلة المشار إليها في الآيات هي التّذكير بمراقبة الله تعالى لخلقه، ومحلّ الشّاهد قوله تعالى: {V(SEG_ILM)}. "
           f"ملاحظة التّصحيح: يمكن قبول وسيلة (إثارة العقل والوجدان)، ومحلّ الشّاهد قوله تعالى: {V(SEG_WAZ)}.")
st("s01", "q1", "q1-e1", "mcq", "إلى أيّ وسيلة من وسائل تثبيت العقيدة الإسلاميّة تشير الآيات؟",
   {"options": ["التّذكير بمراقبة الله تعالى لخلقه", "ضرب الأمثال للنّاس", "سرد قصص الأنبياء مع أقوامهم", "التّذكير بنعم الله في الأنعام والزّروع"]},
   {"correct": 0}, Q1_EXPL, 0.5, "isl.concept")
ACCEPTED["s01"] = ["إثارة العقل والوجدان"]
st("s02", "q1", "q1-e2", "mcq", "ما محلّ الشّاهد في الآيات على وسيلة التّذكير بمراقبة الله تعالى لخلقه؟",
   {"options": [V(SEG_ILM), V(SEG_AHD), V(SEG_ADL), V(SEG_HUDA)]},
   {"correct": 0}, Q1_EXPL, 0.5, "isl.evidence")
ACCEPTED["s02"] = [V(SEG_WAZ), V(SEG_KAFIL)]  # البديل المقبول، وشاهد قابل للنّقاش: لا يُعرضان مشتّتَين

# ── 2. القيمتان: التّصنيف والأثر ──
Q2_EXPL = ("الإجابة النّموذجيّة (جدول): العدل – سياسيّة – من آثارها: حفظ حقوق النّاس، القضاء على الفوارق الاجتماعيّة، أمن واستقرار الدّولة ونهضتها. "
           "التّكافل الاجتماعيّ – اجتماعيّة – من آثارها: نشر المحبّة بين الأفراد وتقوية العلاقات بينهم، مواساة الفقراء والمساكين وسدّ حاجتهم، "
           "المساهمة في الحدّ من الانحرافات الاجتماعيّة. الأمانة – فرديّة – من آثارها: تولّد الثّقة بين أفراد المجتمع، الشّعور بالمسؤوليّة، "
           "انتشار الأخلاق الحسنة. (ملاحظة: يُكتفى بذكر أثر واحد صحيح.)")
CLASSES = ["سياسيّة", "اجتماعيّة", "فرديّة"]
st("s03", "q2", "q2-e1", "mcq", f"ما القيمة القرآنيّة التي يتضمّنها قوله تعالى: «{SEG_ADL}»؟",
   {"options": ["العدل", "الصّبر", "الحياء", "طلب العلم"]}, {"correct": 0}, Q2_EXPL, 0.5, "isl.values")
st("s04", "q2", "q2-e1", "mcq", "ما تصنيف قيمة العدل؟", {"options": CLASSES}, {"correct": 0}, Q2_EXPL, 0.5, "isl.values", "b")
st("s05", "q2", "q2-e1", "mcq", "ما الأثر الذي تحقّقه قيمة العدل ممّا يلي؟",
   {"options": ["حفظ حقوق النّاس", "اتّساع الفوارق بين الأغنياء والفقراء", "انتشار الفوضى في الدّولة", "ضعف الثّقة في مؤسّسات الدّولة"]},
   {"correct": 0}, Q2_EXPL, 0.5, "isl.values", "c")
ACCEPTED["s05"] = ["القضاء على الفوارق الاجتماعيّة", "أمن واستقرار الدّولة ونهضتها"]
st("s06", "q2", "q2-e1", "mcq", f"ما القيمة القرآنيّة التي يتضمّنها قوله تعالى: «{SEG_QURBA}»؟",
   {"options": ["التّكافل الاجتماعيّ", "الشّجاعة", "الحياء", "طلب العلم"]}, {"correct": 0}, Q2_EXPL, 0.5, "isl.values", "d")
ACCEPTED["s06"] = ["الأمانة", "العدل"]
st("s07", "q2", "q2-e1", "mcq", "ما تصنيف قيمة التّكافل الاجتماعيّ؟", {"options": ["اجتماعيّة", "سياسيّة", "فرديّة"]}, {"correct": 0},
   Q2_EXPL, 0.5, "isl.values", "e")
st("s08", "q2", "q2-e1", "mcq", "ما الأثر الذي تحقّقه قيمة التّكافل الاجتماعيّ ممّا يلي؟",
   {"options": ["مواساة الفقراء والمساكين وسدّ حاجتهم", "انتشار الأنانية بين أفراد المجتمع", "اتّساع الهوّة بين الأغنياء والفقراء",
                "تفكّك العلاقات بين الأفراد"]},
   {"correct": 0}, Q2_EXPL, 0.5, "isl.values", "f")
ACCEPTED["s08"] = ["نشر المحبّة بين الأفراد وتقوية العلاقات بينهم", "المساهمة في الحدّ من الانحرافات الاجتماعيّة"]

# ── 3. خاصّيّة الرّسالة الخاتمة ──
KHASSIYA_EXPL = "الإجابة النّموذجيّة: الخاصّيّة المشار إليها في الآية هي: جامعة لثمرات ومحاسن الرّسالات السّابقة."
st("s09", "q3", "q3-e1", "mcq", f"إلى أيّ خاصّيّة من خصائص الرّسالة الخاتمة يشير قوله تعالى: «{SEG_TIBYAN}»؟",
   {"options": ["جامعة لثمرات ومحاسن الرّسالات السّابقة", "خاصّة بقوم دون غيرهم", "مؤقّتة بزمن محدود", "مقصورة على العبادات دون المعاملات"]},
   {"correct": 0}, KHASSIYA_EXPL, 0.5, "isl.concept")
ISLAM_KHAS = ("هو الرّسالة التي اكتمل بها الدّين والشّريعة الخاتمة إلى البشر، التي بعث بها محمّد صلّى الله عليه وسلّم إلى النّاس جميعا، "
              "في كلّ زمان ومكان")
ISLAM_EXPL = f"تعريف الإسلام بمعناه الخاصّ (الإجابة النّموذجيّة): {ISLAM_KHAS}."
st("s10", "q3", "q3-e2", "mcq", "ما تعريف الإسلام بمعناه الخاصّ؟",
   {"options": [ISLAM_KHAS, "هو الدّين الذي جاء به جميع الأنبياء من لدن آدم عليه السّلام", "هو رسالة خاصّة بالعرب في زمن البعثة دون غيرهم",
                "هو مجموع العبادات التي يؤدّيها المسلم دون المعاملات"]},
   {"correct": 0}, ISLAM_EXPL, 0.5, "isl.concept")
st("s11", "q3", "q3-e2", "fill_blank", "أكمل تعريف الإسلام بمعناه الخاصّ:",
   {"text": ("هو الرّسالة التي اكتمل بها الدّين والشّريعة ____ إلى البشر، التي بعث بها محمّد صلّى الله عليه وسلّم إلى النّاس ____، "
             "في كلّ زمان ومكان."), "bank": ["الخاتمة", "جميعا", "الأولى", "العرب"]},
   {"blanks": [["الخاتمة"], ["جميعا", "جميعًا"]]}, ISLAM_EXPL, 0.5, "isl.concept", "b")
ALAQA_EXPL = "علاقة الرّسالة الخاتمة بما سبقها من الرّسالات السّماويّة (الإجابة النّموذجيّة): ناسخة – مصدّقة – مصحّحة – مبشّرة."
st("s12", "q3", "q3-e3", "multi", "ما علاقة الرّسالة الخاتمة بما سبقها من الرّسالات السّماويّة؟ (اختر أربعًا)",
   {"options": ["ناسخة", "مصدّقة", "مصحّحة", "مبشّرة", "مناقضة لأصولها", "منفصلة عنها لا صلة بينهما", "مكرّرة لها دون زيادة"]},
   {"correct": [0, 1, 2, 3]}, ALAQA_EXPL, 2, "isl.concept")

# ── 4. منهج الإسلام في محاربة الانحراف، ومقاصد الشّريعة ──
Q4_EXPL = ("الإجابة النّموذجيّة: الجانب المشار إليه: الجانب (المنهج) الوقائيّ للحدّ من الانحراف والجريمة؛ وتحقّقه الآيات من خلال الحثّ على "
           "مكارم الأخلاق ومحاسن العادات.")
st("s13", "q4", "q4-e1", "mcq", "ما الجانب من منهج الإسلام في محاربة الانحراف والجريمة الذي تشير إليه الآيات؟",
   {"options": ["الجانب (المنهج) الوقائيّ", "الجانب العلاجيّ بإقامة الحدود والعقوبات", "التّساهل مع المنحرفين وترك نصحهم"]},
   {"correct": 0}, Q4_EXPL, 0.5, "isl.concept")
st("s14", "q4", "q4-e2", "mcq", "كيف تحقّق الآيات هذا الجانب الوقائيّ؟",
   {"options": ["من خلال الحثّ على مكارم الأخلاق ومحاسن العادات", "من خلال تقرير العقوبات البدنيّة على الجناة",
                "من خلال اعتزال المجتمع والانقطاع عنه", "من خلال الاكتفاء بالرّقابة الأمنيّة"]},
   {"correct": 0}, Q4_EXPL, 0.5, "isl.values")
MAQ_EXPL = (f"الإجابة النّموذجيّة: قسم المقاصد: المقاصد التّحسينيّة؛ محلّ الشّاهد عليه: {V(SEG_ADL_FULL)} {V(SEG_AHD)}؛ مرتبته: الثّالثة ضمن "
            f"أقسام المقاصد. ملاحظة التّصحيح: يُقبل قسم المقاصد الضّروريّة، محلّ الشّاهد عليه: {V(SEG_NAHY)}، مرتبته: الأولى ضمن أقسام المقاصد "
            "(يُكتفى بشاهد واحد).")
st("s15", "q4", "q4-e4", "mcq", "ما محلّ الشّاهد في الآيات على المقاصد التّحسينيّة؟",
   {"options": [V(SEG_ADL_FULL), V(SEG_ILM), V(SEG_TIBYAN), V(SEG_WAZ)]},
   {"correct": 0}, MAQ_EXPL, 0.5, "isl.evidence")
ACCEPTED["s15"] = [V(SEG_AHD), V(SEG_NAHY)]
st("s16", "q4", "q4-e3", "matching", "طابق بين كلّ شاهد من الآيات وقسم المقاصد الذي يدلّ عليه (حسب الإجابة النّموذجيّة):",
   {"lefts": [f"«{SEG_AHD}»", f"«{SEG_NAHY}»"], "rights": ["المقاصد التّحسينيّة", "المقاصد الضّروريّة", "المقاصد الحاجيّة"]},
   {"pairs": [0, 1]}, MAQ_EXPL, 0.5, "isl.concept")
st("s17", "q4", "q4-e5", "mcq", "ما مرتبة المقاصد التّحسينيّة ضمن أقسام المقاصد؟", {"options": ["الثّالثة", "الأولى", "الثّانية"]},
   {"correct": 0}, MAQ_EXPL, 0.5, "isl.concept")

# ── 5. حكمان وفائدتان: مفتوح (يقبل أيّ حكم أو فائدة صحيحة) ──
HUKM_MODEL = "وجوب العدل بين النّاس – تحريم الفواحش والمنكر – وجوب الوفاء بالعهد – تحريم نقض العهود والأيمان"
FAIDA_MODEL = ("القرآن كتاب هداية ورحمة – إحاطة الله بأفعال العباد – اهتمام القرآن بالتّكافل الاجتماعيّ – أهمّيّة الأخلاق في القرآن الكريم")
Q5_NOTE = "ملاحظة التّصحيح: يُقبل أيّ حكم أو فائدة صحيحة (0.5 لكلّ عنصر)."
deferred("s18", "q5", "q5-e1", "استخرج من الآيات حكمين (0.5 لكلّ حكم).",
         {"task": QT[5], "criterion": "حكمان مستخرجان من الآيات (2×0.5)", "model_examples": HUKM_MODEL, "accepts": Q5_NOTE},
         {"rubric": "0.5 لكلّ حكم صحيح", "points": 1, "model_ref": CORR_TITLE}, f"أمثلة الإجابة النّموذجيّة: {HUKM_MODEL}. {Q5_NOTE}",
         1, "isl.ruling")
deferred("s19", "q5", "q5-e1", "استخرج من الآيات فائدتين (0.5 لكلّ فائدة).",
         {"task": QT[5], "criterion": "فائدتان مستخرجتان من الآيات (2×0.5)", "model_examples": FAIDA_MODEL, "accepts": Q5_NOTE},
         {"rubric": "0.5 لكلّ فائدة صحيحة", "points": 1, "model_ref": CORR_TITLE}, f"أمثلة الإجابة النّموذجيّة: {FAIDA_MODEL}. {Q5_NOTE}",
         1, "isl.values", "b")

# ── الجزء الثّاني — 1. الوقف والميراث ──
WAQF_EXPL = "الإجابة النّموذجيّة: يسمّى هذا التبرّع: الوقف. تعريفه اصطلاحا: هو حبس الأصل وتسبيل منفعته."
st("s20", "q6", "q6-e1", "mcq", "تبرّعت المرأة بنصف المبلغ لبناء عيادة طبّيّة للأطفال: ما اسم هذا النّوع من التبرّع؟",
   {"options": ["الوقف", "الوصيّة", "الهبة", "القرض"]}, {"correct": 0}, WAQF_EXPL, 1, "isl.concept")
st("s21", "q6", "q6-e2", "mcq", "ما تعريف الوقف اصطلاحا؟",
   {"options": ["حبس الأصل وتسبيل منفعته", "تمليك مال لشخص معيّن بلا عوض في حال الحياة", "تمليك مضاف إلى ما بعد الموت",
                "دفع مال لمن ينتفع به ثمّ يردّ بدله"]},
   {"correct": 0}, WAQF_EXPL, 0.5, "isl.concept")
st("s22", "q6", "q6-e2", "fill_blank", "أكمل تعريف الوقف اصطلاحا:",
   {"text": "هو ____ الأصل و____ منفعته.", "bank": ["حبس", "تسبيل", "بيع", "تعطيل"]},
   {"blanks": [["حبس"], ["تسبيل"]]}, WAQF_EXPL, 0.5, "isl.concept", "b")
MUQARANA_EXPL = ("المقارنة بين الوقف والميراث (الإجابة النّموذجيّة): زمن التّنفيذ: الوقف قبل الوفاة، والميراث بعد الوفاة. جهة الاستحقاق: "
                 "الوقف غير محدّدة إلّا إذا عيّنها الواقف، والميراث محدّدة بالورثة فقط.")
st("s23", "q6", "q6-e3", "matching", "قارن بين الوقف والميراث: طابق كلّ خانة من جدول المقارنة مع ما يناسبها.",
   {"lefts": ["زمن تنفيذ الوقف", "زمن تنفيذ الميراث", "جهة الاستحقاق في الوقف", "جهة الاستحقاق في الميراث"],
    "rights": ["قبل الوفاة", "بعد الوفاة", "غير محدّدة إلّا إذا عيّنها الواقف", "محدّدة بالورثة فقط"]},
   {"pairs": [0, 1, 2, 3]}, MUQARANA_EXPL, 2, "isl.ruling")
SABAB_EXPL = "الإجابة النّموذجيّة: السّبب الذي استحقّت به المرأة هذا الميراث: الزّواج. طريق ميراثها: بالفرض، وهو النّصيب المقدّر شرعا للوارث."
st("s24", "q6", "q6-e4", "mcq", "ما السّبب الذي استحقّت به المرأة هذا الميراث؟", {"options": ["الزّواج", "النّسب", "الولاء"]},
   {"correct": 0}, SABAB_EXPL, 0.5, "isl.ruling")
st("s25", "q6", "q6-e5", "mcq", "ما طريق ميراث المرأة من زوجها؟",
   {"options": ["بالفرض، وهو النّصيب المقدّر شرعا للوارث", "بالتّعصيب، وهو أخذ ما بقي بعد أصحاب الفروض", "بالوصيّة من زوجها قبل وفاته"]},
   {"correct": 0}, SABAB_EXPL, 0.5, "isl.ruling")

# ── 2. حكم المبادلة ──
MUBADALA_EXPL = ("الإجابة النّموذجيّة: حكم المبادلة الماليّة الواردة في السّند: حرام (غير جائزة). التّعليل: تعتبر مبادلة ربويّة لانتفاء شرط "
                 "التّقابض في مجلس العقد.")
st("s26", "q7", "q7-e1", "mcq", "بادلت المرأة ما بقي من المبلغ بعملة أجنبيّة على أن يتمّ التّسليم بعد أسبوع: ما حكم هذه المبادلة؟",
   {"options": ["حرام (غير جائزة)", "جائزة", "مكروهة فقط"]}, {"correct": 0}, MUBADALA_EXPL, 0.5, "isl.ruling")
st("s27", "q7", "q7-e2", "mcq", "ما تعليل حكم هذه المبادلة؟",
   {"options": ["تعتبر مبادلة ربويّة لانتفاء شرط التّقابض في مجلس العقد", "لأنّ بيع العملات محرّم في كلّ الأحوال",
                "لأنّ الثّمن مجهول عند العقد", "لأنّ المرأة لا يحقّ لها التصرّف في الميراث"]},
   {"correct": 0}, MUBADALA_EXPL, 0.5, "isl.ruling")
st("s28", "q7", "q7-e2", "fill_blank", "أكمل تعليل حكم المبادلة:",
   {"text": "تعتبر مبادلة ____ لانتفاء شرط ____ في مجلس العقد.", "bank": ["ربويّة", "التّقابض", "مشروعة", "الإشهاد"]},
   {"blanks": [["ربويّة"], ["التّقابض"]]}, MUBADALA_EXPL, 0.5, "isl.ruling", "b")

# ── 3. تصحيح المبادلة ──
TASHIH_EXPL = "الإجابة النّموذجيّة: تصحيح المعاملة: الحرص على تحقّق شرط التّقابض في مجلس العقد. عندئذ تسمّى بيع الصّرف."
st("s29", "q8", "q8-e1", "mcq", "بمَ تنصح المرأة لتصحيح هذه المبادلة؟",
   {"options": ["الحرص على تحقّق شرط التّقابض في مجلس العقد", "تأجيل التّسليم إلى شهر بدل أسبوع", "زيادة المبلغ المدفوع بالعملة المحلّيّة",
                "كتابة عقد المبادلة دون تسليم في المجلس"]},
   {"correct": 0}, TASHIH_EXPL, 0.5, "isl.ruling")
st("s30", "q8", "q8-e1", "fill_blank", "أكمل النّصيحة لتصحيح المبادلة:",
   {"text": "الحرص على تحقّق شرط ____ في ____ العقد.", "bank": ["التّقابض", "مجلس", "التّأجيل", "نهاية"]},
   {"blanks": [["التّقابض"], ["مجلس"]]}, TASHIH_EXPL, 0.5, "isl.ruling", "b")
st("s31", "q8", "q8-e2", "mcq", "ماذا تسمّى هذه المبادلة بعد تصحيحها؟", {"options": ["بيع الصّرف", "بيع المرابحة", "بيع السّلم", "بيع التّقسيط"]},
   {"correct": 0}, TASHIH_EXPL, 0.5, "isl.concept")

TITLE = ("بكالوريا 2026 (الدّورة العاديّة) – العلوم الإسلاميّة – جميع الشّعب – الموضوع الأوّل "
         "(سورة النّحل 89–91 / الوقف والميراث وبيع الصّرف)")
NOTES = ("موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، الدّورة 2026، «الشعبة: جميع الشعب»، المدّة 02 سا و30 د) "
         f"في Drive صاحب المنصّة: gdrive:{PAPER_ID} ({PAPER_TITLE}، ص1 = الموضوع الأوّل). الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّان في ملفّ مستقلّ: "
         f"gdrive:{CORR_ID} ({CORR_TITLE}، ص1–2). النّسخة المجمّعة gdrive:{COMBINED_ID} (BAC-2026-عادية-الموضوع-والتصحيح.pdf) فُتحت للتّأكّد "
         "فقط: هي الموضوع والتّصحيح نفسهما، فلم تُحوَّل مرّة ثانية. "
         "نُسخ النص من صورة الورقة الرسمية (لا نسخة Word): للملفّين طبقة نصّ (تصدير Word) لكنّ الآيات مطبوعة بخطّ مصحف يرسم كلّ كلمة رسمًا واحدًا "
         "بلا نصّ قابل للاستخراج، فنُسخت من الصّورة مكبّرة (حتّى 2400 نقطة في البوصة)، ونُسخ باقي النّصّ من الصّورة وقوبل بطبقة النّصّ "
         "(pdftotext) في الشّرطات والمسافات والتّطويل. "
         "الآيات برواية ورش (يَامُرُ، وَٱلِاحْسَٰنِ، ٱلَايْمَٰنَ، نقطة الإمالة تحت وَبُشْرٜىٰ وٱلْقُرْبٜىٰ ووَيَنْهٜىٰ)؛ الاصطلاح: كلّ همزة وصل ٱ، والسّكون "
         "(المرسوم رأس خاء) ْ، والدّائرة فوق الحرف الزّائد ۟ (وَأَوْفُوا۟، تَنقُضُوا۟، وَإِيتَآءِى۟)، ونقطة الإمالة ٜ (U+065C)، والياء المردودة غير "
         "المنقوطة ى، والتّنوين المتتابع تنوينًا عاديًّا؛ أرقام الآيات مطبوعة 89 و90 و91. لم تُنقل علامات الوقف «ص» الصّغيرة فوق لِلْمُسْلِمِينَ "
         "وٱلْقُرْبٜىٰ ووَٱلْبَغْىِ وتَذَّكَّرُونَ وعَٰهَدتُّمْ وكَفِيلًا وتَفْعَلُونَ (لا يعرضها خطّ المنصّة)، والكاف الأخيرة في «عَلَيْك» بلا حركة ظاهرة "
         "في الصّورة فنُقلت بلا حركة: يراجعهما صاحب المنصّة. "
         "لم يُنقل تطويل ضبط الأسطر (تشــير، ميـراثها، قيمـتين…)، وأُبقي «جـ-» كما في طبقة النّصّ، و«لبناءعيادة» بلا مسافة كما طُبعت. "
         "التّصحيح (من الصّورة): س1 0.5+0.5 = 01؛ س2 0.5×6 = 03؛ س3 0.5+01+0.5×4 = 03.5؛ س4 5×0.5 = 02.5؛ س5 0.5×4 = 02؛ الجزء الثّاني: "
         "س1 01+01+0.5×4+0.5+0.5 = 05؛ س2 0.5+01 = 01.5؛ س3 01+0.5 = 01.5؛ المجموع 20. "
         "قرارات التّحويل: عنصر لكلّ سطر علامة؛ البدائل المغلقة التي يذكرها التّصحيح (إثارة العقل والوجدان، القيمة الثّالثة الأمانة، الآثار "
         "الأخرى، المقاصد الضّروريّة وشاهدها ومرتبتها) تبقى تفاعليّة ولا تُعرض مشتّتًا؛ س5 مفتوح («يقبل أيّ حكم أو فائدة صحيحة») فأُجّل "
         "essay_builder (2 نقطتان مؤجّلتان). علاقة الرّسالة الخاتمة multi واحد بنقطتين (0.5 لكلّ علاقة بالتّصحيح الجزئيّ)، والمقارنة بين "
         "الوقف والميراث matching واحد بأربع خانات (0.5 لكلّ خانة).")
LOG_NOTE = ("تحويل من صورتي الموضوع والإجابة النّموذجيّة الرّسميّين في Drive (طبقة النّصّ للتّدقيق فقط)؛ العلامات من سلّم التّنقيط؛ الإجابات "
            "الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة؛ نسخ الآيات برواية ورش يحتاج مقابلة بالورقة.")

# ── تدقيق محلّيّ قبل الكتابة (المهارات من src/server/play/exams/skills.ts؛ التّطبيع نسخة من normalizeArabic في src/server/lib/arabic.ts) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'((?:ar|hist|geo|isl|en|fr|math|phys|svt|tech)\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert {"isl.vocab", "isl.ruling", "isl.evidence", "isl.concept", "isl.values", "isl.writing"} <= SKILLS, "skills.ts not parsed"
DEFERRED = {"table_fill", "bar_chart", "variation_table", "function_plot", "map_locate", "essay_builder"}


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
        if t in DEFERRED:
            assert s["review_status"] == "needs_engine_support" and set(p) == {"type", "spec"} and set(a) == {"type", "spec"}, s["id"]
            continue
        if t == "mcq":
            assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, (s["id"], "mcq: 3–4 options, right one first before shuffling")
        if t in ("mcq", "multi"):
            assert len({_norm(o) for o in p["options"]}) == len(p["options"]), (s["id"], "duplicate options")
            wrong = [o for i, o in enumerate(p["options"]) if (i != a["correct"] if t == "mcq" else i not in a["correct"])]
            for acc in ACCEPTED.get(s["id"], []):  # صيغة يقبلها التّصحيح لا تكون مشتّتًا
                assert all(_norm(acc) != _norm(o) and _norm(acc) not in _norm(o) for o in wrong), (s["id"], "accepted form as distractor", acc)
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
        "kind": "BAC", "year": YEAR, "level": "3AS", "streams": STREAMS, "subject": "ISL", "term": None, "paper": PAPER,
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
deferred_pts = sum(s["points"] for s in S if s["type"] in DEFERRED)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points,",
      deferred_pts, "deferred")
