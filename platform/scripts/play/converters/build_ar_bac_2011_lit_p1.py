"""Conversion: BAC 2011 (session عاديّة، جوان 2011) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (عبد السّلام الحبيب، «اليوم يومك يا جزائر»).
Exam (most faithful source): gdrive 1FLlg4Sfbuq5dJA4tqgAtHzkw57UAwfvT (بكالوريا اللغة العربية 2011 شعبة اداب وفلسفة.docx);
same paper as PDF (owner's copy): gdrive 1Vfcpbpq9haaUI6SaxNnnyZYtL9s_uehZ (BAC 2011 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1vfgRxjll8gOh8Hcya0HwFz0L_-_0oh-c (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1Ug-xorDl4CNePg0ky_2QHUpRK_-wb1Ol (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2015_lit_p1.py / build_ar_bac_2016_lit_p1.py): PARAS / POEM_RAW below were generated from the .docx
with python-docx (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed; the poem
table is read as rows [عجز, (empty), «n-صدر»] from the RTL 3-column layout and the verse number is split off the صدر cell)
and spliced into this builder by script; the literals were re-checked programmatically against the docx. The docx was
compared verse by verse and line by line with the official ONEC paper (scanned page images, crops enlarged ×2–2.5): same
13 verses, same underlined words («الجنى» ب1، «مسكا» ب3) and bracketed sentences (ب7، ب12). The correction is a scanned PDF
read from the page images (crops at native 220 dpi). Every mark comes from the official scheme; correct options and
explanations condense its wording.

Docx defects fixed from the ONEC paper (applied after generation, each asserted to occur once):
- Part 1 Q7: the docx reads «لخص مضمون النّص.» but the ONEC paper (and the scheme: «تلخيص مضمون الأبيات الأربعة الأخيرة»)
  read «… مضمون الأبيات الأربعة الأخيرة.» ⇒ «لخص مضمون الأبيات الأربعة الأخيرة.»;
- Part 2 Q5: the docx lists only the first expression («" انطوت راياتهم"») although the question announces two images; the
  ONEC paper adds «، " شفاها الثّأر "» ⇒ appended as «، " شفاها الثّأر"» (the scheme answers both);
- Part 3: «وأثره قي تحقيق» ⇒ «في تحقيق».
- Line-wrapped questions (Part 1 Q4, Part 2 Q1, the Part 3 instruction) joined with a space.
Other differences are diacritics / spelling / labels only (docx kept): «عَم يتحدّث» (ONEC «عمّ»), the docx part labels
«أوّلا-/ثانيا-/ثالثا-» (ONEC without ordinals), «الشرح اللغوي:» (ONEC «شرح المفردات:»), the odd closing quote of Part 2 Q2
(«أَتسطع الأنوار؟ '.» — the ONEC scan shows a similar mark)…

Conversion notes / points for the owner's review:
- Streams: آداب وفلسفة only (ONEC paper and correction headers) ⇒ LIT.
- Underlines are not representable in the JSON documents: the i'rab steps name the underlined words and bracketed sentences.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×0.5» = topic / explanation. Q2 «2×0.5» = why November / content of the address. Q3 «2×0.5» = how / why.
  Q4 «6×0.25» = one element per word or expression. Q5 «2×0.75» = one element per emotion (emotion + its verses; the scheme
  lists verses 1، 2، 3، 5 and 4، 8، 9، 10، 11، 12، 13 — verses 6 and 7 are never used in the verse multi-selects).
  Q6 «2×0.5» = the value / its verse. Q7 (تلخيص الأبيات الأربعة الأخيرة) «3×01» = احترام التّقنية / منهجيّة العرض / سلامة اللّغة
  ⇒ three deferred essay_builder elements.
- Part 2: Q1 «4×0.25» one element per preposition. Q2 «0.5». Q3 «0.25 + 4×0.25» = type + two indicators with examples
  («يكتفي المترشّح بمؤشّرين مع التّمثيل», four listed) ⇒ one element of 1. Q4 «2×0.5 + 2×0.5» one element per item
  («مسكا» تمييز: no «حال» distractor; (توهّموا منّا الخنوع) معطوفة على الابتدائيّة: no «حال» distractor).
  Q5: «انطوت راياتهم» «2×0.25» unlabelled ⇒ one element of 0.5 (type with its meaning / effect); «شفاها الثّأر» «3x0.25» =
  type / explanation / effect ⇒ three elements. No «كناية» distractor for «شفاها الثّأر», no «استعارة» for «انطوت راياتهم».
- Part 3 (04): «01» the values, «0.2» beside the role of the poets — read as «02» since the total is printed «04» (01 + 02 +
  01) and no other line carries the poets' names — and «01» the effect of the revolution ⇒ three interactive elements
  (closed model content, as in the BAC 2018/2020 converters). To be confirmed by the owner.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2011-lit-p1"
PAPER = 1
STREAMS = ["LIT"]
DOCX_ID = "1FLlg4Sfbuq5dJA4tqgAtHzkw57UAwfvT"
DOCX_TITLE = "بكالوريا اللغة العربية 2011 شعبة اداب وفلسفة.docx"
PDF_ID = "1Vfcpbpq9haaUI6SaxNnnyZYtL9s_uehZ"
OFFICIAL_ID = "1vfgRxjll8gOh8Hcya0HwFz0L_-_0oh-c"
CORR_ID = "1Ug-xorDl4CNePg0ky_2QHUpRK_-wb1Ol"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    0: 'على المترشح أن يختار أحد الموضوعين الآتيين:',
    1: 'الموضوع الأول',
    2: 'النّـــــص:',
    3: 'عبد السلام الحبيب الجزائري.',
    4: 'الشرح اللغوي:    الشطأ: ورق الزرع،      تضوعت: انتشرت،     الحفائظ: جمع حفيظة: الغضب،                     طوى: أخفى،        غبراؤنا: الغبراء: الأرض،         رميم: رم العظم، بلي وقدم.',
    5: 'الأسئلة:    أوّلا- البناء الفكري: (10 نقاط)',
    6: 'عَم يتحدّث الشاعر في الأبيات الأربعة الأولى؟ وضّح.',
    7: 'لِمَ خصّ الشّاعر نوفمبر بالخطاب؟ ما مضمون هذا الخطاب؟',
    8: 'كيف كان حقد الشّاعر على الدّخلاء؟ ولماذا؟',
    9: 'بماذا توحي لك الكلمات والعبارات الآتية في سياقها النّصي: " الرّاحلين - صبَّار-',
    10: 'الإعصار- اليوم يومك- طاب الجنى - حق الجلاء "؟',
    11: 'في النصّ عاطفتان بارزتان متباينتان. اذكرهما وحدّد الأبيات الدالة عليهما.',
    12: 'في القصيدة قيمة تاريخية هامة، أبرزها مستشهدا لها من النص.',
    13: 'لخص مضمون النّص.',
    14: 'ثانيا- البناء اللّغوي: (06 نقاط)',
    15: 'ما المعاني التي تفيدها حروف الجر في العبارات الآتية: "على ربواتك الأزهار”، " فالأرض',
    16: 'لي والدار"، "عشنا في الدجى"، "قل للراحلين".',
    17: 'ما الإيحاء النّفسي الذي يثيره الاستفهام في قول الشّاعر: " أَتسطع الأنوار؟ \'.',
    18: 'ما النمط السائد في القصيدة؟ اذكر مؤشرين له مع التمثيل لهما من النّص.',
    19: 'أعرب ما تحته خط إعراب مفردات، وما بين قوسين إعراب جمل.',
    20: 'في العبارتين الآتيتين صورتان بيانيتان، اشرحهما ثم بِيّن نوعهما وبلاغتهما:',
    21: '" انطوت راياتهم"',
    22: 'ثالثا- التّقويم النقدي: (04 نقاط)',
    23: '"كان للثورة التحريريّة الجزائريّة الأثر البارز في إيقاظ الشعور الوطني والقومي لأبناء الأمّة العربيّة بما حملته من قيم إنسانيّة سامية ".',
    24: 'بيّن- انطلاقا من قصيدة الشاعر عبد السّلام الحبيب، وعلى ضوء ما درست - هذه القيم ودور',
    25: 'الشعراء الجزائريين والعرب في إذكاء ذلك الشعور. وأثره قي تحقيق آمال الأمّة وتطلعاتها حاضرا',
    26: 'ومستقبلا.',
}
POEM_RAW = [
    ['طاب الجنى وتدانت الأثـــــــــــمارُ', '', '1-اليوم يومـــــك يا جـــــــزائر فاقــــــــــــطفي'],
    ['إن الحصيد لَعزةٌ وفـــــــــــــــــــــــــــــــــخار', '', '2-يا من غرست ثرى النضال جماجِمًا'],
    ['مِسكا على ربواتـــــــــــــــــــك الأزهار', '', '3-الزّرع أخــــــــــــــــرج شطأه وتضـــــــوّعـــت'],
    ['راياتهم، فالأرض لي والــــــــــــــــدار', '', '4-حق الجلاءُ على عداتك وانطـــــوت'],
    ['عَشـــيت تحن لنورك الأبصــــــــــــار', '', '5-نوفمـــــــــــبر أشرق للعيــــــــــــــــون فطالمــا'],
    ['متسائلـــــــــين أتسطــــــع الأنـــــــــــوار؟', '', '6-قرن من الآلام عشـــــــنا في الدجـــــــى'],
    ['(إنَّ الحـــفائظ ما شـفاها الثـــــأر)', '', '7-نوفمبــــــر قــــــــــل للرَّاحلــــــــــين ورهطهم'],
    ['رِممًــــــا يُرفرف حولــــــها التذكـــــــار', '', '8-سنظل نحـــــــقد ما طــــوت غبــــــراؤنَا'],
    ['مئـــــــــة تفضت والنــــــفوس حـــــــرار', '', '9-مضــــــت الثلاثــــون العجاف وقبلها'],
    ['صـــــلفا، فهم مــــــــــا بيننــــــا أُمَّــــــــار', '', '10-يتبخــــــتــــر الدّخــــلاء في جنــــــاتـــــنا'],
    ['أن الزّمــــــان عـــلى المـــــــــدى دوار', '', '11-أمنـــــوا الزمـــــــان مكابرين، وفاتهم'],
    ['يـــــــــــا شعـــب أنـــــــــك وَاجِم صــــــــبار', '', '12-و(تَوهموا مـــــنا الخنوع) وغـــــــرهم'],
    ['بعــــــد الســــــــكون يُدمـــدم الإعصار', '', '13-ضلـــــوا السبيل بنا وساء حســــابهم'],
]


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
POEM = []
for _ajz, _empty, _sadr in POEM_RAW:
    _m = re.match(r"^(\d+)-(.*)$", _sadr)
    assert _m and _empty == "", _sadr
    POEM.append([_m.group(1) + "-", _m.group(2), _ajz])
assert [r[0] for r in POEM] == [f"{i}-" for i in range(1, 14)]
DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[3]},
    {"id": "d-gloss", "kind": "text", "caption": "الشّرح اللّغويّ", "text": PARAS[4]},
]
CRIT_DOCS = DOCS + [{"id": "d-crit", "kind": "text", "caption": "السّند", "text": PARAS[23]}]
_ask, P1 = re.split(r"\s{2,}", PARAS[5])
P2, P3 = PARAS[14], PARAS[22]
assert _ask == "الأسئلة:" and P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا")
J = lambda *ix: "\n".join(PARAS[i] for i in ix)
Q12_TEXT = PARAS[20] + "\n" + PARAS[21] + '، " شفاها الثّأر"'
assert PARAS[21] == '" انطوت راياتهم"'
Q13_TEXT = PARAS[24] + " " + _fix(PARAS[25], "قي تحقيق", "في تحقيق") + " " + PARAS[26]

q("q1", "1", P1, J(6), 1, [el("q1-e1", "موضوع الأبيات الأربعة الأولى", 0.5), el("q1-e2", "التّوضيح", 0.5)], DOCS)
q("q2", "2", P1, J(7), 1, [el("q2-e1", "سبب تخصيص نوفمبر بالخطاب", 0.5), el("q2-e2", "مضمون الخطاب", 0.5)], DOCS)
q("q3", "3", P1, J(8), 1, [el("q3-e1", "كيف كان حقد الشّاعر", 0.5), el("q3-e2", "سبب الحقد", 0.5)], DOCS)
q("q4", "4", P1, PARAS[9] + " " + PARAS[10], 1.5,
  [el("q4-e1", "إيحاء «الرّاحلين»", 0.25), el("q4-e2", "إيحاء «صبّار»", 0.25), el("q4-e3", "إيحاء «الإعصار»", 0.25),
   el("q4-e4", "إيحاء «اليوم يومك»", 0.25), el("q4-e5", "إيحاء «طاب الجنى»", 0.25), el("q4-e6", "إيحاء «حقّ الجلاء»", 0.25)], DOCS)
q("q5", "5", P1, J(11), 1.5, [el("q5-e1", "العاطفة الأولى وأبياتها", 0.75), el("q5-e2", "العاطفة الثّانية وأبياتها", 0.75)], DOCS)
q("q6", "6", P1, J(12), 1, [el("q6-e1", "القيمة التّاريخيّة", 0.5), el("q6-e2", "الاستشهاد لها", 0.5)], DOCS)
q("q7", "7", P1, _fix(PARAS[13], "مضمون النّص.", "مضمون الأبيات الأربعة الأخيرة."), 3,
  [el("q7-e1", "التّلخيص: احترام التّقنية", 1), el("q7-e2", "التّلخيص: منهجيّة العرض", 1), el("q7-e3", "التّلخيص: سلامة اللّغة", 1)], DOCS)
q("q8", "1", P2, PARAS[15] + " " + PARAS[16], 1,
  [el("q8-e1", "معنى «على» (ب3)", 0.25), el("q8-e2", "معنى اللّام في «لي» (ب4)", 0.25), el("q8-e3", "معنى «في» (ب6)", 0.25),
   el("q8-e4", "معنى اللّام في «للرّاحلين» (ب7)", 0.25)], DOCS)
q("q9", "2", P2, J(17), 0.5, [el("q9-e1", "الإيحاء النّفسيّ للاستفهام", 0.5)], DOCS)
q("q10", "3", P2, J(18), 1.25, [el("q10-e1", "النّمط السّائد", 0.25), el("q10-e2", "مؤشّران مع التّمثيل (4×0.25)", 1)], DOCS)
q("q11", "4", P2, J(19), 2, [el("q11-e1", "إعراب «الجنى» (ب1)", 0.5), el("q11-e2", "إعراب «مسكا» (ب3)", 0.5),
                             el("q11-e3", "محلّ جملة (إنّ الحفائظ ما شفاها الثّأر) (ب7)", 0.5), el("q11-e4", "محلّ جملة (توهّموا منّا الخنوع) (ب12)", 0.5)], DOCS)
q("q12", "5", P2, Q12_TEXT, 1.25,
  [el("q12-e1", "«انطوت راياتهم»: النّوع وبلاغتها (2×0.25)", 0.5), el("q12-e2", "«شفاها الثّأر»: النّوع", 0.25),
   el("q12-e3", "«شفاها الثّأر»: الشّرح", 0.25), el("q12-e4", "«شفاها الثّأر»: البلاغة", 0.25)], DOCS)
q("q13", "التّعليمة", P3, Q13_TEXT, 4,
  [el("q13-e1", "القيم الإنسانيّة الّتي حملتها الثّورة", 1), el("q13-e2", "دور الشّعراء الجزائريّين والعرب وبعض أعلامهم", 2),
   el("q13-e3", "أثر الثّورة", 1)], CRIT_DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("يتحدّث الشّاعر عن استقلال الجزائر بعد التّضحيات الجسام الّتي قدّمتها. فجماجم الشّهداء الّتي ضمّها الثّرى غرس طيّب أثمر الاستقلال. "
           "وما أطيب الجنى، فالنّشوة والفرحة والبهجة تغمر النّفس وتملأ القلب بعد رحيل المستعمر، فعادت الدّار والأرض السّليبة وتحرّر الوطن.")
st("s01", "q1", "q1-e1", "mcq", "عمّ يتحدّث الشّاعر في الأبيات الأربعة الأولى؟",
   {"options": ["عن استقلال الجزائر بعد التّضحيات الجسام الّتي قدّمتها", "عن اندلاع الثّورة التّحريريّة", "عن جمال الطّبيعة الجزائريّة في الرّبيع",
                "عن رثاء شهداء الحرب العالميّة"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "fill_blank", "أكمل التّوضيح:",
   {"text": "فجماجم الشّهداء الّتي ضمّها الثّرى غرس طيّب أثمر ____، فعادت الدّار والأرض ____ وتحرّر الوطن.",
    "bank": ["الاستقلال", "السّليبة", "الاستعمار", "المحروقة"]},
   {"blanks": [["الاستقلال"], ["السّليبة"]]}, Q1_EXPL, 0.5, "ar.comprehension.explain")
NOV_EXPL = ("خصّ الشّاعر «نوفمبر» بالخطاب لعظمة هذا الشّهر في تاريخ الجزائر ومكانته في النّفوس، ففيه اندلعت الثّورة الكبرى الّتي عصفت بالمحتلّين الغاصبين. "
            "وقد تضمّن الخطاب دعوة «نوفمبر» إلى الإشراق لتبصر العيون نوره الّذي انتظرته طويلًا بعد ليل الاستعمار، وطلب منه إخبار المحتلّين بأنّ قلوب "
            "الجزائريّين ستظلّ تحقد عليهم كلّما تذكّروا شهداءهم الّذين ضمّهم الثّرى.")
st("s03", "q2", "q2-e1", "mcq", "لِمَ خصّ الشّاعر نوفمبر بالخطاب؟",
   {"options": ["لعظمة هذا الشّهر في تاريخ الجزائر ومكانته في النّفوس، ففيه اندلعت الثّورة الكبرى الّتي عصفت بالمحتلّين الغاصبين",
                "لأنّه الشّهر الّذي أُعلن فيه الاستقلال", "لأنّه شهر الحصاد وجني الثّمار", "لأنّه شهر توقيع الصّلح مع المستعمر"]},
   {"correct": 0}, NOV_EXPL, 0.5, "ar.comprehension.explain")
st("s04", "q2", "q2-e2", "multi", "ما مضمون خطاب الشّاعر لنوفمبر؟ (اختر كلّ ما يصحّ)",
   {"options": ["دعوته إلى الإشراق لتبصر العيون نوره الّذي انتظرته طويلًا بعد ليل الاستعمار",
                "طلبه منه إخبار المحتلّين بأنّ قلوب الجزائريّين ستظلّ تحقد عليهم كلّما تذكّروا شهداءهم", "دعوته إلى الصّفح عن المحتلّين ونسيان الماضي",
                "رثاؤه لانقضاء أيّام الثّورة"]},
   {"correct": [0, 1]}, NOV_EXPL, 0.5, "ar.comprehension.details")
HATE_EXPL = ("كان حقد الشّاعر على المحتلّين وأعوانهم كبيرًا وشديدًا لا يزول بزوالهم ورحيلهم، لأنّ ذكرى الشّهداء الّذين احتوتهم أرضنا، والسّنين الطّويلة "
             "الّتي أهانوا فيها شعبنا وحرموه من خيرات وطنه تحيي الحقد من جديد وتؤجّجه في النّفوس فيشتدّ ويقوى عبر الزّمن.")
st("s05", "q3", "q3-e1", "mcq", "كيف كان حقد الشّاعر على الدّخلاء؟",
   {"options": ["كبيرًا وشديدًا لا يزول بزوالهم ورحيلهم", "خفيفًا عابرًا يزول برحيلهم", "مصطنعًا لا حقيقة له", "حقدًا على الشّعوب العربيّة لا على المحتلّين"]},
   {"correct": 0}, HATE_EXPL, 0.5, "ar.comprehension.emotion")
st("s06", "q3", "q3-e2", "fill_blank", "ولماذا؟ أكمل:",
   {"text": "لأنّ ذكرى ____ الّذين احتوتهم أرضنا، والسّنين الطّويلة الّتي أهانوا فيها شعبنا وحرموه من ____ وطنه تحيي الحقد من جديد وتؤجّجه في النّفوس.",
    "bank": ["الشّهداء", "خيرات", "الأعداء", "حدود"]},
   {"blanks": [["الشّهداء"], ["خيرات"]]}, HATE_EXPL, 0.5, "ar.comprehension.explain")
SUGG_EXPL = ("دلالة الكلمات والعبارات: الرّاحلين: المحتلّين المدحورين؛ صبّار: طول المعاناة وشدّتها؛ الإعصار: الثّورة الجارفة العاصفة؛ اليوم يومك: النّشوة "
             "والفرحة باليوم المنتظر أي الاستقلال؛ طاب الجنى: تحقّق الأمل؛ حقّ الجلاء: وجوب رحيل الاستعمار.")
st("s07", "q4", "q4-e1", "mcq", "بمَ توحي كلمة «الرّاحلين» في قوله: «نوفمبر قل للرّاحلين ورهطهم»؟",
   {"options": ["المحتلّين المدحورين", "المهاجرين من أبناء الجزائر", "المسافرين في طلب الرّزق", "الشّعراء الّذين رحلوا"]},
   {"correct": 0}, SUGG_EXPL, 0.25, "ar.comprehension.explain")
st("s08", "q4", "q4-e2", "fill_blank", "أكمل إيحاء كلمة «صبّار» (ب12):",
   {"text": "توحي «صبّار» بطول ____ وشدّتها.", "bank": ["المعاناة", "الرّاحة", "الفرحة"]},
   {"blanks": [["المعاناة"]]}, SUGG_EXPL, 0.25, "ar.comprehension.explain")
st("s09", "q4", "q4-e3", "mcq", "بمَ توحي كلمة «الإعصار» في قوله: «بعد السّكون يدمدم الإعصار»؟",
   {"options": ["الثّورة الجارفة العاصفة", "الكوارث الطّبيعيّة", "هدوء ما بعد العاصفة", "قسوة الشّتاء"]},
   {"correct": 0}, SUGG_EXPL, 0.25, "ar.comprehension.explain")
st("s10", "q4", "q4-e4", "mcq", "بمَ توحي عبارة «اليوم يومك» في مطلع القصيدة؟",
   {"options": ["النّشوة والفرحة باليوم المنتظر أي الاستقلال", "الحزن على ضياع الوطن", "الخوف من الغد المجهول", "الحنين إلى الماضي البعيد"]},
   {"correct": 0}, SUGG_EXPL, 0.25, "ar.comprehension.explain")
st("s11", "q4", "q4-e5", "fill_blank", "أكمل إيحاء عبارة «طاب الجنى» (ب1):",
   {"text": "توحي «طاب الجنى» بتحقّق ____.", "bank": ["الأمل", "الخيبة", "الهزيمة"]},
   {"blanks": [["الأمل"]]}, SUGG_EXPL, 0.25, "ar.comprehension.explain")
st("s12", "q4", "q4-e6", "mcq", "بمَ توحي عبارة «حقّ الجلاء» في البيت الرّابع؟",
   {"options": ["وجوب رحيل الاستعمار", "بقاء الاستعمار وتمكّنه", "حقّ الشّعب في الهجرة", "جلاء الحقيقة ووضوحها"]},
   {"correct": 0}, SUGG_EXPL, 0.25, "ar.comprehension.explain")
EMO_EXPL = ("العاطفتان: الأولى: الفرحة العظيمة بعد رحيل الدّخلاء ونيل الاستقلال، وتضمّنتها الأبيات: 1، 2، 3، 5. الثّانية: كره للدّخلاء وحقد شديد عليهم، "
            "وتضمّنتها الأبيات: 4، 8، 9، 10، 11، 12، 13.")
st("s13", "q5", "q5-e1", "mcq", "ما العاطفة البارزة الأولى في النّصّ؟",
   {"options": ["الفرحة العظيمة بعد رحيل الدّخلاء ونيل الاستقلال", "الحزن على ضياع الوطن", "الحنين إلى الطّفولة", "الخوف من المستقبل"]},
   {"correct": 0}, EMO_EXPL, 0.5, "ar.comprehension.emotion")
st("s14", "q5", "q5-e1", "multi", "حدّد من الأبيات الآتية ما يدلّ على عاطفة الفرحة. (اختر كلّ ما يصحّ)",
   {"options": ["البيت 1", "البيت 2", "البيت 3", "البيت 5", "البيت 9", "البيت 11", "البيت 13"]},
   {"correct": [0, 1, 2, 3]}, EMO_EXPL, 0.25, "ar.comprehension.evidence", "b")
st("s15", "q5", "q5-e2", "fill_blank", "أكمل العاطفة الثّانية:",
   {"text": "العاطفة الثّانية: ____ للدّخلاء و____ شديد عليهم.", "bank": ["كره", "حقد", "حبّ", "شوق"]},
   {"blanks": [["كره"], ["حقد"]]}, EMO_EXPL, 0.5, "ar.comprehension.emotion")
st("s16", "q5", "q5-e2", "multi", "حدّد من الأبيات الآتية ما يدلّ على عاطفة الكره والحقد. (اختر كلّ ما يصحّ)",
   {"options": ["البيت 4", "البيت 8", "البيت 10", "البيت 12", "البيت 1", "البيت 3"]},
   {"correct": [0, 1, 2, 3]}, EMO_EXPL, 0.25, "ar.comprehension.evidence", "b")
HIST_EXPL = "القيمة التّاريخيّة: تتمثّل في ذكر الشّاعر المدّة الزّمنيّة الّتي مكثتها فرنسا بالجزائر وهي مائة وثلاثون سنة. يتضمّنها البيت التّاسع."
st("s17", "q6", "q6-e1", "mcq", "ما القيمة التّاريخيّة الهامّة في القصيدة؟",
   {"options": ["ذكر الشّاعر المدّة الزّمنيّة الّتي مكثتها فرنسا بالجزائر وهي مائة وثلاثون سنة", "ذكر تاريخ إعلان الاستقلال باليوم والشّهر",
                "ذكر أسماء قادة الثّورة التّحريريّة", "ذكر عدد شهداء الثّورة"]},
   {"correct": 0}, HIST_EXPL, 0.5, "ar.comprehension.values")
st("s18", "q6", "q6-e2", "mcq", "أيّ بيت يتضمّن هذه القيمة؟",
   {"options": ["البيت التّاسع: «مضت الثّلاثون العجاف وقبلها مئة تفضّت والنّفوس حرار»", "البيت الأوّل: «اليوم يومك يا جزائر فاقطفي…»",
                "البيت الخامس: «نوفمبر أشرق للعيون…»", "البيت الثّالث عشر: «ضلّوا السّبيل بنا وساء حسابهم…»"]},
   {"correct": 0}, HIST_EXPL, 0.5, "ar.comprehension.evidence")
SUM_SPEC = {"task": "تلخيص مضمون الأبيات الأربعة الأخيرة", "text": "قصيدة عبد السّلام الحبيب (بكالوريا 2011، آداب وفلسفة، الموضوع الأوّل)",
            "scheme": "تلخيص مضمون الأبيات الأربعة الأخيرة. يراعى فيه: احترام التّقنية – منهجيّة العرض – سلامة اللّغة (3×01)"}
SUM_EXPL = "يراعى في التّلخيص: احترام التّقنية – منهجيّة العرض – سلامة اللّغة (نقطة لكلّ معيار). لا يقدّم الحلّ ملخّصًا نموذجيًّا."
for sid, eid, crit in [("s19", "q7-e1", "احترام التّقنية"), ("s20", "q7-e2", "منهجيّة العرض"), ("s21", "q7-e3", "سلامة اللّغة")]:
    essay(sid, "q7", eid, "تلخيص الأبيات الأربعة الأخيرة من قصيدة عبد السّلام الحبيب", crit, crit, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
PREP_EXPL = "معاني حروف الجرّ: على: الاستعلاء؛ اللّام في (لي…): الملكيّة؛ في: الظّرفيّة؛ اللّام في (للرّاحلين): التّبليغ."
st("s22", "q8", "q8-e1", "mcq", "ما معنى حرف الجرّ «على» في «على ربواتك الأزهار»؟",
   {"options": ["الاستعلاء", "السّببيّة", "المصاحبة", "التّبعيض"]}, {"correct": 0}, PREP_EXPL, 0.25, "ar.grammar.rules")
st("s23", "q8", "q8-e2", "fill_blank", "أكمل معنى اللّام في «فالأرض لي والدّار»:",
   {"text": "اللّام في «لي» تفيد ____.", "bank": ["الملكيّة", "التّبليغ", "الاستعلاء"]}, {"blanks": [["الملكيّة"]]}, PREP_EXPL, 0.25, "ar.grammar.rules")
st("s24", "q8", "q8-e3", "mcq", "ما معنى حرف الجرّ «في» في «عشنا في الدّجى»؟",
   {"options": ["الظّرفيّة", "السّببيّة", "الاستعلاء", "المصاحبة"]}, {"correct": 0}, PREP_EXPL, 0.25, "ar.grammar.rules")
st("s25", "q8", "q8-e4", "mcq", "ما معنى اللّام في «قل للرّاحلين»؟",
   {"options": ["التّبليغ", "الملكيّة", "التّعليل", "الاستعلاء"]}, {"correct": 0}, PREP_EXPL, 0.25, "ar.grammar.rules")
st("s26", "q9", "q9-e1", "mcq", "ما الإيحاء النّفسيّ الّذي يثيره الاستفهام في قول الشّاعر: «أتسطع الأنوار؟»",
   {"options": ["الأمل والشّوق والتّرقّب", "اليأس والقنوط", "السّخرية والاستهزاء", "اللّامبالاة وعدم الاكتراث"]},
   {"correct": 0}, "الإيحاء النّفسيّ الّذي يثيره الاستفهام في قول الشّاعر «أتسطع الأنوار؟» هو الأمل والشّوق والتّرقّب.", 0.5, "ar.rhetoric.insha")
TYPE_EXPL = ("النّمط السّائد في النّصّ هو النّمط الوصفيّ، ومن مؤشّراته: توظيف الأفعال الماضية والمضارعة الدّالّة على الحيويّة والاستمرار (طاب، تدانت، تضوّعت، تحنّ، "
             "تسطع، نحقد، يرفرف…)؛ توظيف المشتقّات (الحصيد، متسائلين، دوّار، واجم، صبّار…)؛ توظيف النّعت والحال (العجاف، تفضّت، تحنّ لنورك، مكابرين…)؛ "
             "توظيف الصّور البيانيّة من كنايات واستعارات (تدانت الأثمار، انطوت راياتهم، نوفمبر أشرق للعيون، يرفرف حولها التّذكار…). يكتفي المترشّح بمؤشّرين مع التّمثيل.")
st("s27", "q10", "q10-e1", "mcq", "ما النّمط السّائد في القصيدة؟",
   {"options": ["الوصفيّ", "الحواريّ", "التّفسيريّ", "الإيعازيّ"]}, {"correct": 0}, TYPE_EXPL, 0.25, "ar.text.type")
IND = ["توظيف الأفعال الماضية والمضارعة الدّالّة على الحيويّة والاستمرار", "توظيف المشتقّات", "توظيف النّعت والحال", "توظيف الصّور البيانيّة من كنايات واستعارات"]
st("s28", "q10", "q10-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الوصفيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": IND + ["الحوار بين الشّخصيّات", "الاعتماد على الإحصاءات والأرقام"]},
   {"correct": [0, 1, 2, 3]}, TYPE_EXPL, 0.5, "ar.text.type")
st("s29", "q10", "q10-e2", "matching", "طابق كلّ مؤشّر بأمثلته من القصيدة.",
   {"lefts": IND, "rights": ["(طاب، تدانت، تضوّعت، تحنّ، تسطع، نحقد، يرفرف…)", "(الحصيد، متسائلين، دوّار، واجم، صبّار…)",
                            "(العجاف، تفضّت، تحنّ لنورك، مكابرين…)", "(تدانت الأثمار، انطوت راياتهم، نوفمبر أشرق للعيون، يرفرف حولها التّذكار…)",
                            "(قالت، أجابت، سألتُ…)"]},
   {"pairs": [0, 1, 2, 3]}, TYPE_EXPL, 0.5, "ar.text.type", "b")
st("s30", "q11", "q11-e1", "mcq", "ما إعراب «الجنى» (تحته خطّ) في قوله: «طاب الجنى وتدانت الأثمار»؟",
   {"options": ["فاعل مرفوع وعلامة رفعه الضّمّة المقدّرة على الألف منع من ظهورها التّعذّر", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة على آخره",
                "مبتدأ مرفوع وعلامة رفعه الضّمّة المقدّرة على الألف للتّعذّر", "مفعول به منصوب وعلامة نصبه الفتحة المقدّرة على الألف للتّعذّر"]},
   {"correct": 0}, "«الجنى»: فاعل مرفوع وعلامة رفعه الضّمّة المقدّرة على الألف منع من ظهورها التّعذّر.", 0.5, "ar.grammar.maqsur")
st("s31", "q11", "q11-e2", "fill_blank", "أكمل إعراب «مسكا» (تحته خطّ) في قوله: «وتضوّعت مسكا على ربواتك الأزهار»:",
   {"text": "مسكًا: ____ منصوب وعلامة نصبه ____ الظّاهرة على آخره.", "bank": ["تمييز", "الفتحة", "مفعول به", "الكسرة"]},
   {"blanks": [["تمييز"], ["الفتحة"]]}, "«مسكا»: تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s32", "q11", "q11-e3", "mcq", "ما المحلّ الإعرابيّ لجملة (إنّ الحفائظ ما شفاها الثّأر) في البيت السّابع؟",
   {"options": ["جملة مقول القول في محلّ نصب مفعول به", "جملة في محلّ رفع خبر", "جملة في محلّ جرّ مضاف إليه", "جملة في محلّ رفع نعت"]},
   {"correct": 0}, "(إنّ الحفائظ ما شفاها الثّأر): جملة مقول القول في محلّ نصب مفعول به.", 0.5, "ar.grammar.sentence_case")
st("s33", "q11", "q11-e4", "mcq", "ما المحلّ الإعرابيّ لجملة (توهّموا منّا الخنوع) في البيت الثّاني عشر؟",
   {"options": ["جملة فعليّة لا محلّ لها من الإعراب لأنّها معطوفة على الجملة الابتدائيّة «أمنوا الزّمان مكابرين»", "جملة فعليّة في محلّ رفع خبر",
                "جملة فعليّة في محلّ نصب مفعول به", "جملة فعليّة في محلّ رفع نعت"]},
   {"correct": 0}, "(توهّموا منّا الخنوع): جملة فعليّة لا محلّ لها من الإعراب لأنّها معطوفة على الجملة الابتدائيّة «أمنوا الزّمان مكابرين».", 0.5, "ar.grammar.sentence_case")
IMG1 = "«انطوت راياتهم»: كناية عن صفة هي الهزيمة والخسارة، بلاغتها: التّوضيح بتقديم المعنى في صورة محسوسة."
st("s34", "q12", "q12-e1", "mcq", "ما نوع الصّورة البيانيّة في «انطوت راياتهم»؟",
   {"options": ["كناية عن صفة هي الهزيمة والخسارة", "كناية عن موصوف", "تشبيه بليغ", "مجاز مرسل علاقته الجزئيّة"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.metonymy")
st("s35", "q12", "q12-e1", "mcq", "ما بلاغة الصّورة في «انطوت راياتهم»؟",
   {"options": ["التّوضيح بتقديم المعنى في صورة محسوسة", "المبالغة بادّعاء أنّ المشبّه عين المشبّه به", "إحداث جرس موسيقيّ في البيت",
                "تشخيص الجماد وبثّ الحياة فيه"]},
   {"correct": 0}, IMG1, 0.25, "ar.rhetoric.effect", "b")
IMG2 = "«شفاها الثّأر»: استعارة مكنيّة حذف فيها المشبّه به (الدّواء) ورمز إليه بصفة من صفاته (شفاها)، بلاغتها: قوّة التّشخيص لتوضيح المعنى وترسيخه في الذّهن."
st("s36", "q12", "q12-e2", "mcq", "ما نوع الصّورة البيانيّة في «شفاها الثّأر»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته السّببيّة"]}, {"correct": 0}, IMG2, 0.25, "ar.rhetoric.metaphor")
st("s37", "q12", "q12-e3", "fill_blank", "اشرح الصّورة في «شفاها الثّأر»:",
   {"text": "حذف فيها المشبّه به (____) ورمز إليه بصفة من صفاته (____).", "bank": ["الدّواء", "شفاها", "الدّاء", "الحفائظ"]},
   {"blanks": [["الدّواء"], ["شفاها"]]}, IMG2, 0.25, "ar.rhetoric.metaphor")
st("s38", "q12", "q12-e4", "mcq", "ما بلاغة الصّورة في «شفاها الثّأر»؟",
   {"options": ["قوّة التّشخيص لتوضيح المعنى وترسيخه في الذّهن", "تقديم الحقيقة مصحوبة بالدّليل", "الإيجاز بحذف الأداة ووجه الشّبه", "إحداث جرس موسيقيّ"]},
   {"correct": 0}, IMG2, 0.25, "ar.rhetoric.effect")
# ── ثالثًا: التّقويم النّقديّ ──
VAL_EXPL = "القيم: المطالبة بالحرّيّة والكرامة والعدالة الاجتماعيّة – تحقيق الأخوّة والمساواة في الحقوق والواجبات – التّضحية في سبيل العزّة والكرامة…"
st("s39", "q13", "q13-e1", "multi", "ما القيم الإنسانيّة السّامية الّتي حملتها الثّورة التّحريريّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["المطالبة بالحرّيّة والكرامة والعدالة الاجتماعيّة", "تحقيق الأخوّة والمساواة في الحقوق والواجبات", "التّضحية في سبيل العزّة والكرامة",
                "التّبعيّة للمستعمر", "التّعصّب العرقيّ", "الاستسلام للأمر الواقع"]},
   {"correct": [0, 1, 2]}, VAL_EXPL, 0.5, "ar.comprehension.values")
st("s40", "q13", "q13-e1", "fill_blank", "أكمل القيم:",
   {"text": "المطالبة بالحرّيّة و____ والعدالة الاجتماعيّة – تحقيق الأخوّة و____ في الحقوق والواجبات – التّضحية في سبيل العزّة والكرامة.",
    "bank": ["الكرامة", "المساواة", "التّبعيّة", "الامتيازات"]},
   {"blanks": [["الكرامة"], ["المساواة"]]}, VAL_EXPL, 0.5, "ar.comprehension.values", "b")
ROLE_EXPL = ("دور الشّعراء الجزائريّين والعرب: تمجيد الثّورة والثّوّار – التّغنّي بنوفمبر – تصوير معاناة الشّعب الجزائريّ وصموده في وجه الطّغاة – كشف جرائم "
             "الاستعمار – التّعبير عن الفرحة الكبرى بالحرّيّة المفتكّة. بعض الشّعراء الّذين تغنّوا بالثّورة الجزائريّة: محمّد الصّالح باوية، شفيق الكمالي، "
             "مفدي زكرياء، عبد السّلام الحبيب… (العلامة مطبوعة «0.2» وتُقرأ «02» لأنّ مجموع التّقويم النّقديّ 04.)")
st("s41", "q13", "q13-e2", "multi", "ما دور الشّعراء الجزائريّين والعرب في إذكاء الشّعور الوطنيّ والقوميّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["تمجيد الثّورة والثّوّار", "التّغنّي بنوفمبر", "تصوير معاناة الشّعب الجزائريّ وصموده في وجه الطّغاة", "كشف جرائم الاستعمار",
                "التّعبير عن الفرحة الكبرى بالحرّيّة المفتكّة", "تبرير الوجود الاستعماريّ", "الدّعوة إلى الاستسلام والمهادنة"]},
   {"correct": [0, 1, 2, 3, 4]}, ROLE_EXPL, 1, "ar.literature.context")
st("s42", "q13", "q13-e2", "fill_blank", "أكمل من دور الشّعراء:",
   {"text": "تمجيد الثّورة و____ – التّغنّي بـ____ – كشف ____ الاستعمار.", "bank": ["الثّوّار", "نوفمبر", "جرائم", "الأعداء", "ديسمبر", "حسنات"]},
   {"blanks": [["الثّوّار"], ["نوفمبر"], ["جرائم"]]}, ROLE_EXPL, 0.5, "ar.literature.context", "b")
st("s43", "q13", "q13-e2", "multi", "مَن مِن هؤلاء من الشّعراء الّذين تغنّوا بالثّورة الجزائريّة؟ (اختر كلّ ما يصحّ)",
   {"options": ["محمّد الصّالح باوية", "شفيق الكمالي", "مفدي زكرياء", "عبد السّلام الحبيب", "المتنبّي", "امرؤ القيس", "أبو العلاء المعرّي"]},
   {"correct": [0, 1, 2, 3]}, ROLE_EXPL + " أمّا المتنبّي وامرؤ القيس والمعرّي فشعراء قدامى.", 0.5, "ar.literature.context", "c")
EFF_EXPL = "أثر الثّورة: انتشار الوعي الوطنيّ والقوميّ؛ اندلاع ثورات شعبيّة في أغلب البلدان العربيّة الخاضعة للاستعمار."
st("s44", "q13", "q13-e3", "multi", "ما أثر الثّورة الجزائريّة في تحقيق آمال الأمّة وتطلّعاتها؟ (اختر كلّ ما يصحّ)",
   {"options": ["انتشار الوعي الوطنيّ والقوميّ", "اندلاع ثورات شعبيّة في أغلب البلدان العربيّة الخاضعة للاستعمار", "انقسام الأمّة العربيّة وتفرّقها",
                "تراجع الشّعور القوميّ"]},
   {"correct": [0, 1]}, EFF_EXPL, 0.5, "ar.literature.context")
st("s45", "q13", "q13-e3", "fill_blank", "أكمل أثر الثّورة:",
   {"text": "انتشار ____ الوطنيّ والقوميّ، واندلاع ثورات ____ في أغلب البلدان العربيّة الخاضعة للاستعمار.", "bank": ["الوعي", "شعبيّة", "الجهل", "مضادّة"]},
   {"blanks": [["الوعي"], ["شعبيّة"]]}, EFF_EXPL, 0.5, "ar.literature.context", "b")

TITLE = "بكالوريا 2011 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (عبد السّلام الحبيب: اليوم يومك يا جزائر)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2011، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ "
         f"النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2، صورة ممسوحة)، والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. "
         "صُوّبت من الموضوع الرّسميّ عيوب في docx: س7 «لخص مضمون النّص.» ← «لخص مضمون الأبيات الأربعة الأخيرة.» (كما في الموضوع الرّسميّ والحلّ)؛ "
         "البناء اللّغويّ س5 ينقصه في docx التّعبير الثّاني فأضيف من الموضوع الرّسميّ «" + '" شفاها الثّأر"' + "»؛ «قي تحقيق» ← «في تحقيق» (التّقويم النّقديّ). "
         "التّسطير (الجنى، مسكا) لا يظهر في الوثائق، وتسمّيه الخطوات. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "علامة دور الشّعراء في التّقويم النّقديّ مطبوعة «0.2» وقُرئت «02» لأنّ المجموع المطبوع 04 (01 + 02 + 01). "
         "مؤجَّل (essay_builder): التّلخيص س7 (3×01: احترام التّقنية، منهجيّة العرض، سلامة اللّغة).")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write(SET_ID, PAPER, STREAMS, TITLE, NOTES, LOG_NOTE, DOCX_ID, DOCX_TITLE, CORR_ID, "2026-10-29T17:40:00Z")
