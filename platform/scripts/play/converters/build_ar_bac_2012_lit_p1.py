"""Conversion: BAC 2012 (session عاديّة، جوان 2012) – اللّغة العربيّة وآدابها – شعبة آداب وفلسفة – الموضوع الأوّل (نزار قبّاني، قصيدة إلى أبي تمّام).
Exam (most faithful source): gdrive 1s9ZKdhMIsQbTkfYtqWdcw2_dPp9N5J7F (بكالوريا 2012 العربية شعبة اداب وفلسفة.docx);
same paper as PDF (owner's retyped copy, exported from the docx): gdrive 1CAN0D7tooAPtKlTJuuXDcf1Q6DCTWWwP (BAC 2012 - اللغة العربية - آداب وفلسفة.pdf);
official ONEC paper: gdrive 1t4JS2ByswnhDsdO4auT_J15MXaGuTQpt (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة»): gdrive 1lGzAgD2mxqOSl3jgzD55z33tpo0XZSp9 (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2016_lit_p1.py / build_ar_bac_2018_lit_p1.py): the verbatim strings below (the three stanzas,
reference, question texts) were generated from the .docx with python-docx (runs read exactly, tatweel kept; only outer
whitespace and outer direction marks trimmed; the free-verse poem sits in a two-cell table read line by line, cut at the
stanza marks «-1-», «-2-», «-3-», which become the captions; the part-3 instruction, split over two docx paragraphs, is
joined with a space) and every verbatim string of the JSON was re-checked programmatically against the docx. The docx was
compared line by line with the official ONEC paper (rendered at 120–200 dpi): same lines, stanzas and questions; underlined
«تأكلنا» (stanza 2, line 4) and «عليّ» (stanza 2, line 10) in both; parenthesised (إنّ الشّعرَ في أعماقه سفر) and (نجادل
بعضنا بعضا). Differences kept as in the docx: diacritics, «الزّفة» (ONEC «الزّفّهْ»), the last line ends «وينتحر؟» (ONEC
«وينتحرُ؟!»). The docx header still carries a template line «دورة جوان 2008 / الشعبة: جميع الشعب»; year and stream come
from the ONEC paper and the correction. The correction is a scanned PDF, read from the rendered pages (150 dpi; the
scansion lines re-read at 300 dpi). Every mark comes from the official scheme; correct options and explanations condense it.

Conversion notes / points for the owner's review:
- Streams: ONEC paper «الشعبة: آداب وفلسفة», correction «الآداب والفلسفة» ⇒ LIT.
- Rule for «n×m» lines: interchangeable items (more listed than required) ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 01 + 01 (addressee / apology). Q2 01. Q3 0.50 + 0.50 (the two causes listed). Q4 0.50 + 0.50 (أبو تمّام / عليّ وعمر).
  Q5: 01 the type (حجاجيّ) + «2×0.5» two indicators among five ⇒ one element of 1 (the scheme gives no examples). Q6 (تلخيص)
  01/01/01 = حجم التّلخيص / الدّلالة على المضمون / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2: Q1 0.50. Q2 «2×0.5» two styles among three ⇒ one element of 1. Q3 0.25 type + 0.25 effect. Q4 «2×0.25» المسند /
  المسند إليه. Q5: 0.25 × 4 for «تأكلنا» (the verb, its subject, «نا», the sentence as خبر إنّ), 0.50 «عليّ», 0.25 per
  parenthesised sentence.
- Q6 (العروض): «2×0.25» per line without labels ⇒ one element of 0.5 per line (two steps each) + 0.50 the remark on the
  mixing of مُفاعَلَتُن (الوافر المجزوء) and مَفاعيلُن (الهزج). For line 4 the scheme's writing «أبا تمما / م إنْنَنْنا / ر
  تأكلنا» and symbols (//0/0/0 //0/0/0 //0///0) give مفاعيلن مفاعيلن مفاعلَتن, but its row of feet is printed in the
  reverse order (مُفاعَلَتُن first); the steps follow the writing and the symbols, and the reversed order is not used as a
  distractor. Line 5: «وما زلنا / نجادل بع / ضنا بعضن» = //0/0/0 //0///0 //0/0/0 = مفاعيلن مفاعلتن مفاعيلن.
- Part 3 (04): four lines of 01 — content: توظيف الرّمز، اعتماد الوحدة العضويّة; form: بساطة القاموس اللّغويّ، اعتماد نظام
  التّفعيلة وتنوّع القافية ⇒ four interactive elements (distractors are traditional features only).
- Distractors avoid what the scheme or usage could accept: no «مقول القول» / «جواب النّداء» for (إنّ الشّعر في أعماقه سفر)
  (the scheme: ابتدائيّة); no «عطف بيان / نعت» for «عليّ» (بدل); no «التّعجّب / الإنكار» for the purpose of «لماذا…»; no
  «مجاز عقليّ» for «إنّ النّاس بالكلمات قد كفروا»; no «الشّعر الحرّ / توظيف الأسطورة» among the non-renewal distractors
  of part 3.
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

# ── الموضوع الأوّل (مولَّد من docx) ──
P1_STANZAS = [['أبا تمّام: (إن الشّعرَ في أعماقه سفر)', 'وإبحارٌ إلى الآتي، وكشفٌ ليس يُنتظر', 'ولكنّا.. جعلنا منه شيئا يشبه الزّفة', 'وإيقاعا نحاسيًّا يدق كأنه القَدَرُ.'], ['أميرَ الحرف.. سامحْنا', 'فقد خنّا جميعا مهنة الحرف', 'وأرهقناه بالتَّشطير، والتّربيع، والتّخميس، والوصف', 'أبا تمّام إن النّار تأكلنا', 'وما زلنا (نجادل بعضنا بعضا)', 'عن المصروف، والممنوع من صرف', 'وجيش الغاصب المحتل ممنوع من الصّرف!', 'وما زلنا نطقطقُ عظم أرجلنا', 'ونقعد في بيوت الله ننتظر..', 'بأن يأتي الإمام عليّ.. أو يأتي لنا عمر', 'ولن يأتوا.. ولن يأتوا', 'فلا أحد بسيف سواه ينتصر.'], ['أبا تمّام: إن الناس بالكلمات قد كفروا', 'وبالشّعراء قد كفروا..', 'فقل لي أيّها الشاعر:', 'لماذا شعرنا العربيّ قد يَبسُت مفاصله', 'من التّكرار واصفرّت سنابله..؟', 'وقل لي أيّها الشاعر:', 'لماذا الشّعر - حين يشيخ -', 'لا يستلّ سكينًا.. وينتحر؟']]
P1_REF = 'نزار قباني.'
P1_QP = ['أوّلا- البناء الفكري: (10 نقاط)', 'مَن المُخاطَب في النّص؟ وعمَّ اعتذرَ له الشَّاعر؟', 'ما دلالة قول الشّاعر: " وجيش الغاصب المحتل ممنوع من الصّرف"؟', 'ما هي أسباب نفور القرّاء من الشعر العربيّ المعاصر؟', 'وظّفَ الشّاعر بعض الرموز. استخرجها وبين دلالاتها.', 'حدّد النّمط الغالب على النص، مبرزًا مؤشّرين من مؤشراته.', 'لخّص مضمون النّص، مُراعيًا تقنية التلخيص.', 'ثانيا- البناء اللّغوي: (06 نقاط)', 'ما الحقل الدلاليّ الذي تنتمي إليه الأفعال الآتية: (نطقطق، نقعد، ننتظر)؟', 'استخرج من المقطع الثالث أسلوبين إنشائيين مختلفين، مبيّنا النوع والغرض في كلّ منهما.', 'ما نوع المجاز في قول الشّاعر: "إن الناس بالكلمات قد كفروا"؟ وما بلاغته؟', 'عيّن في العبارة: "واصفرّت سنابله" المسند والمسند إليه.', 'أعرب ما تحته خط إعرابًا مفصَّلا، وما بين قوسين إعراب جمل.', 'ادرس عروضيّا السّطريْن الشّعريين الرّابع والخامس من المقطع الثاني من النّص.', 'ثالثا- التّقويم النقدي: (04 نقاط)', 'عكست هذه القصيدة مظاهر التجديد في الشعر العربيّ المعاصر. أبرز منها مظهرين يتعلّقان بالشّكل وآخرين بالمضمون.']


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


QP = P1_QP
J = lambda *ix: "\n".join(QP[i] for i in ix)
P1, P2, P3 = QP[0], QP[7], QP[14]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and P3.startswith("ثالثا") and len(QP) == 16 and [len(s) for s in P1_STANZAS] == [4, 12, 8]
assert P1_STANZAS[1][3].endswith("تأكلنا") and P1_STANZAS[1][4].startswith("وما زلنا (نجادل")  # «السّطران الرّابع والخامس من المقطع الثّاني»
D = [
    {"id": "d-st-1", "kind": "text", "caption": "المقطع الأوّل", "text": "\n".join(P1_STANZAS[0])},
    {"id": "d-st-2", "kind": "text", "caption": "المقطع الثّاني", "text": "\n".join(P1_STANZAS[1])},
    {"id": "d-st-3", "kind": "text", "caption": "المقطع الثّالث", "text": "\n".join(P1_STANZAS[2])},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF},
]

q("q1", "1", P1, J(1), 2, [el("q1-e1", "المخاطَب في النّصّ", 1), el("q1-e2", "ما اعتذر عنه الشّاعر", 1)], D)
q("q2", "2", P1, J(2), 1, [el("q2-e1", "دلالة «وجيش الغاصب المحتلّ ممنوع من الصّرف»", 1)], D)
q("q3", "3", P1, J(3), 1, [el("q3-e1", "السّبب الأوّل: الابتعاد عن الرّسالة السّامية للشّعر", 0.5), el("q3-e2", "السّبب الثّاني: الاكتفاء بتقليد القدامى", 0.5)], D)
q("q4", "4", P1, J(4), 1, [el("q4-e1", "رمز «أبو تمّام» ودلالته", 0.5), el("q4-e2", "رمزا «عليّ» و«عمر» ودلالتهما", 0.5)], D)
q("q5", "5", P1, J(5), 2, [el("q5-e1", "النّمط الغالب", 1), el("q5-e2", "مؤشّران (2×0.5)", 1)], D)
q("q6", "6", P1, J(6), 3, [el("q6-e1", "التّلخيص: حجم التّلخيص", 1), el("q6-e2", "التّلخيص: الدّلالة على المضمون", 1), el("q6-e3", "التّلخيص: سلامة اللّغة", 1)], D)
q("q7", "1", P2, J(8), 0.5, [el("q7-e1", "الحقل الدّلاليّ", 0.5)], D)
q("q8", "2", P2, J(9), 1, [el("q8-e1", "أسلوبان إنشائيّان: النّوع والغرض (2×0.5)", 1)], D)
q("q9", "3", P2, J(10), 0.5, [el("q9-e1", "نوع المجاز وعلاقته", 0.25), el("q9-e2", "بلاغته", 0.25)], D)
q("q10", "4", P2, J(11), 0.5, [el("q10-e1", "المسند", 0.25), el("q10-e2", "المسند إليه", 0.25)], D)
q("q11", "5", P2, J(12), 2,
  [el("q11-e1", "«تأكل»: الفعل", 0.25), el("q11-e2", "«تأكل»: الفاعل", 0.25), el("q11-e3", "«نا» في «تأكلنا»", 0.25),
   el("q11-e4", "محلّ الجملة الفعليّة «تأكلنا»", 0.25), el("q11-e5", "إعراب «عليّ»", 0.5),
   el("q11-e6", "محلّ جملة (إنّ الشّعر في أعماقه سفر)", 0.25), el("q11-e7", "محلّ جملة (نجادل بعضنا بعضا)", 0.25)], D)
q("q12", "6", P2, J(13), 1.5, [el("q12-e1", "تقطيع السّطر الرّابع (2×0.25)", 0.5), el("q12-e2", "تقطيع السّطر الخامس (2×0.25)", 0.5),
                               el("q12-e3", "ملاحظة: المزج بين تفعيلتين", 0.5)], D)
q("q13", "1", P3, J(15), 4, [el("q13-e1", "تجديد المضمون: توظيف الرّمز", 1), el("q13-e2", "تجديد المضمون: اعتماد الوحدة العضويّة", 1),
                             el("q13-e3", "تجديد الشّكل: بساطة القاموس اللّغويّ", 1), el("q13-e4", "تجديد الشّكل: نظام التّفعيلة وتنوّع القافية", 1)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "مَن المخاطَب في قصيدة نزار قبّاني؟",
   {"options": ["الشّاعر العبّاسيّ أبو تمّام", "الإمام عليّ", "عمر بن الخطّاب", "القارئ العربيّ المعاصر"]},
   {"correct": 0}, "يخاطب الشّاعر في هذا النّصّ الشّاعر العبّاسيّ أبا تمّام («أبا تمّام: إنّ الشّعر في أعماقه سفر»، «أبا تمّام إنّ النّار تأكلنا»).", 1, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "عمّ اعتذر الشّاعر لأبي تمّام؟",
   {"options": ["عن عجز شعراء اليوم في تحمّل مسؤوليّاتهم الشّعريّة، والاكتفاء بسفاسف الأمور", "عن تقصيره في رثائه بعد موته",
                "عن نقده لشعره القديم", "عن تأخّره في قراءة ديوانه"]},
   {"correct": 0}, "وقد اعتذر له عن عجز شعراء اليوم في تحمّل مسؤوليّاتهم الشّعريّة والاكتفاء بسفاسف الأمور («أمير الحرف.. سامحنا فقد خنّا جميعًا مهنة الحرف»).", 0.5, "ar.comprehension.details")
st("s03", "q1", "q1-e2", "fill_blank", "أكمل ما اعتذر عنه الشّاعر:",
   {"text": "اعتذر له عن ____ شعراء اليوم في تحمّل مسؤوليّاتهم الشّعريّة، و____ بسفاسف الأمور.", "bank": ["عجز", "الاكتفاء", "قدرة", "الزّهد"]},
   {"blanks": [["عجز"], ["الاكتفاء"]]}, "«وقد اعتذر له عن عجز شعراء اليوم في تحمّل مسؤوليّاتهم الشّعريّة والاكتفاء بسفاسف الأمور».", 0.5, "ar.comprehension.details", "b")
st("s04", "q2", "q2-e1", "mcq", "ما دلالة قول الشّاعر: «وجيش الغاصب المحتلّ ممنوع من الصّرف»؟",
   {"options": ["عجز أقلام الشّعراء عن فضح فظائع المحتلّين وكشف حيلهم وألاعيبهم", "قوّة جيش المحتلّ وصعوبة هزيمته في الميدان",
                "دعوة الشّعراء إلى الاهتمام بقواعد النّحو والصّرف", "انسحاب جيش المحتلّ من الأرض العربيّة"]},
   {"correct": 0}, "المقصود بهذه العبارة (وجيش الغاصب المحتلّ ممنوع من الصّرف): عجز أقلام الشّعراء عن فضح فظائع المحتلّين وكشف حيلهم وألاعيبهم.", 1, "ar.comprehension.explain")
st("s05", "q3", "q3-e1", "mcq", "من أسباب نفور القرّاء من الشّعر العربيّ المعاصر كما يبيّنها النّصّ:",
   {"options": ["ابتعاد الشّعراء عن الرّسالة السّامية للشّعر المتمثّلة في مواكبة قضايا الأمّة", "مواكبة الشّعراء لقضايا الأمّة",
                "تجديد الشّعراء في الأوزان والصّور", "قلّة عدد الشّعراء في العصر الحديث"]},
   {"correct": 0}, "من أسباب نفور القرّاء من الشّعر العربيّ المعاصر: ابتعاد الشّعراء عن الرّسالة السّامية للشّعر المتمثّلة في مواكبة قضايا الأمّة.", 0.5, "ar.comprehension.details")
st("s06", "q3", "q3-e2", "fill_blank", "أكمل السّبب الثّاني لنفور القرّاء من الشّعر العربيّ المعاصر:",
   {"text": "الاكتفاء بـ____ الشّعراء ____.", "bank": ["تقليد", "القدامى", "نقد", "المحدثين"]},
   {"blanks": [["تقليد"], ["القدامى"]]}, "ومن أسبابه: الاكتفاء بتقليد الشّعراء القدامى («لماذا شعرنا العربيّ قد يبست مفاصله من التّكرار…؟»).", 0.5, "ar.comprehension.details")
st("s07", "q4", "q4-e1", "mcq", "إلامَ يرمز «أبو تمّام» في القصيدة؟",
   {"options": ["إلى الشّعر العربيّ الأصيل الحامل لرسالة", "إلى زمن المجد والفتوحات الإسلاميّة", "إلى الشّاعر المتكسّب بشعره", "إلى العجز والاستكانة"]},
   {"correct": 0}, "الرّموز الّتي وظّفها الشّاعر رموز لأعلام مشهورين: أبو تمّام يرمز للشّعر العربيّ الأصيل الحامل لرسالة.", 0.5, "ar.literature.renewal")
st("s08", "q4", "q4-e2", "mcq", "إلامَ يرمز «عليّ» و«عمر» في قوله: «بأن يأتي الإمام عليّ.. أو يأتي لنا عمر»؟",
   {"options": ["إلى زمن المجد والفتوحات الإسلاميّة", "إلى الشّعر العربيّ الأصيل الحامل لرسالة", "إلى الخلافات بين المسلمين", "إلى الحنين إلى الطّفولة"]},
   {"correct": 0}, "عليّ وعمر: يرمزان إلى زمن المجد والفتوحات الإسلاميّة.", 0.5, "ar.literature.renewal")
st("s09", "q5", "q5-e1", "mcq", "حدّد النّمط الغالب على قصيدة نزار قبّاني.",
   {"options": ["الحجاجيّ", "السّرديّ", "الوصفيّ", "التّفسيريّ"]},
   {"correct": 0}, "النّمط الغالب على النّصّ: حجاجيّ.", 1, "ar.text.type")
ARG_EXPL = ("من مؤشّرات النّمط الحجاجيّ: استخدام الخطاب المباشر والجمل القصيرة؛ الاستعانة بالبراهين والأدلّة من المصادر والمراجع التّاريخيّة والفكريّة؛ "
            "استخدام أدوات الرّبط المتّصلة بالتّعليل والاستنتاج؛ استخدام أدوات التّوكيد؛ استخدام ضمير المتكلّم. يكتفي المترشّح بمؤشّرين فقط.")
st("s10", "q5", "q5-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط الحجاجيّ في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["استخدام الخطاب المباشر والجمل القصيرة", "الاستعانة بالبراهين والأدلّة من المصادر والمراجع التّاريخيّة والفكريّة",
                "استخدام أدوات الرّبط المتّصلة بالتّعليل والاستنتاج", "استخدام أدوات التّوكيد", "استخدام ضمير المتكلّم",
                "تتابع الأحداث وتسلسلها في الزّمن", "الإكثار من النّعوت والأحوال لرسم المشاهد"]},
   {"correct": [0, 1, 2, 3, 4]}, ARG_EXPL + " أمّا تتابع الأحداث فمؤشّر سرديّ، والإكثار من النّعوت والأحوال مؤشّر وصفيّ.", 0.5, "ar.text.type")
st("s11", "q5", "q5-e2", "fill_blank", "أكمل مؤشّرين من مؤشّرات النّمط الحجاجيّ في القصيدة:",
   {"text": "استخدام أدوات ____؛ استخدام ضمير ____.", "bank": ["التّوكيد", "المتكلّم", "التّشبيه", "الغائب"]},
   {"blanks": [["التّوكيد"], ["المتكلّم"]]}, ARG_EXPL, 0.5, "ar.text.type", "b")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ مع مراعاة تقنية التّلخيص", "text": "قصيدة نزار قبّاني إلى أبي تمّام (بكالوريا 2012، آداب وفلسفة، الموضوع الأوّل)"}
SUM_EXPL = "تلخيص مضمون النّصّ: يراعي المترشّح تقنيات التّلخيص: حجم التّلخيص، الدّلالة على المضمون، سلامة اللّغة (01 لكلّ معيار). لا يقدّم التّصحيح ملخّصًا نموذجيًّا."
for sid, eid, crit in [("s12", "q6-e1", "حجم التّلخيص"), ("s13", "q6-e2", "الدّلالة على المضمون"), ("s14", "q6-e3", "سلامة اللّغة")]:
    essay(sid, "q6", eid, "تلخيص قصيدة نزار قبّاني إلى أبي تمّام", crit, crit, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s15", "q7", "q7-e1", "mcq", "ما الحقل الدّلاليّ الّذي تنتمي إليه الأفعال: (نطقطق، نقعد، ننتظر)؟",
   {"options": ["العجز والاستكانة", "الثّورة والكفاح", "الحركة والنّشاط", "الفرح والطّرب"]},
   {"correct": 0}, "الحقل الدّلاليّ الّذي تنتمي إليه الأفعال (نطقطق، نقعد، ننتظر) هو العجز والاستكانة.", 0.5, "ar.cohesion.effect")
INSHA_EXPL = ("الأساليب الإنشائيّة في المقطع الثّالث: «أبا تمّام» ← نداء، غرضه: لفت الانتباه؛ «قل لي» ← أمر، غرضه: الالتماس؛ «لماذا» ← استفهام، "
              "غرضه الحسرة والتّذمّر. يكتفي المترشّح بأسلوبين فقط.")
st("s16", "q8", "q8-e1", "matching", "طابق كلّ أسلوب إنشائيّ من المقطع الثّالث بنوعه وغرضه.",
   {"lefts": ["«أبا تمّام…»", "«فقل لي أيّها الشّاعر»", "«لماذا شعرنا العربيّ قد يبست مفاصله…؟»"],
    "rights": ["نداء، غرضه: لفت الانتباه", "أمر، غرضه: الالتماس", "استفهام، غرضه: الحسرة والتّذمّر", "نهي، غرضه: النّصح والإرشاد", "تمنٍّ، غرضه: التّحسّر"]},
   {"pairs": [0, 1, 2]}, INSHA_EXPL, 0.5, "ar.rhetoric.insha")
st("s17", "q8", "q8-e1", "mcq", "ما غرض الأمر في قوله: «فقل لي أيّها الشّاعر»؟",
   {"options": ["الالتماس", "التّهديد والوعيد", "التّعجيز", "الإباحة"]},
   {"correct": 0}, INSHA_EXPL, 0.5, "ar.rhetoric.insha", "b")
st("s18", "q9", "q9-e1", "mcq", "ما نوع المجاز في قول الشّاعر: «إنّ النّاس بالكلمات قد كفروا»؟",
   {"options": ["مجاز مرسل علاقته الجزئيّة: أطلق لفظ الكلمات وأراد به الشّعر", "مجاز مرسل علاقته الكلّيّة: أطلق الكلّ وأراد الجزء",
                "مجاز مرسل علاقته المحلّيّة: أطلق المحلّ وأراد الحالّ فيه", "كناية عن صفة"]},
   {"correct": 0}, "نوع المجاز هو: مجاز مرسل. علاقته: الجزئيّة، إذ أطلق لفظ الكلمات وأراد به الشّعر.", 0.25, "ar.rhetoric.metonymy")
st("s19", "q9", "q9-e2", "mcq", "ما بلاغة المجاز المرسل في «إنّ النّاس بالكلمات قد كفروا»؟",
   {"options": ["إشغال ذهن المتلقّي بالبحث والتّأمّل ومتعة الاكتشاف", "تقديم الحقيقة مصحوبة بالدّليل", "توضيح المعنى بإيهام التّطابق بين المشبّه والمشبّه به", "إحداث جرس موسيقيّ في السّطر"]},
   {"correct": 0}, "تكمن بلاغته في إشغال ذهن المتلقّي بالبحث والتّأمّل ومتعة الاكتشاف.", 0.25, "ar.rhetoric.effect")
st("s20", "q10", "q10-e1", "mcq", "ما المسند في العبارة: «واصفرّت سنابله»؟",
   {"options": ["الفعل «اصفرّ»", "الفاعل «السّنابل»", "حرف العطف «الواو»", "الضّمير «الهاء»"]},
   {"correct": 0}, "في العبارة «واصفرّت سنابله»: المسند: الفعل «اصفرّ»، والمسند إليه: الفاعل «السّنابل».", 0.25, "ar.grammar.rules")
st("s21", "q10", "q10-e2", "mcq", "ما المسند إليه في العبارة: «واصفرّت سنابله»؟",
   {"options": ["الفاعل «السّنابل»", "الفعل «اصفرّ»", "حرف العطف «الواو»", "التّاء السّاكنة"]},
   {"correct": 0}, "المسند إليه: الفاعل «السّنابل»، والمسند: الفعل «اصفرّ».", 0.25, "ar.grammar.rules")
st("s22", "q11", "q11-e1", "mcq", "ما إعراب الفعل «تأكل» في قوله: «أبا تمّام إنّ النّار تأكلنا» (ممّا تحته خطّ)؟",
   {"options": ["فعل مضارع مرفوع وعلامة رفعه الضّمّة", "فعل مضارع منصوب وعلامة نصبه الفتحة", "فعل مضارع مجزوم وعلامة جزمه السّكون", "فعل ماضٍ مبنيّ على الفتح"]},
   {"correct": 0}, "تأكل: فعل مضارع مرفوع وعلامة رفعه الضّمّة.", 0.25, "ar.grammar.irab")
st("s23", "q11", "q11-e2", "fill_blank", "أكمل إعراب فاعل «تأكل» في «إنّ النّار تأكلنا»:",
   {"text": "والفاعل ضمير مستتر تقديره «____» يعود على ____.", "bank": ["هي", "النّار", "هو", "الشّعر"]},
   {"blanks": [["هي"], ["النّار"]]}, "والفاعل ضمير مستتر تقديره «هي» يعود على النّار.", 0.25, "ar.grammar.irab")
st("s24", "q11", "q11-e3", "mcq", "ما إعراب «نا» في «تأكلنا»؟",
   {"options": ["ضمير متّصل مبنيّ على السّكون في محلّ نصب مفعول به", "ضمير متّصل مبنيّ على السّكون في محلّ رفع فاعل",
                "ضمير متّصل مبنيّ على السّكون في محلّ جرّ مضاف إليه", "ضمير منفصل مبنيّ على السّكون في محلّ رفع مبتدأ"]},
   {"correct": 0}, "نا: ضمير متّصل مبنيّ على السّكون في محلّ نصب مفعول به.", 0.25, "ar.grammar.irab")
st("s25", "q11", "q11-e4", "mcq", "ما محلّ الجملة الفعليّة «تأكلنا» في قوله: «إنّ النّار تأكلنا»؟",
   {"options": ["في محلّ رفع خبر «إنّ»", "في محلّ نصب حال", "في محلّ نصب مفعول به", "في محلّ جرّ نعت"]},
   {"correct": 0}, "والجملة الفعليّة (تأكلنا) في محلّ رفع خبر «إنّ».", 0.25, "ar.grammar.sentence_case")
st("s26", "q11", "q11-e5", "mcq", "ما إعراب «عليّ» في قوله: «بأن يأتي الإمام عليّ» (ممّا تحته خطّ)؟",
   {"options": ["بدل مرفوع وعلامة رفعه الضّمّة الظّاهرة", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة", "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة", "خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة"]},
   {"correct": 0}, "عليّ: بدل (من «الإمام») مرفوع وعلامة رفعه الضّمّة الظّاهرة.", 0.5, "ar.grammar.badal")
st("s27", "q11", "q11-e6", "mcq", "ما المحلّ الإعرابيّ لجملة (إنّ الشّعر في أعماقه سفر)؟",
   {"options": ["جملة ابتدائيّة لا محلّ لها من الإعراب", "جملة اسميّة في محلّ نصب حال", "جملة اسميّة في محلّ رفع خبر", "جملة اسميّة في محلّ جرّ نعت"]},
   {"correct": 0}, "إنّ الشّعر في أعماقه سفر: جملة ابتدائيّة لا محلّ لها من الإعراب.", 0.25, "ar.grammar.sentence_case")
st("s28", "q11", "q11-e7", "mcq", "ما المحلّ الإعرابيّ لجملة (نجادل بعضنا بعضا) في قوله: «وما زلنا (نجادل بعضنا بعضا)»؟",
   {"options": ["جملة فعليّة في محلّ نصب خبر «ما زال»", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة صلة الموصول لا محلّ لها من الإعراب"]},
   {"correct": 0}, "نجادل بعضنا بعضا: جملة فعليّة في محلّ نصب خبر «ما زلنا».", 0.25, "ar.grammar.sentence_case")
PRO_EXPL = ("التّقطيع: «أبا تمّام إنّ النّار تأكلنا» ← «أبا تمما / م إنْنَنْنا / ر تأكلنا» = //0/0/0 //0/0/0 //0///0 = مَفَاعِيلُنْ مَفَاعِيلُنْ مُفَاعَلَتُنْ؛ "
            "«وما زلنا نجادل بعضنا بعضا» ← «وما زلنا / نجادل بع / ضنا بعضن» = //0/0/0 //0///0 //0/0/0 = مَفَاعِيلُنْ مُفَاعَلَتُنْ مَفَاعِيلُنْ. "
            "(صفّ التّفعيلات للسّطر الرّابع مطبوع في التّصحيح بترتيب معكوس؛ المعتمد ترتيب الرّموز والكتابة العروضيّة.)")
st("s29", "q12", "q12-e1", "fill_blank", "أكمل الكتابة العروضيّة للسّطر الرّابع «أبا تمّام إنّ النّار تأكلنا»:",
   {"text": "أبا تمما / ____ / ر تأكلنا", "bank": ["م إنْنَنْنا", "م إنّ النّا", "إنْنَنْنا"]},
   {"blanks": [["م إنْنَنْنا"]]}, PRO_EXPL, 0.25, "ar.prosody")
st("s30", "q12", "q12-e1", "mcq", "ما تفعيلات السّطر الرّابع «أبا تمّام إنّ النّار تأكلنا»؟",
   {"options": ["مَفَاعِيلُنْ مَفَاعِيلُنْ مُفَاعَلَتُنْ", "مَفَاعِيلُنْ مُفَاعَلَتُنْ مَفَاعِيلُنْ", "مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ", "فَاعِلَاتُنْ فَاعِلَاتُنْ فَاعِلَاتُنْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
st("s31", "q12", "q12-e2", "mcq", "ما الرّموز العروضيّة للسّطر الخامس «وما زلنا نجادل بعضنا بعضا»؟",
   {"options": ["//0/0/0 //0///0 //0/0/0", "//0/0/0 //0/0/0 //0///0", "///0//0 ///0//0 ///0//0", "/0//0 /0//0 /0//0"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody")
st("s32", "q12", "q12-e2", "mcq", "ما تفعيلات السّطر الخامس «وما زلنا نجادل بعضنا بعضا»؟",
   {"options": ["مَفَاعِيلُنْ مُفَاعَلَتُنْ مَفَاعِيلُنْ", "مَفَاعِيلُنْ مَفَاعِيلُنْ مُفَاعَلَتُنْ", "مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ مُسْتَفْعِلُنْ", "مُتَفَاعِلُنْ مُتَفَاعِلُنْ مُتَفَاعِلُنْ"]},
   {"correct": 0}, PRO_EXPL, 0.25, "ar.prosody", "b")
MIX_EXPL = ("مزج الشّاعر بين تفعيلتين: تفعيلة الوافر المجزوء (مُفَاعَلَتُنْ) وتفعيلة الهزج (مَفَاعِيلُنْ)، فوظّفهما حسب الحاجة إلى التّعبير، وهو بذلك قد كسر "
            "الرّتابة الموسيقيّة المقيّدة وحافظ على الوحدة الأساسيّة للشّعر العربيّ (التّفعيلة).")
st("s33", "q12", "q12-e3", "mcq", "ماذا تلاحظ على تفعيلات السّطرين الرّابع والخامس؟",
   {"options": ["مزج الشّاعر بين تفعيلة الوافر المجزوء (مُفَاعَلَتُنْ) وتفعيلة الهزج (مَفَاعِيلُنْ)", "التزم الشّاعر تفعيلة واحدة لا تتغيّر",
                "تخلّى الشّاعر عن التّفعيلة وكتب نثرًا خالصًا", "التزم الشّاعر نظام الشّطرين والقافية الموحّدة"]},
   {"correct": 0}, MIX_EXPL, 0.25, "ar.prosody")
st("s34", "q12", "q12-e3", "fill_blank", "أكمل أثر هذا المزج:",
   {"text": "وظّفهما حسب الحاجة إلى التّعبير، فكسر ____ الموسيقيّة المقيّدة، وحافظ على الوحدة الأساسيّة للشّعر العربيّ (____).",
    "bank": ["الرّتابة", "التّفعيلة", "القافية", "البيت"]},
   {"blanks": [["الرّتابة"], ["التّفعيلة"]]}, MIX_EXPL, 0.25, "ar.prosody", "b")
# ── ثالثًا: التّقويم النّقديّ ──
REN_EXPL = ("من مظاهر التّجديد في الشّعر العربيّ المعاصر: على مستوى المضمون: توظيف الرّمز، اعتماد الوحدة العضويّة؛ على مستوى الشّكل: بساطة القاموس "
            "اللّغويّ، اعتماد نظام التّفعيلة وتنوّع القافية (01 لكلّ مظهر).")
st("s35", "q13", "q13-e1", "mcq", "من مظاهر التّجديد في مضمون قصيدة نزار قبّاني:",
   {"options": ["توظيف الرّمز", "الوقوف على الأطلال", "التّكسّب بالمدح", "الافتتاح بالغزل"]},
   {"correct": 0}, REN_EXPL, 0.5, "ar.literature.renewal")
st("s36", "q13", "q13-e1", "multi", "ما الرّموز الّتي وظّفها الشّاعر في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["أبو تمّام", "عليّ", "عمر", "المتنبّي", "صلاح الدّين"]},
   {"correct": [0, 1, 2]}, "وظّف الشّاعر رموزًا لأعلام مشهورين: أبو تمّام (الشّعر العربيّ الأصيل الحامل لرسالة)، عليّ وعمر (زمن المجد والفتوحات الإسلاميّة)؛ والمتنبّي وصلاح الدّين لا ذكر لهما في النّصّ.", 0.5, "ar.literature.renewal", "b")
st("s37", "q13", "q13-e2", "mcq", "ومن مظاهر التّجديد في مضمون القصيدة أيضًا:",
   {"options": ["اعتماد الوحدة العضويّة", "وحدة البيت واستقلاله بمعناه", "تعدّد الأغراض في القصيدة الواحدة", "المقدّمة الطّلليّة"]},
   {"correct": 0}, REN_EXPL, 1, "ar.literature.renewal")
st("s38", "q13", "q13-e3", "mcq", "من مظاهر التّجديد في شكل القصيدة:",
   {"options": ["بساطة القاموس اللّغويّ", "جزالة الألفاظ وغرابتها", "الالتزام بنظام الشّطرين", "وحدة الرّويّ في القصيدة كلّها"]},
   {"correct": 0}, REN_EXPL, 1, "ar.literature.renewal")
st("s39", "q13", "q13-e4", "fill_blank", "أكمل مظهرًا آخر من مظاهر التّجديد في شكل القصيدة:",
   {"text": "اعتماد نظام ____ وتنوّع ____.", "bank": ["التّفعيلة", "القافية", "الشّطرين", "المعلّقات"]},
   {"blanks": [["التّفعيلة"], ["القافية"]]}, REN_EXPL, 1, "ar.literature.renewal")

TITLE = "بكالوريا 2012 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – آداب وفلسفة – الموضوع الأوّل (نزار قبّاني: قصيدة إلى أبي تمّام)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2012، شعبة آداب وفلسفة) في Drive صاحب المنصّة؛ النّصّ الحرفيّ من "
         f"ملفّ docx (والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID})، مقابَلًا سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2): الأسطر "
         "والمقاطع والأسئلة متطابقة؛ ما تحته خطّ «تأكلنا» و«عليّ»، وما بين قوسين (إنّ الشّعر في أعماقه سفر) و(نجادل بعضنا بعضا). فروق شكل وترقيم أُبقيت كما في docx "
         "(«الزّفة»، «وينتحر؟» والرّسميّ «وينتحرُ؟!»). في رأس docx سطر قالب قديم «دورة جوان 2008 / جميع الشعب»؛ السّنة والشّعبة من الموضوع الرّسميّ والتّصحيح. "
         "العلامات من الإجابة النّموذجيّة الرّسميّة (ممسوح، ص1–2؛ التّقطيع بدقّة 300 نقطة). المجموع 20 = بناء فكريّ 10 + بناء لغويّ 6 + تقويم نقديّ 4. "
         "التّقطيع «2×0.25» لكلّ سطر بلا تسمية فعنصر لكلّ سطر؛ صفّ تفعيلات السّطر الرّابع مطبوع في التّصحيح بترتيب معكوس (مفاعلتن أوّلًا) خلافًا لرموزه وكتابته "
         "العروضيّة (مفاعيلن مفاعيلن مفاعلتن)، فاعتُمدت الرّموز ولم يُجعل التّرتيب المعكوس مشتّتًا. مؤجَّل (essay_builder): التّلخيص س6 (3×01).")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write("ar-bac-2012-lit-p1", 1, TITLE, NOTES, LOG_NOTE)
