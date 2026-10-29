"""Conversion: BAC 2012 (session عاديّة، جوان 2012) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (توفيق الحكيم، من «فنّ الأدب»).
Exam (most faithful source): gdrive 1_BtZ00lmDpZWYdzKmmD4MAVXzUxSLLFm (بكالوريا 2012 العربية شعبة علوم تجريبية.docx);
same paper as PDF (owner's retyped copy, exported from the docx): gdrive 1HS2w9tb9vFIaxZGn6pLSkXfkLWJhvT06 (BAC 2012 - اللغة العربية - الشعب العلمية.pdf);
official ONEC paper: gdrive 1i-lgxTZJfo0pdzF2QF_IKUOv2S-rPg5K (01_الموضوع.pdf, pages 3–4, scanned — used to check the docx);
official mark scheme (ONEC «الإجابة النّموذجيّة وسلّم التّنقيط»): gdrive 1QhQBWwWPG7h5YVFnMUqfE0Qxdm9WvbH0 (02_التصحيح.pdf, pages 3–4).

Method (as build_ar_bac_2016_lit_p1.py / build_ar_bac_2018_lit_p1.py): the verbatim strings below (text, reference, question
texts) were generated from the .docx with python-docx (runs read exactly, tatweel kept; only outer whitespace and outer
direction marks trimmed; the docx splits the second paragraph of the text over two paragraphs — joined with a space, as on
the ONEC paper) and every verbatim string of the JSON was re-checked programmatically against the docx. The docx was compared
with the official ONEC paper (rendered at 130–200 dpi): same text and questions; differences are diacritics/spelling only
(«فتُسكِبَ» ONEC «فتَسْكِبَ», «(12 نقاط)» ONEC «نقطة») and are kept as in the docx. The correction is a scanned PDF, read
from the rendered pages (150 dpi, fully legible). Every mark comes from the official scheme; correct options and
explanations condense its wording.

Conversion notes / points for the owner's review:
- Streams: ONEC paper header «علوم تجريبية، رياضيات، تقني رياضي، تسيير واقتصاد» ⇒ SCI, MATH, TM, GE (docx header: «علوم تجريبية»).
- No part «التّقويم النّقديّ»: البناء الفكريّ 12 + البناء اللّغويّ 8.
- Rule for «n×m» lines: interchangeable items (more listed than required) ⇒ one element; exactly the required distinct
  items, or the distinct demands of the question ⇒ one element per item.
- Q1 «2×1» = the issue + its purpose. Q2: 01 the prevailing concept + «2×0.5» = the writer's opinion (he disagrees) + its
  clarification. Q3 «01.5»: «تترك للمترشّح حرّيّة إبداء الرّأي على أن يُعلّل ما ذهب إليه» ⇒ deferred essay_builder (rule 11).
  Q4 «6×0.25» three means among four listed, each with its example ⇒ one element of 1.5. Q5: 0.5 the genre (المقال) +
  0.5 its definition + «2×0.5» two features among four ⇒ one element of 1. Q6 (تلخيص) «3×01» = تقنية التّلخيص / دلالة
  المضمون / سلامة اللّغة ⇒ three deferred essay_builder elements.
- Part 2 Q1: 0.25 meaning + 0.5 parsing for each «إذا» (one line each). Q3 0.75 per sentence. Q4 image 1: 0.5 / 0.5 / 0.25
  (explanation / type «فهي استعارة مكنيّة» / effect, one line each); image 2: «2×0.5» = explanation + type (the scheme:
  «شبّه الفنّ بالثّوب الجديد، فذكر المشبّه به وحذف الأداة فهو تشبيه بليغ»), 0.25 effect. Q5: 0.5 the type + «2×0.75» two
  indicators among five ⇒ one element of 1.5.
- Distractors avoid what the scheme or usage could accept: «الحجاجيّ» is not a distractor of «التّفسيريّ» (the text argues);
  «نعت / عطف بيان» are not distractors of «الأشعّة» (بدل); «الحوار» is not a distractor among the means of persuasion (the text
  uses a fictive question «وقد تسألني…»); the parsing of «إذا» الفجائيّة as a ظرف (a minority view) is not offered.
- Deferred: Q3 opinion 1.5 + summary 3 = 4.5 points.
"""
import json, pathlib, re, sys, unicodedata

OUT = sys.argv[1]  # then run ONCE: python3 scripts/play/shuffle_exam_set.py <OUT>

