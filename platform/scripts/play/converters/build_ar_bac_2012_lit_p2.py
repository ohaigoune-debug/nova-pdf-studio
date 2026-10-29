"""Conversion: BAC 2012 (session عاديّة، جوان 2012) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (أحمد أمين، الصّراع بين القديم والجديد).
Exam (most faithful source): gdrive 1s9ZKdhMIsQbTkfYtqWdcw2_dPp9N5J7F (بكالوريا 2012 العربية شعبة اداب وفلسفة.docx);
same paper as PDF (owner's retyped copy, exported from the docx): gdrive 1CAN0D7tooAPtKlTJuuXDcf1Q6DCTWWwP (BAC 2012 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1t4JS2ByswnhDsdO4auT_J15MXaGuTQpt (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1lGzAgD2mxqOSl3jgzD55z33tpo0XZSp9 (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2016_lit_p1.py / build_ar_bac_2018_lit_p1.py): the verbatim strings below (text, author, glossary,
question texts) were generated from the .docx with python-docx (runs read exactly, tatweel kept; only outer whitespace and
outer direction marks trimmed). The docx stores each printed line of the text as its own paragraph: the lines are joined
with a space into the eight paragraphs of the ONEC paper; the two questions split over two docx paragraphs (Q4, part 3)
are joined the same way. Every verbatim string of the JSON was re-checked programmatically against the docx. The docx was
compared with the official ONEC paper (rendered at 120 dpi): same text, paragraphs and questions; underlined «الفترة» and
«إمّا» (the first one) in both; parenthesised (تسير) and (كان صالحا). Kept as in the docx: diacritics and the glossary
heading «الشرح اللغوي:» (ONEC «شرح المفردات:»). The correction is a scanned PDF, read from the rendered pages (150 dpi,
fully legible). Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper «الشعبة: آداب وفلسفة», correction «الآداب والفلسفة» ⇒ LIT (the docx header carries a template line
  «دورة جوان 2008 / جميع الشعب»; year and stream come from the ONEC paper and the correction).
- Rule for «n×m» lines: interchangeable items (more listed than required) ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 01. Q2: 0.5 the truth + 0.25 its evidence. Q3 0.75. Q4: «2×0.5» = the two kinds of battles + the two groups, then 0.5
  the outcome. Q5 «2×0.5» = the truth + why. Q6 «2×01» beside one continuous answer («نعم، لقد كان الكاتب موضوعيًّا… فقد
  تجرّد من الذّاتيّة… واعتمد على التّعليل والتّمثيل…»); the scheme does not say which part each 01 covers ⇒ one element of
  2 (closed answer, interactive). Q7 (تلخيص) «3×01» = حجم التّلخيص / الدّلالة على المضمون / سلامة اللّغة ⇒ deferred.
- Part 2: Q1 «2×0.5» one per field (three words among five each). Q2 «2×0.25» two clues among four ⇒ one element of 0.5.
  Q3: 0.5 the type (التّفسيريّ) + «2×0.25» two indicators among six ⇒ one element of 0.5. Q4 «2×0.5» + «2×0.5» one element
  per word / sentence. Q5 «3×0.25» per image = type / explanation / effect.
- Part 3 (04): 01 definition + 01.5 famous writers (four listed) + 01.5 features (three among five) ⇒ three elements, all
  interactive (the scheme gives no example from the text for the features).
- Distractors avoid what the scheme or usage could accept: «الحجاجيّ» is not a distractor of «التّفسيريّ»; «نعت / عطف
  بيان» are not distractors of «الفترة» (بدل); «حرف عطف» is not a distractor of «إمّا»; «نعت» is not a distractor of (كان
  صالحا); «مجاز عقليّ» is not a distractor of «دلّنا التّاريخ»; «بندول الأمّة» is not a distractor of Q3 (it is another
  image of the nation's movement); only classical poets are offered as non-essayists in part 3.
- Deferred: summary 3 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1s9ZKdhMIsQbTkfYtqWdcw2_dPp9N5J7F"
DOCX_TITLE = "بكالوريا 2012 العربية شعبة اداب وفلسفة.docx"
PDF_ID = "1CAN0D7tooAPtKlTJuuXDcf1Q6DCTWWwP"
OFFICIAL_ID = "1t4JS2ByswnhDsdO4auT_J15MXaGuTQpt"
CORR_ID = "1lGzAgD2mxqOSl3jgzD55z33tpo0XZSp9"
SOURCE_STREAMS = ["LIT"]

# ── الموضوع الثّاني (مولَّد من docx) ──
P2_PARAS = ['«فمن طبيعة هذا العالم التَّغير المستمر، سواءٌ في ذلك شؤونه الماديّة والمعنوية، فمن حين إلى حين تثور الأرض والزلازل والبراكين والفيضانات والمدّ والجزر والعواصف والأمطار ونحو ذلك، فتكون عاملا كبيرا من عوامل التّغير المستمرّ في سطح الأرض.', 'وكذلك حياة النّاس على وجه الأرض في تغيّر مستمر كتغيّر سطحها، فكم من الفرق بين بيت الرّجل البدويّ في سذاجته وبساطة أدواته، وبيت الرَّجل المتمدّن على أحدث طراز، وهكذا الشأن في كلّ مرفق من مرافق الحياة وكلّ نظام من نظم المعيشة، في وسائل النّقل والبريد، وفي المعاملات الاقتصاديّة، وفي معاهد التربية، وفي نظم الحكومة، وفي كلّ شيء.', 'وقد دلّنا التاريخ على أنّ الجماعات والأمم (تسير) على أنماط متشابهة في تغيّرها وتطوّرها وانتقالها من القديم إلى الجديد.', 'فكل جماعة سرعان ما تَتَكون لها تقاليد وعادات وأوضاع ومعتقدات تُقدسها وتلتزمُها وتكره الخارج عليها، ولكن بمرور الزّمن تنشأ عوامل مختلفة تجعل ما (كان صالحا) من العادات والتقاليد غير صالح.', 'في هذه الفترة ظهر أفراد من المجتمع هم أكثر شعورا بالألم من النّظام الموجود فيدعون إلى أوضاع يجب أن تحل محل القديم لكن أنصار القديم يهبون في وجه معارضيهم.', 'وإذ ذاك تنشأ معارك بين أنصار القديم وأنصار الجديد، قد تقتصر على الحرب الكلاميّة، وقد تشتد حتى تكون ثورة دموية ثم تنجلي هذه المعارك إمّا عن نصرة القديم وقمع دعوة الإصلاح والتّجديد وعند ذلك يَتأجَّل الإصلاح والتجديد حتى تتهيأ له ظروفٌ أنسب، وجو أصلح. وإِمًّا أن ينتصر الحديث ويُهزم القديم ويتحوّل المحافظون إلى أحرار يَنصرون الجديد بعد أن تنجلي فائدته.', 'ولكن حتَّى في هذه الحالة لا يمكن انتصار الجديد الصّرف، بل لا بد أن يكون مشوبا بشيء من القديم حتّى يستطيع أفراد الشّعب أن يتذوّقوه. وقد يتجاهل دعاة التّجديد هذه الحقيقة فتصاب دعوتهم بالنكسة.', 'وهكذا يتحرك " بندول" الأمّة بين حركةٍ إلى الأمام وحركةٍ إلى الخلف تَبعا لنشاط المجدّدين وطبيعة المحافظين.»']
P2_REF = 'أحمد أمين'
P2_GLOSS = 'الشرح اللغوي: مشوبا: مختلطا.          بندول: نواس ساعة كبيرة.'
P2_QP = ['أوّلا- البناء الفكري: (10 نقاط)', 'ما الموضوع الذي عالجه الكاتب في هذا النّص؟', 'ما الحقيقة التي أثبتها الكاتب في مطلع النّص؟ وما دليله على ذلك؟', 'بماذا شبّه الكاتب حياة النّاس في تغيرها وتطوّرها؟', 'يشير الكاتب إلى نوعين من المعارك بَين فئتين من المجتمع. بين النوعين والفئتين، ثم اكشف عن نتيجة هذا الصراع.', 'نبّه الكاتب في نهاية النّص إلى حقيقة لا يمكن تجاهلها. ما هي؟ ولماذا؟', 'هل كان الكاتب موضوعيًا في طرحه؟ علل.', 'لخّص هذا النّص محترما تقنية التلخيص.', 'ثانيا- البناء اللّغوي: (06 نقاط)', 'في النّص حقلان دلاليان متضادان. مثّل لكلّ منهما بثلاث مفردات.', 'حدّد القرائن اللغوية التي ساهمت في تحقيق الاتّساق في الفقرة الأولى من النّص.', 'ما النّمط الذي اعتمده الكاتب في بسط أفكاره؟ اذكر مؤشرين له مع التمثيل.', 'أعرب ما تحته خط إعراب مفردات وما بين قوسين إعراب جمل.', 'في العبارتين الآتيتين صورتان بيانيتان. اشرحهما، مبيّنا نوعيهما وأثرهما البلاغي:', '"حياة النّاس على وجه الأرض في تغيّر مستمر كتغيّر سطحها" و "دلّنا التاريخ".', 'ثالثا- التّقويم النقدي: (04 نقاط)', 'ساهم المقال في ازدهار النّهضة الأدبيّة والفكريّة في العصر الحديث. عرّف بهذا الفنّ واذكر ثلاثة من أشهر روّاده وأهم خصائصه مستندًا إلى النّص.']


def el(i, label, pts, streams=None):
    e = {"id": i, "label": label, "max_points": pts, "verified": False}
    if streams:
        e["streams"] = streams
    return e


Q = []
def q(qid, number, part, text, total, elements, docs):
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
    paper = _norm(" ".join([qq["verbatim_text"] for qq in Q] + [d.get("text") or " ".join(sum(d.get("table") or [], [])) for qq in Q for d in qq["documents"]]))
    for qq in Q:
        assert qq["verbatim_text"] and qq["verbatim_text"].strip() == qq["verbatim_text"], qq["id"]
        assert abs(sum(e["max_points"] for e in qq["rubric_elements"]) - qq["rubric_total"]) < 1e-9, qq["id"]
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
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps) and nk not in paper), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


def _write(set_id, paper, title, notes, log_note):
    _check()
    doc = {
        "schema_version": 1,
        "set_id": set_id,
        "status": "NEEDS_HUMAN_REVIEW",
        "source": {
            "source_id": f"gdrive-{DOCX_ID}-p{paper}",
            "kind": "BAC", "year": 2012, "level": "3AS", "streams": SOURCE_STREAMS, "subject": "AR", "term": None, "paper": paper,
            "title": title,
            "original_url": f"https://drive.google.com/file/d/{DOCX_ID}/view",
            "original_file_ref": f"gdrive:{DOCX_ID} ({DOCX_TITLE})",
            "correction_url": f"https://drive.google.com/file/d/{CORR_ID}/view",
            "correction_file_ref": f"gdrive:{CORR_ID} (02_التصحيح.pdf)",
            "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
            "notes": notes,
        },
        "original_questions": Q,
        "steps": S,
        "score_total": 20,
        "modes": ["PRACTICE", "EXAM"],
        "review_log": [{"at": "2026-10-29T18:00:00Z", "by": "claude", "action": "generated", "note": log_note}],
    }
    json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps", sum(s["points"] for s in S), "points")


QP = P2_QP
J = lambda *ix: "\n".join(QP[i] for i in ix)
P1, P2, P3 = QP[0], QP[8], QP[15]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and len(QP) == 17 and len(P2_PARAS) == 8
D = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(P2_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P2_REF},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": P2_GLOSS},
]

q("q1", "1", P1, J(1), 1, [el("q1-e1", "الموضوع الّذي عالجه الكاتب", 1)], D)
q("q2", "2", P1, J(2), 0.75, [el("q2-e1", "الحقيقة الّتي أثبتها الكاتب في المطلع", 0.5), el("q2-e2", "دليله على ذلك", 0.25)], D)
q("q3", "3", P1, J(3), 0.75, [el("q3-e1", "ما شبّه به حياة النّاس في تغيّرها", 0.75)], D)
q("q4", "4", P1, J(4), 1.5, [el("q4-e1", "نوعا المعارك", 0.5), el("q4-e2", "الفئتان المتصارعتان", 0.5), el("q4-e3", "نتيجة الصّراع", 0.5)], D)
q("q5", "5", P1, J(5), 1, [el("q5-e1", "الحقيقة الّتي نبّه إليها الكاتب في النّهاية", 0.5), el("q5-e2", "تعليلها", 0.5)], D)
q("q6", "6", P1, J(6), 2, [el("q6-e1", "موضوعيّة الكاتب مع التّعليل (2×01)", 2)], D)
q("q7", "7", P1, J(7), 3, [el("q7-e1", "التّلخيص: حجم التّلخيص", 1), el("q7-e2", "التّلخيص: الدّلالة على المضمون", 1), el("q7-e3", "التّلخيص: سلامة اللّغة", 1)], D)
q("q8", "1", P2, J(9), 1, [el("q8-e1", "حقل التّجديد: ثلاث مفردات", 0.5), el("q8-e2", "حقل القديم: ثلاث مفردات", 0.5)], D)
q("q9", "2", P2, J(10), 0.5, [el("q9-e1", "قرينتان من قرائن الاتّساق (2×0.25)", 0.5)], D)
q("q10", "3", P2, J(11), 1, [el("q10-e1", "النّمط", 0.5), el("q10-e2", "مؤشّران (2×0.25)", 0.5)], D)
q("q11", "4", P2, J(12), 2, [el("q11-e1", "إعراب «الفترة»", 0.5), el("q11-e2", "إعراب «إمّا»", 0.5),
                             el("q11-e3", "محلّ جملة (تسير)", 0.5), el("q11-e4", "محلّ جملة (كان صالحا)", 0.5)], D)
q("q12", "5", P2, J(13, 14), 1.5,
  [el("q12-e1", "«حياة النّاس… كتغيّر سطحها»: النّوع", 0.25), el("q12-e2", "«حياة النّاس… كتغيّر سطحها»: الشّرح", 0.25), el("q12-e3", "«حياة النّاس… كتغيّر سطحها»: الأثر", 0.25),
   el("q12-e4", "«دلّنا التّاريخ»: النّوع", 0.25), el("q12-e5", "«دلّنا التّاريخ»: الشّرح", 0.25), el("q12-e6", "«دلّنا التّاريخ»: الأثر", 0.25)], D)
q("q13", "1", P3, J(16), 4, [el("q13-e1", "التّعريف بفنّ المقال", 1), el("q13-e2", "ثلاثة من أشهر روّاده", 1.5), el("q13-e3", "أهمّ خصائصه", 1.5)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي عالجه أحمد أمين في هذا النّصّ؟",
   {"options": ["قضيّة الصّراع بين القديم والحديث، ونتيجة هذا الصّراع ومظاهره", "الكوارث الطّبيعيّة وأثرها في سطح الأرض",
                "الفرق بين حياة البدو وحياة الحضر", "تاريخ الثّورات الدّمويّة في العالم"]},
   {"correct": 0}, "عالج الكاتب في هذا النّصّ قضيّة الصّراع بين القديم والحديث، ونتيجة هذا الصّراع ومظاهره.", 1, "ar.comprehension.idea")
st("s02", "q2", "q2-e1", "mcq", "ما الحقيقة الّتي أثبتها الكاتب في مطلع النّصّ؟",
   {"options": ["سنّة التّغيّر والتّطوّر، فلا شيء يبقى على حاله", "ثبات العادات والتّقاليد عبر العصور", "انتصار القديم دائمًا على الجديد", "خطورة الزّلازل والبراكين على الإنسان"]},
   {"correct": 0}, "أثبت الكاتب حقيقةً هي سنّة التّغيّر والتّطوّر، فلا شيء يبقى على حاله («فمن طبيعة هذا العالم التّغيّر المستمرّ…»).", 0.5, "ar.comprehension.idea")
st("s03", "q2", "q2-e2", "fill_blank", "أكمل دليل الكاتب على ذلك:",
   {"text": "فكما يتطوّر ____ من حولنا تتطوّر حياة ____ وعاداتهم وتقاليدهم ومعتقداتهم.", "bank": ["العالم", "النّاس", "الجبال", "الحيوان"]},
   {"blanks": [["العالم"], ["النّاس"]]}, "الدّليل: فكما يتطوّر العالم من حولنا تتطوّر حياة النّاس وعاداتهم وتقاليدهم ومعتقداتهم، وما هو صالح اليوم لجماعة أو فئة معيّنة من النّاس لا يكون بالضّرورة صالحًا غدًا لجماعة أو فئة أخرى.", 0.25, "ar.comprehension.evidence")
st("s04", "q3", "q3-e1", "mcq", "بماذا شبّه الكاتب حياة النّاس في تغيّرها وتطوّرها؟",
   {"options": ["بتغيّر سطح الأرض", "بثبات الجبال ورسوخها", "بسفينة تتقاذفها الأمواج", "ببيت الرّجل البدويّ في سذاجته"]},
   {"correct": 0}, "شبّه الكاتب تغيّر حياة النّاس بتغيّر سطح الأرض («وكذلك حياة النّاس على وجه الأرض في تغيّر مستمرّ كتغيّر سطحها»).", 0.75, "ar.comprehension.image")
st("s05", "q4", "q4-e1", "mcq", "ما نوعا المعارك الّتي أشار إليها الكاتب؟",
   {"options": ["معارك دمويّة وكلاميّة", "معارك اقتصاديّة وسياسيّة", "معارك عسكريّة ضدّ المستعمر", "معارك رياضيّة وثقافيّة"]},
   {"correct": 0}, "المعارك الّتي أشار إليها الكاتب هي معارك دمويّة وكلاميّة («قد تقتصر على الحرب الكلاميّة، وقد تشتدّ حتّى تكون ثورة دمويّة»).", 0.5, "ar.comprehension.details")
st("s06", "q4", "q4-e2", "mcq", "بين أيّ فئتين من المجتمع تنشأ هذه المعارك؟",
   {"options": ["بين أنصار القديم وأنصار الجديد", "بين الأغنياء والفقراء", "بين البدو والحضر", "بين الحكّام والمحكومين"]},
   {"correct": 0}, "هي معارك دمويّة وكلاميّة بين أنصار القديم وأنصار الجديد.", 0.5, "ar.comprehension.details")
st("s07", "q4", "q4-e3", "mcq", "عمّ كشفت هذه المعارك؟",
   {"options": ["عن احتمالين: إمّا انتصار الجديد، وإمّا انتصار القديم وتأجيل التّغيير والتّطوّر إلى حين", "عن انتصار الجديد دائمًا وزوال القديم نهائيًّا",
                "عن بقاء القديم إلى الأبد دون أيّ تغيير", "عن توقّف الصّراع بين الفئتين نهائيًّا"]},
   {"correct": 0}, "وكشفت هذه المعارك عن احتمالين هما: إمّا انتصار الجديد وإمّا انتصار القديم وتأجيل التّغيير والتّطوّر إلى حين.", 0.5, "ar.comprehension.details")
st("s08", "q5", "q5-e1", "mcq", "ما الحقيقة الّتي نبّه إليها الكاتب في نهاية النّصّ؟",
   {"options": ["أنّ انتصار الجديد لا يتمّ دفعة واحدة ولا يقطع صلته بالقديم قطعًا كلّيًّا", "أنّ الجديد ينتصر دائمًا انتصارًا صرفًا لا يشوبه شيء من القديم",
                "أنّ القديم لا يمكن أن يُهزم", "أنّ دعاة التّجديد لا يتعرّضون لأيّ نكسة"]},
   {"correct": 0}, "الحقيقة الّتي لا يمكن تجاهلها هي: أنّ انتصار الجديد لا يتمّ دفعة واحدة ولا يقطع صلته بالقديم قطعًا كلّيًّا («بل لا بدّ أن يكون مشوبًا بشيء من القديم»).", 0.5, "ar.comprehension.idea")
st("s09", "q5", "q5-e2", "fill_blank", "ولماذا؟ أكمل:",
   {"text": "لأنّ الجديد إن قطع صلته بالقديم ____ العامّة ولم يستسيغوه، ولأنّ جهل دعاة الجديد لهذه الحقيقة قد يصيب دعوتهم بـ____ ويبقى الصّراع قائمًا.",
    "bank": ["نبذه", "النّكسة", "تقبّله", "النّصر"]},
   {"blanks": [["نبذه"], ["النّكسة"]]}, "«…وإلّا نبذه العامّة ولم يستسيغوه، لأنّ جهل دعاة الجديد لهذه الحقيقة قد يصيب دعوتهم بالنّكسة ويبقى الصّراع قائمًا».", 0.5, "ar.comprehension.explain")
OBJ_EXPL = "نعم، لقد كان الكاتب موضوعيًّا في طرح أفكاره، فقد تجرّد من الذّاتيّة والانفعال والعاطفة، واعتمد على التّعليل والتّمثيل لإبراز وجهة نظره وعرض أفكاره ليحمل القارئ على الاقتناع."
st("s10", "q6", "q6-e1", "mcq", "هل كان أحمد أمين موضوعيًّا في طرحه؟",
   {"options": ["نعم، كان موضوعيًّا في طرح أفكاره", "لا، فقد غلبت عليه الذّاتيّة والانفعال", "لا، فقد انحاز إلى أنصار القديم انحيازًا تامًّا", "لا، فقد اكتفى بعرض عواطفه دون أدلّة"]},
   {"correct": 0}, OBJ_EXPL, 0.5, "ar.comprehension.opinion")
st("s11", "q6", "q6-e1", "multi", "علّل: بمَ تظهر موضوعيّة الكاتب؟ (اختر كلّ ما يصحّ)",
   {"options": ["تجرّد من الذّاتيّة والانفعال والعاطفة", "اعتمد على التّعليل والتّمثيل لإبراز وجهة نظره", "عرض أفكاره ليحمل القارئ على الاقتناع",
                "أكثر من التّعبير عن مشاعره الخاصّة", "هاجم أنصار القديم وسخر منهم"]},
   {"correct": [0, 1, 2]}, OBJ_EXPL, 1, "ar.comprehension.opinion", "b")
st("s12", "q6", "q6-e1", "fill_blank", "أكمل تعليل موضوعيّة الكاتب:",
   {"text": "فقد تجرّد من ____ والانفعال والعاطفة، واعتمد على ____ والتّمثيل لإبراز وجهة نظره.", "bank": ["الذّاتيّة", "التّعليل", "الموضوعيّة", "الخيال"]},
   {"blanks": [["الذّاتيّة"], ["التّعليل"]]}, OBJ_EXPL, 0.5, "ar.comprehension.opinion", "c")
SUM_SPEC = {"task": "تلخيص النّصّ مع احترام تقنية التّلخيص", "text": "نصّ أحمد أمين في الصّراع بين القديم والجديد (بكالوريا 2012، آداب وفلسفة، الموضوع الثّاني)"}
SUM_EXPL = "التّلخيص: يُراعى فيه: حجم التّلخيص، الدّلالة على المضمون، سلامة اللّغة (3×01). لا يقدّم التّصحيح ملخّصًا نموذجيًّا."
for sid, eid, crit in [("s13", "q7-e1", "حجم التّلخيص"), ("s14", "q7-e2", "الدّلالة على المضمون"), ("s15", "q7-e3", "سلامة اللّغة")]:
    essay(sid, "q7", eid, "تلخيص نصّ أحمد أمين في الصّراع بين القديم والجديد", crit, crit, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
FIELD_EXPL = ("الحقلان الدّلاليّان المتضادّان: حقل التّجديد: (التّغيّر، الحديث، الجديد، المتمدّن، تطوّرها)؛ حقل القديم: (البدويّ، بساطة، القديم، العادات "
              "والتّقاليد، المحافظون). يكتفي المترشّح بثلاث فقط في كلّ حقل.")
st("s16", "q8", "q8-e1", "multi", "اختر من النّصّ مفردات تنتمي إلى حقل التّجديد. (اختر كلّ ما يصحّ)",
   {"options": ["التّغيّر", "الحديث", "الجديد", "المتمدّن", "البدويّ", "المحافظون", "العادات والتّقاليد"]},
   {"correct": [0, 1, 2, 3]}, FIELD_EXPL, 0.5, "ar.cohesion.effect")
st("s17", "q8", "q8-e2", "multi", "اختر من النّصّ مفردات تنتمي إلى حقل القديم. (اختر كلّ ما يصحّ)",
   {"options": ["البدويّ", "بساطة", "القديم", "العادات والتّقاليد", "المحافظون", "المتمدّن", "التّغيّر"]},
   {"correct": [0, 1, 2, 3, 4]}, FIELD_EXPL, 0.5, "ar.cohesion.effect")
st("s18", "q9", "q9-e1", "matching", "طابق كلّ قرينة لغويّة ساهمت في اتّساق الفقرة الأولى بمثالها.",
   {"lefts": ["الضّمائر", "أسماء الإشارة", "حروف العطف", "حروف الجرّ"],
    "rights": ["«الهاء» في «شؤونه» (تعود على العالم)", "«هذا، ذلك»", "«الفاء، الواو»", "«من، إلى»"]},
   {"pairs": [0, 1, 2, 3]}, "القرائن اللّغويّة: الضّمائر: كضمير الغائب «الهاء» في «شؤونه» الّذي يعود على العالم، والضّمير المستتر في «تكون» الّذي يعود على «البراكين والزّلازل…»؛ أسماء الإشارة: «هذا، ذلك»؛ حروف العطف: «الفاء، الواو»؛ حروف الجرّ: «من، إلى». يكتفي المترشّح بقرينتين فقط.", 0.5, "ar.cohesion.connectors")
st("s19", "q10", "q10-e1", "mcq", "ما النّمط الّذي اعتمده أحمد أمين في بسط أفكاره؟",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]},
   {"correct": 0}, "النّمط الغالب الّذي اعتمده الكاتب في عرض أفكاره هو النّمط التّفسيريّ.", 0.5, "ar.text.type")
st("s20", "q10", "q10-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط التّفسيريّ في نصّ أحمد أمين؟ (اختر كلّ ما يصحّ)",
   {"options": ["سيطرة الجمل الخبريّة ونقل المعلومات بعيدًا عن الانفعال العاطفيّ", "سيطرة ضمير الغائب", "التّسلسل المنطقيّ للأفكار", "التّعرّض إلى الأسباب والنّتائج",
                "الشّرح والتّفصيل عن طريق عقد المشابهات وضرب الأمثلة", "استعمال حروف الاستدراك «لكن، بل»", "كثرة الأساليب الإنشائيّة الانفعاليّة", "الحوار بين الشّخصيّات"]},
   {"correct": [0, 1, 2, 3, 4, 5]}, "من مؤشّرات النّمط التّفسيريّ: سيطرة الجمل الخبريّة ونقل المعلومات بعيدًا عن الانفعال العاطفيّ، سيطرة ضمير الغائب، التّسلسل المنطقيّ للأفكار، التّعرّض إلى الأسباب والنّتائج، الشّرح والتّفصيل عن طريق عقد المشابهات وضرب الأمثلة «وهكذا الشّأن، وكذلك حياة النّاس، ثمّ تنجلي هذه المعارك، إمّا، وإمّا»، استعمال حروف الاستدراك «لكن، بل». يكتفي المترشّح بمؤشّرين فقط.", 0.5, "ar.text.type")
st("s21", "q11", "q11-e1", "mcq", "ما إعراب «الفترة» في قوله: «في هذه الفترة ظهر أفراد من المجتمع» (ممّا تحته خطّ)؟",
   {"options": ["بدل من اسم الإشارة، مجرور وعلامة جرّه الكسرة الظّاهرة على آخره", "اسم مجرور بحرف الجرّ «في» وعلامة جرّه الكسرة الظّاهرة على آخره",
                "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة على آخره", "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره"]},
   {"correct": 0}, "الفترة: بدل من اسم الإشارة (هذه)، مجرور وعلامة جرّه الكسرة الظّاهرة على آخره.", 0.5, "ar.grammar.badal")
st("s22", "q11", "q11-e2", "mcq", "ما إعراب «إمّا» في قوله: «ثمّ تنجلي هذه المعارك إمّا عن نصرة القديم» (ممّا تحته خطّ)؟",
   {"options": ["حرف تفصيل مبنيّ على السّكون لا محلّ له من الإعراب", "حرف نفي مبنيّ على السّكون لا محلّ له من الإعراب",
                "اسم موصول مبنيّ على السّكون في محلّ رفع فاعل", "ظرف زمان مبنيّ على السّكون في محلّ نصب مفعول فيه"]},
   {"correct": 0}, "إمّا: حرف تفصيل مبنيّ على السّكون لا محلّ له من الإعراب.", 0.5, "ar.grammar.irab")
st("s23", "q11", "q11-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (تسير) في قوله: «وقد دلّنا التّاريخ على أنّ الجماعات والأمم (تسير) على أنماط متشابهة»؟",
   {"options": ["جملة فعليّة في محلّ رفع خبر «أنّ»", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع نعت", "جملة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "تسير: جملة فعليّة في محلّ رفع خبر «أنّ».", 0.5, "ar.grammar.sentence_case")
st("s24", "q11", "q11-e4", "fill_blank", "أكمل المحلّ الإعرابيّ لجملة (كان صالحا) في قوله: «تجعل ما (كان صالحا) من العادات والتّقاليد غير صالح»:",
   {"text": "كان صالحًا: صلة ____ لا محلّ لها من ____.", "bank": ["الموصول", "الإعراب", "الشّرط", "البناء"]},
   {"blanks": [["الموصول"], ["الإعراب"]]}, "كان صالحًا: صلة الموصول (ما) لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s25", "q12", "q12-e1", "mcq", "ما نوع الصّورة البيانيّة في «حياة النّاس على وجه الأرض في تغيّر مستمرّ كتغيّر سطحها»؟",
   {"options": ["تشبيه", "استعارة مكنيّة", "كناية عن صفة", "مجاز مرسل"]},
   {"correct": 0}, "«حياة النّاس على وجه الأرض في تغيّر مستمرّ كتغيّر سطحها»: تشبيه.", 0.25, "ar.rhetoric.simile")
st("s26", "q12", "q12-e2", "fill_blank", "اشرح التّشبيه في «حياة النّاس… في تغيّر مستمرّ كتغيّر سطحها»:",
   {"text": "شبّه تغيّر ____ بتغيّر ____.", "bank": ["حياة النّاس", "سطح الأرض", "البراكين", "التّاريخ"]},
   {"blanks": [["حياة النّاس"], ["سطح الأرض"]]}, "حيث شبّه تغيّر حياة النّاس بتغيّر سطح الأرض.", 0.25, "ar.rhetoric.simile")
st("s27", "q12", "q12-e3", "mcq", "ما الأثر البلاغيّ للتّشبيه في «حياة النّاس… كتغيّر سطحها»؟",
   {"options": ["توضيح المعنى وتقريبه إلى الذّهن عن طريق المشابهة", "تجسيد المعنويّ بحذف المشبّه به والإبقاء على لازمه", "تقديم الحقيقة مصحوبة بدليلها", "الإيجاز بإطلاق الجزء وإرادة الكلّ"]},
   {"correct": 0}, "بلاغته: توضيح المعنى وتقريبه إلى الذّهن عن طريق المشابهة.", 0.25, "ar.rhetoric.effect")
st("s28", "q12", "q12-e4", "mcq", "ما نوع الصّورة البيانيّة في «دلّنا التّاريخ»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن موصوف"]},
   {"correct": 0}, "«دلّنا التّاريخ»: استعارة مكنيّة.", 0.25, "ar.rhetoric.metaphor")
st("s29", "q12", "q12-e5", "matching", "اشرح الاستعارة في «دلّنا التّاريخ»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه (المذكور)", "المشبّه به (المحذوف)", "اللّازمة الدّالّة عليه"], "rights": ["التّاريخ", "الإنسان", "الفعل «دلّ»", "الأرض"]},
   {"pairs": [0, 1, 2]}, "ذكر المشبّه (التّاريخ)، وحذف فيها المشبّه به (الإنسان)، ورمز إليه بلازمة من لوازمه (دلّ) على سبيل الاستعارة المكنيّة.", 0.25, "ar.rhetoric.metaphor")
st("s30", "q12", "q12-e6", "mcq", "ما الأثر البلاغيّ للاستعارة في «دلّنا التّاريخ»؟",
   {"options": ["تجسيد المعنى وتوضيحه في صورة محسوسة", "توضيح المعنى عن طريق المشابهة مع ذكر الأداة", "تقديم الحقيقة مصحوبة بدليلها", "إحداث جرس موسيقيّ"]},
   {"correct": 0}, "بلاغتها: تجسيد المعنى وتوضيحه في صورة محسوسة.", 0.25, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
st("s31", "q13", "q13-e1", "mcq", "عرّف بفنّ المقال.",
   {"options": ["بحث قصير يتناول موضوعًا ما في مجال من مجالات الحياة", "حكاية نثريّة طويلة متعدّدة الشّخصيّات والأحداث",
                "فنّ مخاطبة الجماهير شفاهيًّا لإقناعهم واستمالتهم", "قصّة قصيرة مسجوعة بطلها متخيّل"]},
   {"correct": 0}, "التّعريف بفنّ المقال: هو عبارة عن بحث قصير يتناول موضوعًا ما في مجال من مجالات الحياة.", 1, "ar.literature.prose")
st("s32", "q13", "q13-e2", "multi", "مَن أشهر روّاد فنّ المقال؟ (اختر كلّ ما يصحّ)",
   {"options": ["طه حسين", "محمّد البشير الإبراهيميّ", "ميخائيل نعيمة", "عبّاس محمود العقّاد", "امرؤ القيس", "المتنبّي", "أبو تمّام"]},
   {"correct": [0, 1, 2, 3]}, "أشهر أعلامه: طه حسين، الإبراهيميّ، ميخائيل نعيمة، العقّاد… (يكفي ثلاثة)؛ أمّا امرؤ القيس والمتنبّي وأبو تمّام فشعراء قدامى.", 1.5, "ar.literature.context")
FEAT_EXPL = ("خصائص المقال: الطّول المحدود (الإيجاز)، سهولة الألفاظ والتّراكيب، وحدة الموضوع، الاعتماد في إخراجه على منهجيّة واضحة (مقدّمة، عرض، خاتمة)، "
             "التّسلسل في عرض الأفكار والتّعليل والتّمثيل… يكتفي المترشّح بذكر ثلاث خصائص.")
st("s33", "q13", "q13-e3", "multi", "ما أهمّ خصائص فنّ المقال؟ (اختر كلّ ما يصحّ)",
   {"options": ["الطّول المحدود (الإيجاز)", "سهولة الألفاظ والتّراكيب", "وحدة الموضوع", "الاعتماد في إخراجه على منهجيّة واضحة (مقدّمة، عرض، خاتمة)",
                "التّسلسل في عرض الأفكار والتّعليل والتّمثيل", "الحبكة والعقدة والحلّ", "الالتزام بالوزن والقافية"]},
   {"correct": [0, 1, 2, 3, 4]}, FEAT_EXPL + " أمّا الحبكة فمن خصائص القصّة، والوزن والقافية من خصائص الشّعر.", 0.75, "ar.literature.features")
st("s34", "q13", "q13-e3", "fill_blank", "أكمل من خصائص فنّ المقال:",
   {"text": "الطّول ____ (الإيجاز)، ____ الألفاظ والتّراكيب، ووحدة ____.", "bank": ["المحدود", "سهولة", "الموضوع", "المفتوح", "غرابة", "القافية"]},
   {"blanks": [["المحدود"], ["سهولة"], ["الموضوع"]]}, FEAT_EXPL, 0.75, "ar.literature.features", "b")

TITLE = "بكالوريا 2012 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (أحمد أمين: الصّراع بين القديم والجديد)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2012، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من "
         f"ملفّ docx (والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID})، مقابَلًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4): النّصّ والفقرات والأسئلة "
         "متطابقة؛ ما تحته خطّ «الفترة» و«إمّا» (الأولى)، وما بين قوسين (تسير) و(كان صالحا). docx يجعل كلّ سطر مطبوع فقرة مستقلّة فوُصلت الأسطر بمسافة في فقرات "
         "الموضوع الرّسميّ الثّماني. أُبقي عنوان الشّرح «الشرح اللغوي:» كما في docx (الرّسميّ «شرح المفردات:»). في رأس docx سطر قالب قديم «دورة جوان 2008»؛ السّنة "
         "والشّعبة من الموضوع الرّسميّ والتّصحيح. العلامات من الإجابة النّموذجيّة الرّسميّة (ممسوح، ص3–4). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "س6 «2×01» بجانب إجابة متّصلة (الحكم والتّعليل) دون تحديد فبقيا عنصرًا واحدًا (2). مؤجَّل (essay_builder): التّلخيص س7 (3×01).")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write("ar-bac-2012-lit-p2", 2, TITLE, NOTES, LOG_NOTE)
