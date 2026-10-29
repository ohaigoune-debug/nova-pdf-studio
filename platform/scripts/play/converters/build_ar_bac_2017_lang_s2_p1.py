"""Conversion: BAC 2017 (الدّورة الثّانية = «الدّورة الاستثنائيّة» on the ONEC paper) – اللّغة العربيّة وآدابها – شعبة لغات أجنبيّة –
الموضوع الأوّل (أمل دنقل، قصيدة «الحمامة» في المدينة).
2017 had two sessions; this set is the SECOND one (the ONEC header says «الدّورة الاستثنائيّة: 2017»); session 1 is ar-bac-2017-*-s1-*.
Exam (most faithful source): gdrive 1Cc4IImtaTyVD3EVV-b76jj0WZND_xrWd (بكالوريا العربية 2017 لغات الدورة الثانية.docx);
same paper as PDF (owner's copy): gdrive 13o3Rg2Z5Ul9ujYbfiiXf6nMZLkkP1cRp (BAC 2017 - الدورة 2 - اللغة العربية - لغات أجنبية.pdf);
official ONEC paper: gdrive 1p9XBVOXNPWoukpZNJy1Wv4JCXQdmwMhm (01_الدورة_الاستثنائية_الموضوع.pdf, pages 1–2 — read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1ULdLEzTy2Nc403wHjBQf_Nl9xlYlZlhI (02_الدورة_الاستثنائية_التصحيح.pdf, pages 1–2).

Method (same as the BAC 2019–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed) and re-checked programmatically against it; the
docx was compared line by line with the ONEC paper (no missing or altered line; diacritics differ slightly ⇒ docx kept).
The correction PDF's text layer is reversed presentation-form Arabic, so the mark scheme was read from the rendered pages
(150 dpi; the scansion re-read at 300 dpi). Every mark comes from the official scheme; correct options and explanations
condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «لغات أجنبيّة» ⇒ LANG.
- The poem sits in a two-cell table, four numbered stanzas separated by «****» ⇒ four stanza documents (number line kept,
  the «****» separators become document boundaries).
- Underlines: ONEC underlines «لاهثةً» and «رعباً» (not underlined in docx); the question names both words.
- Rule used for «n×m» lines: n×m over an unordered list of interchangeable items ⇒ one element; n×m over distinct
  demanded parts ⇒ one element per part.
- Q1 01, Q2 «2×01» (who the dove stands for / the relation), Q3 02 (one line) ⇒ elements 1 / 1+1 / 2.
- Q4: 01 the psychological connotations + «4×0.25» examples (six listed) ⇒ one element of 1.
- Q5: «2×0.75» the type (السّرديّ) and its justification + «2×0.75» two indicators with examples (four listed, «يكتفي
  المترشّح بذكر مؤشّرين اثنين مع التّمثيل») ⇒ elements 0.75 / 0.75 / 1.5. «الوصفيّ» and «الحواريّ» are not used as
  distractors (arguable for this poem).
- Part 2 Q1 «4×0.25» = two words per field ⇒ one element per field. The scheme lists «حقل الحركة: طارت، سارت»; the poem has
  no «سارت» — «سَرَتْ» (السّطر الأوّل) is assumed to be meant and is used in the steps (check).
- Part 2 Q2: «2×0.25» (لاهثة: حال؛ رعبا: تمييز) + «2×0.25» ((تحلم في استرخاء): خبر كان؛ (يصدّ الطّير): نعت) ⇒ four
  elements. «حال» is not used as a distractor for (تحلم في استرخاء) nor for (يصدّ الطّير) (arguable).
- Part 2 Q3 «3×0.5» = explanation / type / effect. Q4: «2×0.25» the two pronouns (هي / أنتِ) + «1×0.5» their function.
- Part 2 Q5: «4×0.25» + «1×0.5» ⇒ الكتابة العروضيّة / الرّموز / التّفعيلات / تفعيلة الرّجز + what is new (شعر التّفعيلة).
  Scansion as in the scheme: وَنْدَفَعَتْ | سَيْيَارَتُنْ | مَجْنُونَتُسْ | سَائِقْ = /0///0 /0/0//0 /0/0//0 /0/0 =
  مُفْتَعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْ (فَعْلُنْ) (the scheme prints the symbols in visual right-to-left order).
- Part 3 «اكتب فقرة…»: the scheme grades content items only (0.5 شرح القول، 01 تعريف الرّمز، «3×0.5» أنواعه — five listed,
  «يكتفي المترشّح بذكر ثلاثة أنواع»، «2×0.5» وظائفه — four listed, «يكتفي بذكر وظيفتين») with closed answers ⇒ converted
  interactively (four elements). If the owner prefers the paragraph-writing form, these four elements can be deferred.
- No deferred part in this subject (no summary question in LANG subject 1).
- Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1Cc4IImtaTyVD3EVV-b76jj0WZND_xrWd"
PDF_ID = "13o3Rg2Z5Ul9ujYbfiiXf6nMZLkkP1cRp"
OFFICIAL_ID = "1p9XBVOXNPWoukpZNJy1Wv4JCXQdmwMhm"
CORR_ID = "1ULdLEzTy2Nc403wHjBQf_Nl9xlYlZlhI"
SOURCE_STREAMS = ["LANG"]

# ── الموضوع الأوّل (مولَّد من docx) ──
P1_STANZAS = ['1\nحينَ سَرَتْ في الشّارعِ الضَّوضاءْ\nواندفعت سيَّارةٌ مجنونةُ السَّائقْ\nتطلق صوت بُوقها الزَّاعقْ\nفي كبدِ الأشياء:\nتَفَزَّعَت حمامةٌ بيضاءْ\nكانت على تمثالِ نهضةِ مصرْ..\n(تحلُمْ في استرخاءْ)', '2\nطارت، وحطَّت فوق قُبَّةِ الجامعةِ النُّحاسْ\nلاهثةً، تلتقط الأنفاسْ\nوفجأةً: دندنتِ السّاعهْ\nودقّتِ الأجراسْ\nفحلّقتْ في الأفق.. مُرتاعهْ!', '3\nأيَّـتُها الحمامة التي استقرّت\nفوقَ رأسِ الجسر\nوعندما أدارَ شُرطيُّ المرور يَدَهُ..\nظنّتهُ ناطورًا.. (يصدّ الطّيرْ)\nفامتَلأتْ رُعباً!', '4\nأيَّتُها الحمامةُ التَّعبى:\nدُوري على قِبابِ هذه المدينة الحزينهْ\nوأنشِدي للموتِ فيها.. والأسَى.. والذُّعرْ\nحتّى نرى عند قُدومِ الفجرْ\nجناحَكِ المُلقى..\nعلى قاعدة التّمثالِ في المدينهْ\n... وتعرفين راحة السّكينهْ!']
P1_REF = '[الأعمال الشعريّة الكاملة لأمل دُنقل، مكتبة مدبولي القاهرة\nط 3، 1987 م/ ص 205 و206]'
P1_GLOSS = 'الزّاعق: صوت الصّياح المفزع للآخر.   ناطور: ج نواطير: حارس الزّرع، حافظ الكرم.'
P1_QP = ['أوّلا- البناء الفكري: (10 نقاط)', 'ما الظاهرة الاجتماعيّة التي تناولها الشّاعر في القصيدة؟', 'مَنْ يقصد الشّاعر بالحمامة؟ وما العلاقة بينهما؟', 'النّصّ مجموعة من اللّوحات الفنّيّة المعبّرة. ما الصّورة التي رسمها الشّاعر في المقطع الثّاني؟', 'ما الدّلالات النّفسيّة التي يحملها المقطع الأخير من القصيدة مع التّمثيل؟', 'حدّد النّمط الغالب في النّص مع التعليل، ممثّلا له بمؤشّرين اثنين.', 'ثانيا- البناء اللّغوي: (06 نقاط)', 'تراوحت الأحداث بين حقلين دلاليين (السّكون والحركة). مثّل لكلّ منهما بكلمتين اثنتين من القصيدة.', 'علّل إعرابًا سبب نصب اللفظتين: "لاهثة" في السّطر الثاني من المقطع الثاني و"رعبا" في السّطر الخامس من المقطع الثَّالث، ثم أعرب الجملتين الموضوعتين بين قوسين إعراب جمل: (تَحْلُمُ في استرخاءْ) في المقطع الأول، و (يصدّ الطّير) في المقطع الثَّالث.', 'في قول الشّاعر: "سَرَتْ في الشَّارع الضّوضاء" صورةٌ بيانيَّة، اشْرَحْهَا، وسمّ نَوعَهَا، مُبيّنًا وجْهَ بلاغتها.', 'غلب على النَّص ضميران، اذكرهما، وبيّن وظيفتهما في بنائه.', 'قَطِّعْ عروضيًا السّطر الثَّاني مِن المَقْطَع الأوّل، ثُمَّ سَمّ التّفعيلة، ذاكرا ما جدّ على القالب الشّعريّ للقصيدة.', 'ثالثا- التّقويم النقدي: (04 نقاط)', '" لقد صار توظيفُ الرّمزِ في الشّعرِ العَرَبِيِّ الحَدِيثِ من المقتضيات التي يفرضُهَا الواقع الاجتماعيُّ والنَّفْسِيُّ والسّياسيُّ للشُّعَراءِ".\nالكتاب المدرسيّ للسّنة الثالثة شعبة آداب وفلسفة ولغات أجنبيّة ص 175', 'اكتب فقرة تشرح فيها هذا القول، معرّفا الرّمز، ذاكرا أنواعه، ووظائفه.']


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
def q(qid, number, part, text, total, elements, docs):
    Q.append({"id": qid, "number": number, "part": part, "verbatim_text": text, "documents": docs, "rubric_total": total, "rubric_elements": elements})


S = []
def st(sid, qid, eid, typ, prompt, payload, answer, expl, pts, skill=None, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": typ, "prompt": prompt,
              "payload": {"type": typ, **payload}, "answer": {"type": typ, **answer}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_human_review"})


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": "a", "type": "essay_builder",
              "prompt": f"{title} — معيار {crit}", "payload": {"type": "essay_builder", "spec": {**spec, "criterion": crit, "indicator": ind}},
              "answer": {"type": "essay_builder", "spec": {"rubric": ind}}, "explanation": expl, "points": pts,
              "skill_id": skill, "lesson_ref": None, "is_verbatim_original": False, "review_status": "needs_engine_support"})


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
    caps = [_norm(d["caption"]) for qq in Q for d in qq["documents"]]
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        for v in SOURCE_STREAMS:
            sub = sum(e["max_points"] for e in qq["rubric_elements"] if v in e.get("streams", SOURCE_STREAMS))
            assert abs(sub - qq["rubric_total"]) < 1e-9, (qq["id"], v, sub)
    for v in SOURCE_STREAMS:
        tot = sum(s["points"] for s in S if v in els[s["rubric_element_id"]].get("streams", SOURCE_STREAMS))
        assert abs(tot - total) < 1e-9, (v, tot)
    got = {}
    for s in S:
        p, a, t = s["payload"], s["answer"], s["type"]
        assert s["skill_id"] in SKILLS, (s["id"], s["skill_id"])
        assert s["rubric_element_id"].startswith(s["source_question_id"] + "-") and s["rubric_element_id"] in els, s["id"]
        assert abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
        assert s["explanation"].strip() and s["prompt"].strip(), s["id"]
        got[s["rubric_element_id"]] = got.get(s["rubric_element_id"], 0) + s["points"]
        if t in ("mcq", "multi"):
            assert len(set(p["options"])) == len(p["options"]), (s["id"], "duplicate options")
            assert (3 <= len(p["options"]) <= 4 and a["correct"] == 0) if t == "mcq" else len(p["options"]) >= 3, (s["id"], "option count")
            if t == "multi":
                assert 0 < len(a["correct"]) < len(p["options"]) and len(set(a["correct"])) == len(a["correct"]), s["id"]
                assert all(0 <= i < len(p["options"]) for i in a["correct"]), s["id"]
        if t == "fill_blank":
            assert p["text"].count("____") == len(a["blanks"]), s["id"]
            bank = [_norm(b) for b in p["bank"]]
            for alts in a["blanks"]:
                assert any(_norm(x) in bank for x in alts), (s["id"], alts)
            assert len(set(bank)) == len(bank), (s["id"], "bank duplicates")
            assert len(p["bank"]) > len(a["blanks"]), (s["id"], "no distractor in bank")
        if t == "matching":
            assert len(set(a["pairs"])) == len(a["pairs"]) == len(p["lefts"]) >= 2, s["id"]
            assert len(set(p["rights"])) == len(p["rights"]) >= len(p["lefts"]), s["id"]
            assert all(0 <= i < len(p["rights"]) for i in a["pairs"]), s["id"]
        if t == "ordering":
            assert a["order"] == list(range(len(p["items"]))) and len(set(p["items"])) == len(p["items"]) >= 2, s["id"]
        if t == "essay_builder":
            assert s["review_status"] == "needs_engine_support", s["id"]
        else:
            # الإجابة الصّحيحة لا تظهر في عنوان وثيقة (القاعدة 12)
            keys = ([p["options"][a["correct"]]] if t == "mcq" else [p["options"][i] for i in a["correct"]] if t == "multi"
                    else [b[0] for b in a["blanks"]] if t == "fill_blank" else [])
            for k in keys:
                nk = _norm(k)
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    assert len({qq["id"] for qq in Q}) == len(Q), "duplicate question ids"
    assert len(els) == sum(len(qq["rubric_elements"]) for qq in Q), "duplicate element ids"

TEXT_DOCS = [
    {"id": "d-st1", "kind": "text", "caption": "المقطع الأوّل", "text": P1_STANZAS[0]},
    {"id": "d-st2", "kind": "text", "caption": "المقطع الثّاني", "text": P1_STANZAS[1]},
    {"id": "d-st3", "kind": "text", "caption": "المقطع الثّالث", "text": P1_STANZAS[2]},
    {"id": "d-st4", "kind": "text", "caption": "المقطع الرّابع", "text": P1_STANZAS[3]},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P1_GLOSS},
]
QP = P1_QP
P1, P2, P3 = QP[0], QP[6], QP[12]
CRIT_DOCS = [{"id": "d-crit", "kind": "text", "caption": "القول", "text": QP[13]}]

q("q1", "1", P1, QP[1], 1, [el("q1-e1", "الظّاهرة الاجتماعيّة", 1)], TEXT_DOCS)
q("q2", "2", P1, QP[2], 2, [el("q2-e1", "من يقصده الشّاعر بالحمامة", 1), el("q2-e2", "العلاقة بينهما", 1)], TEXT_DOCS)
q("q3", "3", P1, QP[3], 2, [el("q3-e1", "الصّورة الّتي رسمها الشّاعر في المقطع الثّاني", 2)], TEXT_DOCS)
q("q4", "4", P1, QP[4], 2, [el("q4-e1", "الدّلالات النّفسيّة للمقطع الأخير", 1), el("q4-e2", "التّمثيل (4×0.25)", 1)], TEXT_DOCS)
q("q5", "5", P1, QP[5], 3, [el("q5-e1", "النّمط الغالب", 0.75), el("q5-e2", "التّعليل", 0.75), el("q5-e3", "مؤشّران مع التّمثيل (2×0.75)", 1.5)], TEXT_DOCS)
q("q6", "1", P2, QP[7], 1, [el("q6-e1", "حقل السّكون: كلمتان (2×0.25)", 0.5), el("q6-e2", "حقل الحركة: كلمتان (2×0.25)", 0.5)], TEXT_DOCS)
q("q7", "2", P2, QP[8], 1, [el("q7-e1", "سبب نصب «لاهثة»", 0.25), el("q7-e2", "سبب نصب «رعبا»", 0.25),
                             el("q7-e3", "إعراب جملة (تحلم في استرخاء)", 0.25), el("q7-e4", "إعراب جملة (يصدّ الطّير)", 0.25)], TEXT_DOCS)
q("q8", "3", P2, QP[9], 1.5, [el("q8-e1", "«سرت في الشّارع الضّوضاء»: الشّرح", 0.5), el("q8-e2", "«سرت في الشّارع الضّوضاء»: النّوع", 0.5),
                               el("q8-e3", "«سرت في الشّارع الضّوضاء»: وجه البلاغة", 0.5)], TEXT_DOCS)
q("q9", "4", P2, QP[10], 1, [el("q9-e1", "الضّمير الأوّل: المفرد الغائب المؤنّث", 0.25), el("q9-e2", "الضّمير الثّاني: المفرد المخاطب المؤنّث", 0.25),
                              el("q9-e3", "وظيفتهما في بناء النّصّ", 0.5)], TEXT_DOCS)
q("q10", "5", P2, QP[11], 1.5, [el("q10-e1", "الكتابة العروضيّة", 0.25), el("q10-e2", "الرّموز العروضيّة", 0.25), el("q10-e3", "التّفعيلات", 0.25),
                                 el("q10-e4", "التّفعيلة (الرّجز)", 0.25), el("q10-e5", "ما جدّ على القالب الشّعريّ", 0.5)], TEXT_DOCS)
q("q11", "1", P3, QP[14], 4, [el("q11-e1", "شرح القول", 0.5), el("q11-e2", "تعريف الرّمز", 1), el("q11-e3", "أنواع الرّمز (3×0.5)", 1.5),
                               el("q11-e4", "وظائف الرّمز (2×0.5)", 1)], TEXT_DOCS + CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ما الظّاهرة الاجتماعيّة الّتي تناولها الشّاعر في القصيدة؟",
   {"options": ["معاناة الإنسان في ضوضاء المدينة وقلقه وعدم استقراره", "هجرة سكّان الرّيف إلى المدينة بحثًا عن العمل",
                "انتشار الفقر والبطالة بين الشّباب", "تلوّث البيئة وانقراض الطّيور"]},
   {"correct": 0}, "الظّاهرة الاجتماعيّة الّتي تناولها الشّاعر هي: معاناة الإنسان في ضوضاء المدينة وقلقه وعدم استقراره…", 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل الظّاهرة الاجتماعيّة الّتي تناولها الشّاعر:",
   {"text": "معاناة الإنسان في ____ المدينة و____ه وعدم ____ه.", "bank": ["ضوضاء", "قلق", "استقرار", "هدوء", "فرح", "رحيل"]},
   {"blanks": [["ضوضاء"], ["قلق"], ["استقرار"]]}, "«معاناة الإنسان في ضوضاء المدينة وقلقه وعدم استقراره…».", 0.5, "ar.comprehension.idea", "b")
st("s03", "q2", "q2-e1", "mcq", "مَن يقصد الشّاعر بالحمامة؟",
   {"options": ["الإنسان الباحث عن الرّاحة والسّكينة", "شرطيّ المرور", "المدينة الحزينة", "سائق السّيّارة المجنونة"]},
   {"correct": 0}, "يقصد الشّاعر بالحمامة: الإنسان الباحث عن الرّاحة والسّكينة.", 1, "ar.comprehension.image")
st("s04", "q2", "q2-e2", "fill_blank", "أكمل العلاقة بين الحمامة والإنسان:",
   {"text": "العلاقة بينهما ____ وانعدام الرّاحة و____.", "bank": ["الاضطراب", "السّكينة", "الفرح", "الغنى"]},
   {"blanks": [["الاضطراب"], ["السّكينة"]]}, "العلاقة بينهما: الاضطراب وانعدام الرّاحة والسّكينة.", 1, "ar.comprehension.link")
st("s05", "q3", "q3-e1", "mcq", "ما الصّورة الّتي رسمها الشّاعر في المقطع الثّاني؟",
   {"options": ["بحث الحمامة عن مكان آمن هادئ وتحليقها بعيدًا عن ضوضاء المدينة، غير أنّ أجراس السّاعة روّعتها ثانية",
                "استقرار الحمامة فوق قبّة الجامعة وعثورها على السّكينة الدّائمة", "سقوط جناح الحمامة على قاعدة التّمثال",
                "فزع الحمامة من شرطيّ المرور الّذي ظنّته ناطورًا"]},
   {"correct": 0}, "الصّورة الّتي رسمها الشّاعر في المقطع الثّاني هي: بحث الحمامة عن مكان آمن هادئ وتحليقها بعيدًا عن ضوضاء المدينة، غير أنّ أجراس السّاعة روّعتها ثانية.", 1, "ar.comprehension.image")
st("s06", "q3", "q3-e1", "ordering", "رتّب مراحل الصّورة الّتي رسمها الشّاعر في المقطع الثّاني.",
   {"items": ["بحثت الحمامة عن مكان آمن هادئ فحطّت فوق قبّة الجامعة بعيدًا عن ضوضاء المدينة", "دندنت السّاعة ودقّت الأجراس",
              "روّعتها الأجراس ثانية فحلّقت في الأفق مرتاعة"]},
   {"order": [0, 1, 2]}, "«بحث الحمامة عن مكان آمن هادئ وتحليقها بعيدًا عن ضوضاء المدينة، غير أنّ أجراس السّاعة روّعتها ثانية».", 1, "ar.comprehension.image", "b")
st("s07", "q4", "q4-e1", "mcq", "ما الدّلالات النّفسيّة الّتي يحملها المقطع الأخير من القصيدة؟",
   {"options": ["تجلّت فيه نظرة الشّاعر السّوداويّة لواقعه من خلال تصويره لصخب المدينة واستحالة العيش فيها",
                "تجلّى فيه تفاؤل الشّاعر بمستقبل مدينته", "تجلّت فيه سخرية الشّاعر من الحمامة وضعفها", "تجلّى فيه حنين الشّاعر إلى طفولته"]},
   {"correct": 0}, "الدّلالات النّفسيّة الّتي يحملها المقطع الأخير: تجلّت فيه نظرة الشّاعر السّوداويّة لواقعه من خلال تصويره لصخب المدينة واستحالة العيش فيها.", 1, "ar.comprehension.emotion")
st("s08", "q4", "q4-e2", "fill_blank", "أكمل التّمثيل من المقطع الأخير:",
   {"text": "المدينة ____، الحمامة ____، الموت، الأسى، ____، جناحكِ ____.", "bank": ["الحزينة", "التّعبى", "الذّعر", "الملقى", "السّعيدة", "النّشيطة", "الأمل"]},
   {"blanks": [["الحزينة"], ["التّعبى"], ["الذّعر"], ["الملقى"]]}, "التّمثيل: المدينة الحزينة، الحمامة التّعبى، الموت، الأسى، الذّعر، جناحك الملقى.", 1, "ar.comprehension.evidence")
st("s09", "q5", "q5-e1", "mcq", "ما النّمط الغالب في النّصّ؟",
   {"options": ["السّرديّ", "الحجاجيّ", "التّفسيريّ", "الإيعازيّ"]},
   {"correct": 0}, "النّمط السّائد في النّصّ هو النّمط السّرديّ.", 0.75, "ar.text.type")
st("s10", "q5", "q5-e2", "mcq", "علّل غلبة النّمط السّرديّ على النّصّ.",
   {"options": ["لأنّ النّصّ قصّة توفّرت فيها العناصر الفنّيّة الدّالّة على مؤشّرات السّرد", "لأنّ الشّاعر يقدّم حججًا وبراهين لإقناع القارئ",
                "لأنّ الشّاعر يشرح ظاهرة علميّة ويحلّلها", "لأنّ الشّاعر يصدر تعليمات ينبغي اتّباعها"]},
   {"correct": 0}, "باعتبار النّصّ قصّة توفّرت فيها العناصر الفنّيّة الآتية الدّالّة على المؤشّرات.", 0.75, "ar.text.type")
st("s11", "q5", "q5-e3", "multi", "أيّ ممّا يلي من مؤشّرات النّمط السّرديّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["تحديد الإطار المكانيّ", "توظيف الجمل الفعليّة الّتي تفيد الحركة", "ذكر الشّخصيّات", "تسلسل أحداث النّصّ",
                "توظيف أدوات التّعليل والاستنتاج", "عرض الحجج والبراهين"]},
   {"correct": [0, 1, 2, 3]}, "المؤشّرات: تحديد الإطار المكانيّ (سرت في الشّارع)؛ توظيف الجمل الفعليّة الّتي تفيد الحركة (سرت، اندفعت، تطلق)؛ ذكر الشّخصيّات (الحمامة – الشّرطيّ – شخصيّة الشّاعر المحاورة)؛ تسلسل أحداث النّصّ. يكتفي المترشّح بذكر مؤشّرين اثنين مع التّمثيل.", 0.75, "ar.text.type")
st("s12", "q5", "q5-e3", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط السّرديّ بمثاله من النّصّ.",
   {"lefts": ["تحديد الإطار المكانيّ", "توظيف الجمل الفعليّة الّتي تفيد الحركة", "ذكر الشّخصيّات"],
    "rights": ["(سرت في الشّارع)", "(سرت، اندفعت، تطلق)", "(الحمامة – الشّرطيّ – شخصيّة الشّاعر المحاورة)", "(الأسى، الذّعر)"]},
   {"pairs": [0, 1, 2]}, "تحديد الإطار المكانيّ: سرت في الشّارع؛ توظيف الجمل الفعليّة الّتي تفيد الحركة: سرت، اندفعت، تطلق؛ ذكر الشّخصيّات: الحمامة – الشّرطيّ – شخصيّة الشّاعر المحاورة.", 0.75, "ar.text.type", "b")
# ── ثانيًا: البناء اللّغويّ ──
st("s13", "q6", "q6-e1", "multi", "أيّ الكلمات الآتية من حقل السّكون؟ (اختر كلّ ما يصحّ)",
   {"options": ["حطّت", "استقرّت", "اندفعت", "حلّقت", "طارت"]},
   {"correct": [0, 1]}, "حقل السّكون: حطّت، استقرّت؛ أمّا اندفعت وحلّقت وطارت فمن حقل الحركة.", 0.5, "ar.cohesion.effect")
st("s14", "q6", "q6-e2", "multi", "أيّ الكلمات الآتية من حقل الحركة؟ (اختر كلّ ما يصحّ)",
   {"options": ["طارت", "سَرَتْ", "حطّت", "استقرّت", "(تحلُمْ في استرخاءْ)"]},
   {"correct": [0, 1]}, "حقل الحركة: طارت، سرت (في التّصحيح: «سارت»)؛ أمّا حطّت واستقرّت و(تحلم في استرخاء) فمن حقل السّكون.", 0.5, "ar.cohesion.effect")
st("s15", "q7", "q7-e1", "mcq", "علّل إعرابًا سبب نصب «لاهثةً» في قوله: «لاهثةً، تلتقط الأنفاسْ».",
   {"options": ["لأنّها حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها", "لأنّها تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "لأنّها مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "لأنّها خبر «كان» منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "لاهثة: حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها.", 0.25, "ar.grammar.irab")
st("s16", "q7", "q7-e2", "mcq", "علّل إعرابًا سبب نصب «رُعبًا» في قوله: «فامتَلأتْ رُعباً!».",
   {"options": ["لأنّها تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "لأنّها مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "لأنّها مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "لأنّها خبر «كان» منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "رعبا: تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.25, "ar.grammar.irab")
st("s17", "q7", "q7-e3", "mcq", "أعرب جملة (تحلُمُ في استرخاءْ) في قوله: «كانت على تمثالِ نهضةِ مصرْ.. (تحلُمْ في استرخاءْ)».",
   {"options": ["جملة فعليّة في محلّ نصب خبر «كان»", "جملة فعليّة في محلّ رفع خبر المبتدأ", "جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة في محلّ جزم جواب الشّرط"]},
   {"correct": 0}, "(تحلم في استرخاء): جملة فعليّة في محلّ نصب خبر كان.", 0.25, "ar.grammar.sentence_case")
st("s18", "q7", "q7-e4", "mcq", "أعرب جملة (يصدّ الطّير) في قوله: «ظنّتهُ ناطورًا.. (يصدّ الطّيرْ)».",
   {"options": ["جملة فعليّة في محلّ نصب نعت", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ جرّ نعت"]},
   {"correct": 0}, "(يصدّ الطّير): جملة فعليّة في محلّ نصب نعت (لـ«ناطورًا»).", 0.25, "ar.grammar.sentence_case")
st("s19", "q8", "q8-e1", "matching", "اشرح الصّورة في «سَرَتْ في الشّارع الضّوضاء»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه (مذكور)", "المشبّه به (محذوف)", "اللاّزمة الدّالّة على المشبّه به"], "rights": ["الضّوضاء", "كائن حيّ", "سَرَتْ", "الشّارع"]},
   {"pairs": [0, 1, 2]}, "الشّرح: شبّه الشّاعر الضّوضاء بكائن حيّ، وحذف هذا الأخير وترك لازمة دالّة عليه هي «سرت».", 0.5, "ar.rhetoric.metaphor")
st("s20", "q8", "q8-e2", "mcq", "سمّ نوع الصّورة في «سَرَتْ في الشّارع الضّوضاء».",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن صفة"]},
   {"correct": 0}, "على سبيل الاستعارة المكنيّة.", 0.5, "ar.rhetoric.metaphor")
st("s21", "q8", "q8-e3", "mcq", "ما وجه بلاغة الصّورة في «سَرَتْ في الشّارع الضّوضاء»؟",
   {"options": ["شخّصت معنى انتشار الضّوضاء ممّا زادها وضوحًا", "الإيجاز بحذف أداة التّشبيه ووجه الشّبه", "إثبات الصّفة مصحوبة بالدّليل", "تحسين اللّفظ بتوافق الجرس"]},
   {"correct": 0}, "وجه بلاغتها: شخّص معنى انتشار الضّوضاء ممّا زادها وضوحًا.", 0.5, "ar.rhetoric.effect")
st("s22", "q9", "q9-e1", "mcq", "أيّ الضّمائر الآتية غلب على المقطعين الأوّل والثّاني (تفزّعت، كانت، طارت، حطّت، حلّقت)؟",
   {"options": ["ضمير المفرد الغائب المؤنّث (هي)", "ضمير المتكلّم (أنا)", "ضمير جماعة المتكلّمين (نحن)", "ضمير المفرد الغائب المذكّر (هو)"]},
   {"correct": 0}, "الضّميران هما: ضمير المفرد الغائب المؤنّث (هي)، وضمير المفرد المخاطب المؤنّث (أنتِ).", 0.25, "ar.cohesion.reference")
st("s23", "q9", "q9-e2", "mcq", "أيّ الضّمائر الآتية غلب على المقطع الرّابع (أيّتها الحمامة… دوري، أنشدي، جناحكِ، تعرفين)؟",
   {"options": ["ضمير المفرد المخاطب المؤنّث (أنتِ)", "ضمير المفرد المخاطب المذكّر (أنتَ)", "ضمير جماعة المخاطبين (أنتم)", "ضمير المتكلّم (أنا)"]},
   {"correct": 0}, "الضّميران هما: ضمير المفرد الغائب المؤنّث (هي)، وضمير المفرد المخاطب المؤنّث (أنتِ).", 0.25, "ar.cohesion.reference")
st("s24", "q9", "q9-e3", "mcq", "ما وظيفة هذين الضّميرين في بناء النّصّ؟",
   {"options": ["كلاهما يساهم في اتّساق النّصّ لأنّ العائد عليه واحد وهو الحمامة", "يحقّقان التّضادّ بين شخصيّتين مختلفتين",
                "يدلّان على تعدّد الرّواة في القصيدة", "يفصلان بين مقاطع القصيدة فلا رابط بينها"]},
   {"correct": 0}, "وكلاهما يساهم في اتّساق النّصّ، لأنّ العائد عليه واحد وهو الحمامة.", 0.5, "ar.cohesion.effect")
PRO_EXPL = ("التّقطيع العروضيّ: وَنْدَفَعَتْ | سَيْيَارَتُنْ | مَجْنُونَتُسْ | سَائِقْ = /0///0 /0/0//0 /0/0//0 /0/0 = مُفْتَعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْ (فَعْلُنْ)؛ "
            "تفعيلة الرّجز. والتّغيير الّذي جدّ على القالب: هو شعر التّفعيلة (نظام السّطر، تغيّر الوزن والقافية…).")
st("s25", "q10", "q10-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر «واندفعت سيَّارةٌ مجنونةُ السَّائقْ»:",
   {"text": "وَنْدَفَعَتْ / ____ / ____ / سَائِقْ", "bank": ["سَيْيَارَتُنْ", "مَجْنُونَتُسْ", "سَيَارَتُنْ", "مَجْنُونَتُ السْ"]},
   {"blanks": [["سَيْيَارَتُنْ"], ["مَجْنُونَتُسْ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s26", "q10", "q10-e2", "mcq", "ما الرّموز العروضيّة للسّطر «واندفعت سيَّارةٌ مجنونةُ السَّائقْ»؟",
   {"options": ["/0///0 /0/0//0 /0/0//0 /0/0", "/0/0//0 /0/0//0 /0/0//0 /0/0", "/0///0 //0//0 /0/0//0 /0/0", "/0///0 /0/0//0 /0//0 /0/0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s27", "q10", "q10-e3", "mcq", "ما تفعيلات السّطر؟",
   {"options": ["مُفْتَعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْ (فَعْلُنْ)", "مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلْ",
                "مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ فَعِلُنْ", "مُفْتَعِلُنْ مُفْتَعِلُنْ مُفْتَعِلُنْ فَعْلُنْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s28", "q10", "q10-e4", "mcq", "سمّ التّفعيلة الّتي بُني عليها السّطر.",
   {"options": ["تفعيلة الرّجز", "تفعيلة الكامل", "تفعيلة المتدارك", "تفعيلة الرّمل"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s29", "q10", "q10-e5", "multi", "ما الّذي جدّ على القالب الشّعريّ للقصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["شعر التّفعيلة: نظام السّطر", "تغيّر الوزن والقافية", "التزام نظام الشّطرين", "وحدة الرّويّ في القصيدة كلّها"]},
   {"correct": [0, 1]}, "التّغيّر الّذي جدّ على القالب: هو شعر التّفعيلة (نظام السّطر، تغيّر الوزن والقافية…).", 0.5, "ar.literature.renewal")
# ── ثالثًا: التّقويم النّقديّ ──
st("s30", "q11", "q11-e1", "mcq", "ما شرح القول: «لقد صار توظيف الرّمز في الشّعر العربيّ الحديث من المقتضيات الّتي يفرضها الواقع…»؟",
   {"options": ["ضرورة الرّمز الشّعريّ في القصيدة العربيّة الحديثة وعلاقته بالواقع الاجتماعيّ والنّفسيّ والسّياسيّ للشّعراء",
                "الرّمز زخرف لغويّ لا علاقة له بواقع الشّعراء", "الرّمز خاصّ بالشّعر القديم دون الحديث", "الرّمز وسيلة لتسهيل فهم القصيدة على عامّة القرّاء"]},
   {"correct": 0}, "شرح القول: ضرورة الرّمز الشّعريّ في القصيدة العربيّة الحديثة وعلاقته بالواقع الاجتماعيّ والنّفسيّ والسّياسيّ للشّعراء.", 0.5, "ar.literature.renewal")
st("s31", "q11", "q11-e2", "mcq", "ما تعريف الرّمز؟",
   {"options": ["هو شحن اللّفظ بدلالات إيحائيّة مكثّفة", "هو تشبيه حُذف أحد طرفيه", "هو ذكر اللّفظ وإرادة معناه الحقيقيّ المباشر", "هو تكرار اللّفظ لتقوية المعنى"]},
   {"correct": 0}, "تعريف الرّمز: هو شحن اللّفظ بدلالات إيحائيّة مكثّفة.", 0.5, "ar.literature.renewal")
st("s32", "q11", "q11-e2", "fill_blank", "أكمل تعريف الرّمز:",
   {"text": "الرّمز: هو ____ اللّفظ بدلالات ____ مكثّفة.", "bank": ["شحن", "إيحائيّة", "تفريغ", "حرفيّة"]},
   {"blanks": [["شحن"], ["إيحائيّة"]]}, "«تعريف الرّمز: هو شحن اللّفظ بدلالات إيحائيّة مكثّفة».", 0.5, "ar.literature.renewal", "b")
st("s33", "q11", "q11-e3", "multi", "أيّ ممّا يلي من أنواع الرّمز؟ (اختر كلّ ما يصحّ)",
   {"options": ["رمز دينيّ", "رمز تاريخيّ", "رمز طبيعيّ", "رمز أدبيّ", "رمز أسطوريّ", "رمز عروضيّ", "رمز نحويّ"]},
   {"correct": [0, 1, 2, 3, 4]}, "أنواعه: رمز دينيّ – رمز تاريخيّ – رمز طبيعيّ – رمز أدبيّ – رمز أسطوريّ. يكتفي المترشّح بذكر ثلاثة أنواع.", 1.5, "ar.literature.renewal")
st("s34", "q11", "q11-e4", "multi", "أيّ ممّا يلي من وظائف الرّمز؟ (اختر كلّ ما يصحّ)",
   {"options": ["تكثيف التّجربة الشّعريّة", "التّعبير عن الموقف الشّعريّ", "التّجديد في التّعبير الشّعريّ", "الإيجاز",
                "التّصريح المباشر بالمعنى", "الالتزام بوحدة الوزن والقافية"]},
   {"correct": [0, 1, 2, 3]}, "وظائفه: تكثيف التّجربة الشّعريّة / التّعبير عن الموقف الشّعريّ / التّجديد في التّعبير الشّعريّ / الإيجاز. يكتفي المترشّح بذكر وظيفتين.", 1, "ar.literature.renewal")

_check()
assert len(P1_STANZAS) == 4 and QP[0].startswith("أوّلا") and QP[6].startswith("ثانيا") and QP[12].startswith("ثالثا") and len(QP) == 15
assert P1_STANZAS[0].split("\n")[2].startswith("واندفعت سي") and P1_STANZAS[1].split("\n")[2].startswith("لاهثةً") and P1_STANZAS[2].split("\n")[5] == "فامتَلأتْ رُعباً!"

doc = {
    "schema_version": 1,
    "set_id": "ar-bac-2017-lang-s2-p1",
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p1",
        "kind": "BAC", "year": 2017, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 1,
        "title": "بكالوريا 2017 (الدّورة الثّانية) – اللّغة العربيّة وآدابها – لغات أجنبيّة – الموضوع الأوّل (أمل دنقل: الحمامة)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} (بكالوريا العربية 2017 لغات الدورة الثانية.docx)",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_الدورة_الاستثنائية_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("session: الدورة الثانية. نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2017، الدّورة الثّانية، "
                  "وفي رأس الموضوع الرّسميّ: «الدّورة الاستثنائيّة»، شعبة لغات أجنبيّة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
                  f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}؛ قوبل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الدورة_الاستثنائية_الموضوع.pdf، ص1–2) فلم يظهر سطر ناقص. "
                  "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 1–2، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة؛ التّقطيع بدقّة 300). "
                  "القصيدة أربعة مقاطع مرقّمة فجُعلت أربع وثائق. المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
                  "التّصحيح يذكر «سارت» في حقل الحركة ولا وجود لها في النّصّ، فاعتُمدت «سَرَتْ». "
                  "التّقويم النّقديّ («اكتب فقرة…») يُنقّط على عناصر مضمون مغلقة (شرح القول، تعريف الرّمز، أنواعه، وظائفه) فحُوِّل تفاعليًّا؛ لا جزء مؤجّلًا."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive، مع مقابلة الموضوع الرّسميّ؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