DOCX_ID = "1_BtZ00lmDpZWYdzKmmD4MAVXzUxSLLFm"
DOCX_TITLE = "بكالوريا 2012 العربية شعبة علوم تجريبية.docx"
PDF_ID = "1HS2w9tb9vFIaxZGn6pLSkXfkLWJhvT06"
OFFICIAL_ID = "1i-lgxTZJfo0pdzF2QF_IKUOv2S-rPg5K"
CORR_ID = "1QhQBWwWPG7h5YVFnMUqfE0Qxdm9WvbH0"
SOURCE_STREAMS = ["SCI", "MATH", "TM", "GE"]

# ── الموضوع الثّاني (مولَّد من docx) ──
P2_PARAS = ['«... ليس الابتكار في الأدب والفنّ أن تطرق موضوعا لم يسبقك إليه سابقٌ، ولا أن تعثر على فكرة لم تخطر على بال غيرك ... إنما الابتكار الأدبيّ والفنّي، هو أن تتناول الفكرة التي قد تكون مألوفة للناس، فتُسكِبَ فيها من أدبك وفنّك ما يجعلها تنقلب خَلْقًا جديدا يُبْهرُ العين ويُدهش العقل... أو أن تعالج الموضوع الذي كاد يبلى بين أصابع السّابقين، فإذا هو يُضيءُ بين يديك، بروح من عندك..', 'وإذا تأملنا أغلب آيات الفن، فإنّنا نجد موضوعاتها منقولة عن موضوعات سابقة موجودة، فالكثير من موضوعات «شكسبير» نقل عن «بوكاشيو» وبعض «موليير» عن «سكارون»... فإذا عرّجنا على الأدب العربيّ القديم، فإننا نجد في الشعر معنى البيت الواحد وموضوعه، يتنقلان من شاعر إلى شاعر، ويلبسان في كل زمن حلة وصياغة، حتى اختلف النقاد والباحثون والأدباء فيمن يفضلون: أهو أوّل من طرق الفكرة والموضوع أم من صاغهما وأجراهما على الألسن وأتاح لهما الذيُوع؟... على أنّ أرجح الرّأي هو أن الموضوع في الفن ليس بذي خطر، وليست الحوادث والوقائع في القصص والشعر والتمثيل بذات قيمة، ولكن القيمة والخطر في تلك الأشعة الجديدة التي يستطيع الفنّان أن يستخرجها من هيكل تلك الموضوعات والحوادث والوقائع.', 'إن الفنَّ ليس في الهيكل، إنّه في الثّوب، والفنّ هو الثّوبُ الجديد الذي (يلبسه الفنّان) للهيكل القديم...', 'فالابتكار إذن لا شأن له بفكرة جديدة أو قديمة، غريبة أو مألوفة، ولا بالموضوع الطّريف أو المطروق... وقد تسألني بعدئذٍ: ما هو الابتكار الفنّي؟ فأقول لك بسرعة وبساطة: (هو أن تكون أنت)، وهو أن تحقّق نفسك، هو أن تُسمعنا صوتك أنت، ونبرتك أنت...»']
P2_REF = 'توفيق الحكيم «فن الأدب» [بتصرّف].'
P2_QP = ['أوّلا- البناء الفكري: (12 نقاط)', 'ما القضية التي يعالجها الكاتب في نصّه؟ وما الغرض من ذلك؟', 'ما المفهومُ السائد للابتكار في الأدب والفن؟ وما رأي الكاتب فيه؟ وضّح.', 'هل تؤيد رأي الكاتب؟ لماذا؟', 'وظف الكاتب \u200f- للدفاع عن رأيه \u200f- جملةً من وسائل الإقناع. أذكر ثلاثاً منها، ثم مثّل لها من النص.', 'ضمن أي فن نثري تُصنف هذا النّص؟ عرفه بإيجاز ثم اذكر خاصيتين له.', 'لخّص مضمون النّص.', 'ثانيا- البناء اللّغوي: (08 نقاط)', 'تكرَّرت «إذَا» في النّص بمعنيين مختلفين، بيّن معنى وإعراب كلّ منهما.', 'أعرب كلمة «الأشعّة» في قول الكاتب «في تلك الأشعة الجديدة».', 'بين المحل الإعرابيّ للجملتين المحصورتين بين قوسين.', 'في العبارتين الآتيتين صورتان بيانيّتان، اشرحهما مبيّنا نوعيهما ووجه بلاغتهما:', '«أن تعالج الموضوع الذي كاد يبلى بين أصابع السَّابقين»', '«الفنّ هو الثوب الجديد»', 'ما النمط الغالب على النّص؟ علّل حكمك بمؤشرين اثنين.']


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
P1, P2 = QP[0], QP[7]
assert P1.startswith("أوّلا") and P2.startswith("ثانيا") and len(QP) == 15 and len(P2_PARAS) == 4
D = [
    {"id": "d-text", "kind": "text", "caption": "النّصّ", "text": "\n".join(P2_PARAS)},
    {"id": "d-ref", "kind": "text", "caption": "توثيق النّصّ", "text": P2_REF},
]

