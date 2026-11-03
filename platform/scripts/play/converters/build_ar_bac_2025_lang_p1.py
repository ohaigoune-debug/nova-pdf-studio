"""Conversion: BAC 2025 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (علي محمود طه).
STATUS: BLOCKED — the official mark scheme of «ثانيًا- البناء اللّغويّ» (6 points) is not readable: page 2 of the correction
(02_التصحيح.pdf) is scanned cropped at the left border of the text cell, so BOTH mark columns (مجزّأة / مجموع) of Part 2 are
missing (native page image 1288 px wide vs 1452 px for page 1). Both Drive copies are byte-identical (sha256 2aea3478…); the
archive copy gdrive 1desN4HTygCewiiOyCaTVukOZVZGOAnlP (18.8 MB) exceeds the download limit and its OCR export shows no Part-2
marks either. Only the part total «(06ن)» is printed. No per-question mark is invented: Part 2 questions are kept verbatim with
no rubric elements and no steps; the model answers are stored in PART2_MODEL. To unblock: read the Part-2 marks on an uncropped
copy, fill MARKS_P2, rebuild, shuffle once.

Sources (owner's Drive, read-only; PDF-only — no Word copy):
- paper: gdrive 1j0vF8DGgbrOWz3w-JaG6CTSHXohEJrMe (01_الموضوع.pdf, pages 1–2; same folder as the correction); byte-identical copy
  gdrive 1q3lB-Gdo5iaxZ0IaNMs8U9MuKMVHwmy_.
- official model answer + mark scheme: gdrive 1KYiDekKXVLEdVzaqTLUAkX7pxcNk_OBL (02_التصحيح.pdf, pages 1–3); identical copy
  gdrive 1_6kziHdXPEl6kqc8w3jE8UEJq1qxPVbh. Pages 1 and 3 (Parts 1 and 3) are complete with marks.

Method: image-only scans; every string TRANSCRIBED BY HAND from the native page images (~260 ppi) enlarged ×2–×9; OCR used only to
locate text. The paper is a reader's copy with HANDWRITTEN glosses, underlines and arrows over the print; only print is copied.
Harakat are copied as far as the scan shows them (no final sukun/kasra on the rhyme letters: not visible); kashida stretches written «ـــ».

Blockers / uncertainties (owner to check on a clean copy):
- Verse 9, second hemistich: the word between «الكَرى» and «الجَفْنِ» is overwritten by a handwritten gloss; restored ONLY from the
  printed glossary of the same page («غطّة: نومة…», listed between الكرى (v9) and الضّنى (v11)); its harakat are hidden.
- Underlines: printed and handwritten underlines cannot be told apart on this grayscale scan. The words to parse come from the
  official correction: «الدّموع» (v7) and «الكرى» (v9); in brackets (printed): «(أذْبَلْتَ بالأسى قَلْبَكَ)» (v5), «(حُمِّلْتَ)» (v11).
- Official-scheme anomaly (Part 2 Q5, not converted): the correction writes the expression as «(يخلو الدّجى)» and the explanation
  «لفظة (يحلو)», while the paper prints «(يَحْنُو الدُّجَى)»; any future step must follow the paper.
- Part 1: Q1 01 (manifestations) + «4×0.25» (four expressions, interchangeable ⇒ one element 1). Q2 «4×0.5» and the correction
  lists exactly four reflections ⇒ four elements. Q3 0.5 المخرج + 0.5 «وهو مخرج سليم» + 01 التّعليل «قبول أيّ تعليل منطقيّ»:
  the question asks the candidate's view («أتراه…؟ علّل») ⇒ judgment and reasoning deferred (essay_builder, rule 11). Q4 01.
  Q5 «03×01» = المضمون / الحجم / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 3: 01 (meaning of Musset's saying) + 02 (causes: أ ذاتيّة / ب موضوعيّة) + «4×0.25» poets (one element 1).
- Deferred: 1.5 (Q3) + 3 (Q5) = 4.5 of the 14 converted points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2025-lang-p1"
PAPER_ID = "1j0vF8DGgbrOWz3w-JaG6CTSHXohEJrMe"
PAPER_COPY_ID = "1q3lB-Gdo5iaxZ0IaNMs8U9MuKMVHwmy_"
ARCHIVE_ID = "1desN4HTygCewiiOyCaTVukOZVZGOAnlP"
CORR_ID = "1KYiDekKXVLEdVzaqTLUAkX7pxcNk_OBL"
CORR_COPY_ID = "1_6kziHdXPEl6kqc8w3jE8UEJq1qxPVbh"

# ── علامات البناء اللّغويّ: غير مقروءة في التّصحيح (عمودا العلامات مقصوصان) — None = مجهولة، لا تُخترع ──
MARKS_P2 = None
BLOCKED = MARKS_P2 is None

intro = "قال الشّاعر \"علي محمود طه\":"
poem = [
    ["1-", "أيُّها الشّاعِرُ الكَئيبُ مَضَى اللّيـ", "ـلُ وَمَا زِلْتَ غارِقًا في شُجونِـــك"],
    ["2-", "مُسْلِمًا رَأْسَكَ الحَزينَ إلى الفِكْـــ", "ـرِ، ولِلسُّهْـــدِ ذابِـــلاتٌ جُفونُـــك"],
    ["3-", "وَيَدٌ تُمْسِـــكُ اليَـــراعَ وأُخْـــرى", "في ارْتِعـــاشٍ تَمُـــرُّ فَوْقَ جَبينِـــك"],
    ["4-", "وَفَمٌ ناضِـــبٌ بِهِ حَـــرُّ أنْفا", "سِكَ يَطْغَى على ضَعيفِ أنينِـــك"],
    ["5-", "أنتَ (أذْبَلْتَ بالأسى قَلْبَكَ) الغَضّ", "وحَطَّمْـــتَ مِن رَقيـــقِ كيانِـــك"],
    ["6-", "آهِ يا شاعِـــري، لقَدْ نَصَلَ اللّيْـ", "ـلُ وما زِلْتَ سائِرًا في مَكانِـــك"],
    ["7-", "ليْسَ يَحْنُو الدُّجَى عَلَيْكَ ولا يَـأْ", "سَى لِتِلْكَ الدُّمـــوعِ في أجْفانِـــك"],
    ["8-", "ما وراءَ السُّهـــادِ في لَيْلِـــكَ الدّا", "جي، وهَلّا فَرَغْـــتَ مِن أحْزانِـــك؟"],
    ["9-", "فقُـــمِ الآنَ مِن مَكانِـــكَ واغْنَـــمْ", "في الكَرى غطّة الجَفْنِ الطّـــروب"],
    ["10-", "والْتَمِسْ في الفِراشِ دِفْئًا يُنَسّيـ", "ـكَ نَهارَ الأسَى ولَيْلَ الخُطـــوب"],
    ["11-", "لَسْتَ تُجْـــزَى مِنَ الحَياةِ بِمَا (حُمِّـ", "ـلْتَ) فيها مِنَ الضَّنَـــى والشُّحـــوب"],
    ["12-", "إنّها للمُجونِ، والخَتْلِ، والزَّيْـ", "ـفِ، ولَيْسَتْ للشّاعِرِ المَوْهـــوب"],
]
ref = "[ديوان علي محمود طه، كلمات عربيّة للتّرجمة والنّشر، القاهرة، ط 2013، ص: 31، 32، بتصرّف]."
glossary = ("الرّصيد اللّغويّ: شجون: أحزان/ السُّهْد: الأرق، قلّة النّوم/ اليراع: القلم/ ناضب: جافّ/ نصل اللّيل: زال وانتهى. "
            "سائرا: تائها، متحيّرا/ الكرى: النّعاس، النّوم/ غطّة: نومة، غطّ: أحدث صوتا في تنفّسه أثناء النّوم. الضّنى: المرض/ الختل: الخديعة والمراوغة.")
crit_quote = ("قال الدكتور إيليا الحاوي: (...لأنّ التّألّم بصدقٍ فضيلةٌ إنسانيّةٌ، إذْ يَنِمُّ ذلك عن حياة الضّميرِ والكرامة في الإنسان، عن شهامتِه، "
              "عن احتفالِه بمصيرِ القِيَمِ والنّاسِ. وقد كان \"موسيه\" يقول: «لا شيْءَ يجعلُنا كبارًا كالألم»...)")
crit_ref = "[كتاب اللّغة العربيّة وآدابها للسّنة الثّالثة من التّعليم الثّانويّ لشعبتي آداب وفلسفة ولغات أجنبيّة، ص: 152، بتصرّف]."
crit_task = "المطلوب:"

TEXT_DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": intro},
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": poem},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": ref},
    {"id": "d-gloss", "kind": "text", "caption": "الرّصيد اللّغويّ", "text": glossary},
]
CRIT_DOCS = TEXT_DOCS + [
    {"id": "d-crit-quote", "kind": "text", "caption": "القول", "text": crit_quote},
    {"id": "d-crit-ref", "kind": "text", "caption": "توثيق القول", "text": crit_ref},
    {"id": "d-crit-task", "kind": "text", "caption": "المطلوب", "text": crit_task},
]


def el(i, label, pts):
    return {"id": i, "label": label, "max_points": pts, "verified": False}


Q = []
def q(qid, number, part, text, total, elements, docs=TEXT_DOCS):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


P1 = "أوّلًا- البناء الفكريّ: (10 نقاط)"
P2 = "ثانيًا- البناء اللّغويّ: (06 نقاط)"
P3 = "ثالثًا- التّقييم النّقديّ: (04 نقاط)"

q("q1", "1", P1, "طَغَتْ على النّصّ مسحةُ حزن عميق. ما مظاهرها؟ دُلّ عليها بعبارات من النّصّ.", 2,
  [el("q1-e1", "مظاهر الحزن", 1), el("q1-e2", "أربع عبارات دالّة (4×0.25)", 1)])
q("q2", "2", P1, "حدِّدْ انعكاسات ظاهرة الحزن والألم على نفسيّة الشّاعر في الوحدة الثّانية.", 2,
  [el("q2-e1", "الانعكاس الأوّل (ب5)", 0.5), el("q2-e2", "الانعكاس الثّاني (ب5)", 0.5), el("q2-e3", "الانعكاس الثّالث (ب6)", 0.5), el("q2-e4", "الانعكاس الرّابع (ب7–8)", 0.5)])
q("q3", "3", P1, "ما المَخْرَجُ الّذي اقترحه صاحب النّصّ على الشّاعر الحزين؟ أتراهُ مَخْرَجًا سليمًا؟ علّلْ.", 2,
  [el("q3-e1", "المخرج المقترح", 0.5), el("q3-e2", "الحكم على المخرج", 0.5), el("q3-e3", "التّعليل", 1)])
q("q4", "4", P1, "هل للشّاعر حظٌّ من الحياة؟ وضّحْ ذلك من النّصّ.", 1,
  [el("q4-e1", "حظّ الشّاعر من الحياة وتوضيحه", 1)])
q("q5", "5", P1, "لخّص مضمون النّصّ مراعيا التّقنية.", 3,
  [el("q5-e1", "التّلخيص: المضمون", 1), el("q5-e2", "التّلخيص: الحجم", 1), el("q5-e3", "التّلخيص: سلامة اللّغة", 1)])
# ثانيًا: الأسئلة حرفيًّا بلا عناصر ولا خطوات (علاماتها غير مقروءة في التّصحيح)
P2_QUESTIONS = [
    ("q6", "1", "ما الحقلُ المناسب للألفاظ الآتية: (ذابلات، الارتعاش، الأنين، الشّحوب)؟"),
    ("q7", "2", "حدّد الضّمير الغالب في النّصّ وبيّنْ عائده ودوره."),
    ("q8", "3", "أعربْ ما تحته خطٌّ إعراب مفردات وما بين قوسين إعراب جمل."),
    ("q9", "4", "بيّنْ نوع الأسلوب وغرضه البلاغيّ في البيتين التّاسع والثّاني عشر."),
    ("q10", "5", "في العبارة الآتية: (يَحْنُو الدُّجَى) صورة بيانيّة. سمِّها ثمّ اشرحها وبيّنْ سرّ بلاغتها."),
]
for qid, num, text in P2_QUESTIONS:
    q(qid, num, P2, text, 0, [])
PART2_MODEL = {  # من الإجابة النّموذجيّة (ص2) — بلا علامات
    "q6": "حقل الحزن والألم.",
    "q7": "الضّمير: المفرد المخاطَب (أنت، التّاء في الأفعال، كاف الخطاب) – العائد: الشّاعر الكئيب – دوره: ربط أجزاء الكلام بالإحالة القبليّة وتفادي التّكرار لتحقيق الاتّساق.",
    "q8": "الدّموع: بدل من اسم الإشارة مجرور وعلامة جرّه الكسرة الظّاهرة في آخره. الكرى: اسم مجرور بـ«في» وعلامة جرّه الكسرة المقدّرة على الألف المقصورة منع من ظهورها التّعذّر. "
          "(أذبلت بالأسى قلبك): جملة فعليّة في محلّ رفع خبر. (حُمّلت): جملة فعليّة صلة موصول لا محلّ لها من الإعراب.",
    "q9": "البيت التّاسع: إنشائيّ، صيغته الأمر (قم، اغنم) وغرضه النّصح والإرشاد. البيت الثّاني عشر: خبريّ، غرضه التّقرير.",
    "q10": "استعارة مكنيّة: شبّه الدّجى بالأمّ، لم يصرّح بالمشبّه به واكتفى بالإشارة إلى إحدى لوازمه (الحنوّ). سرّ بلاغتها: تشخيص المعنويّ في قالب محسوس لتقوية المعنى وتوكيده. "
           "(التّصحيح يكتب «يخلو الدّجى» و«يحلو» خلافًا للورقة «يحنو».)",
}
q("q11", "1", P3, "ما المقصودُ بقولِ\"موسيه\" «لا شيْءَ يجعلُنا كبارًا كالألم»؟", 1,
  [el("q11-e1", "المقصود بالقول", 1)], docs=CRIT_DOCS)
q("q12", "2", P3, "أبْرِزْ أهمّ الأسباب الّتي جعلت القصيدة العربيّة المُعاصرة تَصْطبِغُ بصبغةِ الحزنِ والألم.", 2,
  [el("q12-e1", "الأسباب الذّاتيّة والموضوعيّة", 2)], docs=CRIT_DOCS)
q("q13", "3", P3, "اُذكرْ أربعةً من أعلامها.", 1,
  [el("q13-e1", "أربعة أعلام (4×0.25)", 1)], docs=CRIT_DOCS)

S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def essay(sid, qid, eid, prompt, spec, rubric, expl, pts, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder", "prompt": prompt,
              "payload": {"type": "essay_builder", "spec": spec}, "answer": {"type": "essay_builder", "spec": {"rubric": rubric}},
              "explanation": expl, "points": pts, "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


TXT = "علي محمود طه (بكالوريا 2025، لغات أجنبيّة، الموضوع الأوّل)"
# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "multi", "أيّ ممّا يلي من مظاهر الحزن العميق في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الكآبة والغرق في الشّجون", "كثرة السّهر وذبول الجفون", "ارتعاش اليد والأنين", "نضوب الفم والدّموع في الأجفان",
                "الفرح بانقضاء اللّيل", "الإقبال على الحياة بتفاؤل"]},
   {"correct": [0, 1, 2, 3]}, "من مظاهرها: الكآبة، الغرق في الشّجون، كثرة السّهر وذبول الجفون، ارتعاش اليد، الأنين، ذبول القلب بالأسى، نضوب الفم، دموع في الأجفان…", 1, "ar.comprehension.emotion")
st("s02", "q1", "q1-e2", "multi", "اختر العبارات الدّالّة على الحزن من النّصّ. (اختر كلّ ما يصحّ)",
   {"options": ["«أيُّها الشّاعِرُ الكَئيبُ»", "«غارِقًا في شُجونِكْ»", "«للسُّهْدِ ذابِلاتٌ جُفونُكْ»", "«وأُخْرى في ارْتِعاشٍ»", "«فَمٌ ناضِبٌ»",
                "«ولَيْسَتْ للشّاعِرِ المَوْهوبِ»", "«والْتَمِسْ في الفِراشِ دِفْئًا»"]},
   {"correct": [0, 1, 2, 3, 4]}, "العبارات الدّالّة على ذلك من النّصّ: (أيّها الشّاعر الكئيب/ غارقا في شجونك/ مسلما رأسك الحزين/ للسّهد ذابلات جفونك/ وأخرى في ارتعاش/ فم ناضب/ ضعيف أنينك…). يكتفى من المترشّح بأربع عبارات.", 1, "ar.comprehension.evidence")
REFL = ["ذبول قلب الشّاعر الغضّ بالأسى", "تحطّم كيانه الرّقيق", "تيه الشّاعر وحيرته", "أرق الشّاعر وطول اللّيل عليه ودوام بكائه فيه لتمكّن الأحزان منه"]
REFL_EXPL = "انعكاسات ظاهرة الحزن والألم في الوحدة الثّانية: ذبول قلب الشّاعر الغضّ بالأسى، تحطّم كيانه الرّقيق، تيه الشّاعر وحيرته، أرق الشّاعر وطول اللّيل عليه ودوام بكائه فيه لتمكّن الأحزان منه."
for sid, eid, quote, k in [("s03", "q2-e1", "«أنتَ أذْبَلْتَ بالأسى قَلْبَكَ الغَضّ»", 0), ("s04", "q2-e2", "«وحَطَّمْتَ مِن رَقيقِ كيانِكْ»", 1),
                           ("s05", "q2-e3", "«وما زِلْتَ سائِرًا في مَكانِكْ»", 2), ("s06", "q2-e4", "«ما وراءَ السُّهادِ في لَيْلِكَ الدّاجي» و«لِتِلْكَ الدُّموعِ في أجْفانِكْ»", 3)]:
    opts = [REFL[k]] + [r for i, r in enumerate(REFL) if i != k]
    st(sid, "q2", eid, "mcq", f"أيّ انعكاس للحزن والألم على نفسيّة الشّاعر يدلّ عليه قوله: {quote}؟", {"options": opts}, {"correct": 0}, REFL_EXPL, 0.5, "ar.comprehension.emotion")
st("s07", "q3", "q3-e1", "mcq", "ما المخرج الّذي اقترحه صاحب النّصّ على الشّاعر الحزين؟",
   {"options": ["تجاوز المحنة واستنهاض الذّات لترك الكآبة، والتّحلّي بالأمل والتّفاؤل وأن يقرّ عينا بأنّه فعلا شاعر موهوب",
                "الاستسلام للحزن والبقاء في مكانه", "هجر الشّعر نهائيًّا والانصراف إلى المجون", "البكاء حتّى يرقّ له الدّجى"]},
   {"correct": 0}, "المخرج الّذي اقترحه صاحب النّصّ على الشّاعر هو تجاوز المحنة واستنهاض الذّات لترك الكآبة، والتّحلّي بالأمل والتّفاؤل وأن يقرّ عينا بأنّه فعلا شاعر موهوب («فقم الآن من مكانك واغنم…»).", 0.5, "ar.comprehension.details")
Q3_SPEC = {"task": "إبداء الرّأي في المخرج وتعليله", "text": TXT, "question": "أتراهُ مَخْرَجًا سليمًا؟ علّلْ.",
           "model": "وهو مخرج سليم. التّعليل: الكآبة والحزن لا يورّثان إلّا الهمّ والنّكد، وليس له من سلاح لمواجهة واقعه الأليم سوى الصّبر والتّفاؤل لاستنهاض همّته…",
           "indicator": "قبول أيّ تعليل منطقيّ"}
essay("s08", "q3", "q3-e2", "المخرج الّذي اقترحه الشّاعر — هل تراه مخرجًا سليمًا؟", {**Q3_SPEC, "criterion": "الحكم على المخرج"},
      "الحكم على سلامة المخرج (الإجابة النّموذجيّة: «وهو مخرج سليم»)", "الإجابة النّموذجيّة: «وهو مخرج سليم»، ويُقبل أيّ تعليل منطقيّ.", 0.5, "ar.comprehension.opinion")
essay("s09", "q3", "q3-e3", "المخرج الّذي اقترحه الشّاعر — علّل حكمك", {**Q3_SPEC, "criterion": "التّعليل"},
      "قبول أيّ تعليل منطقيّ", "التّعليل في الإجابة النّموذجيّة: الكآبة والحزن لا يورّثان إلّا الهمّ والنّكد، وليس له من سلاح لمواجهة واقعه الأليم سوى الصّبر والتّفاؤل لاستنهاض همّته… ويُقبل أيّ تعليل منطقيّ.", 1, "ar.comprehension.opinion")
st("s10", "q4", "q4-e1", "mcq", "هل للشّاعر حظّ من الحياة؟",
   {"options": ["ليس للشّاعر نصيب من الحياة سوى الضّنى والشّحوب وتحمّل المشاقّ، وقد فُتحت الدّنيا لأهل المجون والختل والزّيف",
                "للشّاعر الموهوب الحظّ الأوفر من الحياة", "الحياة تجازي الشّاعر بقدر ما يتحمّل فيها", "للشّاعر وأهل المجون الحظّ نفسه من الحياة"]},
   {"correct": 0}, "ليس للشّاعر نصيب من الحياة سوى الضّنى والشّحوب وتحمّل المشاقّ. ويظهر ذلك في البيتين الأخيرين، حيث تنكّرت له الحياة وتنكّب الحظّ لشخصه ولأمثاله، في حين أنّ غيره ممّن ليسوا في مستواه من أهل المجون والختل والزّيف قد فُتحت لهم الدّنيا.", 0.5, "ar.comprehension.idea")
st("s11", "q4", "q4-e1", "fill_blank", "أكمل البيتين الأخيرين اللّذين يوضّحان حظّ الشّاعر من الحياة:",
   {"text": "لَسْتَ تُجْزَى مِنَ الحَياةِ بِمَا حُمِّلْتَ فيها مِنَ ____ والشُّحوبِ — إنّها للمُجونِ، والخَتْلِ، و____، ولَيْسَتْ للشّاعِرِ المَوْهوبِ",
    "bank": ["الضَّنَى", "الزَّيْفِ", "الهَناءِ", "الصِّدْقِ"]},
   {"blanks": [["الضَّنَى"], ["الزَّيْفِ"]]}, "البيتان 11 و12: «لستَ تُجزى من الحياة بما حُمّلت فيها من الضّنى والشّحوب / إنّها للمجون، والختل، والزّيف، وليست للشّاعر الموهوب».", 0.5, "ar.comprehension.evidence", "b")
SUM_SPEC = {"task": "تلخيص", "text": TXT, "model_summary": "انجلى اللّيل وما زلت تتخبّط في حزنك وكآبتك وفي صراع مع نفسك المضطربة. اعلم أنّك أنت السّبب وأنّ دجى اللّيل لا يألم لحالك، ولا يخرجك ممّا أنت فيه، فانهض وكفّ عن الحزن والأسى. قم من مكانك وخذ قسطا من الرّاحة ينسك همومك لأنّ الحياة لا تجازي الشّاعر الموهوب..."}
SUM_EXPL = "التّلخيص يراعى فيه: المضمون – الحجم – سلامة اللّغة (تلخيص للاستئناس في الإجابة النّموذجيّة)."
for sid, eid, crit in [("s12", "q5-e1", "المضمون"), ("s13", "q5-e2", "الحجم"), ("s14", "q5-e3", "سلامة اللّغة")]:
    essay(sid, "q5", eid, f"تلخيص قصيدة علي محمود طه — معيار {crit}", {**SUM_SPEC, "criterion": crit, "indicator": crit}, crit, SUM_EXPL, 1, "ar.writing.summary")
# ── ثالثًا: التّقييم النّقديّ ──
st("s15", "q11", "q11-e1", "mcq", "ما المقصود بقول «موسيه»: «لا شيء يجعلنا كبارًا كالألم»؟",
   {"options": ["الألم يشحذ الهمم ويعوّد على تحمّل المشاقّ ومواجهة المحن، وكلّما ازداد الإنسان ألمًا ازداد سموًّا ورفعة في مجتمعه، فالألم هو المعلّم الأكبر والأصدق للإنسان",
                "الألم يُضعف الإنسان ويحطّ من قيمته في مجتمعه", "الكبار في السّنّ هم أكثر النّاس ألمًا", "على الإنسان أن يتجنّب الألم بكلّ وسيلة"]},
   {"correct": 0}, "إنّ الألم يشحذ الهمم ويعوّد على تحمّل المشاقّ ومواجهة المحن، فحياة الإنسان ترتبط بحياة ضميره في معايشة الصّعاب وتخطّي الآلام، وكلّما ازداد ألما ازداد سموّا ورفعة في مجتمعه، فالألم هو المعلّم الأكبر والأصدق للإنسان…", 0.5, "ar.comprehension.explain")
st("s16", "q11", "q11-e1", "fill_blank", "أكمل شرح قول «موسيه»:",
   {"text": "إنّ الألم يشحذ ____ ويعوّد على تحمّل المشاقّ ومواجهة المحن، وكلّما ازداد الإنسان ألمًا ازداد ____ ورفعة في مجتمعه.",
    "bank": ["الهمم", "سموًّا", "اليأس", "ضعفًا"]},
   {"blanks": [["الهمم"], ["سموًّا", "سموا"]]}, "«إنّ الألم يشحذ الهمم ويعوّد على تحمّل المشاقّ ومواجهة المحن… وكلّما ازداد ألما ازداد سموّا ورفعة في مجتمعه».", 0.5, "ar.comprehension.explain", "b")
CAUSE_EXPL = ("أ- أسباب ذاتيّة يتعرّض لها الشّاعر في حياته كالمرض أو الاغتراب أو التّهميش أو العزلة أو الإقصاء… "
              "ب- أسباب موضوعيّة تتّصل بالواقع العربيّ وما فيه من أزمات ومشكلات سياسيّة كان لها الأثر البالغ في تعميق الألم كالحروب وتتابع النّكبات والعنصريّة، "
              "بالإضافة إلى سوء الأحوال الاقتصاديّة والاجتماعيّة والفكريّة والحضاريّة كاصطدام الأفكار المثاليّة بالواقع والاستياء من الحضارة الغربيّة والتّبعيّة لها…")
st("s17", "q12", "q12-e1", "multi", "أيّ ممّا يلي من الأسباب الذّاتيّة الّتي جعلت القصيدة العربيّة المعاصرة تصطبغ بصبغة الحزن والألم؟ (اختر كلّ ما يصحّ)",
   {"options": ["المرض", "الاغتراب", "التّهميش", "العزلة أو الإقصاء", "الحروب وتتابع النّكبات", "الاستياء من الحضارة الغربيّة والتّبعيّة لها"]},
   {"correct": [0, 1, 2, 3]}, CAUSE_EXPL, 1, "ar.literature.context")
st("s18", "q12", "q12-e1", "multi", "وأيّ ممّا يلي من الأسباب الموضوعيّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["الأزمات والمشكلات السّياسيّة كالحروب وتتابع النّكبات والعنصريّة", "سوء الأحوال الاقتصاديّة والاجتماعيّة والفكريّة والحضاريّة",
                "اصطدام الأفكار المثاليّة بالواقع", "الاستياء من الحضارة الغربيّة والتّبعيّة لها", "مرض الشّاعر", "اغتراب الشّاعر وعزلته"]},
   {"correct": [0, 1, 2, 3]}, CAUSE_EXPL, 1, "ar.literature.context", "b")
st("s19", "q13", "q13-e1", "multi", "اختر أربعة من أعلام القصيدة العربيّة المعاصرة الّتي اصطبغت بصبغة الحزن والألم.",
   {"options": ["نازك الملائكة", "بدر شاكر السّيّاب", "عبد الوهّاب البيّاتي", "صلاح عبد الصّبور", "امرؤ القيس", "المتنبّي", "أبو تمّام"]},
   {"correct": [0, 1, 2, 3]}, "أربعة من الأعلام: نازك الملائكة، بدر شاكر السّيّاب، عبد الوهّاب البيّاتي، صلاح عبد الصّبور، أمل دنقل، عبد الرّحمان جيلي، خليل إيليا حاوي، وغيرهم… يكتفى من المترشّح بذكر أربعة أعلام؛ أمّا امرؤ القيس والمتنبّي وأبو تمّام فشعراء قدامى.", 1, "ar.literature.trend")


# ── تدقيق محلّيّ (المهارات من src/server/play/exams/skills.ts؛ التّطبيع نسخة من normalizeArabic) ──
_SKILLS_TS = pathlib.Path(__file__).resolve().parents[3] / "src" / "server" / "play" / "exams" / "skills.ts"
SKILLS = set(re.findall(r"'(ar\.[a-z_.]+)':", _SKILLS_TS.read_text(encoding="utf-8")))
assert len(SKILLS) > 20, "skills.ts not parsed"


def _norm(s):
    s = unicodedata.normalize("NFKC", s)
    s = re.sub("[ً-ْٰـ]", "", s)
    s = re.sub("[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي").replace("ؤ", "و").replace("ئ", "ي")
    s = "".join(c if (c.isalnum() or c.isspace()) and c != "_" else " " for c in s)
    return re.sub(r"\s+", " ", s.lower()).strip()


def _check():
    assert len(poem) == 12 and all(len(r) == 3 for r in poem) and intro and ref and glossary and crit_quote and crit_ref
    els = {e["id"]: e for qq in Q for e in qq["rubric_elements"]}
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    for qq in Q:
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"] in els and s["rubric_element_id"].startswith(s["source_question_id"] + "-"), s["id"]
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t == "mcq":
            assert 3 <= len(p["options"]) <= 4 and a["correct"] == 0, s["id"]
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
        if t == "multi":
            assert len(p["options"]) >= 3 and 0 < len(a["correct"]) < len(p["options"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank) and len(bank) > len(a["blanks"]), s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            assert s["review_status"] == "needs_human_review", s["id"]
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - (14 if BLOCKED else 20)) < 1e-9
    assert len({s["id"] for s in S}) == len(S)
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


_check()

NOTES = (("محجوبة (BLOCKED): علامات «ثانيًا- البناء اللّغويّ» (6 نقاط) غير مقروءة: الصّفحة 2 من الإجابة النّموذجيّة ممسوحة مقصوصةً عند الحدّ الأيسر لخانة النّصّ، "
          "فغاب عمودا العلامات (مجزّأة/ مجموع) كلاهما، ولا يظهر إلّا مجموع الجزء «(06ن)»؛ النّسختان في Drive متطابقتان بايتًا ببايت، ونسخة الأرشيف "
          f"gdrive:{ARCHIVE_ID} (18.8 م.ب) أكبر من حدّ التّنزيل ونصّها المستخرج بلا علامات لهذا الجزء. لم تُخترع أيّ علامة: أسئلة البناء اللّغويّ منقولة حرفيًّا بلا عناصر "
          "ولا خطوات، والإجابة النّموذجيّة محفوظة في المحوّل (PART2_MODEL). لرفع الحجب: قراءة علامات الجزء الثّاني من نسخة غير مقصوصة، ثمّ ملء MARKS_P2 وإعادة البناء. ") +
         "نُسخ النّصّ من صورة الورقة الرّسميّة (لا نسخة Word). الموضوع: "
         f"gdrive:{PAPER_ID} (01_الموضوع.pdf، ص1–2) ونسخته المطابقة gdrive:{PAPER_COPY_ID}؛ الإجابة النّموذجيّة: gdrive:{CORR_ID} (02_التصحيح.pdf، ص1–3) ونسختها المطابقة gdrive:{CORR_COPY_ID}. "
         "المسح نسخة قارئ عليها شروح وتسطير وأسهم بخطّ اليد فوق المطبوع؛ لم يُنقل إلّا المطبوع، والحركات كما يُظهرها المسح (قد تخفى حركات دقيقة)، ومدّات التّطويل «ـــ». "
         "البيت 9: الكلمة بين «الكَرى» و«الجَفْنِ» مغطّاة بشرح يدويّ، أُكملت من الرّصيد اللّغويّ المطبوع في الصّفحة نفسها فقط («غطّة: نومة…»، بين الكرى ب9 والضّنى ب11) وحركاتها مخفيّة — للتّأكّد من نسخة نظيفة. "
         "ما تحته خطّ: لا يُفصل تسطير الطّبع عن تسطير اليد في المسح؛ المطلوب إعرابه بحسب الإجابة النّموذجيّة «الدّموع» (ب7) و«الكرى» (ب9)، وبين قوسين «(أذْبَلْتَ بالأسى قَلْبَكَ)» (ب5) و«(حُمِّلْتَ)» (ب11). "
         "خطأ في الإجابة النّموذجيّة: س5 من البناء اللّغويّ تكتب العبارة «(يخلو الدّجى)» والشّرح «لفظة (يحلو)»، والورقة «(يَحْنُو الدُّجَى)»؛ أيّ خطوة لاحقة تتبع الورقة. "
         "اختلاف OCR والصّورة: OCR «البراع/وفم ناضت/سمايزا/يخنو/الكتيب/عله/الطني/حيد/عَلَك/أنكز/موسية/تضطبع» والصّورة «اليراع/وفم ناضب/سائرا/يحنو/الكئيب/طه/الضّنى/حدّد/علّل/اُذكر/موسيه/تصطبغ». "
         "العلامات المقروءة: بناء فكريّ 10 (2+2+2+1+3) وتقييم نقديّ 4 (1+2+1). س3: الحكم «وهو مخرج سليم» (0.5) والتّعليل (01، «قبول أيّ تعليل منطقيّ») مؤجّلان (essay_builder) لأنّ السّؤال يطلب رأي المترشّح؛ "
         "التّلخيص (3×1) مؤجّل. المؤجَّل 4.5 من 14 نقطة محوّلة.")

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "BLOCKED" if BLOCKED else "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{PAPER_ID}-p1",
        "kind": "BAC", "year": 2025, "level": "3AS", "streams": ["LANG"], "subject": "AR", "term": None, "paper": 1,
        "title": "بكالوريا 2025 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (علي محمود طه)",
        "original_url": f"https://drive.google.com/file/d/{PAPER_ID}/view",
        "original_file_ref": f"gdrive:{PAPER_ID} (01_الموضوع.pdf)",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": NOTES,
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-11-03T21:30:00Z", "by": "claude", "action": "generated",
                    "note": "تحويل من صورة الموضوع الرّسميّ والإجابة النّموذجيّة الرّسميّة (PDF ممسوحان)؛ محجوبة لأنّ علامات البناء اللّغويّ مقصوصة في المسح؛ الإجابات من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", len(S), "steps", sum(s["points"] for s in S), "points", "BLOCKED" if BLOCKED else "")
