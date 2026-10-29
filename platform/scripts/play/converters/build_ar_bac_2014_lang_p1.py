"""Conversion: BAC 2014 (session عاديّة، جوان 2014) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة – الموضوع الأوّل (أحمد عبد المعطي حجازي، «سلّة ليمون»).
Exam (most faithful source): gdrive 17jJ_DC865rbddKGOYRwoJr0i7nMc_Pch (بكالوريا العربية 2014 شعبة لغات اجنبية.docx);
same paper as PDF (owner's copy): gdrive 1F0Kf1tm1LkjDB9tRUMULJDblHDPrgTqC;
official ONEC paper: gdrive 1ioZ1jh6ZyOb8gJ-R6SaDk9a7VwhJJ1jk (01_الموضوع.pdf, pages 1–2, image-only — rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1HlxuFWzwAMga-_RcnuUV-1AKs7TnZizl (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2014_sci_p1.py / build_ar_bac_2015_sci_p1.py): PARAS / POEM_RAW below were generated from the .docx with
python-docx (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed; the free-verse
poem sits in a two-cell table — right cell then left cell — kept line by line) and every verbatim string of the JSON was
re-checked programmatically against the docx. The docx was compared line by line with the official ONEC paper (rendered at
130 dpi): same 26 lines, same «***» stanza breaks, same questions. The mark scheme was read from the rendered pages (150 dpi;
the scansion at 300 dpi; the scheme prints the prosody symbols in visual right-to-left order — written here left-to-right).
Every mark comes from the official scheme; correct options and explanations condense its wording.

Docx defect fixed from the ONEC paper (PATCHES below): the last line of the poem reads «فَتذَكَّرَت القريه!» (fatha on the
ر = «she remembered») where the ONEC paper has «فَتَذَكَّرتُ القريَه !» and Q5 quotes «فتذكّرتُ القريه!» ⇒ «فَتذَكَّرتُ القريه!».
Other differences are labels («الشرح اللغوي» vs «شرح المفردات», «ثالثا- التّقويم النقدي» vs «… النّقديّ للنّصّ») — docx kept.

Conversion notes / points for the owner's review:
- Streams: لغات أجنبيّة only (ONEC paper and correction headers) ⇒ LANG.
- The poem is cut at its two «***» breaks into three stanza documents (the «***» lines are separators, not text);
  «السّطر الثّامن» of the scheme = «سابحةً في أمواج الظّلّ» (counted without the separators) — consistent.
- Q1 «01», Q2 «01», Q4 «01.5», Q5 «01», Q6 «01»: one element each. Q3 «01.5 + 01» = the poet's vision of the city / the
  supporting expressions. Q7 «0.5 + 2×0.75» = the type (السّرديّ) / time / place.
- No summary in this paper (Q7 is the text type) ⇒ the only deferred-free set of 2014 LANG part 1.
- Part 2: Q1 «2×0.5» = the imperative with its vocalisation / the reason (همزة الوصل). Q2, Q3 «2×0.5» one element per item.
  Q4 «0.25 + 0.25 + 0.5» = style / kind / purpose. Q5 «3×0.25» = explanation / type / effect; the scheme accepts another
  استعارة مكنيّة in «سابحة» («وفي هذه الحال تقبل إجابته») ⇒ no استعارة distractor on the type, and the explanation step
  is a completion of the model reading only. Q6: «0.5» per line (writing; symbols and feet) + «0.25» the metre (المتدارك).
  The scheme names the feet «فعلن… فعلان» without vowels; the options vowel them from the scheme's own symbols
  (///0 = فَعِلُنْ، /0/0 = فَعْلُنْ).
- Part 3 «2×0.75 + 2×0.75 + 2×0.5» = for each of the critic's three claims (أ، ب، ج): how the poem embodies it / the
  supporting quotation ⇒ six interactive elements (closed model answer).
- Distractors avoid what usage could accept: no «تشبيه بليغ» for «سابحة في أمواج الظّلّ» (إضافة المشبّه به), no «الوصفيّ»
  for the type, no «الخبب» for the metre, no «استئنافيّة»/«حال»/«خبر» for the two sentences, no «التّعجّب»/«الإنكار» for
  the purpose of «من روّعها؟».
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2014-lang-p1"
PAPER = 1
STREAMS = ["LANG"]
DOCX_ID = "17jJ_DC865rbddKGOYRwoJr0i7nMc_Pch"
DOCX_TITLE = "بكالوريا العربية 2014 شعبة لغات اجنبية.docx"
PDF_ID = "1F0Kf1tm1LkjDB9tRUMULJDblHDPrgTqC"
OFFICIAL_ID = "1ioZ1jh6ZyOb8gJ-R6SaDk9a7VwhJJ1jk"
CORR_ID = "1HlxuFWzwAMga-_RcnuUV-1AKs7TnZizl"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx؛ رقم الفقرة في docx) ──
PARAS = {
    2: "الشرح اللغوي:    الغَبَشُ: بقية الليل، أو ظلْمَةُ آخِرِه.      الطَّلُّ: المَطَرُ الضعيفُ، أو أَخفُّ المطرِ.",
    3: "القرش: عملة مصريّة.",
    4: "الأسئلة:  أوّلا- البناء الفكري: (10 نقاط)",
    5: "رصد الشّاعر مشهداً يومياً، فيمَ تمثّل؟",
    6: "عَمَّ يُعبر لك ذلك المشهد؟",
    7: "وضّح رؤية الشّاعر إلى المدينة من خلال النص، مُدعّماً إجابتك بعبارات منه.",
    8: "ما الدلالة الإنسانيّة التي تحملها عبارة: «والولد الأسمرُ يجري، لا يلحقُ بالسيّارات»؟",
    9: "بِم يوحي قول الشَّاعر: «فتذكّرتُ القريه!»؟",
    10: "النّص رسالةٌ من الشاعر إلى مجتمع المدينة. ما مضمون هذه الرسالة؟",
    11: "حدّد النّمط النّصي الذي اعتمده الشاعر، ثمّ حلله من حيث الزّمان والمكان.",
    12: "ثانيا- البناء اللّغوي: (06 نقاط)",
    13: "صُغ فعل الأمر من الفعل «يَلْحَق» مع المخاطب المفرد، ثم اضبط حركة النّطق به مبيّنا السبب.",
    14: "أعرب ‏-إعراب مفردات - ‏ كلمة «سابحة» الواردة في قول الشاعر: «سابحة في أمواج الظّل»،",
    15: "وكلمة «تمشي» في قوله: «تمشي بحريق البنزين»",
    16: "بين محلّ الجملتين التاليتين من الإعراب:",
    17: "- «عشرون بقرش» الواردة في المقطع الأوّل.           -«جاعت» الواردة في المقطع الثاني.",
    18: "ما الأسلوب البلاغيّ في قول الشاعر: «من روّعها»؟ بيّن نوعه وغرضه البلاغي.",
    19: "في قول الشاعر: «سابحة في أمواج الظل» صورة بيانيّة. اشرحها، مبيّنا نوعها وأثرها البلاغي.",
    20: "قطع السَّطرين التاليين تقطيعا عروضيا، محدّدًا التفعيلات والبحر:",
    21: "حَملتْها في غَبَشِ الإصبَاح",
    22: "لِشوارعَ مُختنقاتٍ، مُزدحمَاتْ",
    23: "ثالثا- التّقويم النقدي: (04 نقاط)",
    24: "يقول الناقد إيليا الحاوي: «القصيدة المعاصرة ليست نزوة طرب عابرة وإنما هي حالةٌ تدلهم فيها التجارب...، فقد تلْقى الشّاعر في القصيدة يعاني الفشل والضياع والشعور بالتفاهة...، ويظل هذا الشعور يتداول نفسه ويتمزّق فيها، فيبعثه على التأمّل متنازعاً البقاء في قلق ولا استقرار وينتهي حيناً إلى يأس من الإنسان والحضارة...».",
    25: "المطلوب: إلى أي مدى جسّدت قصيدة عبد المعطي حجازي هذا الحكم؟ دعم إجابتك بعبارات من النّص.",
}
# الجدول 0 في docx: خليّتان (اليمنى ثمّ اليسرى)، سطرًا سطرًا
POEM_RAW = [
    ["النّـــــص:\nسلَّةُ لَيمونْ!\nتحت شُعَاع الشَّمس المَسنُونْ\nوالولدُ يُنَادي بالصّوت المحزونْ\n«(عِشرون بقرش)\nبالقرش الواحِد عشرون!»\n                       ***\nسَلَّةُ ليمون، غَادَرت القَرية في الفَجْرْ\nخضراءَ، مُندَّاة بالطَّلّ\nسابحةً في أمواج الظّلّ\nكانت في غفوتِهَا الخضراء عروس الطَّيرْ\nأوَّاهِ!\nمَن رَوَّعَهَا؟\nأيُّ يدٍ (جَاعَتْ)، قطَفَتْهَا هَذَا الفجرْ!\nحَمَلَتْها في غبَشِ الإصبَاح", "لِشَوارع مُختنقاتٍ، مُزدحمَاتْ،\nأقدامٌ لا تتوقَّف، سيّاراتْ!\nتمشي بحريق البنزينْ!\nمِسكينْ!\nلا أَحَد يشُمُّك يا لَيمُونْ!\nوالشَّمسُ تُجَفّف طَلّك يا لَيمونْ!\nوالوَلدُ الأسمَرُ يَجري، لا يلحقُ بالسيَّارات\n«عشرون بقرش\nبالقرشِ الواحِد عِشرونْ!»\n                          ***\nسَلَّة لَيمونْ!\nتحت شُعَاع الشَّمس المَسْنونْ\nوَقَعَتْ فيها عَيْني،\nفَتذَكَّرَت القريه!\n\n     الشَّاعر: أحمد عبد المعطي حجازي\n ديوان أحمد عبد المعطي حجازي ص125..127\n   - دار العودة -‏ بيروت لبنان ط 1982-"],
]
_STRIP = " \t‎‏ "
LINES = [ln.strip(_STRIP) for ln in (POEM_RAW[0][0] + "\n" + POEM_RAW[0][1]).split("\n")]
assert LINES[0] == "النّـــــص:" and LINES.count("***") == 2 and LINES.count("") == 1
_i1 = LINES.index("***"); _i2 = LINES.index("***", _i1 + 1); _ib = LINES.index("")
STANZAS = [LINES[1:_i1], LINES[_i1 + 1:_i2], LINES[_i2 + 1:_ib]]
REF = LINES[_ib + 1:]
# عيب docx مصحَّح من الموضوع الرّسميّ: «فَتذَكَّرَت» ⇐ «فَتذَكَّرتُ»
PATCHES = [(2, -1, "رَت القريه!", "رتُ القريه!")]
for _s, _l, _old, _new in PATCHES:
    assert STANZAS[_s][_l].count(_old) == 1, (_s, _l, _old)
    STANZAS[_s][_l] = STANZAS[_s][_l].replace(_old, _new)
assert [len(s) for s in STANZAS] == [5, 17, 4] and len(REF) == 3
assert STANZAS[1][2].startswith("سابحة") and (STANZAS[0] + STANZAS[1])[7].startswith("سابحة")  # «السّطر الثّامن»
assert "(جَاعَتْ)" in STANZAS[1][6] and STANZAS[0][3].startswith("«(عِشرون")

J = lambda *ix: "\n".join(PARAS[i] for i in ix)
PART1 = re.split(r"\s{2,}", PARAS[4], maxsplit=1)[1]  # «الأسئلة:» و«أوّلا- البناء الفكري» في فقرة واحدة في docx
P1, P2, P3 = PART1, PARAS[12], PARAS[23]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
DOCS = [
    {"id": "d-st1", "kind": "text", "caption": "المقطع الأوّل", "text": "\n".join(STANZAS[0])},
    {"id": "d-st2", "kind": "text", "caption": "المقطع الثّاني", "text": "\n".join(STANZAS[1])},
    {"id": "d-st3", "kind": "text", "caption": "المقطع الثّالث", "text": "\n".join(STANZAS[2])},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": "\n".join(REF)},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": J(2, 3)},
]
CRIT_DOCS = DOCS + [{"id": "d-crit", "kind": "text", "caption": "القول", "text": PARAS[24]}]

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



q("q1", "1", P1, J(5), 1, [el("q1-e1", "المشهد اليوميّ الّذي رصده الشّاعر", 1)])
q("q2", "2", P1, J(6), 1, [el("q2-e1", "ما يعبّر عنه المشهد", 1)])
q("q3", "3", P1, J(7), 2.5, [el("q3-e1", "رؤية الشّاعر إلى المدينة", 1.5), el("q3-e2", "العبارات الدّاعمة", 1)])
q("q4", "4", P1, J(8), 1.5, [el("q4-e1", "الدّلالة الإنسانيّة للعبارة", 1.5)])
q("q5", "5", P1, J(9), 1, [el("q5-e1", "إيحاء «فتذكّرت القرية»", 1)])
q("q6", "6", P1, J(10), 1, [el("q6-e1", "مضمون رسالة الشّاعر", 1)])
q("q7", "7", P1, J(11), 2, [el("q7-e1", "النّمط النّصّيّ", 0.5), el("q7-e2", "تحليله من حيث الزّمان", 0.75), el("q7-e3", "تحليله من حيث المكان", 0.75)])
q("q8", "1", P2, J(13), 1, [el("q8-e1", "صياغة فعل الأمر وضبطه", 0.5), el("q8-e2", "السّبب", 0.5)])
q("q9", "2", P2, J(14, 15), 1, [el("q9-e1", "إعراب «سابحة»", 0.5), el("q9-e2", "إعراب «تمشي»", 0.5)])
q("q10", "3", P2, J(16, 17), 1, [el("q10-e1", "محلّ جملة «عشرون بقرش»", 0.5), el("q10-e2", "محلّ جملة «جاعت»", 0.5)])
q("q11", "4", P2, J(18), 1, [el("q11-e1", "الأسلوب البلاغيّ", 0.25), el("q11-e2", "نوعه", 0.25), el("q11-e3", "غرضه البلاغيّ", 0.5)])
q("q12", "5", P2, J(19), 0.75, [el("q12-e1", "شرح الصّورة", 0.25), el("q12-e2", "نوعها", 0.25), el("q12-e3", "أثرها البلاغيّ", 0.25)])
q("q13", "6", P2, J(20, 21, 22), 1.25, [el("q13-e1", "تقطيع السّطر الأوّل وتفعيلاته", 0.5), el("q13-e2", "تقطيع السّطر الثّاني وتفعيلاته", 0.5),
                                        el("q13-e3", "البحر", 0.25)])
q("q14", "المطلوب", P3, J(25), 4,
  [el("q14-e1", "أ- تجسيد «حالة تدلهمّ فيها التّجارب»", 0.75), el("q14-e2", "أ- العبارات الدّالّة", 0.75),
   el("q14-e3", "ب- تجسيد «معاناة الفشل والضّياع والشّعور بالتّفاهة»", 0.75), el("q14-e4", "ب- العبارات الدّالّة", 0.75),
   el("q14-e5", "ج- تجسيد «اليأس من الإنسان والحضارة»", 0.5), el("q14-e6", "ج- العبارات الدّالّة", 0.5)], docs=CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = "تمثّل المشهد اليوميّ في ذلك الطّفل البائع للّيمون وهو يلاحق السّيّارات والمارّة في الشّارع."
st("s01", "q1", "q1-e1", "mcq", "رصد الشّاعر مشهدًا يوميًّا، فيمَ تمثّل؟",
   {"options": ["في الطّفل البائع للّيمون وهو يلاحق السّيّارات والمارّة في الشّارع", "في فلّاح يقطف اللّيمون من حقله فجرًا",
                "في ازدحام السّيّارات أمام محطّة للبنزين", "في أطفال يلعبون في ساحة القرية"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "تمثّل المشهد اليوميّ في ذلك ____ البائع للّيمون وهو ____ السّيّارات والمارّة في الشّارع.", "bank": ["الطّفل", "يلاحق", "الشّيخ", "يتجنّب"]},
   {"blanks": [["الطّفل"], ["يلاحق"]]}, Q1_EXPL, 0.5, "ar.comprehension.idea", "b")
st("s03", "q2", "q2-e1", "mcq", "عمَّ يعبّر لك ذلك المشهد؟",
   {"options": ["عن المعاناة اليوميّة للفرد البسيط في المدينة", "عن رفاهية الحياة في المدينة", "عن جمال الرّيف وهدوئه", "عن ازدهار التّجارة في المدينة"]},
   {"correct": 0}, "يعبّر ذلك المشهد عن المعاناة اليوميّة للفرد البسيط في المدينة.", 1, "ar.comprehension.explain")
Q3_EXPL = ("رؤية الشّاعر إلى المدينة من خلال نصّه: الفرد في خضمّها كائن ضئيل، ضائع مغترب عن ذاته وعن طبيعته الأساسيّة، تمزّقت فيها العلاقات الإنسانيّة، "
           "وانهارت القيم المثلى، ضاع الإنسان في غمرتها وزحمتها، وسدّت آذانها عن سماع أصوات الضّعف والألم والاستغاثة الّتي تنبعث من المقهورين فيها. "
           "العبارات: «لشوارع مختنقات، مزدحمات، أقدام لا تتوقّف، سيّارات تمشي بحريق البنزين، مسكين، الولد الأسمر يجري، لا يلحق بالسّيّارات، لا أحد يشمّك يا ليمون.»")
st("s04", "q3", "q3-e1", "multi", "ما رؤية الشّاعر إلى المدينة من خلال النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الفرد في خضمّها كائن ضئيل، ضائع مغترب عن ذاته وعن طبيعته الأساسيّة", "تمزّقت فيها العلاقات الإنسانيّة وانهارت القيم المثلى",
                "سدّت آذانها عن سماع أصوات الضّعف والألم والاستغاثة", "مكان تسوده الرّحمة والتّكافل بين النّاس", "فضاء يحقّق فيه الفقير أحلامه بسهولة"]},
   {"correct": [0, 1, 2]}, Q3_EXPL, 0.75, "ar.comprehension.idea")
st("s05", "q3", "q3-e1", "fill_blank", "أكمل رؤية الشّاعر إلى المدينة:",
   {"text": "ضاع الإنسان في ____ وزحمتها، وسدّت آذانها عن سماع أصوات الضّعف والألم و____ الّتي تنبعث من المقهورين فيها.",
    "bank": ["غمرتها", "الاستغاثة", "هدوئها", "الفرح"]},
   {"blanks": [["غمرتها"], ["الاستغاثة"]]}, Q3_EXPL, 0.75, "ar.comprehension.idea", "b")
st("s06", "q3", "q3-e2", "multi", "أيّ العبارات الآتية تدعم بها هذه الرّؤية؟ (اختر كلّ ما يصحّ)",
   {"options": ["«لشوارعَ مختنقاتٍ، مزدحماتْ»", "«أقدامٌ لا تتوقّف، سيّاراتْ!»", "«تمشي بحريق البنزينْ!»", "«لا أحد يشمّك يا ليمونْ!»",
                "«خضراءَ، مندّاة بالطّلّ»", "«كانت في غفوتها الخضراء عروس الطّيرْ»"]},
   {"correct": [0, 1, 2, 3]}, Q3_EXPL + " أمّا «خضراء، مندّاة بالطّلّ» و«عروس الطّير» فوصف للسّلّة في القرية.", 1, "ar.comprehension.evidence")
Q4_EXPL = ("الدّلالة الإنسانيّة لعبارة «والولد يجري لا يلحق بالسّيّارات..»: هي انهيار القيم الاجتماعيّة (برودة المشاعر، تفكّك العلاقات الاجتماعيّة، "
           "الاغتراب، غياب روح التّكافل والتّلاحم..).")
st("s07", "q4", "q4-e1", "mcq", "ما الدّلالة الإنسانيّة الّتي تحملها عبارة: «والولد الأسمر يجري، لا يلحق بالسّيّارات»؟",
   {"options": ["انهيار القيم الاجتماعيّة: برودة المشاعر وتفكّك العلاقات والاغتراب وغياب روح التّكافل", "نشاط الطّفل وحيويّته وحبّه للّعب",
                "سرعة الحياة الحديثة وتطوّر وسائل النّقل", "حرص الطّفل على الدّراسة والتّعلّم"]},
   {"correct": 0}, Q4_EXPL, 0.75, "ar.comprehension.values")
st("s08", "q4", "q4-e1", "fill_blank", "أكمل الدّلالة:",
   {"text": "انهيار القيم ____: برودة المشاعر، تفكّك العلاقات الاجتماعيّة، ____، غياب روح التّكافل والتّلاحم.",
    "bank": ["الاجتماعيّة", "الاغتراب", "الاقتصاديّة", "الاندماج"]},
   {"blanks": [["الاجتماعيّة"], ["الاغتراب"]]}, Q4_EXPL, 0.75, "ar.comprehension.values", "b")
st("s09", "q5", "q5-e1", "mcq", "بمَ يوحي قول الشّاعر: «فتذكّرتُ القريه!»؟",
   {"options": ["بالشّوق والحنين إلى الرّيف لما فيه من قيم اجتماعيّة إنسانيّة ومبادئ سامية تفتقر إليها المدينة", "بالنّفور من الرّيف وقسوة الحياة فيه",
                "بالرّغبة في بيع اللّيمون في القرية", "بالفرح بمغادرة القرية إلى المدينة"]},
   {"correct": 0}, "يوحي قول الشّاعر: «فتذكّرت القرية..» بالشّوق والحنين إلى الرّيف لما فيه من قيم اجتماعيّة إنسانيّة ومبادئ سامية تفتقر إليها المدينة.",
   1, "ar.comprehension.emotion")
Q6_EXPL = "مضمون رسالة الشّاعر إلى مجتمع المدينة: الدّعوة إلى بعث القيم الاجتماعيّة الإنسانيّة (التّكافل، التّراحم، والتّعاون، والإحساس بالضّعفاء والمحرومين…)."
st("s10", "q6", "q6-e1", "mcq", "ما مضمون رسالة الشّاعر إلى مجتمع المدينة؟",
   {"options": ["الدّعوة إلى بعث القيم الاجتماعيّة الإنسانيّة", "الدّعوة إلى الهجرة من الرّيف إلى المدينة", "الدّعوة إلى الإسراع في وتيرة الحياة",
                "الدّعوة إلى تشغيل الأطفال في الشّوارع"]},
   {"correct": 0}, Q6_EXPL, 0.5, "ar.comprehension.purpose")
st("s11", "q6", "q6-e1", "fill_blank", "أكمل القيم الّتي يدعو الشّاعر إلى بعثها:",
   {"text": "التّكافل، ____، والتّعاون، والإحساس بـ____ والمحرومين.", "bank": ["التّراحم", "الضّعفاء", "التّنافس", "الأقوياء"]},
   {"blanks": [["التّراحم"], ["الضّعفاء"]]}, Q6_EXPL, 0.5, "ar.comprehension.values", "b")
TYPE_EXPL = "النّمط النّصّيّ الّذي وظّفه الشّاعر هو النّمط السّرديّ. الزّمان: الفجر، غبش الإصباح، وضح النّهار. المكان: القرية ثمّ المدينة."
st("s12", "q7", "q7-e1", "mcq", "ما النّمط النّصّيّ الّذي اعتمده الشّاعر؟",
   {"options": ["السّرديّ", "الحجاجيّ", "التّفسيريّ", "الحواريّ"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s13", "q7", "q7-e2", "multi", "حلّله من حيث الزّمان: أيّ ممّا يلي من الأزمنة في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الفجر", "غبش الإصباح", "وضح النّهار", "منتصف اللّيل", "الغروب"]},
   {"correct": [0, 1, 2]}, TYPE_EXPL, 0.75, "ar.text.type")
st("s14", "q7", "q7-e3", "mcq", "حلّله من حيث المكان:",
   {"options": ["القرية ثمّ المدينة", "المدينة ثمّ القرية", "القرية وحدها", "المدينة وحدها"]}, {"correct": 0}, TYPE_EXPL, 0.75, "ar.text.type")
# ── ثانيًا: البناء اللّغويّ ──
AMR_EXPL = "صياغة فعل الأمر من الفعل «يلحق»: يَلْحَقُ ← لْحَقْ ← اِلْحَقْ. السّبب: إضافة همزة وصل في بداية فعل الأمر للتّوصّل إلى النّطق بالسّاكن لأنّ العرب لا تبدأ بساكن."
st("s15", "q8", "q8-e1", "mcq", "صُغ فعل الأمر من الفعل «يَلْحَق» مع المخاطب المفرد مضبوطًا.",
   {"options": ["اِلْحَقْ", "لْحَقْ", "أَلْحِقْ", "اُلْحُقْ"]}, {"correct": 0}, AMR_EXPL, 0.5, "ar.morphology")
st("s16", "q8", "q8-e2", "fill_blank", "أكمل السّبب:",
   {"text": "إضافة همزة ____ في بداية فعل الأمر للتّوصّل إلى النّطق بـ____ لأنّ العرب لا تبدأ بساكن.", "bank": ["وصل", "السّاكن", "قطع", "المتحرّك"]},
   {"blanks": [["وصل"], ["السّاكن"]]}, AMR_EXPL, 0.5, "ar.morphology")
st("s17", "q9", "q9-e1", "mcq", "ما إعراب «سابحة» في قول الشّاعر: «سابحةً في أمواج الظّلّ»؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة على الآخر", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على الآخر",
                "تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على الآخر", "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة على الآخر"]},
   {"correct": 0}, "سابحة: حال منصوبة وعلامة نصبها الفتحة الظّاهرة على الآخر.", 0.5, "ar.grammar.irab")
st("s18", "q9", "q9-e2", "mcq", "ما إعراب «تمشي» في قوله: «تمشي بحريق البنزين»؟",
   {"options": ["فعل مضارع مرفوع، وعلامة رفعه الضّمّة المقدّرة على آخره منع من ظهورها الثّقل",
                "فعل مضارع مرفوع، وعلامة رفعه الضّمّة المقدّرة على آخره منع من ظهورها التّعذّر",
                "فعل مضارع مرفوع، وعلامة رفعه الضّمّة الظّاهرة على آخره", "فعل مضارع مجزوم، وعلامة جزمه حذف حرف العلّة"]},
   {"correct": 0}, "تمشي: فعل مضارع مرفوع، وعلامة رفعه الضّمّة المقدّرة على آخره منع من ظهورها الثّقل.", 0.5, "ar.grammar.irab")
st("s19", "q10", "q10-e1", "mcq", "ما المحلّ الإعرابيّ لجملة «عشرون بقرش» الواردة في المقطع الأوّل؟",
   {"options": ["جملة مقول القول للفعل «ينادي» في محلّ نصب مفعول به", "جملة في محلّ رفع خبر", "جملة في محلّ جرّ نعت", "جملة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "عشرون بقرش: جملة مقول القول للفعل ينادي في محلّ نصب مفعول به.", 0.5, "ar.grammar.sentence_case")
st("s20", "q10", "q10-e2", "mcq", "ما المحلّ الإعرابيّ لجملة «جاعت» في قوله: «أيُّ يدٍ (جاعتْ)، قطفتها هذا الفجر!»؟",
   {"options": ["جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة في محلّ نصب مفعول به", "جملة صلة الموصول لا محلّ لها من الإعراب",
                "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "جاعت: جملة فعليّة في محلّ جرّ نعت.", 0.5, "ar.grammar.sentence_case")
ISTF_EXPL = "الأسلوب البلاغيّ في قول الشّاعر: «من روّعها؟» إنشائيّ طلبيّ. نوعه: استفهام. غرضه: إظهار الأسف والحسرة."
st("s21", "q11", "q11-e1", "mcq", "ما الأسلوب البلاغيّ في قول الشّاعر: «من روّعها؟»؟",
   {"options": ["إنشائيّ طلبيّ", "خبريّ", "إنشائيّ غير طلبيّ"]}, {"correct": 0}, ISTF_EXPL, 0.25, "ar.rhetoric.insha")
st("s22", "q11", "q11-e2", "mcq", "ما نوع هذا الأسلوب؟",
   {"options": ["استفهام", "نداء", "أمر", "تمنٍّ"]}, {"correct": 0}, ISTF_EXPL, 0.25, "ar.rhetoric.insha")
st("s23", "q11", "q11-e3", "mcq", "ما غرضه البلاغيّ؟",
   {"options": ["إظهار الأسف والحسرة", "التّعظيم والتّقديس", "التّهديد والوعيد", "الأمر والإلزام"]}, {"correct": 0}, ISTF_EXPL, 0.5, "ar.rhetoric.insha")
IMG_EXPL = ("الصّورة البيانيّة في السّطر الثّامن هي: «سابحة في أمواج الظّلّ». شرحها: شبّه الشّاعر الظّلّ بالبحر، فذكر المشبّه وحذف المشبّه به، وأبقى على ما يدلّ "
            "عليه (سابحة) و(أمواج). نوعها: استعارة مكنيّة. وجه بلاغتها: توضيح المعنى، وتقريب الفكرة والتّأكيد على صحّتها بواسطة التّمثيل. "
            "(ملحوظة التّصحيح: يمكن أن يتّجه المترشّح إلى صورة أخرى في عبارة «سابحة..» باعتبارها استعارة مكنيّة أخرى، وفي هذه الحال تقبل إجابته.)")
st("s24", "q12", "q12-e1", "fill_blank", "أكمل شرح الصّورة في «سابحة في أمواج الظّلّ» كما وردت في الإجابة النّموذجيّة:",
   {"text": "شبّه الشّاعر ____ بالبحر، فذكر المشبّه وحذف المشبّه به، وأبقى على ما يدلّ عليه (سابحة) و(____).", "bank": ["الظّلّ", "أمواج", "الطّير", "الفجر"]},
   {"blanks": [["الظّلّ"], ["أمواج"]]}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s25", "q12", "q12-e2", "mcq", "ما نوع الصّورة في «سابحة في أمواج الظّلّ»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "كناية عن صفة", "مجاز مرسل علاقته المحلّيّة"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.metaphor")
st("s26", "q12", "q12-e3", "mcq", "ما أثرها البلاغيّ؟",
   {"options": ["توضيح المعنى، وتقريب الفكرة والتّأكيد على صحّتها بواسطة التّمثيل", "تقديم الحقيقة مصحوبة بالدّليل عليها",
                "إحداث جرس موسيقيّ تطرب له الأذن", "إبراز التّضادّ بين معنيين متقابلين"]}, {"correct": 0}, IMG_EXPL, 0.25, "ar.rhetoric.effect")
PRO_EXPL = ("التّقطيع (الإجابة النّموذجيّة): «حَمَلَتْ / هَاْ فِيْ / غَبَشِلْ / إِصْبَاْحْ» = ///0 /0/0 ///0 /0/00 = فعلن فعلن فعلن فعلان؛ "
            "«لِشَوَا / رِعَمُخْ / تَنِقَا / تِنْمُزْ / دَحِمَاتْ» = ///0 ///0 ///0 /0/0 ///00 = فعلن فعلن فعلن فعلن فعلان؛ بحر المتدارك. "
            "(///0 = فَعِلُنْ، /0/0 = فَعْلُنْ؛ يطبع التّصحيح الرّموز بترتيب بصريّ من اليمين، كُتبت هنا من اليسار.)")
st("s27", "q13", "q13-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر «حَملتْها في غَبَشِ الإصبَاح»:",
   {"text": "حَمَلَتْ / ____ / ____ / إِصْبَاْحْ", "bank": ["هَاْ فِيْ", "غَبَشِلْ", "هَا فِي غَ", "غَبَشِ الْ"]},
   {"blanks": [["هَاْ فِيْ"], ["غَبَشِلْ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s28", "q13", "q13-e1", "mcq", "ما رموز السّطر الأوّل وتفعيلاته؟",
   {"options": ["///0 /0/0 ///0 /0/00 = فَعِلُنْ فَعْلُنْ فَعِلُنْ فَعْلَانْ", "/0//0 /0//0 /0//0 /0//00 = فَاعِلُنْ فَاعِلُنْ فَاعِلُنْ فَاعِلَانْ",
                "//0/0 //0/0 //0/0 //0/0 = فَعُولُنْ فَعُولُنْ فَعُولُنْ فَعُولُنْ", "///0 ///0 ///0 ///00 = فَعِلُنْ فَعِلُنْ فَعِلُنْ فَعِلَانْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s29", "q13", "q13-e2", "fill_blank", "أكمل الكتابة العروضيّة للسّطر «لِشوارعَ مُختنقاتٍ، مُزدحمَاتْ»:",
   {"text": "لِشَوَا / ____ / تَنِقَا / ____ / دَحِمَاتْ", "bank": ["رِعَمُخْ", "تِنْمُزْ", "رِعَ مُخْ تَ", "تِنْ مُزْدَ"]},
   {"blanks": [["رِعَمُخْ"], ["تِنْمُزْ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s30", "q13", "q13-e2", "mcq", "ما رموز السّطر الثّاني وتفعيلاته؟",
   {"options": ["///0 ///0 ///0 /0/0 ///00 = فَعِلُنْ فَعِلُنْ فَعِلُنْ فَعْلُنْ فَعِلَانْ", "///0 ///0 ///0 ///0 ///00 = فَعِلُنْ فَعِلُنْ فَعِلُنْ فَعِلُنْ فَعِلَانْ",
                "/0//0 /0//0 /0//0 /0//0 /0//00 = فَاعِلُنْ فَاعِلُنْ فَاعِلُنْ فَاعِلُنْ فَاعِلَانْ", "///0 /0/0 ///0 /0/0 ///00 = فَعِلُنْ فَعْلُنْ فَعِلُنْ فَعْلُنْ فَعِلَانْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s31", "q13", "q13-e3", "mcq", "ما بحر السّطرين؟",
   {"options": ["المتدارك", "الرّجز", "الكامل", "الرّمل"]}, {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
# ── ثالثًا: التّقويم النّقديّ ──
CRIT_A = ("لقد جسّدت القصيدة حكم النّاقد إيليا الحاوي: أ- القصيدة المعاصرة حالة تدلهمّ فيها التّجارب، يظهر ذلك في التّجربة القاسية للطّفل البائع الجوّال "
          "وما يلقاه من عنت في تحصيل قوته اليوميّ. «الولد الأسمر يجري، لا يلحق بالسّيّارات… الولد ينادي بالصّوت المحزون عشرون بقرش..»")
CRIT_B = ("ب- معاناة الفشل والضّياع والشّعور بالتّفاهة: ويظهر ذلك في عالم المدينة المزدحم والمشغول أهله بالهموم اليوميّة، ممّا أفقدهم رابط الإنسانيّة بينهم، "
          "كما يتجسّد في فشل الطّفل في بيع بضاعته. «مسكين… لا أحد يشمّك يا ليمون..»")
CRIT_C = ("ج- اليأس من الإنسان والحضارة: ويظهر ذلك في الشّعور بالاغتراب في المدينة نتيجة فقدان القيم الاجتماعيّة الإنسانيّة. "
          "«أقدام لا تتوقّف… سيّارات تمشي بحريق البنزين..»")
st("s32", "q14", "q14-e1", "mcq", "كيف جسّدت القصيدة أنّ «القصيدة المعاصرة حالة تدلهمّ فيها التّجارب»؟",
   {"options": ["في التّجربة القاسية للطّفل البائع الجوّال وما يلقاه من عنت في تحصيل قوته اليوميّ", "في تجربة الشّاعر العاطفيّة مع محبوبته",
                "في وصف رحلة صيد في البحر", "في الاحتفاء بانتصار عسكريّ"]},
   {"correct": 0}, CRIT_A, 0.75, "ar.literature.trend")
st("s33", "q14", "q14-e2", "fill_blank", "أكمل العبارة الدّالّة على ذلك:",
   {"text": "«الولد الأسمر يجري، لا يلحق ____… الولد ينادي بالصّوت ____ عشرون بقرش..»", "bank": ["بالسّيّارات", "المحزون", "بالمارّة", "المرح"]},
   {"blanks": [["بالسّيّارات"], ["المحزون"]]}, CRIT_A, 0.75, "ar.comprehension.evidence")
st("s34", "q14", "q14-e3", "mcq", "كيف تجسّدت «معاناة الفشل والضّياع والشّعور بالتّفاهة» في القصيدة؟",
   {"options": ["في عالم المدينة المزدحم المشغول أهله بالهموم اليوميّة ممّا أفقدهم رابط الإنسانيّة بينهم، وفي فشل الطّفل في بيع بضاعته",
                "في نجاح الطّفل في بيع اللّيمون كلّه", "في حياة القرية الهادئة الآمنة", "في تفوّق الشّاعر على أقرانه"]},
   {"correct": 0}, CRIT_B, 0.75, "ar.literature.trend")
st("s35", "q14", "q14-e4", "multi", "أيّ العبارات الآتية تدلّ على ذلك؟ (اختر كلّ ما يصحّ)",
   {"options": ["«مسكينْ!»", "«لا أحد يشمّك يا ليمونْ!»", "«كانت في غفوتها الخضراء عروس الطّيرْ»", "«خضراءَ، مندّاة بالطّلّ»"]},
   {"correct": [0, 1]}, CRIT_B, 0.75, "ar.comprehension.evidence")
st("s36", "q14", "q14-e5", "mcq", "كيف تجسّد «اليأس من الإنسان والحضارة» في القصيدة؟",
   {"options": ["في الشّعور بالاغتراب في المدينة نتيجة فقدان القيم الاجتماعيّة الإنسانيّة", "في الإعجاب بمنجزات الحضارة الحديثة",
                "في الثّقة بالإنسان وقدرته على التّغيير", "في الحنين إلى ماضي الأمّة المجيد"]},
   {"correct": 0}, CRIT_C, 0.5, "ar.literature.trend")
st("s37", "q14", "q14-e6", "fill_blank", "أكمل العبارة الدّالّة على ذلك:",
   {"text": "«أقدام لا ____… سيّارات تمشي بحريق ____..»", "bank": ["تتوقّف", "البنزين", "تتحرّك", "الغاز"]},
   {"blanks": [["تتوقّف"], ["البنزين"]]}, CRIT_C, 0.5, "ar.comprehension.evidence")

TITLE = "بكالوريا 2014 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (أحمد عبد المعطي حجازي: سلّة ليمون)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2014، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
         f"مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "عيب في docx صُحّح من الموضوع الرّسميّ: آخر سطر في القصيدة «فَتذَكَّرَت القريه!» ⇐ «فَتذَكَّرتُ القريه!». القصيدة في خليّتين فجُعلت ثلاثة مقاطع عند فواصل «***». "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، قُرئت مصوّرة؛ التّقطيع بدقّة 300). "
         "المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4؛ لا تلخيص في هذا الموضوع، ولا جزء مؤجَّل.")
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