q("q1", "1", P1, J(1), 2, [el("q1-e1", "القضيّة الّتي يعالجها الكاتب", 1), el("q1-e2", "الغرض من ذلك", 1)], D)
q("q2", "2", P1, J(2), 2, [el("q2-e1", "المفهوم السّائد للابتكار", 1), el("q2-e2", "رأي الكاتب فيه", 0.5), el("q2-e3", "توضيح رأي الكاتب", 0.5)], D)
q("q3", "3", P1, J(3), 1.5, [el("q3-e1", "إبداء الرّأي مع التّعليل", 1.5)], D)
q("q4", "4", P1, J(4), 1.5, [el("q4-e1", "ثلاث وسائل إقناع مع التّمثيل (6×0.25)", 1.5)], D)
q("q5", "5", P1, J(5), 2, [el("q5-e1", "الفنّ النّثريّ", 0.5), el("q5-e2", "تعريفه", 0.5), el("q5-e3", "خاصّيّتان له (2×0.5)", 1)], D)
q("q6", "6", P1, J(6), 3, [el("q6-e1", "التّلخيص: تقنية التّلخيص", 1), el("q6-e2", "التّلخيص: دلالة المضمون", 1), el("q6-e3", "التّلخيص: سلامة اللّغة", 1)], D)
q("q7", "1", P2, J(8), 1.5, [el("q7-e1", "«إذا» في «وإذا تأمّلنا / فإذا عرّجنا»: المعنى", 0.25), el("q7-e2", "«إذا» في «وإذا تأمّلنا / فإذا عرّجنا»: الإعراب", 0.5),
                             el("q7-e3", "«إذا» في «فإذا هو يضيء»: المعنى", 0.25), el("q7-e4", "«إذا» في «فإذا هو يضيء»: الإعراب", 0.5)], D)
q("q8", "2", P2, J(9), 0.5, [el("q8-e1", "إعراب «الأشعّة»", 0.5)], D)
q("q9", "3", P2, J(10), 1.5, [el("q9-e1", "محلّ جملة (يلبسه الفنّان)", 0.75), el("q9-e2", "محلّ جملة (هو أن تكون أنت)", 0.75)], D)
q("q10", "4", P2, J(11, 12, 13), 2.5,
  [el("q10-e1", "«الموضوع الّذي كاد يبلى»: الشّرح", 0.5), el("q10-e2", "«الموضوع الّذي كاد يبلى»: النّوع", 0.5), el("q10-e3", "«الموضوع الّذي كاد يبلى»: البلاغة", 0.25),
   el("q10-e4", "«الفنّ هو الثّوب الجديد»: الشّرح", 0.5), el("q10-e5", "«الفنّ هو الثّوب الجديد»: النّوع", 0.5), el("q10-e6", "«الفنّ هو الثّوب الجديد»: البلاغة", 0.25)], D)
q("q11", "5", P2, J(14), 2, [el("q11-e1", "النّمط الغالب", 0.5), el("q11-e2", "مؤشّران (2×0.75)", 1.5)], D)

# ── أوّلًا: البناء الفكريّ ──
st("s01", "q1", "q1-e1", "mcq", "ما القضيّة الّتي يعالجها توفيق الحكيم في نصّه؟",
   {"options": ["قضيّة الإبداع والابتكار في الأدب والفنّ", "قضيّة السّرقات الأدبيّة ومعاقبة مرتكبيها",
                "قضيّة الصّراع بين القديم والجديد في الحياة الاجتماعيّة", "قضيّة ترجمة الآداب الأجنبيّة إلى العربيّة"]},
   {"correct": 0}, "يعالج الكاتب قضيّة الإبداع والابتكار في الأدب والفنّ.", 1, "ar.comprehension.idea")
