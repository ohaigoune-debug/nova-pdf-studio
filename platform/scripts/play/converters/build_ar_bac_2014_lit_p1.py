"""Conversion: BAC 2014 (session عاديّة، جوان 2014) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (محمّد بلقاسم خمّار، على لسان الجزائر).
Exam (most faithful source): gdrive 1kjzG1pt9R9hQilqMuk9qHjT2z0op_kxq (بكالوريا العربية 2014 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 1SFiC3l1VsOUtnAjOaJ0ADkYu_dzJNpvN;
official ONEC paper: gdrive 1jQuB7SUI8U3Abtjv9aZAUGCHKHB1i1e4 (01_الموضوع.pdf, pages 1–2, image-only — rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1LoBxYe1c6ScPuPSfQKvwX8-s78BeNhgh (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2014_sci_p1.py): PARAS / POEM_RAW below were generated from the .docx with python-docx (paragraph and
cell text read exactly; only outer whitespace and outer direction marks trimmed; the poem table is read as rows
[عجز, (empty), «n- صدر»] from the RTL 3-column layout — in rows 5 and 8 the صدر cell is merged over the two right columns,
read once) and every verbatim string of the JSON was re-checked programmatically against the docx. The docx was compared
verse by verse and question by question with the official ONEC paper (rendered at 130 dpi): same 14 verses, same pairing
(the مدوّر verses 5 «للحرْ / ب)» and 8 «وإن تـمَّ / له» split as on the ONEC paper), same questions. The mark scheme was
read from the rendered pages (150 dpi; the scansion at 300 dpi; the scheme prints the prosody symbols in visual right-to-left
order — written here left-to-right, the usual notation). Every mark comes from the official scheme; correct options and
explanations condense its wording.

Docx vs ONEC: labels and spelling only («الشرح اللغوي» vs «الشرح»; part 2 Q2 item «أ-» is not in the docx text — the docx
paragraph starts at «أيها الشَّهر», as with its auto-numbered questions) — docx kept, no patch needed.

Conversion notes / points for the owner's review:
- Streams: آداب وفلسفة only (ONEC paper and correction headers) ⇒ LIT.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items (more listed or accepted than required) ⇒ one
  element; exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×0.5» = what the poet celebrates (النّصر) / the explanation. Q2 «4×0.25» = exactly the four images listed ⇒ four
  elements. Q3 «1» (principle + evidence, not split) ⇒ one element, two steps. Q4 «4×0.5» = الإصرار / its verse (8) /
  الاعتراف / its verses (10, 11). Q5 «1». Q6 «1 + 2×0.5» = the type (الوصف خادمه الحوار) + two indicators among many ⇒ 1 + 1.
- Q7 (تلخيص) «0.5 / 1 / 0.5» = المضمون / تقنيات التّلخيص / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2: Q1 «0.5» (both words, one meaning). Q2 «2×0.25 + 2×0.25» = type and purpose of each expression ⇒ four elements.
  Q3 «3×0.25» = type / explanation / effect. Q4: «أنسا» 0.25, «أسودي» 0.5 (noun + ياء, one line ⇒ one element, two steps),
  the two sentences 0.5 each. Q5 «0.25 + 0.25». Q6 (تقطيع) «2×0.25» per line (writing; symbols and feet) + «0.5» the metre.
- Part 3 «2 + 2» = the definition of الالتزام + three features among the listed ones ⇒ interactive.
- Distractors avoid what usage could accept: no «الثّورة/الحرّيّة» distractor for Q1, no verse that also honours the
  martyrs (ب9) or shows persistence (ب7) among the verse distractors of Q4, no «استئنافيّة»/«حال» for the two sentences,
  no «الاستحقاق/الاختصاص» for the لام of «لي», no «تعجّب» for «أنا ثائر!!» (the scheme says خبر).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2014-lit-p1"
PAPER = 1
STREAMS = ["LIT"]
DOCX_ID = "1kjzG1pt9R9hQilqMuk9qHjT2z0op_kxq"
DOCX_TITLE = "بكالوريا العربية 2014 شعبة اداب وفلسفة.docx"
PDF_ID = "1SFiC3l1VsOUtnAjOaJ0ADkYu_dzJNpvN"
OFFICIAL_ID = "1jQuB7SUI8U3Abtjv9aZAUGCHKHB1i1e4"
CORR_ID = "1LoBxYe1c6ScPuPSfQKvwX8-s78BeNhgh"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    2: "النّـــــص: قال الشاعر الجزائريّ \"محمد بلقاسم خمار\" على لسان الجزائر*:",
    3: "الشرح اللغوي:",
    4: "- روحًا: الرَّوْحُ: بَردُ نسيم الريح.       - المُزْن: السّحاب، مفرده مُزنة.",
    5: "* نظَم هذه القصيدة بدمشق في 01/11/1962.",
    6: "الأسئلة:       أوّلا- البناء الفكري: (10 نقاط)",
    7: "بِم تغنّى الشاعر في النصّ؟ وضّح ذلك.",
    8: "استخرج من النصّ الصفات التي صوّر بها الشاعر عظمة النّصر.",
    9: "عاشت الجزائر على مَبدأ لم تَحِدْ عنه، ما هو؟ دُلَّ عليه من النصّ.",
    10: "في النصّ إصرار واعتراف من الشاعر. بيّنهما مشيرا إلى الأبيات الدَّالة عليهما.",
    11: "ما الذي يعنيه الشاعر بقوله: «أنا للخَلْق قِبلة»؟",
    12: "ما النمط الغالب على النصّ؟ اذكر مُؤشرين له.",
    13: "لخّص مُحتوى النّص بأسلوبك الخاص.",
    14: "ثانيا- البناء اللّغوي: (06 نقاط)",
    15: "بم تُوحي اللفظتان التاليتان: «أُسود»، «تزْأر»؟",
    16: "بيّن نوع الأسلوب وغرضه البلاغيّ في العبارتين التاليتين:",
    17: "«أيها الشَّهر».                       ب- «أنا شعْبٌ شعاره: \" أنا ثائر!! \"».",
    18: "ما نوع الصورة البيانيّة في عبارة: «لست أنسى أُسودي»؟ اشرحها مبيّنا أثرها في المعنى.",
    19: "أعرب ما يلي إعراب مفردات: «أُنْسًـــا» في الشطر الثاني من البيت الأول، و «أُسودي» في الشطر الأول من البيت العاشر.",
    20: "وما يلي إعراب جمل: «أي عزمٍ هاج الجزائر للحرب» في الشطر الأول من البيت الخامس، و",
    21: "«تفتَّحَت للتّحَرُّر» في الشطر الثاني من البيت التاسع.",
    22: "عيّن معاني حَرفي الجرّ في قوله: - «كالغيْث» - «هذه الأرض لي».",
    23: "قطع السطرين التاليين للشاعر صلاح عبد الصبور، مبيّنا التفعيلات والبحر:",
    24: "هُنَاكَ شَيْئٌ فِي نُفُوسِنَا حَزِينْ",
    25: "قَدْ يَخْتَفِي وَلَا يَبِينْ",
    26: "ثالثا- التّقويم النقدي: (04 نقاط)",
    27: "- يعكِس النّص الذي بين يديك ظاهرة \"الالتزام\" عند الشعراء المعاصرين.",
    28: "عرف بهذه الظاهرة واذكر ثلاثاً من خصائصها.",
}
# الجدول 0 في docx: صفوف [العجز، خليّة فارغة، «رقم- الصّدر»]؛ في الصّفّين 5 و8 خليّة الصّدر مدموجة («<MERGED>»)
POEM_RAW = [
    ["عُــــــمَّ تلـــــك الربــــوع أُنْسًـــا ورَوْحًـــــا", "", "1- دفقة الفجرِ، مَولد النـــور مَرْحَـــــى"],
    ["كنــت لــــيلا أحـــاله النُّـــور صُبحـــــا", "", "2- كنتَ فـــي مُهجتــي سجين ظنــــــونٍ"],
    ["سـاح كَالغيْث هامِي المُزن سَمْحَا", "", "3- إنـــــه النّصـــر يــــا بـــلادي، تَغَنَّــــــيْ"],
    ["حـــــــين أرســلــتُ للجبــــــــــال أسُـــــــودَا", "", "4- هتـف الخلقُ لي وصـاحوا رُعـــودًا"],
    ["ب) وأيُّ الآمــــــال شاءت وَجُـودَا؟", "5- (أي عــزْمٍ هـــــاج الجـــزائر للحـــــــــــــــرْ", "<MERGED>"],
    ["أو مـمـــــــاتٌ بهــــــا أهـــزُّ الخُلـــــــــــودا", "", "6- قلـــتُ حـــــــريّتي ... فإمّــــــا حيـــــــاةٌ"],
    ["لــــم تزل أُسُــــــدُها بأراضـــــيَ تـــــــزأر", "", "7- إنّ أصــــداء ثـــورتي يا \" نوفمبر\""],
    ["له النّصر في النّضــــال المُظفَّـــــــر", "8- أبــــديُّ صــــوتُ الجهــاد وإن تـــــــــــــــــــــــــــــمَّ", "<MERGED>"],
    ["وَبـــــــــذورٌ (تَـــفتَّحَـــــت للتَّـــــــحرُّرْ)", "", "9- كـــــــــل شِبْرٍ بــــــه دمـــاء شهـــــــــــيدٍ"],
    ["من رِفاق عْميروش وابْن المَهيدي", "", "10-أيّها الشهْرُ لستُ أَنسى أُسُودي"],
    ["وأبــــــى الصَّـــــامـــدون إلاّ خُلــــــودي", "", "11- كــــــــــم عــــــــدو أرادنـــــــي للمَنايـــــــا"],
    ["مــن تعـــدَّى فقــد تحدَّى وجــــــــودي", "", "12- هذه الأرض لي وَتِلكُمْ حُدودي"],
    ["أنـــا شعْــــبٌ شعـــــاره: \"أنــا ثائر!!\"", "", "13- أنــــا فـــي مُعْجم الفخَــارِ‏ جَـــــزائرْ"],
    ["أنـــــــــــا للخُـــــــــــلدِ بهجــــــــةٌ وبشــــــائـــرْ", "", "14- أنــــــــا للخَلـــــــق قبلــــــــةٌ وصـــــــلاةٌ"],
]
POEM = []
for _ajz, _mid, _right in POEM_RAW:
    _sadr = _mid if _right == "<MERGED>" else _right
    assert _right == "<MERGED>" or not _mid, _right
    _m = re.match(r"^(\d+)-\s*(.+)$", _sadr)
    assert _m and "\n" not in _sadr and "\n" not in _ajz, _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 15)]
assert "(أي" in POEM[4][1] and "(تَـــفتَّحَـــــت" in POEM[8][2] and POEM[9][1].startswith("أيّها الشهْرُ")

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
PART1 = re.split(r"\s{2,}", PARAS[6], maxsplit=1)[1]  # «الأسئلة:» و«أوّلا- البناء الفكري» في فقرة واحدة في docx
P1, P2, P3 = PART1, PARAS[14], PARAS[26]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
DOCS = [
    {"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": PARAS[2]},
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": J(3, 4)},
    {"id": "d-note", "kind": "text", "caption": "حاشية", "text": PARAS[5]},
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



q("q1", "1", P1, J(7), 1, [el("q1-e1", "ما تغنّى به الشّاعر", 0.5), el("q1-e2", "توضيح ذلك", 0.5)])
q("q2", "2", P1, J(8), 1, [el("q2-e1", "الصّفة الأولى (ب1)", 0.25), el("q2-e2", "الصّفة الثّانية (ب1)", 0.25),
                          el("q2-e3", "الصّفة الثّالثة (ب3)", 0.25), el("q2-e4", "الصّفة الرّابعة (ب2)", 0.25)])
q("q3", "3", P1, J(9), 1, [el("q3-e1", "المبدأ والدّلالة عليه من النّصّ", 1)])
q("q4", "4", P1, J(10), 2, [el("q4-e1", "الإصرار", 0.5), el("q4-e2", "البيت الدّالّ على الإصرار", 0.5),
                           el("q4-e3", "الاعتراف", 0.5), el("q4-e4", "البيتان الدّالّان على الاعتراف", 0.5)])
q("q5", "5", P1, J(11), 1, [el("q5-e1", "معنى «أنا للخلق قبلة»", 1)])
q("q6", "6", P1, J(12), 2, [el("q6-e1", "النّمط الغالب", 1), el("q6-e2", "مؤشّران له (2×0.5)", 1)])
q("q7", "7", P1, J(13), 2, [el("q7-e1", "التّلخيص: المضمون", 0.5), el("q7-e2", "التّلخيص: تقنيات التّلخيص", 1), el("q7-e3", "التّلخيص: سلامة اللّغة", 0.5)])
q("q8", "1", P2, J(15), 0.5, [el("q8-e1", "إيحاء «أسود» و«تزأر»", 0.5)])
q("q9", "2", P2, J(16, 17), 1, [el("q9-e1", "«أيّها الشّهر»: نوع الأسلوب", 0.25), el("q9-e2", "«أيّها الشّهر»: الغرض", 0.25),
                                el("q9-e3", "«أنا شعب شعاره…»: نوع الأسلوب", 0.25), el("q9-e4", "«أنا شعب شعاره…»: الغرض", 0.25)])
q("q10", "3", P2, J(18), 0.75, [el("q10-e1", "نوع الصّورة", 0.25), el("q10-e2", "شرحها", 0.25), el("q10-e3", "أثرها في المعنى", 0.25)])
q("q11", "4", P2, J(19) + "\n" + PARAS[20] + " " + PARAS[21], 1.75,
  [el("q11-e1", "إعراب «أنسا» (ب1)", 0.25), el("q11-e2", "إعراب «أسودي» (ب10)", 0.5),
   el("q11-e3", "محلّ جملة «أيّ عزم هاج الجزائر للحرب» (ب5)", 0.5), el("q11-e4", "محلّ جملة «تفتّحت للتّحرّر» (ب9)", 0.5)])
q("q12", "5", P2, J(22), 0.5, [el("q12-e1", "معنى الكاف في «كالغيث»", 0.25), el("q12-e2", "معنى اللّام في «هذه الأرض لي»", 0.25)])
q("q13", "6", P2, J(23, 24, 25), 1.5, [el("q13-e1", "تقطيع السّطر الأوّل (2×0.25)", 0.5), el("q13-e2", "تقطيع السّطر الثّاني (2×0.25)", 0.5),
                                       el("q13-e3", "البحر", 0.5)])
q("q14", "التّعليمة", P3, J(27, 28), 4, [el("q14-e1", "تعريف ظاهرة الالتزام", 2), el("q14-e2", "ثلاث من خصائصها", 2)])

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "تغنّى الشّاعر في النّصّ بالنّصر، ذلك أنّه رحّب به وعدّه فجرًا جديدًا ومَوردًا لنور الحرّيّة الّتي ظلّت سجينة ظنونه."
st("s01", "q1", "q1-e1", "mcq", "بمَ تغنّى الشّاعر في النّصّ؟",
   {"options": ["بالنّصر", "بجمال الطّبيعة في بلاده", "بأمجاد العرب القدامى", "بالحبّ والحنين إلى الأهل"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل توضيح ذلك:",
   {"text": "رحّب الشّاعر بالنّصر وعدّه ____ جديدًا ومَوردًا لنور ____ الّتي ظلّت سجينة ظنونه.", "bank": ["فجرًا", "الحرّيّة", "ليلًا", "العبوديّة"]},
   {"blanks": [["فجرًا", "فجرا"], ["الحرّيّة"]]}, Q1_EXPL, 0.5, "ar.comprehension.explain")
Q2_EXPL = "الصّفات الّتي صوّر بها الشّاعر عظمة النّصر هي: (دفقة الفجر، مولد النّور، كالغيث هامي المزن، كنتَ ليلًا أحاله النّور صبحا)."
st("s03", "q2", "q2-e1", "fill_blank", "أكمل الصّفة الّتي صوّر بها الشّاعر عظمة النّصر في مطلع البيت الأوّل:",
   {"text": "«____ الفجرِ»", "bank": ["دفقة", "ظلمة", "غفوة"]}, {"blanks": [["دفقة"]]}, Q2_EXPL, 0.25, "ar.comprehension.details")
st("s04", "q2", "q2-e2", "mcq", "أكمل صفة أخرى للنّصر من البيت الأوّل: «دفقة الفجر، مولد …»",
   {"options": ["النّور", "الظّلام", "الحزن"]}, {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.details")
st("s05", "q2", "q2-e3", "mcq", "أكمل الصّفة الّتي صوّر بها الشّاعر النّصر في البيت الثّالث: «ساح كالغيث …»",
   {"options": ["هامي المزن سمحا", "قاحل الأرض شحيحا", "عاصف الرّيح عنيفا"]}, {"correct": 0}, Q2_EXPL, 0.25, "ar.comprehension.details")
st("s06", "q2", "q2-e4", "fill_blank", "أكمل الصّفة الّتي صوّر بها الشّاعر النّصر في البيت الثّاني:",
   {"text": "«كنتَ ليلًا أحاله ____ صبحا»", "bank": ["النّور", "الظّلام", "الغيم"]}, {"blanks": [["النّور"]]}, Q2_EXPL, 0.25, "ar.comprehension.details")
Q3_EXPL = "عاشت الجزائر على مبدأ لم تحد عنه هو الحرّيّة. تدلّ عليه العبارات التّالية: فإمّا حياة أو ممات، أبديّ صوت الجهاد، أنا ثائر…"
st("s07", "q3", "q3-e1", "mcq", "ما المبدأ الّذي عاشت عليه الجزائر ولم تحد عنه؟",
   {"options": ["الحرّيّة", "الحياد", "المهادنة", "التّبعيّة"]}, {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.values")
st("s08", "q3", "q3-e1", "multi", "أيّ العبارات الآتية تدلّ على هذا المبدأ؟ (اختر كلّ ما يصحّ)",
   {"options": ["«فإمّا حياةٌ أو مماتٌ»", "«أبديّ صوتُ الجهاد»", "«أنا ثائر»", "«دفقة الفجر، مولد النّور مرحى»", "«هتف الخلق لي وصاحوا رعودا»"]},
   {"correct": [0, 1, 2]}, Q3_EXPL + " أمّا «دفقة الفجر…» فتصوير للنّصر، و«هتف الخلق لي…» حديث عن ابتهاج الخلق.", 0.5, "ar.comprehension.evidence", "b")
Q4_EXPL = ("يتمثّل إصرار الشّاعر في عزمه على مواصلة الجهاد بعد تحقيق النّصر، والبيت الدّالّ على ذلك رقم (8). أمّا اعترافه فيظهر في تقديره وعرفانه "
           "لمن ضحّوا في سبيل عزّة الوطن وخلوده، وما يدلّ على ذلك في النّصّ البيتان (10) و(11).")
st("s09", "q4", "q4-e1", "mcq", "فيمَ يتمثّل إصرار الشّاعر؟",
   {"options": ["في عزمه على مواصلة الجهاد بعد تحقيق النّصر", "في عزمه على طيّ صفحة الثّورة ونسيانها", "في إصراره على الرّحيل عن الوطن",
                "في عزمه على مصالحة العدوّ"]}, {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.idea")
st("s10", "q4", "q4-e2", "mcq", "ما البيت الدّالّ على هذا الإصرار؟",
   {"options": ["البيت الثّامن: «أبديّ صوت الجهاد وإن تمّ له النّصر في النّضال المظفّر»", "البيت الأوّل: «دفقة الفجر، مولد النّور مرحى…»",
                "البيت الثّالث: «إنّه النّصر يا بلادي، تغنّي…»", "البيت الرّابع عشر: «أنا للخلق قبلة وصلاة…»"]},
   {"correct": 0}, Q4_EXPL, 0.5, "ar.comprehension.evidence")
st("s11", "q4", "q4-e3", "fill_blank", "أكمل: فيمَ يظهر اعتراف الشّاعر؟",
   {"text": "يظهر اعترافه في ____ و____ لمن ضحّوا في سبيل عزّة الوطن وخلوده.", "bank": ["تقديره", "عرفانه", "نسيانه", "جحوده"]},
   {"blanks": [["تقديره"], ["عرفانه"]]}, Q4_EXPL, 0.5, "ar.comprehension.idea")
st("s12", "q4", "q4-e4", "multi", "ما البيتان الدّالّان على هذا الاعتراف؟ (اختر كلّ ما يصحّ)",
   {"options": ["البيت العاشر", "البيت الحادي عشر", "البيت الأوّل", "البيت الثّاني", "البيت السّادس"]},
   {"correct": [0, 1]}, Q4_EXPL, 0.5, "ar.comprehension.evidence")
Q5_EXPL = "الّذي يعنيه الشّاعر بقوله: «أنا للخلق قبلة» أنّ الجزائر صارت بثورتها العظيمة رمزًا للثّورة والتّضحية من أجل الحرّيّة."
st("s13", "q5", "q5-e1", "mcq", "ما الّذي يعنيه الشّاعر بقوله: «أنا للخلق قبلة»؟",
   {"options": ["أنّ الجزائر صارت بثورتها العظيمة رمزًا للثّورة والتّضحية من أجل الحرّيّة", "أنّ الجزائر صارت مقصدًا للسّيّاح لجمال طبيعتها",
                "أنّ الجزائر مركز تجاريّ تقصده الأمم", "أنّ الجزائر بلد يكثر فيه العبّاد والزّهّاد"]},
   {"correct": 0}, Q5_EXPL, 0.5, "ar.comprehension.explain")
st("s14", "q5", "q5-e1", "fill_blank", "أكمل المعنى:",
   {"text": "صارت الجزائر بثورتها العظيمة ____ للثّورة و____ من أجل الحرّيّة.", "bank": ["رمزًا", "التّضحية", "عائقًا", "التّبعيّة"]},
   {"blanks": [["رمزًا", "رمزا"], ["التّضحية"]]}, Q5_EXPL, 0.5, "ar.comprehension.explain", "b")
TYPE_EXPL = ("النّمط الغالب على النّصّ هو الوصف الّذي اتّخذ من الحوار نمطًا خادمًا له. من مؤشّراته: الإكثار من الصّفات والنّعوت – الإكثار من الأساليب "
             "الانفعاليّة – تحديد الزّمان والمكان – حشد المفردات الدّالّة على الحركة – كثرة الصّور البيانيّة – كثرة الأفعال الدّالّة على الحالات…")
st("s15", "q6", "q6-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["الوصف الّذي اتّخذ من الحوار نمطًا خادمًا له", "السّرد الّذي اتّخذ من الوصف نمطًا خادمًا له", "الحجاج", "التّفسير"]},
   {"correct": 0}, TYPE_EXPL, 1, "ar.text.type")
st("s16", "q6", "q6-e2", "multi", "أيّ ممّا يلي من مؤشّرات هذا النّمط في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الإكثار من الصّفات والنّعوت", "الإكثار من الأساليب الانفعاليّة", "تحديد الزّمان والمكان", "كثرة الصّور البيانيّة",
                "عرض الحجج والبراهين والاستدلال المنطقيّ", "توظيف المصطلحات العلميّة والتّعريفات"]},
   {"correct": [0, 1, 2, 3]}, TYPE_EXPL, 1, "ar.text.type")
SUM_SPEC = {"task": "تلخيص محتوى النّصّ بالأسلوب الخاصّ", "text": "قصيدة محمّد بلقاسم خمّار (بكالوريا 2014، آداب وفلسفة، الموضوع الأوّل)", "model_example": None}
SUM_EXPL = "التّلخيص: ويُراعى فيه المضمون (0.5)، تقنيات التّلخيص (1)، سلامة اللّغة (0.5). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for sid, eid, crit, ind, pts in [("s17", "q7-e1", "المضمون", "الوفاء بمضمون القصيدة", 0.5), ("s18", "q7-e2", "التّقنية", "احترام تقنيات التّلخيص", 1),
                                 ("s19", "q7-e3", "سلامة اللّغة", "سلامة اللّغة", 0.5)]:
    essay(sid, "q7", eid, "تلخيص محتوى قصيدة محمّد بلقاسم خمّار", crit, ind, pts, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s20", "q8", "q8-e1", "mcq", "بمَ توحي اللّفظتان «أسود» و«تزأر»؟",
   {"options": ["بالشّجاعة وشدّة البأس", "بالخوف والجبن", "بالضّعف والاستكانة", "بالهدوء والسّكينة"]},
   {"correct": 0}, "توحي لفظة «أسود»، ولفظة «تزأر» بالشّجاعة وشدّة البأس.", 0.5, "ar.comprehension.explain")
STY_EXPL = "«أيّها الشّهر»: إنشاء طلبيّ (نداء)، غرضه التّعظيم والتّقديس. «أنا شعب شعاره: \"أنا ثائر!!\"»: خبر، غرضه الفخر والاعتزاز."
st("s21", "q9", "q9-e1", "mcq", "ما نوع الأسلوب في «أيّها الشّهر»؟",
   {"options": ["إنشاء طلبيّ (نداء)", "خبر", "إنشاء طلبيّ (أمر)", "إنشاء غير طلبيّ (تعجّب)"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
st("s22", "q9", "q9-e2", "mcq", "ما الغرض البلاغيّ للنّداء في «أيّها الشّهر»؟",
   {"options": ["التّعظيم والتّقديس", "التّحسّر والتّوجّع", "التّوبيخ والتّقريع", "الاستغاثة"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.insha")
st("s23", "q9", "q9-e3", "mcq", "ما نوع الأسلوب في «أنا شعبٌ شعاره: \"أنا ثائر!!\"»؟",
   {"options": ["خبر", "إنشاء طلبيّ (نداء)", "إنشاء طلبيّ (أمر)", "إنشاء طلبيّ (استفهام)"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.style")
st("s24", "q9", "q9-e4", "mcq", "ما الغرض البلاغيّ في «أنا شعبٌ شعاره: \"أنا ثائر!!\"»؟",
   {"options": ["الفخر والاعتزاز", "الرّثاء", "الاستعطاف", "النّصح والإرشاد"]}, {"correct": 0}, STY_EXPL, 0.25, "ar.rhetoric.style")
IMG_EXPL = ("«لست أنسى أسودي»: استعارة تصريحيّة، شبّه أفراد جيش التّحرير بالأسود، وحذف المشبّه وصرّح بالمشبّه به، بلاغته: توضيح المعنى وتوكيده "
            "ونقله من المجرّد إلى المحسوس والمبالغة والإيجاز.")
st("s25", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في عبارة: «لست أنسى أسودي»؟",
   {"options": ["استعارة تصريحيّة", "استعارة مكنيّة", "تشبيه بليغ", "كناية عن صفة"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s26", "q10", "q10-e2", "fill_blank", "أكمل شرح الصّورة:",
   {"text": "شبّه أفراد جيش ____ بالأسود، وحذف ____ وصرّح بالمشبّه به.", "bank": ["التّحرير", "المشبّه", "العدوّ", "المشبّه به"]},
   {"blanks": [["التّحرير"], ["المشبّه"]]}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s27", "q10", "q10-e3", "mcq", "ما أثر الصّورة في المعنى؟",
   {"options": ["توضيح المعنى وتوكيده ونقله من المجرّد إلى المحسوس، والمبالغة والإيجاز", "تقديم الحقيقة مصحوبة بالدّليل عليها",
                "إحداث جرس موسيقيّ تطرب له الأذن", "إظهار المعنى بذكر ضدّه"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
st("s28", "q11", "q11-e1", "mcq", "ما إعراب «أنسا» في قوله: «عُمّ تلك الرّبوع أنسًا وروحا» (ب1)؟",
   {"options": ["تمييز منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول مطلق منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره",
                "نعت منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره", "ظرف منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "أنسًا: تمييز منصوب، وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.25, "ar.grammar.irab")
ASWAD_EXPL = ("أسودي: مفعول به منصوب وعلامة نصبه الفتحة المقدّرة منع من ظهورها اشتغال المحلّ بالحركة المناسبة وهو مضاف، والياء: ضمير متّصل مبنيّ "
              "في محلّ جرّ مضاف إليه.")
st("s29", "q11", "q11-e2", "mcq", "ما إعراب «أسود» من «أسودي» في قوله: «لستُ أنسى أسودي» (ب10)؟",
   {"options": ["مفعول به منصوب وعلامة نصبه الفتحة المقدّرة منع من ظهورها اشتغال المحلّ بالحركة المناسبة، وهو مضاف",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره، وهو مضاف",
                "فاعل مرفوع وعلامة رفعه الضّمّة المقدّرة منع من ظهورها اشتغال المحلّ بالحركة المناسبة، وهو مضاف",
                "مفعول به منصوب وعلامة نصبه الفتحة المقدّرة منع من ظهورها الثّقل، وهو مضاف"]},
   {"correct": 0}, ASWAD_EXPL, 0.25, "ar.grammar.irab")
st("s30", "q11", "q11-e2", "fill_blank", "أكمل إعراب الياء في «أسودي»:",
   {"text": "الياء: ضمير متّصل مبنيّ في محلّ ____ مضاف إليه.", "bank": ["جرّ", "نصب", "رفع"]},
   {"blanks": [["جرّ"]]}, ASWAD_EXPL, 0.25, "ar.grammar.irab", "b")
st("s31", "q11", "q11-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «أيّ عزم هاج الجزائر للحرب؟» (ب5)؟",
   {"options": ["جملة مقول قول في محلّ نصب مفعول به", "جملة في محلّ رفع خبر", "جملة في محلّ جرّ مضاف إليه", "جملة في محلّ رفع نعت"]},
   {"correct": 0}, "(أيّ عزم هاج الجزائر للحرب؟): جملة مقول قول في محلّ نصب مفعول به.", 0.5, "ar.grammar.sentence_case")
st("s32", "q11", "q11-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «تفتّحت للتّحرّر» في قوله: «وبذورٌ (تفتّحت للتّحرّر)» (ب9)؟",
   {"options": ["جملة فعليّة في محلّ رفع نعت", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "(تفتّحت): جملة فعليّة في محلّ رفع نعت.", 0.5, "ar.grammar.sentence_case")
st("s33", "q12", "q12-e1", "mcq", "ما معنى حرف الجرّ (الكاف) في «كالغيث»؟",
   {"options": ["التّشبيه", "التّعليل", "التّوكيد", "الاستعلاء"]}, {"correct": 0}, "«كالغيث»: الكاف هنا للتّشبيه.", 0.25, "ar.cohesion.connectors")
st("s34", "q12", "q12-e2", "mcq", "ما معنى حرف الجرّ (اللّام) في «هذه الأرض لي»؟",
   {"options": ["الملكيّة", "التّعليل", "انتهاء الغاية", "الظّرفيّة"]}, {"correct": 0}, "«هذه الأرض لي»: اللّام هنا للملكيّة.", 0.25, "ar.cohesion.connectors")
PRO_EXPL = ("التّقطيع العروضيّ: «هُنَاْكَ شَيْ / ئُنْ فِيْ نُفُوْ / سِنَاْ حَزِيْنْ» = //0//0 /0/0//0 //0//00 = مُتَفْعِلُنْ مُسْتَفْعِلُنْ مُتَفْعِلَانْ؛ "
            "«قَدْ يَخْتَفِيْ / وَلَاْ يَبِيْنْ» = /0/0//0 //0//00 = مُسْتَفْعِلُنْ مُتَفْعِلَانْ. السّطران من تفعيلة بحر الرّجز. "
            "(يطبع التّصحيح الرّموز بترتيب بصريّ من اليمين؛ كُتبت هنا من اليسار كالمعتاد.)")
st("s35", "q13", "q13-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر الأوّل «هُنَاكَ شَيْئٌ فِي نُفُوسِنَا حَزِينْ»:",
   {"text": "هُنَاْكَ شَيْ / ____ / ____", "bank": ["ئُنْ فِيْ نُفُوْ", "سِنَاْ حَزِيْنْ", "ءٌ فِي نُفُو", "سِنَا حَزِيْ"]},
   {"blanks": [["ئُنْ فِيْ نُفُوْ"], ["سِنَاْ حَزِيْنْ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s36", "q13", "q13-e1", "mcq", "ما رموز السّطر الأوّل وتفعيلاته؟",
   {"options": ["//0//0 /0/0//0 //0//00 = مُتَفْعِلُنْ مُسْتَفْعِلُنْ مُتَفْعِلَانْ", "/0/0//0 /0/0//0 /0/0//00 = مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلَانْ",
                "///0//0 ///0//0 ///0//00 = مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلَانْ", "//0//0 /0/0//0 //0//0 = مُتَفْعِلُنْ مُسْتَفْعِلُنْ مُتَفْعِلُنْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s37", "q13", "q13-e2", "fill_blank", "أكمل الكتابة العروضيّة للسّطر الثّاني «قَدْ يَخْتَفِي وَلَا يَبِينْ»:",
   {"text": "قَدْ يَخْتَفِيْ / ____", "bank": ["وَلَاْ يَبِيْنْ", "وَلَا يَبِيْ", "وَلَاْ يَبِيْنُوْ"]},
   {"blanks": [["وَلَاْ يَبِيْنْ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s38", "q13", "q13-e2", "mcq", "ما رموز السّطر الثّاني وتفعيلاته؟",
   {"options": ["/0/0//0 //0//00 = مُسْتَفْعِلُنْ مُتَفْعِلَانْ", "//0//0 //0//00 = مُتَفْعِلُنْ مُتَفْعِلَانْ", "/0/0//0 /0/0//0 = مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ",
                "/0//0 /0//00 = فَاعِلُنْ فَاعِلَانْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s39", "q13", "q13-e3", "mcq", "من تفعيلة أيّ بحر السّطران؟",
   {"options": ["الرّجز", "الكامل", "المتدارك", "الرّمل"]}, {"correct": 0}, PRO_EXPL, 0.5, "ar.prosody")
# ── ثالثًا: التّقويم النّقديّ ──
DEF_EXPL = ("الالتزام هو مشاركة الشّاعر أو الأديب النّاس همومهم الاجتماعيّة والسّياسيّة ومواقفهم الوطنيّة، والوقوف بحزم لمواجهة ما يتطلّبه ذلك، "
            "إلى حدّ إنكار الذّات في سبيل ما التزم به الشّاعر أو الأديب.")
st("s40", "q14", "q14-e1", "mcq", "ما المقصود بظاهرة «الالتزام» عند الشّعراء المعاصرين؟",
   {"options": ["مشاركة الشّاعر أو الأديب النّاس همومهم الاجتماعيّة والسّياسيّة ومواقفهم الوطنيّة، والوقوف بحزم لمواجهة ما يتطلّبه ذلك",
                "تقيّد الشّاعر بالوزن والقافية ونظام الشّطرين", "انصراف الأديب إلى التّعبير عن ذاته ومشاعره الخاصّة بمعزل عن قضايا مجتمعه",
                "اتّباع الأديب مذهب الفنّ للفنّ والجمال الخالص"]},
   {"correct": 0}, DEF_EXPL, 1, "ar.literature.trend")
st("s41", "q14", "q14-e1", "fill_blank", "أكمل تعريف الالتزام:",
   {"text": "الالتزام هو ____ الشّاعر أو الأديب النّاسَ همومهم الاجتماعيّة والسّياسيّة ومواقفهم الوطنيّة، والوقوف بـ____ لمواجهة ما يتطلّبه ذلك، إلى حدّ إنكار ____ في سبيل ما التزم به.",
    "bank": ["مشاركة", "حزم", "الذّات", "اعتزال", "تردّد", "الآخر"]},
   {"blanks": [["مشاركة"], ["حزم"], ["الذّات"]]}, DEF_EXPL, 1, "ar.literature.trend", "b")
FEAT_EXPL = ("من خصائصه: الكشف عن الواقع – محاولة تغيير الواقع بما يتطابق مع الخير والحقّ والعدل – اقتراح الحلول – مسؤوليّة الأدب عن الحرّيّة، "
             "وعن الاستعمار، وعن التّطوّر، وكذلك عن التّخلّف…")
st("s42", "q14", "q14-e2", "multi", "أيّ ممّا يلي من خصائص ظاهرة الالتزام؟ (اختر كلّ ما يصحّ)",
   {"options": ["الكشف عن الواقع", "محاولة تغيير الواقع بما يتطابق مع الخير والحقّ والعدل", "اقتراح الحلول", "مسؤوليّة الأدب عن الحرّيّة والتّطوّر",
                "الهروب من الواقع إلى عالم الخيال والأحلام", "الفصل بين الأدب وقضايا المجتمع"]},
   {"correct": [0, 1, 2, 3]}, FEAT_EXPL, 1, "ar.literature.features")
st("s43", "q14", "q14-e2", "fill_blank", "أكمل من خصائص الالتزام:",
   {"text": "الكشف عن ____ – محاولة ____ الواقع بما يتطابق مع الخير والحقّ والعدل – اقتراح ____.", "bank": ["الواقع", "تغيير", "الحلول", "الخيال", "تجميل", "الأوهام"]},
   {"blanks": [["الواقع"], ["تغيير"], ["الحلول"]]}, FEAT_EXPL, 1, "ar.literature.features", "b")

TITLE = "بكالوريا 2014 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (محمّد بلقاسم خمّار: على لسان الجزائر)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2014، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
         f"مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، قُرئت مصوّرة؛ التّقطيع بدقّة 300، والرّموز مكتوبة هنا من اليسار). "
         "«الأسئلة:» و«أوّلا- البناء الفكري» في فقرة واحدة في docx فأُخذ عنوان القسم وحده. "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. مؤجَّل (essay_builder): التّلخيص س7 (0.5 + 1 + 0.5).")
LOG_NOTE = ("تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ "
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
        "source_id": f"gdrive-{DOCX_ID}-p{PAPER}",
        "kind": "BAC", "year": 2014, "level": "3AS", "streams": STREAMS, "subject": "AR", "term": None, "paper": PAPER,
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
    "review_log": [{"at": "2026-10-29T14:00:00Z", "by": "claude", "action": "generated", "note": LOG_NOTE}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
