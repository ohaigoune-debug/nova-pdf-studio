"""Conversion: BAC 2012 (session عاديّة، جوان 2012) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (محمود درويش، «عابرون في كلام عابر»).
Exam (most faithful source): gdrive 1_BtZ00lmDpZWYdzKmmD4MAVXzUxSLLFm (بكالوريا 2012 العربية شعبة علوم تجريبية.docx);
same paper as PDF (owner's retyped copy, exported from the docx): gdrive 1HS2w9tb9vFIaxZGn6pLSkXfkLWJhvT06 (BAC 2012 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1i-lgxTZJfo0pdzF2QF_IKUOv2S-rPg5K (01_الموضوع.pdf, pages 1–2, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1QhQBWwWPG7h5YVFnMUqfE0Qxdm9WvbH0 (02_التصحيح.pdf, pages 1–2).

Method (as build_ar_bac_2016_lit_p1.py / build_ar_bac_2018_lit_p1.py): the verbatim strings below (title, the four stanzas,
reference, question texts) were generated from the .docx with python-docx (runs read exactly, tatweel kept; only outer
whitespace and outer direction marks trimmed; the free-verse poem sits in a two-cell table, read line by line and cut at
its «****» separators into four stanzas; question lines that the docx splits over two paragraphs are joined with a space)
and every verbatim string of the JSON was re-checked programmatically against the docx. The docx was compared line by line
with the official ONEC paper (rendered at 130–200 dpi). The correction is a scanned PDF, read from the rendered pages
(150 dpi, fully legible). Every mark comes from the official scheme; correct options and explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper header «علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE (the docx header
  says «علوم تجريبية» only; the correction header «الشّعب العلميّة المشتركة»).
- docx defect fixed from the ONEC paper: stanza 3, line 4 «أو الى توقيت الموسيقى المسدَّس» ⇒ «…توقيت موسيقى المسدَّس»
  (the ONEC paper has «موسيقى» without the article; only that word changed). Kept as in the docx (spelling/diacritics only):
  «فَخْذُوا» (ONEC «فخُذوا»), «الطائرة / العابرة / للذاكرة / والآخرَةٌ» (ONEC «…رَهْ»), «(12 نقاط)» (ONEC «نقطة»), the
  comma after «وغرضيهما» (ONEC full stop), «أوّلا-/ثانيا-» headings.
- No part «التّقويم النّقديّ» in this paper: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines (as in the 2015–2023 converters): interchangeable items (more listed than required) ⇒ one element;
  exactly the required distinct items, or the distinct demands of the question ⇒ one element per item.
- Q1: 01 addressee + 0.5 content + 0.5 motive. Q2 «4×0,25» per field («للمترشّح الحرّيّة في اختيار أربع مفردات») ⇒ one
  element per field (1 each). Q3 «2×01» = the two suggestions of «نحن» in the scheme (إثبات الذّات والحضور / التّعبير عن
  الانتماء والإيمان بالقضيّة، الضّمير الجمعيّ). Q4: «2×0,5» = the tendency + its relation to commitment; «2×0,5» two
  manifestations among five ⇒ one element of 1. Q5 «2×0,75» = methods of oppression + the defiant phrases (three among four).
  Q6: 01 the type (أمريّ إيعازيّ) + «6×0,25» = exactly three indicators listed (النّداء، الأمر، النّهي), each with its example
  ⇒ three elements of 0.5.
- Part 2: Q1 and Q2 «2×0.75», two items among three / four listed («يكتفي المترشّح بذكر أسلوبين / مظهرين») ⇒ one element
  of 1.5 each. Q3: «من» 0.25, «كم» 0.25, the شبه جملة 0.5, «شعبًا» 0.5 (no «مفعول به» distractor for «شعبًا»: «نزف» can be
  transitive). Q4 «3×0.5» one element per sentence («ما نعمل»: no «نعت» distractor, «ما» could be read نكرة موصوفة).
- Q5 image 1: the scheme prints «0.25+0.5» on the single line «شبّه الصّهاينة المحتلّين بالحشرات الطّائرة وهو تشبيه مرسل»
  without saying which part is which ⇒ one element (explanation + type) of 0.75, then 0.25 effect. Image 2: 0.5 explanation,
  0.25 type, 0.25 effect (one line each).
- Distractors avoid what the scheme or usage could accept: «تشبيه مجمل» is not a distractor of «تشبيه مرسل»; the
  inshāʾ purposes and the defiant phrases are tested with options foreign to the text (no other line of the poem is
  marked wrong as a defiant phrase).
- Underline: none in this paper (the parenthesised sentences of stanza 2 are the ones parsed in Part 2 Q4).
- Nothing deferred: every element has a closed answer in the scheme.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1_BtZ00lmDpZWYdzKmmD4MAVXzUxSLLFm"
DOCX_TITLE = "بكالوريا 2012 العربية شعبة علوم تجريبية.docx"
PDF_ID = "1HS2w9tb9vFIaxZGn6pLSkXfkLWJhvT06"
OFFICIAL_ID = "1i-lgxTZJfo0pdzF2QF_IKUOv2S-rPg5K"
CORR_ID = "1QhQBWwWPG7h5YVFnMUqfE0Qxdm9WvbH0"
SOURCE_STREAMS = ["SCI", "MATH", "TM", "GE"]

# ── الموضوع الأوّل (مولَّد من docx؛ انظر الملاحظات أعلاه لما أُصلح من الموضوع الرّسميّ) ──
P1_TITLE = '«عابرون في كلام عابر»'
P1_STANZAS = [['أيّها المارّون بين الكلمات العابره', 'منكم السيف، ومنَّا دمنا', 'منكم الفولاذ والنّار، ومنّا لحمُنا', 'منكم دَبَّابةٌ أخرى، ومنا حَجَرٌ', 'منكم قنبلةُ الغاز، ومنَّا المطر', 'وعلينا ما عليكم من سماءٍ وهواء', 'فَخْذُوا حصَّتكم من دمنا، وانصرفوا', 'وادخلوا حفل عشاءٍ راقص.. وانصرفوا', 'فعلينا، نحن، أن نحرس ورد الشهداء', 'وعلينا، نحن، أن نحيا كما نحن نشاء!'], ['أيُّها المارُّون بين الكلمات العابره', 'كالغبار المُرّ، مُروا أينما شئتم ولكن', 'لا تمرُّوا بيننا كالحشرات الطائرة', 'فلنا في أرضنا ما (نعمل)', 'ولنا قمحٌ (نربيه) و(نسقيه) ندى أجسادنا', 'ولنا ما ليس يرضيكم هنا:', 'حجرٌ.. أو خجل', 'فخذوا الماضي، إذا شئتم، إلى سوق التّحف'], ['أيّها المارّون بين الكلمات العابره', 'كدّسوا أوهامكم في حفرة مهجورة، وانصرفوا', 'وأعيدوا عقرب الوقت إلى شرعية العِجل المقدس', 'أو الى توقيت موسيقى المسدَّس', 'فلنا ما ليس يرضيكم هنا، فانصرفوا', 'ولنا ما ليس فيكم، وطنٌ ينزف شعبًا ينزف', 'وطنًا يصلح للنسيان أو للذاكرة'], ['أيّها المارّون بين الكلمات العابرة', 'آن أن تنصرفوا', 'وتقيموا أينما شئتم، ولكن لا تقيموا بيننا', 'آن أن تنصرفوا', 'وتموتوا أينما شئتم، ولكن لا تموتوا بيننا', 'فلنا في أرضنا ما نعمل', 'ولنا الماضي هنا', 'ولنا صوت الحياة الأوّل', 'ولنا الحاضر، والحاضر، والمستقبل', 'ولنا الدّنيا هنا والآخرَةٌ', 'فَاخْرُجُوا من أرضنا', 'من بَرّنا.. من بَحرنا', 'من قمحنا.. من ملحنا.. من جُرحنا', 'من كلّ شيء، وَاخرجُوا من مفردات الذاكره', 'أيّها المارّون بين الكلمات العابره!']]
P1_REF = 'محمود درويش - الأعمال الكاملة.'
P1_QP = ['أوّلا- البناء الفكري: (12 نقاط)', 'مَنِ المُخاطَب في النّص؟ وما مضمون ذلك الخطاب؟ وما الدّافع إليه؟', 'في النّص حقلان دلاليّان: الأوّل يتعلّق بالجلاد؛ والثاني بالضّحية. مثّل لكلّ حقلٍ منهما بأربعة ألفاظ من القصيدة.', 'بِم يوحي توظيف الشَّاعر الضمير «نحن» في النَّص؟', 'في النَّص نزعةٌ بارزةٌ، وضّحها مبيّنا علاقتها بظاهرة الالتزام، ومُستنبطًا مظهرين من مظاهر الالتزام من القصيدة.', 'واجه الشاعر أساليب القمع والاضطهاد المسلّطة على شعبه بنبرة التحدّي. وضّح ذلك من النّص.', 'حدّد النَّمط الغالب في النّص، ثم اذكر ثلاثة مؤشرات له مع التّمثيلِ من القصيدة.', 'ثانيا- البناء اللّغوي: (08 نقاط)', 'تنوّعت أساليب الإنشاء في النّص، استخرج أسلوبين مختلفين مبيّنا نوعيهما وغرضيهما،', 'في النّص مظاهر للاتساق، اذكر اثنين منها مع التمثيل.', 'أعرب لفظة «منكم» الواردة في السّطر الثاني من المقطع الأوّل، وكلمة «شعبًا» الواردة في السَّطر السادس من المقطع الثالث إعرابًا مفصَّلا.', 'بيّن المحل الإعرابيّ للجمل المحصورة بين قوسين في المقطع الثاني من النّص.', 'في العبارتين الآتيتين صورتان بيانيتان، اشرحهما مبيّنا نوعيهما ووجه بلاغتهما:', '«لا تمرُّوا بيننا كالحشرات الطائرهْ»', '- «ولنا قمح نُربيه»']


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
P1, P2 = QP[0], QP[7]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and len(QP) == 15 and [len(s) for s in P1_STANZAS] == [10, 8, 7, 15]
assert P1_STANZAS[0][1].startswith("منكم السيف") and P1_STANZAS[2][5].startswith("ولنا ما ليس فيكم")  # «السّطر الثّاني من المقطع الأوّل»، «السّطر السّادس من المقطع الثّالث»
D = [
    {"id": "d-title", "kind": "text", "caption": "عنوان النّصّ", "text": P1_TITLE},
    {"id": "d-st-1", "kind": "text", "caption": "المقطع الأوّل", "text": "\n".join(P1_STANZAS[0])},
    {"id": "d-st-2", "kind": "text", "caption": "المقطع الثّاني", "text": "\n".join(P1_STANZAS[1])},
    {"id": "d-st-3", "kind": "text", "caption": "المقطع الثّالث", "text": "\n".join(P1_STANZAS[2])},
    {"id": "d-st-4", "kind": "text", "caption": "المقطع الرّابع", "text": "\n".join(P1_STANZAS[3])},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P1_REF},
]

q("q1", "1", P1, J(1), 2, [el("q1-e1", "المخاطَب في النّصّ", 1), el("q1-e2", "مضمون الخطاب", 0.5), el("q1-e3", "الدّافع إليه", 0.5)], D)
q("q2", "2", P1, J(2), 2, [el("q2-e1", "أربعة ألفاظ لحقل الجلّاد (4×0.25)", 1), el("q2-e2", "أربعة ألفاظ لحقل الضّحيّة (4×0.25)", 1)], D)
q("q3", "3", P1, J(3), 2, [el("q3-e1", "إيحاء «نحن»: إثبات الذّات والحضور", 1),
                           el("q3-e2", "إيحاء «نحن»: الانتماء إلى الشّعب والإيمان بالقضيّة (الضّمير الجمعيّ)", 1)], D)
q("q4", "4", P1, J(4), 2, [el("q4-e1", "النّزعة البارزة", 0.5), el("q4-e2", "علاقتها بالالتزام", 0.5),
                           el("q4-e3", "مظهران من مظاهر الالتزام (2×0.5)", 1)], D)
q("q5", "5", P1, J(5), 1.5, [el("q5-e1", "أساليب القمع", 0.75), el("q5-e2", "عبارات التّحدّي (ثلاث)", 0.75)], D)
q("q6", "6", P1, J(6), 2.5, [el("q6-e1", "النّمط الغالب", 1), el("q6-e2", "المؤشّر الأوّل: النّداء مع التّمثيل (2×0.25)", 0.5),
                             el("q6-e3", "المؤشّر الثّاني: الأمر مع التّمثيل (2×0.25)", 0.5), el("q6-e4", "المؤشّر الثّالث: النّهي مع التّمثيل (2×0.25)", 0.5)], D)
q("q7", "1", P2, J(8), 1.5, [el("q7-e1", "أسلوبان إنشائيّان مختلفان: النّوع والغرض (2×0.75)", 1.5)], D)
q("q8", "2", P2, J(9), 1.5, [el("q8-e1", "مظهران من مظاهر الاتّساق مع التّمثيل (2×0.75)", 1.5)], D)
q("q9", "3", P2, J(10), 1.5, [el("q9-e1", "إعراب «مِن» في «منكم»", 0.25), el("q9-e2", "إعراب «كم» في «منكم»", 0.25),
                              el("q9-e3", "محلّ شبه الجملة «منكم»", 0.5), el("q9-e4", "إعراب «شعبًا»", 0.5)], D)
q("q10", "4", P2, J(11), 1.5, [el("q10-e1", "محلّ جملة (نعمل)", 0.5), el("q10-e2", "محلّ جملة (نربيه)", 0.5), el("q10-e3", "محلّ جملة (نسقيه)", 0.5)], D)
q("q11", "5", P2, J(12, 13, 14), 2,
  [el("q11-e1", "«لا تمرّوا بيننا كالحشرات الطّائرة»: الشّرح والنّوع (0.25+0.5)", 0.75), el("q11-e2", "«لا تمرّوا بيننا كالحشرات الطّائرة»: البلاغة", 0.25),
   el("q11-e3", "«ولنا قمح نربّيه»: الشّرح", 0.5), el("q11-e4", "«ولنا قمح نربّيه»: النّوع", 0.25), el("q11-e5", "«ولنا قمح نربّيه»: البلاغة", 0.25)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "مَن المخاطَب في قصيدة «عابرون في كلام عابر»؟",
   {"options": ["العدوّ الصّهيونيّ", "الشّعب الفلسطينيّ", "الشّعراء العرب", "الشّهداء"]},
   {"correct": 0}, "المخاطَب في النّصّ هو العدوّ الصّهيونيّ («أيّها المارّون بين الكلمات العابرة… منكم السّيف، ومنّا دمنا»).", 1, "ar.comprehension.details")
st("s02", "q1", "q1-e2", "mcq", "ما مضمون خطاب الشّاعر للعدوّ الصّهيونيّ؟",
   {"options": ["رفض المحتلّ، والإصرار على إخراجه من أرض فلسطين", "الدّعوة إلى التّعايش والسّلام مع المحتلّ",
                "استعطاف المحتلّ وطلب الرّحمة منه", "التّحسّر على ضياع الأرض واليأس من استرجاعها"]},
   {"correct": 0}, "مضمون ذلك الخطاب هو رفض المحتلّ، والإصرار على إخراجه من أرض فلسطين («آن أن تنصرفوا… فاخرجوا من أرضنا»).", 0.5, "ar.comprehension.idea")
st("s03", "q1", "q1-e3", "fill_blank", "أكمل الدّافع إلى هذا الخطاب:",
   {"text": "رغبة الشّاعر في ____ أرض فلسطين من المحتلّ الصّهيونيّ ليعيش شعبه ____ كريمًا فوق أرضه.", "bank": ["تطهير", "حرًّا", "تقسيم", "لاجئًا"]},
   {"blanks": [["تطهير"], ["حرًّا"]]}, "الدّافع إلى ذلك هو رغبة الشّاعر في تطهير أرض فلسطين من المحتلّ الصّهيونيّ ليعيش شعبه حرًّا كريمًا فوق أرضه.", 0.5, "ar.comprehension.purpose")
st("s04", "q2", "q2-e1", "multi", "اختر من القصيدة ألفاظًا تنتمي إلى حقل الجلّاد. (اختر كلّ ما يصحّ)",
   {"options": ["السّيف", "الفولاذ", "النّار", "الدّبّابة", "قنبلة الغاز", "دمنا", "الشّهداء", "جُرحنا"]},
   {"correct": [0, 1, 2, 3, 4]}, "حقل الجلّاد: (السّيف – الفولاذ – النّار – الدّبّابة – قنبلة الغاز…)؛ أمّا «دمنا، الشّهداء، الجرح» فمن حقل الضّحيّة. للمترشّح الحرّيّة في اختيار أربع مفردات.", 1, "ar.cohesion.effect")
st("s05", "q2", "q2-e2", "multi", "اختر من القصيدة ألفاظًا تنتمي إلى حقل الضّحيّة. (اختر كلّ ما يصحّ)",
   {"options": ["دمنا", "الشّهداء", "جُرحنا", "أجسادنا", "الفولاذ", "الدّبّابة", "قنبلة الغاز"]},
   {"correct": [0, 1, 2, 3]}, "حقل الضّحيّة: (دمنا – الشّهداء – الجرح – أجساد…)؛ أمّا «الفولاذ، الدّبّابة، قنبلة الغاز» فمن حقل الجلّاد. للمترشّح الحرّيّة في اختيار أربع مفردات.", 1, "ar.cohesion.effect")
st("s06", "q3", "q3-e1", "mcq", "في قوله: «فعلينا، نحن، أن نحرس ورد الشّهداء… وعلينا، نحن، أن نحيا كما نحن نشاء!» بمَ يوحي توظيف الضّمير «نحن»؟",
   {"options": ["بإثبات الذّات والحضور", "بالشّعور بالعجز والاستسلام", "بتمجيد الشّاعر لنفسه دون قومه", "بالتّردّد والحيرة"]},
   {"correct": 0}, "يوحي توظيف الشّاعر الضّمير «نحن» بإثبات الذّات والحضور، والتّعبير عن انتماء الشّاعر إلى شعبه.", 1, "ar.comprehension.explain")
st("s07", "q3", "q3-e2", "fill_blank", "أكمل ما يوحي به الضّمير «نحن» أيضًا:",
   {"text": "التّعبير عن ____ الشّاعر إلى شعبه، وإيمانه بقضيّته الوطنيّة العادلة باعتباره لسان قومه المعبّر عن حاله (التّعبير عن الضّمير ____).",
    "bank": ["انتماء", "الجمعيّ", "عداء", "الفرديّ"]},
   {"blanks": [["انتماء"], ["الجمعيّ"]]}, "«…والتّعبير عن انتماء الشّاعر إلى شعبه، وإيمانه بقضيّته الوطنيّة العادلة باعتباره لسان قومه المعبّر عن حاله (التّعبير عن الضّمير الجمعيّ)».", 1, "ar.comprehension.explain")
st("s08", "q4", "q4-e1", "mcq", "ما النّزعة البارزة في قصيدة محمود درويش؟",
   {"options": ["النّزعة الوطنيّة التّحرّريّة", "النّزعة الذّاتيّة الرّومانسيّة", "النّزعة الصّوفيّة", "النّزعة الانهزاميّة"]},
   {"correct": 0}, "النّزعة البارزة في النّصّ هي النّزعة الوطنيّة التّحرّريّة.", 0.5, "ar.literature.trend")
st("s09", "q4", "q4-e2", "mcq", "ما علاقة النّزعة الوطنيّة التّحرّريّة بظاهرة الالتزام؟",
   {"options": ["علاقة ترابط وثيق، فمن شروط الالتزام المساهمة في تحرير البلاد من قبضة المحتلّ وتسخير الأدب لهذه الغاية",
                "لا علاقة بينهما، فالالتزام يخصّ القضايا الاجتماعيّة وحدها", "علاقة تعارض، لأنّ الالتزام يفرض على الأديب الحياد",
                "علاقة شكليّة تقتصر على الوزن والقافية"]},
   {"correct": 0}, "علاقتها بالالتزام: هي علاقة ترابط وثيق، فمن شروط الالتزام المساهمة في تحرير البلاد من قبضة المحتلّ، وتسخير الأدب لهذه الغاية.", 0.5, "ar.literature.trend")
st("s10", "q4", "q4-e3", "multi", "أيّ ممّا يلي من مظاهر الالتزام في القصيدة؟ (اختر كلّ ما يصحّ)",
   {"options": ["تبنّي الشّاعر قضيّة وطنه", "الوقوف إلى جانب شعبه للتّعبير عن آلامه وآماله", "رفض الشّاعر الصّريح للمحتلّ",
                "سعيه إلى تغيير الواقع السّياسيّ لبلاده وتكريس شعره وسيلة لذلك", "تعبير الشّاعر عن الضّمير الجمعيّ لشعبه (نا، نحن)",
                "انعزال الشّاعر عن قضايا مجتمعه", "التّغنّي بجمال الطّبيعة هروبًا من الواقع"]},
   {"correct": [0, 1, 2, 3, 4]}, "من مظاهر الالتزام في النّصّ: تبنّي الشّاعر قضيّة وطنه، الوقوف إلى جانب شعبه للتّعبير عن آلامه وآماله، رفض الشّاعر الصّريح للمحتلّ، سعيه إلى تغيير الواقع السّياسيّ لبلاده وتكريس شعره وسيلة لذلك، تعبيره عن الضّمير الجمعيّ لشعبه (نا، نحن). يكتفي المترشّح باستخراج مظهرين.", 0.5, "ar.literature.trend")
st("s11", "q4", "q4-e3", "fill_blank", "أكمل مظهرين من مظاهر الالتزام في القصيدة:",
   {"text": "____ الشّاعر الصّريح للمحتلّ، و____ الشّاعر قضيّة وطنه.", "bank": ["رفض", "تبنّي", "مهادنة", "تجاهل"]},
   {"blanks": [["رفض"], ["تبنّي"]]}, "«رفض الشّاعر الصّريح للمحتلّ»، «تبنّي الشّاعر قضيّة وطنه» من مظاهر الالتزام في النّصّ.", 0.5, "ar.literature.trend", "b")
st("s12", "q5", "q5-e1", "mcq", "ما أساليب القمع الّتي سلّطها المحتلّ على الشّعب الفلسطينيّ كما تصوّرها القصيدة؟",
   {"options": ["استخدام كلّ أنواع الأسلحة", "الحصار الاقتصاديّ وحده", "النّفي إلى خارج الوطن", "الإغراء بالمال والمناصب"]},
   {"correct": 0}, "من أساليب القمع: استخدام كلّ أنواع الأسلحة (السّيف، النّار، الفولاذ…).", 0.25, "ar.comprehension.details")
st("s13", "q5", "q5-e1", "multi", "اختر من المقطع الأوّل ما يدلّ على أساليب القمع. (اختر كلّ ما يصحّ)",
   {"options": ["«منكم السّيف»", "«منكم الفولاذ والنّار»", "«منكم دبّابة أخرى»", "«منكم قنبلة الغاز»", "«ومنّا المطر»", "«ورد الشّهداء»"]},
   {"correct": [0, 1, 2, 3]}, "أساليب القمع: استخدام كلّ أنواع الأسلحة (السّيف، النّار، الفولاذ…) كما في «منكم السّيف… منكم الفولاذ والنّار… منكم دبّابة أخرى… منكم قنبلة الغاز»؛ أمّا «ومنّا المطر» و«ورد الشّهداء» فممّا ينسبه الشّاعر إلى شعبه.", 0.5, "ar.comprehension.evidence", "b")
st("s14", "q5", "q5-e2", "fill_blank", "أكمل عبارات التّحدّي الّتي واجه بها الشّاعر أساليب القمع:",
   {"text": "«أن نحيا كما نحن ____» – «منكم السّيف، ومنّا ____» – «ولنا الحاضر، والحاضر، و____».", "bank": ["نشاء", "دمنا", "المستقبل", "تشاؤون", "سيفنا", "الماضي"]},
   {"blanks": [["نشاء"], ["دمنا"], ["المستقبل"]]}, "عبارات التّحدّي: «أن نحيا كما نحن نشاء»، «منكم السّيف ومنّا دمنا»، «لنا الحاضر، والحاضر، والمستقبل»، «والدّنيا والآخرة». يكتفي المترشّح بذكر ثلاث عبارات.", 0.75, "ar.comprehension.evidence")
st("s15", "q6", "q6-e1", "mcq", "حدّد النّمط الغالب في قصيدة «عابرون في كلام عابر».",
   {"options": ["الأمريّ الإيعازيّ", "السّرديّ", "الوصفيّ", "التّفسيريّ"]},
   {"correct": 0}, "النّمط الغالب في النّصّ أمريّ إيعازيّ، ومؤشّراته: النّداء والأمر والنّهي.", 1, "ar.text.type")
st("s16", "q6", "q6-e2", "mcq", "من مؤشّرات النّمط الإيعازيّ في القصيدة «النّداء». ما مثاله؟",
   {"options": ["«أيّها المارّون…»", "«انصرفوا، خذوا، ادخلوا…»", "«لا تموتوا، لا تمرّوا بيننا…»", "«ولنا الماضي هنا»"]},
   {"correct": 0}, "مؤشّراته: النّداء: «أيّها المارّون…»؛ الأمر: «انصرفوا، خذوا، ادخلوا…»؛ النّهي: «لا تموتوا، لا تمرّوا بيننا…».", 0.5, "ar.text.type")
st("s17", "q6", "q6-e3", "fill_blank", "أكمل التّمثيل لمؤشّر «الأمر» من القصيدة:",
   {"text": "الأمر: ____، خذوا، ____…", "bank": ["انصرفوا", "ادخلوا", "لا تمرّوا", "أيّها المارّون"]},
   {"blanks": [["انصرفوا"], ["ادخلوا"]]}, "الأمر: «انصرفوا، خذوا، ادخلوا…»؛ أمّا «لا تمرّوا» فنهي، و«أيّها المارّون» نداء.", 0.5, "ar.text.type")
st("s18", "q6", "q6-e4", "mcq", "ومن مؤشّرات النّمط الإيعازيّ «النّهي». ما مثاله من القصيدة؟",
   {"options": ["«لا تموتوا، لا تمرّوا بيننا…»", "«أيّها المارّون…»", "«فاخرجوا من أرضنا»", "«كدّسوا أوهامكم في حفرة مهجورة»"]},
   {"correct": 0}, "النّهي: «لا تموتوا، لا تمرّوا بيننا…»؛ أمّا «فاخرجوا» و«كدّسوا» فأمر، و«أيّها المارّون» نداء.", 0.5, "ar.text.type")
# ── ثانيًا: البناء اللّغويّ ──
INSHA_EXPL = ("الأساليب الإنشائيّة الواردة في النّصّ: «أيّها المارّون بين…»: نداء غرضه التّهديد والوعيد؛ «خذوا حصّتكم وانصرفوا…»: أمر غرضه "
              "التّعبير عن الرّفض؛ «لا تقيموا بيننا»: نهي غرضه التّعبير عن التّذمّر والرّفض. يكتفي المترشّح بذكر أسلوبين.")
st("s19", "q7", "q7-e1", "matching", "طابق كلّ أسلوب إنشائيّ من القصيدة بنوعه وغرضه.",
   {"lefts": ["«أيّها المارّون بين الكلمات العابرة»", "«خذوا حصّتكم من دمنا، وانصرفوا»", "«لا تقيموا بيننا»"],
    "rights": ["نداء غرضه التّهديد والوعيد", "أمر غرضه التّعبير عن الرّفض", "نهي غرضه التّعبير عن التّذمّر والرّفض", "استفهام غرضه التّعجّب", "تمنٍّ غرضه التّحسّر"]},
   {"pairs": [0, 1, 2]}, INSHA_EXPL, 0.75, "ar.rhetoric.insha")
st("s20", "q7", "q7-e1", "mcq", "ما غرض النّداء في قوله: «أيّها المارّون بين الكلمات العابرة»؟",
   {"options": ["التّهديد والوعيد", "التّحبّب والتّودّد", "الاستغاثة", "النّدبة"]},
   {"correct": 0}, INSHA_EXPL, 0.75, "ar.rhetoric.insha", "b")
COH_EXPL = ("من مظاهر الاتّساق في النّصّ: حروف العطف مثل: «لنا في أرضنا ما نعمل.. ولنا قمح نربّيه»؛ الإحالة بالضّمير: «منكم السّيف..» (يعود على "
            "الصّهاينة)؛ حرف الاستدراك (لكن): «وتموتوا أينما شئتم ولكن لا تموتوا بيننا»؛ حرف التّشبيه: «…كالغبار المرّ». يكتفي المترشّح بذكر مظهرين فقط.")
st("s21", "q8", "q8-e1", "matching", "طابق كلّ مظهر من مظاهر الاتّساق بمثاله من القصيدة.",
   {"lefts": ["حروف العطف", "الإحالة بالضّمير", "حرف الاستدراك (لكن)", "حرف التّشبيه"],
    "rights": ["«لنا في أرضنا ما نعمل.. ولنا قمح نربّيه»", "«منكم السّيف..»", "«وتموتوا أينما شئتم ولكن لا تموتوا بيننا»", "«…كالغبار المرّ»"]},
   {"pairs": [0, 1, 2, 3]}, COH_EXPL, 1, "ar.cohesion.connectors")
st("s22", "q8", "q8-e1", "mcq", "على من يعود الضّمير في «منكم السّيف»؟",
   {"options": ["على الصّهاينة", "على الشّهداء", "على الشّعب الفلسطينيّ", "على الشّعراء"]},
   {"correct": 0}, "الإحالة بالضّمير: «منكم السّيف..» (يعود على الصّهاينة)، وهي من مظاهر الاتّساق في النّصّ.", 0.5, "ar.cohesion.reference", "b")
st("s23", "q9", "q9-e1", "mcq", "ما إعراب «مِن» في «منكم» (السّطر الثّاني من المقطع الأوّل)؟",
   {"options": ["حرف جرّ مبنيّ على السّكون لا محلّ له من الإعراب", "حرف جرّ مبنيّ على الفتح لا محلّ له من الإعراب",
                "اسم موصول مبنيّ على السّكون في محلّ رفع مبتدأ", "حرف عطف مبنيّ على السّكون لا محلّ له من الإعراب"]},
   {"correct": 0}, "من: حرف جرّ مبنيّ على السّكون لا محلّ له من الإعراب.", 0.25, "ar.grammar.irab")
st("s24", "q9", "q9-e2", "fill_blank", "أكمل إعراب «كم» في «منكم»:",
   {"text": "كم: ضمير متّصل مبنيّ على ____ في محلّ ____ اسم مجرور.", "bank": ["السّكون", "جرّ", "الضّمّ", "نصب"]},
   {"blanks": [["السّكون"], ["جرّ"]]}, "كم: ضمير متّصل مبنيّ على السّكون في محلّ جرّ اسم مجرور.", 0.25, "ar.grammar.irab")
st("s25", "q9", "q9-e3", "mcq", "ما محلّ شبه الجملة «منكم» في قوله: «منكم السّيف»؟",
   {"options": ["في محلّ رفع خبر مقدّم", "في محلّ نصب حال", "في محلّ رفع مبتدأ", "في محلّ جرّ نعت"]},
   {"correct": 0}, "وشبه الجملة «منكم» في محلّ رفع خبر مقدّم (والمبتدأ المؤخّر «السّيف»).", 0.5, "ar.grammar.irab")
st("s26", "q9", "q9-e4", "mcq", "ما إعراب «شعبًا» في قوله: «وطنٌ ينزف شعبًا ينزف» (السّطر السّادس من المقطع الثّالث)؟",
   {"options": ["تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "حال منصوبة وعلامة نصبها الفتحة الظّاهرة على آخرها",
                "مفعول لأجله منصوب وعلامة نصبه الفتحة الظّاهرة على آخره", "ظرف زمان منصوب وعلامة نصبه الفتحة الظّاهرة على آخره"]},
   {"correct": 0}, "شعبًا: تمييز منصوب وعلامة نصبه الفتحة الظّاهرة على آخره.", 0.5, "ar.grammar.irab")
st("s27", "q10", "q10-e1", "mcq", "ما المحلّ الإعرابيّ لجملة (نعمل) في قوله: «فلنا في أرضنا ما (نعمل)»؟",
   {"options": ["جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ نصب مفعول به"]},
   {"correct": 0}, "(نعمل): جملة صلة الموصول لا محلّ لها من الإعراب.", 0.5, "ar.grammar.sentence_case")
st("s28", "q10", "q10-e2", "mcq", "ما المحلّ الإعرابيّ لجملة (نربيه) في قوله: «ولنا قمحٌ (نربيه)»؟",
   {"options": ["جملة فعليّة في محلّ رفع نعت", "جملة فعليّة في محلّ نصب حال", "جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "(نربّيه): جملة فعليّة في محلّ رفع نعت (لـ«قمحٌ»).", 0.5, "ar.grammar.sentence_case")
st("s29", "q10", "q10-e3", "fill_blank", "أكمل المحلّ الإعرابيّ لجملة (نسقيه):",
   {"text": "(نسقيه): جملة فعليّة ____ على جملة (نربيه) في محلّ ____.", "bank": ["معطوفة", "رفع", "مستأنفة", "نصب"]},
   {"blanks": [["معطوفة"], ["رفع"]]}, "(نسقيه): جملة فعليّة معطوفة على جملة (نربّيه) في محلّ رفع.", 0.5, "ar.grammar.sentence_case")
st("s30", "q11", "q11-e1", "fill_blank", "اشرح الصّورة في «لا تمرّوا بيننا كالحشرات الطّائرة»:",
   {"text": "شبّه ____ المحتلّين بـ____ الطّائرة.", "bank": ["الصّهاينة", "الحشرات", "الشّهداء", "الطّيور"]},
   {"blanks": [["الصّهاينة"], ["الحشرات"]]}, "شبّه الصّهاينة المحتلّين بالحشرات الطّائرة، وهو تشبيه مرسل (السّلّم: 0.25+0.5 للشّرح والنّوع معًا).", 0.5, "ar.rhetoric.simile")
st("s31", "q11", "q11-e1", "mcq", "ما نوع الصّورة البيانيّة في «لا تمرّوا بيننا كالحشرات الطّائرة»؟",
   {"options": ["تشبيه مرسل", "تشبيه بليغ", "استعارة تصريحيّة", "استعارة مكنيّة"]},
   {"correct": 0}, "«…كالحشرات الطّائرة»: تشبيه مرسل (ذُكرت فيه الأداة: الكاف).", 0.25, "ar.rhetoric.simile", "b")
st("s32", "q11", "q11-e2", "mcq", "ما بلاغة التّشبيه في «لا تمرّوا بيننا كالحشرات الطّائرة»؟",
   {"options": ["توضيح المعنى وتقريبه من ذهن المتلقّي، لإظهار الاحتقار والسّخرية", "تقديم الحقيقة مصحوبة بدليلها",
                "إبراز تمسّك الشّاعر بأرضه", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "بلاغته: توضيح المعنى وتقريبه من ذهن المتلقّي، لإظهار الاحتقار والسّخرية.", 0.25, "ar.rhetoric.effect")
st("s33", "q11", "q11-e3", "matching", "اشرح الصّورة في «ولنا قمحٌ نربّيه»: طابق كلّ ركن بما يقابله.",
   {"lefts": ["المشبّه (المذكور)", "المشبّه به (المحذوف)", "ما يدلّ على المشبّه به"], "rights": ["القمح", "الصّبيّ الّذي يُربّى", "الفعل «نربّيه»", "النّدى", "الأجساد"]},
   {"pairs": [0, 1, 2]}, "شبّه القمح بالصّبيّ الّذي يُربّى، فذكر المشبّه (القمح)، وحذف المشبّه به (الصّبيّ) وذكر ما يدلّ عليه «نربّيه».", 0.5, "ar.rhetoric.metaphor")
st("s34", "q11", "q11-e4", "mcq", "ما نوع الصّورة البيانيّة في «ولنا قمحٌ نربّيه»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "كناية عن صفة"]},
   {"correct": 0}, "حُذف المشبّه به (الصّبيّ) وذُكر ما يدلّ عليه «نربّيه»، فهي استعارة مكنيّة.", 0.25, "ar.rhetoric.metaphor")
st("s35", "q11", "q11-e5", "mcq", "ما بلاغة الاستعارة في «ولنا قمحٌ نربّيه»؟",
   {"options": ["تقريب المعنى وإبراز مدى تمسّك الشّاعر بأرضه", "إظهار الاحتقار والسّخرية من المحتلّ", "الإيجاز بحذف الأداة ووجه الشّبه", "إحداث جرس موسيقيّ تطرب له الأذن"]},
   {"correct": 0}, "بلاغتها: تقريب المعنى وإبراز مدى تمسّك الشّاعر بأرضه.", 0.25, "ar.rhetoric.effect")

TITLE = "بكالوريا 2012 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الأوّل (محمود درويش: «عابرون في كلام عابر»)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2012، شعب علوم تجريبيّة ورياضيات وتقني رياضي وتسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx (والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID})، مقابَلًا سطرًا سطرًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} "
         "(01_الموضوع.pdf، ص1–2). أُصلح من الموضوع الرّسميّ خطأ واحد في docx: «أو الى توقيت الموسيقى المسدَّس» ← «…توقيت موسيقى المسدَّس» (المقطع 3، السّطر 4)؛ "
         "وأُبقيت فروق الشّكل والإملاء كما في docx («فَخْذُوا»، «الطائرة/العابرة/للذاكرة/والآخرَةٌ» والرّسميّ بالهاء السّاكنة، «12 نقاط»). الشّعب من رأس الموضوع الرّسميّ "
         "(رأس docx: «علوم تجريبية» فقط). العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ممسوح، ص1–2، مقروء بدقّة 150 نقطة). المجموع 20 = بناء فكريّ 12 + "
         "بناء لغويّ 8 (لا تقويم نقديّ في هذه الورقة). س2: «4×0,25» لكلّ حقل (للمترشّح حرّيّة الاختيار) فعنصر لكلّ حقل؛ س6: مؤشّرات النّمط «6×0,25» ثلاثة "
         "بأعيانها (النّداء، الأمر، النّهي) مع التّمثيل فعنصر لكلّ مؤشّر؛ الصّورة الأولى «0.25+0.5» على سطر واحد للشّرح والنّوع دون تحديد فبقيا عنصرًا واحدًا (0.75). "
         "لا شيء مؤجَّل: كلّ العناصر ذات إجابة مغلقة في التّصحيح.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write("ar-bac-2012-sci-p1", 1, TITLE, NOTES, LOG_NOTE)