st("s02", "q1", "q1-e2", "mcq", "ما الغرض من معالجة قضيّة الابتكار في هذا النّصّ؟",
   {"options": ["إبراز حقيقة الإبداع في مجال الأدب والفنّ، وتصحيح بعض المفاهيم السّائدة لدى بعض الأدباء ورجال الفنّ",
                "الدّعوة إلى تقليد الأدباء الغربيّين في موضوعاتهم", "التّقليل من شأن الأدب العربيّ القديم",
                "الدّعوة إلى البحث عن موضوعات لم يسبق إليها أحد"]},
   {"correct": 0}, "أمّا الغرض منها فهو إبراز حقيقة الإبداع في مجال الأدب والفنّ، وتصحيح بعض المفاهيم السّائدة لدى بعض الأدباء ورجال الفنّ.", 0.5, "ar.comprehension.purpose")
st("s03", "q1", "q1-e2", "fill_blank", "أكمل الغرض من معالجة القضيّة:",
   {"text": "إبراز ____ الإبداع في مجال الأدب والفنّ، و____ بعض المفاهيم السّائدة لدى بعض الأدباء ورجال الفنّ.", "bank": ["حقيقة", "تصحيح", "زيف", "ترسيخ"]},
   {"blanks": [["حقيقة"], ["تصحيح"]]}, "«إبراز حقيقة الإبداع في مجال الأدب والفنّ، وتصحيح بعض المفاهيم السّائدة لدى بعض الأدباء ورجال الفنّ».", 0.5, "ar.comprehension.purpose", "b")
st("s04", "q2", "q2-e1", "mcq", "ما المفهوم السّائد للابتكار في الأدب والفنّ؟",
   {"options": ["التّطرّق للمواضيع الجديدة الّتي لم يتناولها السّابقون", "تناول الفكرة المألوفة بأسلوب مستمدّ من روح الكاتب",
                "محاكاة القدماء في موضوعاتهم وأساليبهم", "ترجمة روائع الأدب العالميّ"]},
   {"correct": 0}, "المفهوم السّائد للابتكار هو التّطرّق للمواضيع الجديدة أي الّتي لم يتناولها السّابقون («أن تطرق موضوعًا لم يسبقك إليه سابق»)؛ أمّا تناول الفكرة المألوفة بأسلوب الكاتب فهو رأي الكاتب نفسه.", 1, "ar.comprehension.details")
st("s05", "q2", "q2-e2", "mcq", "ما رأي الكاتب في هذا المفهوم السّائد؟",
   {"options": ["لا يوافقه", "يوافقه تمامًا", "يوافقه في الأدب دون الفنّ", "لا يبدي فيه رأيًا"]},
   {"correct": 0}, "رأي الكاتب: لا يوافق ذلك («ليس الابتكار في الأدب والفنّ أن تطرق موضوعًا لم يسبقك إليه سابق…»).", 0.5, "ar.comprehension.details")
st("s06", "q2", "q2-e3", "fill_blank", "أكمل توضيح رأي الكاتب:",
   {"text": "يرى أنّ الابتكار الحقّ هو ____ الجديد الّذي يُلبسه الفنّان ____ القديم.", "bank": ["الثّوب", "الهيكل", "الصّدى", "الظّلّ"]},
   {"blanks": [["الثّوب"], ["الهيكل"]]}, "حيث يرى أنّ الابتكار الحقّ هو الثّوب الجديد الّذي يُلبسه الفنّان الهيكل القديم، أو هو تناول لفكرة مألوفة بأسلوب مستمدّ من روح الكاتب «فتسكب فيها من أدبك وفنّك ما يجعلها تنقلب خلقًا جديدًا».", 0.5, "ar.comprehension.explain")
essay("s07", "q3", "q3-e1", "إبداء الرّأي في رأي الكاتب (هل تؤيّده؟ لماذا؟)", "الرّأي المعلّل",
      "تترك للمترشّح حرّيّة إبداء الرّأي على أن يُعلّل ما ذهب إليه", 1.5,
      {"task": "إبداء الرّأي مع التّعليل", "question": QP[3]},
      "تترك للمترشّح حرّيّة إبداء الرّأي على أن يُعلّل ما ذهب إليه (01.5).", "ar.comprehension.opinion")
