"""Conversion: BAC 2013 (session عاديّة، جوان 2013) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (نزار قبّاني، «أحمل بيروت…»).
Exam (most faithful source): gdrive 1X0MOAy5MKGN4HlyM4AwsI1TTvYaV99EP (بكالوريا العربية 2013 شعبة علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1TA5Pej8yTNDz4WjR8qfkEz6PqMTGZXM9;
official ONEC paper: gdrive 1XtYf5zdZpWRB0r39HQxbM6bnf5U8ut6y (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 11ot5GjpL76tQyBuRkaVVMpBaMCngiZn3 (02_التصحيح.pdf, pages 1–2).

Method (as the BAC 2015–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed; the free-verse poem sits in a two-cell table
read cell by cell, empty lines dropped) and re-checked programmatically against it. The docx was compared line by line
with the ONEC paper (rendered at 150 dpi, doubtful words re-read at 300 dpi). Both PDFs are scans (no text layer), so the
mark scheme was read from the rendered pages. Every mark comes from the official scheme; correct options and
explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper header «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» (correction: «الشّعب العلميّة المشتركة»)
  ⇒ SCI, MATH, TM, GE (the docx header says «علوم تجريبية» only).
- docx defect fixed from the ONEC paper: stanza 2 «صار جرحي قبيلةٌ» (wrong tanwīn) ⇒ «قبيلةً» as on the ONEC paper
  (the khabar of «صار»; Part 2 Q5 quotes the phrase). Other differences are diacritics or layout only («(12 نقاط)» vs ONEC
  «نقطة», «-1-» vs «- 1 -», ONEC prints the parsed words in bold) ⇒ docx kept.
- The poem is cut into its four stanzas («-1-»…«-4-»; stanza 3 runs over both table cells) as four text documents.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items (more listed than required / others
  accepted) ⇒ one element; exactly the required distinct items, or distinct demands ⇒ one element per item.
- Q1 1.5. Q2 «3×0.5» three phrases among seven ⇒ one element. Q3 01. Q4 «2×0.5» two phrases among five (one element)
  + «3×0.5» the meaning of الالتزام («قد يأتي المترشّح بمفاهيم أخرى صحيحة» ⇒ distractors are only notions opposed to
  commitment). Q5 «2×0.5» the two types (الوصفيّ / السّرديّ, one element each) + 01 + 01 an indicator with example for each.
- Q6 (نثر المقطع 2، «من السّطر 5 إلى 12») 01 المضمون / 01 أسلوب المترشّح ولغته / 0.5 الحجم ⇒ three deferred essay_builder elements.
- Part 2 Q1 01 (الحقل القوميّ; «الوطنيّ/السّياسيّ» are not used as distractors). Q2 «3×0.5» three meanings among four
  (others accepted) ⇒ one element. Q3 «2×0.5» words + «2×0.5» sentences ⇒ four elements.
  «شهادة»: the scheme says «تمييز»; «حال» (a common reading) is deliberately NOT a distractor. «يحترف» follows a
  qualified indefinite noun, so «حال» is not a distractor there either.
- Q4 «3×0.25» one connector of each type (حروف الجرّ / حروف العطف / الضّمائر) ⇒ three elements.
- Q5 «3×0.5» the type of each image (two تشبيه بليغ + one استعارة مكنيّة) ⇒ three elements; «2×0.5» the secret of the
  two similes (one element per simile); 0.25 the secret of the metaphor. «بيروت قصيدة مطعونة» has no «استعارة»
  distractor and «أحمل منفاي في حقائبي» no «كناية» distractor.
- Deferred: Q6 (2.5). Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2013-sci-p1"
DOCX_ID = "1X0MOAy5MKGN4HlyM4AwsI1TTvYaV99EP"
DOCX_TITLE = "بكالوريا العربية 2013 شعبة علوم تجريبية.docx"
PDF_ID = "1TA5Pej8yTNDz4WjR8qfkEz6PqMTGZXM9"
OFFICIAL_ID = "1XtYf5zdZpWRB0r39HQxbM6bnf5U8ut6y"
CORR_ID = "11ot5GjpL76tQyBuRkaVVMpBaMCngiZn3"
SOURCE_STREAMS = ["SCI", "MATH", "TM", "GE"]

# ── الموضوع الأوّل (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P1_INTRO = "النّـــــص:   يقول الشّاعر نزار قباني:"
P1_STANZAS = ["-1-\nأحمل الزمن المحترق في عينيّ، وأسافر إليكم\nأحمل بيروتَ قصيدة مطعونة على راحة يدي\nوأقدّم جسدها للعالم شهادة ناصعةً على عصر\nعربيّ يَحتَرف قتل القصائد.", "-2-\nقبل عام تلاقينا.\nكان جرحي لا يزال في طفولته، وكان حزني\nلا يزال يتعلّم الكلمات الأولى.\nبعد عام، صار جرحي قبيلةً من الجراح. وصار\nحزني وطنا، وصار أمَّة.\nكنت أتصوّر أنّ الحزن يُمكن أن يصبح صديقا\nولكنني لم أتصور أن يصبح الحزن وطنا نسكنه\nونتكلّم لغته، ونحمل جنسيّته.", "-3-\nأحمل منفَاي في حقائبي، وأسافر إليكم\nحين يصبح صوتك مادّة كماليّة\nتدفع الرّسوم الجمركيّة\nحين تصبح الحريّة غير مُرخّص لها\nفأنت منفيّ\nأحمل بيروت نجمةً مضرّجةً بدمها\nوأسافر إليكم.", "-4-\nبيروت.. بيروت.. بيروت..\nيا سلطانةً، يا قنديلا مشتعلا في القلب\nماذا بقي من بيروت؟\nسوى دموعها الممتزجة بمياه البحر\nآه.. ما أصعب موت البَجَعِ!\nلو قرأنا التاريخ ما ضاعت بيروت.\nوكان الأمل، أن تتم الولادة دون ألم\nودون شق بطن\nلكن ليس لدينا على امتداد\nالوطن العربيّ ولادات طبيعيّة.\nلأنّه ليس لدينا حمل طبيعيّ."]
P1_QP = ["أوّلا- البناء الفكري: (12 نقاط)", "ماذا كان يحمل الشّاعر أثناء سفره؟", "نبرة الحزن والألم بارزة في النّص. حدّد ثلاث عبارات تدل على ذلك.", "ختم الشاعر نصّه بالإشارة إلى أمل لم يتحقّق. وضّحه.", "الشاعر ملتزم بقضايا أمّته. دلّ على ذلك بعبارتين من النّص، موضّحا معنى الالتزام.", "في النص نمطان بارزان. ما هما؟ اذكر مؤشرًا لكل منهما مع التمثيل.", "انثر المقطع رقم - 2 - بأسلوبك الخاص.", "ثانيا- البناء اللّغوي: (08 نقاط)", "في أيّ حقل دلاليّ تضع السّياقات الآتية:\nعصر عربي - وطنا - أمّة - نتكلّم لغته - نحمل جنسيّته - الوطن العربيّ.", "كرّر الشّاعر كلمة \" بيروت\" عدة مرّات. فما هي دلالات هذا التّكرار في نظرك؟", "أعرب ما يلي إعراب مفردات:\n\" شهادة\" الواقعة في المقطع رقم - 1 -\n\" لو\" الواقعة في المقطع رقم – 4 -\nوأعرب ما يلي إعراب جمل:\n\"يحتَرِفُ\" الواقعة في المقطع رقم - 1 -\n\"وأسافر إليكم\" الواقعة في آخر المقطع رقم - 3 -", "وظّف الشاعر مجموعة من الروابط ساهمت في اتساق النّصّ وانسجامه. استخرج ثلاثة منها مختلفة.", "إليك العبارات الآتية:\n\"بيروت قصيدة مطعونة\" الواقعة في المقطع رقم - 1 -\n\"صار جرحي قبيلة \" الواقعة في المقطع رقم - 2 -\n\" أحمل منفاي في حقائبي\" الواقعة في المقطع رقم - 3 -\nبين نوع الصور البيانية التي تضمّنتها هذه العبارات وسر بلاغتها."]

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


def essay(sid, qid, eid, title, crit, ind, pts, spec, expl, skill, variant="a"):
    S.append({"id": sid, "source_question_id": qid, "rubric_element_id": eid, "variant": variant, "type": "essay_builder",
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
        for d in qq["documents"]:
            assert (d.get("text") or d.get("table")), (qq["id"], d["id"])
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
        assert s["points"] > 0 and abs(s["points"] * 4 - round(s["points"] * 4)) < 1e-9, (s["id"], "points not a multiple of 0.25")
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
            assert s["review_status"] == "needs_human_review", s["id"]
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
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"

QP = P1_QP
assert len(P1_STANZAS) == 4 and QP[0].startswith("أوّلا") and QP[7].startswith("ثانيا") and len(QP) == 13
assert "قبيلةً من الجراح" in P1_STANZAS[1] and P1_STANZAS[0].endswith("يَحتَرف قتل القصائد.") and P1_STANZAS[2].endswith("وأسافر إليكم.")
P1, P2 = QP[0], QP[7]
DOCS = [{"id": "d-intro", "kind": "text", "caption": "تقديم النّصّ", "text": P1_INTRO}] + [
    {"id": f"d-st{k + 1}", "kind": "text", "caption": cap, "text": P1_STANZAS[k]}
    for k, cap in enumerate(["المقطع الأوّل", "المقطع الثّاني", "المقطع الثّالث", "المقطع الرّابع"])]

q("q1", "1", P1, QP[1], 1.5, [el("q1-e1", "ما كان يحمله الشّاعر أثناء سفره", 1.5)], DOCS)
q("q2", "2", P1, QP[2], 1.5, [el("q2-e1", "ثلاث عبارات دالّة على نبرة الحزن والألم (3×0.5)", 1.5)], DOCS)
q("q3", "3", P1, QP[3], 1, [el("q3-e1", "توضيح الأمل الّذي لم يتحقّق", 1)], DOCS)
q("q4", "4", P1, QP[4], 2.5, [el("q4-e1", "عبارتان دالّتان على التزام الشّاعر (2×0.5)", 1), el("q4-e2", "توضيح معنى الالتزام (3×0.5)", 1.5)], DOCS)
q("q5", "5", P1, QP[5], 3, [el("q5-e1", "النّمط البارز الأوّل", 0.5), el("q5-e2", "النّمط البارز الثّاني", 0.5),
                             el("q5-e3", "مؤشّر النّمط الوصفيّ مع التّمثيل", 1), el("q5-e4", "مؤشّر النّمط السّرديّ مع التّمثيل", 1)], DOCS)
q("q6", "6", P1, QP[6], 2.5, [el("q6-e1", "نثر المقطع 2: المضمون", 1), el("q6-e2", "نثر المقطع 2: أسلوب المترشّح ولغته", 1),
                               el("q6-e3", "نثر المقطع 2: الحجم", 0.5)], DOCS)
q("q7", "1", P2, QP[8], 1, [el("q7-e1", "تسمية الحقل الدّلاليّ", 1)], DOCS)
q("q8", "2", P2, QP[9], 1.5, [el("q8-e1", "دلالات تكرار «بيروت» (3×0.5)", 1.5)], DOCS)
q("q9", "3", P2, QP[10], 2, [el("q9-e1", "إعراب «شهادة»", 0.5), el("q9-e2", "إعراب «لو»", 0.5),
                              el("q9-e3", "محلّ جملة «يحترف»", 0.5), el("q9-e4", "محلّ جملة «وأسافر إليكم»", 0.5)], DOCS)
q("q10", "4", P2, QP[11], 0.75, [el("q10-e1", "رابط: حرف جرّ", 0.25), el("q10-e2", "رابط: حرف عطف", 0.25), el("q10-e3", "رابط: ضمير", 0.25)], DOCS)
q("q11", "5", P2, QP[12], 2.75, [el("q11-e1", "«بيروت قصيدة مطعونة»: النّوع", 0.5), el("q11-e2", "«صار جرحي قبيلة»: النّوع", 0.5),
                                  el("q11-e3", "«أحمل منفاي في حقائبي»: النّوع", 0.5), el("q11-e4", "سرّ بلاغة التّشبيه الأوّل", 0.5),
                                  el("q11-e5", "سرّ بلاغة التّشبيه الثّاني", 0.5), el("q11-e6", "سرّ بلاغة الاستعارة", 0.25)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ماذا كان يحمل الشّاعر أثناء سفره؟",
   {"options": ["الزّمن المحترق لبيروت المطعونة", "ذكريات طفولته السّعيدة في بيروت", "هدايا من بيروت إلى أصدقائه", "رسائل سلام من الحكّام العرب"]},
   {"correct": 0}, "كان الشّاعر يحمل معه الزّمن المحترق لبيروت المطعونة.", 0.75, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "كان الشّاعر يحمل معه الزّمن ____ لبيروت ____.", "bank": ["المحترق", "المطعونة", "الجميل", "المنتصرة"]},
   {"blanks": [["المحترق"], ["المطعونة"]]}, "«كان الشّاعر يحمل معه الزّمن المحترق لبيروت المطعونة».", 0.75, "ar.comprehension.details", "b")
SAD_EXPL = ("العبارات الدّالّة على نبرة الحزن والألم: الزّمن المحترق – قتل القصائد – صار جرحي أمّة – أحمل منفاي – تدفع الرّسوم الجمركيّة – "
            "بيروت مضرّجة بدمها – دموعها الممتزجة بمياه البحر… (يكتفي المترشّح بذكر ثلاث عبارات فقط).")
st("s03", "q2", "q2-e1", "multi", "حدّد العبارات الدّالّة على نبرة الحزن والألم في النّصّ. (اختر كلّ ما يصحّ)",
   {"options": ["الزّمن المحترق", "قتل القصائد", "بيروت مضرّجة بدمها", "دموعها الممتزجة بمياه البحر", "قبل عام تلاقينا", "يا سلطانةً"]},
   {"correct": [0, 1, 2, 3]}, SAD_EXPL + " أمّا «قبل عام تلاقينا» فسرد لحدث، و«يا سلطانةً» نداء تمجيد.", 1, "ar.comprehension.evidence")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل عبارتين أخريين دالّتين على الحزن والألم:",
   {"text": "«أحمل ____ في حقائبي» – «تدفع الرّسوم ____»", "bank": ["منفاي", "الجمركيّة", "أحلامي", "الوطنيّة"]},
   {"blanks": [["منفاي"], ["الجمركيّة"]]}, SAD_EXPL, 0.5, "ar.comprehension.evidence", "b")
st("s05", "q3", "q3-e1", "mcq", "ختم الشّاعر نصّه بالإشارة إلى أمل لم يتحقّق. ما هو؟",
   {"options": ["استتباب الأمن والاستقرار في بيروت ومنه إلى الوطن العربيّ", "عودة الشّاعر إلى قريته بعد طول غياب",
                "أن تتمّ ولادة طفل للشّاعر دون ألم ولا جراحة", "أن ينال الشّاعر جائزة على قصائده"]},
   {"correct": 0}, "الأمل الّذي لم يتحقّق هو استتباب الأمن والاستقرار في بيروت ومنه إلى الوطن العربيّ، بسبب تبعات الضّعف والهوان الّذي أصاب الأمّة.", 0.5, "ar.comprehension.explain")
st("s06", "q3", "q3-e1", "fill_blank", "أكمل سبب عدم تحقّق هذا الأمل:",
   {"text": "لم يتحقّق ذلك بسبب تبعات ____ و____ الّذي أصاب الأمّة.", "bank": ["الضّعف", "الهوان", "القوّة", "الرّخاء"]},
   {"blanks": [["الضّعف"], ["الهوان"]]}, "«…بسبب تبعات الضّعف والهوان الّذي أصاب الأمّة».", 0.5, "ar.comprehension.explain", "b")
COMMIT_EXPL = ("العبارات الدّالّة على أنّ الشّاعر ملتزم بقضايا أمّته: أسافر إليكم – صار حزني وطنا وصار أمّة – أحمل بيروت نجمة مضرّجة بدمها – "
               "لو قرأنا التّاريخ ما ضاعت بيروت – على امتداد الوطن العربيّ… (يكتفي المترشّح بذكر عبارتين).")
st("s07", "q4", "q4-e1", "fill_blank", "أكمل عبارتين من النّصّ تدلّان على التزام الشّاعر بقضايا أمّته:",
   {"text": "«صار حزني وطنا، وصار ____» – «لو قرأنا ____ ما ضاعت بيروت»", "bank": ["أمّة", "التّاريخ", "قبيلة", "الشّعر"]},
   {"blanks": [["أمّة"], ["التّاريخ"]]}, COMMIT_EXPL, 0.5, "ar.comprehension.evidence")
st("s08", "q4", "q4-e1", "multi", "أيّ العبارات الآتية وردت في النّصّ دالّةً على التزام الشّاعر بقضايا أمّته؟ (اختر كلّ ما يصحّ)",
   {"options": ["أسافر إليكم", "أحمل بيروت نجمةً مضرّجةً بدمها", "على امتداد الوطن العربيّ", "أعتزل النّاس وهمومهم", "لا شأن لي بما يجري في بيروت"]},
   {"correct": [0, 1, 2]}, COMMIT_EXPL + " والعبارتان الأخريان ليستا من النّصّ وتناقضان الالتزام.", 0.5, "ar.comprehension.evidence", "b")
ILT_EXPL = ("الالتزام هو: توظيف الفنّ لغايات اجتماعيّة وسياسيّة – التّعبير عن الواقع والارتقاء به، واستشراف المستقبل – استكمال عمليّة التّغيير "
            "والبحث عن الحلول… (قد يأتي المترشّح بمفاهيم أخرى صحيحة تؤخذ بعين الاعتبار).")
st("s09", "q4", "q4-e2", "multi", "وضّح معنى الالتزام: أيّ ممّا يلي من معانيه؟ (اختر كلّ ما يصحّ)",
   {"options": ["توظيف الفنّ لغايات اجتماعيّة وسياسيّة", "التّعبير عن الواقع والارتقاء به، واستشراف المستقبل", "استكمال عمليّة التّغيير والبحث عن الحلول",
                "الفنّ للفنّ والانصراف عن قضايا المجتمع", "الهروب من الواقع إلى عالم الخيال والأحلام"]},
   {"correct": [0, 1, 2]}, ILT_EXPL + " أمّا «الفنّ للفنّ» و«الهروب من الواقع» فنقيض الالتزام.", 1, "ar.literature.trend")
st("s10", "q4", "q4-e2", "fill_blank", "أكمل معنى الالتزام:",
   {"text": "الالتزام: توظيف الفنّ لغايات ____ و____، والتّعبير عن الواقع والارتقاء به و____ المستقبل.",
    "bank": ["اجتماعيّة", "سياسيّة", "استشراف", "شخصيّة", "تجاهل"]},
   {"blanks": [["اجتماعيّة"], ["سياسيّة"], ["استشراف"]]}, ILT_EXPL, 0.5, "ar.literature.trend", "b")
st("s11", "q5", "q5-e1", "mcq", "أحد النّمطين البارزين في النّصّ تكثر فيه النّعوت والإضافات وأدوات التّوكيد والتّشبيهات. ما هو؟",
   {"options": ["الوصفيّ", "السّرديّ", "التّفسيريّ", "الحواريّ"]},
   {"correct": 0}, "النّمطان البارزان في النّصّ هما: الوصفيّ والسّرديّ؛ ومن مؤشّرات الوصفيّ: النّعوت، الإضافات، أدوات التّوكيد، الأفعال الماضية، كثرة التّشبيهات.", 0.5, "ar.text.type")
st("s12", "q5", "q5-e2", "mcq", "والنّمط الثّاني البارز في النّصّ يقوم على سرد حادثة مفردة أو مجموعة أحداث. ما هو؟",
   {"options": ["السّرديّ", "الوصفيّ", "التّفسيريّ", "الحواريّ"]},
   {"correct": 0}, "النّمطان البارزان في النّصّ هما: الوصفيّ والسّرديّ؛ ومؤشّر السّرديّ: سرد حادثة مفردة أو مجموعة أحداث.", 0.5, "ar.text.type")
st("s13", "q5", "q5-e3", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط الوصفيّ بمثاله من النّصّ.",
   {"lefts": ["النّعوت", "الإضافات", "أدوات التّوكيد", "كثرة التّشبيهات"],
    "rights": ["المحترق، مطعونة", "يدي، جسدها", "أنّ، لكنّ", "بيروت قصيدة، جرحي قبيلة", "يا سلطانةً"]},
   {"pairs": [0, 1, 2, 3]}, "مؤشّر النّمط الوصفيّ: النّعوت (المحترق، مطعونة…)، الإضافات (يدي، جسدها…)، أدوات التّوكيد (أنّ، لكنّ…)، الأفعال الماضية (كان، بقي، قرأنا…)، كثرة التّشبيهات (بيروت قصيدة، جرحي قبيلة…). يكتفي المترشّح بذكر مؤشّر واحد لكلّ نمط.", 1, "ar.text.type")
st("s14", "q5", "q5-e4", "mcq", "ما مؤشّر النّمط السّرديّ في النّصّ؟",
   {"options": ["سرد حادثة مفردة أو مجموعة أحداث", "تحليل ظاهرة بهدف تيسير فهمها", "تبادل الكلام بين شخصيّتين أو أكثر", "عرض الحجج والبراهين لإقناع المتلقّي"]},
   {"correct": 0}, "مؤشّر النّمط السّرديّ: سرد حادثة مفردة أو مجموعة أحداث.", 0.5, "ar.text.type")
st("s15", "q5", "q5-e4", "multi", "اختر من النّصّ ما يمثّل للنّمط السّرديّ. (اختر كلّ ما يصحّ)",
   {"options": ["أسافر إليكم", "قبل عام تلاقينا", "لو قرأنا التّاريخ ما ضاعت بيروت", "يا سلطانةً، يا قنديلا مشتعلا في القلب", "بيروت.. بيروت.. بيروت.."]},
   {"correct": [0, 1, 2]}, "مثال السّرد: أسافر إليكم، قبل عام تلاقينا، لو قرأنا التّاريخ ما ضاعت بيروت…؛ أمّا النّداء والتّكرار فليسا من مؤشّراته.", 0.5, "ar.text.type", "b")
NATHR_SPEC = {"task": "نثر المقطع رقم 2 بأسلوب المترشّح الخاصّ", "scope": "المقطع الثّاني: من «قبل عام تلاقينا» إلى «ونحمل جنسيّته» (السّطر 5 إلى 12)",
              "text": "قصيدة نزار قبّاني (بكالوريا 2013، الشّعب العلميّة، الموضوع الأوّل)",
              "scheme": "نثر الفقرة الثّانية الممتدّة من السّطر 5 إلى 12: المضمون (01)، أسلوب المترشّح ولغته (01)، الحجم (0.5)"}
NATHR_EXPL = "يُراعى في نثر المقطع الثّاني: المضمون (01)، أسلوب المترشّح ولغته (01)، الحجم (0.5). لا يقدّم التّصحيح نموذجًا."
for sid, eid, crit, ind, pts in [("s16", "q6-e1", "المضمون", "الوفاء بمضمون المقطع الثّاني", 1),
                                 ("s17", "q6-e2", "الأسلوب واللّغة", "أسلوب المترشّح الخاصّ وسلامة لغته", 1),
                                 ("s18", "q6-e3", "الحجم", "مراعاة حجم النّثر", 0.5)]:
    essay(sid, "q6", eid, "نثر المقطع الثّاني من قصيدة نزار قبّاني", crit, ind, pts, NATHR_SPEC, NATHR_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s19", "q7", "q7-e1", "mcq", "في أيّ حقل دلاليّ تضع السّياقات: «عصر عربيّ – وطنا – أمّة – نتكلّم لغته – نحمل جنسيّته – الوطن العربيّ»؟",
   {"options": ["الحقل القوميّ", "حقل الطّبيعة", "حقل الحبّ والغزل", "حقل الحرب والقتال"]},
   {"correct": 0}, "الحقل الدّلاليّ الّذي توضع فيه السّياقات «عصر عربيّ – وطنا – أمّة – نتكلّم لغته – نحمل جنسيّته – الوطن العربيّ» هو: القوميّ.", 1, "ar.cohesion.effect")
REP_EXPL = ("دلالات تكرار كلمة «بيروت» عدّة مرّات: التّأكيد – البعد الرّمزيّ – ترابط النّصّ – لفت انتباه المتلقّي حفاظًا على تركيزه… "
            "(بإمكان المترشّح أن يهتدي إلى دلالات أخرى تؤخذ بعين الاعتبار).")
st("s20", "q8", "q8-e1", "multi", "ما دلالات تكرار كلمة «بيروت» عدّة مرّات؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّأكيد", "البعد الرّمزيّ", "ترابط النّصّ", "لفت انتباه المتلقّي حفاظًا على تركيزه", "الحشو الّذي لا فائدة منه", "عجز الشّاعر عن إيجاد ألفاظ أخرى"]},
   {"correct": [0, 1, 2, 3]}, REP_EXPL + " أمّا الحشو والعجز فلا يُعدّان دلالة للتّكرار هنا.", 1, "ar.rhetoric.style")
st("s21", "q8", "q8-e1", "fill_blank", "أكمل من دلالات تكرار «بيروت»:",
   {"text": "من دلالات هذا التّكرار: ____، و____ المتلقّي حفاظًا على تركيزه.", "bank": ["التّأكيد", "لفت انتباه", "الحشو", "تشتيت"]},
   {"blanks": [["التّأكيد"], ["لفت انتباه"]]}, REP_EXPL, 0.5, "ar.rhetoric.style", "b")
st("s22", "q9", "q9-e1", "mcq", "ما إعراب «شهادة» في قوله: «وأقدّم جسدها للعالم شهادة ناصعةً على عصر»؟",
   {"options": ["تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره",
                "نعت منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "مفعول مطلق منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«شهادةً»: تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره (كما في الإجابة النّموذجيّة).", 0.5, "ar.grammar.irab")
st("s23", "q9", "q9-e2", "mcq", "ما إعراب «لو» في قوله: «لو قرأنا التّاريخ ما ضاعت بيروت»؟",
   {"options": ["حرف امتناع لامتناع يتضمّن معنى الشّرط مبنيّ على السّكون لا محلّ له من الإعراب", "حرف شرط جازم مبنيّ على السّكون لا محلّ له من الإعراب",
                "حرف مصدريّ مبنيّ على السّكون لا محلّ له من الإعراب", "حرف تمنٍّ مبنيّ على السّكون لا محلّ له من الإعراب"]},
   {"correct": 0}, "«لو»: حرف امتناع لامتناع يتضمّن معنى الشّرط مبنيّ على السّكون لا محلّ له من الإعراب.", 0.5, "ar.grammar.irab")
st("s24", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة «يَحتَرف» في قوله: «على عصر عربيّ يَحتَرف قتل القصائد»؟",
   {"options": ["جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة في محلّ رفع خبر", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "(يحترف): جملة فعليّة في محلّ جرّ نعت (لـ«عصر»).", 0.5, "ar.grammar.sentence_case")
st("s25", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة «وأسافر إليكم» في آخر المقطع الثّالث؟",
   {"options": ["لا محلّ لها من الإعراب لأنّها معطوفة على جملة لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر",
                "جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "(أسافر إليكم): جملة لا محلّ لها من الإعراب لأنّها جملة معطوفة على جملة لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
LINK_EXPL = ("من الرّوابط الّتي ساهمت في اتّساق النّصّ وانسجامه: حروف الجرّ (في، إلى، اللّام، على…)، حروف العطف (الواو)، "
             "الضّمائر (أنت، إليكم، جرحي، صوتك، لأنّه…). يكتفي المترشّح بذكر رابط واحد من كلّ نوع.")
st("s26", "q10", "q10-e1", "mcq", "أيّ الرّوابط الآتية حرف جرّ أسهم في اتّساق النّصّ؟",
   {"options": ["«إلى» في «أسافر إليكم»", "«الواو» في «وأقدّم»", "الضّمير «أنت»", "«لو» في «لو قرأنا التّاريخ»"]},
   {"correct": 0}, LINK_EXPL, 0.25, "ar.cohesion.connectors")
st("s27", "q10", "q10-e2", "mcq", "ما نوع الرّابط «الواو» في قوله: «وأقدّم جسدها للعالم»؟",
   {"options": ["حرف عطف", "حرف جرّ", "ضمير متّصل", "اسم إشارة"]},
   {"correct": 0}, LINK_EXPL, 0.25, "ar.cohesion.connectors")
st("s28", "q10", "q10-e3", "fill_blank", "أكمل أمثلة الضّمائر الرّابطة في النّصّ:",
   {"text": "من الضّمائر الّتي ربطت أجزاء النّصّ: «أنت»، «إليكم»، «جرحي»، «____».", "bank": ["صوتك", "بيروت", "عام", "البحر"]},
   {"blanks": [["صوتك"]]}, LINK_EXPL, 0.25, "ar.cohesion.reference")
st("s29", "q11", "q11-e1", "mcq", "ما نوع الصّورة البيانيّة في «بيروت قصيدة مطعونة»؟",
   {"options": ["تشبيه بليغ", "تشبيه تمثيليّ", "كناية عن صفة", "مجاز مرسل علاقته المحلّيّة"]},
   {"correct": 0}, "«بيروت قصيدة مطعونة»: تشبيه بليغ حيث ذكر المشبّه «بيروت» والمشبّه به «قصيدة».", 0.25, "ar.rhetoric.simile")
st("s30", "q11", "q11-e1", "matching", "حدّد طرفي التّشبيه في «بيروت قصيدة مطعونة».",
   {"lefts": ["المشبّه", "المشبّه به"], "rights": ["بيروت", "قصيدة", "العالم"]},
   {"pairs": [0, 1]}, "تشبيه بليغ حيث ذكر المشبّه «بيروت» والمشبّه به «قصيدة» (وحُذفت الأداة ووجه الشّبه).", 0.25, "ar.rhetoric.simile", "b")
st("s31", "q11", "q11-e2", "mcq", "ما نوع الصّورة البيانيّة في «صار جرحي قبيلةً»؟",
   {"options": ["تشبيه بليغ", "استعارة تصريحيّة", "كناية عن موصوف", "مجاز مرسل علاقته الكلّيّة"]},
   {"correct": 0}, "«صار جرحي قبيلةً»: تشبيه بليغ حيث ذكر المشبّه «جرحي» والمشبّه به «قبيلة».", 0.25, "ar.rhetoric.simile")
st("s32", "q11", "q11-e2", "fill_blank", "أكمل شرح الصّورة في «صار جرحي قبيلةً»:",
   {"text": "تشبيه بليغ حيث ذكر المشبّه «____» والمشبّه به «____».", "bank": ["جرحي", "قبيلة", "حزني", "وطنا"]},
   {"blanks": [["جرحي"], ["قبيلة"]]}, "«صار جرحي قبيلةً»: تشبيه بليغ حيث ذكر المشبّه جرحي والمشبّه به قبيلة.", 0.25, "ar.rhetoric.simile", "b")
st("s33", "q11", "q11-e3", "mcq", "ما نوع الصّورة البيانيّة في «أحمل منفاي في حقائبي»؟",
   {"options": ["استعارة مكنيّة", "تشبيه بليغ", "استعارة تصريحيّة", "تشبيه تمثيليّ"]},
   {"correct": 0}, "«أحمل منفاي في حقائبي»: استعارة مكنيّة حيث شبّه المنفى بشيء ماديّ يُحمل ويوضع في حقائب.", 0.25, "ar.rhetoric.metaphor")
st("s34", "q11", "q11-e3", "matching", "اشرح الاستعارة في «أحمل منفاي في حقائبي»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه (مذكور)", "المشبّه به (محذوف)", "ما يدلّ على المشبّه به"],
    "rights": ["المنفى", "شيء ماديّ", "الحمل والوضع في الحقائب", "الشّاعر"]},
   {"pairs": [0, 1, 2]}, "شبّه الشّاعر المنفى (أمر معنويّ) بشيء ماديّ يُحمل ويوضع في حقائب، فحذف المشبّه به وأبقى ما يدلّ عليه (الحمل والوضع في الحقائب) على سبيل الاستعارة المكنيّة.", 0.25, "ar.rhetoric.metaphor", "b")
SIM_EXPL = "سرّ بلاغة التّشبيهين: لا فرق بين المشبّه والمشبّه به – إيضاح المعنى وبيان المراد – التّأثير في النّفس وتحريكها."
st("s35", "q11", "q11-e4", "mcq", "ما سرّ بلاغة التّشبيه في «بيروت قصيدة مطعونة»؟",
   {"options": ["جعل المشبّه والمشبّه به شيئًا واحدًا لا فرق بينهما، مع إيضاح المعنى والتّأثير في النّفس", "تقديم الحقيقة مصحوبة بالدّليل",
                "الإيجاز بالتّعبير عن الكلّ بالجزء", "إحداث جرس موسيقيّ بتوافق الحروف"]},
   {"correct": 0}, SIM_EXPL, 0.5, "ar.rhetoric.effect")
st("s36", "q11", "q11-e5", "multi", "ما سرّ بلاغة التّشبيه في «صار جرحي قبيلةً»؟ (اختر كلّ ما يصحّ)",
   {"options": ["لا فرق بين المشبّه والمشبّه به", "إيضاح المعنى وبيان المراد", "التّأثير في النّفس وتحريكها", "تقديم الحقيقة مصحوبة بالدّليل",
                "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": [0, 1, 2]}, SIM_EXPL, 0.5, "ar.rhetoric.effect")
st("s37", "q11", "q11-e6", "mcq", "ما سرّ بلاغة الاستعارة في «أحمل منفاي في حقائبي»؟",
   {"options": ["الإيجاز، وتشخيص المعنويّ في قالب ماديّ", "تقديم الحقيقة مصحوبة بالدّليل", "إحداث جرس موسيقيّ بالسّجع", "التّعبير عن الجزء بالكلّ"]},
   {"correct": 0}, "سرّ بلاغة الاستعارة: عنصر الإيجاز – تشخيص المعنويّ في قالب ماديّ…", 0.25, "ar.rhetoric.effect")

_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p1",
        "kind": "BAC", "year": 2013, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 1,
        "title": "بكالوريا 2013 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (نزار قبّاني: أحمل بيروت)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2013، الشّعب: علوم تجريبيّة، رياضيات، تقني رياضي، "
                  f"تسيير واقتصاد) في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومطابَق سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} "
                  f"(01_الموضوع.pdf، ص1–2)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. أُصلح من الموضوع الرّسميّ: «صار جرحي قبيلةٌ» في docx ← «قبيلةً». "
                  "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (الصّفحتان 1–2، ملفّ ممسوح قُرئ مصوّرًا). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8. "
                  "«شهادة» تمييز في التّصحيح فلم تُجعل «حال» مشتّتًا. مؤجَّل (essay_builder): نثر المقطع الثّاني (01 + 01 + 0.5)."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T13:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx، مطابَقة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
