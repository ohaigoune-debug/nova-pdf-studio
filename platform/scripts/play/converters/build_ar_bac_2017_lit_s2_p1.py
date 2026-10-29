"""Conversion: BAC 2017 (الدّورة الثّانية = «الدّورة الاستثنائيّة» on the ONEC paper) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة –
الموضوع الأوّل (صلاح عبد الصّبور، «ثلاث صور من غزّة»).
2017 had two sessions; this set is the SECOND one (the ONEC header says «الدّورة الاستثنائيّة: 2017»); session 1 is ar-bac-2017-*-s1-*.
Exam (most faithful source): gdrive 1btOuyzqJr4GTNHz1iIWZBq19gXyJKg9a (بكالوريا العربية 2017 اداب وفلسفة الدورة2 الثانية.docx);
same paper as PDF (owner's copy): gdrive 1bJkfTqjRkoLVwzC9kSSyLXaAdK4ik_mv (BAC 2017 - الدورة 2 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1id5s_VAUG2VrEr99XPvLRZ_Y_KrvjlJe (01_الدورة_الاستثنائية_الموضوع.pdf, pages 1–2 — read rendered to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 13nBl4yr6QfT04o4ghL_ipZ50UWdvPdj_ (02_الدورة_الاستثنائية_التصحيح.pdf, pages 1–2).

Method (same as the BAC 2019–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed; an inner RLM of the docx is kept) and re-checked
programmatically against it; the docx was compared line by line with the ONEC paper (no missing or altered line; only
diacritics and the stanza numbering «-1-» vs «- 1 -» differ ⇒ docx kept). The correction PDF's text layer is reversed
presentation-form Arabic, so the mark scheme was read from the rendered pages (150 dpi; the Q1 line and the scansion
re-read at 300 dpi). Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «آداب وفلسفة» ⇒ LIT.
- The free-verse poem sits in a two-cell table (right: stanza 1 and the start of stanza 2; left: the rest of stanza 2 and
  stanza 3) ⇒ three stanza documents (lines kept, empty lines dropped). Line numbering of the questions checks out
  («تسألني» = line 10, «لو» = line 14, «وخط قبره على ذُرى التّلال» = line 4 of stanza 3).
- Underlines (docx and ONEC): «تسألني», «لو»; bracketed sentences (لاكَهُ), (تذوده عن أرضه الحزينة).
- Rule used for «n×m» lines: n×m over an unordered list of interchangeable items ⇒ one element; n×m over distinct
  demanded parts ⇒ one element per part.
- Q1: 0.5 the speaker + «2×0.25» two expressions (one element). Q2 «2×0.5» = explanation / the example (the last four lines).
- Q3 «3×0.5» = النّهار / التّتار / سياج الشّوك ⇒ three elements.
- Q4 «3×0.5» = the explanation / the opinion («يوافق المترشّح الشّاعر الرّأي») / the justification ⇒ the explanation is
  interactive; the opinion and its justification are the candidate's own ⇒ deferred essay_builder (rule 11), the expected
  stance is kept in the spec.
- Q5: «2×0.5» the genre (الشّعر السّياسيّ التّحرّريّ) and the aim + «4×0.25» four features (five listed) ⇒ elements 0.5/0.5/1.
- Q6 (تلخيص) «3×1» = الحجم / المضمون / سلامة اللّغة ⇒ three deferred essay_builder elements (no model summary).
- Part 2 Q1 «2×0.5» = one field each (classification + naming). Q2 «6×0.25» = تسأل / النّون / الياء / لو / (لاكه) / (تذوده)
  ⇒ six elements. Q3 «4×0.25» = في / اللّام / الفاء / بل ⇒ four elements (for the فاء «السّببيّة» and for «بل» «الاستدراك»
  are not used as distractors). Q4 «2×0.5» = the figure (كناية عن صفة الصّمود) / its effect.
- Part 2 Q5: «4×0.25» + 0.5 ⇒ الكتابة العروضيّة / الرّموز / التّفعيلات / تفعيلة الرّجز + what is new in the form (شعر التّفعيلة).
  Scansion as in the scheme: وخَطْطَ قَبْ | رَهُو على | ذُرَ تْتِلالْ = //0//0 //0//0 //0//00 = مُتَفْعِلُنْ مُتَفْعِلُنْ مُتَفْعِلَانْ
  (the scheme prints the symbols in visual right-to-left order; written here left-to-right, the usual notation).
- Part 3 (04): 1.5 the extent of the response (with poets) + 1.5 the link with the sadness/pain phenomenon ⇒ interactive;
  01 «موقف المترشّح … (أن يشير إلى ظاهرة الالتزام)» ⇒ deferred essay_builder.
- Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1btOuyzqJr4GTNHz1iIWZBq19gXyJKg9a"
PDF_ID = "1bJkfTqjRkoLVwzC9kSSyLXaAdK4ik_mv"
OFFICIAL_ID = "1id5s_VAUG2VrEr99XPvLRZ_Y_KrvjlJe"
CORR_ID = "13nBl4yr6QfT04o4ghL_ipZ50UWdvPdj_"
SOURCE_STREAMS = ["LIT"]

# ── الموضوع الأوّل (مولَّد من docx) ──
P1_STANZAS = ['-1-\nلم يكُ في عيونه وصوته ألمْ\nلأنّه أحسّه سنهْ\nو(لاكَـهُ) ... استنشقه سنهْ\nوشاله في قلبه سنهْ\nوطالتْ السّنون أزمنهْ\nفأصبحت آلامُه - في صدره - حقدا\nبل أملاً ينتظرُ الغدَا', '-2-\nيا أيُّها الصّغارْ\nعيونكمْ تحرقني بنارْ\nتسألُنِي أعماقُها عن مطلَعِ النّهار\nعن عودةٍ إلى الدّيارْ\nأقولُ...يا صغارْ\nلننتظرْ غدا\nلو ضاع منّا الغدُ، يا صغارْ...\nضاعَ عُمرُنا سدى', '-3-\nكانت له أرضٌ وزيتونهْ\nوكرمةٌ، وساحةٌ، ودارْ\nوعندما أوفتْ به سفائنُ العمرِ إلى شواطئ السّكينهْ\nوخط قبره على ذُرى التّلال\nانطلقتْ كتائب التّتارْ\n(تذودُه عن أرضِه الحزينهْ)\nلكنّه خلْف سِياج الشّوكِ والصَبَّار ظلّ واقفًا...\nبلا ملال\nيرفض أنْ يموتَ قبل يوم ثارْ\nيا حُلمَ يوم الثّارْ']
P1_REF = '(ثلاث صور من غَزّة) ديوان صلاح عبد الصّبور ط1/سنة1972\nدار العودة. بيروت. \u200f صفحات 138 ،139 ،140'
P1_GLOSS = 'الشرح اللّغويّ:   لاكَهُ: لاك يلوك الكلام: أي تلعثم فيه وكرّره كثيرا.'
P1_QP = ['أوّلا- البناء الفكري: (10 نقاط)', 'بلسان من يتحدّث الشّاعر؟ اذكر عبارتين تدلّان على ذلك.', 'يرسّخُ النّص فكرة الارتباط بالأرض، وضّح مع التمثيل.', 'ما هي الدلالات الرّمزيّة لما يأتي: النّهار، التّتار، سياج الشّوك؟', 'اشرح قول الشّاعر: " لو ضاع منّا الغدُ ... يا صغار ... ضاع عمرنا سُدًى ". مبديًا رأيك.', 'حدّد الغرضّ الشّعريّ للنّصّ والهدف منه، مبرزًا أهمّ خصائصه.', 'لخّص مضمون النّص.', 'ثانيا- البناء اللّغوي: (06 نقاط)', 'صنّف الألفاظ الآتية في حقلين دلاليين، مسميًا مجال كل منهما:\nحقدا - حُلم - صغار - تحرقني - ضاع - واقفا.', 'أعرب اللفظتين الآتيتين إعراب مفردات: " تسألني" (السّطر العاشر)، ولفظة " لو" (السّطر الرّابع عشر). ثم بيّن المحل الإعرابيّ للجملتين: (لاكَه)،\u200f (تذوده عن أرضه الحزينة).', 'ما الدّلالات التي أفادتها حروف المعاني الآتية: في، اللّام، الفاء، بل. الواردة في المقطع الأول من القصيدة؟', 'سم الصّورة البيانيّة واشرحها مبرزًا وجه بلاغتها في قوله: " ظلّ واقفًا ".', 'ادرس عروضيًا السّطر الرابع من المقطع الثّالث، مبيّنا ما جدَّ على القالب الشّعريّ للقصيدة.', 'ثالثا- التّقويم النقدي: (04 نقاط)', '" ... أمَّا المسألة الفلسطينيّة فقد أَدْمَت قلوبَ الشُّعراء وفجّرت قرائحّهم، فنُظِمت فيها القصائدُ الباكيةُ، وقصائدُ المقاومةِ وشعرُ العودة."\n" الكتاب المدرسيّ للسّنة الثّالثة شعبة. آداب وفلسفة ص 64"', 'بيّن من خلال هذا القول مدَى تجاوب الأدباء العرب مع القضيّة الفلسطينيّة، وعلاقتها ببروز ظاهرة الحزن والألم عند الشّعراء المعاصرين، مبديًا موقفك من مسؤوليّة الأديب نحو قضايا الوطن والأمّة.']


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
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P1_GLOSS},
]
QP = P1_QP
P1, P2, P3 = QP[0], QP[7], QP[13]
CRIT_DOCS = [{"id": "d-crit", "kind": "text", "caption": "القول", "text": QP[14]}]

q("q1", "1", P1, QP[1], 1, [el("q1-e1", "المتحدَّث بلسانه", 0.5), el("q1-e2", "عبارتان دالّتان على ذلك (2×0.25)", 0.5)], TEXT_DOCS)
q("q2", "2", P1, QP[2], 1, [el("q2-e1", "توضيح فكرة الارتباط بالأرض", 0.5), el("q2-e2", "التّمثيل", 0.5)], TEXT_DOCS)
q("q3", "3", P1, QP[3], 1.5, [el("q3-e1", "الدّلالة الرّمزيّة لـ«النّهار»", 0.5), el("q3-e2", "الدّلالة الرّمزيّة لـ«التّتار»", 0.5),
                               el("q3-e3", "الدّلالة الرّمزيّة لـ«سياج الشّوك»", 0.5)], TEXT_DOCS)
q("q4", "4", P1, QP[4], 1.5, [el("q4-e1", "شرح القول", 0.5), el("q4-e2", "الرّأي", 0.5), el("q4-e3", "التّعليل", 0.5)], TEXT_DOCS)
q("q5", "5", P1, QP[5], 2, [el("q5-e1", "الغرض الشّعريّ", 0.5), el("q5-e2", "الهدف منه", 0.5), el("q5-e3", "أهمّ خصائصه (4×0.25)", 1)], TEXT_DOCS)
q("q6", "6", P1, QP[6], 3, [el("q6-e1", "التّلخيص: الحجم", 1), el("q6-e2", "التّلخيص: المضمون", 1), el("q6-e3", "التّلخيص: سلامة اللّغة", 1)], TEXT_DOCS)
q("q7", "1", P2, QP[8], 1, [el("q7-e1", "حقل المعاناة والألم: التّصنيف والتّسمية", 0.5), el("q7-e2", "حقل الأمل: التّصنيف والتّسمية", 0.5)], TEXT_DOCS)
q("q8", "2", P2, QP[9], 1.5, [el("q8-e1", "إعراب «تسألُ»", 0.25), el("q8-e2", "إعراب النّون في «تسألني»", 0.25), el("q8-e3", "إعراب الياء في «تسألني»", 0.25),
                               el("q8-e4", "إعراب «لو»", 0.25), el("q8-e5", "محلّ جملة (لاكه)", 0.25), el("q8-e6", "محلّ جملة (تذوده عن أرضه الحزينة)", 0.25)], TEXT_DOCS)
q("q9", "3", P2, QP[10], 1, [el("q9-e1", "دلالة «في»", 0.25), el("q9-e2", "دلالة اللّام", 0.25), el("q9-e3", "دلالة الفاء", 0.25), el("q9-e4", "دلالة «بل»", 0.25)], TEXT_DOCS)
q("q10", "4", P2, QP[11], 1, [el("q10-e1", "«ظلّ واقفًا»: التّسمية", 0.5), el("q10-e2", "«ظلّ واقفًا»: وجه البلاغة", 0.5)], TEXT_DOCS)
q("q11", "5", P2, QP[12], 1.5, [el("q11-e1", "الكتابة العروضيّة", 0.25), el("q11-e2", "الرّموز العروضيّة", 0.25), el("q11-e3", "التّفعيلات", 0.25),
                                 el("q11-e4", "التّفعيلة (الرّجز)", 0.25), el("q11-e5", "ما جدّ على القالب الشّعريّ", 0.5)], TEXT_DOCS)
q("q12", "1", P3, QP[15], 4, [el("q12-e1", "مدى تجاوب الأدباء العرب مع القضيّة الفلسطينيّة", 1.5), el("q12-e2", "علاقتها ببروز ظاهرة الحزن والألم", 1.5),
                               el("q12-e3", "موقف المترشّح من مسؤوليّة الأديب", 1)], TEXT_DOCS + CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "بلسان من يتحدّث الشّاعر في القصيدة؟",
   {"options": ["بلسان شيخ فلسطينيّ مُبعَد عن أرضه", "بلسان طفل فلسطينيّ يسأل عن الدّيار", "بلسان جنديّ من كتائب التّتار", "بلسان أمّ فلسطينيّة تنتظر أبناءها"]},
   {"correct": 0}, "يتحدّث الشّاعر بلسان شيخ فلسطينيّ مُبعَد عن أرضه.", 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل العبارتين الدّالّتين على ذلك:",
   {"text": "«وطالتْ ____ أزمنهْ» – «يا أيُّها ____»", "bank": ["السّنون", "الصّغارْ", "الأيّام", "الرّجالْ"]},
   {"blanks": [["السّنون"], ["الصّغارْ"]]}, "العبارتان الدّالّتان على ذلك: «طالت السّنون أزمنه»، «يا أيّها الصّغار…».", 0.5, "ar.comprehension.evidence")
st("s03", "q2", "q2-e1", "mcq", "كيف يرسّخ النّصّ فكرة الارتباط بالأرض؟",
   {"options": ["فرغم شيخوخة المُبعَد لا يزال متشبّثًا بأمل العودة إلى الدّيار", "فالشّيخ يبيع أرضه ليرحل إلى بلد آمن",
                "فالصّغار ينسون الأرض ويطلبون الرّحيل", "فالشّاعر يدعو إلى التّعايش مع المحتلّ"]},
   {"correct": 0}, "يرسّخ النّصّ فكرة الارتباط بالأرض، فرغم شيخوخة المُبعَد لا يزال متشبّثًا بأمل العودة إلى الدّيار.", 0.5, "ar.comprehension.idea")
st("s04", "q2", "q2-e2", "mcq", "أيّ الأسطر الآتية يظهر فيها ارتباط الشّيخ بالأرض جليًّا؟",
   {"options": ["«لكنّه خلْف سِياج الشّوكِ والصَبَّار ظلّ واقفًا… بلا ملال، يرفض أنْ يموتَ قبل يوم ثارْ»", "«انطلقتْ كتائب التّتارْ»",
                "«لم يكُ في عيونه وصوته ألمْ»", "«فأصبحت آلامُه - في صدره - حقدا»"]},
   {"correct": 0}, "وقد ظهر ذلك جليًّا في الأسطر الأربعة الأخيرة: «لكنّه خلف سياج الشّوك والصّبّار ظلّ واقفًا… بلا ملال، يرفض أن يموت قبل يوم ثار، يا حلم يوم الثّار».", 0.5, "ar.comprehension.evidence")
st("s05", "q3", "q3-e1", "mcq", "ما الدّلالة الرّمزيّة لـ«النّهار» في قوله: «تسألني أعماقها عن مطلع النّهار»؟",
   {"options": ["الحرّيّة", "الحصار", "همجيّة المحتلّ", "الموت"]},
   {"correct": 0}, "النّهار: رمز الحرّيّة.", 0.5, "ar.comprehension.explain")
st("s06", "q3", "q3-e2", "mcq", "ما الدّلالة الرّمزيّة لـ«التّتار» في قوله: «انطلقتْ كتائب التّتارْ»؟",
   {"options": ["همجيّة المحتلّ الصّهيونيّ", "الحرّيّة", "الحصار", "الأمل في العودة"]},
   {"correct": 0}, "التّتار: همجيّة المحتلّ الصّهيونيّ.", 0.5, "ar.comprehension.explain")
st("s07", "q3", "q3-e3", "fill_blank", "أكمل الدّلالة الرّمزيّة في قوله: «خلْف سِياج الشّوكِ والصَبَّار»:",
   {"text": "سياج الشّوك رمز ____.", "bank": ["الحصار", "الحرّيّة", "الهمجيّة", "الأمل"]},
   {"blanks": [["الحصار"]]}, "سياج الشّوك: الحصار.", 0.5, "ar.comprehension.explain")
st("s08", "q4", "q4-e1", "mcq", "ما شرح قول الشّاعر: «لو ضاع منّا الغدُ… يا صغار… ضاع عمرنا سدى»؟",
   {"options": ["الخوف من ضياع المستقبل وفقدان الأمل", "الفرح بقدوم الغد وتحقّق العودة", "اللاّمبالاة بالمستقبل والاكتفاء بالحاضر", "الحنين إلى أيّام الطّفولة"]},
   {"correct": 0}, "الشّرح: الخوف من ضياع المستقبل وفقدان الأمل…", 0.5, "ar.comprehension.explain")
OP_SPEC = {"task": "إبداء الرّأي في قول الشّاعر مع التّعليل", "question": QP[4],
           "model": "الإجابة النّموذجيّة: «يُوافق المترشّحُ الشّاعرَ الرّأيَ + التّعليل» (0.5 للرّأي و0.5 للتّعليل)."}
essay("s09", "q4", "q4-e2", "رأيك في قول الشّاعر «لو ضاع منّا الغد… ضاع عمرنا سدى»", "الرّأي", "إبداء رأي واضح في قول الشّاعر (المنتظَر: موافقته)", 0.5, OP_SPEC,
      "يوافق المترشّح الشّاعر الرّأي، ثمّ يعلّل.", "ar.comprehension.opinion")
essay("s10", "q4", "q4-e3", "رأيك في قول الشّاعر «لو ضاع منّا الغد… ضاع عمرنا سدى»", "التّعليل", "تعليل الرّأي", 0.5, OP_SPEC,
      "يوافق المترشّح الشّاعر الرّأي + التّعليل.", "ar.comprehension.opinion")
st("s11", "q5", "q5-e1", "mcq", "ضمن أيّ غرض شعريّ يندرج النّصّ؟",
   {"options": ["الشّعر السّياسيّ التّحرّريّ", "الشّعر الوجدانيّ الذّاتيّ", "شعر الطّبيعة", "شعر المدح"]},
   {"correct": 0}, "يندرج النّصّ ضمن الشّعر السّياسيّ التّحرّريّ.", 0.5, "ar.literature.genre")
st("s12", "q5", "q5-e2", "fill_blank", "أكمل الهدف من النّصّ:",
   {"text": "بثّ ____ في النّفوس والشّهامة في الرّؤوس، وإظهار ____ الشّعب الفلسطينيّ وحقّهم في أرضهم، ودعوتهم إلى ____.",
    "bank": ["الحماسة", "معاناة", "التّحرّر", "اليأس", "رفاهية", "الهجرة"]},
   {"blanks": [["الحماسة"], ["معاناة"], ["التّحرّر"]]}, "الهدف منه: بثّ الحماسة في النّفوس والشّهامة في الرّؤوس وإظهار معاناة الشّعب الفلسطينيّ وحقّهم في أرضهم ودعوتهم إلى التّحرّر.", 0.5, "ar.comprehension.purpose")
st("s13", "q5", "q5-e3", "multi", "أيّ ممّا يلي من أهمّ خصائص الشّعر السّياسيّ التّحرّريّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["بروز النّزعة الوطنيّة والقوميّة", "التّغنّي بأمجاد الأوطان", "صدق المشاعر", "الدّعوة إلى التّحرّر وكسر قيود الاستدمار", "بثّ الأمل",
                "الإغراق في الصّناعة اللّفظيّة والمحسّنات المتكلّفة", "الهروب من الواقع إلى الطّبيعة"]},
   {"correct": [0, 1, 2, 3, 4]}, "الخصائص: بروز النّزعة الوطنيّة والقوميّة، التّغنّي بأمجاد الأوطان، صدق المشاعر، الدّعوة إلى التّحرّر وكسر قيود الاستدمار، بثّ الأمل…", 1, "ar.literature.features")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "قصيدة صلاح عبد الصّبور «ثلاث صور من غزّة» (بكالوريا 2017، الدّورة الثّانية، آداب وفلسفة، الموضوع الأوّل)",
            "model_example": None}
SUM_EXPL = "التّلخيص يراعى فيه: الحجم، المضمون، سلامة اللّغة (3×1). لا يقدّم التّصحيح نموذجًا للتّلخيص."
for i, (crit, ind) in enumerate([("الحجم", "مراعاة حجم التّلخيص"), ("المضمون", "ملاءمة المضمون لمعاني القصيدة"), ("سلامة اللّغة", "سلامة اللّغة")]):
    essay(f"s{14 + i}", "q6", f"q6-e{i + 1}", "تلخيص مضمون قصيدة صلاح عبد الصّبور", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s17", "q7", "q7-e1", "multi", "أيّ الألفاظ الآتية تنتمي إلى حقل المعاناة والألم؟ (اختر كلّ ما يصحّ)",
   {"options": ["حقدا", "تحرقني", "ضاع", "حُلم", "صغار", "واقفا"]},
   {"correct": [0, 1, 2]}, "حقل المعاناة والألم: حقد، تحرقني، ضاع؛ وحقل الأمل: حلم، صغار، واقفًا.", 0.25, "ar.cohesion.effect")
st("s18", "q7", "q7-e1", "mcq", "ما مجال الحقل الّذي تنتمي إليه «حقدا، تحرقني، ضاع»؟",
   {"options": ["حقل المعاناة والألم", "حقل الأمل", "حقل الطّبيعة", "حقل الفرح"]},
   {"correct": 0}, "حقل المعاناة والألم: حقد، تحرقني، ضاع.", 0.25, "ar.cohesion.effect", "b")
st("s19", "q7", "q7-e2", "multi", "أيّ الألفاظ الآتية تنتمي إلى حقل الأمل؟ (اختر كلّ ما يصحّ)",
   {"options": ["حُلم", "صغار", "واقفا", "حقدا", "تحرقني", "ضاع"]},
   {"correct": [0, 1, 2]}, "حقل الأمل: حلم، صغار، واقفًا؛ وحقل المعاناة والألم: حقد، تحرقني، ضاع.", 0.25, "ar.cohesion.effect")
st("s20", "q7", "q7-e2", "mcq", "ما مجال الحقل الّذي تنتمي إليه «حُلم، صغار، واقفا»؟",
   {"options": ["حقل الأمل", "حقل المعاناة والألم", "حقل اليأس", "حقل الطّبيعة"]},
   {"correct": 0}, "حقل الأمل: حلم، صغار، واقفًا.", 0.25, "ar.cohesion.effect", "b")
st("s21", "q8", "q8-e1", "mcq", "ما إعراب الفعل «تسألُ» في «تسألُني أعماقُها» (السّطر العاشر)؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره", "فعل مضارع منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "فعل مضارع مجزوم وعلامة جزمه السّكون", "فعل مضارع مرفوع وعلامة رفعه الضّمّة المقدّرة على آخره"]},
   {"correct": 0}, "تسألُ: فعل مضارع مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره.", 0.25, "ar.grammar.irab")
st("s22", "q8", "q8-e2", "mcq", "ما إعراب النّون في «تسألني»؟",
   {"options": ["نون الوقاية لا محلّ لها من الإعراب", "نون النّسوة ضمير متّصل مبنيّ في محلّ رفع فاعل", "نون التّوكيد الخفيفة لا محلّ لها من الإعراب", "حرف من أصل الفعل"]},
   {"correct": 0}, "النّون: نون الوقاية لا محلّ لها من الإعراب.", 0.25, "ar.grammar.irab")
st("s23", "q8", "q8-e3", "fill_blank", "أكمل إعراب الياء في «تسألني»:",
   {"text": "الياء: ضمير متّصل مبنيّ على ____ في محلّ ____ مفعول به.", "bank": ["السّكون", "نصب", "الفتح", "جرّ", "رفع"]},
   {"blanks": [["السّكون"], ["نصب"]]}, "الياء: ضمير متّصل مبنيّ على السّكون في محلّ نصب مفعول به.", 0.25, "ar.grammar.irab")
st("s24", "q8", "q8-e4", "mcq", "ما إعراب «لو» في قوله: «لو ضاع منّا الغدُ» (السّطر الرّابع عشر)؟",
   {"options": ["حرف امتناع لامتناع مبنيّ على السّكون لا محلّ له من الإعراب", "حرف شرط جازم مبنيّ على السّكون لا محلّ له من الإعراب",
                "حرف مصدريّ مبنيّ على السّكون لا محلّ له من الإعراب", "حرف تمنٍّ مبنيّ على السّكون لا محلّ له من الإعراب"]},
   {"correct": 0}, "لو: حرف امتناع لامتناع مبنيّ على السّكون لا محلّ له من الإعراب.", 0.25, "ar.grammar.irab")
st("s25", "q8", "q8-e5", "mcq", "ما المحلّ الإعرابيّ لجملة (لاكَهُ) في قوله: «لأنّه أحسّه سنهْ، و(لاكَهُ)… استنشقه سنهْ»؟",
   {"options": ["جملة فعليّة معطوفة في محلّ رفع", "جملة فعليّة معطوفة لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "(لاكه): جملة فعليّة معطوفة في محلّ رفع (معطوفة على جملة «أحسّه» الواقعة خبرًا لـ«أنّ»).", 0.25, "ar.grammar.sentence_case")
st("s26", "q8", "q8-e6", "mcq", "ما المحلّ الإعرابيّ لجملة (تذوده عن أرضه الحزينة) في قوله: «انطلقتْ كتائب التّتارْ (تذودُه عن أرضِه الحزينهْ)»؟",
   {"options": ["جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ رفع نعت", "جملة فعليّة في محلّ جرّ مضاف إليه"]},
   {"correct": 0}, "(تذوده): جملة فعليّة في محلّ نصب حال.", 0.25, "ar.grammar.sentence_case")
st("s27", "q9", "q9-e1", "mcq", "ما الدّلالة الّتي أفادها حرف «في» في المقطع الأوّل («في عيونه»، «في قلبه»، «في صدره»)؟",
   {"options": ["الظّرفيّة المجازيّة", "الظّرفيّة المكانيّة الحقيقيّة", "الاستعلاء", "المصاحبة"]},
   {"correct": 0}, "في: الظّرفيّة المجازيّة.", 0.25, "ar.cohesion.connectors")
st("s28", "q9", "q9-e2", "mcq", "ما الدّلالة الّتي أفادتها اللاّم في «لأنّه أحسّه سنهْ»؟",
   {"options": ["التّعليل", "الملكيّة", "الاستحقاق", "التّوكيد"]},
   {"correct": 0}, "اللاّم: التّعليل.", 0.25, "ar.cohesion.connectors")
st("s29", "q9", "q9-e3", "mcq", "ما الدّلالة الّتي أفادتها الفاء في «فأصبحت آلامُه - في صدره - حقدا»؟",
   {"options": ["التّرتيب والتّعقيب", "التّرتيب مع التّراخي", "الاستئناف", "التّخيير"]},
   {"correct": 0}, "الفاء: التّرتيب والتّعقيب.", 0.25, "ar.cohesion.connectors")
st("s30", "q9", "q9-e4", "fill_blank", "أكمل دلالة الحرف «بل» في «بل أملاً ينتظرُ الغدَا»:",
   {"text": "بل: ____.", "bank": ["الإضراب", "التّعليل", "التّخيير", "التّشبيه"]},
   {"blanks": [["الإضراب"]]}, "بل: الإضراب.", 0.25, "ar.cohesion.connectors")
st("s31", "q10", "q10-e1", "mcq", "سمّ الصّورة البيانيّة في قوله: «ظلّ واقفًا».",
   {"options": ["كناية عن صفة الصّمود", "كناية عن موصوف", "استعارة مكنيّة", "تشبيه بليغ"]},
   {"correct": 0}, "الصّورة البيانيّة: كناية عن صفة الصّمود.", 0.5, "ar.rhetoric.metonymy")
st("s32", "q10", "q10-e2", "mcq", "ما وجه بلاغة الصّورة في «ظلّ واقفًا»؟",
   {"options": ["إبراز معنى الصّمود وإعطاء الدّليل عليه (الوقوف)", "تشخيص المعنويّ في صورة إنسان", "الإيجاز بحذف أداة التّشبيه ووجه الشّبه", "تحسين اللّفظ بتوافق الجرس"]},
   {"correct": 0}, "بلاغتها: إبراز معنى الصّمود وإعطاء الدّليل عليه (الوقوف).", 0.5, "ar.rhetoric.effect")
PRO_EXPL = ("الدّراسة العروضيّة للسّطر الرّابع: وخَطْطَ قَبْ | رَهُو على | ذُرَ تْتِلالْ = //0//0 //0//0 //0//00 = مُتَفْعِلُنْ مُتَفْعِلُنْ مُتَفْعِلَانْ؛ "
            "تفعيلة الرّجز. والتّغيير الّذي جدّ على القالب: هو شعر التّفعيلة (الاعتماد على نظام السّطر، تعدّد الوزن والقافية…).")
st("s33", "q11", "q11-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر «وخط قبره على ذُرى التّلال»:",
   {"text": "وخَطْطَ قَبْ / ____ / ____", "bank": ["رَهُو على", "ذُرَ تْتِلالْ", "رَهُ على", "ذُرى التّلال"]},
   {"blanks": [["رَهُو على"], ["ذُرَ تْتِلالْ"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s34", "q11", "q11-e2", "mcq", "ما الرّموز العروضيّة للسّطر «وخط قبره على ذُرى التّلال»؟",
   {"options": ["//0//0 //0//0 //0//00", "/0/0//0 //0//0 //0//00", "//0//0 /0/0//0 //0//0", "///0//0 //0//0 //0//00"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s35", "q11", "q11-e3", "mcq", "ما تفعيلات السّطر؟",
   {"options": ["مُتَفْعِلُنْ مُتَفْعِلُنْ مُتَفْعِلَانْ", "مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلَانْ", "مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلَانْ", "مَفَاعِيلُنْ مَفَاعِيلُنْ فَعُولُنْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s36", "q11", "q11-e4", "mcq", "ما التّفعيلة الّتي بُني عليها السّطر؟",
   {"options": ["تفعيلة الرّجز", "تفعيلة الكامل", "تفعيلة المتدارك", "تفعيلة الرّمل"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s37", "q11", "q11-e5", "multi", "ما الّذي جدّ على القالب الشّعريّ للقصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["شعر التّفعيلة: الاعتماد على نظام السّطر", "تعدّد الوزن والقافية", "التزام نظام الشّطرين", "وحدة الرّويّ في القصيدة كلّها"]},
   {"correct": [0, 1]}, "التّغيير الّذي جدّ على القالب: هو شعر التّفعيلة (الاعتماد على نظام السّطر، تعدّد الوزن والقافية…).", 0.5, "ar.literature.renewal")
# ── ثالثًا: التّقويم النّقديّ ──
st("s38", "q12", "q12-e1", "mcq", "ما مدى تجاوب الأدباء العرب مع القضيّة الفلسطينيّة؟",
   {"options": ["تجاوبوا معها تجاوبًا كبيرًا من مختلف أصقاع الوطن العربيّ، واعتبروها قضيّتهم", "تجاوبوا معها تجاوبًا محدودًا اقتصر على شعراء فلسطين وحدهم",
                "أعرضوا عنها وانصرفوا إلى الغزل والوصف", "تناولوها نثرًا فقط دون الشّعر"]},
   {"correct": 0}, "تجاوب الأدباء العرب مع القضيّة الفلسطينيّة تجاوبًا كبيرًا من مختلف أصقاع الوطن العربيّ، واعتبروها قضيّتهم.", 0.75, "ar.literature.context")
st("s39", "q12", "q12-e1", "multi", "من الشّعراء الّذين تجاوبوا مع القضيّة الفلسطينيّة: (اختر كلّ ما يصحّ)",
   {"options": ["نزار قبّاني", "سميح القاسم", "بلقاسم خمّار", "امرؤ القيس", "ابن نباتة المصريّ"]},
   {"correct": [0, 1, 2]}, "ومن هؤلاء: نزار قبّاني، سميح القاسم، بلقاسم خمّار؛ أمّا امرؤ القيس وابن نباتة فمن عصور سابقة.", 0.75, "ar.literature.context", "b")
st("s40", "q12", "q12-e2", "mcq", "ما علاقة القضيّة الفلسطينيّة ببروز ظاهرة الحزن والألم عند الشّعراء المعاصرين؟",
   {"options": ["برزت ظاهرة الحزن والألم لتوالي الهزائم واستمرار الاحتلال وتفاقم المعاناة", "برزت احتفاءً بانتصارات الجيوش العربيّة",
                "لا علاقة بينهما، فالحزن عندهم ذاتيّ بحت", "برزت لأنّ الشّعراء عاشوا في رخاء وترف"]},
   {"correct": 0}, "علاقتها ببروز ظاهرة الحزن والألم: لتوالي الهزائم واستمرار الاحتلال وتفاقم المعاناة.", 0.75, "ar.literature.trend")
st("s41", "q12", "q12-e2", "fill_blank", "أكمل علاقة القضيّة الفلسطينيّة ببروز ظاهرة الحزن والألم:",
   {"text": "برزت ظاهرة الحزن والألم لتوالي ____ واستمرار ____ وتفاقم ____.", "bank": ["الهزائم", "الاحتلال", "المعاناة", "الانتصارات", "السّلام", "الرّخاء"]},
   {"blanks": [["الهزائم"], ["الاحتلال"], ["المعاناة"]]}, "«علاقتها ببروز ظاهرة الحزن والألم لتوالي الهزائم واستمرار الاحتلال وتفاقم المعاناة».", 0.75, "ar.literature.trend", "b")
POS_SPEC = {"task": "إبداء الموقف من مسؤوليّة الأديب نحو قضايا الوطن والأمّة", "question": QP[15], "quotation": QP[14],
            "model": "الإجابة النّموذجيّة: «موقف المترشّح من مسؤوليّة الأديب نحو قضايا الوطن والأمّة (أن يشير إلى ظاهرة الالتزام)»."}
essay("s42", "q12", "q12-e3", "موقفك من مسؤوليّة الأديب نحو قضايا الوطن والأمّة", "الموقف", "موقف واضح يشير إلى ظاهرة الالتزام", 1, POS_SPEC,
      "موقف المترشّح من مسؤوليّة الأديب نحو قضايا الوطن والأمّة: أن يشير إلى ظاهرة الالتزام.", "ar.comprehension.opinion")

_check()
assert len(P1_STANZAS) == 3 and QP[0].startswith("أوّلا") and QP[7].startswith("ثانيا") and QP[13].startswith("ثالثا") and len(QP) == 16
assert P1_STANZAS[1].split("\n")[3].startswith("تسألُنِي") and P1_STANZAS[1].split("\n")[7].startswith("لو ضاع") and P1_STANZAS[2].split("\n")[4] == "وخط قبره على ذُرى التّلال"

doc = {
    "schema_version": 1,
    "set_id": "ar-bac-2017-lit-s2-p1",
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p1",
        "kind": "BAC", "year": 2017, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 1,
        "title": "بكالوريا 2017 (الدّورة الثّانية) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (صلاح عبد الصّبور: ثلاث صور من غزّة)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} (بكالوريا العربية 2017 اداب وفلسفة الدورة2 الثانية.docx)",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_الدورة_الاستثنائية_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("session: الدورة الثانية. نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة 2017، الدّورة الثّانية، "
                  "وفي رأس الموضوع الرّسميّ: «الدّورة الاستثنائيّة»، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx، "
                  f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}؛ قوبل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الدورة_الاستثنائية_الموضوع.pdf، ص1–2) فلم يظهر سطر ناقص. "
                  "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 1–2، قُرئتا مصوّرتين لأنّ طبقة النّصّ في PDF معكوسة؛ سطر س1 والتّقطيع بدقّة 300). "
                  "القصيدة في خليّتين فجُعلت ثلاثة مقاطع. المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
                  "مؤجَّل (essay_builder): الرّأي وتعليله في س4 (0.5+0.5؛ المنتظر موافقة الشّاعر)، التّلخيص س6 (3×1)، وموقف المترشّح في التّقويم النّقديّ (01)."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T12:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive، مع مقابلة الموضوع الرّسميّ؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