PERS_EXPL = ("من وسائل الإقناع في النّصّ: التّمثيل والاستشهاد (شكسبير وبوكاشيو)؛ أساليب التّوكيد (فإنّنا نجد.. أنّ أرجح الرّأي.. إنّما الابتكار..)؛ "
             "توظيف النّفي (ليس الابتكار، لم تخطر..)؛ الإحالة بضمير المخاطب (أن تكون أنت..). يكتفي المترشّح بذكر ثلاث وسائل فقط.")
st("s08", "q4", "q4-e1", "multi", "أيّ ممّا يلي من وسائل الإقناع الّتي وظّفها الكاتب للدّفاع عن رأيه؟ (اختر كلّ ما يصحّ)",
   {"options": ["التّمثيل والاستشهاد", "أساليب التّوكيد", "توظيف النّفي", "الإحالة بضمير المخاطب", "الإحصاءات والأرقام", "الاستشهاد بالآيات القرآنيّة"]},
   {"correct": [0, 1, 2, 3]}, PERS_EXPL + " أمّا الإحصاءات والآيات القرآنيّة فلا وجود لها في النّصّ.", 0.75, "ar.text.type")
st("s09", "q4", "q4-e1", "matching", "طابق كلّ وسيلة إقناع بمثالها من النّصّ.",
   {"lefts": ["التّمثيل والاستشهاد", "أساليب التّوكيد", "توظيف النّفي", "الإحالة بضمير المخاطب"],
    "rights": ["(شكسبير وبوكاشيو)", "(فإنّنا نجد.. أنّ أرجح الرّأي.. إنّما الابتكار..)", "(ليس الابتكار، لم تخطر..)", "(أن تكون أنت..)", "(يُبهر العين ويُدهش العقل)"]},
   {"pairs": [0, 1, 2, 3]}, PERS_EXPL, 0.75, "ar.comprehension.evidence", "b")
st("s10", "q5", "q5-e1", "mcq", "ضمن أيّ فنّ نثريّ يُصنّف نصّ توفيق الحكيم؟",
   {"options": ["المقال (مقال نقديّ)", "القصّة القصيرة", "الخطابة", "المقامة"]},
   {"correct": 0}, "الفنّ النّثريّ الّذي ينتمي إليه النّصّ هو المقال، وهو مقال نقديّ.", 0.5, "ar.literature.prose")
st("s11", "q5", "q5-e2", "mcq", "عرّف المقال بإيجاز.",
   {"options": ["بحث قصير يتناول موضوعًا ما في مجال من مجالات الحياة", "حكاية نثريّة قصيرة تدور حول حدث واحد وشخصيّات قليلة",
                "فنّ مخاطبة الجماهير لإقناعها واستمالتها", "حكاية مسجوعة يرويها راوٍ عن بطل متخيّل"]},
   {"correct": 0}, "تعريفه: هو عبارة عن بحث قصير يتناول موضوعًا ما في مجال من مجالات الحياة.", 0.5, "ar.literature.prose")
st("s12", "q5", "q5-e3", "multi", "أيّ ممّا يلي من خصائص المقال؟ (اختر كلّ ما يصحّ)",
   {"options": ["المنهجيّة (المقدّمة والعرض والخاتمة)", "وحدة الفكرة أو الموضوع", "اعتماد وسائل الإقناع", "الأسلوب الواضح المركّز والمباشر",
                "الحبكة والعقدة والحلّ", "الالتزام بالوزن والقافية"]},
   {"correct": [0, 1, 2, 3]}, "بعض خصائص المقال: المنهجيّة (المقدّمة والعرض والخاتمة)، وحدة الفكرة أو الموضوع، اعتماد وسائل الإقناع، الأسلوب الواضح المركّز والمباشر. يكتفي المترشّح بذكر خاصّيّتين فقط. أمّا الحبكة فمن خصائص القصّة، والوزن والقافية من خصائص الشّعر.", 1, "ar.literature.features")
SUM_SPEC = {"task": "تلخيص مضمون النّصّ", "text": "نصّ توفيق الحكيم من «فنّ الأدب» (بكالوريا 2012، الشّعب العلميّة، الموضوع الثّاني)"}
SUM_EXPL = "التّلخيص: يُراعى فيه: تقنية التّلخيص، دلالة المضمون، سلامة اللّغة (3×01). لا يقدّم التّصحيح ملخّصًا نموذجيًّا."
for sid, eid, crit in [("s13", "q6-e1", "تقنية التّلخيص"), ("s14", "q6-e2", "دلالة المضمون"), ("s15", "q6-e3", "سلامة اللّغة")]:
    essay(sid, "q6", eid, "تلخيص نصّ توفيق الحكيم في الابتكار", crit, crit, 1, SUM_SPEC, SUM_EXPL, "ar.writing.summary")
