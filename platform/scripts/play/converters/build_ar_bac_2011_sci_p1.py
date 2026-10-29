"""Conversion: BAC 2011 (session عاديّة، جوان 2011) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (مفدي زكرياء، من «إلياذة الجزائر»).
Exam (most faithful source): gdrive 13Q6AsygzJd1776IoqKu5vketLbJ0r_gl (بكالوريا اللغة العربية 2011 شعبة علوم تجريبية.docx);
same paper as PDF (owner's copy): gdrive 1_yJSPmmroPBc4SUIvY4u-HwOIrvTYiPc (BAC 2011 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 19DGNOb7uxR_4Zr1nK-dg8RDaNP6pdfG4 (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1MXUAgE-PMm99eQSWyMod9r2kxJ9_b4hg (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2015_lit_p2.py / build_ar_bac_2018_lit_p1.py): PARAS / POEM_RAW below were generated from the .docx
with python-docx (paragraph and cell text read exactly; only outer whitespace and outer direction marks trimmed) and spliced
into this builder by script; the literals were re-checked programmatically against the docx. The docx was compared line by
line with the official ONEC paper (scanned, page images at their native 791×1088 px, crops enlarged ×2). The correction is
a scanned PDF (no usable text layer), read from the page images (crops enlarged ×1.9). Every mark comes from the official
scheme; correct options and explanations condense its wording.

Docx vs ONEC paper:
- Poem: same ten verses in the same order, and the same three centred closing lines («شغلنا الورى وملأنا الدّنا / بشعر
  نرتّله كالصّلاة / تسابيحه من حنايا الجزائر»); the docx table stores verses as [عجز, (empty), صدر] and the closing lines as
  merged rows (the same text in each of the three cells) ⇒ verses written [n-, صدر, عجز] and the closing lines kept as a
  separate text document (one line each, read from the first cell). Neither the docx nor the ONEC paper numbers the verses;
  the row labels «1-»…«10-» are added only so that the poem renders as numbered verses (the questions refer to verses by
  ordinal: «البيت التّاسع»، «البيت الثّامن»…). Verse text itself is untouched.
- Defect fixed from the ONEC paper (asserted to occur once): Part 2 Q6 «حّدها» (one د missing) ⇒ «حدّدها».
- Line-wrapped questions (Part 2 Q2 «… وما» / «دلالة الجمع بينهما؟», Q5 «… في البيت» / «الثامن.») joined with a space.
- Other differences are diacritics / spelling / labels only (docx kept): «(12 نقاط)» (ONEC «(12 نقطة)»), «تكرر» (ONEC «تكرّر»)…

Conversion notes / points for the owner's review:
- Streams: ONEC paper and correction headers «علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE.
  This paper has two parts only: البناء الفكريّ 12 + البناء اللّغويّ 8 (no التّقويم النّقديّ), as on the ONEC paper.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items (more listed than required, or «مظاهر أخرى
  مقبولة») ⇒ one element; exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1 «01 + 01» = addressee / reason. Q2 «4×0.5» = exactly the four reasons listed ⇒ four elements. Q3 «01».
- Q4 «6×0.5» for «قسّم النّصّ إلى وحداته الفكريّة، ثمّ ضع عنوانا لكلّ وحدة» (three units: 1–4، 5–9، 10) ⇒ two elements by
  demand: the division (3×0.5) and the titles (3×0.5), as the main ideas of a plan stay grouped in the earlier converters.
- Q5 «2×1» with «تنبيه: بإمكان المترشّح الإشارة إلى مظاهر أخرى مقبولة على أن يكتفي بمظهرين اثنين فقط» ⇒ one element of 2;
  the multi-select distractors are attitudes opposed to commitment (escapism, self-centred lament, praise for gain), so that
  no other acceptable manifestation is marked wrong.
- Q6 (تلخيص الأبيات 5–10) «01 دلالة المضمون + 0.5 تقنية التّلخيص + 0.5 سلامة اللّغة وجودة الأسلوب» ⇒ three deferred
  essay_builder elements (2 points deferred).
- Part 2: Q1 «3×0.5» one element per word. Q2 «4×0.25 + 0.5» = pronoun هم / its referent / pronoun نحن / its referent +
  the meaning of combining them. Q3 «0.5 + 0.75» = the relation / its explanation. Q4 «0.75». Q5 «2×0.5».
  Q6 «0.5 + 2×0.5 + 0.5» = locating the image / its type / its explanation / its effect ⇒ four elements.
- Distractors avoid arguable alternatives: no «سبب ونتيجة» for the relation of verses 5 and 10 (the scheme calls verse 10
  «بمثابة نتيجة»); no «خبر كان» / «حال» for the sentence «يقام» (صفة لـ«سدّ»); no «كناية» for «طبعه النّاصع» (استعارة
  مكنيّة); no «ضمير المتكلّم المفرد» / «هي» among the pronoun distractors (أحيّي، ريحها occur in verse 2).
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

SET_ID = "ar-bac-2011-sci-p1"
PAPER = 1
STREAMS = ["SCI", "MATH", "TM", "GE"]
DOCX_ID = "13Q6AsygzJd1776IoqKu5vketLbJ0r_gl"
DOCX_TITLE = "بكالوريا اللغة العربية 2011 شعبة علوم تجريبية.docx"
PDF_ID = "1_yJSPmmroPBc4SUIvY4u-HwOIrvTYiPc"
OFFICIAL_ID = "19DGNOb7uxR_4Zr1nK-dg8RDaNP6pdfG4"
CORR_ID = "1MXUAgE-PMm99eQSWyMod9r2kxJ9_b4hg"

# ── النّصوص الحرفيّة (مولَّدة آليًّا من ملفّ docx بـ python-docx؛ رقم الفقرة في docx؛ تقليم المسافات وعلامات الاتّجاه الطّرفيّة فقط) ──
PARAS = {
    0: 'على المترشح أن يختار أحد الموضوعين الآتيين:',
    1: 'الموضوع الأول',
    2: 'النّـــــص:',
    4: 'من إلياذة الجزائر – مفدي زكرياء –',
    7: 'الأسئلة:',
    8: 'أوّلا- البناء الفكري: (12 نقاط)',
    9: 'في مطلع القصيدة تحيّةً. لمن وجهها الشاعر؟ ولِم؟',
    10: 'وحدة المغرب العربيّ واقع وضرورة في نظر الشّاعر. بِم علل ذلك؟',
    11: 'ماذا يشترط الشاعر لتحقيق هذه الوحدة؟',
    12: 'قسّم النّصّ إلى وحداته الفكريّة، ثم ضع عنوانا لكل وحدة.',
    13: 'مفدي زكرياء شاعر ملتزم. حدّد مظهرين لهذا الالتزام من النّص.',
    14: 'لخّص مضمون الأبيات (من 5 إلى 10).',
    16: 'ثانيا- البناء اللّغوي: (08 نقاط)',
    17: 'بم توحي لك هذه الألفاظ: «ريحها الصّرصر - ملاذًا - وشائجنا»؟',
    18: 'تكرر في الأبيات: الثاني والثالث والرابع ضميران؛ حدّدهما. على من يعود كل منهما؟ وما',
    19: 'دلالة الجمع بينهما؟',
    20: 'ما العلاقة الموجودة بين البيتين الخامس والعاشر؟ وضّح ذلك.',
    21: 'أعرب كلمة «رحم» في البيت التَّاسع إعراب مفردات.',
    22: 'بين المحل الإعرابي لجملة «آزروا حربنا» في البيت الثاني وجملة «يقام» في البيت',
    23: 'الثامن.',
    24: 'في الشّطر الثاني من البيت الأوّل صورة بيانيّة، حّدها مبيّنا نوعها وموضّحا بلاغتها.',
}
POEM_RAW = [
    ['على طَبعـِه النَّاصـع الأطهَـرِ', '', 'سـلامٌ علـى المـغــرب الأكبـر'],
    ['إلـى النـَّصـر فـي ريحهـا الـصَّرصر', '', 'أحيي الأُلـى آزروا حربنـا'],
    ['علـى دمنــــــــا الفـائر الأحمر', '', 'ومـا بخلـــــــوا بـالدم المغربـيّ'],
    ['وعونـا علـــى الهـدف الأكبـر', '', 'وكــــــــانـوا مــــــــلاذًا لأحرارنـا'],
    ['شـهيدًا علـى وحـدة العُنـصر؟', '', 'أَلــيس امتــزاجُ دِمانـا الغـوالي'],
    ['وآمــــــــــــالنا فـــــــــــلك الــــــــــمِحور؟', '', 'أليـــــست جراحاتُنــا الـــدَّاميات'],
    ['ورُحنــــا بأصـــــــــــنـامـها نـــــــــــــزدري', '', 'وقـالوا: حدــودٌ؛ فدُسـنـا الحـدود'],
    ['يُقـــــــام علـى الـــــــزور والمنكـر؟', '', 'متـى كـــان بــــين الأشـقـاء سـدٌ'],
    ['تُــــخلــدها حُرمـــــــــة الأعــصر', '', 'وشَــــــــــائِجنـا رحــمٌ وذمــــــــــامٌ'],
    ['لِوحــــــــدة مغربنـــــــــــا الأكبــــــرِ', '', 'لتقـف الـسياسة خَطْـوَ الـشعوبِ'],
    ['شـــــــــــــــــــــغلنا الــــــــــــــــــــــورى وملأنـــــــــــــــــــــــــــا الدُّنَــــــــــــــــــــــــا', 'شـــــــــــــــــــــغلنا الــــــــــــــــــــــورى وملأنـــــــــــــــــــــــــــا الدُّنَــــــــــــــــــــــــا', 'شـــــــــــــــــــــغلنا الــــــــــــــــــــــورى وملأنـــــــــــــــــــــــــــا الدُّنَــــــــــــــــــــــــا'],
    ['بــــــــــــــــــــــــــــــــــــــــشعر نرتلــــــــــــــــــــــــــــــــه كالــــــــــــــــــــــــــــــــــصلاة', 'بــــــــــــــــــــــــــــــــــــــــشعر نرتلــــــــــــــــــــــــــــــــه كالــــــــــــــــــــــــــــــــــصلاة', 'بــــــــــــــــــــــــــــــــــــــــشعر نرتلــــــــــــــــــــــــــــــــه كالــــــــــــــــــــــــــــــــــصلاة'],
    ['تــــــــــــــــــــــــسابيحه مـــــــــن حنايــــــــــــــــــا الجزائـــــــــــــــــــــــــــــــــــر', 'تــــــــــــــــــــــــسابيحه مـــــــــن حنايــــــــــــــــــا الجزائـــــــــــــــــــــــــــــــــــر', 'تــــــــــــــــــــــــسابيحه مـــــــــن حنايــــــــــــــــــا الجزائـــــــــــــــــــــــــــــــــــر'],
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
assert len(POEM_RAW) == 13 and all(len(r) == 3 and r[1] == "" for r in POEM_RAW[:10])
assert all(r[0] == r[1] == r[2] for r in POEM_RAW[10:])
POEM = [[f"{i}-", sadr, ajz] for i, (ajz, _empty, sadr) in enumerate(POEM_RAW[:10], start=1)]
CLOSING = "\n".join(r[0] for r in POEM_RAW[10:])
DOCS = [
    {"id": "d-poem", "kind": "table", "caption": "الأبيات", "table": POEM},
    {"id": "d-closing", "kind": "text", "caption": "الأسطر الختاميّة", "text": CLOSING},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": PARAS[4]},
]
P1, P2 = PARAS[8], PARAS[16]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا")
J = lambda *ix: "\n".join(PARAS[i] for i in ix)

q("q1", "1", P1, J(9), 2, [el("q1-e1", "لمن وجّه الشّاعر التّحيّة", 1), el("q1-e2", "سبب التّحيّة", 1)], DOCS)
q("q2", "2", P1, J(10), 2, [el("q2-e1", "التّعليل: امتزاج الدّماء", 0.5), el("q2-e2", "التّعليل: وحدة الطّموح والآمال", 0.5),
                           el("q2-e3", "التّعليل: وحدة التّراب وعدم الاعتراف بالحدود", 0.5), el("q2-e4", "التّعليل: علاقة الأخوّة", 0.5)], DOCS)
q("q3", "3", P1, J(11), 1, [el("q3-e1", "شرط تحقيق الوحدة", 1)], DOCS)
q("q4", "4", P1, J(12), 3, [el("q4-e1", "تقسيم النّصّ إلى وحداته الفكريّة (3×0.5)", 1.5), el("q4-e2", "عنوان كلّ وحدة (3×0.5)", 1.5)], DOCS)
q("q5", "5", P1, J(13), 2, [el("q5-e1", "مظهران من مظاهر الالتزام (2×1)", 2)], DOCS)
q("q6", "6", P1, J(14), 2, [el("q6-e1", "التّلخيص: دلالة المضمون", 1), el("q6-e2", "التّلخيص: تقنية التّلخيص", 0.5),
                           el("q6-e3", "التّلخيص: سلامة اللّغة وجودة الأسلوب", 0.5)], DOCS)
q("q7", "1", P2, J(17), 1.5, [el("q7-e1", "إيحاء «ريحها الصّرصر»", 0.5), el("q7-e2", "إيحاء «ملاذًا»", 0.5), el("q7-e3", "إيحاء «وشائجنا»", 0.5)], DOCS)
q("q8", "2", P2, PARAS[18] + " " + PARAS[19], 1.5,
  [el("q8-e1", "الضّمير الأوّل", 0.25), el("q8-e2", "عائد الضّمير الأوّل", 0.25), el("q8-e3", "الضّمير الثّاني", 0.25),
   el("q8-e4", "عائد الضّمير الثّاني", 0.25), el("q8-e5", "دلالة الجمع بينهما", 0.5)], DOCS)
q("q9", "3", P2, J(20), 1.25, [el("q9-e1", "العلاقة بين البيتين الخامس والعاشر", 0.5), el("q9-e2", "توضيح العلاقة", 0.75)], DOCS)
q("q10", "4", P2, J(21), 0.75, [el("q10-e1", "إعراب «رحم» (ب9)", 0.75)], DOCS)
q("q11", "5", P2, PARAS[22] + " " + PARAS[23], 1, [el("q11-e1", "محلّ جملة «آزروا حربنا» (ب2)", 0.5), el("q11-e2", "محلّ جملة «يقام» (ب8)", 0.5)], DOCS)
q("q12", "6", P2, _fix(PARAS[24], "حّدها", "حدّدها"), 2,
  [el("q12-e1", "تحديد الصّورة", 0.5), el("q12-e2", "نوع الصّورة", 0.5), el("q12-e3", "شرح الصّورة", 0.5), el("q12-e4", "بلاغة الصّورة", 0.5)], DOCS)

# ── أوّلًا: البناء الفكريّ ──
Q1_EXPL = ("يوجّه الشّاعر في مطلع القصيدة تحيّة وسلامًا إلى شعوب المغرب العربيّ الكبير، اعترافًا منه لها على ما قدّمته من مؤازرة "
           "ومساعدة مادّيّة ومعنويّة لثورة الجزائر.")
st("s01", "q1", "q1-e1", "mcq", "لمن وجّه الشّاعر التّحيّة في مطلع القصيدة؟",
   {"options": ["إلى شعوب المغرب العربيّ الكبير", "إلى الشّعب الفرنسيّ", "إلى شهداء الثّورة الجزائريّة وحدهم", "إلى شعوب المشرق العربيّ"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.details")
st("s02", "q1", "q1-e1", "mcq", "أيّ عبارة من مطلع القصيدة تدلّ على من وُجّهت إليه التّحيّة؟",
   {"options": ["«سلامٌ على المغرب الأكبر»", "«ومَا بخلوا بالدّم المغربيّ»", "«لتقف السّياسة خطو الشّعوب»", "«متى كان بين الأشقّاء سدّ»"]},
   {"correct": 0}, Q1_EXPL + " وفي البيت الأوّل: «سلامٌ على المغرب الأكبر».", 0.5, "ar.comprehension.evidence", "b")
st("s03", "q1", "q1-e2", "mcq", "لماذا وجّه الشّاعر هذه التّحيّة؟",
   {"options": ["اعترافًا منه لها على ما قدّمته من مؤازرة ومساعدة مادّيّة ومعنويّة لثورة الجزائر", "عتابًا لها على تخلّيها عن الثّورة الجزائريّة",
                "تمهيدًا لهجائها والتّشهير بها", "رغبةً منه في التّكسّب بشعره"]},
   {"correct": 0}, Q1_EXPL, 0.5, "ar.comprehension.purpose")
st("s04", "q1", "q1-e2", "fill_blank", "أكمل سبب التّحيّة:",
   {"text": "اعترافًا منه لها على ما قدّمته من ____ ومساعدة ____ ومعنويّة لثورة الجزائر.", "bank": ["مؤازرة", "مادّيّة", "معارضة", "سياسيّة"]},
   {"blanks": [["مؤازرة"], ["مادّيّة"]]}, Q1_EXPL, 0.5, "ar.comprehension.purpose", "b")
Q2_EXPL = ("وحدة المغرب العربيّ واقع وضرورة في نظر الشّاعر، وقد علّل ذلك بما يلي: امتزاج دماء هذه الشّعوب خلال كفاحها؛ وحدة الطّموح والآمال؛ "
           "وحدة التّراب وعدم الاعتراف بالحدود الجغرافيّة بين هذه الشّعوب؛ علاقة الأخوّة الّتي يؤكّدها التّاريخ.")
st("s05", "q2", "q2-e1", "fill_blank", "أكمل أحد التّعليلات الّتي ساقها الشّاعر:",
   {"text": "امتزاج ____ هذه الشّعوب خلال ____.", "bank": ["دماء", "كفاحها", "ثروات", "تجارتها"]},
   {"blanks": [["دماء"], ["كفاحها"]]}, Q2_EXPL + " («أليس امتزاج دمانا الغوالي شهيدًا على وحدة العنصر؟»).", 0.5, "ar.comprehension.explain")
st("s06", "q2", "q2-e2", "mcq", "ومن تعليل الشّاعر أيضًا:",
   {"options": ["وحدة الطّموح والآمال", "تشابه المناخ والتّضاريس", "كثرة المبادلات التّجاريّة", "اتّفاق الحكّام على رسم الحدود"]},
   {"correct": 0}, Q2_EXPL + " («وآمالنا فلك المحور»).", 0.5, "ar.comprehension.explain")
st("s07", "q2", "q2-e3", "fill_blank", "أكمل تعليلًا آخر:",
   {"text": "وحدة ____ وعدم الاعتراف بـ____ الجغرافيّة بين هذه الشّعوب.", "bank": ["التّراب", "الحدود", "اللّغات", "الأسواق"]},
   {"blanks": [["التّراب"], ["الحدود"]]}, Q2_EXPL + " («وقالوا: حدودٌ؛ فدسنا الحدود»).", 0.5, "ar.comprehension.explain")
st("s08", "q2", "q2-e4", "mcq", "ما العلاقة الّتي يؤكّدها التّاريخ بين شعوب المغرب العربيّ في تعليل الشّاعر؟",
   {"options": ["علاقة الأخوّة", "علاقة التّبعيّة", "علاقة العداوة", "علاقة المصلحة العابرة"]},
   {"correct": 0}, Q2_EXPL + " («متى كان بين الأشقّاء سدّ…»، «وشائجنا رحمٌ وذمامٌ…»).", 0.5, "ar.comprehension.explain")
Q3_EXPL = "يشترط الشّاعر لتحقيق هذه الوحدة: أن تساير الإرادة السّياسيّة آمال وإرادة الشّعوب (البيت العاشر)."
st("s09", "q3", "q3-e1", "mcq", "ماذا يشترط الشّاعر لتحقيق وحدة المغرب العربيّ؟",
   {"options": ["أن تساير الإرادة السّياسيّة آمال الشّعوب وإرادتها", "أن تتنازل كلّ دولة عن استقلالها لدولة واحدة",
                "أن تُرسَم الحدود بين الدّول بدقّة", "أن تتولّى قوّة أجنبيّة توحيد المنطقة"]},
   {"correct": 0}, Q3_EXPL, 0.5, "ar.comprehension.details")
st("s10", "q3", "q3-e1", "mcq", "في أيّ بيت ورد هذا الشّرط؟",
   {"options": ["البيت العاشر", "البيت الأوّل", "البيت الخامس", "البيت الثّامن"]},
   {"correct": 0}, Q3_EXPL + " «لتقف السّياسة خطو الشّعوب لوحدة مغربنا الأكبر».", 0.5, "ar.comprehension.evidence", "b")
UNITS_EXPL = ("الوحدات الفكريّة وعناوينها: (الأبيات من 1 إلى 4): تحيّة واعتراف؛ (الأبيات من 5 إلى 9): عوامل ومظاهر وحدة شعوب المغرب العربيّ؛ "
              "(البيت 10): دعوة السّياسيّين إلى دعم إرادة الشّعوب في تحقيق الوحدة.")
st("s11", "q4", "q4-e1", "mcq", "كيف يُقسَّم النّصّ إلى وحداته الفكريّة؟",
   {"options": ["(الأبيات 1–4) / (الأبيات 5–9) / (البيت 10)", "(الأبيات 1–3) / (الأبيات 4–8) / (الأبيات 9–10)",
                "(الأبيات 1–5) / (الأبيات 6–10)", "(الأبيات 1–2) / (الأبيات 3–7) / (الأبيات 8–10)"]},
   {"correct": 0}, UNITS_EXPL, 0.75, "ar.comprehension.idea")
st("s12", "q4", "q4-e1", "fill_blank", "أكمل حدود الوحدات الفكريّة:",
   {"text": "الوحدة الأولى: من البيت 1 إلى البيت ____؛ الوحدة الثّانية: من البيت 5 إلى البيت ____؛ الوحدة الثّالثة: البيت ____.",
    "bank": ["4", "9", "10", "3", "7"]},
   {"blanks": [["4"], ["9"], ["10"]]}, UNITS_EXPL, 0.75, "ar.comprehension.idea", "b")
st("s13", "q4", "q4-e2", "matching", "طابق كلّ وحدة فكريّة بعنوانها.",
   {"lefts": ["(الأبيات من 1 إلى 4)", "(الأبيات من 5 إلى 9)", "(البيت 10)"],
    "rights": ["تحيّة واعتراف", "عوامل ومظاهر وحدة شعوب المغرب العربيّ", "دعوة السّياسيّين إلى دعم إرادة الشّعوب في تحقيق الوحدة",
               "رثاء شهداء الثّورة"]},
   {"pairs": [0, 1, 2]}, UNITS_EXPL, 0.75, "ar.writing.title")
st("s14", "q4", "q4-e2", "ordering", "رتّب عناوين الوحدات كما تتوالى في النّصّ.",
   {"items": ["تحيّة واعتراف", "عوامل ومظاهر وحدة شعوب المغرب العربيّ", "دعوة السّياسيّين إلى دعم إرادة الشّعوب في تحقيق الوحدة"]},
   {"order": [0, 1, 2]}, UNITS_EXPL, 0.75, "ar.comprehension.idea", "b")
COMMIT_EXPL = ("من مظاهر التزام الشّاعر في النّصّ: تسخير الشّاعر قلمه وأدبه في خدمة قضايا شعوب مغربه الكبير؛ السّعي إلى تغيير واقع فرضه الاستعمار "
               "(إقامة الحدود بين دول المغرب العربيّ) قصد تحقيق وحدة هذه الشّعوب. تنبيه: بإمكان المترشّح الإشارة إلى مظاهر أخرى مقبولة على أن يكتفي بمظهرين اثنين.")
st("s15", "q5", "q5-e1", "multi", "أيّ ممّا يلي من مظاهر التزام مفدي زكرياء في هذا النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["تسخير الشّاعر قلمه وأدبه في خدمة قضايا شعوب مغربه الكبير",
                "السّعي إلى تغيير واقع فرضه الاستعمار (إقامة الحدود بين دول المغرب العربيّ) قصد تحقيق وحدة هذه الشّعوب",
                "الهروب من الواقع إلى عالم الخيال والطّبيعة", "الانطواء على الذّات والتّغنّي بآلامها الفرديّة", "التّكسّب بالشّعر ومدح الحكّام"]},
   {"correct": [0, 1]}, COMMIT_EXPL, 1, "ar.literature.trend")
st("s16", "q5", "q5-e1", "fill_blank", "أكمل مظهري الالتزام:",
   {"text": "سخّر الشّاعر ____ وأدبه في خدمة قضايا شعوب مغربه الكبير، وسعى إلى تغيير واقع فرضه ____ (إقامة الحدود بين دول المغرب العربيّ) قصد تحقيق ____ هذه الشّعوب.",
    "bank": ["قلمه", "الاستعمار", "وحدة", "ماله", "التّاريخ", "تفرقة"]},
   {"blanks": [["قلمه"], ["الاستعمار"], ["وحدة"]]}, COMMIT_EXPL, 1, "ar.literature.trend", "b")
SUM_SPEC = {"task": "تلخيص مضمون الأبيات من 5 إلى 10", "text": "مفدي زكرياء، من «إلياذة الجزائر» (بكالوريا 2011، الشّعب العلميّة، الموضوع الأوّل)",
            "scheme": "تلخيص مضمون الأبيات (من 5 إلى 10): يراعى فيه: دلالة المضمون (01)، تقنية التّلخيص (0.5)، سلامة اللّغة وجودة الأسلوب (0.5)"}
SUM_EXPL = "يراعى في التّلخيص: دلالة المضمون (01)، تقنية التّلخيص (0.5)، سلامة اللّغة وجودة الأسلوب (0.5). لا يقدّم الحلّ ملخّصًا نموذجيًّا."
essay("s17", "q6", "q6-e1", "تلخيص الأبيات 5–10 من نصّ مفدي زكرياء", "دلالة المضمون", "دلالة المضمون", 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
essay("s18", "q6", "q6-e2", "تلخيص الأبيات 5–10 من نصّ مفدي زكرياء", "تقنية التّلخيص", "تقنية التّلخيص", 0.5, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
essay("s19", "q6", "q6-e3", "تلخيص الأبيات 5–10 من نصّ مفدي زكرياء", "سلامة اللّغة وجودة الأسلوب", "سلامة اللّغة وجودة الأسلوب", 0.5, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
SUGG_EXPL = "إيحاء الألفاظ: ريحها الصّرصر: شدّة الثّورة وقوّتها وقساوتها؛ ملاذًا: توفير الحماية والأمن؛ وشائجنا: قوّة الرّوابط بين هذه الشّعوب."
st("s20", "q7", "q7-e1", "mcq", "بمَ توحي عبارة «ريحها الصّرصر» في البيت الثّاني؟",
   {"options": ["شدّة الثّورة وقوّتها وقساوتها", "هدوء الثّورة وسكينتها", "ضعف الثّورة وتراجعها", "برودة الطّقس في بلاد المغرب"]},
   {"correct": 0}, SUGG_EXPL, 0.5, "ar.comprehension.explain")
st("s21", "q7", "q7-e2", "fill_blank", "أكمل إيحاء لفظة «ملاذًا» في البيت الرّابع:",
   {"text": "توحي لفظة «ملاذًا» بتوفير ____ و____.", "bank": ["الحماية", "الأمن", "الخوف", "العزلة"]},
   {"blanks": [["الحماية"], ["الأمن"]]}, SUGG_EXPL, 0.5, "ar.comprehension.explain")
st("s22", "q7", "q7-e3", "mcq", "بمَ توحي لفظة «وشائجنا» في البيت التّاسع؟",
   {"options": ["قوّة الرّوابط بين هذه الشّعوب", "ضعف الصّلات بين الشّعوب", "كثرة الخلافات بين الأشقّاء", "بُعد المسافات بين الأقطار"]},
   {"correct": 0}, SUGG_EXPL, 0.5, "ar.comprehension.explain")
PRON_EXPL = ("الضّميران هما: أ- ضمير جمع الغائبين (هم) ويعود على شعوب المغرب العربيّ الكبير؛ ب- ضمير جمع المتكلّمين (نحن) ويعود على الشّعب الجزائريّ. "
             "دلالة الجمع بينهما: مدى تلاحم شعوب المغرب العربيّ فيما بينها.")
st("s23", "q8", "q8-e1", "mcq", "ما الضّمير المتكرّر في الأبيات 2–4 في «آزروا، بخلوا، كانوا»؟",
   {"options": ["ضمير جمع الغائبين (هم)", "ضمير المخاطبين (أنتم)", "ضمير المخاطب المفرد (أنتَ)", "ضمير المثنّى الغائب (هما)"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s24", "q8", "q8-e2", "mcq", "على من يعود ضمير جمع الغائبين في «آزروا، بخلوا، كانوا»؟",
   {"options": ["على شعوب المغرب العربيّ الكبير", "على الشّعب الجزائريّ", "على المستعمرين", "على رجال السّياسة"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s25", "q8", "q8-e3", "mcq", "ما الضّمير المتكرّر في الأبيات 2–4 في «حربنا، دمنا، أحرارنا»؟",
   {"options": ["ضمير جمع المتكلّمين (نحن)", "ضمير المخاطبين (أنتم)", "ضمير جمع الغائبين (هم)", "ضمير المخاطب المفرد (أنتَ)"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s26", "q8", "q8-e4", "mcq", "على من يعود ضمير جمع المتكلّمين في «حربنا، دمنا، أحرارنا»؟",
   {"options": ["على الشّعب الجزائريّ", "على شعوب المغرب العربيّ الكبير", "على المستعمرين", "على رجال السّياسة"]},
   {"correct": 0}, PRON_EXPL, 0.25, "ar.cohesion.reference")
st("s27", "q8", "q8-e5", "mcq", "ما دلالة الجمع بين الضّميرين في الأبيات 2–4؟",
   {"options": ["مدى تلاحم شعوب المغرب العربيّ فيما بينها", "التّفرقة بين الشّعب الجزائريّ وجيرانه", "تعظيم الشّاعر لنفسه", "حياد الشّاعر تجاه الثّورة"]},
   {"correct": 0}, PRON_EXPL, 0.5, "ar.cohesion.effect")
REL_EXPL = ("العلاقة الموجودة بين البيتين الخامس والعاشر هي: علاقة ترابط وتكامل؛ أي أنّ البيت العاشر بمثابة نتيجة يرغب الشّاعر في تحقيقها انطلاقًا ممّا مهّد له "
            "في البيت الخامس. فالشّاعر يريد القول: إنّ امتزاج دمانا الغالية دليل على وحدة شعوب المغرب العربيّ الكبير، لذا نطلب من رجال السّياسة أن يسلكوا "
            "مسلك تلك الشّعوب في أملها في تحقيق الوحدة.")
st("s28", "q9", "q9-e1", "mcq", "ما العلاقة الموجودة بين البيتين الخامس والعاشر؟",
   {"options": ["علاقة ترابط وتكامل", "علاقة تضادّ وتناقض", "علاقة تكرار وترادف", "لا علاقة بين البيتين"]},
   {"correct": 0}, REL_EXPL, 0.5, "ar.comprehension.link")
st("s29", "q9", "q9-e2", "fill_blank", "وضّح العلاقة:",
   {"text": "البيت العاشر بمثابة ____ يرغب الشّاعر في تحقيقها انطلاقًا ممّا مهّد له في البيت ____.", "bank": ["نتيجة", "الخامس", "مقدّمة", "الأوّل"]},
   {"blanks": [["نتيجة"], ["الخامس"]]}, REL_EXPL, 0.5, "ar.comprehension.link")
st("s30", "q9", "q9-e2", "mcq", "فالشّاعر يريد القول:",
   {"options": ["إنّ امتزاج دمائنا الغالية دليل على وحدة شعوب المغرب العربيّ، لذا نطلب من رجال السّياسة أن يسلكوا مسلك تلك الشّعوب في أملها في تحقيق الوحدة",
                "إنّ رجال السّياسة هم الّذين وحّدوا شعوب المغرب العربيّ قبل الثّورة", "إنّ على الشّعوب أن تتخلّى عن آمالها وتتبع خطى السّياسيّين",
                "إنّ جراح الشّعوب لا صلة لها بوحدتها"]},
   {"correct": 0}, REL_EXPL, 0.25, "ar.comprehension.link", "b")
st("s31", "q10", "q10-e1", "mcq", "ما إعراب «رحمٌ» في قوله: «وشائجنا رحمٌ وذمامٌ»؟",
   {"options": ["خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة", "مبتدأ مرفوع وعلامة رفعه الضّمّة الظّاهرة", "فاعل مرفوع وعلامة رفعه الضّمّة الظّاهرة",
                "مفعول به منصوب وعلامة نصبه الفتحة الظّاهرة"]},
   {"correct": 0}, "«رحم»: خبر مرفوع وعلامة رفعه الضّمّة الظّاهرة.", 0.75, "ar.grammar.irab")
st("s32", "q11", "q11-e1", "mcq", "ما المحلّ الإعرابيّ لجملة «آزروا حربنا» في قوله: «أحيّي الأُلى آزروا حربنا»؟",
   {"options": ["جملة فعليّة لا محلّ لها من الإعراب لأنّها صلة الموصول", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ نصب مفعول به",
                "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "جملة «آزروا حربنا»: جملة فعليّة لا محلّ لها من الإعراب لأنّها صلة الموصول (الأُلى).", 0.5, "ar.grammar.sentence_case")
st("s33", "q11", "q11-e2", "mcq", "ما المحلّ الإعرابيّ لجملة «يقام» في قوله: «متى كان بين الأشقّاء سدّ يقام على الزّور والمنكر؟»",
   {"options": ["جملة فعليّة في محلّ رفع صفة لـ«سدّ»", "جملة فعليّة لا محلّ لها من الإعراب لأنّها صلة الموصول", "جملة فعليّة في محلّ جرّ مضاف إليه",
                "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "جملة «يقام»: جملة فعليّة في محلّ رفع صفة لـ«سدّ».", 0.5, "ar.grammar.sentence_case")
IMG_EXPL = ("الصّورة البيانيّة نجدها في قوله: «طبعه النّاصع». نوعها: استعارة مكنيّة؛ شبّه «الطّبع» وهو شيء معنويّ بشيء مادّيّ محسوس كالثّوب، ثمّ حذف "
            "المشبّه به، وترك صفة من صفاته وهي «النّاصع». بلاغتها: توضيح المعنى وتجسيده في صورة ملموسة محسوسة حيث أبرزت مدى أصالة طبع شعوب المغرب العربيّ.")
st("s34", "q12", "q12-e1", "mcq", "حدّد الصّورة البيانيّة الواردة في الشّطر الثّاني من البيت الأوّل.",
   {"options": ["«طبعه النّاصع»", "«ريحها الصّرصر»", "«دمنا الفائر»", "«فلك المحور»"]},
   {"correct": 0}, IMG_EXPL + " (أمّا العبارات الأخرى فليست من البيت الأوّل.)", 0.5, "ar.rhetoric.metaphor")
st("s35", "q12", "q12-e2", "mcq", "ما نوع الصّورة البيانيّة في «طبعه النّاصع»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "مجاز مرسل علاقته المحلّيّة"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s36", "q12", "q12-e3", "matching", "اشرح الصّورة في «طبعه النّاصع»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه (مذكور)", "المشبّه به (محذوف)", "الصّفة الّتي تُركت من صفات المشبّه به"],
    "rights": ["الطّبع (شيء معنويّ)", "الثّوب (شيء مادّيّ محسوس)", "النّاصع", "المغرب"]},
   {"pairs": [0, 1, 2]}, IMG_EXPL, 0.5, "ar.rhetoric.metaphor")
st("s37", "q12", "q12-e4", "mcq", "ما بلاغة الصّورة في «طبعه النّاصع»؟",
   {"options": ["توضيح المعنى وتجسيده في صورة ملموسة محسوسة أبرزت مدى أصالة طبع شعوب المغرب العربيّ", "إحداث جرس موسيقيّ في البيت",
                "تقديم الحقيقة مصحوبة بدليلها", "إبراز التّضادّ بين المعنيين"]},
   {"correct": 0}, IMG_EXPL, 0.5, "ar.rhetoric.effect")

TITLE = "بكالوريا 2011 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (مفدي زكرياء: من إلياذة الجزائر)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2011، الشّعب: علوم تجريبيّة، رياضيات، تقني رياضي، تسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ مولَّد من ملفّ docx ومقابَل بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} (01_الموضوع.pdf، ص1–2، صورة ممسوحة)، "
         f"والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID}. صُوّب من الموضوع الرّسميّ: «حّدها» ← «حدّدها» (البناء اللّغويّ س6)، ووُصل السّؤالان 2 و5 المقطوعة أسطرهما. "
         "الأبيات غير مرقّمة في الموضوع ولا في docx؛ أُضيف رقم كلّ بيت في خانة مستقلّة للعرض فقط، وأُثبتت الأسطر الثّلاثة الختاميّة (شغلنا الورى…) وثيقةً مستقلّة. "
         "العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ص1–2، صورة ممسوحة قُرئت مصوّرة). المجموع 20 = بناء فكريّ 12 + بناء لغويّ 8 (لا تقويم نقديّ في هذا الموضوع). "
         "مؤجَّل (essay_builder): التّلخيص س6 (01 المضمون + 0.5 التّقنية + 0.5 سلامة اللّغة). مظاهر الالتزام «2×1» مع «مظاهر أخرى مقبولة» فبقيت عنصرًا واحدًا.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ ومصوَّبة منه) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write(SET_ID, PAPER, STREAMS, TITLE, NOTES, LOG_NOTE, DOCX_ID, DOCX_TITLE, CORR_ID, "2026-10-29T17:00:00Z")
