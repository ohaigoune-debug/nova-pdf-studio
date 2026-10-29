"""Conversion: BAC 2013 (session عاديّة، جوان 2013) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (البشير الإبراهيميّ، من «عيون البصائر»).
Exam (most faithful source): gdrive 1Ccdpghe_jqkSyPMIK6ZLZ4xpD78idSX_ (بكالوريا العربية 2013 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 1UtHHZFFPsEdudJ-YmOYQFbc1bBCw8_nL;
official ONEC paper: gdrive 181G52CM0sU6BiUC9oE5gWp7hMrS5ptZb (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1xqlS4iCp0ZAFVbOGVXyigh1h_IgyIhyo (02_التصحيح.pdf, pages 3–4).

Method (as the BAC 2015–2023 converters): the verbatim strings below were generated from the .docx with python-docx
(runs read exactly; only outer whitespace / edge direction marks trimmed) and re-checked programmatically against it.
The docx stores the prose text one printed line per paragraph; the lines were joined with single spaces into the three
paragraphs of the ONEC paper (indented starts «في هذا الوطن…», «حافظ هذا الشّعب…», «ومهما يكن…»; Part 2 Q4 speaks of
«الفقرة الأخيرة» and «الفقرتين السّابقتين»). The docx was compared line by line with the ONEC paper (rendered at 150 dpi).
Both PDFs are scans, so the mark scheme was read from the rendered pages (Part 2 Q1 re-read at 300 dpi).

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction «آداب وفلسفة» ⇒ LIT.
- docx defect fixed from the ONEC paper: «على طول الزن» ⇒ «على طول الزمن». Other differences are diacritics only.
- Underlines (docx and ONEC): «الوطن», «لكنّهم» (the scheme parses «لكنّ» 0.25 and «هم» 0.25); bracketed: (أرادوا),
  (أن أبقى جروحا دامية).
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required
  distinct items, or distinct demands ⇒ one element per item.
- Q1 «0.25×4» four items among six ⇒ one element. Q2 01. Q3 «2×0.5» for one continuous answer (not labelled) ⇒ one
  element of 1 with two steps. Q4 0.5 the genre (المقال السّياسيّ الاجتماعيّ) + «3×0.25» three features among four.
  Q5 «2×0.5» (the judgment confirmed + the evidence, not labelled) ⇒ one element; the scheme's «السّجع في: الفضائل
  والرّذائل» is not used in the matching step (the pair is also a طباق, which would make the matching ambiguous).
  Q6 01 the type (التّفسيريّ; «السّرديّ/الوصفيّ/الحجاجيّ» are not used as distractors) + «3×0.25» three indicators
  (others accepted) ⇒ one element.
- Q7 (تلخيص) «3×01» = المضمون / الأسلوب الخاصّ / الحجم (ما يقارب ثلث النّصّ) ⇒ three deferred essay_builder elements.
- Part 2 Q1 «4×0.25» four words among «جروح، تهدم، تضليل، عبث..» ⇒ one element; «تهدم» does not occur in the text of the
  paper (abridged «بتصرّف») ⇒ not used. Q2 «4×0.25» = مساجد / مفاعل / فضائل / فعائل ⇒ four elements; the second form's
  distractors exclude other valid forms (قوانين، طرائق، الرّذائل، هياكل). Q3: 0.5 / 0.25 / 0.25 / 0.5 / 0.5 one element
  per line. «الوطن» (بدل) has no «نعت / عطف بيان» distractor; (أن أبقى…) has no «صلة الموصول الحرفيّ» distractor.
  Q4 01 («علاقة تكامليّة… كان نتيجته العار»; «علاقة سببيّة» is not a distractor). Q5 «4×0.25» (type, relation,
  explanation, rhetoric — not labelled) ⇒ one element of 1 with four 0.25 steps.
- Part 3: «2×0.75» per stage (stage + its features, not labelled ⇒ one element of 1.5 per stage), 0.25 النّمط التّصويريّ,
  0.25 النّمط التّثقيفيّ, «2×0.25» two figures among five («يكتفي المترشّح بذكر علمين», though the paper asks three).
- Deferred: Q7 summary (3). Distractors are the converter's own and need review; none is an alternative the scheme accepts.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2013-lit-p2"
DOCX_ID = "1Ccdpghe_jqkSyPMIK6ZLZ4xpD78idSX_"
DOCX_TITLE = "بكالوريا العربية 2013 شعبة اداب وفلسفة.docx"
PDF_ID = "1UtHHZFFPsEdudJ-YmOYQFbc1bBCw8_nL"
OFFICIAL_ID = "181G52CM0sU6BiUC9oE5gWp7hMrS5ptZb"
CORR_ID = "1xqlS4iCp0ZAFVbOGVXyigh1h_IgyIhyo"
SOURCE_STREAMS = ["LIT"]

# ── الموضوع الثّاني (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P2_PARAS = ["«في هذا الوطن الجزائري شعب عربي مسلم، ذو ميراث روحاني عريق. وهو الإسلام وآدابه وأخلاقه. وذو ميراث مادي شَادَهُ أسلافه لحفظ ذلك التراث. وهو المساجد بِهَيَاكلِها وأوقافها. وذو نظام قضائي مصلحي، لحفظ تكوينه العائلي والاجتماعي. وذو منظومة من الفضائل العربية الشرقية متنقلة بالإرث الطبيعي من الأصول السامية إلى الفروع النامية. وذو لسان وسعَ وَحي الله وخلد حكمة الفطرة.", "حافظ هذا الشعب على هذا الميراث قرونا تزيد على العشرة، وغالبته حوادث الدهر فلم تغلبه. جاء الاستعمار الفرنسي إلى هذا الوطن، كما تجيء الأمراض الوافدة، تحمل الموت وأسباب الموت. فوجد هذه المقومات راسخة الأصول، نامية الفروع، فتعهّد في الظّاهر باحترامها، والمحافظة عليها وقطع قَادته وأئمته العهود على أنفسهم وعلى دولتهم ليَكونن الحامين للموجود، ولكنهم عملوا في الباطن على محوها بالتدريج، وتمّ لهم - على طول الزمن بالقوة وبطرائق التضليل والتغفيل- جُزء مما (أرادوا). والاستعمار سُلٌّ يحارب أسباب المناعة في الجسم الصّحيح وهو في هذا الوطن قَد أدار قوانينه على نسخ الأحكام الإسلامية وعبَثَ بحرمة المعابد وحارب الإيمان بالإلحاد، والفضائل بحماية الرذائل، والتعليم بإفشاء الأمية.", "ومهما يكن نجاح الاستعمار في هذا الباب فما هو بالنجاح الذي يُشرّف فرنسا أو يُمجد تاريخها، بعد (أن أبقى جروحا دامية) في نفوس المسلمين.»"]
P2_REF = "«البشير الإبراهيمي»\nمن عيون البصائر ص 22 - بتصرف-"
P2_QP = ["أوّلا- البناء الفكري: (10 نقاط)", "ما الميراث العريق الذي تحتفظ به الجزائر؟", "ما المقصود بالعبارة التالية: \"غالبته حوادث الدهر فلم تغلبه\"؟", "حلّل الكاتب الاستعمار الفرنسي، مبيّنا خطورته. فيم تمثلت هذه الخطورة؟", "إلى أيّ فن أدبي ينتمي النّص؟ ما هي خصائصه؟", "الإبراهيمي من الأدباء الذين يتأنقون في أسلوبهم. أثبت أو انفِ هذا الحكم مستعينا بالنّص.", "ما النّمط الغالب على النّص؟ اذكر بعض مؤشراته مستشهدا من النّص.", "لخّص النّص معتمدا تقنية التلخيص.", "ثانيا- البناء اللّغوي: (06 نقاط)", "استخرج من النص أربع كلمات تنتمي إلى حقل الظلم.", "استخرج من النص صيغتين مختلفتين من صيغ منتهى الجموع، مبينا وزن كلّ منهما.", "أعرب ما تحته خط إعراب مفردات وما بين قوسين إعراب جمل.", "وضّح العلاقة التي تربط الفقرة الأخيرة بالفقرتين السابقتين.", "ما نوع الصورة البيانية الواردة في قول الكاتب: \"يشرّف فرنسا\"؟ وضّحها مبيّنا نوعها وبلاغتها.", "ثالثا- التّقويم النقدي: (04 نقاط)", "«قد مَرَّت المقالة بمراحل قبل أن تصل إلى صورتها المتكاملة بخصائصها».", "- ما هي المراحل التي مرّت بها المقالة؟\n- اذكر خصائص كل مرحلة، ثم ثلاثة أعلام من أعلامها."]

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

QP = P2_QP
assert len(P2_PARAS) == 3 and QP[0].startswith("أوّلا") and QP[8].startswith("ثانيا") and QP[14].startswith("ثالثا") and len(QP) == 17
assert "على طول الزمن" in P2_PARAS[1] and "ولكنهم" in P2_PARAS[1] and "(أن أبقى جروحا دامية)" in P2_PARAS[2]
P1, P2, P3 = QP[0], QP[8], QP[14]
J = lambda *ix: "\n".join(QP[i] for i in ix)
DOCS = [{"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(P2_PARAS)},
        {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P2_REF}]

q("q1", "1", P1, QP[1], 1, [el("q1-e1", "عناصر الميراث العريق (4×0.25)", 1)], DOCS)
q("q2", "2", P1, QP[2], 1, [el("q2-e1", "المقصود بالعبارة", 1)], DOCS)
q("q3", "3", P1, QP[3], 1, [el("q3-e1", "خطورة الاستعمار الفرنسيّ وفيمَ تمثّلت (2×0.5)", 1)], DOCS)
q("q4", "4", P1, QP[4], 1.25, [el("q4-e1", "الفنّ الأدبيّ", 0.5), el("q4-e2", "ثلاث من خصائصه (3×0.25)", 0.75)], DOCS)
q("q5", "5", P1, QP[5], 1, [el("q5-e1", "إثبات الحكم مع الاستعانة بالنّصّ (2×0.5)", 1)], DOCS)
q("q6", "6", P1, QP[6], 1.75, [el("q6-e1", "النّمط الغالب", 1), el("q6-e2", "ثلاثة من مؤشّراته (3×0.25)", 0.75)], DOCS)
q("q7", "7", P1, QP[7], 3, [el("q7-e1", "التّلخيص: المضمون", 1), el("q7-e2", "التّلخيص: الأسلوب الخاصّ بالمترشّح", 1), el("q7-e3", "التّلخيص: الحجم", 1)], DOCS)
q("q8", "1", P2, QP[9], 1, [el("q8-e1", "أربع كلمات من حقل الظّلم (4×0.25)", 1)], DOCS)
q("q9", "2", P2, QP[10], 1, [el("q9-e1", "صيغة منتهى الجموع الأولى", 0.25), el("q9-e2", "وزن الصّيغة الأولى", 0.25),
                              el("q9-e3", "صيغة منتهى الجموع الثّانية", 0.25), el("q9-e4", "وزن الصّيغة الثّانية", 0.25)], DOCS)
q("q10", "3", P2, QP[11], 2, [el("q10-e1", "إعراب «الوطن»", 0.5), el("q10-e2", "إعراب «لكنّ»", 0.25), el("q10-e3", "إعراب «هم»", 0.25),
                               el("q10-e4", "محلّ جملة (أرادوا)", 0.5), el("q10-e5", "محلّ جملة (أن أبقى جروحا دامية)", 0.5)], DOCS)
q("q11", "4", P2, QP[12], 1, [el("q11-e1", "العلاقة بين الفقرة الأخيرة والفقرتين السّابقتين", 1)], DOCS)
q("q12", "5", P2, QP[13], 1, [el("q12-e1", "نوع الصّورة وتوضيحها وبلاغتها (4×0.25)", 1)], DOCS)
q("q13", "1", P3, J(15, 16), 4, [el("q13-e1", "المرحلة الأولى وخصائصها (2×0.75)", 1.5), el("q13-e2", "المرحلة الثّانية وخصائصها (2×0.75)", 1.5),
                                  el("q13-e3", "النّمط التّصويريّ", 0.25), el("q13-e4", "النّمط التّثقيفيّ", 0.25), el("q13-e5", "علمان من أعلامها (2×0.25)", 0.5)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
HER_EXPL = "الميراث العريق الّذي تحتفظ به الجزائر هو: الإسلام – آدابه – المساجد – النّظام القضائيّ – الفضائل العربيّة الشّرقيّة – اللّغة العربيّة الخالدة."
st("s01", "q1", "q1-e1", "multi", "ما الميراث العريق الّذي تحتفظ به الجزائر؟ (اختر كلّ ما يصحّ)",
   {"options": ["الإسلام وآدابه وأخلاقه", "المساجد بهياكلها وأوقافها", "النّظام القضائيّ", "الفضائل العربيّة الشّرقيّة", "القوانين الفرنسيّة", "الإلحاد"]},
   {"correct": [0, 1, 2, 3]}, HER_EXPL, 0.75, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل من عناصر هذا الميراث:",
   {"text": "اللّغة العربيّة ____.", "bank": ["الخالدة", "الدّخيلة", "المندثرة"]},
   {"blanks": [["الخالدة"]]}, HER_EXPL, 0.25, "ar.comprehension.details", "b")
Q2_EXPL = ("المقصود بالعبارة (غالبته حوادث الدّهر فلم تغلبه): هو محاولة فرنسا الملحّة على القضاء على هذا الميراث، إلّا أنّ إرادة الشّعب الجزائريّ الأبيّ "
           "وارتباطه بهذه القيم وقف حجر عثرة أمام فرنسا، فرسخت قواعد هذا الميراث وامتدّت عبر الأجيال.")
st("s03", "q2", "q2-e1", "mcq", "ما المقصود بالعبارة: «غالبته حوادث الدّهر فلم تغلبه»؟",
   {"options": ["محاولة فرنسا الملحّة القضاء على هذا الميراث، لكنّ إرادة الشّعب الجزائريّ الأبيّ وارتباطه بقيمه وقفا حجر عثرة أمامها",
                "استسلام الشّعب الجزائريّ لحوادث الدّهر وتخلّيه عن ميراثه", "انتصار الدّهر على الشّعب الجزائريّ وضياع ميراثه",
                "تقلّب أحوال الطّقس في الجزائر عبر القرون"]},
   {"correct": 0}, Q2_EXPL, 0.5, "ar.comprehension.explain")
st("s04", "q2", "q2-e1", "fill_blank", "أكمل نتيجة ذلك:",
   {"text": "فرسخت ____ هذا الميراث وامتدّت عبر ____.", "bank": ["قواعد", "الأجيال", "أنقاض", "الحدود"]},
   {"blanks": [["قواعد"], ["الأجيال"]]}, Q2_EXPL, 0.5, "ar.comprehension.explain", "b")
Q3_EXPL = ("تتمثّل خطورة الاستعمار الفرنسيّ في كونه يتظاهر بمظهر الحامي لمقوّمات الشّعب الجزائريّ، لكنّه يخفي نواياه الخبيثة… "
           "فهو لهذا الشّعب ما تحمله الأمراض الوافدة.")
st("s05", "q3", "q3-e1", "mcq", "فيمَ تتمثّل خطورة الاستعمار الفرنسيّ كما حلّلها الكاتب؟",
   {"options": ["في كونه يتظاهر بمظهر الحامي لمقوّمات الشّعب الجزائريّ، لكنّه يخفي نواياه الخبيثة", "في كونه أعلن عداءه للمقوّمات صراحة منذ أوّل يوم",
                "في كونه نشر التّعليم بين الجزائريّين", "في كونه احترم الأحكام الإسلاميّة وحماها"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.explain")
st("s06", "q3", "q3-e1", "mcq", "ما الّذي يمثّله الاستعمار لهذا الشّعب في نظر الكاتب؟",
   {"options": ["ما تحمله الأمراض الوافدة من موت وأسباب موت", "ما يحمله الطّبيب من دواء وشفاء", "ما يحمله الضّيف من هدايا", "ما تحمله الأمطار من خير"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.explain", "b")
ART_EXPL = ("ينتمي النّصّ إلى فنّ المقال السّياسيّ الاجتماعيّ. خصائصه: الاعتماد على المنهجيّة (مقدّمة- عرض- خاتمة) – الاعتماد على الشّواهد – "
            "تسلسل الأفكار – سهولة ووضوح اللّغة (يكتفي المترشّح بثلاث خصائص).")
st("s07", "q4", "q4-e1", "mcq", "إلى أيّ فنّ أدبيّ ينتمي النّصّ؟",
   {"options": ["المقال السّياسيّ الاجتماعيّ", "الخطابة", "القصّة القصيرة", "المقامة"]},
   {"correct": 0}, ART_EXPL, 0.5, "ar.literature.prose")
st("s08", "q4", "q4-e2", "multi", "ما خصائص هذا الفنّ الّتي تتجلّى في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["الاعتماد على المنهجيّة (مقدّمة- عرض- خاتمة)", "الاعتماد على الشّواهد", "تسلسل الأفكار", "سهولة ووضوح اللّغة",
                "الحبكة والعقدة والحلّ", "الحوار بين الشّخصيّات"]},
   {"correct": [0, 1, 2, 3]}, ART_EXPL + " أمّا الحبكة والحوار بين الشّخصيّات فمن خصائص القصّة.", 0.75, "ar.literature.prose")
STY_EXPL = ("الإبراهيميّ فعلًا من الأدباء الّذين يتأنّقون في أسلوبهم، والدّليل على ذلك من النّصّ توظيفه لمختلف الصّور والمحسّنات. من الصّور: التّشبيه في: "
            "الاستعمار سلّ… الاستعارة في: شادَه أسلافه… ومن المحسّنات: الطّباق في: الأصول ≠ الفروع… السّجع في: الفضائل والرّذائل…")
st("s09", "q5", "q5-e1", "mcq", "«الإبراهيميّ من الأدباء الّذين يتأنّقون في أسلوبهم»: هل يثبت النّصّ هذا الحكم؟ وما الدّليل؟",
   {"options": ["نعم، والدّليل توظيفه لمختلف الصّور والمحسّنات", "لا، فأسلوبه علميّ جافّ خالٍ من الصّور", "لا، لأنّه يكثر من الألفاظ العامّيّة",
                "نعم، والدّليل أنّه نظم النّصّ شعرًا موزونًا"]},
   {"correct": 0}, STY_EXPL, 0.5, "ar.rhetoric.style")
st("s10", "q5", "q5-e1", "matching", "طابق كلّ مثال من النّصّ بالصّورة أو المحسّن الّذي يمثّله.",
   {"lefts": ["«والاستعمار سُلٌّ»", "«شادَه أسلافه»", "«راسخة الأصول، نامية الفروع»"], "rights": ["تشبيه", "استعارة", "طباق", "جناس"]},
   {"pairs": [0, 1, 2]}, STY_EXPL, 0.5, "ar.rhetoric.style", "b")
TYP_EXPL = ("النّمط الغالب على النّصّ تفسيريّ. مؤشّراته: تفسير الظّاهرة بذكر أسبابها ونتائجها (استعمار فرنسا للجزائر ومخلّفاته) – الاعتماد على الأسلوب الخبريّ "
            "المعلّل تارة والمؤكّد تارة أخرى (فتعهّد بالظّاهر باحترامها… ليكوننّ الحامين) – اعتماد اللّغة الموضوعيّة (هناك مؤشّرات أخرى، ويذكر المترشّح ثلاثة منها).")
st("s11", "q6", "q6-e1", "mcq", "ما النّمط الغالب على النّصّ؟",
   {"options": ["التّفسيريّ", "الحواريّ", "الإيعازيّ"]},
   {"correct": 0}, TYP_EXPL, 1, "ar.text.type")
st("s12", "q6", "q6-e2", "matching", "طابق كلّ مؤشّر من مؤشّرات النّمط التّفسيريّ بما يمثّل له من النّصّ.",
   {"lefts": ["تفسير الظّاهرة بذكر أسبابها ونتائجها", "الأسلوب الخبريّ المعلّل تارة والمؤكّد تارة أخرى"],
    "rights": ["استعمار فرنسا للجزائر ومخلّفاته", "«فتعهّد في الظّاهر باحترامها… ليَكونن الحامين للموجود»", "«وذو لسان وسعَ وَحي الله»"]},
   {"pairs": [0, 1]}, TYP_EXPL, 0.5, "ar.text.type")
st("s13", "q6", "q6-e2", "fill_blank", "أكمل مؤشّرًا ثالثًا للنّمط التّفسيريّ:",
   {"text": "اعتماد اللّغة ____.", "bank": ["الموضوعيّة", "الذّاتيّة", "العامّيّة"]},
   {"blanks": [["الموضوعيّة"]]}, TYP_EXPL, 0.25, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص النّصّ معتمدًا تقنية التّلخيص", "text": "مقال البشير الإبراهيميّ (بكالوريا 2013، آداب وفلسفة، الموضوع الثّاني)",
            "scheme": "المضمون: ميراث الجزائر الخالد، ومكائد فرنسا وظلمها للشّعب الجزائريّ، تاريخ فرنسا شاهد على خيبتها وذلّها (01)؛ الأسلوب الخاصّ بالمترشّح (01)؛ الحجم: ما يقارب ثلث النّصّ (01)",
            "model_example": None}
SUM_EXPL = ("يُراعى في التّلخيص: المضمون (ميراث الجزائر الخالد، ومكائد فرنسا وظلمها للشّعب الجزائريّ، تاريخ فرنسا شاهد على خيبتها وذلّها)، "
            "الأسلوب الخاصّ بالمترشّح، الحجم (ما يقارب ثلث النّصّ) — 3×01.")
for sid, eid, crit, ind in [("s14", "q7-e1", "المضمون", "ميراث الجزائر الخالد، ومكائد فرنسا وظلمها للشّعب الجزائريّ، وتاريخ فرنسا شاهد على خيبتها وذلّها"),
                            ("s15", "q7-e2", "الأسلوب", "الأسلوب الخاصّ بالمترشّح"), ("s16", "q7-e3", "الحجم", "ما يقارب ثلث النّصّ")]:
    essay(sid, "q7", eid, "تلخيص مقال الإبراهيميّ", crit, ind, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
ZLM_EXPL = "كلمات تنتمي إلى حقل الظّلم (من الإجابة النّموذجيّة): جروح، تضليل، عبث… (وفي التّصحيح «تهدم» ولا ترد في نصّ الموضوع)."
st("s17", "q8", "q8-e1", "multi", "أيّ الكلمات الآتية من النّصّ تنتمي إلى حقل الظّلم؟ (اختر كلّ ما يصحّ)",
   {"options": ["جروحا", "التّضليل", "عبث", "الفضائل", "المساجد", "حكمة"]},
   {"correct": [0, 1, 2]}, ZLM_EXPL + " أمّا «الفضائل، المساجد، حكمة» فمن حقل الميراث والقيم.", 0.75, "ar.cohesion.effect")
st("s18", "q8", "q8-e1", "fill_blank", "أكمل من النّصّ كلمة من حقل الظّلم:",
   {"text": "«و____ بحرمة المعابد»", "bank": ["عبَث", "اعتنى", "احتفى"]},
   {"blanks": [["عبَث"]]}, ZLM_EXPL, 0.25, "ar.cohesion.effect", "b")
MJ_EXPL = "من صيغ منتهى الجموع في النّصّ: مَساجِد ← مَفاعِل؛ فَضائِل ← فَعائِل."
st("s19", "q9", "q9-e1", "mcq", "أيّ الكلمات الآتية من النّصّ على صيغة منتهى الجموع؟",
   {"options": ["المساجد", "أوقافها", "الأصول", "قادته"]},
   {"correct": 0}, MJ_EXPL + " أمّا «أوقاف» (أفعال) و«الأصول» (فُعول) و«قادة» (فَعَلة) فليست منها.", 0.25, "ar.morphology")
st("s20", "q9", "q9-e2", "mcq", "ما وزن «مساجد»؟",
   {"options": ["مفاعل", "فعائل", "مفاعيل", "فواعل"]},
   {"correct": 0}, MJ_EXPL, 0.25, "ar.morphology")
st("s21", "q9", "q9-e3", "mcq", "استخرج من النّصّ صيغة أخرى من صيغ منتهى الجموع تختلف في وزنها عن «مساجد»:",
   {"options": ["الفضائل", "المعابد", "الأصول", "الأمراض"]},
   {"correct": 0}, MJ_EXPL + " («المعابد» على وزن «مساجد» نفسه، و«الأصول» و«الأمراض» ليستا من منتهى الجموع.)", 0.25, "ar.morphology")
st("s22", "q9", "q9-e4", "fill_blank", "ما وزن «فضائل»؟",
   {"text": "وزن «فضائل»: ____", "bank": ["فعائل", "مفاعل", "فواعل", "أفاعل"]},
   {"blanks": [["فعائل"]]}, MJ_EXPL, 0.25, "ar.morphology")
st("s23", "q10", "q10-e1", "mcq", "ما إعراب «الوطن» في قوله: «في هذا الوطن الجزائريّ»؟",
   {"options": ["بدل مجرور وعلامة جرّه الكسرة الظّاهرة على آخره", "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة على آخره",
                "اسم مجرور بـ«في» وعلامة جرّه الكسرة الظّاهرة على آخره", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "«الوطن»: بدل مجرور وعلامة جرّه الكسرة الظّاهرة على آخره.", 0.5, "ar.grammar.badal")
LKN_EXPL = "«لكنّ»: حرف استدراك ونصب. «هم»: ضمير متّصل مبنيّ في محلّ نصب اسم «لكنّ»."
st("s24", "q10", "q10-e2", "mcq", "ما إعراب «لكنّ» في قوله: «ولكنّهم عملوا في الباطن»؟",
   {"options": ["حرف استدراك ونصب", "حرف عطف واستدراك", "حرف توكيد ونصب", "حرف نفي وجزم"]},
   {"correct": 0}, LKN_EXPL, 0.25, "ar.grammar.nawasikh")
st("s25", "q10", "q10-e3", "fill_blank", "أكمل إعراب «هم» في «لكنّهم»:",
   {"text": "«هم»: ضمير متّصل مبنيّ في محلّ ____ اسم ____.", "bank": ["نصب", "لكنّ", "رفع", "جرّ", "كان"]},
   {"blanks": [["نصب"], ["لكنّ"]]}, LKN_EXPL, 0.25, "ar.grammar.nawasikh")
st("s26", "q10", "q10-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (أرادوا) في قوله: «جُزء ممّا (أرادوا)»؟",
   {"options": ["جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ جرّ نعت", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال"]},
   {"correct": 0}, "(أرادوا): جملة صلة الموصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s27", "q10", "q10-e5", "mcq", "ما المحلّ الإعرابيّ لجملة (أن أبقى جروحا دامية) في قوله: «بعد (أن أبقى جروحا دامية)»؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة في محلّ نصب مفعول به", "جملة فعليّة في محلّ رفع فاعل", "جملة فعليّة في محلّ نصب حال"]},
   {"correct": 0}, "(أن أبقى جروحا دامية): جملة فعليّة في محلّ جرّ مضاف إليه (بعد الظّرف «بعد»).", 0.5, "ar.grammar.sentence_case")
REL_EXPL = ("العلاقة بين الفقرة الأخيرة والفقرتين السّابقتين علاقة تكامليّة، فما قامت به فرنسا من أعمال انتهاكيّة للقيم والأرواح كان نتيجته العار "
            "الّذي يشوّه تاريخها وما تدّعيه من قيم إنسانيّة.")
st("s28", "q11", "q11-e1", "mcq", "ما العلاقة الّتي تربط الفقرة الأخيرة بالفقرتين السّابقتين؟",
   {"options": ["علاقة تكامليّة", "علاقة تعارض وتناقض", "علاقة استطراد لا صلة لها بما سبق", "علاقة تكرار للمعنى نفسه"]},
   {"correct": 0}, REL_EXPL, 0.5, "ar.cohesion.effect")
st("s29", "q11", "q11-e1", "fill_blank", "وضّح هذه العلاقة:",
   {"text": "فما قامت به فرنسا من أعمال انتهاكيّة للقيم والأرواح كان ____ العار الّذي يشوّه ____ وما تدّعيه من قيم إنسانيّة.",
    "bank": ["نتيجته", "تاريخها", "سببه", "جيرانها"]},
   {"blanks": [["نتيجته"], ["تاريخها"]]}, REL_EXPL, 0.5, "ar.cohesion.effect", "b")
MJZ_EXPL = ("نوع الصّورة الواردة في (يشرّف فرنسا): مجاز مرسل علاقته مكانيّة، إذ ذكر المكان وقصد به شعب فرنسا. وبلاغتها: أنّها تحقّق الإيجاز وجمال العبارة "
            "وتقوّي المعنى، وهو شهادة التّاريخ على جرائمها.")
st("s30", "q12", "q12-e1", "mcq", "ما نوع الصّورة البيانيّة في «يُشرّف فرنسا»؟",
   {"options": ["مجاز مرسل", "تشبيه بليغ", "تشبيه تمثيليّ", "كناية عن نسبة"]},
   {"correct": 0}, MJZ_EXPL, 0.25, "ar.rhetoric.style")
st("s31", "q12", "q12-e1", "mcq", "ما علاقة المجاز المرسل في «يُشرّف فرنسا»؟",
   {"options": ["المكانيّة", "الجزئيّة", "السّببيّة", "اعتبار ما سيكون"]},
   {"correct": 0}, MJZ_EXPL, 0.25, "ar.rhetoric.style", "b")
st("s32", "q12", "q12-e1", "fill_blank", "أكمل توضيح الصّورة:",
   {"text": "إذ ذكر ____ وقصد به ____ فرنسا.", "bank": ["المكان", "شعب", "الزّمان", "جيش"]},
   {"blanks": [["المكان"], ["شعب"]]}, MJZ_EXPL, 0.25, "ar.rhetoric.style", "c")
st("s33", "q12", "q12-e1", "mcq", "ما بلاغة المجاز المرسل في «يُشرّف فرنسا»؟",
   {"options": ["تحقيق الإيجاز وجمال العبارة وتقوية المعنى، وهو شهادة التّاريخ على جرائمها", "تقديم الحقيقة مصحوبة بالدّليل",
                "تشخيص المعنويّ في صورة إنسان", "إحداث جرس موسيقيّ بتوافق الفواصل"]},
   {"correct": 0}, MJZ_EXPL, 0.25, "ar.rhetoric.effect", "d")
# ── ثالثًا: التّقويم النّقديّ ──
ESS_EXPL = ("المراحل الّتي مرّت بها المقالة وخصائص كلّ مرحلة: المرحلة الأولى: العناية بالإنشاء والتّنميق والزّخرف اللّفظيّ. المرحلة الثّانية: العناية بالمعاني "
            "والموضوعات والتّأثّر بالغربيّين، وقد اعتمدت نمطين: النّمط التّصويريّ: يصوّر فيه الكاتب شعوره إزاء صور الحياة؛ النّمط التّثقيفيّ: يظهر فيه الكاتب "
            "معلّمًا مثقّفًا أفراد مجتمعه بعيدًا عن الزّخرف والتّنميق. وأشهر أعلامها: العقّاد – طه حسين – الكواكبي – الإبراهيمي – ابن باديس (يكتفي المترشّح بذكر علمين).")
st("s34", "q13", "q13-e1", "mcq", "بمَ تميّزت المقالة في مرحلتها الأولى؟",
   {"options": ["العناية بالإنشاء والتّنميق والزّخرف اللّفظيّ", "العناية بالمعاني والموضوعات والتّأثّر بالغربيّين", "التّحرّر التّامّ من قواعد اللّغة",
                "الاعتماد على الحوار المسرحيّ"]},
   {"correct": 0}, ESS_EXPL, 0.75, "ar.literature.prose")
st("s35", "q13", "q13-e1", "fill_blank", "أكمل خصائص المرحلة الأولى:",
   {"text": "المرحلة الأولى: العناية بالإنشاء و____ و____ اللّفظيّ.", "bank": ["التّنميق", "الزّخرف", "المعاني", "الموضوعات"]},
   {"blanks": [["التّنميق"], ["الزّخرف"]]}, ESS_EXPL, 0.75, "ar.literature.prose", "b")
st("s36", "q13", "q13-e2", "mcq", "وبمَ تميّزت المقالة في مرحلتها الثّانية؟",
   {"options": ["العناية بالمعاني والموضوعات والتّأثّر بالغربيّين", "العناية بالإنشاء والتّنميق والزّخرف اللّفظيّ", "الرّجوع إلى أسلوب المقامات",
                "الإغراق في السّجع والمحسّنات"]},
   {"correct": 0}, ESS_EXPL, 0.75, "ar.literature.prose")
st("s37", "q13", "q13-e2", "multi", "ما خصائص المرحلة الثّانية؟ (اختر كلّ ما يصحّ)",
   {"options": ["العناية بالمعاني", "العناية بالموضوعات", "التّأثّر بالغربيّين", "الزّخرف اللّفظيّ", "التّنميق"]},
   {"correct": [0, 1, 2]}, ESS_EXPL, 0.75, "ar.literature.prose", "b")
st("s38", "q13", "q13-e3", "mcq", "ما النّمط الّذي يصوّر فيه الكاتب شعوره إزاء صور الحياة؟",
   {"options": ["النّمط التّصويريّ", "النّمط التّثقيفيّ", "النّمط الزّخرفيّ المنمّق"]},
   {"correct": 0}, ESS_EXPL, 0.25, "ar.literature.prose")
st("s39", "q13", "q13-e4", "fill_blank", "أكمل تعريف النّمط التّثقيفيّ:",
   {"text": "النّمط التّثقيفيّ: يظهر فيه الكاتب ____ مثقّفًا أفراد مجتمعه بعيدًا عن الزّخرف و____.", "bank": ["معلّمًا", "التّنميق", "شاعرًا", "المعاني"]},
   {"blanks": [["معلّمًا"], ["التّنميق"]]}, ESS_EXPL, 0.25, "ar.literature.prose")
st("s40", "q13", "q13-e5", "multi", "مَن من أشهر أعلام المقالة؟ (اختر كلّ ما يصحّ)",
   {"options": ["العقّاد", "طه حسين", "الكواكبي", "الإبراهيمي", "ابن باديس", "المتنبّي", "أبو تمّام"]},
   {"correct": [0, 1, 2, 3, 4]}, ESS_EXPL + " أمّا المتنبّي وأبو تمّام فشاعران عبّاسيّان.", 0.5, "ar.literature.context")

_check()

doc = {
    "schema_version": 1,
    "set_id": SET_ID,
    "status": "NEEDS_HUMAN_REVIEW",
    "source": {
        "source_id": f"gdrive-{DOCX_ID}-p2",
        "kind": "BAC", "year": 2013, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": 2,
        "title": "بكالوريا 2013 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (البشير الإبراهيميّ: من عيون البصائر)",
        "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
        "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
        "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
        "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
        "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
        "notes": ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2013، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ "
                  f"مولَّد من ملفّ docx ومطابَق سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
                  "أسطر النّصّ في docx فقرات منفصلة فضُمّت بمسافة إلى فقرات الموضوع الرّسميّ الثّلاث. أُصلح من الموضوع الرّسميّ: «على طول الزن» ← «الزمن». "
                  "العلامات من الإجابة النّموذجيّة الرّسميّة (الصّفحتان 3–4، ملفّ ممسوح قُرئ مصوّرًا). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
                  "في التّصحيح «تهدم» من حقل الظّلم ولا ترد في نصّ الموضوع فلم تُستعمل. مؤجَّل (essay_builder): التّلخيص س7 (3×01)."),
    },
    "original_questions": Q,
    "steps": S,
    "score_total": 20,
    "modes": ["PRACTICE", "EXAM"],
    "review_log": [{"at": "2026-10-29T13:00:00Z", "by": "claude", "action": "generated", "note": "تحويل من نسخة الموضوع (docx، مطابَقة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."}],
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")