# ── ثانيًا: البناء اللّغويّ ──
st("s16", "q7", "q7-e1", "mcq", "ما معنى «إذا» في قوله: «وإذا تأمّلنا أغلب آيات الفنّ» وقوله: «فإذا عرّجنا على الأدب العربيّ القديم»؟",
   {"options": ["الظّرفيّة الزّمانيّة المتضمّنة معنى الشّرط", "المفاجأة", "التّعليل", "الاستفهام"]},
   {"correct": 0}, "وردت «إذا» بمعنى الظّرفيّة الزّمانيّة المتضمّنة معنى الشّرط في قول الكاتب: «إذا تأمّلنا…» ثمّ في قوله: «إذا عرّجنا…».", 0.25, "ar.grammar.conditional")
st("s17", "q7", "q7-e2", "fill_blank", "أكمل إعراب «إذا» في قوله: «وإذا تأمّلنا أغلب آيات الفنّ»:",
   {"text": "إذا: ظرف مبنيّ على ____ في محلّ نصب ____، وهو مضاف.", "bank": ["السّكون", "مفعول فيه", "الفتح", "مفعول به"]},
   {"blanks": [["السّكون"], ["مفعول فيه"]]}, "إعرابها: مبنيّة على السّكون في محلّ نصب مفعول فيه، وهي مضاف.", 0.5, "ar.grammar.irab")
st("s18", "q7", "q7-e3", "mcq", "ما معنى «إذا» في قوله: «فإذا هو يُضيء بين يديك»؟",
   {"options": ["الفجائيّة", "الظّرفيّة الزّمانيّة المتضمّنة معنى الشّرط", "التّعليل", "الاستفهام"]},
   {"correct": 0}, "وردت «إذا» بمعنى الفجائيّة في قوله: «فإذا هو يُضيء بين يديك…».", 0.25, "ar.grammar.conditional")
st("s19", "q7", "q7-e4", "mcq", "ما إعراب «إذا» في قوله: «فإذا هو يُضيء بين يديك»؟",
   {"options": ["فجائيّة، حرف مبنيّ على السّكون، لا محلّ له من الإعراب", "ظرف لما يُستقبل من الزّمان متضمّن معنى الشّرط، في محلّ نصب مفعول فيه",
                "اسم شرط جازم مبنيّ على السّكون في محلّ نصب", "حرف عطف مبنيّ على السّكون لا محلّ له من الإعراب"]},
   {"correct": 0}, "إعرابها: فجائيّة، حرف مبنيّ على السّكون، لا محلّ له من الإعراب.", 0.5, "ar.grammar.irab")
st("s20", "q8", "q8-e1", "mcq", "ما إعراب كلمة «الأشعّة» في قول الكاتب: «في تلك الأشعّة الجديدة»؟",
   {"options": ["بدل من اسم الإشارة مجرور وعلامة جرّه الكسرة الظّاهرة", "اسم مجرور بحرف الجرّ «في» وعلامة جرّه الكسرة الظّاهرة",
                "مضاف إليه مجرور وعلامة جرّه الكسرة الظّاهرة", "مبتدأ مؤخّر مرفوع وعلامة رفعه الضّمّة الظّاهرة"]},
   {"correct": 0}, "الأشعّةِ: بدل من اسم الإشارة (تلك) مجرور وعلامة جرّه الكسرة الظّاهرة.", 0.5, "ar.grammar.badal")
st("s21", "q9", "q9-e1", "mcq", "ما المحلّ الإعرابيّ لجملة (يلبسه الفنّان) في قوله: «والفنّ هو الثّوب الجديد الّذي (يلبسه الفنّان) للهيكل القديم»؟",
   {"options": ["جملة صلة الموصول لا محلّ لها من الإعراب", "جملة فعليّة في محلّ رفع نعت", "جملة فعليّة في محلّ نصب حال", "جملة فعليّة في محلّ رفع خبر"]},
   {"correct": 0}, "«يلبسه الفنّان..»: جملة صلة الموصول (الّذي) لا محلّ لها من الإعراب.", 0.75, "ar.grammar.sentence_case")
