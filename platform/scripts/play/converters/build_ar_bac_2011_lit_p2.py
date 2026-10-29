"""Conversion: BAC 2011 (session عاديّة، جوان 2011) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الثّاني (فؤاد صرّوف، مقال في العلم ومشكلات الإنسانيّة).
Exam (most faithful source): gdrive 1FLlg4Sfbuq5dJA4tqgAtHzkw57UAwfvT (بكالوريا اللغة العربية 2011 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 1Vfcpbpq9haaUI6SaxNnnyZYtL9s_uehZ (BAC 2011 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1vfgRxjll8gOh8Hcya0HwFz0L_-_0oh-c (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1Ug-xorDl4CNePg0ky_2QHUpRK_-wb1Ol (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2015_lit_p2.py): PARAS below were generated from the .docx with python-docx (paragraph text read
exactly; only outer whitespace and outer direction marks trimmed) and spliced into this builder by script; the literals were
re-checked programmatically against the docx. The docx was compared line by line with the official ONEC paper (scanned page
images, crops enlarged ×1.9–2.2): same five paragraphs, same underlined words («على»، «في»، «مستوحيا»، «الرّقعة») and
bracketed sentences. The correction is a scanned PDF read from the page images (native 220 dpi). Every mark comes from the
official scheme; correct options and explanations condense its wording.

Docx defects fixed from the ONEC paper (applied after generation, each asserted to occur once):
- Part 1 Q3: the docx drops the final instruction ⇒ «هل كان الكاتب موضوعيا في طرح أفكاره؟ علّل.» (ONEC; the scheme marks
  the justification 4×0.25);
- Part 2 Q3: «… واذكر مؤشرين له، مع التعليل.» ⇒ «مع التّمثيل.» (ONEC; the scheme: «يكتفي المترشّح بمؤشّرين مع التّمثيل»);
- Part 3: a run of layout spaces left by a line wrap («وبما      درسته.») collapsed to one space.
Other differences are diacritics / spelling / punctuation / labels only (docx kept): «وللهمم أن تتحفز. وأن تعمل؟» (ONEC
«تتحفّز، وأن تعمل ؟»), part labels «أوّلا-/ثانيا-/ثالثا-» (ONEC without ordinals)…

Conversion notes / points for the owner's review:
- Streams: آداب وفلسفة only (ONEC paper and correction headers) ⇒ LIT.
- Underlines are not representable in the JSON documents: the i'rab steps name the underlined words and bracketed sentences.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «0.75 + 0.25» = topic / aim. Q2 «3×01» = problems / causes / solutions. The scheme lists two problems «كما وردت في
  إحدى فقرات النّص»; the text's third «كيف…» (موارد الأرض والبيئة) is therefore never used as a distractor — the distractors
  are evils the text says were overcome (الأوبئة، مستوى العيش).
- Q3 «01 + 4×0.25» = the verdict («نعم، كان الكاتب موضوعيا»; the scheme accepts no other opinion ⇒ interactive, to be
  confirmed by the owner) + exactly the four reasons listed ⇒ one element per reason.
- Q4 «01»: the scheme gives three titles separated by «/» ⇒ multi-select with all three as correct and only clearly
  unrelated titles as distractors. Q5 (تلخيص النّصّ) «3×01» = تقنية التّلخيص / منهجيّة العرض / سلامة اللّغة ⇒ three deferred
  essay_builder elements.
- Part 2: Q1 «2x0.25» = repetition / pronoun. Q2 «4×0.25» one element per particle (على، في، الواو، أو). Q3 «0.5 + 4×0.25»
  = type (the scheme says «النّمط الوصفيّ»; distractors السّرديّ/الحواريّ only, no التّفسيريّ/الحجاجيّ — the owner may want to
  review the scheme's choice) + two indicators with examples (six listed) ⇒ one element of 1; the matching step avoids
  pairing «المشتقّات» with «النّعوت» (the scheme's examples overlap). Q4 «2×0.5 + 2×0.5» one element per item («الرّقعة» بدل:
  no «نعت»/«عطف بيان» distractor). Q5 «2×0.5» one element per image (the question asks the type and the effect only).
- Part 3 (04): «01» definition, «01» kinds, «02» features (four listed) ⇒ three interactive elements.
- Distractors avoid arguable alternatives: no «الظّرفيّة» for «على الأرض», no «الإضراب»/«التّخيير» for «أو»; no «استعارة»
  for «إنّ المرء ليقلّب نظره» (كناية); no «حال»-like readings for the sentences.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2011-lit-p2"
PAPER = 2
STREAMS = ["LIT"]
DOCX_ID = "1FLlg4Sfbuq5dJA4tqgAtHzkw57UAwfvT"
DOCX_TITLE = "بكالوريا اللغة العربية 2011 شعبة اداب وفلسفة.docx"
PDF_ID = "1Vfcpbpq9haaUI6SaxNnnyZYtL9s_uehZ"
OFFICIAL_ID = "1vfgRxjll8gOh8Hcya0HwFz0L_-_0oh-c"
CORR_ID = "1Ug-xorDl4CNePg0ky_2QHUpRK_-wb1Ol"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    28: 'الموضوع الثاني',
    29: 'النّص:',
    30: '" يقتضينا الإنصاف أن نقول إن النصف الأول من هذا القرن، شهد ارتقاء مُطردا، ساعد على إنقاذ الملايين من الهلاك بالأوبئة، ومدّ في أمد الحياة على الأرض، وخفّف الآلام، وقهر الأمراض بالعقاقير الجديدة العجيبة، ويسّر انتشار التربيّة والمعرفة، ورفع مستوى العيش، وخفض من مساوئ التكتل الصناعي، وحسّن من أحوال العمال...وإن المرء ليُقلب نظره في ما حوله، فيرى كيف قاس الإنسان، بعلمه كُتلَ الأجرام ومساراتها في رحاب الكون. وكيف نَفذ إلى قلب الذرة ففلقه، وأخرج منه هلاكا، وضياء، وشفاء، وقوة محركة. وكيف بارى الطبيعة، فصنع ما تصنعه وما لا تصنعه، فَيُعجب به ويزهى.',
    31: 'إن المشكلات التي تعانيها الإنسانيّة اليوم، هي المشكلات التي لم تزل تعانيها منذ أن انشقت الحجب عن المعرفة الإنسانيّة، والضمير الإنساني، في فجرهما الأول، وإن تغيّرت مظاهرها: كيف نضمن قسطا من السلام من دون جمود يتيح للعقول أن تتفتّح وأن تزدهر، وللهمم أن تتحفز. وأن تعمل؟ كيف نسيطر على القوى الراعبة التي فتقها العلم، وجعلتها الصناعة في منال اليدين. فننتفع بها، من دون أن يتعرض لنا خطر الهلاك، في موجة من الضغط الكاسح، أو لفحة من الإشعاع المميت؟ كيف نحسن الانتفاع بموارد الأرض، أجدى انتفاع، من دون أن ندمر البيئة الطبيعيّة التي تزكو فيها الموارد؟',
    32: 'إن تاريخ الإنسان على الأرض، والتّجارب التي بلاها، والوسائل التي أتاحها العلم، والوفر الذي خلقته الصناعة والزراعة الحديثتان، أو في وسعهما أن تخلقاه، واليقظات الروحية في بعض عصور التاريخ، إن كل ذلك خليق أن يمهد للإنسان السّير إلى حل تلك المشكلات، إذا عقل ومضى مستوحيا خير ما أودع في سره مستعينا بربّه.',
    33: 'كلّ حل مرتقب لمشكلات الحياة التي نعانيها في هذا العصر، ولتوجيه مستقبلها على سطح الأرض، (إنما هو رهن بتثقيف العقول) والنفوس في آن، أي بالتعليم والتربية معا...فإذا (طلبنا التوفيق) في جعل الحياة، حياة الفرد، وحياة الجماعة، حياة أفضل وأكرم، فعلينا بالمادة الإنسانيّة: نعالجها، أي علينا بتربية الرجال والنساء الذين ينشدون الحقيقة، ويبرّون بالوعد، ويفون للصدق، ويطيعون القانون، ويؤثرون التّعاون، ويتنادون إلى الحق، ويعدلون في الحكم، ويعترفون بالفضل.',
    34: 'وفي تاريخنا، لو استلهمناه، أساس لهذا النّهج، ففي الأديان السمحة، التي أشرقت على الدنيا، من هذه الرقعة العريقة من الأرض، أركان هذه النظرة إلى الحياة، وفيها قامت الحضارات كان العلم من أرسخ دعائمها، فينبغي أن نستلهم منابتنا، فهي في الطليعة بين منابت الإنسانيّة، وأن نستخرج منها الحوافز التي تُمكننا من أن ننشئ المواطن الصّالح الذي تندمج فيه قدرة العقل، وفضيلة النفس".',
    35: 'فؤاد صروف - بتصرف-',
    38: 'الأسئلة:',
    39: 'أوّلا- البناء الفكري: (10 نقاط)',
    40: 'ما الموضوع الذي يعالجه الكاتب في هذا النّص؟ وما الهدف منه؟',
    41: 'ما المشكلات التي تعانيها الإنسانية؟ وما هي أسبابها؟ وما الحلول التي اقترحها الكاتب لها؟',
    42: 'هل كان الكاتب موضوعيا في طرح أفكاره؟',
    43: 'ضع عنوانا مناسبا للنّصّ.',
    44: 'لخّص النص محترما تقنيّة التلخيص.',
    45: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    46: 'بين دور التكرار والضمير في تحقيق الاتساق في تركيب فقرات النّص.',
    47: 'بين معاني حروف الجر والعطف في قول الكاتب: " إن تاريخ الإنسان على الأرض...أو في وسعهما أن تخلقاه ".',
    48: 'عيّن النمط السائد في هذا النص، واذكر مؤشرين له، مع التعليل.',
    49: 'أعرب ما تحته خط إعراب مفردات وما بين قوسين إعراب جمل.',
    50: 'ما نوع الصورتين البيانيتين الآتيتين، وما وجه بلاغتهما:" وقهر الأمراض"، " إن المرء ليقلب نظره"؟',
    51: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    52: 'النّص من فن المقال، عرّف بهذا الفن واذكر أنواعه وأهم خصائصه الفنيّة مستعينا بهذا السند وبما      درسته.',
}


def _fix(s, old, new):
    assert s.count(old) == 1, (old, s[:40])
    return s.replace(old, new)


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
                assert not (len(nk.replace(" ", "")) >= 4 and any(nk in c for c in caps)), (s["id"], "answer in caption", k)
    for eid, e in els.items():
        assert abs(got.get(eid, 0) - e["max_points"]) < 1e-9, (eid, got.get(eid), e["max_points"])
    assert abs(sum(qq["rubric_total"] for qq in Q) - total) < 1e-9, sum(qq["rubric_total"] for qq in Q)
    assert abs(sum(s["points"] for s in S) - total) < 1e-9, sum(s["points"] for s in S)
    assert len({s["id"] for s in S}) == len(S), "duplicate step ids"
    fps = [(_norm(s["prompt"]), json.dumps(s["payload"], ensure_ascii=False)) for s in S]
    assert len(set(fps)) == len(fps), "duplicate step content"


def _write(set_id, paper, streams, title, notes, log_note, docx_id, docx_title, corr_id, at):
    _check()
    doc = {
        "schema_version": 1,
        "set_id": set_id,
        "status": "NEEDS_HUMAN_REVIEW",
        "source": {
            "source_id": f"gdrive-{docx_id}-p{paper}",
            "kind": "BAC", "year": 2011, "level": "3AS", "streams": streams, "subject": "AR", "term": None, "paper": paper,
            "title": title,
            "original_url": f"https://drive.google.com/file/d/{docx_id}/view",
            "original_file_ref": f"gdrive:{docx_id} ({docx_title})",
            "correction_url": f"https://drive.google.com/file/d/{corr_id}/view",
            "correction_file_ref": f"gdrive:{corr_id} (02_التصحيح.pdf)",
            "trust": "official_mirror", "verified": False, "verified_by": None, "verified_at": None,
            "notes": notes,
        },
        "original_questions": Q,
        "steps": S,
        "score_total": 20,
        "modes": ["PRACTICE", "EXAM"],
        "review_log": [{"at": at, "by": "claude", "action": "generated", "note": log_note}],
    }
    json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n_int = sum(1 for s in S if s["type"] != "essay_builder")
    print(len(Q), "questions", sum(len(qq["rubric_elements"]) for qq in Q), "elements", len(S), "steps",
          f"({n_int} interactive / {len(S) - n_int} deferred)", sum(s["points"] for s in S), "points")


# ── الوثائق ──
DOCS = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(PARAS[i] for i in range(30, 35))},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[35]},
]
P1, P2, P3 = PARAS[39], PARAS[45], PARAS[51]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
J = lambda *ix: "\n".join(PARAS[i] for i in ix)
Q11_TEXT = _fix(PARAS[52], "وبما      درسته.", "وبما درسته.")

q("q1", "1", P1, J(40), 1, [el("q1-e1", "الموضوع الّذي يعالجه الكاتب", 0.75), el("q1-e2", "الهدف منه", 0.25)], DOCS)
q("q2", "2", P1, J(41), 3, [el("q2-e1", "المشكلات الّتي تعانيها الإنسانيّة", 1), el("q2-e2", "أسبابها", 1), el("q2-e3", "الحلول المقترحة", 1)], DOCS)
q("q3", "3", P1, _fix(PARAS[42], "أفكاره؟", "أفكاره؟ علّل."), 2,
  [el("q3-e1", "الحكم على موضوعيّة الكاتب", 1), el("q3-e2", "التّعليل: التّجرّد من الذّاتيّة", 0.25), el("q3-e3", "التّعليل: تحكيم العقل", 0.25),
   el("q3-e4", "التّعليل: التّعليل المنطقيّ المدعوم بالأمثلة", 0.25), el("q3-e5", "التّعليل: تقريب الحقائق قصد الإقناع", 0.25)], DOCS)
q("q4", "4", P1, J(43), 1, [el("q4-e1", "عنوان مناسب للنّصّ", 1)], DOCS)
q("q5", "5", P1, J(44), 3, [el("q5-e1", "التّلخيص: تقنية التّلخيص", 1), el("q5-e2", "التّلخيص: منهجيّة العرض", 1), el("q5-e3", "التّلخيص: سلامة اللّغة", 1)], DOCS)
q("q6", "1", P2, J(46), 0.5, [el("q6-e1", "دور التّكرار", 0.25), el("q6-e2", "دور الضّمير", 0.25)], DOCS)
q("q7", "2", P2, J(47), 1, [el("q7-e1", "معنى «على»", 0.25), el("q7-e2", "معنى «في»", 0.25), el("q7-e3", "معنى «الواو»", 0.25), el("q7-e4", "معنى «أو»", 0.25)], DOCS)
q("q8", "3", P2, _fix(PARAS[48], "مع التعليل.", "مع التّمثيل."), 1.5, [el("q8-e1", "النّمط السّائد", 0.5), el("q8-e2", "مؤشّران مع التّمثيل (4×0.25)", 1)], DOCS)
q("q9", "4", P2, J(49), 2, [el("q9-e1", "إعراب «مستوحيا»", 0.5), el("q9-e2", "إعراب «الرّقعة»", 0.5),
                            el("q9-e3", "محلّ جملة (إنّما هو رهن بتثقيف العقول)", 0.5), el("q9-e4", "محلّ جملة (طلبنا التّوفيق)", 0.5)], DOCS)
q("q10", "5", P2, J(50), 1, [el("q10-e1", "«وقهر الأمراض»: النّوع والبلاغة", 0.5), el("q10-e2", "«إنّ المرء ليقلّب نظره»: النّوع والبلاغة", 0.5)], DOCS)
q("q11", "التّعليمة", P3, Q11_TEXT, 4, [el("q11-e1", "التّعريف بفنّ المقال", 1), el("q11-e2", "أنواع المقال", 1), el("q11-e3", "أهمّ خصائصه الفنّيّة", 2)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("الموضوع الّذي يعالجه الكاتب في هذا النّصّ هو التّطوّر العلميّ الباهر الّذي شمل مختلف نواحي الحياة، والخطر الّذي يتهدّد البشريّة جرّاء بعض "
           "المشكلات الّتي نجمت عنه، وسبل تفادي ذلك الخطر. والهدف من الموضوع: توعية القارئ بما عرضه من أفكار حول الموضوع ليكون عنصرًا فعّالًا في الوسط الّذي يعيش فيه.")
st("s01", "q1", "q1-e1", "mcq", "ما الموضوع الّذي يعالجه الكاتب في هذا النّصّ؟",
   {"options": ["التّطوّر العلميّ الباهر الّذي شمل مختلف نواحي الحياة، والخطر الّذي يتهدّد البشريّة جرّاء بعض المشكلات الّتي نجمت عنه، وسبل تفادي ذلك الخطر",
                "تاريخ الأديان السّمحة الّتي أشرقت من المشرق", "الحروب العالميّة وأسبابها الاقتصاديّة", "الهجرة من الرّيف إلى المدينة"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e1", "fill_blank", "أكمل:",
   {"text": "التّطوّر العلميّ الباهر، والخطر الّذي يتهدّد ____ جرّاء بعض المشكلات الّتي نجمت عنه، وسبل ____ ذلك الخطر.",
    "bank": ["البشريّة", "تفادي", "الطّبيعة", "تعميق"]},
   {"blanks": [["البشريّة"], ["تفادي"]]}, Q1_EXPL, 0.25, "ar.comprehension.idea", "b")
st("s03", "q1", "q1-e2", "mcq", "ما الهدف من هذا الموضوع؟",
   {"options": ["توعية القارئ بما عرضه من أفكار حول الموضوع ليكون عنصرًا فعّالًا في الوسط الّذي يعيش فيه", "تنفير القارئ من العلم ودعوته إلى هجره",
                "الدّعاية لمخترعات حديثة", "التّسلية والإمتاع"]},
   {"correct": 0}, Q1_EXPL, 0.25, "ar.comprehension.purpose")
PROB_EXPL = ("المشكلات الّتي تعانيها الإنسانيّة كما وردت في إحدى فقرات النّصّ: كيف نضمن قسطًا من السّلام في غير جمود فكريّ؛ كيف نسيطر على القوى الرّاعبة "
             "(المخترعات الفتّاكة) من دون التّعرّض لخطر الهلاك.")
st("s04", "q2", "q2-e1", "multi", "ما المشكلات الّتي تعانيها الإنسانيّة كما وردت في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["كيف نضمن قسطًا من السّلام في غير جمود فكريّ", "كيف نسيطر على القوى الرّاعبة (المخترعات الفتّاكة) من دون التّعرّض لخطر الهلاك",
                "انتشار الأوبئة الّتي عجز العلم عن قهرها", "انخفاض مستوى العيش في النّصف الأوّل من القرن"]},
   {"correct": [0, 1]}, PROB_EXPL + " أمّا الأوبئة ومستوى العيش فيذكر النّصّ أنّ العلم أنقذ الملايين من الهلاك بها ورفع مستوى العيش.", 0.5, "ar.comprehension.details")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل إحدى المشكلات:",
   {"text": "كيف نسيطر على القوى ____ (المخترعات الفتّاكة) من دون التّعرّض لخطر ____.", "bank": ["الرّاعبة", "الهلاك", "الطّبيعيّة", "الفقر"]},
   {"blanks": [["الرّاعبة"], ["الهلاك"]]}, PROB_EXPL, 0.5, "ar.comprehension.details", "b")
CAUSE_EXPL = ("ترجع تلك الأسباب إلى ما أحرزته الإنسانيّة من تقدّم وازدهار في مناحي الحياة المختلفة نتيجة الاختراعات العلميّة والتّطوّر التّكنولوجيّ الكبير، "
              "فكان لهذه الاكتشافات فوائد ومنافع من ناحية، ومضارّ تهدّد حياة الإنسان من ناحية ثانية إن لم نتعقّل في استخدامها واستغلالها.")
st("s06", "q2", "q2-e2", "mcq", "ما أسباب هذه المشكلات؟",
   {"options": ["ما أحرزته الإنسانيّة من تقدّم وازدهار نتيجة الاختراعات العلميّة والتّطوّر التّكنولوجيّ الكبير، فلهذه الاكتشافات منافع ومضارّ إن لم نتعقّل في استخدامها",
                "تخلّف الإنسانيّة وجهلها بالعلم", "قلّة الموارد الطّبيعيّة وانعدام الصّناعة", "تمسّك النّاس بالأديان السّمحة"]},
   {"correct": 0}, CAUSE_EXPL, 0.5, "ar.comprehension.explain")
st("s07", "q2", "q2-e2", "fill_blank", "أكمل:",
   {"text": "فكان لهذه الاكتشافات ____ ومنافع من ناحية، و____ تهدّد حياة الإنسان من ناحية ثانية إن لم نتعقّل في استخدامها واستغلالها.",
    "bank": ["فوائد", "مضارّ", "حروب", "أمراض"]},
   {"blanks": [["فوائد"], ["مضارّ"]]}, CAUSE_EXPL, 0.5, "ar.comprehension.explain", "b")
SOL_EXPL = "الحلول المقترحة: تثقيف العقول والنّفوس معًا بالتّعليم والتّربية؛ تربية الرّجال والنّساء على جملة من الصّفات الحميدة؛ إنشاء المواطن الصّالح عقلًا وروحًا."
st("s08", "q2", "q2-e3", "multi", "ما الحلول الّتي اقترحها الكاتب؟ (اختر كلّ ما يصحّ)",
   {"options": ["تثقيف العقول والنّفوس معًا بالتّعليم والتّربية", "تربية الرّجال والنّساء على جملة من الصّفات الحميدة", "إنشاء المواطن الصّالح عقلًا وروحًا",
                "إيقاف البحث العلميّ والعودة إلى حياة البداوة", "الاعتماد على القوّة العسكريّة وحدها"]},
   {"correct": [0, 1, 2]}, SOL_EXPL, 0.5, "ar.comprehension.details")
st("s09", "q2", "q2-e3", "fill_blank", "أكمل الحلول المقترحة:",
   {"text": "تثقيف ____ والنّفوس معًا بالتّعليم والتّربية؛ إنشاء المواطن الصّالح عقلًا و____.", "bank": ["العقول", "روحًا", "الأجساد", "مالًا"]},
   {"blanks": [["العقول"], ["روحًا"]]}, SOL_EXPL, 0.5, "ar.comprehension.details", "b")
OBJ_EXPL = ("نعم، كان الكاتب موضوعيًّا في عرض أفكاره لـ: تجرّده من الذّاتيّة، أي ابتعاده عن العواطف والانفعالات؛ تحكيمه العقل في ما يسوقه من أفكار؛ "
            "تعليله المنطقيّ المدعوم بالأمثلة الواقعيّة والتّاريخيّة؛ تقريبه الحقائق إلى ذهن القارئ قصد إقناعه.")
st("s10", "q3", "q3-e1", "mcq", "هل كان الكاتب موضوعيًّا في طرح أفكاره؟",
   {"options": ["نعم، كان الكاتب موضوعيًّا في عرض أفكاره", "لا، كان ذاتيًّا منساقًا وراء عواطفه", "كان موضوعيًّا في الفقرة الأولى وحدها",
                "لا، لأنّه تحامل على العلم والعلماء"]},
   {"correct": 0}, OBJ_EXPL, 1, "ar.comprehension.opinion")
st("s11", "q3", "q3-e2", "mcq", "علّل: من دلائل موضوعيّة الكاتب:",
   {"options": ["تجرّده من الذّاتيّة، أي ابتعاده عن العواطف والانفعالات", "إكثاره من التّعبير عن مشاعره الخاصّة", "اعتماده على الخيال والأساطير",
                "مبالغته في المدح والهجاء"]},
   {"correct": 0}, OBJ_EXPL, 0.25, "ar.comprehension.explain")
st("s12", "q3", "q3-e3", "fill_blank", "أكمل تعليلًا آخر:",
   {"text": "تحكيمه ____ في ما يسوقه من أفكار.", "bank": ["العقل", "العاطفة", "الهوى"]}, {"blanks": [["العقل"]]}, OBJ_EXPL, 0.25, "ar.comprehension.explain")
st("s13", "q3", "q3-e4", "mcq", "ومن دلائل موضوعيّته أيضًا:",
   {"options": ["تعليله المنطقيّ المدعوم بالأمثلة الواقعيّة والتّاريخيّة", "سرده لأحداث خياليّة لا صلة لها بالواقع", "اعتماده على الشّائعات",
                "انفعاله الشّديد في الحكم على الأشياء"]},
   {"correct": 0}, OBJ_EXPL, 0.25, "ar.comprehension.explain")
st("s14", "q3", "q3-e5", "fill_blank", "أكمل التّعليل الأخير:",
   {"text": "تقريبه الحقائق إلى ذهن ____ قصد ____.", "bank": ["القارئ", "إقناعه", "الكاتب", "تخويفه"]},
   {"blanks": [["القارئ"], ["إقناعه"]]}, OBJ_EXPL, 0.25, "ar.comprehension.explain")
TITLE_EXPL = "عنوان النّصّ: العلم سلاح ذو حدّين / خطر الاكتشاف العلميّ / العلم والمشكلات الإنسانيّة."
st("s15", "q4", "q4-e1", "multi", "أيّ العناوين الآتية مناسب للنّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["العلم سلاح ذو حدّين", "خطر الاكتشاف العلميّ", "العلم والمشكلات الإنسانيّة", "جمال الطّبيعة", "الحنين إلى الوطن", "رحلة إلى الفضاء"]},
   {"correct": [0, 1, 2]}, TITLE_EXPL, 0.5, "ar.writing.title")
st("s16", "q4", "q4-e1", "fill_blank", "أكمل العنوان المقترح:",
   {"text": "العلم سلاح ذو ____", "bank": ["حدّين", "نفع", "ضرر"]}, {"blanks": [["حدّين"]]}, TITLE_EXPL, 0.5, "ar.writing.title", "b")
SUM_SPEC = {"task": "تلخيص النّصّ مع احترام تقنية التّلخيص", "text": "فؤاد صرّوف (بكالوريا 2011، آداب وفلسفة، الموضوع الثّاني)",
            "scheme": "التّلخيص ويراعى فيه: تقنية التّلخيص – منهجيّة العرض – سلامة اللّغة (3×01)"}
SUM_EXPL = "يراعى في التّلخيص: تقنية التّلخيص – منهجيّة العرض – سلامة اللّغة (نقطة لكلّ معيار). لا يقدّم الحلّ ملخّصًا نموذجيًّا."
for sid, eid, crit in [("s17", "q5-e1", "تقنية التّلخيص"), ("s18", "q5-e2", "منهجيّة العرض"), ("s19", "q5-e3", "سلامة اللّغة")]:
    essay(sid, "q5", eid, "تلخيص نصّ فؤاد صرّوف", crit, crit, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
COH_EXPL = ("لقد أدّى التّكرار والضّمير وظيفة في تحقيق الاتّساق في تراكيب النّصّ: التّكرار: تأكيد المعنى وترسيخه في الذّهن (المشكلات، تعانيها، كيف…)؛ "
            "الضّمير: ضمير المتكلّم (يقتضينا، نقول، نضمن، نعانيها، نستلهم، ننشئ…)، ليجعل الجميع معنيًّا بهذه المشكلات الّتي تهدّد حياتهم، وبالتّالي لم يخرج عن "
            "نسق النّصّ من حيث المضمون.")
st("s20", "q6", "q6-e1", "mcq", "ما دور التّكرار (المشكلات، تعانيها، كيف…) في تحقيق اتّساق النّصّ؟",
   {"options": ["تأكيد المعنى وترسيخه في الذّهن", "إحداث تناقض بين الأفكار", "إطالة النّصّ دون فائدة", "الانتقال إلى موضوع جديد"]},
   {"correct": 0}, COH_EXPL, 0.25, "ar.cohesion.effect")
st("s21", "q6", "q6-e2", "mcq", "ما دور ضمير المتكلّم (يقتضينا، نقول، نضمن، نعانيها، نستلهم، ننشئ…) في اتّساق النّصّ؟",
   {"options": ["جعل الجميع معنيًّا بهذه المشكلات الّتي تهدّد حياتهم، فلم يخرج عن نسق النّصّ من حيث المضمون", "إبراز ذاتيّة الكاتب ومشاعره الخاصّة",
                "الإحالة إلى شخصيّات خارج النّصّ", "التّشويق إلى ما سيأتي"]},
   {"correct": 0}, COH_EXPL, 0.25, "ar.cohesion.reference")
PART_EXPL = "معاني حروف الجرّ: على: الاستعلاء – في: الظّرفيّة. معاني حروف العطف: الواو: مطلق الجمع – أو: الشّكّ."
st("s22", "q7", "q7-e1", "mcq", "ما معنى «على» في قوله: «إنّ تاريخ الإنسان على الأرض»؟",
   {"options": ["الاستعلاء", "السّببيّة", "المصاحبة", "التّعليل"]}, {"correct": 0}, PART_EXPL, 0.25, "ar.grammar.rules")
st("s23", "q7", "q7-e2", "fill_blank", "أكمل معنى «في» في قوله: «أو في وسعهما أن تخلقاه»:",
   {"text": "«في» تفيد ____.", "bank": ["الظّرفيّة", "الاستعلاء", "السّببيّة"]}, {"blanks": [["الظّرفيّة"]]}, PART_EXPL, 0.25, "ar.grammar.rules")
st("s24", "q7", "q7-e3", "mcq", "ما معنى حرف العطف «الواو» في قوله: «والتّجارب الّتي بلاها، والوسائل الّتي أتاحها العلم»؟",
   {"options": ["مطلق الجمع", "التّرتيب مع التّعقيب", "التّرتيب مع التّراخي", "الشّكّ"]}, {"correct": 0}, PART_EXPL, 0.25, "ar.cohesion.connectors")
st("s25", "q7", "q7-e4", "mcq", "ما معنى حرف العطف «أو» في قوله: «خلقته الصّناعة والزّراعة الحديثتان، أو في وسعهما أن تخلقاه»؟",
   {"options": ["الشّكّ", "مطلق الجمع", "التّرتيب مع التّراخي", "التّرتيب مع التّعقيب"]}, {"correct": 0}, PART_EXPL, 0.25, "ar.cohesion.connectors")
TYPE_EXPL = ("النّمط الوصفيّ. من مؤشّراته: توظيف المشتقّات (الكاسح، المميت «اسم فاعل»)، النّعوت (الرّاعبة، الصّالح)، الإضافات (إنقاذ الملايين، رحاب الكون)، "
             "الصّور البيانيّة (قهر الأمراض – استعارة – بين منابت الإنسانيّة – تشبيه بليغ)، الجمل الاسميّة (إنّ المشكلات… هي المشكلات، كلّ حلّ مرتقب… إنّما هو "
             "رهن…)، الأفعال الماضية والمضارعة الدّالّة على الحيويّة والحركة والاستمرار (خفّف، يسّر، نضمن، نسيطر…). يكتفي المترشّح بمؤشّرين مع التّمثيل.")
st("s26", "q8", "q8-e1", "mcq", "ما النّمط السّائد في هذا النّصّ حسب الإجابة النّموذجيّة؟",
   {"options": ["الوصفيّ", "السّرديّ", "الحواريّ"]}, {"correct": 0}, TYPE_EXPL, 0.5, "ar.text.type")
st("s27", "q8", "q8-e2", "multi", "أيّ ممّا يلي من مؤشّرات هذا النّمط في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["توظيف المشتقّات", "النّعوت", "الإضافات", "الصّور البيانيّة", "الجمل الاسميّة", "الأفعال الدّالّة على الحيويّة والحركة والاستمرار",
                "الحوار بين الشّخصيّات", "تتابع الأحداث على لسان راوٍ"]},
   {"correct": [0, 1, 2, 3, 4, 5]}, TYPE_EXPL, 0.5, "ar.text.type")
st("s28", "q8", "q8-e2", "matching", "طابق كلّ مؤشّر بمثاله من النّصّ.",
   {"lefts": ["توظيف المشتقّات", "الإضافات", "الجمل الاسميّة", "الأفعال الدّالّة على الحيويّة والحركة والاستمرار"],
    "rights": ["(الكاسح، المميت «اسم فاعل»)", "(إنقاذ الملايين، رحاب الكون)", "(إنّ المشكلات… هي المشكلات)", "(خفّف، يسّر، نضمن، نسيطر…)", "(قالت، أجاب…)"]},
   {"pairs": [0, 1, 2, 3]}, TYPE_EXPL, 0.5, "ar.text.type", "b")
st("s29", "q9", "q9-e1", "mcq", "ما إعراب «مستوحيا» (تحته خطّ) في قوله: «إذا عقل ومضى مستوحيا خير ما أودع في سرّه»؟",
   {"options": ["حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها", "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة", "مفعول لأجله منصوب وعلامة نصبه الفتحة الظّاهرة",
                "تمييز منصوب وعلامة نصبه الفتحة الظّاهرة"]},
   {"correct": 0}, "«مستوحيا»: حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها.", 0.5, "ar.grammar.irab")
st("s30", "q9", "q9-e2", "fill_blank", "أكمل إعراب «الرّقعة» (تحتها خطّ) في قوله: «من هذه الرّقعة العريقة من الأرض»:",
   {"text": "الرّقعة: ____ من اسم الإشارة مجرور وعلامة جرّه ____ الظّاهرة.", "bank": ["بدل", "الكسرة", "فاعل", "الفتحة"]},
   {"blanks": [["بدل"], ["الكسرة"]]}, "«الرّقعة»: بدل من اسم الإشارة مجرور وعلامة جرّه الكسرة الظّاهرة.", 0.5, "ar.grammar.badal")
st("s31", "q9", "q9-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (إنّما هو رهن بتثقيف العقول)؟",
   {"options": ["في محلّ رفع خبر المبتدأ (كلّ)", "في محلّ نصب حال", "في محلّ نصب مفعول به", "في محلّ جرّ نعت"]},
   {"correct": 0}, "(إنّما هو رهن بتثقيف العقول): في محلّ رفع خبر المبتدأ (كلّ) في قوله: «كلّ حلّ مرتقب…».", 0.5, "ar.grammar.sentence_case")
st("s32", "q9", "q9-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (طلبنا التّوفيق) في قوله: «فإذا (طلبنا التّوفيق)…»؟",
   {"options": ["جملة فعليّة في محلّ جرّ مضاف إليه", "جملة فعليّة لا محلّ لها من الإعراب لأنّها جواب شرط غير جازم", "جملة فعليّة في محلّ نصب مفعول به",
                "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(طلبنا التّوفيق): جملة فعليّة في محلّ جرّ مضاف إليه (بعد «إذا»).", 0.5, "ar.grammar.sentence_case")
IMG1 = ("«قهر الأمراض»: استعارة مكنيّة، حيث شبّه الأمراض بالعدوّ الّذي يحارَب فيُقهر ويُغلب، فحذف المشبّه به (العدوّ) وذكر القرينة الدّالّة عليه (قهر). "
        "بلاغة الصّورة: جسّدت المعنى المجرّد في صورة حسّيّة فزادته وضوحًا وتأكيدًا.")
st("s33", "q10", "q10-e1", "mcq", "ما نوع الصّورة البيانيّة في «وقهر الأمراض»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته السّببيّة"]}, {"correct": 0}, IMG1, 0.25, "ar.rhetoric.metaphor")
st("s34", "q10", "q10-e1", "mcq", "ما وجه بلاغة الصّورة في «وقهر الأمراض»؟",
   {"options": ["جسّدت المعنى المجرّد في صورة حسّيّة فزادته وضوحًا وتأكيدًا", "تقديم الحقيقة مصحوبة بدليلها", "الإيجاز بذكر الجزء وإرادة الكلّ",
                "إحداث جرس موسيقيّ في العبارة"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.effect", "b")
IMG2 = "«وإنّ المرء ليقلّب نظره في ما حوله»: كناية عن صفة وهي الدّهشة والتّعجّب والانبهار. بلاغة الصّورة: وضعت المعنى في صورة محسوسة ممّا جعله قريبًا من الذّهن."
st("s35", "q10", "q10-e2", "mcq", "ما نوع الصّورة البيانيّة في «إنّ المرء ليقلّب نظره»؟",
   {"options": ["كناية عن صفة وهي الدّهشة والتّعجّب والانبهار", "كناية عن موصوف", "تشبيه بليغ", "مجاز مرسل علاقته المحلّيّة"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.metonymy")
st("s36", "q10", "q10-e2", "mcq", "ما وجه بلاغة الصّورة في «إنّ المرء ليقلّب نظره»؟",
   {"options": ["وضعت المعنى في صورة محسوسة ممّا جعله قريبًا من الذّهن", "المبالغة بادّعاء أنّ المشبّه عين المشبّه به", "إحداث جرس موسيقيّ في العبارة",
                "تشخيص الجماد وبثّ الحياة فيه"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.effect", "b")
# ── ثالثًا: التّقويم النّقديّ ──
DEF_EXPL = ("التّعريف بالمقال: المقال قطعة نثريّة محدودة الطّول تُكتب لتُنشر على صفحات جريدة أو مجلّة، وتتناول جانبًا من جوانب موضوع ما بطريقة تجمع بين "
            "الإقناع والإبداع والإمتاع.")
st("s37", "q11", "q11-e1", "mcq", "ما تعريف فنّ المقال؟",
   {"options": ["قطعة نثريّة محدودة الطّول تُكتب لتُنشر على صفحات جريدة أو مجلّة، وتتناول جانبًا من جوانب موضوع ما بطريقة تجمع بين الإقناع والإبداع والإمتاع",
                "قصيدة شعريّة طويلة تروي أحداثًا بطوليّة", "حكاية نثريّة تقوم على الأحداث والشّخصيّات والحوار", "نصّ يُكتب للتّمثيل على خشبة المسرح"]},
   {"correct": 0}, DEF_EXPL, 0.5, "ar.literature.prose")
st("s38", "q11", "q11-e1", "fill_blank", "أكمل تعريف المقال:",
   {"text": "قطعة نثريّة محدودة ____ تُكتب لتُنشر على صفحات جريدة أو ____، وتتناول جانبًا من جوانب موضوع ما بطريقة تجمع بين الإقناع والإبداع و____.",
    "bank": ["الطّول", "مجلّة", "الإمتاع", "القوافي", "ديوان", "الإطناب"]},
   {"blanks": [["الطّول"], ["مجلّة"], ["الإمتاع"]]}, DEF_EXPL, 0.5, "ar.literature.prose", "b")
KIND_EXPL = ("أنواعه: تتعدّد أنواع المقال تبعًا للموضوعات الّتي يعالجها، فإذا كانت في الأدب فهو مقال أدبيّ، وإذا كانت في النّقد فهو مقال نقديّ، وقد تكون في "
             "الفلسفة أو السّياسة أو الاجتماع أو التّاريخ… إلخ.")
st("s39", "q11", "q11-e2", "mcq", "علامَ تتعدّد أنواع المقال؟",
   {"options": ["تبعًا للموضوعات الّتي يعالجها", "تبعًا لطول المقال وقصره", "تبعًا لبلد الكاتب", "تبعًا لعدد قرّائه"]},
   {"correct": 0}, KIND_EXPL, 0.5, "ar.literature.prose")
st("s40", "q11", "q11-e2", "multi", "أيّ ممّا يلي من أنواع المقال بحسب موضوعه؟ (اختر كلّ ما يصحّ)",
   {"options": ["المقال الأدبيّ", "المقال النّقديّ", "المقال الفلسفيّ", "المقال السّياسيّ", "المقال الاجتماعيّ", "المقال التّاريخيّ", "الأرجوزة", "الموشّح"]},
   {"correct": [0, 1, 2, 3, 4, 5]}, KIND_EXPL + " أمّا الأرجوزة والموشّح فشكلان شعريّان.", 0.5, "ar.literature.prose", "b")
FEAT_EXPL = "بعض خصائصه: وحدة الموضوع، الإيجاز والتّركيز، الهيكلة والتّصميم (مقدّمة، عرض، خاتمة)، الوضوح في الأفكار والسّهولة في اللّغة."
st("s41", "q11", "q11-e3", "multi", "أيّ ممّا يلي من أهمّ الخصائص الفنّيّة لفنّ المقال؟ (اختر كلّ ما يصحّ)",
   {"options": ["وحدة الموضوع", "الإيجاز والتّركيز", "الهيكلة والتّصميم (مقدّمة، عرض، خاتمة)", "الوضوح في الأفكار والسّهولة في اللّغة", "الوزن والقافية",
                "تعدّد الشّخصيّات والحبكة", "الإطالة والاستطراد"]},
   {"correct": [0, 1, 2, 3]}, FEAT_EXPL, 1, "ar.literature.features")
st("s42", "q11", "q11-e3", "fill_blank", "أكمل خصائص المقال:",
   {"text": "وحدة ____، الإيجاز و____، الهيكلة والتّصميم (مقدّمة، عرض، ____)، الوضوح في الأفكار والسّهولة في ____.",
    "bank": ["الموضوع", "التّركيز", "خاتمة", "اللّغة", "الاستطراد", "القافية"]},
   {"blanks": [["الموضوع"], ["التّركيز"], ["خاتمة"], ["اللّغة"]]}, FEAT_EXPL, 1, "ar.literature.features", "b")

TITLE = "بكالوريا 2011 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الثّاني (فؤاد صرّوف: العلم ومشكلات الإنسانيّة)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2011، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص3–4، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّبت من الموضوع الرّسميّ عيوب في docx: س3 ينقصه «علّل.»، البناء اللّغويّ س3 «مع التعليل» ← «مع التّمثيل»؛ وجُمعت مسافات التّخطيط في تعليمة التّقويم النّقديّ. "
         "التّسطير (على، في، مستوحيا، الرّقعة) لا يظهر في الوثائق، وتسمّيه الخطوات. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص3–4، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "مؤجَّل (essay_builder): التّلخيص س5 (3×01). النّمط في الحلّ «الوصفيّ» (للمراجعة).")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write(SET_ID, PAPER, STREAMS, TITLE, NOTES, LOG_NOTE, DOCX_ID, DOCX_TITLE, CORR_ID, "2026-10-29T18:00:00Z")