st("s22", "q9", "q9-e2", "mcq", "ما المحلّ الإعرابيّ لجملة (هو أن تكون أنت) في قوله: «فأقول لك بسرعة وبساطة: (هو أن تكون أنت)»؟",
   {"options": ["جملة مقول القول في محلّ نصب مفعول به", "جملة اسميّة في محلّ رفع خبر", "جملة اسميّة في محلّ نصب حال", "جملة جواب شرط لا محلّ لها من الإعراب"]},
   {"correct": 0}, "«هو أن تكون أنت..»: جملة مقول القول في محلّ نصب مفعول به.", 0.75, "ar.grammar.sentence_case")
st("s23", "q10", "q10-e1", "fill_blank", "اشرح الصّورة في «أن تعالج الموضوع الّذي كاد يبلى بين أصابع السّابقين»:",
   {"text": "شبّه ____ بشيء ماديّ يبلى كـ____، ذكر المشبّه وحذف المشبّه به وكنى عنه بقرينة لفظيّة «يبلى».", "bank": ["الموضوع", "الثّوب", "الفنّان", "الذّهب"]},
   {"blanks": [["الموضوع"], ["الثّوب"]]}, "«الموضوع الّذي كاد يبلى…»: شبّه الموضوع بشيء ماديّ يبلى كالثّوب. ذكر المشبّه وحذف المشبّه به (الثّوب) وكنى عنه بقرينة لفظيّة «يبلى».", 0.5, "ar.rhetoric.metaphor")
st("s24", "q10", "q10-e2", "mcq", "ما نوع الصّورة البيانيّة في «الموضوع الّذي كاد يبلى بين أصابع السّابقين»؟",
   {"options": ["استعارة مكنيّة", "استعارة تصريحيّة", "تشبيه بليغ", "تشبيه مرسل"]},
   {"correct": 0}, "حُذف المشبّه به (الثّوب) وكُني عنه بقرينة لفظيّة «يبلى»، فهي استعارة مكنيّة.", 0.5, "ar.rhetoric.metaphor")
st("s25", "q10", "q10-e3", "mcq", "ما بلاغة الاستعارة في «الموضوع الّذي كاد يبلى»؟",
   {"options": ["تجسيد المعنى في قالب حسّيّ", "توضيح المعنى بإيهام التّطابق بين طرفين مذكورين", "تقديم الحقيقة مصحوبة بدليلها", "تحسين الكلام بالجرس الموسيقيّ"]},
   {"correct": 0}, "بلاغتها: تجسيد المعنى في قالب حسّيّ.", 0.25, "ar.rhetoric.effect")
st("s26", "q10", "q10-e4", "matching", "اشرح الصّورة في «الفنّ هو الثّوب الجديد»: طابق كلّ عنصر بما يقابله.",
   {"lefts": ["المشبّه", "المشبّه به", "المحذوف من أركان التّشبيه"], "rights": ["الفنّ", "الثّوب الجديد", "الأداة", "الهيكل القديم"]},
   {"pairs": [0, 1, 2]}, "«الفنّ هو الثّوب الجديد..»: شبّه الفنّ بالثّوب الجديد، فذكر المشبّه به وحذف الأداة فهو تشبيه بليغ.", 0.5, "ar.rhetoric.simile")
st("s27", "q10", "q10-e5", "mcq", "ما نوع الصّورة البيانيّة في «الفنّ هو الثّوب الجديد»؟",
   {"options": ["تشبيه بليغ", "تشبيه مرسل", "استعارة تصريحيّة", "استعارة مكنيّة"]},
   {"correct": 0}, "حُذفت الأداة فهو تشبيه بليغ.", 0.5, "ar.rhetoric.simile")
st("s28", "q10", "q10-e6", "mcq", "ما بلاغة التّشبيه في «الفنّ هو الثّوب الجديد»؟",
   {"options": ["توضيح المعنى وتقريبه من ذهن المتلقّي", "تجسيد المعنويّ بحذف المشبّه به والإبقاء على لازمه", "الإتيان بالحقيقة مصحوبة بدليلها", "إثارة الخيال بالمبالغة في التّهويل"]},
   {"correct": 0}, "بلاغته: توضيح المعنى وتقريبه من ذهن المتلقّي.", 0.25, "ar.rhetoric.effect")
st("s29", "q11", "q11-e1", "mcq", "ما النّمط الغالب على نصّ توفيق الحكيم؟",
   {"options": ["التّفسيريّ", "السّرديّ", "الوصفيّ", "الحواريّ"]},
   {"correct": 0}, "النّمط الغالب على النّصّ هو النّمط التّفسيريّ.", 0.5, "ar.text.type")
TYPE_EXPL = ("مؤشّرات النّمط التّفسيريّ: ذكر الموضوع المراد شرحه (الابتكار في الفنّ والأدب)؛ تعريف الموضوع؛ الموضوعيّة والتّدرّج في عرض الأفكار؛ "
             "استعمال أدوات التّوكيد والتّفصيل والتّفسير؛ التّمثيل. يكتفي المترشّح بذكر مؤشّرين فقط.")
st("s30", "q11", "q11-e2", "multi", "أيّ ممّا يلي من مؤشّرات النّمط التّفسيريّ في النّصّ؟ (اختر كلّ ما يصحّ)",
   {"options": ["ذكر الموضوع المراد شرحه (الابتكار في الفنّ والأدب)", "تعريف الموضوع", "الموضوعيّة والتّدرّج في عرض الأفكار",
                "استعمال أدوات التّوكيد والتّفصيل والتّفسير", "التّمثيل", "تتابع الأحداث في الزّمن", "كثرة الأساليب الإنشائيّة الانفعاليّة"]},
   {"correct": [0, 1, 2, 3, 4]}, TYPE_EXPL + " أمّا تتابع الأحداث فمؤشّر سرديّ، والأساليب الانفعاليّة لا تناسب الموضوعيّة.", 0.75, "ar.text.type")
st("s31", "q11", "q11-e2", "fill_blank", "أكمل من مؤشّرات النّمط التّفسيريّ في النّصّ:",
   {"text": "ذكر الموضوع المراد ____ (الابتكار في الفنّ والأدب)؛ ____ الموضوع؛ الموضوعيّة و____ في عرض الأفكار.",
    "bank": ["شرحه", "تعريف", "التّدرّج", "سرده", "إخفاء", "العشوائيّة"]},
   {"blanks": [["شرحه"], ["تعريف"], ["التّدرّج"]]}, TYPE_EXPL, 0.75, "ar.text.type", "b")

TITLE = "بكالوريا 2012 (الدّورة العاديّة) – اللّغة العربيّة وآدابها – الشّعب العلميّة – الموضوع الثّاني (توفيق الحكيم: من «فنّ الأدب»)"
NOTES = ("نسخة من موضوع البكالوريا الرّسميّ (الدّيوان الوطنيّ للامتحانات والمسابقات، دورة جوان 2012، شعب علوم تجريبيّة ورياضيات وتقني رياضي وتسيير واقتصاد) "
         f"في Drive صاحب المنصّة؛ النّصّ الحرفيّ من ملفّ docx (والنّسخة نفسها بصيغة PDF: gdrive:{PDF_ID})، مقابَلًا بالموضوع الرّسميّ gdrive:{OFFICIAL_ID} "
         "(01_الموضوع.pdf، ص3–4): النّصّ والأسئلة متطابقة، والفروق فروق شكل وإملاء أُبقيت كما في docx. الفقرة الثّانية مقسومة في docx على فقرتين فوُصلتا بمسافة "
         "كما في الموضوع الرّسميّ. الشّعب من رأس الموضوع الرّسميّ. العلامات من الإجابة النّموذجيّة وسلّم التّنقيط الرّسميّين (ممسوح، ص3–4). المجموع 20 = بناء فكريّ 12 + "
         "بناء لغويّ 8. س2: «2×0.5» = رأي الكاتب + توضيحه؛ س4 «6×0.25» ثلاث وسائل من أربع مع التّمثيل فعنصر واحد؛ الصّورة الثّانية «2×0.5» = الشّرح + النّوع. "
         "مؤجَّل (essay_builder): الرّأي المعلّل س3 (01.5) والتّلخيص س6 (3×01) = 4.5 نقاط.")
LOG_NOTE = "تحويل من نسخة الموضوع (docx، مقابَلة بالموضوع الرّسميّ) والإجابة النّموذجيّة الرّسميّة (PDF ممسوح) في Drive؛ العلامات من سلّم التّنقيط؛ الإجابات الصّحيحة من الإجابة النّموذجيّة؛ المشتّتات من إعداد التّحويل وتحتاج مراجعة."
_write("ar-bac-2012-sci-p2", 2, TITLE, NOTES, LOG_NOTE)
